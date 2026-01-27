// Data Management
const DEFAULT_MONTHLY_INCOME = 100000;
const CURRENCY = " RSD";
const API_BASE = 'http://localhost:4000/api';
const TOKEN_KEY = 'sharedBudgetToken';

let cachedFriendLimit = null;
let friendLimitLoaded = false;

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

function isExpenseInCurrentMonth(exp) {
    const now = new Date();
    const dateValue = exp.date ? new Date(exp.date) : null;
    if (!dateValue || Number.isNaN(dateValue.getTime())) return true;
    return dateValue.getFullYear() === now.getFullYear() && dateValue.getMonth() === now.getMonth();
}

function getCurrentMonthSpent(excludeId = null) {
    return appData.expenses.reduce((sum, exp) => {
        if (excludeId && exp.id === excludeId) return sum;
        if (!isExpenseInCurrentMonth(exp)) return sum;
        return sum + exp.amount;
    }, 0);
}

function initializeData() {
    let data = localStorage.getItem('expenseTrackerData');
    if (!data) {
        data = {
            income: DEFAULT_MONTHLY_INCOME,
            expenses: [],
            categories: ["Food", "Transport", "Rent", "Entertainment", "Shopping", "Health", "Utilities"],
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
        if (!data.categoryLimits) data.categoryLimits = {};
        if (!data.categoryColors) data.categoryColors = {};
        if (typeof data.savingsTotal !== 'number') data.savingsTotal = 0;
        if (!Array.isArray(data.recurringExpenses)) data.recurringExpenses = [];
        if (typeof data.lastMonthCheck !== 'number') data.lastMonthCheck = new Date().getMonth();
    }
    return data;
}

let appData = initializeData();

function saveData() {
    localStorage.setItem('expenseTrackerData', JSON.stringify(appData));
}

// Modal Management
const modal = document.getElementById('expenseModal');
const btnAddExpense = document.getElementById('btnAddExpense');
const btnCancel = document.getElementById('btnCancel');
const closeBtn = document.getElementsByClassName('close')[0];
const expenseForm = document.getElementById('expenseForm');
const modalTitle = document.getElementById('modalTitle');

let editingExpenseId = null;

btnAddExpense.onclick = function() {
    editingExpenseId = null;
    modalTitle.textContent = 'Add New Expense';
    expenseForm.reset();
    document.getElementById('expenseDate').valueAsDate = new Date();
    modal.style.display = 'block';
}

closeBtn.onclick = function() {
    modal.style.display = 'none';
}

btnCancel.onclick = function() {
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Form Submission
expenseForm.onsubmit = async function(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value;
    const date = document.getElementById('expenseDate').value;
    const tagsInput = document.getElementById('expenseTags').value;
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const friendLimit = await getFriendLimit();
    if (friendLimit && friendLimit > 0) {
        const currentSpent = getCurrentMonthSpent(editingExpenseId || null);
        if (currentSpent + amount > friendLimit) {
            alert(`Limit reached. You can spend up to ${friendLimit.toLocaleString()}${CURRENCY} this month.`);
            return;
        }
    }
    
    if (editingExpenseId) {
        // Edit existing expense
        const expense = appData.expenses.find(e => e.id === editingExpenseId);
        if (expense) {
            expense.amount = amount;
            expense.category = category;
            expense.description = description;
            expense.date = date;
            expense.tags = tags;
        }
    } else {
        // Add new expense
        const newExpense = {
            id: Date.now(),
            amount: amount,
            category: category,
            description: description,
            date: date,
            tags: tags
        };
        appData.expenses.push(newExpense);
    }
    
    saveData();
    modal.style.display = 'none';
    renderExpenses();
    updateSidebarStats();
    renderKPI();
    if (typeof refreshAnalytics === 'function') refreshAnalytics();
}

// Moderna, harmonizovana paleta (Tailwind-inspirisana) sa blagim alpha
const customColorPalette = [
    '#ef4444cc', '#f97316cc', '#f59e0bcc', '#eab308cc', '#84cc16cc', '#22c55ecc', '#10b981cc',
    '#14b8a6cc', '#06b6d4cc', '#0ea5e9cc', '#3b82f6cc', '#6366f1cc', '#8b5cf6cc', '#a855f7cc',
    '#d946efcc', '#ec4899cc', '#f43f5ecc', '#fda4afcc', '#fb7185cc', '#fcd34dcc',
    '#93c5fdcc', '#a7f3d0cc', '#d1fae5cc', '#fde68acc', '#d1d5dbcc', '#9ca3afcc',
    '#94a3b8cc', '#cbd5e1cc'
];

const defaultColors = {
    'Food': '#ef4444cc',
    'Transport': '#14b8a6cc',
    'Rent': '#3b82f6cc',
    'Entertainment': '#f59e0bcc',
    'Shopping': '#ec4899cc',
    'Health': '#22c55ecc',
    'Utilities': '#eab308cc',
    'Savings': '#10b981cc',
    'Other': '#9ca3afcc'
};

// Generator random boje koja je dovoljno različita od postojećih
function generateDistinctColor(usedColors) {
  const existingHues = usedColors.map(color => {
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
  
  const saturation = 65 + Math.random() * 20;
  const lightness = 55 + Math.random() * 15;
  const alpha = 0.8 + Math.random() * 0.15;
  
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

// Get category color
function getCategoryColor(category) {
  // Prvo proveravamo da li postoji custom boja za ovu kategoriju
  if (appData.categoryColors && appData.categoryColors[category]) {
    return appData.categoryColors[category];
  }
  
  // Ako je default kategorija, koristi default boju
  if (defaultColors[category]) {
    return defaultColors[category];
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

// Get category color class (deprecated, ali ostavljamo za kompatibilnost)
function getCategoryColorClass(category) {
    const categoryColors = {
        'Food': 'category-color-food',
        'Transport': 'category-color-transport',
        'Rent': 'category-color-rent',
        'Entertainment': 'category-color-entertainment',
        'Shopping': 'category-color-shopping',
        'Health': 'category-color-health',
        'Utilities': 'category-color-utilities',
        'Savings': 'category-color-savings',
        'Other': 'category-color-other'
    };
    return categoryColors[category] || 'category-color-other';
}

// Format date helper
function parseSrDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('.').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
        const [d, m, yRaw] = parts;
        const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
        const parsed = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
}

function formatExpenseDate(expense) {
    if (!expense) return 'No date set';

    if (expense.timestamp) {
        const tsDate = new Date(expense.timestamp);
        if (!isNaN(tsDate.getTime())) return tsDate.toLocaleDateString('en-GB');
    }

    if (expense.date) {
        const srDate = parseSrDate(expense.date);
        if (srDate && !isNaN(srDate.getTime())) return srDate.toLocaleDateString('en-GB');

        const genericDate = new Date(expense.date);
        if (!isNaN(genericDate.getTime())) return genericDate.toLocaleDateString('en-GB');
    }

    return 'No date set';
}

function getExpenseDateValue(expense) {
    if (!expense) return null;
    if (expense.timestamp) {
        const d = new Date(expense.timestamp);
        if (!isNaN(d.getTime())) return d;
    }
    if (expense.date) {
        const srDate = parseSrDate(expense.date);
        if (srDate && !isNaN(srDate.getTime())) return srDate;
        const genericDate = new Date(expense.date);
        if (!isNaN(genericDate.getTime())) return genericDate;
    }
    return null;
}

// Category Icons
function getCategoryIcon(category) {
    const icons = {
        'Food': '🍽️',
        'Transport': '🚗',
        'Rent': '🏠',
        'Entertainment': '🎬',
        'Shopping': '🛍️',
        'Health': '💊',
        'Utilities': '💡',
        'Other': '📌'
    };
    return icons[category] || '📌';
}

// Get app/service icon or logo by name
function getAppIcon(appName) {
    if (!appName) return null;
    const cleanName = appName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
    
    // Map app names to FontAwesome icons or emoji
    const appIconMap = {
        'netflix': '<div style="width: 28px; height: 28px; background: transparent; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #E50914; font-weight: bold; font-size: 36px; font-family: \'Bebas Neue\', sans-serif; letter-spacing: 2px; line-height: 1;">N</div>',
        'spotify': '<i class="fab fa-spotify" style="color: #1DB954; font-size: 28px;"></i>',
        'applepay': '<i class="fab fa-apple" style="color: #000; font-size: 28px;"></i>',
        'apple pay': '<i class="fab fa-apple" style="color: #000; font-size: 28px;"></i>',
        'apple': '<i class="fab fa-apple" style="color: #000; font-size: 28px;"></i>',
        'amazon': '<i class="fab fa-amazon" style="color: #FF9900; font-size: 28px;"></i>',
        'uber': '<i class="fab fa-uber" style="color: #000; font-size: 28px;"></i>',
        'airbnb': '<i class="fab fa-airbnb" style="color: #FF5A5F; font-size: 28px;"></i>',
        'paypal': '<i class="fab fa-paypal" style="color: #003087; font-size: 28px;"></i>',
        'instagram': '<i class="fab fa-instagram" style="color: #E4405F; font-size: 28px;"></i>',
        'facebook': '<i class="fab fa-facebook" style="color: #1877F2; font-size: 28px;"></i>',
        'twitter': '<i class="fab fa-twitter" style="color: #1DA1F2; font-size: 28px;"></i>',
        'youtube': '<i class="fab fa-youtube" style="color: #FF0000; font-size: 28px;"></i>',
        'google': '<i class="fab fa-google" style="color: #4285F4; font-size: 28px;"></i>',
        'microsoft': '<i class="fab fa-microsoft" style="color: #00A4EF; font-size: 28px;"></i>',
        'dropbox': '<i class="fab fa-dropbox" style="color: #0061FF; font-size: 28px;"></i>',
        'slack': '<i class="fab fa-slack" style="color: #E01E5A; font-size: 28px;"></i>',
        'discord': '<i class="fab fa-discord" style="color: #5865F2; font-size: 28px;"></i>',
        'telegram': '<i class="fab fa-telegram" style="color: #0088cc; font-size: 28px;"></i>',
        'whatsapp': '<i class="fab fa-whatsapp" style="color: #25D366; font-size: 28px;"></i>',
        'steam': '<i class="fab fa-steam" style="color: #1B2838; font-size: 28px;"></i>',
        'github': '<i class="fab fa-github" style="color: #333; font-size: 28px;"></i>',
        'gitlab': '<i class="fab fa-gitlab" style="color: #FC6D26; font-size: 28px;"></i>',
        'bitbucket': '<i class="fab fa-bitbucket" style="color: #0052CC; font-size: 28px;"></i>',
        'twitch': '<i class="fab fa-twitch" style="color: #9146FF; font-size: 28px;"></i>',
        'linkedin': '<i class="fab fa-linkedin" style="color: #0A66C2; font-size: 28px;"></i>',
        'pinterest': '<i class="fab fa-pinterest" style="color: #E60023; font-size: 28px;"></i>',
        'reddit': '<i class="fab fa-reddit" style="color: #FF4500; font-size: 28px;"></i>',
        'hulu': '📺',
        'disney+': '🏰',
        'disney plus': '🏰',
        'max': '🎭',
        'prime video': '🎥',
        'youtube premium': '📹',
        'hbo': '📺',
    };
    
    return appIconMap[cleanName] || null;
}

// Render Expenses
function renderExpenses() {
    const expensesList = document.getElementById('expensesList');
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    const searchTerm = document.getElementById('searchExpenses').value.toLowerCase();
    
    let filteredExpenses = [...appData.expenses];
    
    // Filter by category
    if (categoryFilter !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.category === categoryFilter);
    }
    
    // Filter by search term
    if (searchTerm) {
        filteredExpenses = filteredExpenses.filter(e => 
            (e.description || '').toLowerCase().includes(searchTerm) ||
            (e.category || '').toLowerCase().includes(searchTerm) ||
            (e.tags && e.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    // Sort
    filteredExpenses.sort((a, b) => {
        const dateA = getExpenseDateValue(a);
        const dateB = getExpenseDateValue(b);

        switch(sortBy) {
            case 'date-desc':
                return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
            case 'date-asc':
                return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
            case 'amount-desc':
                return b.amount - a.amount;
            case 'amount-asc':
                return a.amount - b.amount;
            default:
                return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
        }
    });
    
    if (filteredExpenses.length === 0) {
        expensesList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <h3>No expenses found</h3>
                <p>Start by adding your first expense!</p>
            </div>
        `;
        return;
    }
    
    expensesList.innerHTML = filteredExpenses.map(expense => {
        const description = expense.description && expense.description.trim()
            ? expense.description.trim()
            : (expense.category || 'Expense');
        const categoryLabel = expense.category || 'Uncategorized';
        const dateLabel = formatExpenseDate(expense);
        const iconCategory = expense.category || 'Other';
        
        // Try to get app icon first, fallback to category icon
        const appIcon = getAppIcon(description);
        let iconContent;
        
        if (appIcon) {
            // If it's HTML (contains <), render as is; otherwise treat as emoji/text
            if (appIcon.includes('<')) {
                iconContent = appIcon;
            } else {
                iconContent = `<span>${appIcon}</span>`;
            }
        } else {
            iconContent = `<span>${getCategoryIcon(iconCategory)}</span>`;
        }

        return `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-header">
                    <div class="expense-icon">
                        ${iconContent}
                    </div>
                    <div class="expense-details">
                        <h3>${description}</h3>
                        <span class="expense-category" style="background: ${getCategoryColor(iconCategory)};">${categoryLabel}</span>
                    </div>
                </div>
                <div class="expense-meta">
                    <div class="expense-date">
                        <i class="fa-solid fa-calendar"></i>
                        ${dateLabel}
                    </div>
                    ${expense.tags && expense.tags.length > 0 ? `
                        <div class="expense-tags">
                            ${expense.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="expense-actions">
                <div class="expense-amount">${expense.amount.toLocaleString()}${CURRENCY}</div>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editExpense(${expense.id})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteExpense(${expense.id})">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// Edit Expense
function editExpense(id) {
    editingExpenseId = id;
    const expense = appData.expenses.find(e => e.id === id);
    if (!expense) return;
    
    modalTitle.textContent = 'Edit Expense';
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseCategory').value = expense.category;
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseDate').value = expense.date;
    document.getElementById('expenseTags').value = expense.tags ? expense.tags.join(', ') : '';
    
    modal.style.display = 'block';
}

// Delete Expense
function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        appData.expenses = appData.expenses.filter(e => e.id !== id);
        saveData();
        renderExpenses();
        updateSidebarStats();
        renderKPI();
        if (typeof refreshAnalytics === 'function') refreshAnalytics();
    }
}

// Update Sidebar Stats
function updateSidebarStats() {
    const totalSpent = appData.expenses
        .filter(expense => expense.category !== 'Savings')
        .reduce((sum, expense) => sum + expense.amount, 0);
    const remaining = appData.income - totalSpent;
    
    const sidebarSpent = document.getElementById('sidebarSpent');
    const sidebarRemaining = document.getElementById('sidebarRemaining');
    
    if (sidebarSpent) {
        sidebarSpent.textContent = totalSpent.toLocaleString() + CURRENCY;
    }
    if (sidebarRemaining) {
        sidebarRemaining.textContent = remaining.toLocaleString() + CURRENCY;
    }
}

// Populate Category Filters and Form
function populateCategoryOptions() {
    const categoryFilter = document.getElementById('categoryFilter');
    const expenseCategory = document.getElementById('expenseCategory');
    
    // Populate filter dropdown
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    appData.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
    
    // Populate form dropdown
    expenseCategory.innerHTML = '';
    appData.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        expenseCategory.appendChild(option);
    });
}

// Sticky filter bar: flatten top corners when it touches the viewport
function updateFilterStickiness() {
    const filtersSection = document.querySelector('.filters-section');
    if (!filtersSection) return;
    const isStuck = filtersSection.getBoundingClientRect().top <= 8;
    filtersSection.classList.toggle('is-stuck', isStuck);
}

// Event Listeners
document.getElementById('categoryFilter').addEventListener('change', renderExpenses);
document.getElementById('sortBy').addEventListener('change', renderExpenses);
document.getElementById('searchExpenses').addEventListener('input', renderExpenses);
window.addEventListener('scroll', updateFilterStickiness);
window.addEventListener('resize', updateFilterStickiness);

// Initialize
populateCategoryOptions();
renderExpenses();
updateSidebarStats();
updateFilterStickiness();
renderShortcuts();
updateShortcutsActive();

// ===== Quick Shortcuts =====
function renderShortcuts() {
    const container = document.getElementById('quickShortcuts');
    if (!container) return;

    const chips = [];
    chips.push({ label: 'All', value: 'all', icon: 'fa-list' });
    appData.categories.forEach(cat => {
        chips.push({ label: cat, value: cat, icon: 'fa-tag' });
    });
    // KPI shortcut: scroll to KPI section
    chips.push({ label: 'KPI', value: '__kpi__', icon: 'fa-chart-simple' });

    container.innerHTML = chips.map(c => `
        <button class="shortcut-chip" data-value="${c.value}" aria-label="Filter ${c.label}">
            <i class="fa-solid ${c.icon}"></i>
            ${c.label}
        </button>
    `).join('');

    container.querySelectorAll('.shortcut-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-value');
            if (val === '__kpi__') {
                const kpi = document.getElementById('kpiTitle') || document.getElementById('kpiBar');
                if (kpi) kpi.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            const select = document.getElementById('categoryFilter');
            if (select) {
                select.value = val;
                renderExpenses();
                updateShortcutsActive();
            }
        });
    });
}

function updateShortcutsActive() {
    const container = document.getElementById('quickShortcuts');
    const current = document.getElementById('categoryFilter')?.value || 'all';
    if (!container) return;
    container.querySelectorAll('.shortcut-chip').forEach(btn => {
        const val = btn.getAttribute('data-value');
        btn.classList.toggle('active', val === current);
    });
}

// Keep shortcuts in sync when category filter changes externally
document.getElementById('categoryFilter').addEventListener('change', updateShortcutsActive);
renderKPI();

// ===== KPI Summary (Monthly) =====
function renderKPI() {
        const kpiBar = document.getElementById('kpiBar');
        if (!kpiBar) return;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const expensesThisMonth = appData.expenses.filter(exp => {
                if (exp.category === 'Savings') return false;
                const d = getExpenseDateValue(exp);
                if (!d) return false;
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const monthlySpent = expensesThisMonth.reduce((sum, e) => sum + (e.amount || 0), 0);
        const daysElapsed = now.getDate();
        const avgDaily = daysElapsed > 0 ? monthlySpent / daysElapsed : 0;
        const biggest = expensesThisMonth.reduce((max, e) => Math.max(max, e.amount || 0), 0);
        const txCount = expensesThisMonth.length;

        const formatMoney = v => (v || 0).toLocaleString() + CURRENCY;

        // Build KPI metrics HTML separately
        const metricsHTML = `
            <div class="kpi-card has-tooltip" data-tip="Sum of all non-savings expenses this month.">
                <div class="kpi-icon spent" aria-hidden="true"><i class="fa-solid fa-calendar-week"></i></div>
                <div class="kpi-content">
                    <span class="kpi-label">Monthly Spent</span>
                    <span class="kpi-value" aria-label="Monthly spent value">${formatMoney(monthlySpent)}</span>
                </div>
            </div>
            <div class="kpi-card has-tooltip" data-tip="Current month average per day (Spent / days elapsed).">
                <div class="kpi-icon avg" aria-hidden="true"><i class="fa-solid fa-chart-line"></i></div>
                <div class="kpi-content">
                    <span class="kpi-label">Avg per Day</span>
                    <span class="kpi-value" aria-label="Average per day value">${formatMoney(Math.round(avgDaily))}</span>
                </div>
            </div>
            <div class="kpi-card has-tooltip" data-tip="Maximum single expense recorded this month.">
                <div class="kpi-icon biggest" aria-hidden="true"><i class="fa-solid fa-bolt"></i></div>
                <div class="kpi-content">
                    <span class="kpi-label">Largest Expense</span>
                    <span class="kpi-value" aria-label="Largest expense value">${formatMoney(biggest)}</span>
                </div>
            </div>
            <div class="kpi-card has-tooltip" data-tip="Total number of expense entries this month.">
                <div class="kpi-icon count" aria-hidden="true"><i class="fa-solid fa-receipt"></i></div>
                <div class="kpi-content">
                    <span class="kpi-label">Transactions</span>
                    <span class="kpi-value" aria-label="Transactions count">${txCount}</span>
                </div>
            </div>
        `;
        
        // Only update the metrics container, not the whole KPI bar
        const metricsContainer = document.getElementById('kpiMetrics');
        if (metricsContainer) {
            metricsContainer.innerHTML = metricsHTML;
        }
}
// ===== CSV Export/Import =====
function exportCSV() {
    if (appData.expenses.length === 0) {
        alert('No expenses to export!');
        return;
    }

    // CSV header
    const headers = ['ID', 'Date', 'Amount', 'Category', 'Description', 'Tags'];
    
    // Convert expenses to CSV rows
    const rows = appData.expenses.map(exp => {
        const date = exp.date || 'No date set';
        const tags = (exp.tags || []).join('; ');
        const description = (exp.description || '').replace(/"/g, '""'); // Escape quotes
        return [
            exp.id,
            date,
            exp.amount,
            exp.category || 'Other',
            `"${description}"`,
            `"${tags}"`
        ].join(',');
    });

    // Combine header and rows
    const csv = [headers.join(','), ...rows].join('\n');

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importCSV() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                alert('CSV file is empty or invalid!');
                return;
            }

            // Skip header row
            const dataLines = lines.slice(1);
            let imported = 0;
            let skipped = 0;

            dataLines.forEach(line => {
                // Simple CSV parser (handles quoted fields)
                const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (!matches || matches.length < 4) {
                    skipped++;
                    return;
                }

                const [id, date, amount, category, description, tags] = matches.map(m => 
                    m.replace(/^"|"$/g, '').trim()
                );

                // Check if expense with this ID already exists
                const exists = appData.expenses.some(e => e.id === Number(id));
                if (exists) {
                    skipped++;
                    return;
                }

                // Create new expense
                const newExpense = {
                    id: Number(id) || Date.now() + Math.random(),
                    amount: parseFloat(amount) || 0,
                    category: category || 'Other',
                    description: description || category || 'Other',
                    date: date || new Date().toISOString().split('T')[0],
                    tags: tags ? tags.split(';').map(t => t.trim()).filter(Boolean) : []
                };

                appData.expenses.push(newExpense);
                imported++;
            });

            if (imported > 0) {
                saveData();
                renderExpenses();
                updateSidebarStats();
                renderKPI();
                if (typeof refreshAnalytics === 'function') refreshAnalytics();
                alert(`Successfully imported ${imported} expense(s)!\n${skipped > 0 ? `Skipped ${skipped} duplicate(s).` : ''}`);
            } else {
                alert('No new expenses were imported. All entries may be duplicates or invalid.');
            }

        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing CSV file. Please check the file format.');
        }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// Set up event listeners
document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
document.getElementById('btnImportCSV').addEventListener('click', importCSV);
document.getElementById('fileInput').addEventListener('change', handleFileImport);