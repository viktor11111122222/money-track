// ── Google AdMob banner helper ──
// Uses @capacitor-community/admob via native Capacitor bridge
//
// SETUP: Replace Android IDs below with your real Android AdMob IDs from console.admob.google.com
// iOS IDs and Android IDs are separate — register your app on each platform in AdMob.

(function () {
    var platform = (window.Capacitor && window.Capacitor.getPlatform) ? window.Capacitor.getPlatform() : 'web';
    var isAndroid = platform === 'android';

    // ─── iOS AdMob IDs ────────────────────────────────────────────────
    var IOS_APP_ID        = 'ca-app-pub-4263612271170636~7236104838';
    var IOS_AD_DASHBOARD  = 'ca-app-pub-4263612271170636/5737487618';
    var IOS_AD_EXPENSES   = 'ca-app-pub-4263612271170636/5482336749';
    var IOS_AD_SETTINGS   = 'ca-app-pub-4263612271170636/4646799627';

    // ─── Android AdMob IDs ────────────────────────────────────────────
    // TODO: Replace these with your real Android AdMob IDs from admob.google.com
    // Currently using Google's official test IDs for development.
    var ANDROID_APP_ID       = 'ca-app-pub-3940256099942544~3347511713'; // test — replace with real
    var ANDROID_AD_DASHBOARD = 'ca-app-pub-3940256099942544/6300978111'; // test — replace with real
    var ANDROID_AD_EXPENSES  = 'ca-app-pub-3940256099942544/6300978111'; // test — replace with real
    var ANDROID_AD_SETTINGS  = 'ca-app-pub-3940256099942544/6300978111'; // test — replace with real
    // ─────────────────────────────────────────────────────────────────

    var APP_ID        = isAndroid ? ANDROID_APP_ID        : IOS_APP_ID;
    var AD_UNIT_DASHBOARD = isAndroid ? ANDROID_AD_DASHBOARD : IOS_AD_DASHBOARD;
    var AD_UNIT_EXPENSES  = isAndroid ? ANDROID_AD_EXPENSES  : IOS_AD_EXPENSES;
    var AD_UNIT_SETTINGS  = isAndroid ? ANDROID_AD_SETTINGS  : IOS_AD_SETTINGS;

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
                position: 'TOP_CENTER',       // top of screen, away from nav bar
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
