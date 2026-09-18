using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CeisaTray
{
    #region 1. Enums & Application Entry Point
    public enum OperationMode
    {
        Auto = 0,       // Cerdas: Standby jika ada Host Kantor, jadi Host jika sendiri
        ForceHost = 1,  // Paksa selalu nyalakan server lokal di PC ini
        ClientOnly = 2  // Hanya sebagai Klien (tidak pernah menyalakan server lokal)
    }

    public enum ServerRole
    {
        Host,
        Client,
        Standby
    }

    static class Program
    {
        private static Mutex singleInstanceMutex = null;

        [STAThread]
        static void Main()
        {
            const string mutexId = "CEISA_Inspector_Tray_SingleInstance_Mutex";
            bool isFirstInstance;

            singleInstanceMutex = new Mutex(true, mutexId, out isFirstInstance);
            if (!isFirstInstance)
            {
                // Sudah ada instance tray yang berjalan di latar belakang
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new TrayApplicationContext());
        }
    }
    #endregion

    #region 2. Application Context & State Properties
    public class TrayApplicationContext : ApplicationContext
    {
        // Komponen UI WinForms
        private NotifyIcon trayIcon;
        private ContextMenuStrip contextMenu;
        private ToolStripMenuItem itemHeader;
        private ToolStripMenuItem itemStatus;
        private ToolStripMenuItem itemOpenDashboard;
        private ToolStripMenuItem itemCopyWifiUrl;
        
        // Submenu Mode Operasi
        private ToolStripMenuItem itemModeMenu;
        private ToolStripMenuItem itemModeAuto;
        private ToolStripMenuItem itemModeHost;
        private ToolStripMenuItem itemModeClient;

        private ToolStripMenuItem itemStartServer;
        private ToolStripMenuItem itemStopServer;
        private ToolStripMenuItem itemRestartServer;
        private ToolStripMenuItem itemDetails;
        private ToolStripMenuItem itemOpenFolder;
        private ToolStripMenuItem itemOpenLog;
        private ToolStripMenuItem itemAutostart;
        private ToolStripMenuItem itemExit;

        // Timer dan Aset Visual
        private System.Windows.Forms.Timer timerHealthCheck;
        private Icon iconOnline;
        private Icon iconOffline;

        // Status & Path Runtime
        private string appBaseDir;
        private string projectRootDir;
        private bool isServerOnline = false;
        private int currentServerPid = -1;
        private string currentWifiUrl = "http://127.0.0.1:8080/dashboard.html";
        private string currentUptime = "";
        private bool isPollingActive = false;

        // Multi-User Role & Mode State
        private OperationMode currentMode = OperationMode.Auto;
        private ServerRole currentRole = ServerRole.Host;
        private string remoteServerHost = "";
        private string activeHostIp = "127.0.0.1";
        private SynchronizationContext syncContext;

        private const string REG_RUN_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string REG_APP_NAME = "CEISA_Inspector_Tray";

        public TrayApplicationContext()
        {
            syncContext = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
            InitDirectories();
            LoadTrayIcons();
            LoadOperationConfig();
            BuildContextMenu();

            // Inisialisasi Tray Icon
            trayIcon = new NotifyIcon()
            {
                Icon = iconOffline,
                ContextMenuStrip = contextMenu,
                Visible = true,
                Text = "CEISA Inspector: Memeriksa Jaringan..."
            };

            trayIcon.DoubleClick += (s, e) => OpenDashboard();
            trayIcon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    OpenDashboard();
                }
            };

            // Inisialisasi Background Polling Timer (setiap 2.5 detik)
            timerHealthCheck = new System.Windows.Forms.Timer();
            timerHealthCheck.Interval = 2500;
            timerHealthCheck.Tick += (s, e) => PollServerStatusAsync();
            timerHealthCheck.Start();

            // Inisialisasi peran cerdas (Host vs Client) saat startup
            ThreadPool.QueueUserWorkItem(_ =>
            {
                ExecuteSmartStartup();
            });

            // Pastikan autostart Windows terdaftar
            SyncAutostartRegistry(true);
        }

        private void RunOnUIThread(Action action)
        {
            if (action == null) return;
            if (syncContext != null)
            {
                syncContext.Post(_ =>
                {
                    try { action(); } catch {}
                }, null);
            }
            else
            {
                try { action(); } catch {}
            }
        }

        private void InitDirectories()
        {
            appBaseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            if (File.Exists(Path.Combine(appBaseDir, "server.js")))
            {
                projectRootDir = appBaseDir;
            }
            else if (Directory.GetParent(appBaseDir) != null && File.Exists(Path.Combine(Directory.GetParent(appBaseDir).FullName, "server.js")))
            {
                projectRootDir = Directory.GetParent(appBaseDir).FullName;
            }
            else
            {
                projectRootDir = @"C:\Synthetic";
            }
        }
        #endregion

        #region 3. Multi-User Configuration & Subnet Probing
        private string ConfigFilePath
        {
            get { return Path.Combine(projectRootDir, "tray_config.json"); }
        }

        private void LoadOperationConfig()
        {
            try
            {
                if (File.Exists(ConfigFilePath))
                {
                    string json = File.ReadAllText(ConfigFilePath);
                    Match mMode = Regex.Match(json, "\"mode\"\\s*:\\s*\"([^\"]+)\"");
                    if (mMode.Success)
                    {
                        string m = mMode.Groups[1].Value.ToLower();
                        if (m == "host" || m == "forcehost") currentMode = OperationMode.ForceHost;
                        else if (m == "client" || m == "clientonly") currentMode = OperationMode.ClientOnly;
                        else currentMode = OperationMode.Auto;
                    }

                    Match mHost = Regex.Match(json, "\"remoteHost\"\\s*:\\s*\"([^\"]+)\"");
                    if (mHost.Success)
                    {
                        remoteServerHost = mHost.Groups[1].Value;
                    }
                }
            }
            catch {}
        }

        private void SaveOperationConfig()
        {
            try
            {
                string modeStr = "auto";
                if (currentMode == OperationMode.ForceHost) modeStr = "host";
                else if (currentMode == OperationMode.ClientOnly) modeStr = "client";

                string json = string.Format("{{\r\n  \"mode\": \"{0}\",\r\n  \"remoteHost\": \"{1}\"\r\n}}", modeStr, remoteServerHost ?? "");
                File.WriteAllText(ConfigFilePath, json);
            }
            catch {}
        }

        private string GetLocalWifiIp()
        {
            try
            {
                IPAddress[] hostAddresses = Dns.GetHostAddresses(Dns.GetHostName());
                foreach (IPAddress ip in hostAddresses)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    {
                        string s = ip.ToString();
                        if (!s.StartsWith("169.254")) return s;
                    }
                }
            }
            catch {}
            return "127.0.0.1";
        }

        private string ProbeNetworkForRemoteHost()
        {
            List<string> candidates = new List<string>();
            HashSet<string> localIps = new HashSet<string>();
            localIps.Add("127.0.0.1");
            localIps.Add("localhost");

            try
            {
                IPAddress[] hostAddresses = Dns.GetHostAddresses(Dns.GetHostName());
                foreach (IPAddress ip in hostAddresses)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork)
                    {
                        string s = ip.ToString();
                        localIps.Add(s);

                        int dotIdx = s.LastIndexOf('.');
                        if (dotIdx > 0)
                        {
                            string subnet = s.Substring(0, dotIdx + 1);
                            int[] commonHosts = new int[] { 15, 1, 2, 5, 10, 20, 50, 100 };
                            foreach (int ch in commonHosts)
                            {
                                string testIp = subnet + ch;
                                if (!localIps.Contains(testIp) && !candidates.Contains(testIp))
                                {
                                    candidates.Add(testIp);
                                }
                            }
                        }
                    }
                }
            }
            catch {}

            if (!string.IsNullOrEmpty(remoteServerHost) && !localIps.Contains(remoteServerHost) && !candidates.Contains(remoteServerHost))
            {
                candidates.Insert(0, remoteServerHost);
            }

            string[] fallbackList = new string[] { "192.168.100.15", "192.168.1.15", "192.168.0.15" };
            foreach (string fb in fallbackList)
            {
                if (!localIps.Contains(fb) && !candidates.Contains(fb)) candidates.Add(fb);
            }

            foreach (string cand in candidates)
            {
                if (localIps.Contains(cand)) continue;
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://" + cand + ":8080/api/status");
                    req.Timeout = 400;
                    req.ReadWriteTimeout = 400;
                    req.Method = "GET";

                    using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                    {
                        if (res.StatusCode == HttpStatusCode.OK)
                        {
                            using (StreamReader r = new StreamReader(res.GetResponseStream()))
                            {
                                string text = r.ReadToEnd();
                                if (text.Contains("\"status\"") && text.Contains("\"ok\""))
                                {
                                    return cand;
                                }
                            }
                        }
                    }
                }
                catch {}
            }

            return null;
        }

        private void ExecuteSmartStartup()
        {
            try
            {
                AppendLog("Memulai evaluasi peran server (Mode: " + currentMode + ")");

                if (currentMode == OperationMode.ForceHost)
                {
                    currentRole = ServerRole.Host;
                    activeHostIp = GetLocalWifiIp();
                    PollServerStatusSync();
                    if (!isServerOnline)
                    {
                        StartServer(false);
                    }
                    return;
                }

                if (currentMode == OperationMode.ClientOnly)
                {
                    currentRole = ServerRole.Client;
                    string foundHost = ProbeNetworkForRemoteHost();
                    if (!string.IsNullOrEmpty(foundHost))
                    {
                        remoteServerHost = foundHost;
                        activeHostIp = foundHost;
                        currentWifiUrl = "http://" + foundHost + ":8080/dashboard.html";
                        SaveOperationConfig();
                    }
                    PollServerStatusAsync();
                    return;
                }

                // Mode == Auto: Cek apakah sudah ada server di jaringan Wi-Fi
                string detectedHost = ProbeNetworkForRemoteHost();
                if (!string.IsNullOrEmpty(detectedHost))
                {
                    // Ditemukan server rekan lain! Masuk mode klien standby
                    currentRole = ServerRole.Client;
                    remoteServerHost = detectedHost;
                    activeHostIp = detectedHost;
                    currentWifiUrl = "http://" + detectedHost + ":8080/dashboard.html";
                    SaveOperationConfig();

                    AppendLog("Server kantor terdeteksi di " + detectedHost + ". Server lokal disiagakan (Standby / Mode Klien).");
                    RunOnUIThread(() =>
                    {
                        trayIcon.ShowBalloonTip(3000, "CEISA Inspector: Mode Klien", "Terhubung ke Server Kantor di " + detectedHost + ".\nServer lokal tidak dijalankan untuk menghemat daya.", ToolTipIcon.Info);
                    });

                    PollServerStatusAsync();
                }
                else
                {
                    // Tidak ada server lain di LAN: Jadikan PC ini Server Utama
                    currentRole = ServerRole.Host;
                    activeHostIp = GetLocalWifiIp();
                    AppendLog("Tidak ada server lain di jaringan. Menjadi Server Utama (Host).");

                    PollServerStatusSync();
                    if (!isServerOnline)
                    {
                        StartServer(false);
                    }
                }
            }
            catch (Exception ex)
            {
                AppendLog("Error di ExecuteSmartStartup: " + ex.Message);
            }
        }
        #endregion

        #region 4. Context Menu Construction
        private void BuildContextMenu()
        {
            contextMenu = new ContextMenuStrip();
            contextMenu.ShowImageMargin = false;

            // 1. Header Merek & Status
            itemHeader = new ToolStripMenuItem("PORTAL CEISA INSPECTOR")
            {
                Enabled = false,
                Font = new Font(FontFamily.GenericSansSerif, 9f, FontStyle.Bold)
            };
            itemStatus = new ToolStripMenuItem("Status: Menghubungi...") { Enabled = false };

            // 2. Akses Cepat Dashboard & Wi-Fi
            itemOpenDashboard = new ToolStripMenuItem("🚀 Buka Dashboard di Browser", null, (s, e) => OpenDashboard());
            itemCopyWifiUrl = new ToolStripMenuItem("📋 Salin Link Dashboard / Wi-Fi", null, (s, e) => CopyWifiUrl());

            // 3. Submenu Mode Operasi (Host / Klien / Otomatis)
            itemModeMenu = new ToolStripMenuItem("⚙  Mode Operasi Server");
            itemModeAuto = new ToolStripMenuItem("● Otomatis (Standby jika ada Server Kantor)", null, (s, e) => SetOperationMode(OperationMode.Auto));
            itemModeHost = new ToolStripMenuItem("○ Paksa Jadi Server Utama (Host)", null, (s, e) => SetOperationMode(OperationMode.ForceHost));
            itemModeClient = new ToolStripMenuItem("○ Klien Saja (Hemat Resource)", null, (s, e) => SetOperationMode(OperationMode.ClientOnly));

            itemModeMenu.DropDownItems.AddRange(new ToolStripItem[] {
                itemModeAuto,
                itemModeHost,
                itemModeClient
            });
            UpdateModeMenuChecks();

            // 4. Kontrol Operasi Server Lokal
            itemStartServer = new ToolStripMenuItem("▶  Mulai Server Lokal", null, (s, e) => StartServer(true));
            itemStopServer = new ToolStripMenuItem("⏹  Hentikan Server Lokal", null, (s, e) => StopServer(true));
            itemRestartServer = new ToolStripMenuItem("🔄 Muat Ulang Server", null, (s, e) => RestartServer());

            // 5. Utilitas & Diagnostik
            itemDetails = new ToolStripMenuItem("ℹ  Cek Status Lengkap", null, (s, e) => ShowStatusDetails());
            itemOpenFolder = new ToolStripMenuItem("📁 Buka Folder Program", null, (s, e) => OpenWorkFolder());
            itemOpenLog = new ToolStripMenuItem("📄 Lihat Catatan Log", null, (s, e) => OpenLogFile());

            // 6. Autostart & Keluar
            itemAutostart = new ToolStripMenuItem("✔ Otomatis Start saat PC Dinyalakan", null, (s, e) => ToggleAutostart());
            itemAutostart.Checked = IsAutostartEnabled();

            itemExit = new ToolStripMenuItem("❌ Tutup Tray", null, (s, e) => ExitTray());

            contextMenu.Items.AddRange(new ToolStripItem[] {
                itemHeader,
                itemStatus,
                new ToolStripSeparator(),
                itemOpenDashboard,
                itemCopyWifiUrl,
                new ToolStripSeparator(),
                itemModeMenu,
                new ToolStripSeparator(),
                itemStartServer,
                itemStopServer,
                itemRestartServer,
                new ToolStripSeparator(),
                itemDetails,
                itemOpenFolder,
                itemOpenLog,
                new ToolStripSeparator(),
                itemAutostart,
                new ToolStripSeparator(),
                itemExit
            });
        }

        private void UpdateModeMenuChecks()
        {
            if (itemModeAuto != null)
            {
                itemModeAuto.Text = (currentMode == OperationMode.Auto ? "● " : "○ ") + "Otomatis (Standby jika ada Server Kantor)";
                itemModeHost.Text = (currentMode == OperationMode.ForceHost ? "● " : "○ ") + "Paksa Jadi Server Utama (Host)";
                itemModeClient.Text = (currentMode == OperationMode.ClientOnly ? "● " : "○ ") + "Klien Saja (Hemat Resource)";
            }
        }

        private void SetOperationMode(OperationMode newMode)
        {
            currentMode = newMode;
            SaveOperationConfig();
            UpdateModeMenuChecks();

            AppendLog("Mode operasi diubah menjadi: " + newMode);

            if (newMode == OperationMode.ForceHost)
            {
                currentRole = ServerRole.Host;
                activeHostIp = GetLocalWifiIp();
                if (!isServerOnline) StartServer(true);
                trayIcon.ShowBalloonTip(2000, "Mode Diubah", "PC ini disetel sebagai Server Utama.", ToolTipIcon.Info);
            }
            else if (newMode == OperationMode.ClientOnly)
            {
                currentRole = ServerRole.Client;
                if (isServerOnline) StopServer(false);
                ExecuteSmartStartup();
                trayIcon.ShowBalloonTip(2000, "Mode Diubah", "PC ini disetel sebagai Klien.", ToolTipIcon.Info);
            }
            else
            {
                ExecuteSmartStartup();
                trayIcon.ShowBalloonTip(2000, "Mode Diubah", "Mode Otomatis Aktif.", ToolTipIcon.Info);
            }
        }
        #endregion

        #region 5. Icon & Asset Management
        private void LoadTrayIcons()
        {
            try
            {
                string onlinePath = FindAssetFile("ceisa_online.ico");
                string offlinePath = FindAssetFile("ceisa_offline.ico");

                if (File.Exists(onlinePath))
                    iconOnline = new Icon(onlinePath);
                else
                    iconOnline = SystemIcons.Application;

                if (File.Exists(offlinePath))
                    iconOffline = new Icon(offlinePath);
                else
                    iconOffline = SystemIcons.Warning;
            }
            catch
            {
                iconOnline = SystemIcons.Application;
                iconOffline = SystemIcons.Warning;
            }
        }

        private string FindAssetFile(string fileName)
        {
            string inAppDir = Path.Combine(appBaseDir, fileName);
            if (File.Exists(inAppDir)) return inAppDir;

            string inRootDir = Path.Combine(projectRootDir, fileName);
            if (File.Exists(inRootDir)) return inRootDir;

            string inTrayDir = Path.Combine(projectRootDir, "tray", fileName);
            if (File.Exists(inTrayDir)) return inTrayDir;

            return inAppDir;
        }
        #endregion

        #region 6. Real-Time Server Monitoring & Polling
        private void PollServerStatusAsync()
        {
            if (isPollingActive) return;
            isPollingActive = true;

            ThreadPool.QueueUserWorkItem(_ =>
            {
                bool online = false;
                int pid = -1;
                string url = "";
                string uptime = "";

                string targetEndpoint = (currentRole == ServerRole.Client && !string.IsNullOrEmpty(activeHostIp) && activeHostIp != "127.0.0.1")
                    ? "http://" + activeHostIp + ":8080/api/status"
                    : "http://127.0.0.1:8080/api/status";

                try
                {
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(targetEndpoint);
                    request.Timeout = 1200;
                    request.Method = "GET";

                    using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                    {
                        if (response.StatusCode == HttpStatusCode.OK)
                        {
                            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                            {
                                string json = reader.ReadToEnd();
                                online = true;

                                Match mPid = Regex.Match(json, "\"pid\"\\s*:\\s*(\\d+)");
                                if (mPid.Success) pid = int.Parse(mPid.Groups[1].Value);

                                Match mUrl = Regex.Match(json, "\"wifiUrl\"\\s*:\\s*\"([^\"]+)\"");
                                if (mUrl.Success) url = mUrl.Groups[1].Value;

                                Match mUptime = Regex.Match(json, "\"uptime\"\\s*:\\s*(\\d+)");
                                if (mUptime.Success) uptime = mUptime.Groups[1].Value + "s";
                            }
                        }
                    }
                }
                catch
                {
                    online = false;
                }

                // Jika mode Auto dan host remote kantor mati, coba re-evaluasi agar tidak disconnect
                if (!online && currentRole == ServerRole.Client && currentMode == OperationMode.Auto)
                {
                    string foundHost = ProbeNetworkForRemoteHost();
                    if (string.IsNullOrEmpty(foundHost))
                    {
                        AppendLog("Host kantor terputus. Mengaktifkan server lokal secara otomatis...");
                        currentRole = ServerRole.Host;
                        StartServer(false);
                    }
                }

                RunOnUIThread(() =>
                {
                    ApplyStatusToUI(online, pid, url, uptime);
                });
                isPollingActive = false;
            });
        }

        private void PollServerStatusSync()
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8080/api/status");
                request.Timeout = 1000;
                request.Method = "GET";

                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if (response.StatusCode == HttpStatusCode.OK)
                    {
                        using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                        {
                            string json = reader.ReadToEnd();
                            int pid = -1;
                            string url = "";
                            string uptime = "";

                            Match mPid = Regex.Match(json, "\"pid\"\\s*:\\s*(\\d+)");
                            if (mPid.Success) pid = int.Parse(mPid.Groups[1].Value);

                            Match mUrl = Regex.Match(json, "\"wifiUrl\"\\s*:\\s*\"([^\"]+)\"");
                            if (mUrl.Success) url = mUrl.Groups[1].Value;

                            Match mUptime = Regex.Match(json, "\"uptime\"\\s*:\\s*(\\d+)");
                            if (mUptime.Success) uptime = mUptime.Groups[1].Value + "s";

                            RunOnUIThread(() =>
                            {
                                ApplyStatusToUI(true, pid, url, uptime);
                            });
                            return;
                        }
                    }
                }
            }
            catch {}

            RunOnUIThread(() =>
            {
                ApplyStatusToUI(false, -1, "", "");
            });
        }

        private void ApplyStatusToUI(bool online, int pid, string url, string uptime)
        {
            isServerOnline = online;
            currentServerPid = pid;
            if (!string.IsNullOrEmpty(url)) currentWifiUrl = url;
            currentUptime = uptime;

            if (online)
            {
                trayIcon.Icon = iconOnline;

                if (currentRole == ServerRole.Client)
                {
                    string tip = "CEISA Klien: Terhubung ke " + activeHostIp;
                    trayIcon.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;

                    itemStatus.Text = "● Status: KLIEN (Server: " + activeHostIp + ")";
                    itemStatus.ForeColor = Color.DodgerBlue;

                    itemStartServer.Enabled = true;
                    itemStopServer.Enabled = false;
                    itemRestartServer.Enabled = false;
                }
                else
                {
                    string tip = "CEISA Inspector: AKTIF (Port 8080)";
                    if (pid > 0) tip = "CEISA Host: AKTIF (PID: " + pid + ")";
                    trayIcon.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;

                    itemStatus.Text = "● Status: SERVER UTAMA (PID: " + (pid > 0 ? pid.ToString() : "OK") + ")";
                    itemStatus.ForeColor = Color.DarkGreen;

                    itemStartServer.Enabled = false;
                    itemStopServer.Enabled = true;
                    itemRestartServer.Enabled = true;
                }

                itemOpenDashboard.Enabled = true;
                itemCopyWifiUrl.Enabled = true;
            }
            else
            {
                trayIcon.Icon = iconOffline;
                trayIcon.Text = "CEISA Inspector: TIDAK AKTIF";

                itemStatus.Text = "○ Status: TIDAK AKTIF (Mati)";
                itemStatus.ForeColor = Color.Red;

                itemStartServer.Enabled = true;
                itemStopServer.Enabled = false;
                itemRestartServer.Enabled = false;
                itemOpenDashboard.Enabled = true;
                itemCopyWifiUrl.Enabled = false;
            }
        }
        #endregion

        #region 7. Server Control Actions (Start / Stop / Restart)
        private void StartServer(bool notifyUser)
        {
            if (isServerOnline && currentRole == ServerRole.Host)
            {
                if (notifyUser)
                    trayIcon.ShowBalloonTip(2000, "CEISA Inspector", "Server lokal sudah aktif di port 8080.", ToolTipIcon.Info);
                return;
            }

            try
            {
                string nodeExe = ResolveNodeExecutable();

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "server.js";
                psi.WorkingDirectory = projectRootDir;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;

                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    currentRole = ServerRole.Host;
                    activeHostIp = GetLocalWifiIp();
                    currentWifiUrl = "http://" + activeHostIp + ":8080/dashboard.html";

                    AppendLog("CEISA Server lokal dinyalakan via Tray (PID: " + proc.Id + ")");
                    if (notifyUser)
                        trayIcon.ShowBalloonTip(2500, "CEISA Inspector", "Server lokal berhasil dinyalakan (Port 8080).", ToolTipIcon.Info);
                }

                ThreadPool.QueueUserWorkItem(_ =>
                {
                    Thread.Sleep(1200);
                    PollServerStatusAsync();
                });
            }
            catch (Exception ex)
            {
                AppendLog("Gagal menyalakan CEISA Server: " + ex.Message);
                if (notifyUser)
                    MessageBox.Show("Gagal menyalakan server:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void StopServer(bool notifyUser)
        {
            try
            {
                string stopBat = FindAssetFile("stop_server.bat");
                if (File.Exists(stopBat))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c \"" + stopBat + "\"";
                    psi.WorkingDirectory = projectRootDir;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;

                    Process p = Process.Start(psi);
                    if (p != null) p.WaitForExit(3000);
                }
                else if (currentServerPid > 0)
                {
                    try
                    {
                        Process p = Process.GetProcessById(currentServerPid);
                        p.Kill();
                    }
                    catch {}
                }

                AppendLog("CEISA Server dihentikan via Tray.");
                ApplyStatusToUI(false, -1, "", "");

                if (notifyUser)
                    trayIcon.ShowBalloonTip(2000, "CEISA Inspector", "Server telah dinonaktifkan.", ToolTipIcon.Warning);
            }
            catch (Exception ex)
            {
                if (notifyUser)
                    MessageBox.Show("Gagal menghentikan server:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void RestartServer()
        {
            trayIcon.ShowBalloonTip(1500, "CEISA Inspector", "Memuat ulang server...", ToolTipIcon.Info);
            StopServer(false);
            Thread.Sleep(1000);
            StartServer(true);
        }

        private string ResolveNodeExecutable()
        {
            if (File.Exists(@"D:\Program Files\nodejs\node.exe"))
                return @"D:\Program Files\nodejs\node.exe";
            if (File.Exists(@"C:\Program Files\nodejs\node.exe"))
                return @"C:\Program Files\nodejs\node.exe";
            if (File.Exists(@"C:\Program Files (x86)\nodejs\node.exe"))
                return @"C:\Program Files (x86)\nodejs\node.exe";
            return "node.exe";
        }
        #endregion

        #region 8. UI Handlers (Browser, Clipboard, Folder, Log)
        private void OpenDashboard()
        {
            try
            {
                string targetUrl = currentWifiUrl;
                if (string.IsNullOrEmpty(targetUrl))
                {
                    targetUrl = (currentRole == ServerRole.Client && !string.IsNullOrEmpty(activeHostIp))
                        ? "http://" + activeHostIp + ":8080/dashboard.html"
                        : "http://localhost:8080/dashboard.html";
                }

                if (!isServerOnline && currentRole == ServerRole.Host)
                {
                    StartServer(false);
                    Thread.Sleep(800);
                }

                Process.Start(targetUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Gagal membuka browser:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void CopyWifiUrl()
        {
            try
            {
                string urlToCopy = currentWifiUrl;
                if (string.IsNullOrEmpty(urlToCopy))
                {
                    urlToCopy = "http://" + activeHostIp + ":8080/dashboard.html";
                }

                Clipboard.SetText(urlToCopy);
                trayIcon.ShowBalloonTip(3000, "Link Wi-Fi Disalin!", urlToCopy + "\n\nTempel link ini di browser HP / PC rekan yang terhubung ke Wi-Fi.", ToolTipIcon.Info);
            }
            catch {}
        }

        private void ShowStatusDetails()
        {
            string msg = "";
            string roleStr = (currentRole == ServerRole.Host) ? "Server Utama (Host)" : "Klien (Tersambung ke Host)";
            string modeStr = currentMode.ToString();

            if (isServerOnline)
            {
                msg = "Peran PC: " + roleStr + "\n" +
                      "Mode Operasi: " + modeStr + "\n" +
                      "Target Server: " + activeHostIp + ":8080\n" +
                      "PID Server: " + (currentServerPid > 0 ? currentServerPid.ToString() : "-") + "\n" +
                      "Durasi Uptime: " + currentUptime + "\n\n" +
                      "URL Dashboard: " + currentWifiUrl;
                trayIcon.ShowBalloonTip(5000, "Status CEISA Inspector", msg, ToolTipIcon.Info);
            }
            else
            {
                msg = "Peran PC: " + roleStr + "\n" +
                      "Mode Operasi: " + modeStr + "\n" +
                      "Status: Menunggu koneksi / Server Mati\n\n" +
                      "Klik 'Mulai Server Lokal' jika ingin menjadikan PC ini sebagai Host.";
                trayIcon.ShowBalloonTip(4000, "Status CEISA Inspector", msg, ToolTipIcon.Warning);
            }
        }

        private void OpenWorkFolder()
        {
            try
            {
                Process.Start("explorer.exe", projectRootDir);
            }
            catch {}
        }

        private void OpenLogFile()
        {
            try
            {
                string logFile = Path.Combine(projectRootDir, "autostart.log");
                if (!File.Exists(logFile))
                {
                    File.WriteAllText(logFile, "[" + DateTime.Now + "] Log dimulai.\r\n");
                }
                Process.Start("notepad.exe", logFile);
            }
            catch {}
        }
        #endregion

        #region 9. Windows Autostart & Registry Integration
        private bool IsAutostartEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(REG_RUN_KEY, false))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(REG_APP_NAME);
                        return val != null;
                    }
                }
            }
            catch {}
            return false;
        }

        private void ToggleAutostart()
        {
            bool currentState = itemAutostart.Checked;
            bool newState = !currentState;
            SyncAutostartRegistry(newState);
            itemAutostart.Checked = newState;

            string statusText = newState ? "Diaktifkan (Akan otomatis muncul saat PC hidup)" : "Dinonaktifkan";
            trayIcon.ShowBalloonTip(2500, "Autostart", "Otomatisasi Startup telah " + statusText, ToolTipIcon.Info);
        }

        private void SyncAutostartRegistry(bool enable)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(REG_RUN_KEY, true))
                {
                    if (key != null)
                    {
                        string currentExe = Application.ExecutablePath;
                        if (enable)
                        {
                            key.SetValue(REG_APP_NAME, "\"" + currentExe + "\"");
                        }
                        else
                        {
                            key.DeleteValue(REG_APP_NAME, false);
                        }
                    }
                }
            }
            catch {}
        }
        #endregion

        #region 10. Logging & Lifecycle Management
        private void AppendLog(string message)
        {
            try
            {
                string logPath = Path.Combine(projectRootDir, "autostart.log");
                File.AppendAllText(logPath, "[" + DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss") + "] " + message + "\r\n");
            }
            catch {}
        }

        private void ExitTray()
        {
            if (timerHealthCheck != null)
            {
                timerHealthCheck.Stop();
                timerHealthCheck.Dispose();
            }

            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }

            Application.Exit();
        }
        #endregion
    }
}
