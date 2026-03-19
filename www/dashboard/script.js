// ===== DATA MANAGEMENT =====
(function () {
// === DEBUG: captures JS execution state — remove after diagnosis ===
try {
  var _dbg = document.getElementById('__js_debug');
  if (_dbg) { _dbg.textContent = 'JS:init'; _dbg.style.background = '#f59e0b'; }
  window.addEventListener('error', function(e) {
    var d = document.getElementById('__js_debug');
    if (d) { d.style.background = '#ef4444'; d.textContent = 'ERR:' + (e && e.message ? e.message.slice(0,25) : '?'); }
  });
} catch(_) {}
// === END DEBUG ===
const DEFAULT_MONTHLY_INCOME = 100000;
function getCurrency(){ try { var s = JSON.parse(localStorage.getItem('mt_settings_v1')); var c = s && s.preferences && s.preferences.currency; var m = { RSD:' RSD', USD:' $', EUR:' €', GBP:' £', JPY:' ¥', AUD:' A$', CAD:' C$', CNY:' ¥', INR:' ₹', BRL:' R$', CHF:' CHF', SEK:' kr', NOK:' kr' }; return m[c] || ' €'; } catch(e){ return ' €'; } }
const CURRENCY = getCurrency();
const API_BASE = window.__API_BASE__ || ((window.location.port === '5500' || window.location.port === '5501') ? 'http://localhost:8080/api' : '/api');
const TOKEN_KEY = 'sharedBudgetToken';
const WALLET_SYNC_QUEUE_KEY = 'walletSyncQueue';
const WALLET_SYNCED_KEY = 'walletSyncedExpenseIds';

let cachedFriendLimit = null;
let friendLimitLoaded = false;
let cachedWalletUser = null;

async function getFriendLimit() {
  if (friendLimitLoaded) return cachedFriendLimit;
  friendLimitLoaded = true;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/friend-limit`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => ({}));
    cachedFriendLimit = typeof payload.limitAmount === 'number' ? payload.limitAmount : null;
    return cachedFriendLimit;
  } catch {
    return null;
  }
}

async function getWalletUser() {
  if (cachedWalletUser) return cachedWalletUser;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    cachedWalletUser = await res.json().catch(() => null);
    return cachedWalletUser;
  } catch {
    return null;
  }
}

function getWalletSyncQueue() {
  try {
    const raw = localStorage.getItem(WALLET_SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWalletSyncQueue(queue) {
  localStorage.setItem(WALLET_SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function enqueueWalletSync(payload) {
  const queue = getWalletSyncQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    ...payload
  });
  saveWalletSyncQueue(queue);
}

function getWalletSyncedIds() {
  try {
    const raw = localStorage.getItem(WALLET_SYNCED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveWalletSyncedIds(ids) {
  localStorage.setItem(WALLET_SYNCED_KEY, JSON.stringify(Array.from(ids)));
}

function markWalletSynced(expenseId) {
  if (!expenseId) return;
  const ids = getWalletSyncedIds();
  ids.add(expenseId);
  saveWalletSyncedIds(ids);
}

async function syncWalletTransaction({ amount, category, note, expenseId }, options = {}) {
  const { skipQueue = false } = options;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    if (!skipQueue) enqueueWalletSync({ amount, category, note, expenseId });
    return false;
  }
  const user = await getWalletUser();
  if (!user) {
    if (!skipQueue) enqueueWalletSync({ amount, category, note, expenseId });
    return false;
  }
  let wallets = [];
  try {
    const res = await fetch(`${API_BASE}/wallets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('wallets');
    wallets = await res.json();
  } catch {
    if (!skipQueue) enqueueWalletSync({ amount, category, note, expenseId });
    return false;
  }
  if (!Array.isArray(wallets) || wallets.length === 0) {
    if (!skipQueue) enqueueWalletSync({ amount, category, note, expenseId });
    return false;
  }

  const member = user.name || user.email || 'You';
  const body = JSON.stringify({ member, amount, category, note });
  const results = await Promise.all(wallets.map(wallet =>
    fetch(`${API_BASE}/wallets/${wallet.id}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body
    }).then(res => res.ok).catch(() => false)
  ));
  const ok = results.every(Boolean);
  if (!ok && !skipQueue) {
    enqueueWalletSync({ amount, category, note, expenseId });
    return false;
  }
  if (ok) markWalletSynced(expenseId);
  localStorage.setItem('walletSyncStamp', String(Date.now()));
  return true;
}

async function flushWalletSyncQueue() {
  const queue = getWalletSyncQueue();
  if (queue.length === 0) return;
  const remaining = [];
  for (const item of queue) {
    const ok = await syncWalletTransaction(item, { skipQueue: true });
    if (!ok) remaining.push(item);
  }
  saveWalletSyncQueue(remaining);
}

function enqueueMissingWalletSync() {
  const queue = getWalletSyncQueue();
  const queuedIds = new Set(queue.map(item => item.expenseId).filter(Boolean));
  const syncedIds = getWalletSyncedIds();
  appData.expenses.forEach(exp => {
    if (exp.type === 'income') return;
    if (!exp.id) return;
    if (syncedIds.has(exp.id) || queuedIds.has(exp.id)) return;
    const note = Array.isArray(exp.tags) ? exp.tags.join(', ') : (exp.note || '');
    enqueueWalletSync({
      amount: exp.amount,
      category: exp.category || (exp.type === 'savings' ? 'Savings' : 'Expense'),
      note,
      expenseId: exp.id
    });
  });
}

function isExpenseInCurrentMonth(exp) {
  const now = new Date();
  const dateValue = exp.timestamp ? new Date(exp.timestamp) : (exp.date ? new Date(exp.date) : null);
  if (!dateValue || Number.isNaN(dateValue.getTime())) return true;
  return dateValue.getFullYear() === now.getFullYear() && dateValue.getMonth() === now.getMonth();
}

function getCurrentMonthSpent() {
  return appData.expenses.reduce((sum, exp) => {
    if (exp.type === 'income' || exp.type === 'savings') return sum;
    if (!isExpenseInCurrentMonth(exp)) return sum;
    return sum + exp.amount;
  }, 0);
}

function getCurrentMonthSavings() {
  return appData.expenses.reduce((sum, exp) => {
    if (exp.type !== 'savings') return sum;
    if (!isExpenseInCurrentMonth(exp)) return sum;
    return sum + exp.amount;
  }, 0);
}

// Initialize or get data from localStorage
function initializeData() {
  let data = localStorage.getItem('expenseTrackerData');
  if (!data) {
    data = {
      income: DEFAULT_MONTHLY_INCOME,
      currentBalance: 0,
      expenses: [],
      categories: ["Food", "Transport", "Rent", "Entertainment"],
      categoryLimits: {},
      categoryColors: {},
      savingsTotal: 0,
      recurringExpenses: [],
      lastMonthCheck: new Date().getMonth(),
      lastPayDayMonth: '',
      _cleared: true
    };
    localStorage.setItem('expenseTrackerData', JSON.stringify(data));
  } else {
    try { data = JSON.parse(data); } catch(e) {
      // Corrupt localStorage data — reset to clean state
      data = { income: DEFAULT_MONTHLY_INCOME, currentBalance: 0, expenses: [], categories: ["Food", "Transport", "Rent", "Entertainment"], categoryLimits: {}, categoryColors: {}, savingsTotal: 0, recurringExpenses: [], lastMonthCheck: new Date().getMonth(), lastPayDayMonth: '', _cleared: true };
      localStorage.setItem('expenseTrackerData', JSON.stringify(data));
      return data;
    }
    // Clear old expenses only once
    if (!data._cleared) {
      data.expenses = [];
      data._cleared = true;
      localStorage.setItem('expenseTrackerData', JSON.stringify(data));
    }
    // Add currentBalance if it doesn't exist
    if (data.currentBalance === undefined) {
      data.currentBalance = 0;
    }
    // Add categoryLimits if it doesn't exist (for existing data)
    if (!data.categoryLimits) {
      data.categoryLimits = {};
    }
    if (!data.categoryColors) {
      data.categoryColors = {};
    }
    if (typeof data.savingsTotal !== 'number') {
      data.savingsTotal = 0;
    }
    if (!Array.isArray(data.recurringExpenses)) {
      data.recurringExpenses = [];
    }
    if (typeof data.lastMonthCheck !== 'number') {
      data.lastMonthCheck = new Date().getMonth();
    }
  }
  return data;
}

let appData = initializeData();

// Save data to localStorage
function saveData() {
  localStorage.setItem('expenseTrackerData', JSON.stringify(appData));
}

// Reset all data
function resetAllData() {
  const overlay = document.getElementById('resetConfirmOverlay');
  if (!overlay) {
    // Fallback if overlay not found
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/onboarding/index.html';
    return;
  }
  overlay.style.display = 'flex';
}

function _doReset() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/onboarding/index.html';
}

// Wire up reset confirm overlay buttons
(function() {
  const overlay = document.getElementById('resetConfirmOverlay');
  const confirmBtn = document.getElementById('resetConfirmBtn');
  const cancelBtn = document.getElementById('resetCancelBtn');
  if (overlay && confirmBtn) {
    confirmBtn.addEventListener('click', _doReset);
  }
  if (overlay && cancelBtn) {
    cancelBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }
})();

// ===== CALCULATIONS =====
function getTotalSpent() {
  return appData.expenses.reduce((sum, exp) => {
    if (exp.type === 'income' || exp.type === 'savings') return sum;
    return sum + exp.amount;
  }, 0);
}

function getSavings() {
  // Balance = Current Balance - Total Spent this month + Savings
  const totalSpent = getTotalSpent();
  if (appData.currentBalance !== undefined) {
    return appData.currentBalance - totalSpent + (appData.savingsTotal || 0);
  }
  // Fallback za stare podatke
  return appData.income - totalSpent + (appData.savingsTotal || 0);
}

function getSpendingByCategory() {
  const categorySpending = {};
  appData.expenses.forEach(exp => {
    if (exp.type === 'income' || exp.type === 'savings') return;
    if (!isExpenseInCurrentMonth(exp)) return;
    if (!categorySpending[exp.category]) {
      categorySpending[exp.category] = 0;
    }
    categorySpending[exp.category] += exp.amount;
  });
  return categorySpending;
}

// ===== DOM ELEMENTS =====
const btn = document.getElementById("dropdownBtn");
const menu = document.getElementById("dropdownMenu");
const arrow = document.getElementById("arrow");
const selected = document.getElementById("selectedCategory");
const amountInput = document.querySelector('.form-row input[type="number"]');
const addExpenseBtn = document.querySelector('.primary');
const resetBtn = document.getElementById("resetBtn");
const spendingsBtn = document.getElementById('spendingsBtn');
const spendingsModal = document.getElementById('spendingsModal');
const spendingsClose = document.getElementById('spendingsClose');
const spendingsFrom = document.getElementById('spendingsFrom');
const spendingsTo = document.getElementById('spendingsTo');
const spendingsCategory = document.getElementById('spendingsCategory');
const spendingsCategories = document.getElementById('spendingsCategories');
const spendingsTransactions = document.getElementById('spendingsTransactions');
const spendingsTotal = document.getElementById('spendingsTotal');
const spendingsTopCategory = document.getElementById('spendingsTopCategory');
const spendingsCount = document.getElementById('spendingsCount');
const openMonthSpendings = document.getElementById('openMonthSpendings');
const calendarDateLabel = document.getElementById('calendarDateLabel');

// Calendar navigation state
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();

function toInputDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseInputDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}

function getFilteredSpendings() {
  const fromTs = parseInputDate(spendingsFrom?.value, false);
  const toTs = parseInputDate(spendingsTo?.value, true);
  const category = spendingsCategory?.value || 'all';

  return appData.expenses
    .filter(exp => exp.type !== 'income' && exp.type !== 'savings')
    .filter(exp => (fromTs === null || exp.timestamp >= fromTs))
    .filter(exp => (toTs === null || exp.timestamp <= toTs))
    .filter(exp => (category === 'all' || exp.category === category))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function renderSpendingsSummary(expenses) {
  if (spendingsCount) spendingsCount.textContent = expenses.length.toString();

  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  if (spendingsTotal) {
    spendingsTotal.textContent = `${total.toLocaleString()}${CURRENCY}`;
  }

  const categoryTotals = {};
  expenses.forEach(exp => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
  });
  const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  if (spendingsTopCategory) {
    const topCatName = top ? (typeof tCat === 'function' ? tCat(top[0]) : top[0]) : null;
    spendingsTopCategory.textContent = top ? `${topCatName} · ${top[1].toLocaleString()}${CURRENCY}` : '—';
  }
}

function renderSpendingsCategories(expenses) {
  if (!spendingsCategories) return;
  const totals = {};
  expenses.forEach(exp => {
    totals[exp.category] = (totals[exp.category] || 0) + exp.amount;
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    spendingsCategories.innerHTML = '<div class="spendings-empty">' + t('js.noDataForFilters') + '</div>';
    return;
  }
  spendingsCategories.innerHTML = entries.map(([name, amount]) => {
    const displayName = typeof tCat === 'function' ? tCat(name) : name;
    return `
      <div class="spendings-category-item">
        <span class="spendings-category-name">${displayName}</span>
        <span class="spendings-category-amount">-${amount.toLocaleString()}${CURRENCY}</span>
      </div>
    `;
  }).join('');
}

function renderSpendingsTransactions(expenses) {
  if (!spendingsTransactions) return;
  if (expenses.length === 0) {
    spendingsTransactions.innerHTML = '<li class="spendings-empty">' + t('js.noTxForFilters') + '</li>';
    return;
  }
  spendingsTransactions.innerHTML = expenses.map(exp => {
    const date = exp.date || new Date(exp.timestamp).toLocaleDateString(getLocale());
    const time = exp.time || new Date(exp.timestamp).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
    return `
      <li class="spendings-transaction-item">
        <div class="spendings-transaction-meta">
          <span class="spendings-transaction-title">${typeof tCat === 'function' ? tCat(exp.category) : exp.category}</span>
          <span class="spendings-transaction-sub">${date} · ${time}</span>
        </div>
        <span class="spendings-transaction-amount">-${exp.amount.toLocaleString()}${CURRENCY}</span>
      </li>
    `;
  }).join('');
}

function renderSpendingsModal() {
  if (spendingsCategory) {
    const current = spendingsCategory.value || 'all';
    const options = ['all', ...appData.categories];
    spendingsCategory.innerHTML = options.map(opt => {
      const label = opt === 'all' ? (typeof t === 'function' ? t('dash.all') : 'All') : (typeof tCat === 'function' ? tCat(opt) : opt);
      return `<option value="${opt}">${label}</option>`;
    }).join('');
    spendingsCategory.value = current;
  }

  const filtered = getFilteredSpendings();
  renderSpendingsSummary(filtered);
  renderSpendingsCategories(filtered);
  renderSpendingsTransactions(filtered);
}

function openSpendingsModal() {
  if (!spendingsModal) return;
  spendingsModal.classList.remove('closing');
  spendingsModal.classList.add('active');
  spendingsModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  renderSpendingsModal();
}

function openSpendingsForDate(year, month, day) {
  if (spendingsFrom && spendingsTo) {
    const dateValue = toInputDate(new Date(year, month, day));
    spendingsFrom.value = dateValue;
    spendingsTo.value = dateValue;
  }
  if (spendingsCategory) {
    spendingsCategory.value = 'all';
  }
  openSpendingsModal();
}

function openSpendingsForMonth(year, month) {
  if (spendingsFrom && spendingsTo) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    spendingsFrom.value = toInputDate(start);
    spendingsTo.value = toInputDate(end);
  }
  if (spendingsCategory) {
    spendingsCategory.value = 'all';
  }
  openSpendingsModal();
}

function closeSpendingsModal() {
  if (!spendingsModal) return;
  if (!spendingsModal.classList.contains('active')) return;
  spendingsModal.classList.add('closing');
  spendingsModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  const finishClose = () => {
    spendingsModal.classList.remove('active');
    spendingsModal.classList.remove('closing');
    spendingsModal.removeEventListener('animationend', finishClose);
  };

  spendingsModal.addEventListener('animationend', finishClose);

  if (window.location.hash === '#spendings') {
    const returnUrl = sessionStorage.getItem('spendingsReturn');
    if (returnUrl) {
      sessionStorage.removeItem('spendingsReturn');
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 150);
    }
  }
}

if (spendingsBtn) {
  spendingsBtn.addEventListener('click', openSpendingsModal);
}

if (spendingsClose) {
  spendingsClose.addEventListener('click', closeSpendingsModal);
}

if (spendingsModal) {
  spendingsModal.addEventListener('click', (e) => {
    if (e.target === spendingsModal) {
      closeSpendingsModal();
    }
  });
}

if (window.location.hash === '#spendings') {
  setTimeout(() => {
    openSpendingsModal();
  }, 0);
}

if (openMonthSpendings) {
  openMonthSpendings.addEventListener('click', () => {
    openSpendingsForMonth(currentCalendarYear, currentCalendarMonth);
  });
}

// Calendar navigation listeners
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const todayBtn = document.getElementById('todayBtn');

if (prevMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
      currentCalendarMonth = 11;
      currentCalendarYear--;
    }
    saveCalendarState();
    updateSpendingCalendar();
    updateTopSpendingDays();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener('click', () => {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
      currentCalendarMonth = 0;
      currentCalendarYear++;
    }
    saveCalendarState();
    updateSpendingCalendar();
    updateTopSpendingDays();
  });
}

if (todayBtn) {
  todayBtn.addEventListener('click', () => {
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    saveCalendarState();
    updateSpendingCalendar();
    updateTopSpendingDays();
  });
}

function saveCalendarState() {
  localStorage.setItem('calendarState', JSON.stringify({
    year: currentCalendarYear,
    month: currentCalendarMonth
  }));
}

function loadCalendarState() {
  try {
    const saved = localStorage.getItem('calendarState');
    if (saved) {
      const state = JSON.parse(saved);
      currentCalendarYear = state.year || new Date().getFullYear();
      currentCalendarMonth = state.month || new Date().getMonth();
    }
  } catch (e) {
    console.error('Error loading calendar state:', e);
  }
}

[spendingsFrom, spendingsTo, spendingsCategory].forEach((el) => {
  if (!el) return;
  el.addEventListener('input', renderSpendingsModal);
  el.addEventListener('change', renderSpendingsModal);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSpendingsModal();
  }
});

// ===== DROPDOWN MENU =====
function renderMenu() {
  menu.innerHTML = '';
  appData.categories.forEach(cat => {
    const d = document.createElement('div');
    d.className = 'option';
    d.dataset.value = cat; // always English for storage
    d.textContent = typeof tCat === 'function' ? tCat(cat) : cat;
    menu.appendChild(d);
  });
  const add = document.createElement('div');
  add.className = 'option add-option';
  add.dataset.add = 'true';
  add.textContent = typeof t === 'function' ? t('dash.addCategory') : '+ Add category';
  menu.appendChild(add);
}

renderMenu();
// Set initial data-value for the default selected category
if (selected && appData.categories.length > 0) {
  selected.dataset.value = appData.categories[0];
}

btn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
  arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
});

menu.addEventListener('click', (e) => {
  // Keep dropdown open when interacting inside it
  e.stopPropagation();
  const opt = e.target.closest('.option');
  if (!opt) return;
  
  if (opt.dataset.add === 'true') {
    showAddForm();
    return;
  }

  selected.textContent = opt.textContent;
  selected.dataset.value = opt.dataset.value || opt.textContent;
  menu.style.display = 'none';
  arrow.style.transform = 'rotate(0deg)';
});

function showAddForm() {
  menu.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'add-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'New category name';
  input.className = 'add-input';
  input.style.padding = '10px';
  input.style.width = '100%';

  // Color picker wrapper
  const colorWrapper = document.createElement('div');
  colorWrapper.className = 'color-picker-wrapper';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color:';
  
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.id = 'categoryColorPicker';
  // Generiši random početnu boju
  const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  colorInput.value = randomColor;
  
  colorWrapper.appendChild(colorLabel);
  colorWrapper.appendChild(colorInput);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';

  const save = document.createElement('button');
  save.textContent = 'Save';
  save.className = 'add-save';
  save.style.flex = '1';

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'add-cancel';
  cancel.style.flex = '1';

  actions.appendChild(save);
  actions.appendChild(cancel);
  wrapper.appendChild(input);
    wrapper.appendChild(colorWrapper);
  wrapper.appendChild(actions);
  menu.appendChild(wrapper);
  // Ensure the dropdown stays open and focus moves to the input immediately
  menu.style.display = 'block';
  // Defer focus until after layout/paint to avoid click stealing focus
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  // Allow saving via Enter key without extra clicks
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      save.click();
    }
  });

  save.addEventListener('click', () => {
    const v = input.value.trim();
    if (!v) return;
    if (!appData.categories.includes(v)) {
      appData.categories.push(v);
            // Dodaj custom boju za ovu kategoriju
            const selectedColor = colorInput.value + 'd6'; // Dodaj alpha kanal
            if (!appData.categoryColors) {
              appData.categoryColors = {};
            }
            appData.categoryColors[v] = selectedColor;
      saveData();
    }
    renderMenu();
    selected.textContent = v;
    selected.dataset.value = v;
    menu.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  });

  cancel.addEventListener('click', () => {
    renderMenu();
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) {
    menu.style.display = "none";
    arrow.style.transform = "rotate(0deg)";
  }
});

// ===== SIDEBAR BACK TO TOP BUTTON =====


// ===== ADD EXPENSE FUNCTIONALITY =====
addExpenseBtn.addEventListener('click', async () => {
  const amount = parseFloat(amountInput.value);
  const category = selected.dataset.value || selected.textContent;

  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  if (category === 'Category') {
    alert('Please select a category');
    return;
  }

  const friendLimit = await getFriendLimit();
  if (friendLimit && friendLimit > 0) {
    const currentSpent = getCurrentMonthSpent();
    if (currentSpent + amount > friendLimit) {
      alert(`Limit reached. You can spend up to ${friendLimit.toLocaleString()}${CURRENCY} this month.`);
      return;
    }
  }

  // Add expense
  const now = new Date();
  const tagsInput = document.getElementById('tagsInput');
  const tagsText = tagsInput ? tagsInput.value.trim() : '';
  
  // Parse tags: split by comma, trim, add # if missing, filter empty
  const tags = tagsText
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => t.startsWith('#') ? t : '#' + t);
  
  const expense = {
    id: Date.now(),
    amount: amount,
    category: category,
    date: now.toLocaleDateString(getLocale()),
    time: now.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.getTime(),
    tags: tags
  };

  appData.expenses.push(expense);
  saveData();
  await syncWalletTransaction({
    amount,
    category,
    note: tagsText || '',
    expenseId: expense.id
  });

  // Reset form
  amountInput.value = '';
  if (tagsInput) tagsInput.value = '';
  selected.textContent = 'Category';
  menu.style.display = 'none';
  arrow.style.transform = 'rotate(0deg)';

  // Update UI
  updateDashboard();
  updateChart();
  updateTagsUI();
  checkLimitAlert(category);

  // Native notification
  if (typeof notifyExpenseAdded === 'function') {
    notifyExpenseAdded(amount, category, getCurrency());
  }
});

// ===== ADD SAVINGS FUNCTIONALITY =====
const savingsInput = document.getElementById('savingsInput');
const addSavingsBtn = document.querySelector('.add-savings .primary-success');

if (addSavingsBtn) addSavingsBtn.addEventListener('click', async () => {
  const amount = parseFloat(savingsInput.value);

  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  // Add savings as income transaction
  const now = new Date();
  const savingsTransaction = {
    id: Date.now(),
    amount: amount,
    category: 'Savings',
    date: now.toLocaleDateString(getLocale()),
    time: now.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.getTime(),
    type: 'savings'
  };

  appData.expenses.push(savingsTransaction);
  appData.savingsTotal = (appData.savingsTotal || 0) + amount;
  saveData();
  await syncWalletTransaction({
    amount,
    category: 'Savings',
    note: 'Savings',
    expenseId: savingsTransaction.id
  });

  // Show notification about added savings
  alert(t('js.savingsAdded') + amount.toLocaleString() + getCurrency());

  // Reset form
  savingsInput.value = '';

  // Update UI
  updateDashboard();
  updateChart();
});

// ===== RESET FUNCTIONALITY =====
if (resetBtn) {
  resetBtn.addEventListener('click', resetAllData);
}

// ===== UPDATE SIDEBAR STATS =====
function updateSidebarStats() {
  const monthSpent = getCurrentMonthSpent();
  const remaining = appData.income + getCurrentMonthSavings() - monthSpent;

  const sidebarSpent = document.getElementById('sidebarSpent');
  const sidebarRemaining = document.getElementById('sidebarRemaining');

  if (sidebarSpent) {
    sidebarSpent.textContent = monthSpent.toLocaleString() + getCurrency();
  }
  if (sidebarRemaining) {
    sidebarRemaining.textContent = remaining.toLocaleString() + getCurrency();
  }
}

// ===== UPDATE DASHBOARD =====
function updateDashboard() {
  try {
    // Update Total Spent (current month only)
    const monthSpent = getCurrentMonthSpent();
    const spentEl = document.querySelectorAll('.summary-cards .card:nth-child(1) .amount')[0];
    if (spentEl) spentEl.textContent = monthSpent.toLocaleString() + getCurrency();

    // Update Income (fixed, never changes from dashboard)
    const incomeEl = document.querySelectorAll('.summary-cards .card:nth-child(2) .amount')[0];
    if (incomeEl) incomeEl.textContent = (appData.income || 0).toLocaleString() + getCurrency();

    // Update Balance
    const balance = (appData.income || 0) + getCurrentMonthSavings() - monthSpent;
    const balanceCard = document.querySelectorAll('.summary-cards .card:nth-child(3)')[0];
    if (balanceCard) {
      balanceCard.querySelector('.amount').textContent = balance.toLocaleString() + getCurrency();
      balanceCard.classList.toggle('balance-negative', balance < 0);
      balanceCard.classList.toggle('balance-positive', balance >= 0);
    }
  } catch(e) { console.error('updateDashboard cards:', e); }

  // Update sidebar stats
  try { updateSidebarStats(); } catch(e) {}

  // Update Recent Transactions
  try { updateRecentTransactions(); } catch(e) { console.error('updateRecentTransactions:', e); }

  // Update Chart Stats
  try { updateChartStats(); } catch(e) { console.error('updateChartStats:', e); }

  // Update Category Limits
  try { updateCategoryLimits(); } catch(e) {}

  // Update Insights
  try { updateInsights(); } catch(e) { console.error('updateInsights:', e); }

  // Update Spending Calendar
  try { updateSpendingCalendar(); } catch(e) { console.error('updateSpendingCalendar:', e); }

  // Update Top Spending Days
  try { updateTopSpendingDays(); } catch(e) { console.error('updateTopSpendingDays:', e); }

  // Update Budget Progress
  try { updateBudgetProgress(); } catch(e) {}

  // Update Smart Suggestions
  try { updateSmartSuggestions(); } catch(e) {}
}

function updateRecentTransactions() {
  const txList = document.querySelector('.transactions ul');
  if (!txList) return;
  txList.innerHTML = '';

  // Filter based on active tag filter
  let transactionsToShow;
  
  if (activeTagFilter === 'all') {
    // Show last 5 transactions
    transactionsToShow = appData.expenses.slice(-5).reverse();
  } else {
    // Get categories that have expenses with this tag
    const categoriesWithTag = new Set();
    appData.expenses.forEach(exp => {
      if (exp.tags && exp.tags.includes(activeTagFilter)) {
        categoriesWithTag.add(exp.category);
      }
    });
    
    // Show all expenses from those categories (last 5)
    transactionsToShow = appData.expenses
      .filter(exp => categoriesWithTag.has(exp.category))
      .slice(-5)
      .reverse();
  }
  
  if (transactionsToShow.length === 0) {
    txList.innerHTML = '<li style="opacity: 0.5;">No transactions yet</li>';
    return;
  }

  transactionsToShow.forEach(exp => {
    const li = document.createElement('li');
    
    const leftDiv = document.createElement('div');
    leftDiv.style.display = 'flex';
    leftDiv.style.flexDirection = 'column';
    leftDiv.style.gap = '4px';
    
    const color = getCategoryColor(exp.category);
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 6px;"></span>${exp.category}`;

    const dateTimeSpan = document.createElement('span');
    dateTimeSpan.className = 'tx-datetime';
    dateTimeSpan.textContent = (exp.time || '--:--') + ' • ' + (exp.date || 'N/A');

    leftDiv.appendChild(nameSpan);
    leftDiv.appendChild(dateTimeSpan);
    
    // Add tags if they exist
    if (exp.tags && exp.tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'tx-tags';
      exp.tags.forEach(tag => {
        const tagBadge = document.createElement('span');
        tagBadge.className = 'tag-badge';
        tagBadge.textContent = tag;
        tagBadge.onclick = () => {
          // Scroll to tags section and filter by this tag
          document.querySelector('.tags-card')?.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => filterByTag(tag), 300);
        };
        tagsContainer.appendChild(tagBadge);
      });
      leftDiv.appendChild(tagsContainer);
    }

    const rightDiv = document.createElement('div');
    rightDiv.style.display = 'flex';
    rightDiv.style.alignItems = 'center';
    rightDiv.style.gap = '12px';

    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    if (exp.type === 'income') {
      amountSpan.classList.add('income');
      amountSpan.textContent = '+' + exp.amount.toLocaleString() + getCurrency();
      nameSpan.textContent = exp.category || 'Income';
    } else if (exp.type === 'savings') {
      amountSpan.classList.add('income');
      amountSpan.textContent = '+' + exp.amount.toLocaleString() + getCurrency();
      nameSpan.textContent = exp.category || 'Savings';
    } else {
      amountSpan.textContent = '-' + exp.amount.toLocaleString() + getCurrency();
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tx-delete-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteBtn.title = 'Delete expense';
    deleteBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this expense?')) {
        appData.expenses = appData.expenses.filter(e => e.id !== exp.id);
        saveData();
        updateDashboard();
        updateChart();
      }
    });

    rightDiv.appendChild(amountSpan);
    rightDiv.appendChild(deleteBtn);

    li.appendChild(leftDiv);
    li.appendChild(rightDiv);
    txList.appendChild(li);
  });
}

