// ===== DATA MANAGEMENT =====
const DEFAULT_MONTHLY_INCOME = 100000;
const CURRENCY = " RSD";
const API_BASE = 'http://localhost:4000/api';
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
      _cleared: true
    };
    localStorage.setItem('expenseTrackerData', JSON.stringify(data));
  } else {
    data = JSON.parse(data);
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

// Reset all data (for testing)
function resetAllData() {
  if (confirm('⚠️ Are you sure you want to reset ALL data? This will delete all expenses, transactions, friends, wallets, and settings!\n\nOnly your income and current balance will be kept.')) {
    // Reset local data
    appData = {
      income: appData.income,
      currentBalance: appData.currentBalance,
      expenses: [],
      categories: ["Food", "Transport", "Rent", "Entertainment"],
      categoryLimits: {},
      categoryColors: {},
      savingsTotal: 0,
      recurringExpenses: [],
      lastMonthCheck: new Date().getMonth(),
      _cleared: true
    };
    saveData();
    
    // Reset backend data (friends, wallets, invites)
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch(`${API_BASE}/reset-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }).then(res => {
        if (res.ok) {
          // Refresh all UI
          updateDashboard();
          updateChart();
          updateSpendingCalendar();
          updateTopSpendingDays();
          initDailyChart();
          updateBudgetProgress();
          updateSmartSuggestions();
          
          // Reload page to refresh shared/friends data
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }).catch(err => {
        console.error('Reset error:', err);
        alert('❌ Failed to reset some data. Please try again.');
      });
    } else {
      // Offline mode - just refresh UI
      updateDashboard();
      updateChart();
      updateSpendingCalendar();
      updateTopSpendingDays();
      initDailyChart();
      updateBudgetProgress();
      updateSmartSuggestions();
      alert('✅ All local data has been reset!');
    }
  }
}

// ===== CALCULATIONS =====
function getTotalSpent() {
  return appData.expenses.reduce((sum, exp) => {
    if (exp.type === 'income' || exp.type === 'savings') return sum;
    return sum + exp.amount;
  }, 0);
}

function getSavings() {
  // Balance = Current Balance - Total Spent this month
  const totalSpent = getTotalSpent();
  if (appData.currentBalance !== undefined) {
    return appData.currentBalance - totalSpent;
  }
  // Fallback untuk stare podatke
  return appData.income - totalSpent + (appData.savingsTotal || 0);
}

function getSpendingByCategory() {
  const categorySpending = {};
  appData.expenses.forEach(exp => {
    if (exp.type === 'income' || exp.type === 'savings') return;
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
    spendingsTopCategory.textContent = top ? `${top[0]} · ${top[1].toLocaleString()}${CURRENCY}` : '—';
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
    spendingsCategories.innerHTML = '<div class="spendings-empty">Nema podataka za izabrane filtere.</div>';
    return;
  }
  spendingsCategories.innerHTML = entries.map(([name, amount]) => {
    return `
      <div class="spendings-category-item">
        <span class="spendings-category-name">${name}</span>
        <span class="spendings-category-amount">-${amount.toLocaleString()}${CURRENCY}</span>
      </div>
    `;
  }).join('');
}

function renderSpendingsTransactions(expenses) {
  if (!spendingsTransactions) return;
  if (expenses.length === 0) {
    spendingsTransactions.innerHTML = '<li class="spendings-empty">Nema transakcija za izabrane filtere.</li>';
    return;
  }
  spendingsTransactions.innerHTML = expenses.map(exp => {
    const date = exp.date || new Date(exp.timestamp).toLocaleDateString('sr-RS');
    const time = exp.time || new Date(exp.timestamp).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
    return `
      <li class="spendings-transaction-item">
        <div class="spendings-transaction-meta">
          <span class="spendings-transaction-title">${exp.category}</span>
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
      const label = opt === 'all' ? 'All' : opt;
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
    d.textContent = cat;
    menu.appendChild(d);
  });
  const add = document.createElement('div');
  add.className = 'option add-option';
  add.dataset.add = 'true';
  add.textContent = '+ Add category';
  menu.appendChild(add);
}

renderMenu();

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
  const category = selected.textContent;

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
    date: now.toLocaleDateString('sr-RS'),
    time: now.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }),
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
});

// ===== ADD SAVINGS FUNCTIONALITY =====
const savingsInput = document.getElementById('savingsInput');
const addSavingsBtn = document.querySelector('.add-savings .primary-success');

