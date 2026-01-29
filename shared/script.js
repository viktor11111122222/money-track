const API_BASE = 'http://localhost:4000/api';
const TOKEN_KEY = 'sharedBudgetToken';
const WALLET_PROGRESS_CACHE_KEY = 'walletProgressCache';
const DEFAULT_MONTHLY_INCOME = 100000;
const CURRENCY = ' RSD';

const spendingsBtn = document.getElementById('spendingsBtn');

function getExpenseData() {
  try {
    const raw = localStorage.getItem('expenseTrackerData');
    if (!raw) {
      return {
        income: DEFAULT_MONTHLY_INCOME,
        currentBalance: 0,
        expenses: [],
        savingsTotal: 0
      };
    }
    const parsed = JSON.parse(raw);
    return {
      income: typeof parsed.income === 'number' ? parsed.income : DEFAULT_MONTHLY_INCOME,
      currentBalance: typeof parsed.currentBalance === 'number' ? parsed.currentBalance : 0,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      savingsTotal: typeof parsed.savingsTotal === 'number' ? parsed.savingsTotal : 0
    };
  } catch {
    return {
      income: DEFAULT_MONTHLY_INCOME,
      currentBalance: 0,
      expenses: [],
      savingsTotal: 0
    };
  }
}

function getTotalSpent(expenses) {
  return expenses.reduce((sum, exp) => {
    if (!exp || exp.type === 'income' || exp.type === 'savings') return sum;
    const amount = Number(exp.amount) || 0;
    return sum + amount;
  }, 0);
}

function getSavings(income, totalSpent, savingsTotal) {
  return income - totalSpent + (savingsTotal || 0);
}

function updateSidebarStats() {
  const sidebarSpent = document.getElementById('sidebarSpent');
  const sidebarRemaining = document.getElementById('sidebarRemaining');
  if (!sidebarSpent && !sidebarRemaining) return;

  const data = getExpenseData();
  const totalSpent = getTotalSpent(data.expenses);
  // Use currentBalance if available (new format), fallback to old calculation
  const remaining = data.currentBalance !== undefined
    ? data.currentBalance - totalSpent
    : getSavings(data.income, totalSpent, data.savingsTotal);

  if (sidebarSpent) {
    sidebarSpent.textContent = totalSpent.toLocaleString() + CURRENCY;
  }
  if (sidebarRemaining) {
    sidebarRemaining.textContent = remaining.toLocaleString() + CURRENCY;
  }
}

if (spendingsBtn) {
  spendingsBtn.addEventListener('click', () => {
    sessionStorage.setItem('spendingsReturn', window.location.href);
    window.location.href = '../dashboard/index.html#spendings';
  });
}

function getApiBaseUrl() {
  if (API_BASE.startsWith('http')) return API_BASE;
  return `http://localhost:4000${API_BASE.startsWith('/') ? '' : '/'}${API_BASE}`;
}

