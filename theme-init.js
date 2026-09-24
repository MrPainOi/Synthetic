// ============================================================
// CEISA CRITICAL THEME INITIALIZER (theme-init.js)
// Runs synchronously in <head> to prevent FOUC / flashbang
// Fully compliant with Chrome Extension Manifest V3 CSP
// ============================================================
(function () {
    try {
        var theme = localStorage.getItem('ceisa_theme');
        if (!theme) {
            theme = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
        }
        var isDark = theme === 'dark';
        var bg = isDark ? '#080d16' : '#f8fafc';
        var cs = isDark ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.backgroundColor = bg;
        document.documentElement.style.colorScheme = cs;

        var style = document.createElement('style');
        style.id = 'ceisa-theme-critical';
        style.textContent = 'html, body { background-color: ' + bg + ' !important; color-scheme: ' + cs + ' !important; }';
        if (document.head) {
            document.head.appendChild(style);
        } else {
            document.documentElement.appendChild(style);
        }
    } catch (_) {}
})();