addSavingsBtn.addEventListener('click', async () => {
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
    date: now.toLocaleDateString('sr-RS'),
    time: now.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }),
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
  alert('✅ Ušteda dodana: ' + amount.toLocaleString() + CURRENCY);

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
  const totalSpent = getTotalSpent();
  const remaining = getSavings();
  
  const sidebarSpent = document.getElementById('sidebarSpent');
  const sidebarRemaining = document.getElementById('sidebarRemaining');
  
  if (sidebarSpent) {
    sidebarSpent.textContent = totalSpent.toLocaleString() + CURRENCY;
  }
  if (sidebarRemaining) {
    sidebarRemaining.textContent = remaining.toLocaleString() + CURRENCY;
  }
}

// ===== UPDATE DASHBOARD =====
function updateDashboard() {
  // Update Total Spent
  document.querySelectorAll('.summary-cards .card:nth-child(1) .amount')[0].textContent = 
    getTotalSpent().toLocaleString() + CURRENCY;

  // Update Income
  document.querySelectorAll('.summary-cards .card:nth-child(2) .amount')[0].textContent = 
    appData.income.toLocaleString() + CURRENCY;

  // Update Savings
  document.querySelectorAll('.summary-cards .card:nth-child(3) .amount')[0].textContent = 
    getSavings().toLocaleString() + CURRENCY;

  // Update sidebar stats
  updateSidebarStats();

  // Update Recent Transactions
  updateRecentTransactions();

  // Update Chart Stats
  updateChartStats();

  // Update Category Limits
  updateCategoryLimits();

  // Update Insights
  updateInsights();

  // Update Spending Calendar
  updateSpendingCalendar();

  // Update Top Spending Days
  updateTopSpendingDays();

  // Update Budget Progress
  updateBudgetProgress();

  // Update Smart Suggestions
  updateSmartSuggestions();
}