function updateChartStats() {
  const statsContainer = document.querySelector('.chart-stats');
  const spending = getSpendingByCategory();
  const total = getCurrentMonthSpent();

  if (!statsContainer) return;
  statsContainer.innerHTML = '';

  if (Object.keys(spending).length === 0) {
    const isDark = document.documentElement.classList.contains('dark-theme');
    statsContainer.innerHTML = '<p style="grid-column:1/-1;padding:12px;border-radius:8px;text-align:center;font-size:13px;background:' + (isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc') + ';color:' + (isDark ? '#b0bac4' : '#64748b') + ';">No expenses this month</p>';
    updateLimitWarnings([]);
    return;
  }

  const overLimit = getCategoriesOverLimit(spending);
  updateLimitWarnings(overLimit);

  const isDark = document.documentElement.classList.contains('dark-theme');
  const bg = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc';
  const textMain = isDark ? '#e2e8f0' : '#0f1724';
  const textSub = isDark ? '#94a3b8' : '#64748b';

  Object.keys(spending).forEach(category => {
    const amount = spending[category];
    const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
    const color = getCategoryColor(category);

    const statItem = document.createElement('div');
    statItem.setAttribute('style',
      'padding:12px;border-radius:8px;text-align:center;' +
      'background:' + bg + ';border:none;box-shadow:none;'
    );

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;margin-bottom:6px;font-weight:500;color:' + textSub + ';display:flex;align-items:center;justify-content:center;gap:6px;';
    label.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + color + ';"></span>' + category;

    const amountSpan = document.createElement('div');
    amountSpan.style.cssText = 'font-size:14px;font-weight:700;color:' + textMain + ';margin-bottom:4px;';
    amountSpan.textContent = amount.toLocaleString() + getCurrency();

    const percentSpan = document.createElement('div');
    percentSpan.style.cssText = 'font-size:11px;color:' + textSub + ';';
    percentSpan.textContent = percentage + '% of total';

    statItem.appendChild(label);
    statItem.appendChild(amountSpan);
    statItem.appendChild(percentSpan);
    statsContainer.appendChild(statItem);
  });
}

function getCategoriesOverLimit(spendingByCategory) {
  const exceeded = [];
  Object.keys(spendingByCategory).forEach(cat => {
    const limit = appData.categoryLimits[cat];
    if (limit && spendingByCategory[cat] > limit) {
      exceeded.push({ category: cat, spent: spendingByCategory[cat], limit });
    }
  });
  return exceeded;
}

function updateLimitWarnings(overLimitList) {
  const warningEl = document.getElementById('chartWarning');
  if (!warningEl) return;

  if (!overLimitList || overLimitList.length === 0) {
    warningEl.textContent = '';
    warningEl.style.display = 'none';
    return;
  }

  const messages = overLimitList.map(item => {
    const color = getCategoryColor(item.category);
    return `<span style="display: inline-block; padding: 2px 6px; border-radius: 3px; background: ${color}; color: white; font-weight: 500; margin: 0 2px;">${item.category}</span>: ${item.spent.toLocaleString()}${CURRENCY.trim()} > limit ${item.limit.toLocaleString()}${CURRENCY.trim()}`;
  });
  warningEl.innerHTML = '⚠️ Over limit – ' + messages.join(' | ');
  warningEl.style.display = 'block';
}

// ===== CATEGORY LIMITS FUNCTIONALITY =====
let limitsExpanded = false;

function updateCategoryLimits() {
  const limitsContainer = document.querySelector('.limits-list');
  const showAllBtn = document.getElementById('limitsShowAll');
  if (!limitsContainer) return;

  limitsContainer.innerHTML = '';

  const spending = getSpendingByCategory();
  const categoriesToShow = limitsExpanded ? appData.categories : appData.categories.slice(0, 3);
  const hasMore = appData.categories.length > 3;

  categoriesToShow.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'limit-item';
    item.dataset.category = cat;

    const color = getCategoryColor(cat);
    const catLabel = typeof tCat === 'function' ? tCat(cat) : cat;
    const limit = appData.categoryLimits[cat];
    const spent = spending[cat] || 0;

    const top = document.createElement('div');
    top.className = 'limit-item-top';

    const nameEl = document.createElement('span');
    nameEl.className = 'limit-category-name';
    nameEl.innerHTML = `<span class="limit-dot" style="background:${color};"></span>${catLabel}`;

    const valueEl = document.createElement('span');
    valueEl.className = 'limit-value';

    if (limit) {
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      const isOver = spent > limit;
      valueEl.textContent = `${spent.toLocaleString()} / ${limit.toLocaleString()}${getCurrency()}`;
      valueEl.style.color = isOver ? '#ef4444' : '';

      top.appendChild(nameEl);
      top.appendChild(valueEl);
      item.appendChild(top);

      const barWrap = document.createElement('div');
      barWrap.className = 'limit-mini-bar';
      const barFill = document.createElement('div');
      barFill.className = 'limit-mini-fill' + (isOver ? ' danger' : pct > 80 ? ' warning' : '');
      barFill.style.width = pct + '%';
      if (!isOver && pct <= 80) barFill.style.background = color;
      barWrap.appendChild(barFill);
      item.appendChild(barWrap);
    } else {
      valueEl.textContent = 'Set limit';
      valueEl.className = 'limit-value unset';
      top.appendChild(nameEl);
      top.appendChild(valueEl);
      item.appendChild(top);
    }

    item.addEventListener('click', () => openEditLimitsModal(cat));
    limitsContainer.appendChild(item);
  });

  if (showAllBtn) {
    showAllBtn.style.display = hasMore ? 'flex' : 'none';
  }
}

