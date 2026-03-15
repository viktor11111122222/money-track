// ── Google AdMob banner helper ──
// Uses @capacitor-community/admob via native Capacitor bridge
//
// SETUP: Replace the IDs below with your real AdMob IDs from console.admob.google.com
// Test IDs are used until you replace them (safe for development/TestFlight).

(function () {
    // ─── YOUR ADMOB IDs ───────────────────────────────────────────────
    var APP_ID        = 'ca-app-pub-4263612271170636~7236104838';
    var AD_UNIT_DASHBOARD = 'ca-app-pub-4263612271170636/5737487618';
    var AD_UNIT_EXPENSES  = 'ca-app-pub-4263612271170636/5482336749';
    var AD_UNIT_SETTINGS  = 'ca-app-pub-4263612271170636/4646799627';
    // ─────────────────────────────────────────────────────────────────

    function getPlugin() {
        return window.Capacitor &&
               window.Capacitor.Plugins &&
               window.Capacitor.Plugins.AdMob
               ? window.Capacitor.Plugins.AdMob
               : null;
    }

    // Detect which page we're on
    function getAdUnitId() {
        var path = window.location.pathname;
        if (path.indexOf('expenses') !== -1) return AD_UNIT_EXPENSES;
        if (path.indexOf('settings') !== -1) return AD_UNIT_SETTINGS;
        return AD_UNIT_DASHBOARD; // dashboard or default
    }

    async function initAdMob() {
        var plugin = getPlugin();
        if (!plugin) return;

        try {
            await plugin.initialize({
                initializeForTesting: false,
                tagForChildDirectedTreatment: false,
                tagForUnderAgeOfConsent: false
            });
            showBanner();
        } catch (e) { /* silent */ }
    }

    async function showBanner() {
        var plugin = getPlugin();
        if (!plugin) return;

        try {
            await plugin.showBanner({
                adId: getAdUnitId(),
                adSize: 'ADAPTIVE_BANNER',   // adapts to screen width
                position: 'BOTTOM',           // sits just above content
                margin: 0,
                isTesting: true
            });
        } catch (e) { /* silent */ }
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdMob);
    } else {
        initAdMob();
    }

    // Expose for manual control if needed
    window._adMob = { show: showBanner };
})();