const ui = {
  openInviteHero: document.getElementById('openInviteHero'),
  openWalletHero: document.getElementById('openWalletHero'),
  openInviteCard: document.getElementById('openInviteCard'),
  openWalletCard: document.getElementById('openWalletCard'),
  openSplitCard: document.getElementById('openSplitCard'),
  openInviteSection: document.getElementById('openInviteSection'),
  openWalletSection: document.getElementById('openWalletSection'),
  openSplitSection: document.getElementById('openSplitSection'),
  openSplitsAllButton: document.getElementById('openSplitsAllButton'),
  invitesList: document.getElementById('invitesList'),
  walletsList: document.getElementById('walletsList'),
  splitsList: document.getElementById('splitsList'),
  allSplitsList: document.getElementById('allSplitsList'),
  allSplitsModal: document.getElementById('allSplitsModal'),
  closeAllSplitsModal: document.getElementById('closeAllSplitsModal'),
  splitIsRecurring: document.getElementById('splitIsRecurring'),
  splitRecurringRow: document.getElementById('splitRecurringRow'),
  friendsList: document.getElementById('friendsList'),
  modal: document.getElementById('sharedModal'),
  modalTitle: document.getElementById('modalTitle'),
  sharedForm: document.getElementById('sharedForm'),
  sharedName: document.getElementById('sharedName'),
  sharedEmailRow: document.getElementById('sharedEmailRow'),
  sharedEmail: document.getElementById('sharedEmail'),
  sharedEmailError: document.getElementById('sharedEmailError'),
  sharedAmountRow: document.getElementById('sharedAmountRow'),
  sharedAmount: document.getElementById('sharedAmount'),
  sharedGoalRow: document.getElementById('sharedGoalRow'),
  sharedGoalAmount: document.getElementById('sharedGoalAmount'),
  sharedCapRow: document.getElementById('sharedCapRow'),
  sharedCapAmount: document.getElementById('sharedCapAmount'),
  sharedDeadlineRow: document.getElementById('sharedDeadlineRow'),
  sharedDeadline: document.getElementById('sharedDeadline'),
  sharedMembersRow: document.getElementById('sharedMembersRow'),
  sharedMembers: document.getElementById('sharedMembers'),
  splitMembersBreakdownRow: document.getElementById('splitMembersBreakdownRow'),
  splitMembersBreakdown: document.getElementById('splitMembersBreakdown'),
  addSplitMember: document.getElementById('addSplitMember'),
  sharedCategoriesRow: document.getElementById('sharedCategoriesRow'),
  sharedCategories: document.getElementById('sharedCategories'),
  sharedCategoriesAll: document.getElementById('sharedCategoriesAll'),
  walletMemberPicker: document.getElementById('walletMemberPicker'),
  sharedNotesRow: document.getElementById('sharedNotesRow'),
  sharedNotes: document.getElementById('sharedNotes'),
  closeModal: document.getElementById('closeSharedModal'),
  cancelModal: document.getElementById('cancelSharedModal'),
  submitModal: document.getElementById('submitSharedModal'),
  authCard: document.getElementById('authCard'),
  sharedApp: document.getElementById('sharedApp'),
  showLogin: document.getElementById('showLogin'),
  showRegister: document.getElementById('showRegister'),
  authLoginForm: document.getElementById('authLoginForm'),
  authRegisterForm: document.getElementById('authRegisterForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  registerName: document.getElementById('registerName'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  authError: document.getElementById('authError')
};

const confirmUi = {
  modal: document.getElementById('confirmModal'),
  title: document.getElementById('confirmTitle'),
  text: document.getElementById('confirmText'),
  ok: document.getElementById('confirmOk'),
  cancel: document.getElementById('confirmCancel'),
  close: document.getElementById('confirmClose')
};

let currentType = 'invite';
let splitMembers = {}; // Track split members with their amounts
let splitMemberFriendIds = {}; // Track which members are friends with their IDs
let sharedData = { invites: [], wallets: [], splits: [], friends: [], walletTransactions: {} };
let currentUser = null;
let editingWalletId = null;
let editingSplitId = null;

function getHiddenWallets() {
  try {
    const raw = localStorage.getItem('hiddenWallets');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getWalletProgressCache() {
  try {
    const raw = localStorage.getItem(WALLET_PROGRESS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setWalletProgressCache(next) {
  localStorage.setItem(WALLET_PROGRESS_CACHE_KEY, JSON.stringify(next));
}

function setHiddenWallets(next) {
  localStorage.setItem('hiddenWallets', JSON.stringify(next));
}

function getWalletProgressModes() {
  try {
    const raw = localStorage.getItem('walletProgressModes');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setWalletProgressModes(next) {
  localStorage.setItem('walletProgressModes', JSON.stringify(next));
}

function getLocalCategories() {
  try {
    const raw = localStorage.getItem('expenseTrackerData');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.categories) ? parsed.categories : [];
  } catch {
    return [];
  }
}

function setAllCategoriesMode(isAll) {
  if (!ui.sharedCategories || !ui.sharedCategoriesAll) return;
  if (isAll) {
    ui.sharedCategories.value = 'All categories';
    ui.sharedCategories.dataset.all = 'true';
    ui.sharedCategoriesAll.classList.add('active');
  } else {
    ui.sharedCategories.dataset.all = 'false';
    ui.sharedCategoriesAll.classList.remove('active');
  }
}

function renderWalletMemberPicker() {
  if (!ui.walletMemberPicker || !ui.sharedMembers) return;
  if (!ui.sharedMembersRow || ui.sharedMembersRow.style.display === 'none') {
    ui.walletMemberPicker.innerHTML = '';
    return;
  }
  const friends = sharedData.friends || [];
  if (friends.length === 0) {
    ui.walletMemberPicker.innerHTML = '';
    return;
  }
  ui.walletMemberPicker.innerHTML = friends.map(friend => {
    const name = friend.name || friend.email;
    return `<button type="button" class="member-chip" data-name="${name}">${name}</button>`;
  }).join('');
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiFetch(path, options = {}, withAuth = true) {
  const baseUrl = getApiBaseUrl();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (withAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });
  } catch {
    const error = new Error('Backend is not reachable. Start the server on http://localhost:4000.');
    error.status = 0;
    throw error;
  }

  const rawText = await response.text().catch(() => '');
  let payload = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = {};
    }
  }
  if (!response.ok) {
    const message = payload.message || rawText || response.statusText || 'Request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setAuthView(mode) {
  if (!ui.authLoginForm || !ui.authRegisterForm) return;
  if (mode === 'login') {
    ui.authLoginForm.classList.remove('is-hidden');
    ui.authRegisterForm.classList.add('is-hidden');
    ui.showLogin?.classList.add('active');
    ui.showRegister?.classList.remove('active');
  } else {
    ui.authLoginForm.classList.add('is-hidden');
    ui.authRegisterForm.classList.remove('is-hidden');
    ui.showLogin?.classList.remove('active');
    ui.showRegister?.classList.add('active');
  }
  if (ui.authError) ui.authError.textContent = '';
}

function setLoggedIn(isLoggedIn) {
  if (ui.authCard) ui.authCard.classList.toggle('is-hidden', isLoggedIn);
  if (ui.sharedApp) ui.sharedApp.classList.toggle('is-hidden', !isLoggedIn);
}

function setModalMode(type, wallet = null) {
  currentType = type;
  editingWalletId = wallet ? wallet.id : null;
  
  // Handle split editing
  const split = type === 'split' && wallet ? wallet : null;
  if (split) {
    editingSplitId = split.id;
  } else {
    editingSplitId = null;
  }
  
  ui.sharedForm.reset();
  if (ui.sharedEmailError) ui.sharedEmailError.textContent = '';
  ui.sharedEmailRow.style.display = type === 'invite' ? 'flex' : 'none';
  ui.sharedAmountRow.style.display = type === 'wallet' || type === 'split' ? 'flex' : 'none';
  ui.sharedGoalRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedCapRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedDeadlineRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedMembersRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.splitMembersBreakdownRow.style.display = type === 'split' ? 'flex' : 'none';
  ui.splitRecurringRow.style.display = type === 'split' ? 'flex' : 'none';
  ui.sharedCategoriesRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedNotesRow.style.display = type === 'wallet' ? 'flex' : 'none';
  if (type === 'wallet') {
    setAllCategoriesMode(false);
    renderWalletMemberPicker();
    if (ui.sharedMembers) ui.sharedMembers.required = true;
  } else {
    if (ui.sharedMembers) ui.sharedMembers.required = false;
  }

  if (type === 'invite') {
    const hiddenWallets = getHiddenWallets();
    ui.modalTitle.textContent = 'New Invite';
    ui.sharedName.placeholder = 'Full name';
    ui.sharedEmail.required = true;
    if (ui.submitModal) ui.submitModal.textContent = 'Create Invite';
  }
  if (type === 'wallet') {
    ui.modalTitle.textContent = wallet ? 'Edit Wallet' : 'New Wallet';
    ui.sharedName.placeholder = 'Wallet name';
    ui.sharedEmail.required = false;
    if (ui.submitModal) ui.submitModal.textContent = wallet ? 'Save changes' : 'Create Wallet';
    if (wallet) {
      ui.sharedName.value = wallet.name || '';
      ui.sharedAmount.value = wallet.amount ?? '';
      if (ui.sharedGoalAmount) ui.sharedGoalAmount.value = wallet.goalAmount ?? '';
      if (ui.sharedCapAmount) ui.sharedCapAmount.value = wallet.capAmount ?? '';
      if (ui.sharedDeadline) ui.sharedDeadline.value = wallet.deadline ?? '';
      if (ui.sharedMembers) {
        const members = Array.isArray(wallet.members) ? wallet.members : [];
        ui.sharedMembers.value = members.join(', ');
      }
      if (ui.sharedCategories) {
        const categories = Array.isArray(wallet.categories) ? wallet.categories : [];
        if (categories.includes('*')) {
          setAllCategoriesMode(true);
        } else {
          ui.sharedCategories.value = categories.join(', ');
          setAllCategoriesMode(false);
        }
      }
      if (ui.sharedNotes) ui.sharedNotes.value = wallet.notes || '';
    } else if (ui.sharedMembers && currentUser) {
      const defaultName = currentUser.name || currentUser.email;
      if (defaultName) ui.sharedMembers.value = defaultName;
    }
  }
  if (type === 'split') {
    const isEditing = split !== null;
    ui.modalTitle.textContent = isEditing ? 'Edit Split' : 'New Split';
    ui.sharedName.placeholder = 'Bill name';
    ui.sharedEmail.required = false;
    if (ui.submitModal) ui.submitModal.textContent = isEditing ? 'Save changes' : 'Create Split';
    
    // Initialize split data
    if (isEditing && split) {
      // Load existing split data for editing
      ui.sharedName.value = split.name || '';
      ui.sharedAmount.value = split.amount ?? '';
      
      // Load members and amounts
      splitMembers = { ...split.memberAmounts };
      splitMemberFriendIds = {};
      
      // Build friend IDs map
      if (split.friendIds && Array.isArray(split.friendIds)) {
        split.friendIds.forEach(friendId => {
          const member = split.members.find((m, idx) => {
            // Try to match by position or find correct member
            return true;
          });
        });
      }
      
      if (ui.splitIsRecurring) ui.splitIsRecurring.checked = split.is_recurring || false;
    } else {
      // New split
      ui.sharedName.value = '';
      ui.sharedAmount.value = '';
      splitMembers = {};
      splitMemberFriendIds = {};
      
      // Add current user as default member
      if (currentUser) {
        const currentUserName = currentUser.name || currentUser.email;
        splitMembers[currentUserName] = 0;
      }
      
      if (ui.splitIsRecurring) ui.splitIsRecurring.checked = false;
    }
    
    renderSplitMembersBreakdown();
    
    // Re-attach event listener to Add Friend button
    setTimeout(() => {
      const addSplitMemberBtn = document.getElementById('addSplitMember');
      if (addSplitMemberBtn) {
        // Remove old listeners first
        const newBtn = addSplitMemberBtn.cloneNode(true);
        addSplitMemberBtn.parentNode.replaceChild(newBtn, addSplitMemberBtn);
        
        // Add new listener
        newBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showSplitMemberPicker();
        });
      }
    }, 0);
  }
}

function openModal(type, wallet = null) {
  if (!ui.modal) return;
  setModalMode(type, wallet);
  ui.modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function showNotification(message, type = 'info', duration = 3000) {
  const container = document.getElementById('notificationContainer');
  if (!container) return;
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        container.removeChild(notification);
      }
    }, 300);
  }, duration);

}

function closeModal() {
  if (!ui.modal) return;
  ui.modal.classList.remove('active');
  ui.modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (ui.sharedEmailError) ui.sharedEmailError.textContent = '';
  splitMembers = {};
  splitMemberFriendIds = {};
}

