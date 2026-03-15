// ===== LOCAL NOTIFICATIONS =====
// Uses @capacitor/local-notifications via the native Capacitor bridge

let _permissionGranted = false;
let _permissionChecked = false;

function getPlugin() {
    return window.Capacitor &&
           window.Capacitor.Plugins &&
           window.Capacitor.Plugins.LocalNotifications
           ? window.Capacitor.Plugins.LocalNotifications
           : null;
}

async function ensurePermission() {
    if (_permissionChecked && _permissionGranted) return true;
    const plugin = getPlugin();
    if (!plugin) return false;
    try {
        const { display } = await plugin.checkPermissions();
        if (display === 'granted') {
            _permissionGranted = true;
            _permissionChecked = true;
            return true;
        }
        const result = await plugin.requestPermissions();
        _permissionGranted = result.display === 'granted';
        _permissionChecked = true;
        return _permissionGranted;
    } catch (e) {
        return false;
    }
}

function getNotifPrefs() {
    try {
        const raw = localStorage.getItem('mt_settings_v1');
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed.notifications || {};
    } catch (e) {
        return {};
    }
}

async function scheduleNotif(id, title, body) {
    const plugin = getPlugin();
    if (!plugin) return;
    const ok = await ensurePermission();
    if (!ok) return;
    try {
        await plugin.schedule({
            notifications: [{
                id,
                title,
                body,
                schedule: { at: new Date(Date.now() + 300) },
                actionTypeId: ''
            }]
        });
    } catch (e) { /* silent fail */ }
}

// ── Public API ──

// Called when expense is added
async function notifyExpenseAdded(amount, category, currency) {
    if (!getNotifPrefs().expense) return;
    const cur = currency || '$';
    await scheduleNotif(
        1001,
        'Expense Added',
        `${Number(amount).toLocaleString()} ${cur} · ${category}`
    );
}

// Called when category limit is exceeded
async function notifyLimitExceeded(category, spent, limit, currency) {
    if (!getNotifPrefs().monthly) return;
    const cur = currency || '$';
    await scheduleNotif(
        1002,
        '⚠️ Monthly Limit Reached',
        `${category}: ${Number(spent).toLocaleString()} ${cur} / ${Number(limit).toLocaleString()} ${cur}`
    );
}

// Called when a notification toggle is switched ON — requests permission immediately
async function onNotifToggleEnabled() {
    const plugin = getPlugin();
    if (!plugin) return;
    const ok = await ensurePermission();
    if (!ok) {
        alert('To receive notifications, please allow them in your device Settings.');
    }
}
