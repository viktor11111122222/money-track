// settings.js – fully functional settings page
(function () {
  const STORAGE_KEY = 'mt_settings_v1';
  const API_BASE = (window.location.port === '5500' || window.location.port === '5501') ? 'http://localhost:8080/api' : '/api';
  const TOKEN_KEY = 'sharedBudgetToken';
  const PIN_KEY = 'mt_app_pin';

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

    // Tag data with the new currency so dashboard knows which currency amounts are in
    data._currency = newCurrency;
    localStorage.setItem('expenseTrackerData', JSON.stringify(data));

    // Mark conversion timestamp so dashboard doesn't overwrite with stale server data
    try { localStorage.setItem('mt_currency_converted_at', String(Date.now())); } catch(e) {}

    // Convert local splits (LOCAL_AUTH_MODE)
    var LOCAL_SPLITS_KEY = 'mt_local_splits';
    try {
      var rawSplits = localStorage.getItem(LOCAL_SPLITS_KEY);
      if (rawSplits) {
        var splits = JSON.parse(rawSplits);
        splits.forEach(function(s) {
          if (typeof s.amount === 'number') s.amount = convertAmount(s.amount, oldCurrency, newCurrency);
          if (typeof s.monthly_amount === 'number') s.monthly_amount = convertAmount(s.monthly_amount, oldCurrency, newCurrency);
          if (s.memberAmounts && typeof s.memberAmounts === 'object') {
            Object.keys(s.memberAmounts).forEach(function(k) {
              if (typeof s.memberAmounts[k] === 'number') {
                s.memberAmounts[k] = convertAmount(s.memberAmounts[k], oldCurrency, newCurrency);
              }
            });
          }
        });
        localStorage.setItem(LOCAL_SPLITS_KEY, JSON.stringify(splits));
      }
    } catch(e) { /* */ }

    // Server-side: income/balance + wallets + splits + friend limits
    var token = getToken();
    if (token && !isLocal(token)) {
      fetch(API_BASE + '/me/finances', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          monthlyIncome: data.income,
          currentBalance: data.currentBalance
        })
      }).catch(function() { /* */ });

      fetch(API_BASE + '/convert-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ oldCurrency: oldCurrency, newCurrency: newCurrency })
      }).catch(function() { /* */ });
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
      overlay.style.alignItems = 'flex-start';
      overlay.style.justifyContent = 'center';
      overlay.style.paddingTop = 'max(calc(env(safe-area-inset-top,20px) + 62px),90px)';
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
      card.style.position = 'relative';
      card.innerHTML =
        '<button id="_confirmClose" style="position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,0.06);color:inherit;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark"></i></button>' +
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
      overlay.querySelector('#_confirmClose').onclick = function() { overlay.remove(); resolve(false); };
      overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  }

  /* ── PIN lock helpers ── */
  function hashPin(pin) {
    var s = 'mt2fa9x';
    var r = '';
    for (var i = 0; i < pin.length; i++) r += String.fromCharCode(pin.charCodeAt(i) ^ s.charCodeAt(i % s.length));
    return btoa(r);
  }
  function getStoredPin() { return localStorage.getItem(PIN_KEY); }

  function showPinModal(mode, onSuccess, onCancel) {
    var isDark = document.documentElement.classList.contains('dark-theme');
    var bg = isDark ? '#141828' : '#fff';
    var textColor = isDark ? '#e6eefc' : '#0f1724';
    var mutedColor = isDark ? '#9aa6b2' : '#64748b';
    var keyBg = isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.09)';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';

    var titleText = mode === 'set' ? 'Set App PIN' : mode === 'confirm-disable' ? 'Confirm PIN to Disable' : 'Enter Your PIN';
    var subtitleText = mode === 'set' ? 'Choose a 4-digit PIN to protect your settings' : 'Enter your 4-digit PIN to continue';

    overlay.innerHTML =
      '<div style="background:' + bg + ';border-radius:22px;padding:32px 24px 24px;max-width:320px;width:88%;box-shadow:0 24px 64px rgba(0,0,0,0.45);text-align:center;">' +
        '<div style="width:58px;height:58px;background:rgba(99,102,241,0.14);border-radius:16px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;">' +
          '<i class="fa-solid fa-' + (mode === 'set' ? 'lock-open' : 'lock') + '" style="font-size:22px;color:#6366f1;"></i>' +
        '</div>' +
        '<h3 style="margin:0 0 5px;font-size:17px;font-weight:700;color:' + textColor + ';">' + titleText + '</h3>' +
        '<p style="margin:0 0 22px;font-size:13px;color:' + mutedColor + ';">' + subtitleText + '</p>' +
        '<div id="_pinDots" style="display:flex;justify-content:center;gap:14px;margin-bottom:22px;">' +
          '<div style="width:14px;height:14px;border-radius:50%;border:2px solid #6366f1;transition:background .12s;"></div>' +
          '<div style="width:14px;height:14px;border-radius:50%;border:2px solid #6366f1;transition:background .12s;"></div>' +
          '<div style="width:14px;height:14px;border-radius:50%;border:2px solid #6366f1;transition:background .12s;"></div>' +
          '<div style="width:14px;height:14px;border-radius:50%;border:2px solid #6366f1;transition:background .12s;"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:220px;margin:0 auto;">' +
          [1,2,3,4,5,6,7,8,9,'','0','⌫'].map(function(k) {
            if (k === '') return '<div></div>';
            return '<button class="_pinKey" data-key="' + k + '" style="padding:15px 0;border:none;border-radius:12px;background:' + keyBg + ';color:' + textColor + ';font-size:17px;font-weight:700;cursor:pointer;transition:background .12s;-webkit-tap-highlight-color:transparent;">' + k + '</button>';
          }).join('') +
        '</div>' +
        (mode !== 'set' ? '<button id="_pinCancel" style="margin-top:14px;background:none;border:none;color:' + mutedColor + ';font-size:13px;cursor:pointer;padding:8px 16px;">Cancel</button>' : '') +
      '</div>';

    document.body.appendChild(overlay);

    var enteredPin = '';
    var dots = overlay.querySelectorAll('#_pinDots div');

    function updateDots(errorColor) {
      dots.forEach(function(d, i) {
        d.style.background = errorColor ? errorColor : (i < enteredPin.length ? '#6366f1' : 'transparent');
      });
    }

    overlay.querySelectorAll('._pinKey').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = this.dataset.key;
        if (key === '⌫') { enteredPin = enteredPin.slice(0, -1); updateDots(); return; }
        if (enteredPin.length >= 4) return;
        enteredPin += key;
        updateDots();
        if (enteredPin.length < 4) return;
        setTimeout(function() {
          if (mode === 'set') {
            localStorage.setItem(PIN_KEY, hashPin(enteredPin));
            sessionStorage.setItem('mt_pin_ok', '1');
            overlay.remove();
            if (onSuccess) onSuccess();
          } else {
            if (getStoredPin() === hashPin(enteredPin)) {
              sessionStorage.setItem('mt_pin_ok', '1');
              overlay.remove();
              if (onSuccess) onSuccess();
            } else {
              updateDots('#ef4444');
              setTimeout(function() { enteredPin = ''; updateDots(); }, 500);
              showToast('Wrong PIN', 'error');
            }
          }
        }, 80);
      });
      btn.addEventListener('mouseenter', function() { this.style.background = 'rgba(99,102,241,0.22)'; });
      btn.addEventListener('mouseleave', function() { this.style.background = keyBg; });
    });

    var cancelBtn = overlay.querySelector('#_pinCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { overlay.remove(); if (onCancel) onCancel(); });
  }

  function checkPinLock() {
    var state = readStorage();
    if (state.account.twoFactor && getStoredPin() && !sessionStorage.getItem('mt_pin_ok')) {
      showPinModal('verify', null, function() {
        // User cancelled on page load — redirect away (can't bypass settings)
        window.location.href = '/dashboard/index.html';
      });
    }
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
        // Only fill in form fields that are currently empty — never overwrite
        // data the user has already explicitly saved (localStorage is source of truth)
        var nameInp = qs('#fullNameInput');
        var emailInp = qs('#emailInput');
        var userInp = qs('#usernameInput');
        if (nameInp && !nameInp.value && user.name) nameInp.value = user.name;
        if (emailInp && !emailInp.value && user.email) emailInp.value = user.email;
        if (userInp && !userInp.value && user.username) userInp.value = user.username;
        // Avatar is server-managed — always update
        if (user.avatar) {
          var img = qs('#profileAvatarImg');
          if (img) img.src = user.avatar;
          var chipImg = document.querySelector('.account-chip img');
          if (chipImg) chipImg.src = user.avatar;
          var state = readStorage();
          state.profile.avatar = user.avatar;
          writeStorage(state);
        }
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

    // ═══ Two-factor toggle — PIN lock ═══
    qs('#twoFactorToggle').addEventListener('change', function () {
      var state = readStorage();
      var toggle = this;
      if (toggle.checked) {
        // Enabling 2FA: prompt to set a PIN
        showPinModal('set',
          function() {
            state.account.twoFactor = true;
            writeStorage(state);
            showToast('2FA enabled — settings are PIN protected ✓');
          },
          function() {
            // Cancelled: revert toggle
            toggle.checked = false;
          }
        );
      } else {
        // Disabling 2FA: require existing PIN first
        var stored = getStoredPin();
        if (stored) {
          showPinModal('verify',
            function() {
              state.account.twoFactor = false;
              writeStorage(state);
              localStorage.removeItem(PIN_KEY);
              sessionStorage.removeItem('mt_pin_ok');
              showToast('2FA disabled', 'info');
            },
            function() {
              // Cancelled: keep 2FA on
              toggle.checked = true;
            }
          );
        } else {
          state.account.twoFactor = false;
          writeStorage(state);
          showToast('2FA disabled', 'info');
        }
      }
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
            // Notify other open pages (same-tab custom event + cross-tab via storage)
            try { window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { from: oldCurrency, to: newCurrency } })); } catch(e) {}
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

    // ═══ Sign Out ═══
    var signOutBtn = qs('#signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        showConfirm(
          'Sign Out?',
          'You will be signed out of your account. Your local expense data will remain on this device.'
        ).then(function(confirmed) {
          if (!confirmed) return;
          localStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem('mt_pin_ok');
          showToast('Signed out ✓');
          setTimeout(function() { window.location.href = '/shared/index.html'; }, 1200);
        });
      });
    }

    // ═══ Clear Expense History ═══
    var clearExpensesBtn = qs('#clearExpensesBtn');
    if (clearExpensesBtn) {
      clearExpensesBtn.addEventListener('click', function () {
        showConfirm(
          'Clear Expense History?',
          'This will permanently delete all your recorded expenses, income entries, and balance data stored on this device. Your account and settings will not be affected.'
        ).then(function(confirmed) {
          if (!confirmed) return;
          try {
            var blank = { expenses: [], income: 0, currentBalance: 0, savings: 0 };
            localStorage.setItem('expenseTrackerData', JSON.stringify(blank));
          } catch(e) { /* */ }
          showToast('Expense history cleared ✓');
          updateSidebarStats();
        });
      });
    }

    // ═══ Reset Settings to Default ═══
    var resetSettingsBtn = qs('#resetSettingsBtn');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', function () {
        showConfirm(
          'Reset Settings?',
          'This will reset all your preferences (currency, theme, language, notifications, income) to their default values. Your account and expense data will not be affected.'
        ).then(function(confirmed) {
          if (!confirmed) return;
          localStorage.removeItem(STORAGE_KEY);
          showToast('Settings reset to defaults ✓');
          setTimeout(function() { window.location.reload(); }, 1200);
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
    checkPinLock();
  });
})();