function openConfirm({ title = 'Confirm action', text = 'Are you sure?', okText = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    if (!confirmUi.modal) {
      resolve(false);
      return;
    }
    if (confirmUi.title) confirmUi.title.textContent = title;
    if (confirmUi.text) confirmUi.text.textContent = text;
    if (confirmUi.ok) confirmUi.ok.textContent = okText;

    const cleanup = () => {
      confirmUi.modal.classList.remove('active');
      confirmUi.modal.setAttribute('aria-hidden', 'true');
      confirmUi.ok?.removeEventListener('click', onOk);
      confirmUi.cancel?.removeEventListener('click', onCancel);
      confirmUi.close?.removeEventListener('click', onCancel);
      confirmUi.modal?.removeEventListener('click', onOverlay);
      document.body.style.overflow = '';
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOverlay = (event) => {
      if (event.target === confirmUi.modal) onCancel();
    };

    confirmUi.ok?.addEventListener('click', onOk);
    confirmUi.cancel?.addEventListener('click', onCancel);
    confirmUi.close?.addEventListener('click', onCancel);
    confirmUi.modal?.addEventListener('click', onOverlay);

    confirmUi.modal.classList.add('active');
    confirmUi.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  });
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="shared-empty">${text}</div>`;
}

function getPrimaryScrollElement() {
  const main = document.querySelector('main');
  if (main && main.scrollHeight > main.clientHeight) return main;
  return document.scrollingElement || document.documentElement;
}

function preserveScrollPosition(callback) {
  const scrollEl = getPrimaryScrollElement();
  const top = window.scrollY;
  const left = window.scrollX;
  const elTop = scrollEl?.scrollTop ?? 0;
  const elLeft = scrollEl?.scrollLeft ?? 0;
  callback();
  requestAnimationFrame(() => {
    if (scrollEl) {
      scrollEl.scrollTop = elTop;
      scrollEl.scrollLeft = elLeft;
    }
    window.scrollTo({ top, left, behavior: 'auto' });
  });
}

function renderInvites() {
  if (!ui.invitesList) return;
  if (sharedData.invites.length === 0) {
    renderEmpty(ui.invitesList, 'No invites yet.');
    return;
  }
  ui.invitesList.innerHTML = sharedData.invites.map(invite => {
    const statusLabel = invite.status === 'accepted' ? 'Accepted' : 'Pending';
    const showActions = invite.status !== 'accepted';
    return `
      <div class="shared-item">
        <div>
          <h4>${invite.name}</h4>
          <p>${invite.email}</p>
        </div>
        <div class="shared-actions">
          <span class="shared-tag">${statusLabel}</span>
          ${showActions ? `<button class="ghost shared-accept" data-id="${invite.id}">Mark as accepted</button>
          <button class="ghost shared-resend" data-id="${invite.id}">Send again</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderFriends() {
  if (!ui.friendsList) return;
  if (sharedData.friends.length === 0) {
    renderEmpty(ui.friendsList, 'No friends yet.');
    return;
  }
  ui.friendsList.innerHTML = sharedData.friends.map(friend => {
    const label = friend.name || friend.email;
    return `
      <div class="shared-item friend-item" data-id="${friend.id}" data-name="${label}" data-email="${friend.email || ''}" draggable="true">
        <div>
          <h4>${friend.name || friend.email}</h4>
          <p>${friend.email || ''}</p>
        </div>
        <div class="friend-controls">
          <label>
            Limit (RSD)
            <input type="number" class="friend-limit" data-id="${friend.id}" min="0" step="0.01" value="${friend.limitAmount ?? 0}">
          </label>
          <button type="button" class="friend-delete" data-id="${friend.id}" title="Delete friend">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners for delete buttons
  ui.friendsList.querySelectorAll('.friend-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const friendId = btn.dataset.id;
      if (!friendId) return;
      
      const confirmed = await openConfirm({
        title: 'Delete Friend',
        text: 'Are you sure you want to remove this friend?',
        okText: 'Yes, delete'
      });
      if (!confirmed) return;
      
      apiFetch(`/friends/${friendId}`, { method: 'DELETE' })
        .then(() => {
          sharedData.friends = sharedData.friends.filter(f => String(f.id) !== String(friendId));
          renderFriends();
        })
        .catch((error) => {
          showNotification('Failed to delete friend: ' + (error.message || 'Unknown error'), 'error');
        });
    });
  });
}

function applyWalletProgressAnimation(scope) {
  if (!scope) return;
  scope.querySelectorAll('.wallet-progress-fill[data-target]').forEach((el) => {
    const target = el.dataset.target;
    if (target !== undefined) {
      el.style.width = `${target}%`;
    }
  });
}

