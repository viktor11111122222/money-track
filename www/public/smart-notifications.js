// ── Smart Suggestions + Daily Reminders via Local Notifications ──
// Schedules a fresh set of notifications once per calendar day when the app opens.
(function () {

    var SCHEDULE_KEY = 'mt_smart_notif_date'; // localStorage key — today's date string
    var ID_BASE      = 2000;                   // IDs 2000–2099 (avoid conflicts with 1001/1002)

    // ── Helpers ──────────────────────────────────────────────────────────────────

    function getPlugin() {
        return window.Capacitor &&
               window.Capacitor.Plugins &&
               window.Capacitor.Plugins.LocalNotifications
               ? window.Capacitor.Plugins.LocalNotifications : null;
    }

    function notifEnabled() {
        try {
            var s = JSON.parse(localStorage.getItem('mt_settings_v1') || '{}');
            var n = s.notifications || {};
            // Use the "weekly" toggle as the proxy for smart/reminder notifications.
            // If not explicitly set, default to enabled.
            return n.weekly !== false;
        } catch (e) { return true; }
    }

    function getExpenseData() {
        try {
            var raw = localStorage.getItem('expenseTrackerData');
            if (!raw) return { income: 0, expenses: [], currentBalance: 0 };
            var p = JSON.parse(raw);
            return {
                income:          typeof p.income === 'number'         ? p.income         : 0,
                currentBalance:  typeof p.currentBalance === 'number' ? p.currentBalance : 0,
                expenses:        Array.isArray(p.expenses)            ? p.expenses       : []
            };
        } catch (e) { return { income: 0, expenses: [], currentBalance: 0 }; }
    }

    function getCurrencySymbol() {
        try {
            var s = JSON.parse(localStorage.getItem('mt_settings_v1') || '{}');
            var map = { RSD:' RSD', USD:' $', EUR:' €', GBP:' £', JPY:' ¥',
                        AUD:' A$', CAD:' C$', CNY:' ¥', INR:' ₹', BRL:' R$',
                        CHF:' CHF', SEK:' kr', NOK:' kr' };
            return map[(s.preferences || {}).currency] || ' €';
        } catch (e) { return ' €'; }
    }

    function fmt(n, cur) {
        return Number(n).toLocaleString() + cur;
    }

    // Returns today's string e.g. "2026-03-24"
    function todayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    // Build a Date for today at HH:MM
    function todayAt(hour, minute) {
        var d = new Date();
        d.setHours(hour, minute || 0, 0, 0);
        // If the time has already passed today, push to tomorrow
        if (d <= Date.now()) d.setDate(d.getDate() + 1);
        return d;
    }

    // ── Smart suggestion builder ─────────────────────────────────────────────────

    function buildSuggestions() {
        var data = getExpenseData();
        var cur  = getCurrencySymbol();
        var expenses = data.expenses.filter(function (e) {
            return e && e.type !== 'income' && e.type !== 'savings';
        });

        // Total spent this month
        var now   = new Date();
        var month = now.getMonth();
        var year  = now.getFullYear();
        var monthlyExpenses = expenses.filter(function (e) {
            var d = new Date(e.date || e.created_at || 0);
            return d.getMonth() === month && d.getFullYear() === year;
        });
        var totalSpent = monthlyExpenses.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);

        // Today's expenses
        var todayStr2 = now.toDateString();
        var todaySpent = expenses.filter(function (e) {
            return new Date(e.date || e.created_at || 0).toDateString() === todayStr2;
        }).reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);

        var income  = data.income || 1;
        var pct     = Math.round((totalSpent / income) * 100);
        var balance = income - totalSpent;

        // Top category this month
        var catTotals = {};
        monthlyExpenses.forEach(function (e) {
            var c = e.category || 'Other';
            catTotals[c] = (catTotals[c] || 0) + (Number(e.amount) || 0);
        });
        var topCat = null, topCatAmt = 0;
        Object.keys(catTotals).forEach(function (c) {
            if (catTotals[c] > topCatAmt) { topCat = c; topCatAmt = catTotals[c]; }
        });

        // Days left in month
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var daysLeft = daysInMonth - now.getDate();

        // Build pool of smart messages
        var pool = [];

        if (income > 0 && totalSpent > 0) {
            if (pct >= 90) {
                pool.push({ title: 'Budget Alert', body: 'You\'ve used ' + pct + '% of your monthly budget. Only ' + fmt(Math.max(0, balance), cur) + ' left!' });
            } else if (pct >= 70) {
                pool.push({ title: 'Spending Update', body: 'You\'ve spent ' + pct + '% of your budget this month. ' + fmt(Math.max(0, balance), cur) + ' remaining.' });
            } else if (pct <= 30) {
                pool.push({ title: 'Great Progress!', body: 'Only ' + pct + '% of budget used this month. You\'re doing great!' });
            } else {
                pool.push({ title: 'Monthly Check-in', body: 'You\'ve spent ' + fmt(totalSpent, cur) + ' this month (' + pct + '% of budget).' });
            }
        }

        if (topCat && topCatAmt > 0) {
            pool.push({ title: 'Top Spending Category', body: topCat + ' is your biggest expense this month: ' + fmt(topCatAmt, cur) + '.' });
        }

        if (daysLeft > 0 && income > 0 && balance > 0) {
            var perDay = Math.round(balance / daysLeft);
            pool.push({ title: 'Daily Budget Tip', body: 'You have ' + daysLeft + ' days left this month. That\'s ' + fmt(perDay, cur) + ' per day to stay on track.' });
        }

        if (totalSpent > income) {
            pool.push({ title: 'Over Budget', body: 'You\'ve exceeded your monthly budget by ' + fmt(totalSpent - income, cur) + '. Consider reducing spending.' });
        }

        if (todaySpent > 0) {
            pool.push({ title: 'Today\'s Spending', body: 'You\'ve spent ' + fmt(todaySpent, cur) + ' today. Keep tracking!' });
        } else {
            pool.push({ title: 'Log Your Expenses', body: 'No expenses logged today yet. Tap to add your spending!' });
        }

        if (monthlyExpenses.length === 0) {
            pool.push({ title: 'Start Tracking', body: 'No expenses this month yet. Start logging to get smart insights!' });
        }

        // Shuffle so different suggestions appear each day
        pool.sort(function () { return Math.random() - 0.5; });
        return pool;
    }

    // ── Fixed daily reminders ────────────────────────────────────────────────────

    var REMINDERS = [
        { hour:  9, min:  0, title: 'Good Morning!',        body: 'Start your day right — log any expenses as they happen.' },
        { hour: 13, min:  0, title: 'Midday Reminder',      body: 'Did you spend anything this morning? Tap to log it quickly.' },
        { hour: 19, min:  0, title: 'Evening Budget Check', body: 'End of day — review today\'s spending and stay on track.' },
        { hour: 21, min: 30, title: 'Daily Tip',            body: 'Small daily savings add up fast. Review your expenses before bed.' }
    ];

    // ── Scheduler ────────────────────────────────────────────────────────────────

    async function scheduleAll() {
        var plugin = getPlugin();
        if (!plugin) return;
        if (!notifEnabled()) return;

        // Only schedule once per calendar day
        if (localStorage.getItem(SCHEDULE_KEY) === todayStr()) return;

        // Check / request permission
        try {
            var perm = await plugin.checkPermissions();
            if (perm.display !== 'granted') {
                var req = await plugin.requestPermissions();
                if (req.display !== 'granted') return;
            }
        } catch (e) { return; }

        // Cancel previous smart notifications so we start fresh
        try {
            var ids = [];
            for (var i = 0; i < 20; i++) ids.push({ id: ID_BASE + i });
            await plugin.cancel({ notifications: ids });
        } catch (e) { /* ignore */ }

        // Build notification list
        var suggestions = buildSuggestions();
        var notifications = [];
        var idCounter = ID_BASE;

        // Smart suggestion at 12:00 and 17:00
        var smartTimes = [{ hour: 12, min: 0 }, { hour: 17, min: 0 }];
        smartTimes.forEach(function (t, i) {
            var s = suggestions[i % suggestions.length];
            if (!s) return;
            notifications.push({
                id:    idCounter++,
                title: s.title,
                body:  s.body,
                schedule: { at: todayAt(t.hour, t.min) },
                actionTypeId: ''
            });
        });

        // Fixed daily reminders
        REMINDERS.forEach(function (r) {
            notifications.push({
                id:    idCounter++,
                title: r.title,
                body:  r.body,
                schedule: { at: todayAt(r.hour, r.min) },
                actionTypeId: ''
            });
        });

        // iOS requires at least 1 minute in the future; filter out anything sooner or beyond 23h
        var now    = Date.now();
        var cutoff = now + 23 * 60 * 60 * 1000;
        var minAt  = now + 60 * 1000; // 1 minute minimum (iOS requirement)
        notifications = notifications.filter(function (n) {
            var t = n.schedule.at.getTime();
            return t >= minAt && t <= cutoff;
        });

        if (notifications.length === 0) return;

        try {
            await plugin.schedule({ notifications: notifications });
            localStorage.setItem(SCHEDULE_KEY, todayStr());
        } catch (e) { /* silent */ }
    }

    // Run after a short delay so the app finishes loading first
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        setTimeout(scheduleAll, 3000);
    }

    // Expose so settings page can re-trigger if user enables notifications
    window._smartNotif = { schedule: scheduleAll };

})();
