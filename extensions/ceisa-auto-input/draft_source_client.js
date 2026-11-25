// ============================================================
// CEISA DRAFT SOURCE & WEB HOST CLIENT (draft_source_client.js)
// Mengelola konfigurasi sumber draft (lokal/LAN IP) & Web Dashboard Host
// secara terpisah tanpa ketergantungan pada file website di extension.
// ============================================================
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.CeisaDraftSourceClient = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DEFAULT_DRAFT_SOURCE_URL = 'http://localhost:5005';
    const DEFAULT_WEB_HOST_URL = 'http://localhost:5005';
    const STORAGE_KEY_DRAFT_SOURCE = 'ceisa_draft_source_host';
    const STORAGE_KEY_WEB_HOST = 'ceisa_web_host';
    const STORAGE_KEY_SELECTED_DRAFT = 'ceisa_selected_draft_filename';
    const STORAGE_KEY_DRAFT_TYPE = 'ceisa_autoinput_draft_type';
    const STORAGE_KEY_LAST_SECTION = 'ceisa_autoinput_last_section';
    const STORAGE_KEY_HOST_PANEL_OPEN = 'ceisa_autoinput_host_panel_open';

    /**
     * Menormalisasi input IP/host/URL menjadi base URL yang valid tanpa trailing slash.
     * Contoh:
     * - "192.168.100.15" -> "http://192.168.100.15:5005"
     * - "192.168.100.15:5005/" -> "http://192.168.100.15:5005"
     * - "http://192.168.100.15" -> "http://192.168.100.15:5005"
     * - "https://ceisa-web.company.com" -> "https://ceisa-web.company.com"
     */
    function normalizeHostUrl(rawInput, defaultPort = 5005, fallbackUrl = DEFAULT_DRAFT_SOURCE_URL) {
        const raw = String(rawInput || '').trim();
        if (!raw) return fallbackUrl;

        const hasHttps = /^https:\/\//i.test(raw);
        const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;

        try {
            const parsed = new URL(withScheme);
            const hasExplicitPort = Boolean(parsed.port);
            if (!hasExplicitPort && defaultPort && !hasHttps) {
                parsed.port = String(defaultPort);
            }
            const cleanedPath = parsed.pathname && parsed.pathname !== '/'
                ? parsed.pathname.replace(/\/+$/, '')
                : '';
            return `${parsed.protocol}//${parsed.host}${cleanedPath}`;
        } catch (_) {
            return withScheme.replace(/\/+$/, '');
        }
    }

    function isRemoteSource(baseUrl) {
        try {
            const parsed = new URL(normalizeHostUrl(baseUrl));
            const h = parsed.hostname.toLowerCase();
            return h !== 'localhost' && h !== '127.0.0.1' && h !== '::1' && h !== '[::1]';
        } catch (_) {
            return false;
        }
    }

    function formatShortHostLabel(baseUrl) {
        try {
            const parsed = new URL(normalizeHostUrl(baseUrl));
            return parsed.host || baseUrl;
        } catch (_) {
            return String(baseUrl || DEFAULT_DRAFT_SOURCE_URL);
        }
    }

    async function readHostConfigFromStorage() {
        let draftSourceRaw = '';
        let webHostRaw = '';
        let selectedDraftFilename = '';
        let draftTypeRaw = '';
        let lastSectionRaw = '';
        let hostPanelOpenRaw = '';

        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const res = await chrome.storage.local.get([
                    STORAGE_KEY_DRAFT_SOURCE,
                    STORAGE_KEY_WEB_HOST,
                    STORAGE_KEY_SELECTED_DRAFT,
                    STORAGE_KEY_DRAFT_TYPE,
                    STORAGE_KEY_LAST_SECTION,
                    STORAGE_KEY_HOST_PANEL_OPEN
                ]);
                if (res) {
                    draftSourceRaw = res[STORAGE_KEY_DRAFT_SOURCE] || '';
                    webHostRaw = res[STORAGE_KEY_WEB_HOST] || '';
                    selectedDraftFilename = res[STORAGE_KEY_SELECTED_DRAFT] || '';
                    draftTypeRaw = res[STORAGE_KEY_DRAFT_TYPE] || '';
                    lastSectionRaw = res[STORAGE_KEY_LAST_SECTION] || '';
                    if (res[STORAGE_KEY_HOST_PANEL_OPEN] !== undefined) {
                        hostPanelOpenRaw = String(res[STORAGE_KEY_HOST_PANEL_OPEN]);
                    }
                }
            }
        } catch (_) {}

        try {
            if (typeof localStorage !== 'undefined') {
                if (!draftSourceRaw) draftSourceRaw = localStorage.getItem(STORAGE_KEY_DRAFT_SOURCE) || '';
                if (!webHostRaw) webHostRaw = localStorage.getItem(STORAGE_KEY_WEB_HOST) || '';
                if (!selectedDraftFilename) selectedDraftFilename = localStorage.getItem(STORAGE_KEY_SELECTED_DRAFT) || '';
                if (!draftTypeRaw) draftTypeRaw = localStorage.getItem(STORAGE_KEY_DRAFT_TYPE) || '';
                if (!lastSectionRaw) lastSectionRaw = localStorage.getItem(STORAGE_KEY_LAST_SECTION) || '';
                if (!hostPanelOpenRaw) hostPanelOpenRaw = localStorage.getItem(STORAGE_KEY_HOST_PANEL_OPEN) || '';
            }
        } catch (_) {}

        const draftType = String(draftTypeRaw || '').toLowerCase() === 'ekspor' ? 'ekspor' : 'impor';

        return {
            draftSourceUrl: normalizeHostUrl(draftSourceRaw, 5005, DEFAULT_DRAFT_SOURCE_URL),
            webHostUrl: normalizeHostUrl(webHostRaw, 5005, DEFAULT_WEB_HOST_URL),
            hasCustomWebHost: Boolean(String(webHostRaw || '').trim()),
            hasCustomDraftSource: Boolean(String(draftSourceRaw || '').trim()),
            selectedDraftFilename: String(selectedDraftFilename || ''),
            draftType,
            lastSection: String(lastSectionRaw || ''),
            hostPanelOpen: hostPanelOpenRaw === 'true'
        };
    }

    async function saveHostConfigToStorage(partial) {
        const current = await readHostConfigFromStorage();
        const nextDraftSource = partial && partial.draftSourceUrl !== undefined
            ? normalizeHostUrl(partial.draftSourceUrl, 5005, DEFAULT_DRAFT_SOURCE_URL)
            : current.draftSourceUrl;
        const nextWebHost = partial && partial.webHostUrl !== undefined
            ? normalizeHostUrl(partial.webHostUrl, 5005, DEFAULT_WEB_HOST_URL)
            : current.webHostUrl;
        const nextSelected = partial && partial.selectedDraftFilename !== undefined
            ? String(partial.selectedDraftFilename || '')
            : current.selectedDraftFilename;
        const nextDraftType = partial && partial.draftType !== undefined
            ? (String(partial.draftType).toLowerCase() === 'ekspor' ? 'ekspor' : 'impor')
            : current.draftType;
        const nextLastSection = partial && partial.lastSection !== undefined
            ? String(partial.lastSection || '')
            : current.lastSection;
        const nextHostPanelOpen = partial && partial.hostPanelOpen !== undefined
            ? Boolean(partial.hostPanelOpen)
            : current.hostPanelOpen;

        const payload = {
            [STORAGE_KEY_DRAFT_SOURCE]: nextDraftSource,
            [STORAGE_KEY_WEB_HOST]: nextWebHost,
            [STORAGE_KEY_SELECTED_DRAFT]: nextSelected,
            [STORAGE_KEY_DRAFT_TYPE]: nextDraftType,
            [STORAGE_KEY_LAST_SECTION]: nextLastSection,
            [STORAGE_KEY_HOST_PANEL_OPEN]: nextHostPanelOpen
        };

        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set(payload);
            }
        } catch (_) {}

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY_DRAFT_SOURCE, nextDraftSource);
                localStorage.setItem(STORAGE_KEY_WEB_HOST, nextWebHost);
                localStorage.setItem(STORAGE_KEY_SELECTED_DRAFT, nextSelected);
                localStorage.setItem(STORAGE_KEY_DRAFT_TYPE, nextDraftType);
                localStorage.setItem(STORAGE_KEY_LAST_SECTION, nextLastSection);
                localStorage.setItem(STORAGE_KEY_HOST_PANEL_OPEN, String(nextHostPanelOpen));
            }
        } catch (_) {}

        return {
            draftSourceUrl: nextDraftSource,
            webHostUrl: nextWebHost,
            selectedDraftFilename: nextSelected,
            draftType: nextDraftType,
            lastSection: nextLastSection,
            hostPanelOpen: nextHostPanelOpen,
            isRemoteDraftSource: isRemoteSource(nextDraftSource)
        };
    }

    async function fetchJsonWithTimeout(url, timeoutMs = 4500, fetchImpl) {
        const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
        if (!doFetch) throw new Error('Fetch API tidak tersedia');

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        try {
            const resp = await doFetch(url, controller ? { signal: controller.signal } : undefined);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const json = await resp.json();
            return json;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function checkDraftServerHealth(baseUrl, fetchImpl) {
        const normalized = normalizeHostUrl(baseUrl, 5005, DEFAULT_DRAFT_SOURCE_URL);
        try {
            const data = await fetchJsonWithTimeout(`${normalized}/api/health`, 3500, fetchImpl);
            return {
                ok: Boolean(data && (data.ok || data.service)),
                baseUrl: normalized,
                hostIp: data?.hostIp || '',
                legacy: false
            };
        } catch (_) {
            // Fallback untuk server versi lama sebelum endpoint /api/health ditambahkan
            try {
                await fetchJsonWithTimeout(`${normalized}/api/get-latest-draft?mode=impor`, 3500, fetchImpl);
                return {
                    ok: true,
                    baseUrl: normalized,
                    hostIp: '',
                    legacy: true
                };
            } catch (err) {
                return {
                    ok: false,
                    baseUrl: normalized,
                    error: err?.name === 'AbortError' ? 'Timeout menjangkau host' : (err?.message || 'Tidak terjangkau')
                };
            }
        }
    }

    async function fetchDraftList(baseUrl, mode = 'impor', fetchImpl) {
        const normalized = normalizeHostUrl(baseUrl, 5005, DEFAULT_DRAFT_SOURCE_URL);
        const safeMode = mode === 'impor' ? 'impor' : 'ekspor';
        try {
            const data = await fetchJsonWithTimeout(`${normalized}/api/list-drafts?mode=${safeMode}`, 4500, fetchImpl);
            const drafts = Array.isArray(data?.drafts) ? data.drafts : [];
            return { ok: true, baseUrl: normalized, drafts, legacy: false };
        } catch (err) {
            return { ok: false, baseUrl: normalized, drafts: [], error: err?.message || 'Gagal memuat daftar draft', legacy: true };
        }
    }

    function isValidDraftPayload(draft) {
        return Boolean(
            draft &&
            typeof draft === 'object' &&
            (draft.invoiceNumber || draft.nomorAju || draft.noAju || draft.invoices || (Array.isArray(draft.items) && draft.items.length > 0))
        );
    }

    async function fetchDraftData(baseUrl, mode = 'impor', filename = '', fetchImpl) {
        const normalized = normalizeHostUrl(baseUrl, 5005, DEFAULT_DRAFT_SOURCE_URL);
        const safeMode = mode === 'impor' ? 'impor' : 'ekspor';
        const endpoint = filename
            ? `${normalized}/api/get-draft?mode=${safeMode}&filename=${encodeURIComponent(filename)}`
            : `${normalized}/api/get-latest-draft?mode=${safeMode}`;

        const draft = await fetchJsonWithTimeout(endpoint, 5000, fetchImpl);
        if (isValidDraftPayload(draft)) {
            return {
                ok: true,
                draft,
                sourceUrl: normalized,
                filename: filename || '',
                isRemote: isRemoteSource(normalized)
            };
        }
        return {
            ok: false,
            draft: null,
            sourceUrl: normalized,
            filename: filename || '',
            isRemote: isRemoteSource(normalized)
        };
    }

    function resolveDashboardUrl(config, hasBundledDashboardHtml = false) {
        const webHostUrl = normalizeHostUrl(config?.webHostUrl, 5005, DEFAULT_WEB_HOST_URL);
        if (hasBundledDashboardHtml && !config?.hasCustomWebHost && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            return chrome.runtime.getURL('dashboard.html');
        }
        return `${webHostUrl}/dashboard.html`;
    }

    return {
        DEFAULT_DRAFT_SOURCE_URL,
        DEFAULT_WEB_HOST_URL,
        STORAGE_KEY_DRAFT_SOURCE,
        STORAGE_KEY_WEB_HOST,
        STORAGE_KEY_SELECTED_DRAFT,
        STORAGE_KEY_DRAFT_TYPE,
        STORAGE_KEY_LAST_SECTION,
        STORAGE_KEY_HOST_PANEL_OPEN,
        normalizeHostUrl,
        isRemoteSource,
        formatShortHostLabel,
        readHostConfigFromStorage,
        saveHostConfigToStorage,
        fetchJsonWithTimeout,
        checkDraftServerHealth,
        fetchDraftList,
        isValidDraftPayload,
        fetchDraftData,
        resolveDashboardUrl
    };
}));