function buildWalletItem(wallet, progressModes, progressCache, hiddenWallets) {
    const transactions = sharedData.walletTransactions[wallet.id] || [];
    const isSavingsTxn = txn => String(txn.category || '').toLowerCase() === 'savings';
    const expenseTotal = transactions.reduce((sum, txn) => sum + (isSavingsTxn(txn) ? 0 : (txn.amount || 0)), 0);
    const savingsTotal = transactions.reduce((sum, txn) => sum + (isSavingsTxn(txn) ? (txn.amount || 0) : 0), 0);
    const progressMode = progressModes[wallet.id] || 'all';
    const totalSpent = expenseTotal;
    const savedAmount = savingsTotal;
    const goalAmount = Number.isFinite(wallet.goalAmount) && wallet.goalAmount > 0 ? wallet.goalAmount : (Number(wallet.amount) || 0);
    const capAmount = Number.isFinite(wallet.capAmount) && wallet.capAmount > 0 ? wallet.capAmount : null;
    const totalForGoal = progressMode === 'savings-only' ? savingsTotal : (expenseTotal + savingsTotal);
    const progressPct = goalAmount > 0 ? Math.min(100, Math.round((totalForGoal / goalAmount) * 100)) : 0;
    let spentPct = goalAmount > 0 ? (expenseTotal / goalAmount) * 100 : 0;
    let savingsPct = goalAmount > 0 ? (savingsTotal / goalAmount) * 100 : 0;
    const combinedPct = spentPct + savingsPct;
    if (combinedPct > 100 && combinedPct > 0) {
      const scale = 100 / combinedPct;
      spentPct *= scale;
      savingsPct *= scale;
    }
    const spentProgressPct = goalAmount > 0 ? Math.min(100, Math.round((expenseTotal / goalAmount) * 100)) : 0;
    const cached = progressCache[wallet.id] || {};
    const initialSpentPct = Number.isFinite(cached.goalSpent) ? cached.goalSpent : 0;
    const initialSavingsPct = Number.isFinite(cached.goalSavings) ? cached.goalSavings : 0;
    const initialSpentOnlyPct = Number.isFinite(cached.spentOnly) ? cached.spentOnly : 0;
    const cacheUpdate = {
      goalSpent: progressMode === 'savings-only' ? 0 : Number(spentPct.toFixed(2)),
      goalSavings: Number(savingsPct.toFixed(2)),
      spentOnly: Number(spentProgressPct)
    };
    const capExceeded = capAmount !== null && totalSpent > capAmount;
    const progressState = capExceeded ? 'danger' : (progressPct > 80 ? 'warning' : '');
    const members = Array.isArray(wallet.members) ? wallet.members : [];
    const categories = Array.isArray(wallet.categories) ? wallet.categories : [];
    const hasAllCategories = categories.includes('*');
    const categoryOptions = hasAllCategories ? getLocalCategories() : categories;
    const isOwner = currentUser && String(wallet.ownerId) === String(currentUser.id);
    const canLeave = !isOwner && currentUser && (members.includes(currentUser.email) || members.includes(currentUser.name));
    const isHidden = Boolean(hiddenWallets[wallet.id]);
    const memberField = members.length
      ? `<select name="member">${members.map((m, idx) => `<option value="${m}" ${idx === 0 ? 'selected' : ''}>${m}</option>`).join('')}</select>`
      : `<input name="member" type="text" placeholder="Member name" required>`;
    const categoryField = categoryOptions.length
      ? `<select name="category">${categoryOptions.map((c, idx) => `<option value="${c}" ${idx === 0 ? 'selected' : ''}>${c}</option>`).join('')}</select>`
      : `<input name="category" type="text" placeholder="Category" required>`;

    const contributions = {};
    transactions.forEach(txn => {
      if (!txn.member) return;
      contributions[txn.member] = (contributions[txn.member] || 0) + (txn.amount || 0);
    });
    const contributionEntries = Object.entries(contributions).sort((a, b) => b[1] - a[1]);
    const contributionHtml = contributionEntries.length
      ? contributionEntries.map(([name, amount]) => `<div class="wallet-contrib-item"><span>${name}</span><span>${amount.toLocaleString()} RSD</span></div>`).join('')
      : '<div class="wallet-muted">No member spending yet.</div>';
    const currentIdentity = currentUser ? [currentUser.email, currentUser.name].filter(Boolean) : [];
    const isCurrentMember = m => currentIdentity.some(id => String(id).toLowerCase() === String(m).toLowerCase());
    const memberChips = members.map(m => {
      const isYou = isCurrentMember(m);
      const label = isYou ? `${m} (you)` : m;
      const chipClass = `wallet-chip ${isYou ? 'wallet-chip--you' : 'wallet-chip--member'}`;
      const canRemove = isOwner && !isYou;
      return `<span class="${chipClass}">${label}${canRemove ? `<button type="button" class="wallet-chip-remove" data-id="${wallet.id}" data-member="${m}" aria-label="Remove member">×</button>` : ''}</span>`;
    });
    if (isOwner && !members.some(isCurrentMember)) {
      memberChips.unshift('<span class="wallet-chip wallet-chip--you">You</span>');
    }
    if (!memberChips.length && currentUser) {
      memberChips.push('<span class="wallet-chip wallet-chip--you">You</span>');
    }
    const membersHtml = memberChips.length
      ? `<div class="wallet-chip-group">${memberChips.join('')}</div>`
      : '<div class="wallet-muted">No members set.</div>';

    const transactionHtml = transactions.length
      ? transactions.slice(0, 2).map(txn => {
        const isSavings = String(txn.category || '').toLowerCase() === 'savings';
        const amountLabel = `${isSavings ? '+' : '-'}${txn.amount.toLocaleString()} RSD`;
        const amountClass = `wallet-txn-amount${isSavings ? ' wallet-txn-amount--savings' : ''}`;
        return `
        <div class="wallet-txn-item">
          <div>
            <strong>${txn.member}</strong>
            <span>${txn.category}</span>
            ${txn.note ? `<em>${txn.note}</em>` : ''}
          </div>
          <span class="${amountClass}">${amountLabel}</span>
        </div>
      `;
      }).join('')
      : '<div class="wallet-muted">No transactions yet.</div>';
    const showAllButton = transactions.length > 2
      ? `<button type="button" class="ghost wallet-view-all" data-id="${wallet.id}" data-name="${wallet.name}">Show all transactions</button>`
      : '';

    const spentTarget = progressMode === 'savings-only' ? 0 : Number(spentPct.toFixed(2));
    const html = `
      <div class="shared-item wallet-item ${isHidden ? 'wallet-collapsed' : ''}" data-id="${wallet.id}">
        <div class="wallet-header">
          <div>
            <h4>${wallet.name}</h4>
            <p>${wallet.notes || 'Shared wallet'}</p>
          </div>
          <div class="wallet-actions">
            <div class="wallet-inline-stats">
              ${goalAmount ? `<span>Goal <span class="wallet-info" data-tooltip="Goal is the target amount you want to reach in this wallet.">i</span>: <strong>${goalAmount.toLocaleString()} RSD</strong></span>` : ''}
              <span>Spent: <strong>${totalSpent.toLocaleString()} RSD</strong></span>
              <span>Saved: <strong>${savedAmount.toLocaleString()} RSD</strong></span>
              ${capAmount ? `<span class="${capExceeded ? 'wallet-cap-danger' : ''}">Cap: <strong>${capAmount.toLocaleString()} RSD</strong></span>` : ''}
            </div>
            <button class="ghost wallet-progress-toggle" data-id="${wallet.id}">${progressMode === 'savings-only' ? 'Show all' : 'Show savings only'}</button>
            <button class="ghost wallet-toggle" data-id="${wallet.id}">${isHidden ? 'Show details' : 'Hide wallet'}</button>
            ${isOwner ? `<button class="ghost wallet-edit" data-id="${wallet.id}">Edit</button>` : ''}
            ${isOwner ? `<button class="ghost wallet-delete" data-id="${wallet.id}">Delete</button>` : ''}
            ${canLeave ? `<button class="ghost wallet-leave" data-id="${wallet.id}">Leave</button>` : ''}
          </div>
        </div>
        <div class="wallet-progress-stack">
          <div class="wallet-progress">
            <div class="wallet-progress-bar wallet-progress-bar--goal ${progressMode === 'savings-only' ? 'wallet-progress-bar--savings-only' : ''}">
              <div class="wallet-progress-fill wallet-progress-fill--spent ${progressState}${progressMode === 'savings-only' ? ' is-hidden' : ''}" data-target="${spentTarget.toFixed(2)}" style="width:${initialSpentPct}%;"></div>
              <div class="wallet-progress-fill wallet-progress-fill--savings" data-target="${savingsPct.toFixed(2)}" style="width:${initialSavingsPct}%;"></div>
            </div>
            <span>${progressPct}% of goal</span>
          </div>
          <div class="wallet-progress">
            <div class="wallet-progress-bar">
              <div class="wallet-progress-fill wallet-progress-fill--spent" data-target="${spentProgressPct}" style="width:${initialSpentOnlyPct}%;"></div>
            </div>
            <span>${spentProgressPct}% spent</span>
          </div>
        </div>
        <div class="wallet-meta">
          ${members.length ? `<div class="wallet-chip-group">${members.map(m => `<span class="wallet-chip">${m}</span>`).join('')}</div>` : ''}
          ${categories.length ? `<div class="wallet-chip-group">${hasAllCategories ? '<span class="wallet-chip wallet-chip-soft">All categories</span>' : categories.map(c => `<span class="wallet-chip wallet-chip-soft">${c}</span>`).join('')}</div>` : ''}
          ${wallet.deadline ? `<div class="wallet-deadline">Deadline: <strong>${wallet.deadline}</strong></div>` : ''}
        </div>
        <div class="wallet-grid">
          <div class="wallet-panel">
            <h5>Members</h5>
            ${membersHtml}
          </div>
          <div class="wallet-panel">
            <h5>Members contribution</h5>
            ${contributionHtml}
          </div>
          <div class="wallet-panel">
            <h5>Recent transactions</h5>
            ${transactionHtml}
            ${showAllButton}
          </div>
        </div>
        <form class="wallet-transaction-form" data-id="${wallet.id}">
          <div class="wallet-form-row">
            ${memberField}
            <input name="amount" type="number" min="0" step="0.01" placeholder="Amount" required>
          </div>
          <div class="wallet-form-row">
            ${categoryField}
            <input name="note" type="text" placeholder="Note (optional)">
          </div>
          <button class="primary wallet-add-btn" type="submit">Add transaction</button>
        </form>
      </div>
    `;
    return { html, cacheUpdate };
}

function renderWallets() {
  if (!ui.walletsList) return;
  preserveScrollPosition(() => {
    if (sharedData.wallets.length === 0) {
      renderEmpty(ui.walletsList, 'No wallets created.');
      return;
    }
    const hiddenWallets = getHiddenWallets();
    const progressModes = getWalletProgressModes();
    const progressCache = getWalletProgressCache();
    const nextProgressCache = { ...progressCache };
    ui.walletsList.innerHTML = sharedData.wallets.map(wallet => {
      const { html, cacheUpdate } = buildWalletItem(wallet, progressModes, progressCache, hiddenWallets);
      nextProgressCache[wallet.id] = cacheUpdate;
      return html;
    }).join('');
    setWalletProgressCache(nextProgressCache);
    requestAnimationFrame(() => applyWalletProgressAnimation(ui.walletsList));
  });
}

function updateWalletCard(wallet) {
  if (!ui.walletsList) return;
  preserveScrollPosition(() => {
    const hiddenWallets = getHiddenWallets();
    const progressModes = getWalletProgressModes();
    const progressCache = getWalletProgressCache();
    const { html, cacheUpdate } = buildWalletItem(wallet, progressModes, progressCache, hiddenWallets);
    progressCache[wallet.id] = cacheUpdate;
    setWalletProgressCache(progressCache);

    const existing = ui.walletsList.querySelector(`.wallet-item[data-id="${wallet.id}"]`);
    if (existing) {
      existing.outerHTML = html;
      const updated = ui.walletsList.querySelector(`.wallet-item[data-id="${wallet.id}"]`);
      requestAnimationFrame(() => applyWalletProgressAnimation(updated));
    } else {
      renderWallets();
    }
  });
}