function toggleLimitsExpanded() {
  limitsExpanded = !limitsExpanded;
  const showAllText = document.getElementById('showAllText');
  const showAllIcon = document.getElementById('showAllIcon');
  if (showAllText) showAllText.textContent = limitsExpanded ? 'Show less' : 'Show all';
  if (showAllIcon) showAllIcon.style.transform = limitsExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
  updateCategoryLimits();
}

document.addEventListener('DOMContentLoaded', () => {
  const showAllBtn = document.getElementById('limitsShowAll');
  if (showAllBtn) showAllBtn.addEventListener('click', toggleLimitsExpanded);

  const editLimitsModalClose = document.getElementById('editLimitsModalClose');
  if (editLimitsModalClose) {
    editLimitsModalClose.addEventListener('click', () => {
      document.getElementById('editLimitsModal').style.display = 'none';
    });
  }
  const editLimitsModal = document.getElementById('editLimitsModal');
  if (editLimitsModal) {
    editLimitsModal.addEventListener('click', (e) => {
      if (e.target === editLimitsModal) editLimitsModal.style.display = 'none';
    });
  }
});

function openEditLimitsModal(focusCategory) {
  const modal = document.getElementById('editLimitsModal');
  const list = document.getElementById('editLimitsList');
  if (!modal || !list) return;

  const spending = getSpendingByCategory();
  list.innerHTML = '';

  appData.categories.forEach(cat => {
    const color = getCategoryColor(cat);
    const catLabel = typeof tCat === 'function' ? tCat(cat) : cat;
    const currentLimit = appData.categoryLimits[cat] || '';
    const spent = spending[cat] || 0;

    const row = document.createElement('div');
    row.className = 'edit-limit-row';

    const label = document.createElement('div');
    label.className = 'edit-limit-label';
    label.innerHTML = `<span class="limit-dot" style="background:${color};"></span><span>${catLabel}</span>`;
    if (spent > 0) {
      const spentNote = document.createElement('span');
      spentNote.className = 'edit-limit-spent';
      spentNote.textContent = `spent: ${spent.toLocaleString()}${getCurrency()}`;
      label.appendChild(spentNote);
    }

    const inputRow = document.createElement('div');
    inputRow.className = 'edit-limit-input-row';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'edit-limit-input';
    input.placeholder = 'No limit';
    input.min = '1';
    input.value = currentLimit;
    input.dataset.cat = cat;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-limit-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const val = parseFloat(input.value);
      if (val > 0) {
        appData.categoryLimits[cat] = val;
      } else {
        delete appData.categoryLimits[cat];
      }
      saveData();
      updateCategoryLimits();
      updateBudgetProgress();
      openEditLimitsModal(); // refresh modal
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(saveBtn);

    if (currentLimit) {
      const delBtn = document.createElement('button');
      delBtn.className = 'edit-limit-delete-btn';
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      delBtn.title = 'Remove limit';
      delBtn.addEventListener('click', () => {
        delete appData.categoryLimits[cat];
        saveData();
        updateCategoryLimits();
        updateBudgetProgress();
        openEditLimitsModal();
      });
      inputRow.appendChild(delBtn);
    }

    row.appendChild(label);
    row.appendChild(inputRow);
    list.appendChild(row);

    if (focusCategory === cat) {
      requestAnimationFrame(() => input.focus());
    }
  });

  modal.style.display = 'flex';
}