function updateRecentTransactions() {
  const txList = document.querySelector('.transactions ul');
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
      amountSpan.textContent = '+' + exp.amount.toLocaleString() + CURRENCY;
      nameSpan.textContent = exp.category || 'Income';
    } else if (exp.type === 'savings') {
      amountSpan.classList.add('income');
      amountSpan.textContent = '+' + exp.amount.toLocaleString() + CURRENCY;
      nameSpan.textContent = exp.category || 'Savings';
    } else {
      amountSpan.textContent = '-' + exp.amount.toLocaleString() + CURRENCY;
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
  const total = getTotalSpent();

  statsContainer.innerHTML = '';

  if (Object.keys(spending).length === 0) {
    statsContainer.innerHTML = '<p style="grid-column: 1/-1; opacity: 0.5;">No expenses yet</p>';
    updateLimitWarnings([]);
    return;
  }

  const overLimit = getCategoriesOverLimit(spending);
  updateLimitWarnings(overLimit);

  Object.keys(spending).forEach(category => {
    const amount = spending[category];
    const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
    const color = getCategoryColor(category);

    const statItem = document.createElement('div');
    statItem.className = 'chart-stat-item';

    const label = document.createElement('span');
    label.className = 'stat-label';
    label.innerHTML = `<span class="stat-color" style="background: ${color}"></span>${category}`;

    const amountSpan = document.createElement('span');
    amountSpan.className = 'stat-amount';
    amountSpan.textContent = amount.toLocaleString() + CURRENCY;

    const percentSpan = document.createElement('span');
    percentSpan.className = 'stat-percent';
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
let limitsEditMode = false;
let limitsExpanded = false;
let limitsScrollPosition = 0;

function updateCategoryLimits() {
  const limitsContainer = document.querySelector('.limits-list');
  const showAllBtn = document.getElementById('limitsShowAll');
  if (!limitsContainer) return;

  limitsContainer.innerHTML = '';
  
  const categoriesToShow = limitsExpanded ? appData.categories : appData.categories.slice(0, 3);
  const hasMore = appData.categories.length > 3;

  categoriesToShow.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'limit-item';
    item.dataset.category = cat;
    
    const color = getCategoryColor(cat);

    const categoryName = document.createElement('span');
    categoryName.className = 'limit-category-name';
    categoryName.innerHTML = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>${cat}`;

    const limitValue = document.createElement('span');
    limitValue.className = 'limit-value';
    
    if (appData.categoryLimits[cat]) {
      limitValue.textContent = appData.categoryLimits[cat].toLocaleString() + CURRENCY;
      
      // Add delete button for existing limits (only visible in edit mode)
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'limit-delete-btn';
      if (!limitsEditMode) {
        deleteBtn.style.display = 'none';
      }
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      deleteBtn.title = 'Delete limit';
      deleteBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        deleteCategoryLimit(cat);
      });
      item.appendChild(categoryName);
      item.appendChild(limitValue);
      item.appendChild(deleteBtn);
    } else {
      limitValue.textContent = 'Set limit';
      limitValue.style.opacity = '0.5';
      item.appendChild(categoryName);
      item.appendChild(limitValue);
    }

    limitsContainer.appendChild(item);

    // Click handler to show input (disabled in edit mode)
    if (!limitsEditMode) {
      item.addEventListener('click', (evt) => {
        showLimitInput(cat, item, evt);
      });
    }
  });
  
  // Show/hide the expand button
  if (showAllBtn) {
    showAllBtn.style.display = hasMore ? 'flex' : 'none';
  }
}

function toggleLimitsExpanded() {
  const limitsSection = document.querySelector('.category-limits-compact');
  const limitsList = document.querySelector('.limits-list');
  
  limitsExpanded = !limitsExpanded;
  const showAllText = document.getElementById('showAllText');
  const showAllIcon = document.getElementById('showAllIcon');
  
  if (limitsExpanded) {
    if (showAllText) showAllText.textContent = 'Show less';
    if (showAllIcon) showAllIcon.style.transform = 'rotate(180deg)';
    updateCategoryLimits();
  } else {
    if (showAllText) showAllText.textContent = 'Show all';
    if (showAllIcon) showAllIcon.style.transform = 'rotate(0deg)';
    
    // Start scroll animation
    if (limitsSection) {
      limitsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Add collapsing class for animation
    if (limitsList) {
      limitsList.classList.add('collapsing');
    }
    
    // Update content after scroll completes
    setTimeout(() => {
      updateCategoryLimits();
      if (limitsList) {
        limitsList.classList.remove('collapsing');
      }
    }, 600);
    return;
  }
}

function toggleLimitsEditMode() {
  limitsEditMode = !limitsEditMode;
  const editBtn = document.getElementById('editLimitsBtn');
  const limitsSection = document.querySelector('.category-limits-compact');
  const backdrop = document.getElementById('limitsBackdrop');
  
  if (limitsEditMode) {
    editBtn.textContent = 'Done';
    editBtn.classList.add('active');
    limitsSection.classList.add('edit-mode');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  } else {
    editBtn.textContent = 'Edit Limits';
    editBtn.classList.remove('active');
    limitsSection.classList.remove('edit-mode');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  updateCategoryLimits();
}

// Initialize edit button
document.addEventListener('DOMContentLoaded', () => {
  const editBtn = document.getElementById('editLimitsBtn');
  if (editBtn) {
    editBtn.addEventListener('click', toggleLimitsEditMode);
  }
  
  const showAllBtn = document.getElementById('limitsShowAll');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', toggleLimitsExpanded);
  }
  
  const backdrop = document.getElementById('limitsBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      if (limitsEditMode) {
        toggleLimitsEditMode();
      }
    });
  }
});

function showLimitInput(category, itemElement, evt) {
  const isEditing = itemElement.classList.contains('editing');
  const isSafeTarget = evt && (evt.target.closest('.limit-input') || evt.target.closest('.limit-save-btn') || evt.target.closest('.limit-cancel-btn'));

  // Toggle close if already open and the click is outside the input/actions
  if (isEditing && !isSafeTarget) {
    updateCategoryLimits();
    return;
  }

  itemElement.classList.add('editing');

  // Clear existing content
  itemElement.innerHTML = '';
  itemElement.style.flexDirection = 'column';
  itemElement.style.gap = '8px';

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'limit-actions-row';

  const input = document.createElement('input');
  input.type = 'number';
  input.placeholder = 'Enter limit';
  input.className = 'limit-input';
  input.value = appData.categoryLimits[category] || '';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'limit-save-btn limit-action-btn';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'limit-cancel-btn limit-action-btn';

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(saveBtn);
  inputWrapper.appendChild(cancelBtn);

  const categoryLabel = document.createElement('span');
  categoryLabel.textContent = category;
  categoryLabel.style.fontSize = '13px';
  categoryLabel.style.fontWeight = '500';
  categoryLabel.style.color = '#64748b';

  itemElement.appendChild(categoryLabel);
  itemElement.appendChild(inputWrapper);

  // Prevent inner clicks from toggling the card closed
  [input, saveBtn, cancelBtn].forEach(el => {
    el.addEventListener('click', (e) => e.stopPropagation());
  });

  // Auto-focus input
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  // Save on button click
  saveBtn.addEventListener('click', () => {
    saveCategoryLimit(category, input.value);
  });

  // Save on Enter key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCategoryLimit(category, input.value);
    }
  });

  // Cancel/close
  cancelBtn.addEventListener('click', () => {
    updateCategoryLimits();
  });
}

function saveCategoryLimit(category, rawValue) {
  const value = parseFloat(rawValue);

  if (!value || value <= 0) {
    alert('Please enter a valid limit');
    return;
  }

  appData.categoryLimits[category] = value;
  saveData();
  updateCategoryLimits();
  updateBudgetProgress();
}

function deleteCategoryLimit(category) {
  if (!confirm(`Delete limit for ${category}?`)) return;
  
  delete appData.categoryLimits[category];
  saveData();
  updateCategoryLimits();
  updateBudgetProgress();
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
    ? 'Najviše trošiš vikendom'
    : 'Najviše trošiš radnim danima';
  addInsight(list, weekendMsg);

  // Insight 2: Entertainment MoM change
  const currCat = getMonthSpendingByCategory(m, y);
  const prevCat = getMonthSpendingByCategory(prevM, prevY);
  const currEnt = currCat['Entertainment'] || 0;
  const prevEnt = prevCat['Entertainment'] || 0;
  let entMsg = 'Entertainment ti je isti kao prošli mesec';
  if (prevEnt > 0) {
    const diffPct = ((currEnt - prevEnt) / prevEnt) * 100;
    const sign = diffPct >= 0 ? '+' : '';
    entMsg = `Entertainment ti je ${sign}${Math.round(diffPct)}% u odnosu na prošli mesec`;
  } else if (currEnt > 0) {
    entMsg = 'Entertainment ti je novi trošak ovog meseca';
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
    span.innerHTML = 'Top 3 najveće transakcije – ' + items.join(' • ');
    insightLi.appendChild(icon);
    insightLi.appendChild(span);
    list.appendChild(insightLi);
  } else {
    addInsight(list, 'Nema troškova ovaj mesec');
  }

  // Insight 4: Predikcija uštede
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const dailyRate = dayOfMonth > 0 ? (totalThisMonth / dayOfMonth) : 0;
  const projectedSpent = Math.round(dailyRate * daysInMonth);
  const predictedSavings = appData.income - projectedSpent + (appData.savingsTotal || 0);
  addInsight(list, `Ako nastaviš ovim tempom, uštedećeš ~${Math.round(predictedSavings).toLocaleString()} RSD`);
}

function addInsight(listEl, text) {
  const li = document.createElement('li');
  li.className = 'insight-item';
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-brain insight-icon';
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
  return {
    labels: Object.keys(chartData),
    data: Object.values(chartData),
    colors: Object.keys(chartData).map(cat => getCategoryColor(cat)),
    isEmpty: false
  };
}

function initChart() {
  const ctx = document.getElementById('spendingChart');
  if (!ctx) return;

  const { labels, data, colors, isEmpty } = buildChartData();

  // Destroy old chart if exists
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
          display: !isEmpty,
          position: 'bottom',
          labels: {
            font: {
              family: "'Inter', sans-serif",
              size: 13,
              weight: '500'
            },
            color: '#0f1724',
            padding: 20,
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 3
          }
        },
        tooltip: {
          enabled: !isEmpty,
          backgroundColor: 'rgba(15, 23, 36, 0.8)',
          padding: 12,
          titleFont: {
            family: "'Inter', sans-serif",
            size: 14,
            weight: '600'
          },
          bodyFont: {
            family: "'Inter', sans-serif",
            size: 13
          },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          borderRadius: 8,
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return value.toLocaleString() + ' RSD (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

function updateChart() {
  if (chartInstance) {
    const { labels, data, colors, isEmpty } = buildChartData();

    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.options.plugins.legend.display = !isEmpty;
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
    const d = new Date(e.timestamp || Date.now());
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dayIdx = d.getDate() - 1;
      data[dayIdx] += e.amount;
    }
  });

  return { labels, data };
}

function getHeatColor(amount) {
  if (!amount || amount <= 0) return '#dbeafe'; // subtle light blue for zero spending
  if (amount < 2000) return '#d9f99d'; // very light green
  if (amount < 10000) return '#86efac'; // light green
  if (amount < 20000) return '#34d399'; // green
  if (amount < 30000) return '#fbbf24'; // amber
  if (amount < 50000) return '#f97316'; // orange
  return '#ef4444'; // red for >= 50k
}

function getDaySpendingBreakdown(year, month, dayNum) {
  const dayExpenses = appData.expenses.filter(e => {
    if (e.type === 'income' || e.type === 'savings') return false;
    const d = new Date(e.timestamp || Date.now());
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
    tooltip.innerHTML = `<div class="tooltip-day">${dayNum}. dan</div><div class="tooltip-empty">Nema troškova</div>`;
  } else {
    let html = `<div class="tooltip-day">${dayNum}. dan</div>`;
    
    // Show savings only if there's income that day
    if (dayIncome > 0) {
      const savedAmount = dayIncome - total;
      if (savedAmount >= 0) {
        html += `<div class="tooltip-savings">💰 Uštedeo: ${savedAmount.toLocaleString()}${CURRENCY}</div>`;
      } else {
        html += `<div class="tooltip-savings-negative">💸 Potrošio više: ${Math.abs(savedAmount).toLocaleString()}${CURRENCY}</div>`;
      }
    }
    
    html += `<div class="tooltip-total">Ukupno potrošeno: ${total.toLocaleString()}${CURRENCY}</div>`;
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
    calendarDateLabel.textContent = displayDate.toLocaleDateString('sr-RS', {
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
        const d = new Date(e.timestamp || Date.now());
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
    empty.textContent = 'Nema troškova još uvek';
    list.appendChild(empty);
    return;
  }

  topDays.forEach(d => {
    const item = document.createElement('div');
    item.className = 'top-day-item';

    const dateEl = document.createElement('span');
    dateEl.className = 'top-day-date';
    dateEl.textContent = d.date.toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', month: 'short' });

    const infoEl = document.createElement('span');
    infoEl.className = 'top-day-info';
    
    const categoryColor = getCategoryColor(d.topCategory);
    infoEl.innerHTML = `Ukupno: ${d.amount.toLocaleString()}${CURRENCY} - Najviše: <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${categoryColor}; color: white; font-weight: 500; font-size: 12px;">${d.topCategory}</span>`;

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
  const labels = [...appData.categories];
  const currentData = labels.map(c => curr[c] || 0);
  const prevData = labels.map(c => prev[c] || 0);
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
        { label: 'Ovaj mesec', data: currentData, backgroundColor: '#34d399', borderRadius: 6, maxBarThickness: 18 },
        { label: 'Prošli mesec', data: prevData, backgroundColor: '#9ca3af', borderRadius: 6, maxBarThickness: 18 }
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
    return;
  }
  const emptyMessage = container.querySelector('[data-empty="true"]');
  if (emptyMessage) emptyMessage.remove();
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
      header.innerHTML = `<span style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 3px; background: ${color};"></span>${cat}</span><span>${spent.toLocaleString()}${CURRENCY} / ${limit.toLocaleString()}${CURRENCY}</span>`;
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
      text.textContent = `Potrošio si ${safePercent}% ${cat} budžeta`;
    }

    seen.add(cat);
  });

  existingItems.forEach((item, cat) => {
    if (!seen.has(cat)) {
      item.remove();
    }
  });
}