async function addMemberToWallet(walletId, memberName) {
  const wallet = sharedData.wallets.find(w => String(w.id) === String(walletId));
  if (!wallet) return;
  const isOwner = currentUser && String(wallet.ownerId) === String(currentUser.id);
  if (!isOwner) {
    alert('Only the wallet owner can add members.');
    return;
  }

  const cleanName = (memberName || '').trim();
  if (!cleanName) return;

  const members = Array.isArray(wallet.members) ? [...wallet.members] : [];
  const normalizedMembers = members
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const exists = normalizedMembers.some(m => m.toLowerCase() === cleanName.toLowerCase());
  if (!exists) normalizedMembers.push(cleanName);
  const uniqueMembers = Array.from(
    new Map(normalizedMembers.map(member => [member.toLowerCase(), member])).values()
  );

  const parseNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '') return fallback;
    const cleaned = String(value).replace(/,/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const payload = {
    name: wallet.name,
    amount: parseNumber(wallet.amount, 0),
    notes: wallet.notes || '',
    goalAmount: parseNumber(wallet.goalAmount, null),
    capAmount: parseNumber(wallet.capAmount, null),
    deadline: wallet.deadline ?? null,
    members: uniqueMembers,
    categories: Array.isArray(wallet.categories) ? wallet.categories : []
  };

  try {
    const baseUrl = getApiBaseUrl();
    const token = getToken();
    const response = await fetch(`${baseUrl}/wallets/${walletId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const rawText = await response.text().catch(() => '');
    let updated = {};
    if (rawText) {
      try {
        updated = JSON.parse(rawText);
      } catch {
        updated = {};
      }
    }
    if (!response.ok) {
      const message = updated.message || rawText || response.statusText || 'Request failed.';
      throw new Error(message);
    }
    sharedData.wallets = sharedData.wallets.map(w => String(w.id) === String(walletId) ? { ...w, ...updated } : w);
    updateWalletCard(sharedData.wallets.find(w => String(w.id) === String(walletId)) || updated);
  } catch (error) {
    const message = error?.message || 'Could not add member to wallet.';
    alert(message);
  }
}

async function removeMemberFromWallet(walletId, memberName) {
  const wallet = sharedData.wallets.find(w => String(w.id) === String(walletId));
  if (!wallet) return;
  const isOwner = currentUser && String(wallet.ownerId) === String(currentUser.id);
  if (!isOwner) {
    alert('Only the wallet owner can remove members.');
    return;
  }

  const cleanName = (memberName || '').trim();
  if (!cleanName) return;

  const members = Array.isArray(wallet.members) ? [...wallet.members] : [];
  const normalizedMembers = members
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const updatedMembers = normalizedMembers.filter(m => m.toLowerCase() !== cleanName.toLowerCase());
  if (updatedMembers.length === normalizedMembers.length) return;

  const parseNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '') return fallback;
    const cleaned = String(value).replace(/,/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const payload = {
    name: wallet.name,
    amount: parseNumber(wallet.amount, 0),
    notes: wallet.notes || '',
    goalAmount: parseNumber(wallet.goalAmount, null),
    capAmount: parseNumber(wallet.capAmount, null),
    deadline: wallet.deadline ?? null,
    members: updatedMembers,
    categories: Array.isArray(wallet.categories) ? wallet.categories : []
  };

  try {
    const baseUrl = getApiBaseUrl();
    const token = getToken();
    const response = await fetch(`${baseUrl}/wallets/${walletId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const rawText = await response.text().catch(() => '');
    let updated = {};
    if (rawText) {
      try {
        updated = JSON.parse(rawText);
      } catch {
        updated = {};
      }
    }
    if (!response.ok) {
      const message = updated.message || rawText || response.statusText || 'Request failed.';
      throw new Error(message);
    }
    sharedData.wallets = sharedData.wallets.map(w => String(w.id) === String(walletId) ? { ...w, ...updated } : w);
    updateWalletCard(sharedData.wallets.find(w => String(w.id) === String(walletId)) || updated);
  } catch (error) {
    const message = error?.message || 'Could not remove member from wallet.';
    alert(message);
  }
}

function showSplitMemberPicker() {
  // Create a simple list of friends to add to split
  const availableFriends = sharedData.friends.filter(friend => !splitMembers.hasOwnProperty(friend.name));
  
  if (availableFriends.length === 0) {
    showNotification('No friends available. Please add friends first in the Friends section.', 'info');
    return;
  }
  
  // Show a simple menu with available friends
  const pickerContainer = document.createElement('div');
  pickerContainer.className = 'split-member-picker-menu';
  
  const items = availableFriends.map(friend => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = friend.name;
    btn.className = 'split-picker-item';
    btn.onclick = () => {
      addSplitMember(friend.name, friend.id);
      if (pickerContainer.parentNode) {
        document.body.removeChild(pickerContainer);
      }
      renderSplitMembersBreakdown();
    };
    return btn;
  });
  
  items.forEach(item => pickerContainer.appendChild(item));
  
  // Position near the button
  const btn = document.getElementById('addSplitMember');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    pickerContainer.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    pickerContainer.style.left = rect.left + 'px';
  }
  
  document.body.appendChild(pickerContainer);
  
  // Close when clicking outside
  const closeMenu = () => {
    if (pickerContainer.parentNode) {
      document.body.removeChild(pickerContainer);
    }
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function renderSplitMembersBreakdown() {
  if (!ui.splitMembersBreakdown) return;
  
  const memberCount = Object.keys(splitMembers).length;
  
  // Sakrij label i breakdown ako nema članova
  const label = document.querySelector('label[for="splitMembersBreakdown"]');
  if (!label) {
    // Find the label that contains "Members & Amounts"
    const labels = document.querySelectorAll('#splitMembersBreakdownRow label');
    labels.forEach(l => {
      if (memberCount === 0) {
        l.style.display = 'none';
      } else {
        l.style.display = 'inline-flex';
      }
    });
  }
  
  if (memberCount === 0) {
    ui.splitMembersBreakdown.innerHTML = '';
    ui.splitMembersBreakdown.style.display = 'none';
    return;
  }
  
  ui.splitMembersBreakdown.style.display = 'block';
  
  const currentUserName = currentUser ? (currentUser.name || currentUser.email) : '';
  const isEditing = editingSplitId !== null;
  const editingSplit = isEditing ? sharedData.splits.find(s => s.id === editingSplitId) : null;
  const isOwner = isEditing && editingSplit && currentUser && editingSplit.owner_id === currentUser.id;
  
  const breakdown = Object.entries(splitMembers).map(([member, amount]) => {
    const isCurrentUser = member === currentUserName;
    const displayName = isCurrentUser ? `${member} <span class="split-you-badge">You</span>` : member;
    const formattedAmount = Number(amount).toLocaleString();
    
    // Show remove button based on editing mode
    let removeBtn = '';
    if (!isCurrentUser) {
      // Always allow removing other members
      removeBtn = `<button type="button" class="split-member-remove" data-member="${member}">✕</button>`;
    } else if (isEditing && isOwner) {
      // When editing and user is owner, can't remove themselves
      removeBtn = '';
    } else if (isEditing && !isOwner && isCurrentUser) {
      // When editing and not owner, can remove themselves (leave the split)
      removeBtn = `<button type="button" class="split-member-remove" data-member="${member}">✕</button>`;
    }
    
    // Disable amount field for current user when creating, but allow when owner is editing
    const amountDisabled = isCurrentUser && (!isEditing || !isOwner);
    
    return `
      <div class="split-member-row ${isCurrentUser ? 'split-current-user' : ''}">
        <span class="split-member-name">${displayName}</span>
        <input type="number" class="split-member-amount" min="0" step="0.01" value="${amount}" data-member="${member}" ${amountDisabled ? 'disabled' : ''}>
        ${removeBtn}
      </div>
    `;
  }).join('');
  
  ui.splitMembersBreakdown.innerHTML = breakdown;
  
  // Add event listeners for amount inputs
  ui.splitMembersBreakdown.querySelectorAll('.split-member-amount').forEach(input => {
    input.addEventListener('change', (e) => {
      const member = e.target.dataset.member;
      splitMembers[member] = Number(e.target.value) || 0;
      updateSplitTotalAmount();
    });
  });
  
  // Add event listeners for remove buttons
  ui.splitMembersBreakdown.querySelectorAll('.split-member-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const member = btn.dataset.member;
      delete splitMembers[member];
      delete splitMemberFriendIds[member];
      renderSplitMembersBreakdown();
    });
  });
}

