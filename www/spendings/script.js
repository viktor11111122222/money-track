// ── Spendings Page ─────────────────────────────────────────────────────────
(function () {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getCurrency() {
    try {
      var s = JSON.parse(localStorage.getItem('mt_settings_v1'));
      var c = s && s.preferences && s.preferences.currency;
      var m = { RSD: ' RSD', USD: ' $', EUR: ' €', GBP: ' £', JPY: ' ¥',
                AUD: ' A$', CAD: ' C$', CNY: ' ¥', INR: ' ₹', BRL: ' R$',
                CHF: ' CHF', SEK: ' kr', NOK: ' kr' };
      return m[c] || ' RSD';
    } catch (e) { return ' RSD'; }
  }

  function getLocale() {
    try {
      var lang = localStorage.getItem('mt_lang') || 'en';
      var map = { en: 'en-US', sr: 'sr-RS', de: 'de-DE', fr: 'fr-FR' };
      return map[lang] || 'en-US';
    } catch (e) { return 'en-US'; }
  }

  function getExpenseData() {
    try {
      var raw = localStorage.getItem('expenseTrackerData');
      if (!raw) return { expenses: [], categories: [], income: 0 };
      var data = JSON.parse(raw);
      return {
        expenses:   Array.isArray(data.expenses)   ? data.expenses   : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        income:     typeof data.income === 'number' ? data.income    : 0
      };
    } catch (e) { return { expenses: [], categories: [], income: 0 }; }
  }

  function toInputDate(date) {
    var yyyy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function parseInputDate(value, endOfDay) {
    if (!value) return null;
    var date = new Date(value);
    if (isNaN(date.getTime())) return null;
    if (endOfDay) { date.setHours(23, 59, 59, 999); } else { date.setHours(0, 0, 0, 0); }
    return date.getTime();
  }

  function tStr(key, fallback) {
    try { return (typeof t === 'function' ? t(key) : null) || fallback; } catch (e) { return fallback; }
  }

  function tCategory(name) {
    try { return (typeof tCat === 'function' ? tCat(name) : null) || name; } catch (e) { return name; }
  }

  // ── Sidebar quick stats ───────────────────────────────────────────────────

  function updateSidebarStats() {
    var data = getExpenseData();
    var CURRENCY = getCurrency();
    var now = new Date();
    var month = now.getMonth(), year = now.getFullYear();
    var monthlyExpenses = data.expenses.filter(function (e) {
      if (e.type === 'income' || e.type === 'savings') return false;
      var d = new Date(e.timestamp || 0);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    var spent = monthlyExpenses.reduce(function (s, e) { return s + (e.amount || 0); }, 0);
    var remaining = (data.income || 0) - spent;
    var spentEl = document.getElementById('sidebarSpent');
    var remEl   = document.getElementById('sidebarRemaining');
    if (spentEl) spentEl.textContent = spent.toLocaleString() + CURRENCY;
    if (remEl)   remEl.textContent   = remaining.toLocaleString() + CURRENCY;
  }

  // ── URL param handling ────────────────────────────────────────────────────

  function readURLParams() {
    var params = new URLSearchParams(window.location.search);
    var fromEl = document.getElementById('spendingsFrom');
    var toEl   = document.getElementById('spendingsTo');
    var catEl  = document.getElementById('spendingsCategory');
    if (fromEl && params.get('from')) fromEl.value = params.get('from');
    if (toEl   && params.get('to'))   toEl.value   = params.get('to');
    if (catEl  && params.get('cat'))  catEl.value  = params.get('cat');
  }

  // ── Filter & render ───────────────────────────────────────────────────────

  function getFiltered() {
    var data = getExpenseData();
    var fromTs = parseInputDate(document.getElementById('spendingsFrom').value, false);
    var toTs   = parseInputDate(document.getElementById('spendingsTo').value, true);
    var cat    = (document.getElementById('spendingsCategory') || {}).value || 'all';
    return data.expenses
      .filter(function (e) { return e.type !== 'income' && e.type !== 'savings'; })
      .filter(function (e) { return fromTs === null || e.timestamp >= fromTs; })
      .filter(function (e) { return toTs   === null || e.timestamp <= toTs;   })
      .filter(function (e) { return cat === 'all' || e.category === cat;      })
      .sort(function (a, b) { return b.timestamp - a.timestamp; });
  }

  function render() {
    var CURRENCY = getCurrency();
    var locale   = getLocale();
    var data     = getExpenseData();

    // Populate category select
    var catEl = document.getElementById('spendingsCategory');
    if (catEl) {
      var current = catEl.value || 'all';
      catEl.innerHTML = ['all'].concat(data.categories).map(function (opt) {
        var label = opt === 'all' ? tStr('dash.all', 'All') : tCategory(opt);
        return '<option value="' + opt + '">' + label + '</option>';
      }).join('');
      catEl.value = current;
    }

    var filtered = getFiltered();

    // Summary
    var countEl = document.getElementById('spendingsCount');
    var totalEl = document.getElementById('spendingsTotal');
    var topEl   = document.getElementById('spendingsTopCategory');
    if (countEl) countEl.textContent = filtered.length.toString();

    var total = filtered.reduce(function (s, e) { return s + (e.amount || 0); }, 0);
    if (totalEl) totalEl.textContent = total.toLocaleString() + CURRENCY;

    var catTotals = {};
    filtered.forEach(function (e) {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });
    var entries = Object.keys(catTotals)
      .map(function (k) { return [k, catTotals[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var top = entries[0];
    if (topEl) {
      topEl.textContent = top
        ? tCategory(top[0]) + ' · ' + top[1].toLocaleString() + CURRENCY
        : '—';
    }

    // Categories
    var catsEl = document.getElementById('spendingsCategories');
    if (catsEl) {
      catsEl.innerHTML = entries.length === 0
        ? '<div class="spendings-empty">' + tStr('js.noDataForFilters', 'No data for selected filters') + '</div>'
        : entries.map(function (e) {
            return '<div class="spendings-category-item">' +
              '<span class="spendings-category-name">' + tCategory(e[0]) + '</span>' +
              '<span class="spendings-category-amount">-' + e[1].toLocaleString() + CURRENCY + '</span>' +
              '</div>';
          }).join('');
    }

    // Transactions
    var txsEl = document.getElementById('spendingsTransactions');
    if (txsEl) {
      txsEl.innerHTML = filtered.length === 0
        ? '<li class="spendings-empty">' + tStr('js.noTxForFilters', 'No transactions for selected filters') + '</li>'
        : filtered.map(function (exp) {
            var date = exp.date || new Date(exp.timestamp).toLocaleDateString(locale);
            var time = exp.time || new Date(exp.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            return '<li class="spendings-transaction-item">' +
              '<div class="spendings-transaction-meta">' +
              '<span class="spendings-transaction-title">' + tCategory(exp.category) + '</span>' +
              '<span class="spendings-transaction-sub">' + date + ' · ' + time + '</span>' +
              '</div>' +
              '<span class="spendings-transaction-amount">-' + (exp.amount || 0).toLocaleString() + CURRENCY + '</span>' +
              '</li>';
          }).join('');
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    readURLParams();
    render();
    updateSidebarStats();

    ['spendingsFrom', 'spendingsTo', 'spendingsCategory'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input',  render);
      el.addEventListener('change', render);
    });
  }

  // Wait for i18n to be ready before first render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