// ===== RECURRING EXPENSES =====
function checkAndAddRecurringExpenses() {
  const currentMonth = new Date().getMonth();
  
  // Check if we're in a new month
  if (appData.lastMonthCheck !== currentMonth) {
    // Add all active recurring expenses
    appData.recurringExpenses.forEach(recurring => {
      if (recurring.isActive) {
        const newExpense = {
          id: Date.now() + Math.random(),
          amount: recurring.amount,
          category: recurring.name,
          date: new Date().toLocaleDateString('sr-RS'),
          time: new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          type: 'recurring'
        };
        appData.expenses.push(newExpense);
      }
    });
    
    appData.lastMonthCheck = currentMonth;
    saveData();
  }
}

function addRecurringExpense(name, amount) {
  if (!name || !amount) {
    alert('Popuni naziv i iznos!');
    return;
  }

  const recurring = {
    id: Date.now(),
    name: name,
    amount: parseFloat(amount),
    isActive: true
  };

  appData.recurringExpenses.push(recurring);
  
  // Immediately add to current month expenses
  const newExpense = {
    id: Date.now() + Math.random(),
    amount: parseFloat(amount),
    category: name,
    date: new Date().toLocaleDateString('sr-RS'),
    time: new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    type: 'recurring'
  };
  appData.expenses.push(newExpense);
  
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
}