function addSplitMember(memberName, friendId = null) {
  if (memberName && !splitMembers.hasOwnProperty(memberName)) {
    const totalAmount = Number(ui.sharedAmount?.value || 0);
    const newMemberCount = Object.keys(splitMembers).length + 1;
    
    // Distribute total amount equally among all members including the new one
    if (totalAmount > 0 && newMemberCount > 0) {
      const perMember = totalAmount / newMemberCount;
      Object.keys(splitMembers).forEach(member => {
        splitMembers[member] = perMember;
      });
      splitMembers[memberName] = perMember;
    } else {
      splitMembers[memberName] = 0;
    }
    
    // Store friend ID if provided
    if (friendId) {
      splitMemberFriendIds[memberName] = friendId;
    }
    renderSplitMembersBreakdown();
  }
}

function updateSplitTotalAmount() {
  const total = Object.values(splitMembers).reduce((sum, amount) => sum + Number(amount), 0);
  if (ui.sharedAmount) {
    ui.sharedAmount.value = total.toFixed(2);
  }
}

function renderSplits() {
  if (!ui.splitsList) return;
  if (sharedData.splits.length === 0) {
    renderEmpty(ui.splitsList, 'No splits yet.');
    return;
  }
  // Prikaži samo prvi 3 splitova
  const visibleSplits = sharedData.splits.slice(0, 3);
  ui.splitsList.innerHTML = visibleSplits.map(split => {
    const memberAmounts = split.memberAmounts || {};
    const isRecurring = split.is_recurring;
    const monthlyAmount = split.monthly_amount;
    const isOwner = currentUser && split.owner_id === currentUser.id;
    
    const breakdown = Object.entries(memberAmounts)
      .map(([member, amount]) => {
        const displayAmount = isRecurring ? monthlyAmount || amount : amount;
        const monthlyText = isRecurring ? ' RSD/month' : ' RSD';
        return `<div class="breakdown-item">${member}: ${Number(displayAmount).toLocaleString()}${monthlyText}</div>`;
      })
      .join('');
    
    const membersDisplay = split.members.length ? split.members.join(', ') : 'No members';
    const totalDisplay = isRecurring ? `${Number(monthlyAmount || split.amount).toLocaleString()} RSD/month` : `${split.amount.toLocaleString()} RSD`;
    const recurringBadge = isRecurring ? '<span class="split-recurring-badge">🔄 Monthly</span>' : '';
    const editButton = isOwner ? `<button class="ghost split-edit" data-id="${split.id}" title="Edit split">✎</button>` : '';
    
    return `
      <div class="shared-item">
        <div>
          <h4>${split.name} ${recurringBadge}</h4>
          <p>${membersDisplay}</p>
          ${breakdown ? `<div class="split-breakdown">${breakdown}</div>` : ''}
        </div>
        <div class="split-item-footer">
          <span class="shared-amount">${totalDisplay}</span>
          <div class="split-item-buttons">
            ${editButton}
            <button class="ghost split-delete" data-id="${split.id}" title="Delete split">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAllSplits() {
  if (!ui.allSplitsList) return;
  if (sharedData.splits.length === 0) {
    ui.allSplitsList.innerHTML = '<div class="shared-empty">No splits created yet.</div>';
    return;
  }
  ui.allSplitsList.innerHTML = sharedData.splits.map(split => {
    const memberAmounts = split.memberAmounts || {};
    const isRecurring = split.is_recurring;
    const monthlyAmount = split.monthly_amount;
    const isOwner = currentUser && split.owner_id === currentUser.id;
    
    const breakdown = Object.entries(memberAmounts)
      .map(([member, amount]) => {
        const displayAmount = isRecurring ? monthlyAmount || amount : amount;
        const monthlyText = isRecurring ? ' RSD/month' : ' RSD';
        return `<div class="breakdown-item">${member}: ${Number(displayAmount).toLocaleString()}${monthlyText}</div>`;
      })
      .join('');
    
    const membersDisplay = split.members.length ? split.members.join(', ') : 'No members';
    const totalDisplay = isRecurring ? `${Number(monthlyAmount || split.amount).toLocaleString()} RSD/month` : `${split.amount.toLocaleString()} RSD`;
    const recurringBadge = isRecurring ? '<span class="split-recurring-badge">🔄 Monthly</span>' : '';
    const editButton = isOwner ? `<button class="ghost split-edit" data-id="${split.id}" title="Edit split">✎</button>` : '';
    
    return `
      <div class="shared-item">
        <div>
          <h4>${split.name} ${recurringBadge}</h4>
          <p>${membersDisplay}</p>
          ${breakdown ? `<div class="split-breakdown">${breakdown}</div>` : ''}
        </div>
        <div class="split-item-footer">
          <span class="shared-amount">${totalDisplay}</span>
          <div class="split-item-buttons">
            ${editButton}
            <button class="ghost split-delete" data-id="${split.id}" title="Delete split">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAll() {
  preserveScrollPosition(() => {
    renderInvites();
    renderWallets();
    renderSplits();
    renderFriends();
  });
}

function handleSubmit(event) {
  event.preventDefault();
  const name = ui.sharedName.value.trim();
  if (!name) return;

  if (currentType === 'invite') {
    const email = ui.sharedEmail.value.trim();
    if (!email) return;
    apiFetch('/invites', {
      method: 'POST',
      body: JSON.stringify({ name, email })
    }).then((invite) => {
      sharedData.invites.unshift(invite);
      renderInvites();
      closeModal();
    }).catch((error) => {
      if (ui.sharedEmailError) {
        ui.sharedEmailError.textContent = error.message || 'Invite failed.';
      }
    });
    return;
  }

    if (currentType === 'wallet') {
    const amount = Number(ui.sharedAmount.value || 0);
    const goalAmount = Number(ui.sharedGoalAmount?.value || 0) || null;
    const capAmount = Number(ui.sharedCapAmount?.value || 0) || null;
    const deadline = ui.sharedDeadline?.value || null;
    let members = ui.sharedMembers?.value
      ? ui.sharedMembers.value.split(',').map(value => value.trim()).filter(Boolean)
      : [];
    if (members.length === 0 && currentUser) {
      const fallbackName = currentUser.name || currentUser.email;
      if (fallbackName) members = [fallbackName];
    }
    if (members.length === 0) {
      alert('Please add at least one member name.');
      return;
    }
    const categories = ui.sharedCategories?.dataset.all === 'true'
      ? ['*']
      : (ui.sharedCategories?.value
        ? ui.sharedCategories.value.split(',').map(value => value.trim()).filter(Boolean)
        : []);

    const payload = { name, amount, notes: ui.sharedNotes.value.trim(), goalAmount, capAmount, deadline, members, categories };
    const isEditing = Boolean(editingWalletId);
    apiFetch(isEditing ? `/wallets/${editingWalletId}` : '/wallets', {
      method: isEditing ? 'PATCH' : 'POST',
      body: JSON.stringify(payload)
    }).then((wallet) => {
      if (isEditing) {
        sharedData.wallets = sharedData.wallets.map(w => String(w.id) === String(wallet.id) ? { ...w, ...wallet } : w);
      } else {
        sharedData.wallets.unshift(wallet);
        sharedData.walletTransactions[wallet.id] = [];
      }
      renderWallets();
      closeModal();
      editingWalletId = null;
    }).catch(() => {
      closeModal();
      editingWalletId = null;
    });
    return;
  }

  if (currentType === 'split') {
    const amount = Number(ui.sharedAmount.value || 0);
    const members = Object.keys(splitMembers);
    const memberAmounts = splitMembers;
    const isRecurring = ui.splitIsRecurring?.checked || false;
    const monthlyAmount = isRecurring ? amount / Object.keys(splitMembers).length : null;
    
    // Get friend IDs for members who are friends
    const friendIds = Object.values(splitMemberFriendIds).filter(id => id != null);
    
    if (members.length === 0) {
      alert('Please add at least one member to the split.');
      return;
    }
    
    const isEditing = editingSplitId !== null;
    const payload = { name, amount, members, memberAmounts, is_recurring: isRecurring, monthly_amount: monthlyAmount, friendIds };
    
    apiFetch(isEditing ? `/splits/${editingSplitId}` : '/splits', {
      method: isEditing ? 'PATCH' : 'POST',
      body: JSON.stringify(payload)
    }).then((split) => {
      if (isEditing) {
        sharedData.splits = sharedData.splits.map(s => String(s.id) === String(split.id) ? { ...s, ...split } : s);
      } else {
        sharedData.splits.unshift(split);
      }
      renderSplits();
      renderAllSplits();
      closeModal();
      editingSplitId = null;
      splitMembers = {};
      splitMemberFriendIds = {};
    }).catch(() => {
      closeModal();
      editingSplitId = null;
    });
    return;
  }
}

ui.openInviteHero?.addEventListener('click', () => openModal('invite'));
ui.openInviteCard?.addEventListener('click', () => openModal('invite'));
ui.openInviteSection?.addEventListener('click', () => openModal('invite'));
ui.openWalletHero?.addEventListener('click', () => openModal('wallet'));
ui.openWalletCard?.addEventListener('click', () => openModal('wallet'));
ui.openWalletSection?.addEventListener('click', () => openModal('wallet'));
ui.openSplitCard?.addEventListener('click', () => openModal('split'));
ui.openSplitSection?.addEventListener('click', () => openModal('split'));
ui.openSplitsAllButton?.addEventListener('click', () => {
  renderAllSplits();
  if (ui.allSplitsModal) {
    ui.allSplitsModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
});
ui.closeAllSplitsModal?.addEventListener('click', () => {
  if (ui.allSplitsModal) {
    ui.allSplitsModal.classList.remove('active');
    document.body.style.overflow = '';
  }
});
ui.allSplitsModal?.addEventListener('click', (e) => {
  if (e.target === ui.allSplitsModal) {
    ui.allSplitsModal.classList.remove('active');
    document.body.style.overflow = '';
  }
});
ui.closeModal?.addEventListener('click', closeModal);
ui.cancelModal?.addEventListener('click', closeModal);
ui.modal?.addEventListener('click', (event) => {
  if (event.target === ui.modal) closeModal();
});

// Add split member button - direct event listener
const addSplitMemberBtn = document.getElementById('addSplitMember');
if (addSplitMemberBtn) {
  addSplitMemberBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showSplitMemberPicker();
  });
}

// Update split total when amount changes - real-time calculation
ui.sharedAmount?.addEventListener('input', () => {
  if (currentType === 'split') {
    const manualTotal = Number(ui.sharedAmount.value) || 0;
    const memberCount = Object.keys(splitMembers).length;
    if (memberCount > 0 && manualTotal > 0) {
      const perMember = manualTotal / memberCount;
      Object.keys(splitMembers).forEach(member => {
        splitMembers[member] = perMember;
      });
      renderSplitMembersBreakdown();
    }
  }
});

ui.splitsList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  
  if (target.classList.contains('split-edit')) {
    const splitId = target.dataset.id;
    if (!splitId) return;
    const split = sharedData.splits.find(s => String(s.id) === String(splitId));
    if (!split) return;
    
    // Only owner can edit
    if (!currentUser || split.owner_id !== currentUser.id) {
      showNotification('Only the split owner can edit it!', 'error');
      return;
    }
    
    openModal('split', split);
  }
  
  if (target.classList.contains('split-delete')) {
    const splitId = target.dataset.id;
    if (!splitId) return;
    const confirmed = await openConfirm({
      title: 'Delete Split',
      text: 'Are you sure you want to delete this split? This cannot be undone.',
      okText: 'Yes, delete'
    });
    if (!confirmed) return;
    
    apiFetch(`/splits/${splitId}`, { method: 'DELETE' })
      .then(() => {
        sharedData.splits = sharedData.splits.filter(s => String(s.id) !== String(splitId));
        preserveScrollPosition(() => {
          renderSplits();
          renderAllSplits();
        });
      })
      .catch((error) => {
        alert('Failed to delete split: ' + (error.message || 'Unknown error'));
      });
  }
});