function saveCategoryLimit(category, rawValue) {
  const value = parseFloat(rawValue);
  if (!value || value <= 0) return;
  appData.categoryLimits[category] = value;
  saveData();
  updateCategoryLimits();
  updateBudgetProgress();
}

function deleteCategoryLimit(category) {
  delete appData.categoryLimits[category];
  saveData();
  updateCategoryLimits();
  updateBudgetProgress();
}

// ===== LIMIT EXCEEDED ALERT =====
const LIMIT_SUGGESTIONS = {
  'Food': 'Try meal prepping or cooking at home more often.',
  'Transport': 'Consider public transport or carpooling to save money.',
  'Entertainment': 'Look for free events or reduce subscriptions.',
  'Shopping': 'Make a shopping list and stick to it before buying.',
  'Health': 'Check if your insurance covers some of these expenses.',
  'Rent': 'Review if any fixed costs could be renegotiated.',
  'Education': 'Look for free or discounted learning resources.',
  'Travel': 'Book in advance or look for off-season deals.',
};

let _limitAlertTimeout = null;

function checkLimitAlert(category) {
  const limit = appData.categoryLimits[category];
  if (!limit) return;
  const spending = getSpendingByCategory();
  const spent = spending[category] || 0;
  if (spent > limit) {
    const over = spent - limit;
    const suggestion = LIMIT_SUGGESTIONS[category] || 'Try reviewing your recent expenses and cutting back where possible.';
    showLimitAlert('exceeded', category, spent, limit, over, suggestion);
    if (typeof notifyLimitExceeded === 'function') {
      notifyLimitExceeded(category, spent, limit, getCurrency());
    }
  } else if (spent / limit >= 0.8) {
    showLimitAlert('approaching', category, spent, limit, 0, '');
  }
}

function showLimitAlert(type, category, spent, limit, over, suggestion) {
  const banner = document.getElementById('limitAlertBanner');
  if (!banner) return;
  const color = getCategoryColor(category);
  const cur = getCurrency();
  const pct = Math.round((spent / limit) * 100);

  if (type === 'exceeded') {
    banner.innerHTML = `
      <div class="limit-alert-inner">
        <div class="limit-alert-top">
          <span class="limit-alert-icon">⚠️</span>
          <div class="limit-alert-info">
            <div class="limit-alert-title">Limit exceeded — <span style="color:${color}">${category}</span></div>
            <div class="limit-alert-sub">Spent ${spent.toLocaleString()}${cur} · ${over.toLocaleString()}${cur} over the limit</div>
          </div>
          <button class="limit-alert-close" onclick="document.getElementById('limitAlertBanner').style.display='none'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="limit-alert-suggestion">💡 ${suggestion}</div>
      </div>`;
  } else {
    banner.innerHTML = `
      <div class="limit-alert-inner limit-alert-inner--warn">
        <div class="limit-alert-top">
          <span class="limit-alert-icon">📊</span>
          <div class="limit-alert-info">
            <div class="limit-alert-title">Approaching limit — <span style="color:${color}">${category}</span></div>
            <div class="limit-alert-sub">Spent ${spent.toLocaleString()}${cur} of ${limit.toLocaleString()}${cur} (${pct}%)</div>
          </div>
          <button class="limit-alert-close" onclick="document.getElementById('limitAlertBanner').style.display='none'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>`;
  }

  banner.style.display = 'block';
  clearTimeout(_limitAlertTimeout);
  _limitAlertTimeout = setTimeout(() => { banner.style.display = 'none'; }, 9000);
}

function checkAllLimitAlerts() {
  const spending = getSpendingByCategory();
  const exceeded = Object.keys(appData.categoryLimits || {}).filter(cat => {
    return (spending[cat] || 0) > appData.categoryLimits[cat];
  });
  if (exceeded.length === 0) return;
  const cat = exceeded[0];
  const spent = spending[cat];
  const limit = appData.categoryLimits[cat];
  checkLimitAlert(cat);
}

// ===== CHART.JS SETUP =====
let chartInstance = null;
let dailyChartInstance = null;
let comparisonChartInstance = null;

// Moderna, harmonizovana paleta (Tailwind-inspirisana) sa blagim alpha
const customColorPalette = [
  '#ef4444cc', '#f97316cc', '#f59e0bcc', '#eab308cc', '#84cc16cc', '#22c55ecc', '#10b981cc',
  '#14b8a6cc', '#06b6d4cc', '#0ea5e9cc', '#3b82f6cc', '#6366f1cc', '#8b5cf6cc', '#a855f7cc',
  '#d946efcc', '#ec4899cc', '#f43f5ecc', '#fda4afcc', '#fb7185cc', '#fcd34dcc',
  '#93c5fdcc', '#a7f3d0cc', '#d1fae5cc', '#fde68acc', '#d1d5dbcc', '#9ca3afcc',
  '#94a3b8cc', '#cbd5e1cc'
];

const defaultChartColors = {
  'Food': '#ef4444cc',
  'Transport': '#14b8a6cc',
  'Rent': '#3b82f6cc',
  'Entertainment': '#f59e0bcc',
  'Other': '#9ca3afcc',
  'Balance': '#10b981cc'
};

