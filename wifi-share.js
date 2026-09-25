/**
 * CEISA 4.0 - WiFi Share & Server Control Engine
 * Toggle server ON/OFF langsung dari sidebar & popup.
 * Deteksi IP via WebRTC + Server API.
 * Auto-start server via Extension Native Launcher.
 * Salin URL lintas konteks (Secure & Non-Secure).
 */

(function () {
    'use strict';

    const PORT   = 5005;
    const EXT_ID = 'geogeopfnkjopjgpfdnfnikfpecdodhe';

    function getServerBase() {
        if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
            return `${window.location.protocol}//${window.location.hostname}:${PORT}`;
        }
        return `http://localhost:${PORT}`;
    }
    const SERVER_BASE = getServerBase();

    const PAGES = [
        { path: '/pib.html',       label: 'Modul PIB (Impor)' },
        { path: '/peb.html',       label: 'Modul PEB (Ekspor)' },
        { path: '/hscode.html',    label: 'HS Code Checker' },
        { path: '/dashboard.html', label: 'CEISA Inspector' },
    ];

    // ─── Current module detection ─────────────────────────────────────────────
    function getCurrentModulePath() {
        try {
            const file = window.location.pathname.split('/').pop();
            if (file && file.endsWith('.html') && file !== 'index.html') {
                return '/' + file;
            }
        } catch (_) {}
        return '/pib.html';
    }

    // ─── QR Code helper ──────────────────────────────────────────────────────
    function qrUrl(text) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&format=svg&data=${encodeURIComponent(text)}`;
    }

    // ─── Bulletproof Copy to Clipboard (Secure & Non-Secure HTTP) ─────────────
    window._wfsCopy = function copyText(text, btn) {
        function showSuccess() {
            if (!btn) return;
            const orig = btn.textContent;
            btn.textContent = 'Tersalin!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = orig;
                btn.classList.remove('copied');
            }, 2000);
        }

        // 1. Try modern navigator.clipboard if available
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text)
                .then(showSuccess)
                .catch(() => fallbackCopy(text, showSuccess));
        } else {
            // 2. Fallback to execCommand for non-secure HTTP (e.g. WiFi IP 192.168.x.x)
            fallbackCopy(text, showSuccess);
        }
    };

    function fallbackCopy(text, onSuccess) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.left = '0';
            ta.style.width = '2em';
            ta.style.height = '2em';
            ta.style.padding = '0';
            ta.style.border = 'none';
            ta.style.outline = 'none';
            ta.style.boxShadow = 'none';
            ta.style.background = 'transparent';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, text.length);
            const successful = document.execCommand('copy');
            document.body.removeChild(ta);
            if (successful) {
                if (onSuccess) onSuccess();
            } else {
                throw new Error('execCommand copy returned false');
            }
        } catch (err) {
            // 3. Ultimate fallback: prompt dialog
            window.prompt('Salin tautan ini (Ctrl+C, lalu tekan Enter):', text);
            if (onSuccess) onSuccess();
        }
    }

    // ─── Request extension to start server via Native Messaging ──────────────
    function requestStartServer() {
        return new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                return resolve({ ok: false, error: 'Extension runtime tidak tersedia' });
            }

            try {
                // Konteks halaman ekstensi
                chrome.runtime.sendMessage({ type: 'START_BACKEND_SERVER' }, (res) => {
                    if (chrome.runtime.lastError || !res || !res.ok) {
                        // Konteks web page via externally_connectable
                        try {
                            chrome.runtime.sendMessage(EXT_ID, { type: 'START_BACKEND_SERVER' }, (extRes) => {
                                if (chrome.runtime.lastError || !extRes || !extRes.ok) {
                                    resolve({ ok: false, error: (extRes && extRes.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) });
                                } else {
                                    resolve({ ok: true, data: extRes });
                                }
                            });
                        } catch (e) {
                            resolve({ ok: false, error: e.message });
                        }
                    } else {
                        resolve({ ok: true, data: res });
                    }
                });
            } catch (err) {
                resolve({ ok: false, error: err.message });
            }
        });
    }

    // ─── Check server status ─────────────────────────────────────────────────
    function checkServer() {
        return fetch(`${SERVER_BASE}/api/status`, { signal: AbortSignal.timeout(1500) })
            .then(r => r.json())
            .then(d => ({ online: true, ...d }))
            .catch(() => ({ online: false }));
    }

    // ─── Detect local IPs via WebRTC ─────────────────────────────────────────
    function getLocalIPs() {
        return new Promise(resolve => {
            const ips = new Set();
            let pc;
            try {
                pc = new RTCPeerConnection({ iceServers: [] });
                pc.createDataChannel('');
                pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve([]));
                const done = () => { try { pc.close(); } catch (e) {} resolve([...ips]); };
                const t = setTimeout(done, 2500);
                pc.onicecandidate = e => {
                    if (!e.candidate) { clearTimeout(t); done(); return; }
                    const ip = (e.candidate.candidate || '').split(' ')[4] || '';
                    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) ips.add(ip);
                };
            } catch (err) { resolve([]); }
        });
    }

    // ─── CSS Injection ────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('wfs-styles')) return;
        const s = document.createElement('style');
        s.id = 'wfs-styles';
        s.textContent = `
/* ── WiFi Share Popup ─────────────────────────────────── */
.wfs-backdrop {
    position:fixed;inset:0;z-index:9998;
    background:rgba(7,21,39,.55);
    backdrop-filter:blur(4px);
    animation:wfsFadeIn .18s ease;
}
.wfs-popup {
    position:fixed;z-index:9999;top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:min(440px,calc(100vw - 32px));
    max-height:min(92vh,720px);overflow-y:auto;
    animation:wfsSlideUp .22s cubic-bezier(.16,1,.3,1);
    border-radius:14px;
    box-shadow:0 24px 56px -8px rgba(7,21,39,.45),0 0 0 1px rgba(255,255,255,.06);
}
.wfs-popup-inner {
    background:var(--surface-card,#fff);
    border-radius:14px;
    border:1px solid var(--border-color,#e2e8f0);
    overflow:hidden;
    transition:all .2s ease;
}
@keyframes wfsFadeIn{from{opacity:0}to{opacity:1}}
@keyframes wfsSlideUp{
    from{opacity:0;transform:translate(-50%,calc(-50% + 16px)) scale(.97)}
    to{opacity:1;transform:translate(-50%,-50%) scale(1)}
}
@keyframes wfsSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

/* Header */
.wfs-hdr {
    display:flex;align-items:center;justify-content:space-between;
    padding:13px 18px;
    background:var(--surface-subtle,#f1f5f9);
    border-bottom:1px solid var(--border-color,#e2e8f0);
}
.wfs-hdr-left{display:flex;align-items:center;gap:8px;color:var(--text-primary,#0f172a);}
.wfs-hdr-title{font-size:13.5px;font-weight:700;}
.wfs-close{
    background:none;border:none;font-size:20px;line-height:1;
    cursor:pointer;color:var(--text-muted,#64748b);padding:2px 6px;
    border-radius:6px;transition:all .15s;
}
.wfs-close:hover{background:var(--surface-hover);color:#dc2626;}

/* Server toggle row */
.wfs-server-row {
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 18px;
    border-bottom:1px solid var(--border-color,#e2e8f0);
    gap:12px;
}
.wfs-server-info{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.wfs-server-label{font-size:12px;font-weight:700;color:var(--text-primary,#0f172a);}
.wfs-server-sub{font-size:11px;color:var(--text-muted,#64748b);}

/* Toggle switch */
.wfs-toggle-wrap{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.wfs-toggle-state{font-size:11px;font-weight:700;}
.wfs-toggle-state.on{color:#059669;}
.wfs-toggle-state.off{color:#94a3b8;}
.wfs-toggle-state.loading{color:#d97706;}
.wfs-toggle{
    position:relative;width:44px;height:24px;
    background:#e2e8f0;border-radius:12px;
    border:none;cursor:pointer;padding:0;
    transition:background .25s ease;flex-shrink:0;
}
.wfs-toggle.on{background:#059669;}
.wfs-toggle.loading{background:#f59e0b;cursor:wait;}
.wfs-toggle-knob{
    position:absolute;top:3px;left:3px;
    width:18px;height:18px;border-radius:50%;
    background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);
    transition:transform .25s cubic-bezier(.16,1,.3,1);
}
.wfs-toggle.on .wfs-toggle-knob{transform:translateX(20px);}
.wfs-toggle.loading .wfs-toggle-knob{
    border:2px solid #f59e0b;
    border-top-color:transparent;
    animation:wfsSpin .7s linear infinite;
    background:#fff;
}

/* Status badges */
.wfs-status{
    display:flex;align-items:center;gap:7px;
    padding:7px 18px;
    font-size:11.5px;font-weight:600;
    border-bottom:1px solid var(--border-color,#e2e8f0);
    transition:background .25s ease, color .25s ease;
}
.wfs-status.online{background:rgba(5,150,105,.07);color:#047857;}
.wfs-status.offline{background:rgba(100,116,139,.07);color:#64748b;}
.wfs-status.warn{background:rgba(245,158,11,.07);color:#92400e;}
.wfs-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.wfs-dot.green{background:#10b981;box-shadow:0 0 0 2px rgba(16,185,129,.25);animation:wfsDotPulse 1.5s ease infinite;}
.wfs-dot.gray{background:#94a3b8;}
.wfs-dot.amber{background:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.25);animation:wfsDotPulse 1.2s ease infinite;}
@keyframes wfsDotPulse{0%,100%{opacity:1}50%{opacity:.4}}

/* Warning banner */
.wfs-warn-banner{
    display:flex;align-items:flex-start;gap:8px;
    margin:12px 18px 0;padding:10px 12px;
    background:rgba(245,158,11,.08);
    border:1px solid rgba(245,158,11,.28);
    border-radius:8px;font-size:12px;
    color:var(--text-secondary,#334155);line-height:1.5;
}
.wfs-warn-banner svg{flex-shrink:0;margin-top:1px;color:#f59e0b;}
.wfs-warn-banner strong{color:#b45309;}

/* Info banner */
.wfs-info-banner{
    display:flex;align-items:flex-start;gap:8px;
    margin:12px 18px 0;padding:10px 12px;
    background:rgba(37,99,235,.07);
    border:1px solid rgba(37,99,235,.18);
    border-radius:8px;font-size:12px;
    color:var(--text-secondary,#334155);line-height:1.5;
}
.wfs-info-banner svg{flex-shrink:0;margin-top:1px;color:var(--ceisa-blue,#2563eb);}

/* Section title */
.wfs-sec{
    font-size:10.5px;font-weight:700;letter-spacing:.6px;
    text-transform:uppercase;color:var(--text-muted,#64748b);
    padding:14px 18px 6px;
}

/* IP Cards */
.wfs-ip-list{padding:0 14px 4px;display:flex;flex-direction:column;gap:7px;}
.wfs-ip-card{
    display:flex;align-items:center;justify-content:space-between;
    gap:12px;padding:11px 14px;
    border:1px solid var(--border-color,#e2e8f0);
    border-radius:10px;background:var(--surface-subtle,#f8fafc);
}
.wfs-ip-card.primary{border-color:var(--ceisa-blue,#2563eb);background:rgba(37,99,235,.05);}
.wfs-ip-info{flex:1;min-width:0;}
.wfs-ip-adapter{font-size:10.5px;color:var(--text-muted,#64748b);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;}
.wfs-ip-addr{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:800;color:var(--ceisa-blue,#2563eb);letter-spacing:-.3px;}
.wfs-ip-port{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted,#64748b);margin-top:2px;}
.wfs-copy-btn{
    padding:6px 13px;font-size:11.5px;font-weight:700;
    border:1px solid var(--ceisa-blue,#2563eb);
    background:var(--ceisa-blue-light,#eff6ff);
    color:var(--ceisa-blue-dark,#1d4ed8);
    border-radius:7px;cursor:pointer;
    transition:all .15s;white-space:nowrap;flex-shrink:0;
}
.wfs-copy-btn:hover{background:var(--ceisa-blue,#2563eb);color:#fff;}
.wfs-copy-btn.copied{background:#10b981;border-color:#10b981;color:#fff;}

/* No IP */
.wfs-no-ip{padding:22px 18px;text-align:center;color:var(--text-muted,#64748b);font-size:13px;}
.wfs-no-ip svg{margin:0 auto 10px;display:block;}
.wfs-no-ip-sub{font-size:11.5px;margin-top:4px;}

/* Page links */
.wfs-pages{display:flex;flex-direction:column;gap:4px;padding:0 14px 4px;}
.wfs-page-row{
    display:flex;align-items:center;justify-content:space-between;
    gap:8px;padding:4px 6px 4px 10px;border-radius:8px;
    background:var(--surface-subtle,#f1f5f9);
    border:1px solid var(--border-color,#e2e8f0);
}
.wfs-page-link{
    display:flex;align-items:center;gap:8px;flex:1;
    font-size:12.5px;font-weight:600;
    color:var(--text-primary,#0f172a);text-decoration:none;
    transition:color .15s;
}
.wfs-page-link:hover{color:var(--ceisa-blue,#2563eb);}
.wfs-page-copy-btn{
    padding:4px 8px;font-size:10.5px;font-weight:700;
    border:1px solid var(--border-color,#cbd5e1);
    background:#fff;color:var(--text-secondary,#334155);
    border-radius:5px;cursor:pointer;transition:all .15s;
}
.wfs-page-copy-btn:hover{background:var(--surface-hover);border-color:var(--ceisa-blue,#2563eb);color:var(--ceisa-blue,#2563eb);}
.wfs-page-copy-btn.copied{background:#10b981;border-color:#10b981;color:#fff;}

/* QR */
.wfs-qr{margin:8px 18px 0;padding:14px;border:1px solid var(--border-color,#e2e8f0);border-radius:10px;background:var(--surface-subtle,#f8fafc);text-align:center;}
.wfs-qr-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted,#64748b);margin-bottom:10px;}
.wfs-qr img{width:128px;height:128px;border-radius:8px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.12);}
.wfs-qr-url{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted,#64748b);margin-top:8px;word-break:break-all;}

/* Footer note */
.wfs-footer{margin:12px 18px 16px;padding:10px 12px;background:rgba(5,150,105,.06);border:1px solid rgba(5,150,105,.2);border-radius:8px;font-size:11.5px;color:#047857;text-align:center;font-weight:500;}

/* Shutdown confirm */
.wfs-shutdown-confirm{
    margin:12px 18px 0;padding:12px 14px;
    background:rgba(220,38,38,.06);
    border:1px solid rgba(220,38,38,.22);
    border-radius:10px;
    display:flex;align-items:center;gap:10px;justify-content:space-between;
    animation:wfsFadeIn .18s ease;
}
.wfs-shutdown-msg{font-size:12px;color:var(--text-secondary,#334155);flex:1;}
.wfs-btn-shutdown{
    padding:7px 14px;font-size:12px;font-weight:700;
    background:#dc2626;color:#fff;border:none;border-radius:7px;
    cursor:pointer;transition:background .15s;white-space:nowrap;flex-shrink:0;
}
.wfs-btn-shutdown:hover{background:#b91c1c;}
.wfs-btn-cancel{
    padding:7px 12px;font-size:12px;font-weight:600;
    background:var(--surface-subtle,#f1f5f9);
    color:var(--text-secondary,#334155);
    border:1px solid var(--border-color,#e2e8f0);border-radius:7px;
    cursor:pointer;transition:all .15s;flex-shrink:0;
}
.wfs-btn-cancel:hover{background:var(--surface-hover);}

/* ── Sidebar WiFi Button ─────────────────────────────────── */
.ceisa-wifi-share-btn {
    width:40px;height:40px;
    display:flex;align-items:center;justify-content:center;
    border-radius:var(--radius-md,10px);
    border:1px solid var(--border-color,#e2e8f0);
    background:var(--surface-subtle,#f1f5f9);
    color:var(--text-secondary,#334155);
    cursor:pointer;position:relative;
    transition:all .2s cubic-bezier(.16,1,.3,1);
    padding:0;flex-shrink:0;user-select:none;
}
.ceisa-wifi-share-btn:hover{
    background:rgba(5,150,105,.1);
    color:#059669;
    border-color:rgba(5,150,105,.35);
    transform:translateY(-1px);
}
.ceisa-wifi-share-btn.is-active{
    background:rgba(5,150,105,.1);color:#059669;border-color:rgba(5,150,105,.35);
}
.ceisa-wifi-share-btn.server-on{
    color:#059669;border-color:rgba(5,150,105,.4);background:rgba(5,150,105,.08);
}
.ceisa-sidebar:hover .ceisa-wifi-share-btn,
.ceisa-sidebar.expanded .ceisa-wifi-share-btn{
    width:100%;height:40px;justify-content:flex-start;padding:0 12px;gap:10px;
}

/* Dark mode */
[data-theme="dark"] .wfs-popup-inner{background:#0e1626;border-color:#1e293b;}
[data-theme="dark"] .wfs-hdr{background:#0b1220;border-bottom-color:#1e293b;}
[data-theme="dark"] .wfs-ip-card{background:#0b1220;border-color:#1e293b;}
[data-theme="dark"] .wfs-ip-card.primary{background:rgba(59,130,246,.12);border-color:#3b82f6;}
[data-theme="dark"] .wfs-page-row{background:#0b1220;border-color:#1e293b;}
[data-theme="dark"] .wfs-page-copy-btn{background:#1e293b;border-color:#334155;color:#94a3b8;}
[data-theme="dark"] .wfs-page-copy-btn:hover{background:#334155;color:#fff;}
[data-theme="dark"] .wfs-qr{background:#0b1220;border-color:#1e293b;}
[data-theme="dark"] .wfs-copy-btn{background:rgba(59,130,246,.15);border-color:#3b82f6;color:#93c5fd;}
[data-theme="dark"] .wfs-copy-btn:hover{background:#3b82f6;color:#fff;}
[data-theme="dark"] .wfs-status.online{background:rgba(16,185,129,.12);}
[data-theme="dark"] .wfs-status.offline{background:rgba(100,116,139,.1);}
[data-theme="dark"] .wfs-info-banner{background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.25);}
[data-theme="dark"] .wfs-warn-banner{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3);}
[data-theme="dark"] .wfs-warn-banner strong{color:#fbbf24;}
[data-theme="dark"] .wfs-footer{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.25);color:#34d399;}
[data-theme="dark"] .wfs-server-row{border-bottom-color:#1e293b;}
[data-theme="dark"] .wfs-toggle{background:#1e293b;}
[data-theme="dark"] .wfs-toggle.on{background:#059669;}
[data-theme="dark"] .wfs-shutdown-confirm{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.3);}
[data-theme="dark"] .ceisa-wifi-share-btn{background:var(--surface-subtle,#141f35);border-color:var(--border-color,#1e293b);color:var(--text-secondary,#cbd5e1);}
[data-theme="dark"] .ceisa-wifi-share-btn:hover,
[data-theme="dark"] .ceisa-wifi-share-btn.is-active,
[data-theme="dark"] .ceisa-wifi-share-btn.server-on{background:rgba(16,185,129,.14);color:#34d399;border-color:rgba(16,185,129,.35);}
        `;
        document.head.appendChild(s);
    }

    // ─── State ────────────────────────────────────────────────────────────────
    let popupOpen        = false;
    let serverOnline     = false;
    let isBooting        = false;
    let detectedIPs      = [];
    let escListener      = null;
    let popupPollTimer   = null;
    let bgHeartbeatTimer = null;
    let isPolling        = false;

    // ─── Build Popup Inner HTML ───────────────────────────────────────────────
    function buildPopupInnerHtml(serverStatus, localIPs) {
        const isOnline     = serverStatus.online === true;
        const hasIPs       = localIPs.length > 0;
        const primary      = hasIPs ? localIPs[0] : null;
        const currentMod   = getCurrentModulePath();
        const primaryBase  = primary ? primary.url : null;
        const primaryFull  = primary ? `${primary.url}${currentMod}` : null;

        // Status bar
        let statusClass, dotClass, statusText;
        if (isBooting) {
            statusClass = 'warn'; dotClass = 'amber';
            statusText  = `Sedang menyalakan server di latar belakang...`;
        } else if (isOnline && hasIPs) {
            statusClass = 'online'; dotClass = 'green';
            statusText  = `Server Aktif &bull; Port ${PORT} &bull; Jaringan Terdeteksi`;
        } else if (isOnline && !hasIPs) {
            statusClass = 'warn'; dotClass = 'amber';
            statusText  = `Server Aktif &bull; Mencari IP Jaringan...`;
        } else if (!isOnline && hasIPs) {
            statusClass = 'warn'; dotClass = 'amber';
            statusText  = `Server Belum Aktif &bull; Tekan tombol switch untuk menyalakan`;
        } else {
            statusClass = 'offline'; dotClass = 'gray';
            statusText  = `Server Belum Aktif`;
        }

        // IP cards
        const ipCards = hasIPs ? localIPs.map((ip, i) => {
            const targetUrl = `${ip.url}${currentMod}`;
            return `
            <div class="wfs-ip-card ${i === 0 ? 'primary' : ''}">
                <div class="wfs-ip-info">
                    <div class="wfs-ip-adapter">${ip.name}</div>
                    <div class="wfs-ip-addr">${ip.address}</div>
                    <div class="wfs-ip-port">Port ${PORT} &bull; ${currentMod.replace('/', '')}</div>
                </div>
                <button class="wfs-copy-btn" onclick="(function(b){window._wfsCopy('${targetUrl}',b)})(this)">Salin URL</button>
            </div>
            `;
        }).join('') : `
            <div class="wfs-no-ip">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M1 6s4-4 11-4 11 4"/><path d="M5 10s2.5-2.5 7-2.5 7 2.5"/>
                    <path d="M9 14s1-1 3-1 3 1"/><circle cx="12" cy="18" r="1"/>
                    <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444"/>
                </svg>
                <p>Tidak ada jaringan lokal yang terdeteksi.</p>
                <p class="wfs-no-ip-sub">Pastikan WiFi atau Ethernet terhubung, lalu coba lagi.</p>
            </div>
        `;

        // Page links (only show if server online)
        const pageLinks = (isOnline && primaryBase) ? PAGES.map(p => {
            const fullUrl = `${primaryBase}${p.path}`;
            return `
            <div class="wfs-page-row">
                <a class="wfs-page-link" href="${fullUrl}" target="_blank" rel="noopener">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    <span>${p.label}</span>
                </a>
                <button class="wfs-page-copy-btn" onclick="(function(b){window._wfsCopy('${fullUrl}',b)})(this)">Salin</button>
            </div>
            `;
        }).join('') : '';

        // QR code
        const qrSection = (isOnline && primaryFull) ? `
            <div class="wfs-qr">
                <div class="wfs-qr-lbl">Scan QR untuk membuka di HP</div>
                <img src="${qrUrl(primaryFull)}" alt="QR Code" loading="lazy">
                <div class="wfs-qr-url">${primaryFull}</div>
            </div>
        ` : '';

        // Warning if server offline
        const warnBanner = (!isOnline && !isBooting) ? `
            <div class="wfs-warn-banner">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Upload dokumen &amp; akses WiFi memerlukan server aktif. Tekan switch toggle di atas untuk menyalakan otomatis.
            </div>
        ` : '';

        const infoBanner = `
            <div class="wfs-info-banner">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Pastikan perangkat lain terhubung ke WiFi yang sama. Buka URL atau scan QR di browser HP/laptop rekan kerja.
            </div>
        `;

        let toggleClass = '';
        let toggleLabel = '';
        if (isBooting) {
            toggleClass = 'loading';
            toggleLabel = '<span class="wfs-toggle-state loading">MEMULAI...</span>';
        } else if (isOnline) {
            toggleClass = 'on';
            toggleLabel = '<span class="wfs-toggle-state on">AKTIF</span>';
        } else {
            toggleClass = '';
            toggleLabel = '<span class="wfs-toggle-state off">MATI</span>';
        }

        return `
            <!-- Header -->
            <div class="wfs-hdr">
                <div class="wfs-hdr-left">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 6s4-4 11-4 11 4"/>
                        <path d="M5 10s2.5-2.5 7-2.5 7 2.5"/>
                        <path d="M9 14s1-1 3-1 3 1"/>
                        <circle cx="12" cy="18" r="1"/>
                    </svg>
                    <span class="wfs-hdr-title">WiFi Share &amp; Server Control</span>
                </div>
                <button class="wfs-close" id="wfsCloseBtn" aria-label="Tutup">&times;</button>
            </div>

            <!-- Server Toggle Row -->
            <div class="wfs-server-row">
                <div class="wfs-server-info">
                    <div class="wfs-server-label">Server Backend (Port ${PORT})</div>
                    <div class="wfs-server-sub">Diperlukan untuk upload dokumen &amp; akses jaringan WiFi</div>
                </div>
                <div class="wfs-toggle-wrap">
                    ${toggleLabel}
                    <button class="wfs-toggle ${toggleClass}" id="wfsServerToggle" title="${isOnline ? 'Klik untuk matikan server' : 'Klik untuk menyalakan server'}">
                        <span class="wfs-toggle-knob"></span>
                    </button>
                </div>
            </div>

            <!-- Status bar -->
            <div class="wfs-status ${statusClass}">
                <span class="wfs-dot ${dotClass}"></span>
                <span>${statusText}</span>
            </div>

            ${warnBanner}
            ${infoBanner}

            <!-- IP Addresses -->
            <div class="wfs-sec">Alamat Jaringan Lokal</div>
            <div class="wfs-ip-list">${ipCards}</div>

            ${(isOnline && hasIPs) ? `
            <!-- Direct page links -->
            <div class="wfs-sec">Akses Langsung Modul</div>
            <div class="wfs-pages">${pageLinks}</div>
            ${qrSection}
            ` : ''}

            <div class="wfs-footer">
                ${isOnline
                    ? 'Server aktif. Semua perangkat di WiFi yang sama dapat mengakses modul dan upload dokumen.'
                    : 'Nyalakan server untuk mengizinkan upload dokumen dan akses dari perangkat lain.'}
            </div>
        `;
    }

    // ─── Attach Events to Inner Popup Elements ────────────────────────────────
    function attachInnerEvents(container) {
        if (!container) return;
        const closeBtn = container.querySelector('#wfsCloseBtn');
        if (closeBtn) closeBtn.onclick = closePopup;

        const toggle = container.querySelector('#wfsServerToggle');
        if (toggle) {
            toggle.onclick = () => {
                if (isBooting) return;
                if (serverOnline) {
                    showShutdownConfirm(container);
                } else {
                    handleToggleOn(container);
                }
            };
        }
    }

    // ─── Handle Toggle ON (Start Server Automatically) ────────────────────────
    async function handleToggleOn(container) {
        isBooting = true;
        const toggle = container.querySelector('#wfsServerToggle');
        if (toggle) {
            toggle.className = 'wfs-toggle loading';
        }

        const stateLabel = container.querySelector('.wfs-toggle-state');
        if (stateLabel) {
            stateLabel.className = 'wfs-toggle-state loading';
            stateLabel.textContent = 'MEMULAI...';
        }

        const statusElem = container.querySelector('.wfs-status');
        if (statusElem) {
            statusElem.className = 'wfs-status warn';
            statusElem.innerHTML = `
                <span class="wfs-dot amber"></span>
                <span>Sedang menyalakan server di latar belakang...</span>
            `;
        }

        // 1. Kirim pesan ke Extension Native Messaging host
        try {
            await requestStartServer();
        } catch (_) {}

        // 2. Polling cepat port 5005 sampai aktif (maksimal 12 detik)
        let attempts = 0;
        const maxAttempts = 24;
        const pollBoot = setInterval(async () => {
            attempts++;
            const s = await checkServer();
            if (s.online) {
                clearInterval(pollBoot);
                isBooting = false;
                let ips = detectedIPs;
                try {
                    const netData = await fetch(`${SERVER_BASE}/api/network-info`, { signal: AbortSignal.timeout(1500) }).then(r => r.json());
                    if (netData && netData.localIPs && netData.localIPs.length > 0) {
                        ips = netData.localIPs;
                    }
                } catch (_) {}
                updatePopupInPlace(s, ips);
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollBoot);
                isBooting = false;
                showStartInstructions(container);
                const currentStatus = await checkServer();
                updatePopupInPlace(currentStatus, detectedIPs);
            }
        }, 500);
    }

    // ─── Update Popup In-Place (Smooth, no flicker) ───────────────────────────
    function updatePopupInPlace(serverStatus, localIPs) {
        serverOnline = serverStatus.online === true;
        detectedIPs  = localIPs;

        const inner = document.querySelector('#wfsPopup .wfs-popup-inner');
        if (!inner) return;

        const popupElem = document.getElementById('wfsPopup');
        const scrollY = popupElem ? popupElem.scrollTop : 0;

        inner.innerHTML = buildPopupInnerHtml(serverStatus, localIPs);
        attachInnerEvents(document.getElementById('wfsContainer'));

        if (popupElem) popupElem.scrollTop = scrollY;

        document.querySelectorAll('.ceisa-wifi-share-btn').forEach(b => {
            b.classList.toggle('server-on', serverOnline);
        });
    }

    // ─── Close popup ──────────────────────────────────────────────────────────
    function closePopup() {
        stopPopupPolling();
        if (escListener) {
            document.removeEventListener('keydown', escListener);
            escListener = null;
        }
        const existing = document.getElementById('wfsContainer');
        if (existing) existing.remove();
        popupOpen = false;
        document.querySelectorAll('.ceisa-wifi-share-btn').forEach(b => b.classList.remove('is-active'));
    }

    // ─── Live Polling While Popup is Open ─────────────────────────────────────
    function startPopupPolling() {
        stopPopupPolling();
        popupPollTimer = setInterval(async () => {
            if (!popupOpen || isPolling || isBooting) return;
            isPolling = true;
            try {
                const newStatus = await checkServer();
                const isOnline  = newStatus.online === true;
                if (isOnline !== serverOnline) {
                    let updatedIPs = detectedIPs;
                    if (isOnline) {
                        try {
                            const netData = await fetch(`${SERVER_BASE}/api/network-info`, { signal: AbortSignal.timeout(1500) }).then(r => r.json());
                            if (netData && netData.localIPs && netData.localIPs.length > 0) {
                                updatedIPs = netData.localIPs;
                            }
                        } catch (_) {}
                    }
                    updatePopupInPlace(newStatus, updatedIPs);
                }
            } catch (_) {
            } finally {
                isPolling = false;
            }
        }, 1200);
    }

    function stopPopupPolling() {
        if (popupPollTimer) {
            clearInterval(popupPollTimer);
            popupPollTimer = null;
        }
    }

    // ─── Background Heartbeat (When Popup is Closed) ──────────────────────────
    function startBgHeartbeat() {
        if (bgHeartbeatTimer) return;
        bgHeartbeatTimer = setInterval(async () => {
            if (popupOpen) return;
            try {
                const s = await checkServer();
                serverOnline = s.online === true;
                document.querySelectorAll('.ceisa-wifi-share-btn').forEach(b => {
                    b.classList.toggle('server-on', serverOnline);
                });
            } catch (_) {}
        }, 4000);
    }

    // ─── Render popup ─────────────────────────────────────────────────────────
    function renderPopup(serverStatus, localIPs) {
        serverOnline = serverStatus.online === true;
        detectedIPs  = localIPs;

        const existing = document.getElementById('wfsContainer');
        if (existing) existing.remove();

        const html = `
            <div class="wfs-popup" id="wfsPopup" role="dialog" aria-modal="true">
                <div class="wfs-popup-inner">
                    ${buildPopupInnerHtml(serverStatus, localIPs)}
                </div>
            </div>
            <div class="wfs-backdrop" id="wfsBackdrop"></div>
        `;

        const container = document.createElement('div');
        container.id = 'wfsContainer';
        container.innerHTML = html;
        document.body.appendChild(container);

        attachInnerEvents(container);

        const backdrop = document.getElementById('wfsBackdrop');
        if (backdrop) backdrop.onclick = closePopup;

        if (escListener) document.removeEventListener('keydown', escListener);
        escListener = function (e) {
            if (e.key === 'Escape') closePopup();
        };
        document.addEventListener('keydown', escListener);

        startPopupPolling();
    }

    // ─── Show shutdown confirm ─────────────────────────────────────────────────
    function showShutdownConfirm(container) {
        const old = container.querySelector('.wfs-shutdown-confirm');
        if (old) { old.remove(); return; }

        const div = document.createElement('div');
        div.className = 'wfs-shutdown-confirm';
        div.innerHTML = `
            <div class="wfs-shutdown-msg">Matikan server? Akses WiFi dan upload dokumen akan dinonaktifkan.</div>
            <button class="wfs-btn-cancel" id="wfsCancelShutdown">Batal</button>
            <button class="wfs-btn-shutdown" id="wfsConfirmShutdown">Matikan</button>
        `;

        const serverRow = container.querySelector('.wfs-server-row');
        if (serverRow) serverRow.insertAdjacentElement('afterend', div);

        div.querySelector('#wfsCancelShutdown').onclick = () => div.remove();
        div.querySelector('#wfsConfirmShutdown').onclick = () => {
            div.remove();
            doShutdown(container);
        };
    }

    // ─── Execute shutdown ──────────────────────────────────────────────────────
    function doShutdown(container) {
        const toggle = container.querySelector('.wfs-toggle');
        if (toggle) { toggle.classList.remove('on'); toggle.classList.add('loading'); }

        fetch(`${SERVER_BASE}/api/shutdown`, { method: 'POST', signal: AbortSignal.timeout(3000) })
            .catch(() => {})
            .finally(() => {
                setTimeout(async () => {
                    const status = await checkServer();
                    updatePopupInPlace(status, detectedIPs);
                }, 700);
            });
    }

    // ─── Show start instructions (Fallback if auto-start unavailable) ──────────
    function showStartInstructions(container) {
        const old = container.querySelector('.wfs-start-guide');
        if (old) { old.remove(); return; }

        const div = document.createElement('div');
        div.className = 'wfs-warn-banner wfs-start-guide';
        div.style.margin = '12px 18px 0';
        div.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px;color:#f59e0b">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div style="flex:1">
                <div style="font-weight:700;margin-bottom:3px;color:var(--text-primary,#0f172a)">Server Belum Menyala</div>
                <div style="font-size:11.5px;line-height:1.4">
                    Jalankan file <strong>START_SERVER.bat</strong> di folder <code style="font-family:monospace;font-size:11px;background:rgba(0,0,0,.07);padding:1px 4px;border-radius:3px">C:\\Synthetic</code>.<br/>
                    <span style="color:#059669;font-weight:600">&bull; Jendela ini akan otomatis terupdate saat server aktif.</span>
                </div>
            </div>
        `;

        const serverRow = container.querySelector('.wfs-server-row');
        if (serverRow) serverRow.insertAdjacentElement('afterend', div);
    }

    // ─── Open popup ───────────────────────────────────────────────────────────
    async function openPopup() {
        if (popupOpen) return;
        popupOpen = true;

        // Show loading overlay
        const overlay = document.createElement('div');
        overlay.id = 'wfsOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;pointer-events:none;';
        overlay.innerHTML = `
            <div style="background:var(--surface-card,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;padding:16px 24px;font-size:12.5px;color:var(--text-secondary,#334155);display:flex;align-items:center;gap:10px;box-shadow:0 12px 32px rgba(0,0,0,.18)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:wfsSpin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Mendeteksi jaringan...
            </div>
        `;
        document.body.appendChild(overlay);

        // Parallel: check server + detect IPs
        const [serverStatus, webrtcIPs] = await Promise.all([
            checkServer(),
            getLocalIPs()
        ]);

        // Merge IPs: server data (has interface names) + WebRTC
        let localIPs = [];
        if (serverStatus.online) {
            try {
                const netData = await fetch(`${SERVER_BASE}/api/network-info`, { signal: AbortSignal.timeout(1500) }).then(r => r.json());
                const serverIPSet = new Set((netData.localIPs || []).map(x => x.address));
                localIPs = [...(netData.localIPs || [])];
                webrtcIPs.forEach(ip => {
                    if (!serverIPSet.has(ip)) localIPs.push({ name: 'WiFi / LAN', address: ip, url: `http://${ip}:${PORT}` });
                });
            } catch (_) {
                localIPs = webrtcIPs.map(ip => ({ name: 'WiFi / LAN', address: ip, url: `http://${ip}:${PORT}` }));
            }
        } else {
            localIPs = webrtcIPs.map(ip => ({ name: 'WiFi / LAN', address: ip, url: `http://${ip}:${PORT}` }));
        }

        overlay.remove();
        renderPopup(serverStatus, localIPs);
        document.querySelectorAll('.ceisa-wifi-share-btn').forEach(b => {
            b.classList.add('is-active');
            if (serverStatus.online) b.classList.add('server-on');
        });
    }

    // ─── Build Sidebar Button ─────────────────────────────────────────────────
    function buildBtn() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ceisa-wifi-share-btn';
        btn.id = 'ceisaWifiShareBtn';
        btn.title = 'WiFi Share & Server Control';
        btn.setAttribute('aria-label', 'Bagikan via WiFi');
        btn.setAttribute('data-tooltip', 'WiFi Share');
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 6s4-4 11-4 11 4"/>
                <path d="M5 10s2.5-2.5 7-2.5 7 2.5"/>
                <path d="M9 14s1-1 3-1 3 1"/>
                <circle cx="12" cy="18" r="1"/>
            </svg>
            <span class="sidebar-label">Bagikan WiFi</span>
        `;
        btn.addEventListener('click', openPopup);

        // Reflect initial server status immediately
        checkServer().then(s => { if (s.online) btn.classList.add('server-on'); });

        return btn;
    }

    // ─── Initialize ───────────────────────────────────────────────────────────
    function init() {
        injectStyles();
        const footer = document.querySelector('.ceisa-sidebar-footer');
        if (!footer || document.getElementById('ceisaWifiShareBtn')) return;
        const btn = buildBtn();
        const themeToggle = footer.querySelector('.ceisa-theme-toggle');
        themeToggle ? footer.insertBefore(btn, themeToggle) : footer.appendChild(btn);

        // Start background heartbeat
        startBgHeartbeat();
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : init();

})();