ui.allSplitsList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  
  if (target.classList.contains('split-edit')) {
    const splitId = target.dataset.id;
    if (!splitId) return;
    const split = sharedData.splits.find(s => String(s.id) === String(splitId));
    if (!split) return;
    
    // Only owner can edit
    if (!currentUser || split.owner_id !== currentUser.id) {
      showNotification('Only the split owner can edit it!', 'error');
      return;
    }
    
    openModal('split', split);
  }
  
  if (target.classList.contains('split-delete')) {
    const splitId = target.dataset.id;
    if (!splitId) return;
    const confirmed = await openConfirm({
      title: 'Delete Split',
      text: 'Are you sure you want to delete this split? This cannot be undone.',
      okText: 'Yes, delete'
    });
    if (!confirmed) return;
    
    apiFetch(`/splits/${splitId}`, { method: 'DELETE' })
      .then(() => {
        sharedData.splits = sharedData.splits.filter(s => String(s.id) !== String(splitId));
        preserveScrollPosition(() => {
          renderSplits();
          renderAllSplits();
        });
      })
      .catch((error) => {
        alert('Failed to delete split: ' + (error.message || 'Unknown error'));
      });
  }
});

ui.invitesList?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.classList.contains('shared-accept')) {
    const id = target.dataset.id;
    if (!id) return;
    apiFetch(`/invites/${id}/accept`, { method: 'POST' })
      .then(() => loadAll())
      .catch(() => {});
    return;
  }
  if (!target.classList.contains('shared-resend')) return;
  const id = target.dataset.id;
  if (!id) return;
  apiFetch(`/invites/${id}/resend`, { method: 'POST' }).catch(() => {});
});

ui.friendsList?.addEventListener('dragstart', (event) => {
  const target = event.target.closest('.friend-item');
  if (!target || !(target instanceof HTMLElement)) return;
  const payload = {
    name: target.dataset.name || '',
    email: target.dataset.email || '',
    id: target.dataset.id || ''
  };
  event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  event.dataTransfer?.setDragImage(target, 16, 16);
  target.classList.add('is-dragging');
});