// Generator random boje koja je dovoljno različita od postojećih
function generateDistinctColor(usedColors) {
  const existingHues = usedColors.map(color => {
    // Konvertuj hex u HSL da dobiješ hue
    const hex = color.replace('#', '').substring(0, 6);
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    
    return h * 360;
  });
  
  // Pronađi hue koji je najdalje od svih postojećih
  let bestHue = 0;
  let maxMinDistance = 0;
  
  for (let testHue = 0; testHue < 360; testHue += 10) {
    let minDistance = 360;
    for (const existingHue of existingHues) {
      const distance = Math.min(
        Math.abs(testHue - existingHue),
        360 - Math.abs(testHue - existingHue)
      );
      minDistance = Math.min(minDistance, distance);
    }
    if (minDistance > maxMinDistance) {
      maxMinDistance = minDistance;
      bestHue = testHue;
    }
  }
  
  // Generiši boju sa tim hue-om
  const saturation = 65 + Math.random() * 20; // 65-85%
  const lightness = 55 + Math.random() * 15;  // 55-70%
  const alpha = 0.8 + Math.random() * 0.15;   // 0.8-0.95
  
  // Konvertuj HSL u hex sa alpha
  const h = bestHue / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`;
}

// Funkcija za dobijanje boje kategorije
function getCategoryColor(category) {
  // Prvo proveravamo da li postoji custom boja za ovu kategoriju
  if (appData.categoryColors && appData.categoryColors[category]) {
    return appData.categoryColors[category];
  }
  
  // Ako je default kategorija, koristi default boju
  if (defaultChartColors[category]) {
    return defaultChartColors[category];
  }
  
  // Za nove custom kategorije, dodeli novu boju
  const usedColors = Object.values(appData.categoryColors || {});
  
  // Prvo pokušaj da nađeš slobodnu boju iz palete
  let availableColor = customColorPalette.find(color => !usedColors.includes(color));
  
  // Ako nema slobodne boje u paleti, generiši novu koja je dovoljno različita
  if (!availableColor) {
    availableColor = generateDistinctColor(usedColors);
  }
  
  // Sačuvaj boju za ovu kategoriju
  if (!appData.categoryColors) {
    appData.categoryColors = {};
  }
  appData.categoryColors[category] = availableColor;
  saveData();
  
  return availableColor;
}

// ===== INSIGHTS =====
function filterExpensesByMonth(month, year) {
  return appData.expenses.filter(e => {
    if (e.type === 'income' || e.type === 'savings') return false;
    const d = new Date(e.timestamp || Date.now());
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

function getMonthSpendingByCategory(month, year) {
  const out = {};
  filterExpensesByMonth(month, year).forEach(exp => {
    out[exp.category] = (out[exp.category] || 0) + exp.amount;
  });
  return out;
}

function updateInsights() {
  const list = document.getElementById('insightsList');
  if (!list) return;
  list.innerHTML = '';

  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;

  const expensesThisMonth = filterExpensesByMonth(m, y);
  const totalThisMonth = expensesThisMonth.reduce((s, e) => s + e.amount, 0);

  // Insight 1: Weekend vs Weekday
  const dayTotals = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 };
  expensesThisMonth.forEach(e => {
    const d = new Date(e.timestamp);
    dayTotals[d.getDay()] += e.amount;
  });
  const weekend = (dayTotals[6] + dayTotals[0]);
  const weekdays = dayTotals[1]+dayTotals[2]+dayTotals[3]+dayTotals[4]+dayTotals[5];
  const weekendMsg = weekend > weekdays
    ? t('js.spendMostWeekends')
    : t('js.spendMostWeekdays');
  addInsight(list, weekendMsg);

  // Insight 2: Entertainment MoM change
  const currCat = getMonthSpendingByCategory(m, y);
  const prevCat = getMonthSpendingByCategory(prevM, prevY);
  const currEnt = currCat['Entertainment'] || 0;
  const prevEnt = prevCat['Entertainment'] || 0;
  let entMsg = t('js.entertainmentSame');
  if (prevEnt > 0) {
    const diffPct = ((currEnt - prevEnt) / prevEnt) * 100;
    const sign = diffPct >= 0 ? '+' : '';
    entMsg = t('js.entertainmentChange', [`${sign}${Math.round(diffPct)}%`]);
  } else if (currEnt > 0) {
    entMsg = t('js.entertainmentNew');
  }
  addInsight(list, entMsg);

  // Insight 3: Top 3 najveće transakcije
  const top3 = [...expensesThisMonth].sort((a,b)=>b.amount-a.amount).slice(0,3);
  if (top3.length > 0) {
    const items = top3.map(t => {
      const color = getCategoryColor(t.category);
      return `<span style="display: inline-block; padding: 2px 6px; border-radius: 3px; background: ${color}; color: white; font-weight: 500; font-size: 12px;">${t.category}</span>: ${t.amount.toLocaleString()}${CURRENCY}`;
    });
    const insightLi = document.createElement('li');
    insightLi.className = 'insight-item';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-brain insight-icon';
    const span = document.createElement('span');
    span.innerHTML = t('js.top3Transactions') + items.join(' • ');
    insightLi.appendChild(icon);
    insightLi.appendChild(span);
    list.appendChild(insightLi);
  } else {
    addInsight(list, t('js.noExpensesThisMonth'));
  }

  // Insight 4: Predikcija uštede
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const dailyRate = dayOfMonth > 0 ? (totalThisMonth / dayOfMonth) : 0;
  const projectedSpent = Math.round(dailyRate * daysInMonth);
  const predictedSavings = appData.income - projectedSpent + (appData.savingsTotal || 0);
  addInsight(list, t('js.savingsPrediction', [Math.round(predictedSavings).toLocaleString() + ' ' + getCurrency()]));
}

function addInsight(listEl, text) {
  const isDark = document.documentElement.classList.contains('dark-theme');
  const li = document.createElement('li');
  // Use setAttribute to beat CSS !important overrides
  li.setAttribute('style',
    'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:14px;' +
    (isDark ? 'background:rgba(255,255,255,0.08);color:#f0f5fb;' : 'background:#f8fafc;color:#344054;')
  );
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-brain';
  icon.setAttribute('style', 'color:' + (isDark ? '#818cf8' : '#334155') + ';flex-shrink:0;');
  const span = document.createElement('span');
  span.textContent = text;
  li.appendChild(icon);
  li.appendChild(span);
  listEl.appendChild(li);
}

function buildChartData() {
  const spending = getSpendingByCategory();
  const hasData = Object.keys(spending).length > 0;

  if (!hasData) {
    return {
      labels: ['No data'],
      data: [1],
      colors: ['#e5e7eb'],
      isEmpty: true
    };
  }

  const chartData = { ...spending };
  const _tCat = typeof tCat === 'function' ? tCat : (c => c);
  return {
    labels: Object.keys(chartData).map(cat => _tCat(cat)),
    data: Object.values(chartData),
    colors: Object.keys(chartData).map(cat => getCategoryColor(cat)),
    isEmpty: false
  };
}

function initChart() {
  const ctx = document.getElementById('spendingChart');
  if (!ctx) return;

  const { labels, data, isEmpty } = buildChartData();

  const solidColors = [
    'rgba(239,68,68,0.85)', 'rgba(249,115,22,0.85)', 'rgba(245,158,11,0.85)',
    'rgba(34,197,94,0.85)', 'rgba(59,130,246,0.85)', 'rgba(139,92,246,0.85)',
    'rgba(236,72,153,0.85)', 'rgba(20,184,166,0.85)', 'rgba(14,165,233,0.85)',
    'rgba(132,204,22,0.85)'
  ];

  if (chartInstance) chartInstance.destroy();

  const isDark = document.documentElement.classList.contains('dark-theme');
  const bgColors = isEmpty ? [isDark ? 'rgba(255,255,255,0.22)' : '#e5e7eb'] : labels.map((_, i) => solidColors[i % solidColors.length]);
  const borderCol = isEmpty ? (isDark ? '#0f1724' : '#e5e7eb') : (isDark ? '#0f1724' : '#ffffff');
  const legendColor = isDark ? '#e2e8f0' : '#374151';
  const emptyState = document.getElementById('chartEmptyState');
  if (emptyState) {
    emptyState.style.display = isEmpty ? 'block' : 'none';
    const emptyText = emptyState.querySelector('div');
    if (emptyText) emptyText.style.color = isDark ? '#94a3b8' : '#6b7280';
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: borderCol,
        borderWidth: isEmpty ? 0 : 2
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: {
          display: !isEmpty,
          position: 'bottom',
          labels: { color: legendColor, font: { size: 12 }, padding: 12, boxWidth: 12, boxHeight: 12, borderRadius: 3, useBorderRadius: true }
        },
        tooltip: {
          enabled: !isEmpty,
          callbacks: {
            label: function(context) {
              const val = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              return context.label + ': ' + val.toLocaleString() + ' RSD (' + ((val/total)*100).toFixed(1) + '%)';
            }
          }
        }
      }
    }
  });
}

function updateChart() {
  if (chartInstance) {
    const { labels, data, isEmpty } = buildChartData();
    const solidColors = [
      'rgba(239,68,68,0.85)', 'rgba(249,115,22,0.85)', 'rgba(245,158,11,0.85)',
      'rgba(34,197,94,0.85)', 'rgba(59,130,246,0.85)', 'rgba(139,92,246,0.85)',
      'rgba(236,72,153,0.85)', 'rgba(20,184,166,0.85)', 'rgba(14,165,233,0.85)',
      'rgba(132,204,22,0.85)'
    ];
    const isDark = document.documentElement.classList.contains('dark-theme');
    const bgColors = isEmpty ? [isDark ? 'rgba(255,255,255,0.22)' : '#e5e7eb'] : labels.map((_, i) => solidColors[i % solidColors.length]);
    const borderCol = isEmpty ? (isDark ? '#0f1724' : '#e5e7eb') : (isDark ? '#0f1724' : '#ffffff');
    const emptyState = document.getElementById('chartEmptyState');
    if (emptyState) {
      emptyState.style.display = isEmpty ? 'block' : 'none';
      const emptyText = emptyState.querySelector('div');
      if (emptyText) emptyText.style.color = isDark ? '#94a3b8' : '#6b7280';
    }
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = bgColors;
    chartInstance.data.datasets[0].borderColor = borderCol;
    chartInstance.data.datasets[0].borderWidth = isEmpty ? 0 : 2;
    chartInstance.options.plugins.legend.display = !isEmpty;
    chartInstance.options.plugins.legend.labels.color = isDark ? '#e2e8f0' : '#374151';
    chartInstance.options.plugins.tooltip.enabled = !isEmpty;
    chartInstance.update();
  }

  // Also refresh additional charts
  updateDailyChart();
  updateComparisonChart();
}

// ===== Daily Spending Chart =====
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function buildDailySpendingData(year, month) {
  const days = getDaysInMonth(year, month);
  const labels = Array.from({ length: days }, (_, i) => String(i + 1));
  const data = new Array(days).fill(0);

  appData.expenses.forEach(e => {
    if (e.type === 'income' || e.type === 'savings') return;
    const ts = e.timestamp || (e.date ? new Date(e.date).getTime() : null);
    if (!ts) return;
    const d = new Date(ts);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dayIdx = d.getDate() - 1;
      data[dayIdx] += e.amount;
    }
  });

  return { labels, data };
}

function getHeatColor(amount) {
  const dark = document.documentElement.classList.contains('dark-theme');
  if (!amount || amount <= 0) return dark ? 'rgba(255,255,255,0.06)' : '#dbeafe';
  if (dark) {
    if (amount < 2000) return 'rgba(134,239,172,0.35)';
    if (amount < 10000) return 'rgba(52,211,153,0.5)';
    if (amount < 20000) return 'rgba(16,185,129,0.6)';
    if (amount < 30000) return 'rgba(251,191,36,0.55)';
    if (amount < 50000) return 'rgba(249,115,22,0.65)';
    return 'rgba(239,68,68,0.75)';
  }
  if (amount < 2000) return '#bbf7d0';
  if (amount < 10000) return '#86efac';
  if (amount < 20000) return '#34d399';
  if (amount < 30000) return '#fbbf24';
  if (amount < 50000) return '#f97316';
  return '#ef4444';
}

function getDaySpendingBreakdown(year, month, dayNum) {
  const dayExpenses = appData.expenses.filter(e => {
    if (e.type === 'income' || e.type === 'savings') return false;
    const ts = e.timestamp || (e.date ? new Date(e.date).getTime() : null);
    if (!ts) return false;
    const d = new Date(ts);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
  });

  const categorySpend = {};
  let total = 0;
  dayExpenses.forEach(exp => {
    categorySpend[exp.category] = (categorySpend[exp.category] || 0) + exp.amount;
    total += exp.amount;
  });

  // Calculate income for that day
  const dayIncome = appData.expenses.filter(e => {
    if (e.type !== 'income') return false;
    const d = new Date(e.timestamp || Date.now());
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
  }).reduce((sum, e) => sum + e.amount, 0);

  const savings = dayIncome - total;

  return { categorySpend, total, savings };
}

function showCalendarTooltip(dayNum, x, y) {
  const tooltip = document.getElementById('calendarTooltip');
  if (!tooltip) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { categorySpend, total, savings } = getDaySpendingBreakdown(year, month, dayNum);

  // Get income for that day
  const dayIncome = appData.expenses.filter(e => {
    if (e.type !== 'income') return false;
    const d = new Date(e.timestamp || Date.now());
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
  }).reduce((sum, e) => sum + e.amount, 0);

  if (total === 0 && dayIncome === 0) {
    tooltip.innerHTML = `<div class="tooltip-day">${t('js.dayLabel', [dayNum])}</div><div class="tooltip-empty">${t('js.noExpenses')}</div>`;
  } else {
    let html = `<div class="tooltip-day">${t('js.dayLabel', [dayNum])}</div>`;
    
    // Show savings only if there's income that day
    if (dayIncome > 0) {
      const savedAmount = dayIncome - total;
      if (savedAmount >= 0) {
        html += `<div class="tooltip-savings">${t('js.saved', [savedAmount.toLocaleString() + CURRENCY])}</div>`;
      } else {
        html += `<div class="tooltip-savings-negative">${t('js.overspent', [Math.abs(savedAmount).toLocaleString() + CURRENCY])}</div>`;
      }
    }
    
    html += `<div class="tooltip-total">${t('js.totalSpent', [total.toLocaleString() + CURRENCY])}</div>`;
    html += '<div class="tooltip-breakdown">';
    Object.keys(categorySpend).forEach(cat => {
      html += `<div class="tooltip-category"><span>${cat}</span><span>${categorySpend[cat].toLocaleString()}${CURRENCY}</span></div>`;
    });
    html += '</div>';
    tooltip.innerHTML = html;
  }

  tooltip.style.display = 'block';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideCalendarTooltip() {
  const tooltip = document.getElementById('calendarTooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

function updateSpendingCalendar() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  const year = currentCalendarYear;
  const month = currentCalendarMonth;
  const { labels, data } = buildDailySpendingData(year, month);

  // Create date for display
  const displayDate = new Date(year, month, 1);
  if (calendarDateLabel) {
    calendarDateLabel.textContent = displayDate.toLocaleDateString(getLocale(), {
      month: 'long',
      year: 'numeric'
    });
  }

  grid.innerHTML = '';
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  
  labels.forEach((label, idx) => {
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.style.background = getHeatColor(data[idx] || 0);

    // Mark today only if viewing current month
    if (isCurrentMonth && parseInt(label) === today.getDate()) {
      el.classList.add('today');
    }

    const num = document.createElement('span');
    num.className = 'day-label';
    num.textContent = label;
    el.appendChild(num);

    // Add hover events for tooltip
    el.addEventListener('mouseenter', (e) => {
      const rect = el.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      const x = rect.left - gridRect.left + rect.width / 2;
      const y = rect.top - gridRect.top - 10;
      showCalendarTooltip(parseInt(label), x, y);
    });

    el.addEventListener('mouseleave', () => {
      hideCalendarTooltip();
    });

    el.addEventListener('click', () => {
      openSpendingsForDate(year, month, parseInt(label));
    });

    grid.appendChild(el);
  });
}

function getTopSpendingDays() {
  const year = currentCalendarYear;
  const month = currentCalendarMonth;
  const { labels, data } = buildDailySpendingData(year, month);
  
  const daysWithSpend = labels
    .map((day, idx) => {
      const dayNum = parseInt(day);
      const dayDate = new Date(year, month, dayNum);
      const dayAmount = data[idx] || 0;
      
      // Find top category for this day
      const dayExpenses = appData.expenses.filter(e => {
        if (e.type === 'income' || e.type === 'savings') return false;
        const ts = e.timestamp || (e.date ? new Date(e.date).getTime() : null);
        if (!ts) return false;
        const d = new Date(ts);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
      });
      
      const categorySpend = {};
      dayExpenses.forEach(exp => {
        categorySpend[exp.category] = (categorySpend[exp.category] || 0) + exp.amount;
      });
      
      let topCategory = '';
      let maxCatSpend = 0;
      Object.keys(categorySpend).forEach(cat => {
        if (categorySpend[cat] > maxCatSpend) {
          maxCatSpend = categorySpend[cat];
          topCategory = cat;
        }
      });
      
      return {
        day: dayNum,
        amount: dayAmount,
        date: dayDate,
        topCategory: topCategory
      };
    })
    .filter(d => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return daysWithSpend;
}

function updateTopSpendingDays() {
  const list = document.getElementById('topDaysList');
  if (!list) return;

  const topDays = getTopSpendingDays();
  list.innerHTML = '';

  if (topDays.length === 0) {
    const empty = document.createElement('p');
    empty.style.opacity = '0.6';
    empty.textContent = t('js.noExpensesYet');
    list.appendChild(empty);
    return;
  }

  topDays.forEach(d => {
    const item = document.createElement('div');
    item.className = 'top-day-item';

    const dateEl = document.createElement('span');
    dateEl.className = 'top-day-date';
    dateEl.textContent = d.date.toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

    const infoEl = document.createElement('span');
    infoEl.className = 'top-day-info';
    
    const categoryColor = getCategoryColor(d.topCategory);
    infoEl.innerHTML = `${t('js.totalMost', [d.amount.toLocaleString() + CURRENCY])}<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${categoryColor}; color: white; font-weight: 500; font-size: 12px;">${d.topCategory}</span>`;

    item.appendChild(dateEl);
    item.appendChild(infoEl);
    list.appendChild(item);
  });
}

