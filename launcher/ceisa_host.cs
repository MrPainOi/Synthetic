using System;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace CeisaLauncher
{
    class Program
    {
        static string ProjectRoot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        static string LogFile = Path.Combine(ProjectRoot, "autostart.log");
        static int ServerPort = 5005;

        static void Log(string msg)
        {
            try
            {
                string line = string.Format("[{0}] [NativeHostExe] {1}\n", DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss"), msg);
                File.AppendAllText(LogFile, line, Encoding.UTF8);
            }
            catch { }
        }

        static string ReadNativeMessage()
        {
            Stream stdin = Console.OpenStandardInput();
            byte[] lenBytes = new byte[4];
            int read = stdin.Read(lenBytes, 0, 4);
            if (read < 4) return null;

            int length = BitConverter.ToInt32(lenBytes, 0);
            if (length <= 0 || length > 10 * 1024 * 1024) return null;

            byte[] buffer = new byte[length];
            int totalRead = 0;
            while (totalRead < length)
            {
                int r = stdin.Read(buffer, totalRead, length - totalRead);
                if (r <= 0) break;
                totalRead += r;
            }
            return Encoding.UTF8.GetString(buffer, 0, totalRead);
        }

        static void SendNativeMessage(string json)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            byte[] lenBytes = BitConverter.GetBytes(bytes.Length);
            Stream stdout = Console.OpenStandardOutput();
            stdout.Write(lenBytes, 0, 4);
            stdout.Write(bytes, 0, bytes.Length);
            stdout.Flush();
        }

        static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }

        static bool IsServerOnline()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + ServerPort + "/api/status");
                req.Timeout = 1200;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static string GetLocalVersionJson()
        {
            string vFile = Path.Combine(ProjectRoot, "version.json");
            if (File.Exists(vFile))
            {
                try { return File.ReadAllText(vFile, Encoding.UTF8).Trim(); } catch { }
            }
            return "{\"version\":\"2.1.2\",\"branch\":\"SupabaseV2\"}";
        }

        static string ExtractCommitFromVersion(string json)
        {
            Match m = Regex.Match(json, "\"commit\"\\s*:\\s*\"([^\"]+)\"");
            return m.Success ? m.Groups[1].Value : "";
        }

        static string ExtractVersionString(string json)
        {
            Match m = Regex.Match(json, "\"version\"\\s*:\\s*\"([^\"]+)\"");
            return m.Success ? m.Groups[1].Value : "2.1.2";
        }

        static void CopyDirectory(string sourceDir, string destDir)
        {
            Directory.CreateDirectory(destDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string name = Path.GetFileName(file);
                if (name == "autostart.log" || name == "server.log") continue;
                string destFile = Path.Combine(destDir, name);
                try { File.Copy(file, destFile, true); } catch { }
            }
            foreach (string sub in Directory.GetDirectories(sourceDir))
            {
                string name = Path.GetFileName(sub);
                if (name == ".git" || name == "node_modules" || name == "temp") continue;
                CopyDirectory(sub, Path.Combine(destDir, name));
            }
        }

        static bool PerformPullUpdate(out string newCommit, out string errMsg)
        {
            newCommit = "";
            errMsg = "";
            Log("Menjalankan pull update (Zero-Node Native Engine)...");

            string tempZip = Path.Combine(ProjectRoot, "temp_update.zip");
            string tempExtractDir = Path.Combine(ProjectRoot, "temp_extracted_update");

            try
            {
                // 1. Unduh ZIP dari GitHub
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                using (WebClient wc = new WebClient())
                {
                    wc.Headers.Add("User-Agent", "CeisaNativeUpdater/2.0");
                    wc.DownloadFile("https://codeload.github.com/MrPainOi/Synthetic/zip/refs/heads/SupabaseV2", tempZip);
                }

                if (!File.Exists(tempZip) || new FileInfo(tempZip).Length < 1000)
                {
                    errMsg = "File zip tidak valid atau gagal diunduh.";
                    return false;
                }

                // 2. Ekstrak ZIP
                if (Directory.Exists(tempExtractDir))
                {
                    try { Directory.Delete(tempExtractDir, true); } catch { }
                }
                Directory.CreateDirectory(tempExtractDir);

                bool extracted = false;
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo("tar.exe", string.Format("-xf \"{0}\" -C \"{1}\"", tempZip, tempExtractDir));
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    Process p = Process.Start(psi);
                    p.WaitForExit(30000);
                    extracted = (p.ExitCode == 0);
                }
                catch { }

                if (!extracted)
                {
                    ZipFile.ExtractToDirectory(tempZip, tempExtractDir);
                }

                // 3. Salin hasil ekstrak ke folder proyek
                string[] subdirs = Directory.GetDirectories(tempExtractDir);
                string sourceDir = subdirs.Length > 0 ? subdirs[0] : tempExtractDir;

                CopyDirectory(sourceDir, ProjectRoot);

                // Bersihkan file sementara
                try { File.Delete(tempZip); } catch { }
                try { Directory.Delete(tempExtractDir, true); } catch { }

                // Perbarui version.json
                string vJson = GetLocalVersionJson();
                newCommit = ExtractCommitFromVersion(vJson);

                Log("Pull update selesai dan berhasil diterapkan!");
                return true;
            }
            catch (Exception ex)
            {
                errMsg = ex.Message;
                Log("Error pull update: " + ex.Message);
                try { if (File.Exists(tempZip)) File.Delete(tempZip); } catch { }
                try { if (Directory.Exists(tempExtractDir)) Directory.Delete(tempExtractDir, true); } catch { }
                return false;
            }
        }

        static void Main(string[] args)
        {
            Log("ceisa_host.exe dimulai oleh Chrome.");

            while (true)
            {
                string rawMsg = ReadNativeMessage();
                if (rawMsg == null) break;

                Log("Pesan masuk: " + rawMsg);

                try
                {
                    if (rawMsg.Contains("\"action\":\"status\""))
                    {
                        bool online = IsServerOnline();
                        SendNativeMessage(string.Format("{{\"status\":\"{0}\",\"port\":{1}}}", online ? "online" : "offline", ServerPort));
                    }
                    else if (rawMsg.Contains("\"action\":\"get_version\""))
                    {
                        string vJson = GetLocalVersionJson();
                        SendNativeMessage(string.Format("{{\"status\":\"success\",\"data\":{0}}}", vJson));
                    }
                    else if (rawMsg.Contains("\"action\":\"check_update\""))
                    {
                        string localJson = GetLocalVersionJson();
                        string localCommit = ExtractCommitFromVersion(localJson);
                        string remoteCommit = "";
                        string remoteMsg = "";
                        bool updateAvailable = false;

                        try
                        {
                            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
                            HttpWebRequest req = (HttpWebRequest)WebRequest.Create("https://api.github.com/repos/MrPainOi/Synthetic/commits/SupabaseV2");
                            req.UserAgent = "CeisaNativeUpdater/2.0";
                            req.Timeout = 5000;
                            using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                            using (StreamReader reader = new StreamReader(res.GetResponseStream()))
                            {
                                string body = reader.ReadToEnd();
                                Match mSha = Regex.Match(body, "\"sha\"\\s*:\\s*\"([a-f0-9]+)\"");
                                if (mSha.Success) remoteCommit = mSha.Groups[1].Value;
                                Match mMsg = Regex.Match(body, "\"message\"\\s*:\\s*\"([^\"]+)\"");
                                if (mMsg.Success) remoteMsg = mMsg.Groups[1].Value;
                            }
                            if (!string.IsNullOrEmpty(remoteCommit) && remoteCommit != localCommit)
                            {
                                updateAvailable = true;
                            }
                        }
                        catch (Exception ex)
                        {
                            Log("Peringatan cek update GitHub API: " + ex.Message);
                        }

                        SendNativeMessage(string.Format(
                            "{{\"status\":\"success\",\"update_available\":{0},\"local_commit\":\"{1}\",\"remote_commit\":\"{2}\",\"remote_message\":\"{3}\"}}",
                            updateAvailable ? "true" : "false",
                            EscapeJson(localCommit),
                            EscapeJson(remoteCommit),
                            EscapeJson(remoteMsg)
                        ));
                    }
                    else if (rawMsg.Contains("\"action\":\"pull_update\""))
                    {
                        string newCommit;
                        string errMsg;
                        bool ok = PerformPullUpdate(out newCommit, out errMsg);
                        if (ok)
                        {
                            SendNativeMessage("{\"status\":\"success\",\"message\":\"Pembaruan berhasil diterapkan!\"}");
                        }
                        else
                        {
                            SendNativeMessage(string.Format("{{\"status\":\"error\",\"error\":\"{0}\"}}", EscapeJson(errMsg)));
                        }
                    }
                    else if (rawMsg.Contains("\"action\":\"start\""))
                    {
                        // Jika ada Node.js di komputer (misal PC Developer), jalankan server backend
                        string nodePath = "node";
                        bool hasNode = false;
                        if (File.Exists("C:\\Program Files\\nodejs\\node.exe")) { nodePath = "C:\\Program Files\\nodejs\\node.exe"; hasNode = true; }
                        else if (File.Exists("D:\\Program Files\\nodejs\\node.exe")) { nodePath = "D:\\Program Files\\nodejs\\node.exe"; hasNode = true; }

                        if (hasNode)
                        {
                            string serverScript = Path.Combine(ProjectRoot, "backend-service", "server.js");
                            ProcessStartInfo psi = new ProcessStartInfo(nodePath, string.Format("\"{0}\"", serverScript));
                            psi.WorkingDirectory = Path.Combine(ProjectRoot, "backend-service");
                            psi.CreateNoWindow = true;
                            psi.UseShellExecute = false;
                            Process.Start(psi);
                            SendNativeMessage("{\"status\":\"started\",\"port\":5005}");
                        }
                        else
                        {
                            SendNativeMessage("{\"status\":\"client_mode\",\"message\":\"Mode Klien: Server Parser berada di PC Host\"}");
                        }
                    }
                    else
                    {
                        SendNativeMessage("{\"status\":\"success\"}");
                    }
                }
                catch (Exception ex)
                {
                    Log("Exception di loop pesan: " + ex.Message);
                    SendNativeMessage(string.Format("{{\"status\":\"error\",\"error\":\"{0}\"}}", EscapeJson(ex.Message)));
                }
            }

            Log("ceisa_host.exe selesai.");
        }
    }
}
