/**
 * CEISA 4.0 - Universal System Update Center (update-center.js)
 * Memungkinkan pemeriksaan dan penerapan update sistem dari tombol Pengaturan & Update di sidebar
 * pada semua halaman portal CEISA (Dashboard, PEB, PIB, HS Code, Doc Searcher, Print Hub).
 */
(function () {
    'use strict';

    function getStorage(keys) {
        if (typeof storageGet === 'function') return storageGet(keys);
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(keys, resolve);
            } else {
                const res = {};
                const arr = Array.isArray(keys) ? keys : [keys];
                arr.forEach(k => {
                    try { res[k] = JSON.parse(localStorage.getItem(k)); } catch (_) { res[k] = localStorage.getItem(k); }
                });
                resolve(res);
            }
        });
    }

    function setStorage(items) {
        if (typeof storageSet === 'function') return storageSet(items);
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set(items, resolve);
            } else {
                Object.keys(items).forEach(k => {
                    try { localStorage.setItem(k, typeof items[k] === 'object' ? JSON.stringify(items[k]) : items[k]); } catch (_) {}
                });
                resolve();
            }
        });
    }

    function notifyToast(msg) {
        if (typeof showToast === 'function') {
            showToast(msg);
            return;
        }
        let toast = document.getElementById('toast');
        if (!toast) {
            const shelf = document.createElement('div');
            shelf.className = 'toast-shelf';
            shelf.id = 'toastShelf';
            shelf.innerHTML = '<div id="toast" class="toast"></div>';
            document.body.appendChild(shelf);
            toast = document.getElementById('toast');
        }
        if (toast) {
            toast.textContent = msg;
            toast.classList.remove('hidden');
            setTimeout(() => { toast.classList.add('hidden'); }, 2500);
        }
    }

    function ensureModalInDom() {
        if (document.getElementById('updateModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'updateModal';
        modalDiv.className = 'ceisa-modal-overlay hidden';
        modalDiv.setAttribute('aria-modal', 'true');
        modalDiv.setAttribute('role', 'dialog');
        modalDiv.innerHTML = `
            <div class="ceisa-modal-card update-modal-card">
                <div class="ceisa-modal-header">
                    <div class="ceisa-modal-title-wrap">
                        <div class="modal-icon-badge">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="ceisa-modal-title">Pusat Pembaruan Sistem CEISA</h2>
                            <p class="ceisa-modal-desc">Kelola pembaruan otomatis untuk seluruh komputer pengguna.</p>
                        </div>
                    </div>
                    <button type="button" id="closeUpdateModalBtn" class="ceisa-modal-close" aria-label="Tutup Modal">&times;</button>
                </div>

                <div class="ceisa-modal-body">
                    <!-- Status Komputer Ini -->
                    <div class="update-status-row">
                        <div class="update-status-card">
                            <span class="status-card-label">Versi Terpasang</span>
                            <div class="status-card-val"><span id="localVersionBadge" class="version-tag">v2.1.2</span></div>
                        </div>
                        <div class="update-status-card">
                            <span class="status-card-label">Commit Lokal</span>
                            <div class="status-card-val"><code id="localCommitText" class="commit-code">Memeriksa...</code></div>
                        </div>
                        <div class="update-status-card">
                            <span class="status-card-label">Status Remote</span>
                            <div class="status-card-val"><span id="remoteSyncBadge" class="status-pill status-synced">Tersinkron</span></div>
                        </div>
                    </div>

                    <!-- Bagian 1: Untuk Komputer Karyawan / Client (Pull & Auto-Update) -->
                    <div class="update-section-box">
                        <div class="section-box-header">
                            <h3 class="section-box-title">Pembaruan Komputer Ini</h3>
                            <label class="auto-update-toggle-label" title="Secara default nonaktif (mati). Aktifkan jika ingin ekstensi memperbarui otomatis tanpa konfirmasi.">
                                <input type="checkbox" id="autoUpdateToggle">
                                <span class="toggle-switch"></span>
                                <span class="toggle-text">Auto-Update Otomatis</span>
                            </label>
                        </div>

                        <div id="updateNoticeBox" class="update-notice-banner hidden">
                            <div class="notice-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <div class="notice-text">
                                <strong>Versi Baru Tersedia di GitHub</strong>
                                <p id="remoteCommitMsg" class="notice-sub">Memuat catatan rilis...</p>
                            </div>
                        </div>

                        <div class="update-action-buttons">
                            <button type="button" id="checkUpdateBtn" class="btn btn-secondary-subtle">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <span>Periksa Pembaruan</span>
                            </button>
                            <button type="button" id="applyUpdateBtn" class="btn btn-primary-action" disabled>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span id="applyUpdateBtnText">Perbarui Sekarang</span>
                            </button>
                        </div>
                        <p id="updateStatusFeedback" class="update-feedback-text"></p>
                    </div>

                    <!-- Bagian 2: Khusus Pengembang / Master PC -->
                    <div class="update-section-box developer-box">
                        <div class="section-box-header">
                            <div class="dev-title-wrap">
                                <span class="dev-badge">DEVELOPER / PC MASTER</span>
                                <h3 class="section-box-title">Rilis Pembaruan ke Semua Komputer</h3>
                            </div>
                        </div>
                        <p class="dev-desc">
                            Tekan tombol di bawah untuk otomatis melakukan <code>git push</code> dan menyiarkan sinyal update ke seluruh komputer rekan/karyawan. Komputer mereka akan otomatis memperbarui ekstensi tanpa perlu didatangi satu per satu.
                        </p>

                        <div class="dev-push-form">
                            <input type="text" id="devCommitMsgInput" class="dev-input" placeholder="Catatan perubahan (opsional, contoh: perbaikan format tanggal)...">
                            <button type="button" id="devPushUpdateBtn" class="btn btn-push-master">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="16 16 12 12 8 16"></polyline>
                                    <line x1="12" y1="12" x2="12" y2="21"></line>
                                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
                                </svg>
                                <span id="devPushBtnText">Push Update ke Semua Komputer</span>
                            </button>
                        </div>
                        <p id="devPushFeedback" class="dev-feedback-text"></p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }

    function initUpdateCenter() {
        ensureModalInDom();

        const modal = document.getElementById("updateModal");
        const openBtn = document.getElementById("openUpdateModalBtn");
        const closeBtn = document.getElementById("closeUpdateModalBtn");

        const localVersionBadge = document.getElementById("localVersionBadge");
        const localCommitText = document.getElementById("localCommitText");
        const updateBtnLabel = document.getElementById("updateBtnLabel");
        const updatePulseDot = document.getElementById("updatePulseDot");

        const autoUpdateToggle = document.getElementById("autoUpdateToggle");
        const updateNoticeBox = document.getElementById("updateNoticeBox");
        const remoteCommitMsg = document.getElementById("remoteCommitMsg");
        const checkUpdateBtn = document.getElementById("checkUpdateBtn");
        const applyUpdateBtn = document.getElementById("applyUpdateBtn");
        const applyUpdateBtnText = document.getElementById("applyUpdateBtnText");
        const updateStatusFeedback = document.getElementById("updateStatusFeedback");

        const devCommitMsgInput = document.getElementById("devCommitMsgInput");
        const devPushUpdateBtn = document.getElementById("devPushUpdateBtn");
        const devPushBtnText = document.getElementById("devPushBtnText");
        const devPushFeedback = document.getElementById("devPushFeedback");

        // 1. Inisialisasi Versi Lokal
        function refreshLocalVersion() {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: "GET_SYSTEM_VERSION" }, (res) => {
                    if (res && res.ok && res.data && res.data.data) {
                        const info = res.data.data;
                        const v = info.version || "2.1.2";
                        const sha = info.commit || "";
                        if (localVersionBadge) localVersionBadge.textContent = "v" + v;
                        if (updateBtnLabel) updateBtnLabel.textContent = "v" + v;
                        if (localCommitText) localCommitText.textContent = sha ? sha.substring(0, 7) : "Local";
                        if (sha) {
                            setStorage({ ceisa_local_commit: sha });
                        }
                    }
                });
            }
        }

        // Jalankan refresh versi awal
        refreshLocalVersion();

        // 2. Ambil preferensi Auto-Update (Default: MATI / False)
        getStorage(["ceisa_auto_update_enabled"]).then(data => {
            if (autoUpdateToggle) {
                autoUpdateToggle.checked = Boolean(data.ceisa_auto_update_enabled === true);
            }
        }).catch(() => {});

        if (autoUpdateToggle) {
            autoUpdateToggle.addEventListener("change", () => {
                setStorage({ ceisa_auto_update_enabled: autoUpdateToggle.checked });
                notifyToast(autoUpdateToggle.checked ? "Auto-Update aktif" : "Auto-Update dinonaktifkan");
            });
        }

        // 3. Kontrol Modal Buka / Tutup
        if (openBtn && modal) {
            openBtn.addEventListener("click", () => {
                modal.classList.remove("hidden");
                refreshLocalVersion();
                checkUpdate(false);
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener("click", () => {
                modal.classList.add("hidden");
            });
        }

        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    modal.classList.add("hidden");
                }
            });
        }

        // 4. Periksa Pembaruan
        function checkUpdate(isManualClick = true) {
            if (isManualClick && updateStatusFeedback) {
                updateStatusFeedback.textContent = "Memeriksa pembaruan di GitHub...";
                updateStatusFeedback.style.color = "var(--text-muted)";
            }

            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: "CHECK_UPDATE" }, (res) => {
                    if (chrome.runtime.lastError || !res || !res.ok) {
                        if (updateStatusFeedback && isManualClick) {
                            updateStatusFeedback.textContent = "Gagal menghubungi server pembaruan.";
                            updateStatusFeedback.style.color = "#dc2626";
                        }
                        return;
                    }

                    const data = res.data || {};
                    if (data.update_available) {
                        if (updatePulseDot) updatePulseDot.classList.add("has-update");
                        if (updateNoticeBox) updateNoticeBox.classList.remove("hidden");
                        if (remoteCommitMsg) {
                            remoteCommitMsg.textContent = data.remote_message
                                ? `Commit: ${data.remote_commit.substring(0, 7)} — "${data.remote_message}"`
                                : `Commit terbaru: ${data.remote_commit.substring(0, 7)}`;
                        }
                        if (applyUpdateBtn) applyUpdateBtn.disabled = false;
                        if (updateStatusFeedback) {
                            updateStatusFeedback.textContent = "Pembaruan tersedia. Klik tombol di atas untuk memasang.";
                            updateStatusFeedback.style.color = "#d97706";
                        }
                    } else {
                        if (updatePulseDot) updatePulseDot.classList.remove("has-update");
                        if (updateNoticeBox) updateNoticeBox.classList.add("hidden");
                        if (applyUpdateBtn) applyUpdateBtn.disabled = true;
                        if (updateStatusFeedback) {
                            updateStatusFeedback.textContent = "Versi yang Anda gunakan adalah yang paling baru.";
                            updateStatusFeedback.style.color = "#059669";
                        }
                    }
                });
            }
        }

        if (checkUpdateBtn) {
            checkUpdateBtn.addEventListener("click", () => checkUpdate(true));
        }

        // 5. Terapkan Pembaruan (Pull & Reload)
        if (applyUpdateBtn) {
            applyUpdateBtn.addEventListener("click", () => {
                if (applyUpdateBtn.disabled) return;
                applyUpdateBtn.disabled = true;
                if (applyUpdateBtnText) applyUpdateBtnText.textContent = "Mengunduh & Memasang...";
                if (updateStatusFeedback) {
                    updateStatusFeedback.textContent = "Sedang mengunduh file terbaru dari GitHub...";
                    updateStatusFeedback.style.color = "var(--text-muted)";
                }

                chrome.runtime.sendMessage({ type: "PERFORM_PULL_UPDATE" }, (res) => {
                    if (chrome.runtime.lastError || !res || !res.ok) {
                        applyUpdateBtn.disabled = false;
                        if (applyUpdateBtnText) applyUpdateBtnText.textContent = "Perbarui Sekarang";
                        if (updateStatusFeedback) {
                            const errMsg = (res && res.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "";
                            if (errMsg.toLowerCase().includes("native messaging") || errMsg.toLowerCase().includes("not found")) {
                                updateStatusFeedback.innerHTML = "💡 <b>Aktifkan Sekali:</b> Klik 2x file <code>AKTIFKAN_UPDATE_DI_CHROME.bat</code> di folder ekstensi agar tombol ini bisa memperbarui otomatis seterusnya tanpa Node.js (atau klik <code>UPDATE.bat</code>).";
                                updateStatusFeedback.style.color = "#d97706";
                            } else {
                                updateStatusFeedback.textContent = "Gagal mengunduh pembaruan. Silakan periksa koneksi internet atau jalankan UPDATE.bat di folder ekstensi.";
                                updateStatusFeedback.style.color = "#dc2626";
                            }
                        }
                        return;
                    }

                    if (updateStatusFeedback) {
                        updateStatusFeedback.textContent = "Pembaruan berhasil dipasang. Memuat ulang ekstensi...";
                        updateStatusFeedback.style.color = "#059669";
                    }
                    notifyToast("Pembaruan berhasil dipasang. Memuat ulang sistem...");
                });
            });
        }

        // 6. Push Update (Khusus Pengembang / Master PC)
        if (devPushUpdateBtn) {
            devPushUpdateBtn.addEventListener("click", () => {
                const commitMsg = devCommitMsgInput ? devCommitMsgInput.value.trim() : "";
                if (!confirm(`Publikasikan pembaruan ini sekarang ke seluruh komputer pengguna?\n\nSemua komputer karyawan akan otomatis memperbarui file mereka.`)) {
                    return;
                }

                devPushUpdateBtn.disabled = true;
                if (devPushBtnText) devPushBtnText.textContent = "Mendorong ke GitHub...";
                if (devPushFeedback) {
                    devPushFeedback.textContent = "Memproses git commit, git push & menyiarkan sinyal...";
                    devPushFeedback.style.color = "var(--text-muted)";
                }

                chrome.runtime.sendMessage({
                    type: "PERFORM_PUSH_UPDATE",
                    commit_message: commitMsg
                }, (res) => {
                    devPushUpdateBtn.disabled = false;
                    if (devPushBtnText) devPushBtnText.textContent = "Push Update ke Semua Komputer";

                    if (chrome.runtime.lastError || !res || !res.ok) {
                        if (devPushFeedback) {
                            devPushFeedback.textContent = (res && res.error) || "Gagal melakukan push update.";
                            devPushFeedback.style.color = "#dc2626";
                        }
                        return;
                    }

                    if (devPushFeedback) {
                        devPushFeedback.textContent = "Berhasil dipublikasikan! Sinyal pembaruan disiarkan ke semua komputer.";
                        devPushFeedback.style.color = "#059669";
                    }
                    if (devCommitMsgInput) devCommitMsgInput.value = "";
                    notifyToast("Pembaruan berhasil dirilis ke GitHub!");
                });
            });
        }

        // 7. Event Listener dari sync.js (saat remote update terdeteksi)
        window.addEventListener("ceisa_update_available", (e) => {
            if (updatePulseDot) updatePulseDot.classList.add("has-update");
            if (updateNoticeBox) updateNoticeBox.classList.remove("hidden");
            if (applyUpdateBtn) applyUpdateBtn.disabled = false;
            if (remoteCommitMsg && e.detail) {
                remoteCommitMsg.textContent = e.detail.message
                    ? `Versi baru dirilis: "${e.detail.message}"`
                    : "Pembaruan sistem baru tersedia di cloud!";
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUpdateCenter);
    } else {
        initUpdateCenter();
    }
})();