function initDailyChart() {
  const ctx = document.getElementById('dailyChart');
  if (!ctx) return;

  const now = new Date();
  const { labels, data } = buildDailySpendingData(now.getFullYear(), now.getMonth());

  if (dailyChartInstance) dailyChartInstance.destroy();

  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spending',
        data,
        backgroundColor: '#60a5fa',
        borderRadius: 6,
        maxBarThickness: 18
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateDailyChart() {
  const ctx = document.getElementById('dailyChart');
  if (!ctx || !dailyChartInstance) return;
  const now = new Date();
  const { labels, data } = buildDailySpendingData(now.getFullYear(), now.getMonth());
  dailyChartInstance.data.labels = labels;
  dailyChartInstance.data.datasets[0].data = data;
  dailyChartInstance.update();
}

// ===== Comparison Chart (This vs Last Month) =====
function buildComparisonData() {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;

  const curr = getMonthSpendingByCategory(m, y);
  const prev = getMonthSpendingByCategory(prevM, prevY);
  const engLabels = [...appData.categories];
  const _tCat2 = typeof tCat === 'function' ? tCat : (c => c);
  const labels = engLabels.map(c => _tCat2(c));
  const currentData = engLabels.map(c => curr[c] || 0);
  const prevData = engLabels.map(c => prev[c] || 0);
  return { labels, currentData, prevData };
}

function initComparisonChart() {
  const ctx = document.getElementById('comparisonChart');
  if (!ctx) return;
  if (comparisonChartInstance) comparisonChartInstance.destroy();
  const { labels, currentData, prevData } = buildComparisonData();
  comparisonChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: t('js.thisMonth'), data: currentData, backgroundColor: '#34d399', borderRadius: 6, maxBarThickness: 18 },
        { label: t('js.lastMonth'), data: prevData, backgroundColor: '#9ca3af', borderRadius: 6, maxBarThickness: 18 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
      }
    }
  });
}

function updateComparisonChart() {
  const ctx = document.getElementById('comparisonChart');
  if (!ctx || !comparisonChartInstance) return;
  const { labels, currentData, prevData } = buildComparisonData();
  comparisonChartInstance.data.labels = labels;
  comparisonChartInstance.data.datasets[0].data = currentData;
  comparisonChartInstance.data.datasets[1].data = prevData;
  comparisonChartInstance.update();
}

// ===== Budget Progress Bars =====
function updateBudgetProgress() {
  const container = document.getElementById('progressList');
  if (!container) return;
  const spending = getSpendingByCategory();
  const catsWithLimit = Object.keys(appData.categoryLimits || {});
  if (catsWithLimit.length === 0) {
    container.innerHTML = '<p data-empty="true" style="opacity:0.6">No limits set</p>';
    const card = container.closest('.budget-progress');
    if (card) card.classList.add('no-limits');
    return;
  }
  const emptyMessage = container.querySelector('[data-empty="true"]');
  if (emptyMessage) emptyMessage.remove();
  const card = container.closest('.budget-progress');
  if (card) card.classList.remove('no-limits');
  const existingItems = new Map(
    Array.from(container.querySelectorAll('.progress-item')).map(item => [item.dataset.category, item])
  );
  const seen = new Set();
  catsWithLimit.forEach(cat => {
    const limit = appData.categoryLimits[cat];
    const spent = spending[cat] || 0;
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const state = spent > limit ? 'danger' : (pct > 80 ? 'warning' : '');
    const color = getCategoryColor(cat);
    const safePercent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    let item = existingItems.get(cat);
    if (!item) {
      item = document.createElement('div');
      item.className = 'progress-item';
      item.dataset.category = cat;

      const header = document.createElement('div');
      header.className = 'progress-header';

      const bar = document.createElement('div');
      bar.className = 'progress-bar';

      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = '0%';
      bar.appendChild(fill);

      const text = document.createElement('div');
      text.className = 'progress-text';

      item.appendChild(header);
      item.appendChild(bar);
      item.appendChild(text);
      container.appendChild(item);
    }

    const header = item.querySelector('.progress-header');
    const fill = item.querySelector('.progress-fill');
    const text = item.querySelector('.progress-text');

    if (header) {
      const catTr = typeof tCat === 'function' ? tCat(cat) : cat;
      header.innerHTML = `<span style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 3px; background: ${color};"></span>${catTr}</span><span>${spent.toLocaleString()}${CURRENCY} / ${limit.toLocaleString()}${CURRENCY}</span>`;
    }

    if (fill) {
      fill.classList.remove('warning', 'danger');
      if (state) {
        fill.classList.add(state);
        fill.style.background = '';
      } else {
        fill.style.background = color;
      }
      requestAnimationFrame(() => {
        fill.style.width = pct + '%';
      });
    }

    if (text) {
      text.textContent = t('js.spentPercent', [safePercent, cat]);
    }

    seen.add(cat);
  });

  existingItems.forEach((item, cat) => {
    if (!seen.has(cat)) {
      item.remove();
    }
  });
}

// ===== PAYDAY AUTO-INCOME =====
function checkPayDay() {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Read payday setting
  let payDay = 1;
  try {
    const settings = JSON.parse(localStorage.getItem('mt_settings_v1'));
    const raw = settings && settings.preferences && settings.preferences.startMonth;
    if (raw === 'last') {
      // Last day of current month
      payDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    } else if (raw) {
      payDay = parseInt(raw, 10) || 1;
    }
  } catch(e) { /* use default 1 */ }

  // Key to track which month we last added income
  const lastPayDayMonth = appData.lastPayDayMonth || '';
  const thisMonthKey = currentYear + '-' + currentMonth;

  // If today >= payday and we haven't added income this month yet
  if (today >= payDay && lastPayDayMonth !== thisMonthKey) {
    const incomeAmount = appData.income || 0;
    if (incomeAmount > 0) {
      // Add income to current balance
      appData.currentBalance = (appData.currentBalance || 0) + incomeAmount;

      // Add as income transaction so it shows in recent transactions
      const incomeTransaction = {
        id: Date.now(),
        amount: incomeAmount,
        category: 'Income',
        date: now.toLocaleDateString(getLocale()),
        time: now.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.getTime(),
        type: 'income',
        note: 'Monthly Income (PayDay)'
      };
      appData.expenses.push(incomeTransaction);

      appData.lastPayDayMonth = thisMonthKey;
      saveData();

      // Sync to server
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        fetch(`${API_BASE}/me/finances`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentBalance: appData.currentBalance })
        }).catch(() => {});
      }
    }
  }
}

// ===== RECURRING EXPENSES =====
function checkAndAddRecurringExpenses() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  let changed = false;

  appData.recurringExpenses.forEach(recurring => {
    if (!recurring.isActive) return;
    const day = recurring.dayOfMonth || 1;
    const alreadyAdded = recurring.lastAddedYear === currentYear && recurring.lastAddedMonth === currentMonth;
    if (!alreadyAdded && currentDay >= day) {
      const newExpense = {
        id: Date.now() + Math.random(),
        amount: recurring.amount,
        category: recurring.name,
        date: new Date().toLocaleDateString(getLocale()),
        time: new Date().toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        type: 'recurring'
      };
      appData.expenses.push(newExpense);
      recurring.lastAddedYear = currentYear;
      recurring.lastAddedMonth = currentMonth;
      changed = true;
    }
  });

  if (changed) saveData();
}

function addRecurringExpense(name, amount, dayOfMonth) {
  if (!name || !amount) {
    alert(t('js.fillNameAmount'));
    return;
  }

  const recurring = {
    id: Date.now(),
    name: name,
    amount: parseFloat(amount),
    dayOfMonth: Math.min(31, Math.max(1, parseInt(dayOfMonth) || 1)),
    isActive: false
  };

  appData.recurringExpenses.push(recurring);
  
  saveData();
  updateRecurringExpensesList();
  updateRecurringInsight();
  updateDashboard();
  updateChart();
  updateDailyChart();
  updateComparisonChart();

  // Clear form
  document.getElementById('recurringName').value = '';
  document.getElementById('recurringAmount').value = '';
  selectedRecurringDay = null;
  const dayLabel = document.getElementById('recurringDayLabel');
  if (dayLabel) dayLabel.textContent = 'Day of month';
  const dayBtn = document.getElementById('recurringDayBtn');
  if (dayBtn) dayBtn.classList.remove('selected');
  const popup = document.getElementById('dayPickerPopup');
  if (popup) popup.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
}

function toggleRecurringExpense(id) {
  const recurring = appData.recurringExpenses.find(r => r.id === id);
  if (!recurring) return;

  recurring.isActive = !recurring.isActive;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  if (recurring.isActive) {
    // Activating: add expense for this month if day has already passed and not yet added
    const alreadyAdded = recurring.lastAddedYear === currentYear && recurring.lastAddedMonth === currentMonth;
    if (!alreadyAdded && currentDay >= (recurring.dayOfMonth || 1)) {
      appData.expenses.push({
        id: Date.now() + Math.random(),
        amount: recurring.amount,
        category: recurring.name,
        date: now.toLocaleDateString(getLocale()),
        time: now.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        type: 'recurring'
      });
      recurring.lastAddedYear = currentYear;
      recurring.lastAddedMonth = currentMonth;
    }
  } else {
    // Deactivating: remove this month's recurring expenses for this item
    appData.expenses = appData.expenses.filter(e => {
      if (e.type !== 'recurring' || e.category !== recurring.name) return true;
      const d = e.timestamp ? new Date(e.timestamp) : new Date(e.date);
      return !(d.getFullYear() === currentYear && d.getMonth() === currentMonth);
    });
    recurring.lastAddedYear = undefined;
    recurring.lastAddedMonth = undefined;
  }

  saveData();
  updateRecurringExpensesList();
  updateRecurringInsight();
  updateDashboard();
  updateChart();
  updateDailyChart();
  updateComparisonChart();
}

function deleteRecurringExpense(id) {
  if (confirm(t('js.deleteRecurring'))) {
    const recurring = appData.recurringExpenses.find(r => r.id === id);
    if (recurring) {
      appData.expenses = appData.expenses.filter(e => !(e.type === 'recurring' && e.category === recurring.name));
    }
    appData.recurringExpenses = appData.recurringExpenses.filter(r => r.id !== id);
    saveData();
    updateRecurringExpensesList();
    updateRecurringInsight();
    updateDashboard();
    updateChart();
    updateDailyChart();
    updateComparisonChart();
  }
}