function toggleRecurringExpense(id) {
  const recurring = appData.recurringExpenses.find(r => r.id === id);
  if (recurring) {
    recurring.isActive = !recurring.isActive;
    saveData();
    updateRecurringExpensesList();
    updateRecurringInsight();
  }
}

function deleteRecurringExpense(id) {
  if (confirm('Obrisati ovaj recurring trošak?')) {
    appData.recurringExpenses = appData.recurringExpenses.filter(r => r.id !== id);
    saveData();
    updateRecurringExpensesList();
    updateRecurringInsight();
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
    empty.textContent = 'Nema recurring troškova';
    list.appendChild(empty);
    return;
  }

  appData.recurringExpenses.forEach(recurring => {
    const item = document.createElement('div');
    item.className = 'recurring-item' + (recurring.isActive ? '' : ' paused');

    const info = document.createElement('div');
    info.className = 'recurring-item-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'recurring-item-name';
    nameEl.textContent = recurring.name;

    const details = document.createElement('div');
    details.className = 'recurring-item-details';
    details.textContent = `${recurring.amount.toLocaleString()}${CURRENCY}`;

    info.appendChild(nameEl);
    info.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'recurring-item-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn ' + (recurring.isActive ? 'active' : 'paused');
    toggleBtn.textContent = recurring.isActive ? 'Active' : 'Paused';
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

  // Calculate total recurring expenses (active only)
  const totalRecurring = appData.recurringExpenses
    .filter(r => r.isActive)
    .reduce((sum, r) => sum + r.amount, 0);

  const totalSpent = getTotalSpent();

  if (totalSpent === 0 || totalRecurring === 0) {
    insight.style.display = 'none';
    return;
  }

  const percentage = Math.round((totalRecurring / totalSpent) * 100);
  insight.style.display = 'block';
  insight.textContent = `Recurring troškovi čine ${percentage}% mesečne potrošnje`;
}

function initRecurringExpenses() {
  const addBtn = document.getElementById('addRecurringBtn');

  // Add button
  if (addBtn) {
    addBtn.onclick = () => {
      const name = document.getElementById('recurringName').value.trim();
      const amount = document.getElementById('recurringAmount').value;
      addRecurringExpense(name, amount);
    };
  }

  // Check and add recurring expenses on load
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

function updatePopularTags() {
  const container = document.getElementById('popularTags');
  if (!container) return;

  const tagCounts = getAllTags();
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  container.innerHTML = '';

  sortedTags.forEach(([tag, count]) => {
    const btn = document.createElement('button');
    btn.className = 'tag-filter-btn' + (activeTagFilter === tag ? ' active' : '');
    btn.dataset.tag = tag;
    btn.textContent = `${tag} (${count})`;
    btn.onclick = () => filterByTag(tag);
    container.appendChild(btn);
  });
}

function filterByTag(tag) {
  activeTagFilter = tag;
  
  // Update button states
  document.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === tag);
  });

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
                return context.label + ': ' + context.parsed.toLocaleString() + CURRENCY;
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
    labels = Object.keys(categorySpending);
    data = Object.values(categorySpending);
    colors = labels.map(cat => chartColors[cat] || '#95a5a6');
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
              return context.label + ': ' + context.parsed.toLocaleString() + CURRENCY;
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
    insight.style.display = 'none';
    return;
  }

  const spending = getSpendingByTag(tag);
  if (spending === 0) {
    insight.style.display = 'none';
    return;
  }

  const emoji = tag.includes('kafa') || tag.includes('coffee') ? '☕' :
                tag.includes('posao') || tag.includes('work') ? '💼' :
                tag.includes('putovanje') || tag.includes('travel') ? '✈️' : '💰';

  insight.style.display = 'block';
  insight.textContent = `${tag} te košta ${spending.toLocaleString()}${CURRENCY} mesečno ${emoji}`;
}

