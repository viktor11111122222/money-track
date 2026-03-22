// settings.js – fully functional settings page
(function () {
  const STORAGE_KEY = 'mt_settings_v1';
  const API_BASE = (window.location.port === '5500' || window.location.port === '5501') ? 'http://localhost:8080/api' : '/api';
  const TOKEN_KEY = 'sharedBudgetToken';

  const defaults = {
    profile: { fullName: '', email: '', username: '', avatar: '/public/avatar-default.svg' },
    account: { twoFactor: true },
    notifications: { expense: true, monthly: true, family: true, wallet: true, weekly: true, sounds: true },
    preferences: { currency: 'EUR', dateFormat: 'DD/MM/YYYY', startMonth: '1', monthlyIncome: 0, language: 'English' },
    appearance: { theme: 'light', accent: 'indigo' }
  };

  /* ── Accent color map ── */
  const accentMap = {
    indigo: { main: '#6366f1', hover: '#4f46e5', rgb: '99,102,241',  grad: '#06b6d4' },
    blue:   { main: '#2563eb', hover: '#1d4ed8', rgb: '37,99,235',   grad: '#60a5fa' },
    green:  { main: '#10b981', hover: '#059669', rgb: '16,185,129',  grad: '#34d399' },
    purple: { main: '#7c3aed', hover: '#6d28d9', rgb: '124,58,237', grad: '#a78bfa' },
    pink:   { main: '#ec4899', hover: '#db2777', rgb: '236,72,153', grad: '#f472b6' },
    gray:   { main: '#64748b', hover: '#475569', rgb: '100,116,139', grad: '#94a3b8' }
  };

  /* ── Currency symbol map ── */
  const currencySymbol = {
    RSD: ' RSD', USD: ' $', EUR: ' €', GBP: ' £', JPY: ' ¥',
    AUD: ' A$', CAD: ' C$', CNY: ' ¥', INR: ' ₹', BRL: ' R$',
    CHF: ' CHF', SEK: ' kr', NOK: ' kr'
  };

  /* ── Exchange rates (all relative to 1 RSD) ── */
  // Approximate rates: 1 RSD = X units of target currency
  var ratesFromRSD = {
    RSD: 1,
    EUR: 0.00852,    // ~117.3 RSD = 1 EUR
    USD: 0.00926,    // ~108 RSD = 1 USD
    GBP: 0.00735,    // ~136 RSD = 1 GBP
    CHF: 0.00819,    // ~122 RSD = 1 CHF
    JPY: 1.393,      // ~0.718 RSD = 1 JPY
    AUD: 0.01446,    // ~69 RSD = 1 AUD
    CAD: 0.01282,    // ~78 RSD = 1 CAD
    CNY: 0.06707,    // ~14.9 RSD = 1 CNY
    INR: 0.7787,     // ~1.28 RSD = 1 INR
    BRL: 0.05319,    // ~18.8 RSD = 1 BRL
    SEK: 0.09926,    // ~10.07 RSD = 1 SEK
    NOK: 0.10204     // ~9.8 RSD = 1 NOK
  };

  /**
   * Convert an amount from one currency to another.
   * Goes: fromCurrency → RSD → toCurrency
   */
  function convertAmount(amount, fromCurrency, toCurrency) {
    if (!amount || fromCurrency === toCurrency) return amount;
    var fromRate = ratesFromRSD[fromCurrency];
    var toRate = ratesFromRSD[toCurrency];
    if (!fromRate || !toRate) return amount;
    // amount in FROM → RSD → TO
    var inRSD = amount / fromRate;
    return Math.round(inRSD * toRate * 100) / 100;
  }

  /**
   * Convert all monetary values in appData from oldCurrency to newCurrency.
   */
  function convertAppData(oldCurrency, newCurrency) {
    var raw = localStorage.getItem('expenseTrackerData');
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch(e) { return; }

    // Convert income
    if (typeof data.income === 'number') {
      data.income = convertAmount(data.income, oldCurrency, newCurrency);
    }
    // Convert current balance
    if (typeof data.currentBalance === 'number') {
      data.currentBalance = convertAmount(data.currentBalance, oldCurrency, newCurrency);
    }
    // Convert savings total
    if (typeof data.savingsTotal === 'number') {
      data.savingsTotal = convertAmount(data.savingsTotal, oldCurrency, newCurrency);
    }
    // Convert each expense amount
    if (Array.isArray(data.expenses)) {
      data.expenses.forEach(function(exp) {
        if (typeof exp.amount === 'number') {
          exp.amount = convertAmount(exp.amount, oldCurrency, newCurrency);
        }
      });
    }
    // Convert category limits
    if (data.categoryLimits && typeof data.categoryLimits === 'object') {
      Object.keys(data.categoryLimits).forEach(function(cat) {
        if (typeof data.categoryLimits[cat] === 'number') {
          data.categoryLimits[cat] = convertAmount(data.categoryLimits[cat], oldCurrency, newCurrency);
        }
      });
    }
    // Convert recurring expenses
    if (Array.isArray(data.recurringExpenses)) {
      data.recurringExpenses.forEach(function(rec) {
        if (typeof rec.amount === 'number') {
          rec.amount = convertAmount(rec.amount, oldCurrency, newCurrency);
        }
      });
    }

    localStorage.setItem('expenseTrackerData', JSON.stringify(data));

    // Also update server-side income and balance
    var token = getToken();
    if (token && !isLocal(token)) {
      fetch(API_BASE + '/me/finances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          monthlyIncome: data.income,
          currentBalance: data.currentBalance
        })
      }).catch(function() { /* server may be down */ });
    }
  }

  /* ── Helpers ── */
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function isLocal(token) { return !token || token.startsWith('local_'); }
  function qs(sel, ctx = document) { return ctx.querySelector(sel); }

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      const parsed = JSON.parse(raw);
      return {
        profile: Object.assign({}, defaults.profile, parsed.profile),
        account: Object.assign({}, defaults.account, parsed.account),
        notifications: Object.assign({}, defaults.notifications, parsed.notifications),
        preferences: Object.assign({}, defaults.preferences, parsed.preferences),
        appearance: Object.assign({}, defaults.appearance, parsed.appearance)
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(defaults));
    }
  }

  function writeStorage(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) { /* */ }
  }

  /* ── Toast helper ── */
  function showToast(msg, type) {
    type = type || 'success';
    var colors = {
      success: { bg: '#059669', text: '#fff' },
      error:   { bg: '#ef4444', text: '#fff' },
      info:    { bg: '#2563eb', text: '#fff' }
    };
    var c = colors[type] || colors.success;
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.position = 'fixed';
    t.style.right = '18px';
    t.style.bottom = '18px';
    t.style.background = c.bg;
    t.style.color = c.text;
    t.style.padding = '12px 20px';
    t.style.borderRadius = '10px';
    t.style.boxShadow = '0 8px 24px rgba(2,6,23,0.25)';
    t.style.zIndex = '9999';
    t.style.fontSize = '14px';
    t.style.fontWeight = '600';
    t.style.transition = 'opacity 0.3s';
    t.style.opacity = '1';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity = '0'; setTimeout(function(){ t.remove(); }, 300); }, 2200);
  }

  /* ── Confirm dialog ── */
  function showConfirm(title, message) {
    return new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,0.5)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '10000';
      overlay.style.backdropFilter = 'blur(4px)';

      var isDark = document.documentElement.classList.contains('dark-theme');
      var card = document.createElement('div');
      card.style.background = isDark ? '#0f1724' : '#fff';
      card.style.borderRadius = '16px';
      card.style.padding = '28px';
      card.style.maxWidth = '380px';
      card.style.width = '90%';
      card.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)';
      card.style.textAlign = 'center';
      card.style.color = isDark ? '#e6eefc' : '#0f1724';
      card.innerHTML =
        '<h3 style="margin:0 0 8px 0;font-size:18px;">' + title + '</h3>' +
        '<p style="margin:0 0 20px 0;color:' + (isDark ? '#9aa6b2' : '#64748b') + ';font-size:14px;">' + message + '</p>' +
        '<div style="display:flex;gap:10px;justify-content:center;">' +
          '<button id="_confirmNo" style="padding:10px 24px;border:1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0') + ';border-radius:10px;background:transparent;color:' + (isDark ? '#e6eefc' : '#0f1724') + ';font-weight:600;cursor:pointer;">Cancel</button>' +
          '<button id="_confirmYes" style="padding:10px 24px;border:none;border-radius:10px;background:#ef4444;color:#fff;font-weight:600;cursor:pointer;">Confirm</button>' +
        '</div>';
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      overlay.querySelector('#_confirmYes').onclick = function() { overlay.remove(); resolve(true); };
      overlay.querySelector('#_confirmNo').onclick = function() { overlay.remove(); resolve(false); };
      overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  }

  /* ── Apply theme ── */
  var _systemListener = null;
  function applyTheme(theme) {
    if (_systemListener) {
      try { window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', _systemListener); } catch (e) { /**/ }
      _systemListener = null;
    }
    var root = document.documentElement;
    function setMode(mode) {
      if (mode === 'dark') root.classList.add('dark-theme');
      else root.classList.remove('dark-theme');
    }
    if (theme === 'system') {
      var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      setMode(mq && mq.matches ? 'dark' : 'light');
      if (mq) {
        _systemListener = function(e) { setMode(e.matches ? 'dark' : 'light'); };
        try { mq.addEventListener('change', _systemListener); } catch (e) { try { mq.addListener(_systemListener); } catch (_) { /**/ } }
      }
    } else {
      setMode(theme === 'dark' ? 'dark' : 'light');
    }
  }

  /* ── Apply accent color ── */
  function applyAccent(accent) {
    var a = accentMap[accent] || accentMap.blue;
    document.documentElement.style.setProperty('--accent', a.main);
    document.documentElement.style.setProperty('--accent-hover', a.hover);
    document.documentElement.style.setProperty('--accent-rgb', a.rgb);
    document.documentElement.style.setProperty('--accent-grad', a.grad);
    document.querySelectorAll('.accent-palette .color-swatch').forEach(function(btn) {
      if (btn.dataset.accent === accent) {
        btn.style.outline = '3px solid ' + a.main;
        btn.style.outlineOffset = '3px';
      } else {
        btn.style.outline = 'none';
        btn.style.outlineOffset = '0';
      }
    });
  }

  /* ── Load profile from server ── */
  function loadProfile() {
    var token = getToken();
    if (!token || isLocal(token)) return;
    fetch(API_BASE + '/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(function(res) { return res.ok ? res.json() : null; })
      .then(function(user) {
        if (!user) return;
        var state = readStorage();
        if (user.name) {
          state.profile.fullName = user.name;
          var inp = qs('#fullNameInput');
          if (inp) inp.value = user.name;
        }
        if (user.email) {
          state.profile.email = user.email;
          var inp2 = qs('#emailInput');
          if (inp2) inp2.value = user.email;
        }
        if (user.avatar) {
          state.profile.avatar = user.avatar;
          var img = qs('#profileAvatarImg');
          if (img) img.src = user.avatar;
          var chipImg = document.querySelector('.account-chip img');
          if (chipImg) chipImg.src = user.avatar;
        }
        writeStorage(state);
      })
      .catch(function() { /* backend may be down */ });
  }

  /* ── Apply state to UI ── */
  function applyToUI(state) {
    qs('#fullNameInput').value = state.profile.fullName || '';
    qs('#emailInput').value = state.profile.email || '';
    qs('#usernameInput').value = state.profile.username || '';
    var avatarImg = qs('#profileAvatarImg');
    if (state.profile.avatar) avatarImg.src = state.profile.avatar;

    qs('#twoFactorToggle').checked = !!state.account.twoFactor;

    qs('#notifExpense').checked = !!state.notifications.expense;
    qs('#notifMonthly').checked = !!state.notifications.monthly;
    qs('#notifFamily').checked = !!state.notifications.family;
    qs('#notifWallet').checked = !!state.notifications.wallet;
    qs('#notifWeekly').checked = !!state.notifications.weekly;
    var soundToggle = qs('#soundToggle');
    if (soundToggle) soundToggle.checked = state.notifications.sounds !== false;

    qs('#currencySelect').value = state.preferences.currency || 'EUR';
    qs('#dateFormatSelect').value = state.preferences.dateFormat || 'DD/MM/YYYY';
    qs('#startMonthSelect').value = state.preferences.startMonth || '1';
    qs('#languageSelect').value = state.preferences.language || 'English';

    // Load monthly income from app data
    var incomeInput = qs('#monthlyIncomeInput');
    if (incomeInput) {
      try {
        var appRaw = localStorage.getItem('expenseTrackerData');
        var appD = appRaw ? JSON.parse(appRaw) : null;
        if (appD && typeof appD.income === 'number') {
          incomeInput.value = appD.income;
        }
      } catch(e) { /* */ }
    }

    // mt_theme_pref is the sole authoritative source for theme
    var theme = 'light';
    try { theme = localStorage.getItem('mt_theme_pref') || 'light'; } catch(e) {}
    // Keep mt_settings_v1 in sync
    if (state.appearance.theme !== theme) {
      state.appearance.theme = theme;
      writeStorage(state);
    }
    var themeRadio = qs('input[name=theme][value=' + theme + ']');
    if (themeRadio) themeRadio.checked = true;

    applyAccent(state.appearance.accent || 'blue');
    applyTheme(theme);
  }

  /* ── Collect all settings from UI ── */
  function collectFromUI() {
    var state = readStorage();
    state.profile.fullName = qs('#fullNameInput').value.trim();
    state.profile.email = qs('#emailInput').value.trim();
    state.profile.username = qs('#usernameInput').value.trim();
    state.account.twoFactor = !!qs('#twoFactorToggle').checked;
    state.notifications.expense = !!qs('#notifExpense').checked;
    state.notifications.monthly = !!qs('#notifMonthly').checked;
    state.notifications.family = !!qs('#notifFamily').checked;
    state.notifications.wallet = !!qs('#notifWallet').checked;
    state.notifications.weekly = !!qs('#notifWeekly').checked;
    var soundToggleEl = qs('#soundToggle');
    if (soundToggleEl) state.notifications.sounds = !!soundToggleEl.checked;
    state.preferences.currency = qs('#currencySelect').value;
    state.preferences.dateFormat = qs('#dateFormatSelect').value;
    state.preferences.startMonth = qs('#startMonthSelect').value;
    state.preferences.language = qs('#languageSelect').value;
    var incomeEl = qs('#monthlyIncomeInput');
    if (incomeEl && incomeEl.value) {
      state.preferences.monthlyIncome = parseFloat(incomeEl.value) || 0;
    }
    var themeRadio = document.querySelector('input[name=theme]:checked');
    state.appearance.theme = themeRadio ? themeRadio.value : 'light';
    // find the accent that has outline-offset set
    var found = null;
    document.querySelectorAll('.accent-palette .color-swatch').forEach(function(btn){
      if (btn.style.outlineOffset && btn.style.outlineOffset !== '0' && btn.style.outlineOffset !== '0px') found = btn.dataset.accent;
    });
    state.appearance.accent = found || state.appearance.accent || 'blue';
    return state;
  }

  /* ── Wire everything ── */
  function wire() {
    // ═══ Save Profile (to server + localStorage) ═══
    qs('#saveProfileBtn').addEventListener('click', function (e) {
      e.preventDefault();
      var name = qs('#fullNameInput').value.trim();
      var email = qs('#emailInput').value.trim();
      if (!name) return showToast('Name is required', 'error');
      if (!email || email.indexOf('@') === -1) return showToast('Valid email is required', 'error');

      var token = getToken();
      var saveLocal = function() {
        var state = readStorage();
        state.profile.fullName = name;
        state.profile.email = email;
        state.profile.username = qs('#usernameInput').value.trim();
        writeStorage(state);
        showToast('Profile saved ✓');
      };

      if (token && !isLocal(token)) {
        fetch(API_BASE + '/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ name: name, email: email, username: qs('#usernameInput').value.trim() })
        })
        .then(function(res) {
          if (!res.ok) return res.json().then(function(d){ showToast(d.message || 'Failed to save', 'error'); });
          saveLocal();
        })
        .catch(function() { saveLocal(); });
      } else {
        saveLocal();
      }
    });

    // ═══ Change Password ═══
    var changePassBtn = qs('#changePasswordBtn');
    if (changePassBtn) {
      changePassBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var current = qs('#currentPasswordInput').value;
        var newPass = qs('#newPasswordInput').value;
        var confirm = qs('#confirmPasswordInput').value;
        if (!current) return showToast('Enter current password', 'error');
        if (!newPass || newPass.length < 6) return showToast('New password must be at least 6 characters', 'error');
        if (newPass !== confirm) return showToast('Passwords do not match', 'error');

        var token = getToken();
        if (!token) return showToast('Not logged in', 'error');
        if (isLocal(token)) return showToast('Password change not available in local mode', 'info');
        fetch(API_BASE + '/me/password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        })
        .then(function(res) { return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
        .then(function(result) {
          if (!result.ok) return showToast(result.data.message || 'Failed to change password', 'error');
          showToast('Password changed ✓');
          qs('#currentPasswordInput').value = '';
          qs('#newPasswordInput').value = '';
          qs('#confirmPasswordInput').value = '';
        })
        .catch(function() { showToast('Server error', 'error'); });
      });
    }

    // ═══ Change Photo ═══
    var changePhotoBtn = qs('#changePhotoBtn');
    if (changePhotoBtn) {
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      changePhotoBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var data = ev.target.result;
          qs('#profileAvatarImg').src = data;
          var chipImg = document.querySelector('.account-chip img');
          if (chipImg) chipImg.src = data;

          var state = readStorage();
          state.profile.avatar = data;
          writeStorage(state);

          var token = getToken();
          if (token && !isLocal(token)) {
            fetch(API_BASE + '/me/avatar', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
              body: JSON.stringify({ avatar: data })
            }).catch(function(){});
          }
          showToast('Photo updated ✓');
        };
        reader.readAsDataURL(f);
      });
    }

    // ═══ Save All (top-right button) ═══
    var saveBtn = qs('#saveSettingsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var state = collectFromUI();
        writeStorage(state);

        var token = getToken();
        if (token && !isLocal(token) && state.profile.fullName) {
          fetch(API_BASE + '/me/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ name: state.profile.fullName, email: state.profile.email, username: state.profile.username })
          }).catch(function(){});
        }
        showToast('All settings saved ✓');
      });
    }

    // ═══ Accent color buttons ═══
    document.querySelectorAll('.accent-palette .color-swatch').forEach(function(btn) {
      btn.addEventListener('click', function () {
        var accent = this.dataset.accent;
        applyAccent(accent);
        var state = readStorage();
        state.appearance.accent = accent;
        writeStorage(state);
      });
    });

    // ═══ Theme radios – immediate ═══
    document.querySelectorAll('input[name=theme]').forEach(function(r) {
      r.addEventListener('change', function () {
        var val = this.value;
        applyTheme(val);
        var state = readStorage();
        state.appearance.theme = val;
        writeStorage(state);
        // Also write to backup key so theme survives any mt_settings_v1 reset
        try { localStorage.setItem('mt_theme_pref', val); } catch(e) {}
      });
    });

    // ═══ Two-factor toggle ═══
    qs('#twoFactorToggle').addEventListener('change', function () {
      var state = readStorage();
      state.account.twoFactor = this.checked;
      writeStorage(state);
      showToast(this.checked ? '2FA enabled' : '2FA disabled', 'info');
    });

    // ═══ Notification toggles – auto-save + request permission ═══
    ['#notifExpense', '#notifMonthly', '#notifFamily', '#notifWallet', '#notifWeekly'].forEach(function(sel) {
      var el = qs(sel);
      if (el) el.addEventListener('change', function () {
        var state = collectFromUI();
        writeStorage(state);
        // Request native permission when any notification is turned on
        if (this.checked && typeof onNotifToggleEnabled === 'function') {
          onNotifToggleEnabled();
        }
      });
    });

    // ═══ Sound toggle – auto-save ═══
    var soundToggleEl = qs('#soundToggle');
    if (soundToggleEl) {
      soundToggleEl.addEventListener('change', function () {
        var state = collectFromUI();
        writeStorage(state);
      });
    }

    // ═══ Monthly Income – save on change ═══
    var incomeEl = qs('#monthlyIncomeInput');
    if (incomeEl) {
      incomeEl.addEventListener('change', function () {
        var newIncome = parseFloat(incomeEl.value) || 0;
        if (newIncome < 0) { incomeEl.value = 0; newIncome = 0; }
        // Update expenseTrackerData
        try {
          var raw = localStorage.getItem('expenseTrackerData');
          var data = raw ? JSON.parse(raw) : {};
          data.income = newIncome;
          localStorage.setItem('expenseTrackerData', JSON.stringify(data));
        } catch(e) { /* */ }
        // Update server
        var token = getToken();
        if (token && !isLocal(token)) {
          fetch(API_BASE + '/me/finances', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ monthlyIncome: newIncome })
          }).catch(function() {});
        }
        // Save settings
        var state = collectFromUI();
        writeStorage(state);
        updateSidebarStats();
        showToast('Monthly income updated to ' + newIncome.toLocaleString(), 'success');
      });
    }

    // ═══ Preferences – auto-save on change ═══
    ['#currencySelect', '#dateFormatSelect', '#startMonthSelect', '#languageSelect'].forEach(function(sel) {
      var el = qs(sel);
      if (el) el.addEventListener('change', function () {
        if (sel === '#currencySelect') {
          var oldState = readStorage();
          var oldCurrency = oldState.preferences.currency || 'EUR';
          var newCurrency = el.value;
          if (oldCurrency !== newCurrency) {
            // Convert all monetary data
            convertAppData(oldCurrency, newCurrency);
            // Refresh income input from converted data
            var incomeInp = qs('#monthlyIncomeInput');
            if (incomeInp) {
              try {
                var appRaw2 = localStorage.getItem('expenseTrackerData');
                var appD2 = appRaw2 ? JSON.parse(appRaw2) : null;
                if (appD2 && typeof appD2.income === 'number') incomeInp.value = appD2.income;
              } catch(e) { /* */ }
            }
            // Save the new currency preference
            var state = collectFromUI();
            writeStorage(state);
            // Update sidebar to reflect new values
            updateSidebarStats();
            showToast(oldCurrency + ' → ' + newCurrency + ' (amounts converted)', 'info');
          }
        } else if (sel === '#languageSelect') {
          var state = collectFromUI();
          writeStorage(state);
          // Apply language change across the UI
          if (typeof setLanguage === 'function') {
            setLanguage(el.value);
          }
        } else {
          var state = collectFromUI();
          writeStorage(state);
        }
      });
    });

    // ═══ Active Sessions link ═══
    var activeSessionsLink = document.querySelector('#activeSessionsLink') ||
      document.querySelector('[data-action="active-sessions"]') ||
      document.querySelector('a[href="#active-sessions"]');
    if (activeSessionsLink) {
      activeSessionsLink.addEventListener('click', function(e) {
        e.preventDefault();
        var token = getToken();
        if (!token) return showToast('Not logged in', 'error');
        if (isLocal(token)) return showToast('1 active session (local)', 'info');
        fetch(API_BASE + '/me/sessions', {
          headers: { Authorization: 'Bearer ' + token }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var sessions = data.sessions || data || [];
          var count = Array.isArray(sessions) ? sessions.length : 1;
          showToast('You have ' + count + ' active session(s)', 'info');
        })
        .catch(function() { showToast('1 active session', 'info'); });
      });
    }

    // ═══ Leave Family Budget ═══
    var leaveBtn = qs('#leaveFamilyBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', function () {
        showConfirm(
          'Leave Family Budget?',
          'This will remove all your shared wallets, friends, invites, and split expenses. This cannot be undone.'
        ).then(function(confirmed) {
          if (!confirmed) return;
          var token = getToken();
          if (!token) return showToast('Not logged in', 'error');
          if (isLocal(token)) return showToast('No family budget in local mode', 'info');
          fetch(API_BASE + '/me/leave-family', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token }
          })
          .then(function(res) {
            if (!res.ok) return showToast('Failed to leave family budget', 'error');
            showToast('Left family budget ✓');
          })
          .catch(function() { showToast('Server error', 'error'); });
        });
      });
    }

    // ═══ Delete Account ═══
    var deleteBtn = qs('#deleteAccountBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        showConfirm(
          'Delete Account?',
          'This will permanently delete your account and ALL data (expenses, wallets, friends, etc). This cannot be undone!'
        ).then(function(confirmed) {
          if (!confirmed) return;
          var token = getToken();
          var cleanup = function() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('appData');
            localStorage.removeItem('expenseTrackerData');
            showToast('Account deleted');
            setTimeout(function() { window.location.href = '../shared/index.html'; }, 1500);
          };
          if (token && !isLocal(token)) {
            fetch(API_BASE + '/me', {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + token }
            })
            .then(function(res) {
              if (!res.ok) return showToast('Failed to delete account', 'error');
              cleanup();
            })
            .catch(function() { showToast('Server error', 'error'); });
          } else {
            cleanup();
          }
        });
      });
    }

    // ═══ Sidebar stats ═══
    updateSidebarStats();
  }

  /* ── Sidebar spent/remaining ── */
  function updateSidebarStats() {
    try {
      var raw = localStorage.getItem('expenseTrackerData');
      var appData = raw ? JSON.parse(raw) : null;
      var state = readStorage();
      var sym = currencySymbol[state.preferences.currency] || (' ' + state.preferences.currency);
      if (appData) {
        var now = new Date();
        var m = now.getMonth(), y = now.getFullYear();
        var expenses = appData.expenses || [];
        var monthly = expenses.filter(function(e) {
          var d = new Date(e.date);
          return d.getMonth() === m && d.getFullYear() === y && e.category !== 'savings';
        });
        var spent = monthly.reduce(function(s, e) { return s + (e.amount || 0); }, 0);
        var income = appData.income || 0;
        var remaining = income - spent;
        var spentEl = qs('#sidebarSpent');
        var remEl = qs('#sidebarRemaining');
        if (spentEl) spentEl.textContent = spent.toLocaleString() + sym;
        if (remEl) remEl.textContent = remaining.toLocaleString() + sym;
      }
    } catch (e) { /* */ }
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    var state = readStorage();
    applyToUI(state);
    wire();
    loadProfile();
  });
})();