function updateRecurringExpensesList() {
  const list = document.getElementById('recurringList');
  if (!list) return;

  list.innerHTML = '';

  if (appData.recurringExpenses.length === 0) {
    const empty = document.createElement('p');
    empty.style.opacity = '0.6';
    empty.style.fontSize = '14px';
    empty.style.textAlign = 'center';
    empty.style.padding = '20px';
    empty.style.color = '#6b7280';
    empty.textContent = t('js.noRecurring');
    list.appendChild(empty);
    return;
  }

  appData.recurringExpenses.forEach(recurring => {
    const item = document.createElement('div');
    item.className = 'recurring-item' + (recurring.isActive ? ' paused' : '');

    const info = document.createElement('div');
    info.className = 'recurring-item-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'recurring-item-name';
    nameEl.textContent = recurring.name;

    const details = document.createElement('div');
    details.className = 'recurring-item-details';
    details.textContent = `${recurring.amount.toLocaleString()}${CURRENCY} · Every ${recurring.dayOfMonth || 1}. in month`;

    info.appendChild(nameEl);
    info.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'recurring-item-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn ' + (recurring.isActive ? 'paused' : 'active');
    toggleBtn.textContent = recurring.isActive ? 'Activated' : 'Activate';
    toggleBtn.onclick = () => toggleRecurringExpense(recurring.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-recurring-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.onclick = () => deleteRecurringExpense(recurring.id);

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function updateRecurringInsight() {
  const insight = document.getElementById('recurringInsight');
  if (!insight) return;

  const totalRecurring = appData.recurringExpenses
    .filter(r => r.isActive)
    .reduce((sum, r) => sum + r.amount, 0);

  const income = appData.income || 0;

  if (income === 0 || totalRecurring === 0) {
    insight.style.display = 'none';
    return;
  }

  const percentage = Math.round((totalRecurring / income) * 100);
  insight.style.display = 'block';
  insight.textContent = `Recurring expenses are ${percentage}% of your income`;
}

let selectedRecurringDay = null;

function initDayPicker() {
  const btn = document.getElementById('recurringDayBtn');
  const popup = document.getElementById('dayPickerPopup');
  if (!btn || !popup) return;

  // Build day grid
  popup.innerHTML = '';
  for (let d = 1; d <= 31; d++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.textContent = d;
    cell.onclick = (e) => {
      e.stopPropagation();
      selectedRecurringDay = d;
      document.getElementById('recurringDayLabel').textContent = d + '. in month';
      btn.classList.add('selected');
      popup.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
      cell.classList.add('active');
      popup.style.display = 'none';
    };
    popup.appendChild(cell);
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    popup.style.display = popup.style.display === 'none' ? 'grid' : 'none';
  };

  document.addEventListener('click', () => { popup.style.display = 'none'; });
}

function initRecurringExpenses() {
  const addBtn = document.getElementById('addRecurringBtn');

  initDayPicker();

  // Add button
  if (addBtn) {
    addBtn.onclick = () => {
      const name = document.getElementById('recurringName').value.trim();
      const amount = document.getElementById('recurringAmount').value;
      const day = selectedRecurringDay || 1;
      addRecurringExpense(name, amount, day);
    };
  }

  // Check and add recurring expenses on load
  checkPayDay();
  checkAndAddRecurringExpenses();
  updateRecurringExpensesList();
  updateRecurringInsight();
}

// ===== TRANSACTION TAGS =====
let activeTagFilter = 'all';

function getAllTags() {
  const tagCounts = {};
  appData.expenses.forEach(exp => {
    if (exp.type === 'income' || exp.type === 'savings') return;
    if (exp.tags && Array.isArray(exp.tags)) {
      exp.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  return tagCounts;
}

function getSpendingByTag(tag) {
  return appData.expenses
    .filter(exp => {
      if (exp.type === 'income' || exp.type === 'savings') return false;
      return exp.tags && exp.tags.includes(tag);
    })
    .reduce((sum, exp) => sum + exp.amount, 0);
}

function getTagsSortedByRecency() {
  // Build tag → {count, latestTimestamp}
  const tagMeta = {};
  appData.expenses.forEach(exp => {
    if (exp.type === 'income' || exp.type === 'savings') return;
    if (!exp.tags || !Array.isArray(exp.tags)) return;
    exp.tags.forEach(tag => {
      if (!tagMeta[tag]) tagMeta[tag] = { count: 0, ts: 0 };
      tagMeta[tag].count++;
      if ((exp.timestamp || 0) > tagMeta[tag].ts) tagMeta[tag].ts = exp.timestamp || 0;
    });
  });
  // Sort by most recently used
  return Object.entries(tagMeta)
    .sort((a, b) => b[1].ts - a[1].ts)
    .map(([tag, meta]) => [tag, meta.count]);
}

function updatePopularTags() {
  const container = document.getElementById('popularTags');
  if (!container) return;

  const allTags = getTagsSortedByRecency();
  const PREVIEW = 4;
  const isAll = activeTagFilter === 'all';
  const showExpanded = container.dataset.expanded === '1';
  const prevCount = container.querySelectorAll('.tag-filter-btn:not(.tag-show-all-btn)').length;

  container.innerHTML = '';

  const tagsToShow = (isAll && !showExpanded && allTags.length > PREVIEW)
    ? allTags.slice(0, PREVIEW)
    : allTags;

  tagsToShow.forEach(([tag, count], i) => {
    const btn = document.createElement('button');
    const isNew = showExpanded && i >= PREVIEW;
    btn.className = 'tag-filter-btn' + (activeTagFilter === tag ? ' active' : '') + (isNew ? ' animated' : '');
    if (isNew) btn.style.animationDelay = ((i - PREVIEW) * 0.05) + 's';
    btn.dataset.tag = tag;
    btn.textContent = `${tag} (${count})`;
    btn.onclick = () => filterByTag(tag);
    container.appendChild(btn);
  });

  if (isAll && allTags.length > PREVIEW) {

    const showAllBtn = document.createElement('button');
    showAllBtn.className = 'tag-filter-btn tag-show-all-btn';
    const label = typeof t === 'function' ? (showExpanded ? t('js.showLess') : t('dash.showAll')) : (showExpanded ? 'Show less' : 'Show all');
    showAllBtn.innerHTML = `${label} <i class="fa-solid fa-chevron-down" style="font-size:10px;margin-left:2px;transform:rotate(${showExpanded?'180':'0'}deg);"></i>`;
    showAllBtn.onclick = () => {
      container.dataset.expanded = showExpanded ? '' : '1';
      updatePopularTags();
    };
    container.appendChild(showAllBtn);
  } else if (!isAll) {
    delete container.dataset.expanded;
  }
}

function filterByTag(tag) {
  activeTagFilter = tag;

  // Re-render tag list so active states + collapse/expand are correct
  updatePopularTags();

  // Re-sync "All" button active state (it's static HTML, not inside popularTags)
  const allBtn = document.querySelector('.tag-filter-btn[data-tag="all"]');
  if (allBtn) allBtn.classList.toggle('active', tag === 'all');

  // Update insight
  updateTagInsight(tag);
  
  // Update chart to show only filtered expenses
  if (tag === 'all') {
    // Reset to show all expenses
    const { labels, data, colors, isEmpty } = buildChartData();
    
    if (chartInstance) {
      chartInstance.destroy();
    }

    const ctx = document.getElementById('spendingChart');
    if (!ctx) return;

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 12, family: 'Inter' },
              color: '#374151'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 14, family: 'Inter' },
            bodyFont: { size: 13, family: 'Inter' },
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed.toLocaleString() + getCurrency();
              }
            }
          }
        }
      }
    });
  } else {
    updateChartWithTagFilter(tag);
  }
}

function updateChartWithTagFilter(tag) {
  const ctx = document.getElementById('spendingChart');
  if (!ctx) return;

  const filteredExpenses = appData.expenses.filter(exp => {
    if (exp.type === 'income' || exp.type === 'savings') return false;
    return exp.tags && exp.tags.includes(tag);
  });

  // Get categories from filtered expenses
  const categoriesWithTag = new Set();
  filteredExpenses.forEach(exp => categoriesWithTag.add(exp.category));

  // Calculate spending for entire categories, not just tagged expenses
  const categorySpending = {};
  appData.expenses.forEach(exp => {
    if (exp.type === 'income' || exp.type === 'savings') return;
    if (categoriesWithTag.has(exp.category)) {
      categorySpending[exp.category] = (categorySpending[exp.category] || 0) + exp.amount;
    }
  });

  const hasData = Object.keys(categorySpending).length > 0;

  let labels, data, colors;
  if (!hasData) {
    labels = ['No data'];
    data = [1];
    colors = ['#e5e7eb'];
  } else {
    const engKeys = Object.keys(categorySpending);
    labels = engKeys.map(cat => typeof tCat === 'function' ? tCat(cat) : cat);
    data = Object.values(categorySpending);
    colors = engKeys.map(cat => chartColors[cat] || '#95a5a6');
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: { size: 12, family: 'Inter' },
            color: '#374151'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleFont: { size: 14, family: 'Inter' },
          bodyFont: { size: 13, family: 'Inter' },
          callbacks: {
            label: function(context) {
              return context.label + ': ' + context.parsed.toLocaleString() + getCurrency();
            }
          }
        }
      }
    }
  });
}

function updateTagInsight(tag) {
  const insight = document.getElementById('tagInsight');
  if (!insight) return;

  if (tag === 'all') {
    const allTags = getTagsSortedByRecency();
    if (allTags.length === 0) { insight.style.display = 'none'; return; }
    const PREVIEW = 4;
    const isExpanded = insight.dataset.expanded === '1';
    insight.style.display = 'block';

    const makeRow = ([tg, count]) => {
      const spending = getSpendingByTag(tg);
      return `<div class="tag-insight-row">
        <span class="tag-insight-name">${tg} <span class="tag-insight-count">(${count})</span></span>
        <span class="tag-insight-amount">${spending.toLocaleString()}${CURRENCY}</span>
      </div>`;
    };

    const previewRows = allTags.slice(0, PREVIEW).map(makeRow).join('');
    const extraRows = allTags.length > PREVIEW
      ? `<div class="tag-insight-extra${isExpanded ? ' open' : ''}" id="tagInsightExtra">
          ${allTags.slice(PREVIEW).map(makeRow).join('')}
        </div>`
      : '';
    const showBtn = allTags.length > PREVIEW
      ? `<button class="tag-insight-show-all" id="tagInsightShowAll" onclick="
          var ex=document.getElementById('tagInsightExtra');
          var el=document.getElementById('tagInsight');
          var open=ex.classList.toggle('open');
          el.dataset.expanded=open?'1':'';
          var icon=this.querySelector('i');
          icon.style.transform=open?'rotate(180deg)':'rotate(0deg)';
          this.childNodes[0].textContent=open?'${typeof t==='function'?t('js.showLess'):'Show less'} ':'${typeof t==='function'?t('dash.showAll'):'Show all'} ';
        "><span>${isExpanded ? (typeof t==='function'?t('js.showLess'):'Show less') : (typeof t==='function'?t('dash.showAll'):'Show all')} </span><i class="fa-solid fa-chevron-down" style="font-size:10px;transition:transform 0.25s ease;transform:rotate(${isExpanded?'180':'0'}deg);"></i></button>`
      : '';

    insight.innerHTML = previewRows + extraRows + showBtn;
    return;
  }

  const spending = getSpendingByTag(tag);
  if (spending === 0) {
    insight.style.display = 'none';
    return;
  }

  insight.style.display = 'block';
  insight.innerHTML = `<div class="tag-insight-row">
    <span class="tag-insight-name">${tag}</span>
    <span class="tag-insight-amount">${spending.toLocaleString()}${CURRENCY}</span>
  </div>`;
}

function updateTagsUI() {
  updatePopularTags();
  updateTagInsight(activeTagFilter);
  
  // Add event listener to "All" button
  const allBtn = document.querySelector('.tag-filter-btn[data-tag="all"]');
  if (allBtn) {
    allBtn.onclick = () => filterByTag('all');
  }
}

