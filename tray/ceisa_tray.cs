using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CeisaTray
{
    #region 1. Application Entry Point & Mutex
    /// <summary>
    /// Titik masuk aplikasi System Tray CEISA Inspector.
    /// Dilengkapi proteksi Single-Instance Mutex agar aplikasi tidak berjalan ganda.
    /// </summary>
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
    /// <summary>
    /// Context utama aplikasi tray yang mengelola lifecycle icon taskbar, polling status, dan menu kontrol.
    /// </summary>
    public class TrayApplicationContext : ApplicationContext
    {
        // Komponen UI WinForms
        private NotifyIcon trayIcon;
        private ContextMenuStrip contextMenu;
        private ToolStripMenuItem itemHeader;
        private ToolStripMenuItem itemStatus;
        private ToolStripMenuItem itemOpenDashboard;
        private ToolStripMenuItem itemCopyWifiUrl;
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

        private const string REG_RUN_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string REG_APP_NAME = "CEISA_Inspector_Tray";

        public TrayApplicationContext()
        {
            InitDirectories();
            LoadTrayIcons();
            BuildContextMenu();

            // Inisialisasi Tray Icon
            trayIcon = new NotifyIcon()
            {
                Icon = iconOffline,
                ContextMenuStrip = contextMenu,
                Visible = true,
                Text = "CEISA Inspector: Memeriksa..."
            };

            // Klik kiri atau dobel klik langsung meluncurkan dashboard browser
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

            // Pengecekan sinkron awal: jika server mati, nyalakan otomatis
            PollServerStatusSync();
            if (!isServerOnline)
            {
                StartServer(false);
            }

            // Pastikan autostart Windows terdaftar
            SyncAutostartRegistry(true);
        }

        /// <summary>
        /// Menentukan lokasi root project C:\Synthetic secara dinamis.
        /// Mendukung eksekusi baik dari folder tray/ maupun root.
        /// </summary>
        private void InitDirectories()
        {
            appBaseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            
            // Cek apakah server.js ada di folder lokal atau parent folder
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

        #region 3. Context Menu Construction
        /// <summary>
        /// Membangun antarmuka Context Menu klik kanan tray dengan visual profesional.
        /// </summary>
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
            itemCopyWifiUrl = new ToolStripMenuItem("📋 Salin Link Wi-Fi (Untuk HP)", null, (s, e) => CopyWifiUrl());

            // 3. Kontrol Operasi Server
            itemStartServer = new ToolStripMenuItem("▶  Mulai Server (Start)", null, (s, e) => StartServer(true));
            itemStopServer = new ToolStripMenuItem("⏹  Hentikan Server (Stop)", null, (s, e) => StopServer(true));
            itemRestartServer = new ToolStripMenuItem("🔄 Muat Ulang Server (Restart)", null, (s, e) => RestartServer());

            // 4. Utilitas & Diagnostik
            itemDetails = new ToolStripMenuItem("ℹ  Cek Status Lengkap", null, (s, e) => ShowStatusDetails());
            itemOpenFolder = new ToolStripMenuItem("📁 Buka Folder Program", null, (s, e) => OpenWorkFolder());
            itemOpenLog = new ToolStripMenuItem("📄 Lihat Catatan Log", null, (s, e) => OpenLogFile());

            // 5. Autostart & Keluar
            itemAutostart = new ToolStripMenuItem("✔ Otomatis Start saat PC Dinyalakan", null, (s, e) => ToggleAutostart());
            itemAutostart.Checked = IsAutostartEnabled();

            itemExit = new ToolStripMenuItem("❌ Tutup Tray", null, (s, e) => ExitTray());

            // Menyusun urutan item dengan separator yang rapi
            contextMenu.Items.AddRange(new ToolStripItem[] {
                itemHeader,
                itemStatus,
                new ToolStripSeparator(),
                itemOpenDashboard,
                itemCopyWifiUrl,
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
        #endregion

        #region 4. Icon & Asset Management
        /// <summary>
        /// Memuat icon online (hijau) dan offline (merah/abu-abu).
        /// </summary>
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

        #region 5. Real-Time Server Monitoring & Polling
        /// <summary>
        /// Pengecekan asinkron berkala ke http://127.0.0.1:8080/api/status tanpa membekukan UI thread.
        /// </summary>
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

                try
                {
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8080/api/status");
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

                if (trayIcon != null && contextMenu != null && !contextMenu.IsDisposed)
                {
                    try
                    {
                        contextMenu.BeginInvoke(new Action(() =>
                        {
                            ApplyStatusToUI(online, pid, url, uptime);
                            isPollingActive = false;
                        }));
                    }
                    catch
                    {
                        isPollingActive = false;
                    }
                }
                else
                {
                    isPollingActive = false;
                }
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

                            ApplyStatusToUI(true, pid, url, uptime);
                            return;
                        }
                    }
                }
            }
            catch {}

            ApplyStatusToUI(false, -1, "", "");
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
                string tip = "CEISA Inspector: AKTIF (Port 8080)";
                if (pid > 0) tip = "CEISA Inspector: AKTIF (PID: " + pid + ")";
                trayIcon.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;

                itemStatus.Text = "● Status: AKTIF (PID: " + (pid > 0 ? pid.ToString() : "OK") + ")";
                itemStatus.ForeColor = Color.DarkGreen;

                itemStartServer.Enabled = false;
                itemStopServer.Enabled = true;
                itemRestartServer.Enabled = true;
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

        #region 6. Server Control Actions (Start / Stop / Restart)
        private void StartServer(bool notifyUser)
        {
            if (isServerOnline)
            {
                if (notifyUser)
                    trayIcon.ShowBalloonTip(2000, "CEISA Inspector", "Server sudah aktif di port 8080.", ToolTipIcon.Info);
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
                    AppendLog("CEISA Server dinyalakan via Tray (PID: " + proc.Id + ")");
                    if (notifyUser)
                        trayIcon.ShowBalloonTip(2500, "CEISA Inspector", "Server berhasil dinyalakan (Port 8080).", ToolTipIcon.Info);
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

        #region 7. UI Handlers (Browser, Clipboard, Folder, Log)
        private void OpenDashboard()
        {
            try
            {
                if (!isServerOnline)
                {
                    StartServer(false);
                    Thread.Sleep(800);
                }
                Process.Start("http://localhost:8080/dashboard.html");
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
                if (!string.IsNullOrEmpty(currentWifiUrl))
                {
                    Clipboard.SetText(currentWifiUrl);
                    trayIcon.ShowBalloonTip(3000, "Link Wi-Fi Disalin!", currentWifiUrl + "\n\nTempel link ini di browser HP yang terhubung ke Wi-Fi.", ToolTipIcon.Info);
                }
            }
            catch {}
        }

        private void ShowStatusDetails()
        {
            string msg = "";
            if (isServerOnline)
            {
                msg = "Status: AKTIF (Berjalan)\n" +
                      "Port: 8080\n" +
                      "PID Proses: " + (currentServerPid > 0 ? currentServerPid.ToString() : "-") + "\n" +
                      "Durasi Uptime: " + currentUptime + "\n\n" +
                      "URL PC: http://localhost:8080/dashboard.html\n" +
                      "URL Wi-Fi HP: " + currentWifiUrl;
                trayIcon.ShowBalloonTip(5000, "Status CEISA Inspector", msg, ToolTipIcon.Info);
            }
            else
            {
                msg = "Status: TIDAK AKTIF (Mati)\n\nKlik 'Mulai Server' pada menu tray untuk menyalakan.";
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

        #region 8. Windows Autostart & Registry Integration
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

        #region 9. Logging & Lifecycle Management
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