function updateTagsUI() {
  updatePopularTags();
  if (activeTagFilter !== 'all') {
    updateTagInsight(activeTagFilter);
  }
  
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
    suggestionsList.innerHTML = '<div class="suggestion-placeholder">Nema dovoljno podataka za sugestije</div>';
    return;
  }

  suggestionsList.innerHTML = '';
  suggestions.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = `suggestion-item ${suggestion.type}`;
    
    const text = document.createElement('div');
    text.className = 'suggestion-text';
    text.textContent = suggestion.text;
    
    item.appendChild(text);
    suggestionsList.appendChild(item);
  });
}

function generateSmartSuggestions() {
  const suggestions = [];
  const expenses = appData.expenses.filter(exp => exp.type !== 'income' && exp.type !== 'savings');
  
  if (expenses.length === 0 || appData.income === 0) {
    return suggestions;
  }

  // Calculate spending by category
  const categorySpending = {};
  expenses.forEach(exp => {
    categorySpending[exp.category] = (categorySpending[exp.category] || 0) + exp.amount;
  });

  const totalSpent = getTotalSpent();
  
  // Sort categories by spending
  const sortedCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1]);

  // Suggestion 1: Reduce top spending category by 20%
  if (sortedCategories.length > 0) {
    const topCategory = sortedCategories[0];
    const categoryName = topCategory[0];
    const categoryAmount = topCategory[1];
    const savings = Math.round(categoryAmount * 0.2);
    
    if (categoryAmount > 1000) {
      suggestions.push({
        type: 'normal',
        text: `Ako smanjiš ${categoryName} za 20%, uštedećeš ~${savings.toLocaleString()} RSD`
      });
    }
  }

  // Suggestion 2: Check if any category is above 30% of income
  sortedCategories.forEach(([category, amount]) => {
    const percentage = (amount / appData.income) * 100;
    if (percentage > 30) {
      suggestions.push({
        type: 'warning',
        text: `${category} ti je iznad preporučenih 30% prihoda (${percentage.toFixed(0)}%)`
      });
    }
  });

  // Suggestion 3: Total spending vs income
  const spendingPercentage = (totalSpent / appData.income) * 100;
  if (spendingPercentage > 80) {
    suggestions.push({
      type: 'warning',
      text: `Trošiš ${spendingPercentage.toFixed(0)}% svojih prihoda - pokušaj da smanjiš na 70%`
    });
  }

  // Suggestion 4: Savings suggestion
  const currentSavings = getSavings();
  const recommendedSavings = Math.round(appData.income * 0.2);
  if (currentSavings < recommendedSavings) {
    const difference = recommendedSavings - currentSavings;
    suggestions.push({
      type: 'normal',
      text: `Pokušaj da uštediš još ${difference.toLocaleString()} RSD da dostigneš 20% prihoda`
    });
  }

  // Suggestion 5: Analyze recurring vs one-time expenses
  const recurringTotal = appData.recurringExpenses
    .filter(r => r.isActive)
    .reduce((sum, r) => sum + r.amount, 0);
  
  if (recurringTotal > 0) {
    const recurringPercentage = (recurringTotal / totalSpent) * 100;
    if (recurringPercentage > 60) {
      suggestions.push({
        type: 'warning',
        text: `${recurringPercentage.toFixed(0)}% troškova su recurring - razmisli o smanjenju pretplata`
      });
    }
  }

  return suggestions.slice(0, 4); // Show max 4 suggestions
}

function updateMonthlySummary() {
  const totalSpent = getTotalSpent();
  const income = appData.income;
  const savings = getSavings();
  const saveRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  document.getElementById('summarySpent').textContent = totalSpent.toLocaleString() + CURRENCY;
  document.getElementById('summaryIncome').textContent = income.toLocaleString() + CURRENCY;
  document.getElementById('summarySavings').textContent = savings.toLocaleString() + CURRENCY;
  document.getElementById('summarySaveRate').textContent = saveRate + '%';
}

// Initial dashboard update
loadCalendarState(); // Load saved calendar state
checkOnboarding(); // Check if user needs onboarding
updateDashboard();

enqueueMissingWalletSync();
flushWalletSyncQueue();
setInterval(() => {
  flushWalletSyncQueue();
}, 8000);

// Initialize chart after a small delay to ensure DOM is ready
setTimeout(() => {
  initChart();
  initDailyChart();
  initComparisonChart();
  initRecurringExpenses();
  updateTagsUI();
}, 100);
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