// Smart Suggestions Functions
function updateSmartSuggestions() {
  const suggestionsList = document.getElementById('suggestionsList');
  if (!suggestionsList) return;

  const suggestions = generateSmartSuggestions();

  if (suggestions.length === 0) {
    const isDark = document.documentElement.classList.contains('dark-theme');
    suggestionsList.innerHTML = '<div style="padding:12px;border-radius:8px;text-align:center;font-size:13px;font-style:italic;background:' + (isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb') + ';color:' + (isDark ? '#94a3b8' : '#9ca3af') + ';">Add expenses to see personalized insights</div>';
    return;
  }

  suggestionsList.innerHTML = '';
  const isDark = document.documentElement.classList.contains('dark-theme');
  suggestions.forEach(suggestion => {
    const isWarn = suggestion.type === 'warning';
    const itemBg = isDark
      ? (isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)')
      : (isWarn ? 'linear-gradient(135deg,#fef3c7,#fde68a)' : 'linear-gradient(135deg,#d1fae5,#a7f3d0)');
    const itemBorder = isWarn ? '#f59e0b' : '#10b981';
    const textColor = isDark
      ? (isWarn ? '#fbbf24' : '#34d399')
      : (isWarn ? '#92400e' : '#065f46');

    const item = document.createElement('div');
    // Use setAttribute to avoid being overridden by CSS !important rules
    item.setAttribute('style',
      'padding:14px 16px;border-radius:10px;border-left:4px solid ' + itemBorder + ';' +
      'background:' + itemBg + ';margin-bottom:4px;'
    );

    const text = document.createElement('div');
    text.setAttribute('style',
      'font-size:14px;font-weight:600;line-height:1.5;color:' + textColor + ';'
    );
    text.textContent = suggestion.text;

    item.appendChild(text);
    suggestionsList.appendChild(item);
  });
}

function generateSmartSuggestions() {
  const suggestions = [];
  const expenses = appData.expenses.filter(exp => exp.type !== 'income' && exp.type !== 'savings');
  
  if (expenses.length === 0) {
    return suggestions;
  }

  // Calculate spending by category (all time)
  const categorySpending = {};
  expenses.forEach(exp => {
    categorySpending[exp.category] = (categorySpending[exp.category] || 0) + exp.amount;
  });

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  // Sort categories by spending
  const sortedCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1]);

  // Suggestion 1: Reduce top spending category by 20%
  if (sortedCategories.length > 0) {
    const [categoryName, categoryAmount] = sortedCategories[0];
    const savings = Math.round(categoryAmount * 0.2);
    if (categoryAmount > 0) {
      suggestions.push({
        type: 'normal',
        text: t('js.reduceSuggestion', [categoryName, savings.toLocaleString() + getCurrency()])
      });
    }
  }

  // Suggestion 2: Income-based checks (only if income is set)
  if (appData.income > 0) {
    sortedCategories.forEach(([category, amount]) => {
      const percentage = (amount / appData.income) * 100;
      if (percentage > 30) {
        suggestions.push({
          type: 'warning',
          text: t('js.aboveRecommended', [category, percentage.toFixed(0)])
        });
      }
    });

    const spendingPercentage = (totalSpent / appData.income) * 100;
    if (spendingPercentage > 80) {
      suggestions.push({
        type: 'warning',
        text: t('js.spendingTooHigh', [spendingPercentage.toFixed(0)])
      });
    }

    const currentSavings = getSavings();
    const recommendedSavings = Math.round(appData.income * 0.2);
    if (currentSavings < recommendedSavings) {
      const difference = recommendedSavings - currentSavings;
      suggestions.push({
        type: 'normal',
        text: t('js.savingsGoal', [difference.toLocaleString() + getCurrency()])
      });
    }
  }

  // Suggestion 3: Recurring expenses
  const recurringTotal = appData.recurringExpenses
    .filter(r => r.isActive)
    .reduce((sum, r) => sum + r.amount, 0);
  if (recurringTotal > 0 && totalSpent > 0) {
    const recurringPercentage = (recurringTotal / totalSpent) * 100;
    if (recurringPercentage > 60) {
      suggestions.push({
        type: 'warning',
        text: t('js.recurringTooHigh', [recurringPercentage.toFixed(0)])
      });
    }
  }

  // Fallback: always show at least one insight
  if (suggestions.length === 0 && sortedCategories.length > 0) {
    const [topCat, topAmt] = sortedCategories[0];
    const pct = totalSpent > 0 ? ((topAmt / totalSpent) * 100).toFixed(0) : 0;
    suggestions.push({
      type: 'normal',
      text: `${topCat} is your top spending category at ${pct}% of total spending.`
    });
  }

  return suggestions.slice(0, 4);
}

function updateMonthlySummary() {
  const totalSpent = getTotalSpent();
  const income = appData.income;
  const savings = getSavings();
  const saveRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  document.getElementById('summarySpent').textContent = totalSpent.toLocaleString() + getCurrency();
  document.getElementById('summaryIncome').textContent = income.toLocaleString() + getCurrency();
  document.getElementById('summarySavings').textContent = savings.toLocaleString() + getCurrency();
  document.getElementById('summarySaveRate').textContent = saveRate + '%';
}

// Initial dashboard update
try { loadCalendarState(); } catch(e) {}
checkOnboarding();
try { updateDashboard(); } catch(e) { console.error('Initial updateDashboard error:', e); }
// === DEBUG badge ===
try { var _d=document.getElementById('__js_debug'); if(_d){_d.style.background='#22c55e';_d.textContent='JS:OK \u2713';} } catch(_) {}
// === END DEBUG ===

// WKWebView repaint fix: re-render after first paint to ensure dynamic content is visible
// (WKWebView sometimes skips painting JS-inserted DOM nodes added during script execution)
setTimeout(() => {
  try { updateDashboard(); } catch(e) {}
}, 80);

// Initialize chart after a small delay — runs unconditionally regardless of above errors
function initAllCharts() {
  try { initChart(); } catch(e) { console.error('initChart:', e); }
  try { initDailyChart(); } catch(e) {}
  try { initComparisonChart(); } catch(e) {}
  try { initRecurringExpenses(); } catch(e) {}
  try { updateTagsUI(); } catch(e) {}
  // Force resize for Android/iOS WebView after layout settles
  setTimeout(() => {
    try { if (chartInstance) chartInstance.resize(); } catch(e) {}
  }, 300);
}
setTimeout(initAllCharts, 400);

// Re-render dynamic JS content when language changes
window.addEventListener('languageChanged', () => {
  try { renderMenu(); } catch(e) {}
  try { updateDashboard(); } catch(e) {}
  try { updateInsights(); } catch(e) {}
  try { updateSpendingCalendar(); } catch(e) {}
  try { updateTopSpendingDays(); } catch(e) {}
  try { updateRecurringExpensesList(); } catch(e) {}
  try { updateRecurringInsight(); } catch(e) {}
  try { updateCategoryLimits(); } catch(e) {}
  try { updateTagsUI(); } catch(e) {}
  try { updateSmartSuggestions(); } catch(e) {}
  if (typeof updateChart === 'function') try { updateChart(); } catch(e) {}
  if (typeof initComparisonChart === 'function') try { initComparisonChart(); } catch(e) {}
});

try { enqueueMissingWalletSync(); } catch(e) {}
try { flushWalletSyncQueue(); } catch(e) {}
setInterval(() => {
  try { flushWalletSyncQueue(); } catch(e) {}
}, 8000);
// Footer navigation - smooth scroll
document.querySelectorAll('.footer-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const targetId = this.getAttribute('href').substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== ONBOARDING =====
async function checkOnboarding() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) return;
    
    const user = await res.json();
    
    console.log('User onboarding status:', user.onboarding_completed);
    
    // Check if user has completed onboarding (0 or null means not completed)
    if (!user.onboarding_completed || user.onboarding_completed === 0) {
      showOnboardingModal(user);
    } else {
      // If user has completed onboarding, sync income and current balance with app data
      if (user.monthly_income) {
        appData.income = user.monthly_income;
      }
      if (user.current_balance !== undefined && user.current_balance !== null) {
        appData.currentBalance = user.current_balance;
      }
      saveData();
      updateDashboard();
    }
  } catch (error) {
    console.error('Error checking onboarding:', error);
  }
}

function showOnboardingModal(user) {
  const modal = document.getElementById('onboardingModal');
  const nameInput = document.getElementById('onboardingName');
  const incomeInput = document.getElementById('onboardingIncome');
  const balanceInput = document.getElementById('onboardingBalance');
  const completeBtn = document.getElementById('completeOnboardingBtn');
  
  console.log('Showing onboarding modal');
  
  if (!modal) {
    console.error('Onboarding modal not found!');
    return;
  }
  
  // Pre-fill name if available
  if (user.name) {
    nameInput.value = user.name;
  }
  
  // Show modal with flexbox display
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => modal.classList.add('active'), 10);
  
  // Handle completion
  completeBtn.onclick = async () => {
    const name = nameInput.value.trim();
    const monthlyIncome = parseFloat(incomeInput.value) || 0;
    const currentBalance = parseFloat(balanceInput.value) || 0;
    
    if (!name) {
      alert('Please enter your name.');
      return;
    }
    
    if (monthlyIncome <= 0) {
      alert('Please enter a valid monthly income.');
      return;
    }
    
    if (currentBalance < 0) {
      alert('Please enter a valid current balance.');
      return;
    }
    
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_BASE}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          monthlyIncome,
          currentBalance
        })
      });
      
      if (!res.ok) {
        throw new Error('Failed to complete onboarding');
      }
      
      // Reset all local data for new user
      appData = {
        income: monthlyIncome,
        currentBalance: currentBalance,
        expenses: [],
        categories: ["Food", "Transport", "Rent", "Entertainment"],
        categoryLimits: {},
        categoryColors: {},
        savingsTotal: 0,
        recurringExpenses: [],
        lastMonthCheck: new Date().getMonth(),
        lastPayDayMonth: '',
        _cleared: true
      };
      saveData();
      
      // Close modal
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      
      // Refresh dashboard with all new data
      updateDashboard();
      updateSpendingCalendar();
      updateTopSpendingDays();
      initChart();
      initDailyChart();
      updateBudgetProgress();
      updateSmartSuggestions();
      
      // Show success message
      setTimeout(() => {
        alert(`✅ Welcome ${name}! Your account has been set up successfully.\n\n💰 Monthly Income: ${monthlyIncome.toLocaleString()} RSD\n💵 Current Balance: ${currentBalance.toLocaleString()} RSD`);
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Failed to complete setup. Please try again.');
    }
  };
}

function toggleCharts() {
  const modal = document.getElementById('chartsModal');
  if (!modal) return;
  modal.classList.add('active');

  // Use fixed positioning on the content card directly —
  // this bypasses the parent layout mode entirely
  const content = modal.querySelector('.charts-modal-content');
  if (content) {
    content.style.position = 'fixed';
    content.style.left = '0';
    content.style.right = '0';
    content.style.transform = 'none';
    content.style.width = '92vw';
    content.style.marginLeft = 'auto';
    content.style.marginRight = 'auto';
    content.style.bottom = '20px';
    content.style.top = 'auto';
    content.style.maxHeight = '60vh';
    content.style.height = 'auto';
    content.style.borderRadius = '18px 18px 0 0';
    content.style.zIndex = '1001';
    content.style.overflowY = 'hidden';
  }

  setTimeout(() => {
    if (typeof initDailyChart === 'function') initDailyChart();
    if (typeof initComparisonChart === 'function') initComparisonChart();
  }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
  function closeChartsModal() {
    const modal = document.getElementById('chartsModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.alignItems = '';
    modal.style.paddingTop = '';
    modal.style.paddingBottom = '';
    const content = modal.querySelector('.charts-modal-content');
    if (content) {
      content.style.position = '';
      content.style.left = '';
      content.style.right = '';
      content.style.transform = '';
      content.style.width = '';
      content.style.marginLeft = '';
      content.style.marginRight = '';
      content.style.bottom = '';
      content.style.top = '';
      content.style.maxHeight = '';
      content.style.height = '';
      content.style.borderRadius = '';
      content.style.zIndex = '';
      content.style.overflowY = '';
    }
  }
  const closeBtn = document.getElementById('chartsModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeChartsModal);
  const chartsModal = document.getElementById('chartsModal');
  if (chartsModal) {
    chartsModal.addEventListener('click', (e) => {
      if (e.target === chartsModal) closeChartsModal();
    });
  }
  const trackLimitsModal = document.getElementById('trackLimitsModal');
  const trackLimitsClose = document.getElementById('trackLimitsModalClose');
  if (trackLimitsClose) trackLimitsClose.addEventListener('click', () => { trackLimitsModal.style.display = 'none'; });
  if (trackLimitsModal) trackLimitsModal.addEventListener('click', (e) => { if (e.target === trackLimitsModal) trackLimitsModal.style.display = 'none'; });
});

function openTrackLimitsModal() {
  const modal = document.getElementById('trackLimitsModal');
  if (modal) {
    updateBudgetProgress();
    modal.style.display = 'flex';
  }
}

// Expose functions used by inline onclick handlers in HTML
window.toggleCharts = toggleCharts;
window.openEditLimitsModal = openEditLimitsModal;
window.openTrackLimitsModal = openTrackLimitsModal;

})(); // end IIFE