ui.friendsList?.addEventListener('dragend', (event) => {
  const target = event.target.closest('.friend-item');
  if (!target || !(target instanceof HTMLElement)) return;
  target.classList.remove('is-dragging');
});
ui.walletsList?.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.classList.contains('wallet-transaction-form')) return;
  event.preventDefault();

  const walletId = form.dataset.id;
  if (!walletId) return;

  const memberInput = form.querySelector('[name="member"]');
  const amountInput = form.querySelector('input[name="amount"]');
  const categoryInput = form.querySelector('[name="category"]');
  const noteInput = form.querySelector('input[name="note"]');
  if (!memberInput || !amountInput || !categoryInput) return;

  const payload = {
    member: memberInput.value.trim(),
    amount: Number(amountInput.value || 0),
    category: categoryInput.value.trim(),
    note: noteInput?.value.trim() || ''
  };

  if (!payload.member || !payload.category || !payload.amount) return;

  apiFetch(`/wallets/${walletId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then((txn) => {
    if (!sharedData.walletTransactions[walletId]) sharedData.walletTransactions[walletId] = [];
    sharedData.walletTransactions[walletId].unshift(txn);
    memberInput.value = '';
    amountInput.value = '';
    categoryInput.value = '';
    if (noteInput) noteInput.value = '';
    renderWallets();
  }).catch(() => {});
});
ui.walletsList?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const walletId = target.dataset.id;
  if (!walletId) return;

  if (target.classList.contains('wallet-chip-remove')) {
    const member = target.dataset.member || '';
    if (!member) return;
    openConfirm({
      title: 'Remove member',
      text: `Da li si siguran da želiš da ukloniš ${member} iz ovog wallet-a?`,
      okText: 'Yes, remove'
    }).then((confirmed) => {
      if (!confirmed) return;
      removeMemberFromWallet(walletId, member);
    });
    return;
  }

  if (target.classList.contains('wallet-toggle')) {
    const hiddenWallets = getHiddenWallets();
    hiddenWallets[walletId] = !hiddenWallets[walletId];
    setHiddenWallets(hiddenWallets);
    renderWallets();
    return;
  }

  if (target.classList.contains('wallet-progress-toggle')) {
    const progressModes = getWalletProgressModes();
    progressModes[walletId] = progressModes[walletId] === 'savings-only' ? 'all' : 'savings-only';
    setWalletProgressModes(progressModes);
    const wallet = sharedData.wallets.find(w => String(w.id) === String(walletId));
    if (!wallet || !ui.walletsList) {
      renderWallets();
      return;
    }
    const hiddenWallets = getHiddenWallets();
    const progressCache = getWalletProgressCache();
    const { html, cacheUpdate } = buildWalletItem(wallet, progressModes, progressCache, hiddenWallets);
    progressCache[wallet.id] = cacheUpdate;
    setWalletProgressCache(progressCache);

    const existing = ui.walletsList.querySelector(`.wallet-item[data-id="${walletId}"]`);
    if (existing) {
      existing.outerHTML = html;
      const updated = ui.walletsList.querySelector(`.wallet-item[data-id="${walletId}"]`);
      requestAnimationFrame(() => applyWalletProgressAnimation(updated));
    } else {
      renderWallets();
    }
    return;
  }

  if (target.classList.contains('wallet-edit')) {
    const wallet = sharedData.wallets.find(w => String(w.id) === String(walletId));
    if (!wallet) return;
    openModal('wallet', wallet);
    return;
  }

  if (target.classList.contains('wallet-view-all')) {
    const name = target.dataset.name || '';
    const walletName = encodeURIComponent(name);
    const walletIdParam = encodeURIComponent(walletId);
    window.location.href = `../expenses/index.html?walletId=${walletIdParam}&walletName=${walletName}`;
    return;
  }

  if (target.classList.contains('wallet-delete')) {
    if (!confirm('Delete this wallet? This will remove its transactions.')) return;
    apiFetch(`/wallets/${walletId}`, { method: 'DELETE' })
      .then(() => {
        sharedData.wallets = sharedData.wallets.filter(wallet => String(wallet.id) !== String(walletId));
        delete sharedData.walletTransactions[walletId];
        const hiddenWallets = getHiddenWallets();
        delete hiddenWallets[walletId];
        setHiddenWallets(hiddenWallets);
        renderWallets();
      })
      .catch(() => {});
    return;
  }

  if (target.classList.contains('wallet-leave')) {
    apiFetch(`/wallets/${walletId}/leave`, { method: 'POST' })
      .then((payload) => {
        const wallet = sharedData.wallets.find(w => String(w.id) === String(walletId));
        if (wallet) wallet.members = payload.members || [];
        renderWallets();
      })
      .catch(() => {});
  }
});

ui.walletsList?.addEventListener('dragover', (event) => {
  const target = event.target.closest('.wallet-item');
  if (!target) return;
  event.preventDefault();
  target.classList.add('is-drop-target');
});

ui.walletsList?.addEventListener('dragleave', (event) => {
  const target = event.target.closest('.wallet-item');
  if (!target) return;
  target.classList.remove('is-drop-target');
});

ui.walletsList?.addEventListener('drop', (event) => {
  const target = event.target.closest('.wallet-item');
  if (!target) return;
  event.preventDefault();
  target.classList.remove('is-drop-target');
  const raw = event.dataTransfer?.getData('text/plain');
  if (!raw) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const name = payload?.name || payload?.email || '';
  if (!name) return;
  const walletId = target.dataset.id;
  if (!walletId) return;
  addMemberToWallet(walletId, name);
});
ui.friendsList?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  if (!id) return;
  if (target.classList.contains('friend-limit')) {
    apiFetch(`/friends/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ limit: Number(target.value || 0) })
    }).catch(() => {});
  }
});
ui.sharedForm?.addEventListener('submit', handleSubmit);
ui.sharedCategoriesAll?.addEventListener('click', () => {
  setAllCategoriesMode(true);
});
ui.sharedCategories?.addEventListener('input', () => {
  if (ui.sharedCategories?.dataset.all === 'true') {
    setAllCategoriesMode(false);
  }
});
ui.walletMemberPicker?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains('member-chip')) return;
  const name = target.dataset.name;
  if (!name || !ui.sharedMembers) return;
  const current = ui.sharedMembers.value
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!current.includes(name)) {
    current.push(name);
    ui.sharedMembers.value = current.join(', ');
  }
});

async function loadAll() {
  try {
    const [invites, wallets, splits, friends] = await Promise.all([
      apiFetch('/invites'),
      apiFetch('/wallets'),
      apiFetch('/splits'),
      apiFetch('/friends')
    ]);
    const walletTransactions = {};
    const results = await Promise.allSettled(wallets.map(wallet =>
      apiFetch(`/wallets/${wallet.id}/transactions`).then(list => {
        walletTransactions[wallet.id] = list;
      })
    ));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const walletId = wallets[index]?.id;
        if (walletId) walletTransactions[walletId] = [];
      }
    });
    sharedData = { invites, wallets, splits, friends, walletTransactions };
    renderAll();
  } catch (error) {
    if (error.status === 401) {
      setToken(null);
      setLoggedIn(false);
    } else {
      setLoggedIn(true);
    }
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!ui.loginEmail || !ui.loginPassword) return;
  try {
    const payload = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: ui.loginEmail.value.trim(),
        password: ui.loginPassword.value
      })
    }, false);
    setToken(payload.token);
    setLoggedIn(true);
    currentUser = await apiFetch('/me');
    await loadAll();
  } catch (error) {
    if (ui.authError) ui.authError.textContent = error.message || 'Login failed.';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  if (!ui.registerName || !ui.registerEmail || !ui.registerPassword) return;
  try {
    const payload = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: ui.registerName.value.trim(),
        email: ui.registerEmail.value.trim(),
        password: ui.registerPassword.value
      })
    }, false);
    setToken(payload.token);
    setLoggedIn(true);
    currentUser = await apiFetch('/me');
    await loadAll();
  } catch (error) {
    if (ui.authError) ui.authError.textContent = error.message || 'Registration failed.';
  }
}

async function init() {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  updateSidebarStats();
  setAuthView('login');
  ui.showLogin?.addEventListener('click', () => setAuthView('login'));
  ui.showRegister?.addEventListener('click', () => setAuthView('register'));
  ui.authLoginForm?.addEventListener('submit', handleLogin);
  ui.authRegisterForm?.addEventListener('submit', handleRegister);

  const token = getToken();
  if (!token) {
    setLoggedIn(false);
    return;
  }
  try {
    currentUser = await apiFetch('/me');
    setLoggedIn(true);
    await loadAll();
  } catch (error) {
    if (error.status === 401) {
      setToken(null);
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
  }
}

init();

window.addEventListener('storage', (event) => {
  if (event.key === 'walletSyncStamp') {
    loadAll();
  }
  if (event.key === 'expenseTrackerData') {
    updateSidebarStats();
  }
});

let lastWalletSyncStamp = localStorage.getItem('walletSyncStamp');
setInterval(() => {
  const nextStamp = localStorage.getItem('walletSyncStamp');
  if (nextStamp && nextStamp !== lastWalletSyncStamp) {
    lastWalletSyncStamp = nextStamp;
    loadAll();
  }
}, 3000);

let isWalletRefreshing = false;
setInterval(() => {
  if (!getToken() || isWalletRefreshing) return;
  isWalletRefreshing = true;
  loadAll().finally(() => {
    isWalletRefreshing = false;
  });
}, 8000);
