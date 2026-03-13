/**
 * Shared Spendings Modal
 * Self-contained: injects CSS + HTML, reads localStorage, exposes window.openSpendingsModal()
 */
(function () {

  // ── Inject CSS ────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('spendings-modal-css')) return;
    var style = document.createElement('style');
    style.id = 'spendings-modal-css';
    style.textContent = [
      '.modal-overlay{position:fixed;inset:0;background:rgba(15,23,36,.65);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;z-index:9999;padding:24px}',
      '.modal-overlay.active{display:flex;animation:smOverlayIn .25s ease both}',
      '.modal-overlay.closing{display:flex;animation:smOverlayOut .22s ease both}',
      '.modal-overlay.active .modal-content{animation:smModalIn .28s ease both}',
      '.modal-overlay.closing .modal-content{animation:smModalOut .22s ease both}',
      '@keyframes smOverlayIn{from{opacity:0}to{opacity:1}}',
      '@keyframes smOverlayOut{from{opacity:1}to{opacity:0}}',
      '@keyframes smModalIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes smModalOut{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-12px) scale(.98)}}',
      '#sharedSpendingsModal .modal-content{width:min(1100px,92vw);max-height:88vh;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(15,23,36,.35);padding:22px 24px 24px;overflow:auto;display:flex;flex-direction:column}',
      '#sharedSpendingsModal .modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #eef2f7;padding-bottom:12px;margin-bottom:16px;flex-shrink:0}',
      '#sharedSpendingsModal .modal-header h2{margin:0;font-size:1.4rem;color:#0f1724}',
      '#sharedSpendingsModal .modal-close{border:none;background:#f1f5f9;color:#0f1724;font-size:1rem;width:36px;height:36px;border-radius:10px;cursor:pointer;transition:background .2s}',
      '#sharedSpendingsModal .modal-close:hover{background:#e2e8f0}',
      '#sharedSpendingsModal .modal-body{color:#475569;font-size:.95rem;overflow:auto;flex:1}',
      '#sharedSpendingsModal .spendings-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}',
      '#sharedSpendingsModal .summary-box{background:#f8fafc;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}',
      '#sharedSpendingsModal .summary-box span{font-size:12px;color:#64748b;font-weight:600}',
      '#sharedSpendingsModal .summary-box strong{font-size:1rem;color:#0f1724}',
      '#sharedSpendingsModal .spendings-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}',
      '#sharedSpendingsModal .filter-group{display:flex;flex-direction:column;gap:6px}',
      '#sharedSpendingsModal .filter-group label{font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px}',
      '#sharedSpendingsModal .filter-group input,#sharedSpendingsModal .filter-group select{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;background:#f8fafc;color:#0f1724}',
      '#sharedSpendingsModal .spendings-content{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}',
      '#sharedSpendingsModal .spendings-card{border:1px solid #eef2f7;border-radius:12px;padding:14px;background:#fff}',
      '#sharedSpendingsModal .spendings-card h3{margin:0 0 12px;font-size:1rem;color:#0f1724}',
      '#sharedSpendingsModal .spendings-categories{display:flex;flex-direction:column;gap:8px}',
      '#sharedSpendingsModal .spendings-category-item{display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 12px;border-radius:10px;font-size:13px}',
      '#sharedSpendingsModal .spendings-category-name{font-weight:600;color:#0f1724}',
      '#sharedSpendingsModal .spendings-category-amount{font-weight:600;color:#ef4444}',
      '#sharedSpendingsModal .spendings-transactions{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;max-height:40vh;overflow:auto}',
      '#sharedSpendingsModal .spendings-transaction-item{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 12px;border-radius:10px;background:#f8fafc;font-size:13px}',
      '#sharedSpendingsModal .spendings-transaction-meta{display:flex;flex-direction:column;gap:4px}',
      '#sharedSpendingsModal .spendings-transaction-title{font-weight:600;color:#0f1724}',
      '#sharedSpendingsModal .spendings-transaction-sub{color:#64748b;font-size:12px}',
      '#sharedSpendingsModal .spendings-transaction-amount{font-weight:700;color:#ef4444}',
      '#sharedSpendingsModal .spendings-empty{padding:12px;border-radius:10px;background:#f8fafc;color:#94a3b8;font-style:italic}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getCurrency() {
    try {
      var s = JSON.parse(localStorage.getItem('mt_settings_v1'));
      var c = s && s.preferences && s.preferences.currency;
      var m = { RSD: ' RSD', USD: ' $', EUR: ' €', GBP: ' £', JPY: ' ¥', AUD: ' A$', CAD: ' C$', CNY: ' ¥', INR: ' ₹', BRL: ' R$', CHF: ' CHF', SEK: ' kr', NOK: ' kr' };
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

  function getExpenses() {
    try {
      var raw = localStorage.getItem('expenseTrackerData');
      if (!raw) return { expenses: [], categories: [] };
      var data = JSON.parse(raw);
      return {
        expenses: Array.isArray(data.expenses) ? data.expenses : [],
        categories: Array.isArray(data.categories) ? data.categories : []
      };
    } catch (e) { return { expenses: [], categories: [] }; }
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

  // ── Inject modal HTML ─────────────────────────────────────────────────────

  var MODAL_ID = 'sharedSpendingsModal';

  function injectModal() {
    if (document.getElementById(MODAL_ID)) return;
    var el = document.createElement('div');
    el.id = MODAL_ID;
    el.className = 'modal-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = [
      '<div class="modal-content" role="document">',
      '  <div class="modal-header">',
      '    <h2>Spendings</h2>',
      '    <button class="modal-close" id="sharedSpendingsClose" aria-label="Close">\u2715</button>',
      '  </div>',
      '  <div class="modal-body">',
      '    <div class="spendings-summary">',
      '      <div class="summary-box"><span>Total</span><strong id="ssTotal">0</strong></div>',
      '      <div class="summary-box"><span>Top Category</span><strong id="ssTopCat">\u2014</strong></div>',
      '      <div class="summary-box"><span>Transactions</span><strong id="ssCount">0</strong></div>',
      '    </div>',
      '    <div class="spendings-filters">',
      '      <div class="filter-group"><label>From</label><input type="date" id="ssFrom"></div>',
      '      <div class="filter-group"><label>To</label><input type="date" id="ssTo"></div>',
      '      <div class="filter-group"><label>Category</label><select id="ssCat"><option value="all">All</option></select></div>',
      '    </div>',
      '    <div class="spendings-content">',
      '      <section class="spendings-card"><h3>Categories</h3><div class="spendings-categories" id="ssCats"></div></section>',
      '      <section class="spendings-card"><h3>Latest Transactions</h3><ul class="spendings-transactions" id="ssTxs"></ul></section>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(el);

    document.getElementById('sharedSpendingsClose').addEventListener('click', closeModal);
    el.addEventListener('click', function (e) {
      if (e.target === el) closeModal();
    });
    ['ssFrom', 'ssTo', 'ssCat'].forEach(function (id) {
      var inp = document.getElementById(id);
      if (inp) { inp.addEventListener('input', renderModal); inp.addEventListener('change', renderModal); }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function getFiltered() {
    var data = getExpenses();
    var fromTs = parseInputDate(document.getElementById('ssFrom').value, false);
    var toTs = parseInputDate(document.getElementById('ssTo').value, true);
    var cat = (document.getElementById('ssCat') || {}).value || 'all';
    return data.expenses
      .filter(function (e) { return e.type !== 'income' && e.type !== 'savings'; })
      .filter(function (e) { return fromTs === null || e.timestamp >= fromTs; })
      .filter(function (e) { return toTs === null || e.timestamp <= toTs; })
      .filter(function (e) { return cat === 'all' || e.category === cat; })
      .sort(function (a, b) { return b.timestamp - a.timestamp; });
  }

  function renderModal() {
    var CURRENCY = getCurrency();
    var locale = getLocale();
    var data = getExpenses();

    var catEl = document.getElementById('ssCat');
    if (catEl) {
      var current = catEl.value || 'all';
      catEl.innerHTML = ['all'].concat(data.categories).map(function (opt) {
        return '<option value="' + opt + '">' + (opt === 'all' ? 'All' : opt) + '</option>';
      }).join('');
      catEl.value = current;
    }

    var filtered = getFiltered();
    var countEl = document.getElementById('ssCount');
    var totalEl = document.getElementById('ssTotal');
    var topEl = document.getElementById('ssTopCat');
    var catsEl = document.getElementById('ssCats');
    var txsEl = document.getElementById('ssTxs');

    if (countEl) countEl.textContent = filtered.length.toString();

    var total = filtered.reduce(function (s, e) { return s + e.amount; }, 0);
    if (totalEl) totalEl.textContent = total.toLocaleString() + CURRENCY;

    var catTotals = {};
    filtered.forEach(function (e) { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    var entries = Object.keys(catTotals).map(function (k) { return [k, catTotals[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var top = entries[0];
    if (topEl) topEl.textContent = top ? top[0] + ' \u00b7 ' + top[1].toLocaleString() + CURRENCY : '\u2014';

    if (catsEl) {
      catsEl.innerHTML = entries.length === 0
        ? '<div class="spendings-empty">No data for selected filters</div>'
        : entries.map(function (e) {
            return '<div class="spendings-category-item"><span class="spendings-category-name">' + e[0] + '</span><span class="spendings-category-amount">-' + e[1].toLocaleString() + CURRENCY + '</span></div>';
          }).join('');
    }

    if (txsEl) {
      txsEl.innerHTML = filtered.length === 0
        ? '<li class="spendings-empty">No transactions for selected filters</li>'
        : filtered.map(function (exp) {
            var date = exp.date || new Date(exp.timestamp).toLocaleDateString(locale);
            var time = exp.time || new Date(exp.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            return '<li class="spendings-transaction-item"><div class="spendings-transaction-meta"><span class="spendings-transaction-title">' + exp.category + '</span><span class="spendings-transaction-sub">' + date + ' \u00b7 ' + time + '</span></div><span class="spendings-transaction-amount">-' + exp.amount.toLocaleString() + CURRENCY + '</span></li>';
          }).join('');
    }
  }

  // ── Open / Close ──────────────────────────────────────────────────────────

  function openModal(opts) {
    injectCSS();
    injectModal();
    var modal = document.getElementById(MODAL_ID);
    if (opts && opts.from) document.getElementById('ssFrom').value = opts.from;
    if (opts && opts.to) document.getElementById('ssTo').value = opts.to;
    if (opts && opts.category) document.getElementById('ssCat').value = opts.category;
    modal.classList.remove('closing');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderModal();
  }

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal || !modal.classList.contains('active')) return;
    modal.classList.add('closing');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    function finishClose() {
      modal.classList.remove('active', 'closing');
      modal.removeEventListener('animationend', finishClose);
    }
    modal.addEventListener('animationend', finishClose);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.openSpendingsModal = openModal;
  window.closeSpendingsModal = closeModal;

})();
