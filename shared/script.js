const API_BASE = 'http://localhost:4000/api';
const TOKEN_KEY = 'sharedBudgetToken';

const ui = {
  openInviteHero: document.getElementById('openInviteHero'),
  openWalletHero: document.getElementById('openWalletHero'),
  openInviteCard: document.getElementById('openInviteCard'),
  openWalletCard: document.getElementById('openWalletCard'),
  openSplitCard: document.getElementById('openSplitCard'),
  openInviteSection: document.getElementById('openInviteSection'),
  openWalletSection: document.getElementById('openWalletSection'),
  openSplitSection: document.getElementById('openSplitSection'),
  invitesList: document.getElementById('invitesList'),
  walletsList: document.getElementById('walletsList'),
  splitsList: document.getElementById('splitsList'),
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

let currentType = 'invite';
let sharedData = { invites: [], wallets: [], splits: [], friends: [], walletTransactions: {} };
let currentUser = null;

function getHiddenWallets() {
  try {
    const raw = localStorage.getItem('hiddenWallets');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setHiddenWallets(next) {
  localStorage.setItem('hiddenWallets', JSON.stringify(next));
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
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (withAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch {
    const error = new Error('Backend is not reachable. Start the server on http://localhost:4000.');
    error.status = 0;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || 'Request failed.';
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

function setModalMode(type) {
  currentType = type;
  ui.sharedForm.reset();
  if (ui.sharedEmailError) ui.sharedEmailError.textContent = '';
  ui.sharedEmailRow.style.display = type === 'invite' ? 'flex' : 'none';
  ui.sharedAmountRow.style.display = type === 'wallet' || type === 'split' ? 'flex' : 'none';
  ui.sharedGoalRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedCapRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedDeadlineRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedMembersRow.style.display = type === 'wallet' || type === 'split' ? 'flex' : 'none';
  ui.sharedCategoriesRow.style.display = type === 'wallet' ? 'flex' : 'none';
  ui.sharedNotesRow.style.display = type === 'wallet' ? 'flex' : 'none';
  if (type === 'wallet') {
    setAllCategoriesMode(false);
    renderWalletMemberPicker();
  }

  if (type === 'invite') {
    const hiddenWallets = getHiddenWallets();
    ui.modalTitle.textContent = 'New Invite';
    ui.sharedName.placeholder = 'Full name';
    ui.sharedEmail.required = true;
  }
  if (type === 'wallet') {
    ui.modalTitle.textContent = 'New Wallet';
    ui.sharedName.placeholder = 'Wallet name';
    ui.sharedEmail.required = false;
  }
  if (type === 'split') {
    ui.modalTitle.textContent = 'New Split';
    ui.sharedName.placeholder = 'Bill name';
    ui.sharedEmail.required = false;
  }
}

function openModal(type) {
  if (!ui.modal) return;
  setModalMode(type);
  ui.modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!ui.modal) return;
  ui.modal.classList.remove('active');
  ui.modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (ui.sharedEmailError) ui.sharedEmailError.textContent = '';
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="shared-empty">${text}</div>`;
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
    return `
      <div class="shared-item friend-item" data-id="${friend.id}">
        <div>
          <h4>${friend.name}</h4>
          <p>${friend.email}</p>
        </div>
        <div class="friend-controls">
          <label>
            Limit (RSD)
            <input type="number" class="friend-limit" data-id="${friend.id}" min="0" step="0.01" value="${friend.limitAmount ?? 0}">
          </label>
        </div>
      </div>
    `;
  }).join('');
}

function renderWallets() {
  if (!ui.walletsList) return;
  if (sharedData.wallets.length === 0) {
    renderEmpty(ui.walletsList, 'No wallets created.');
    return;
  }
  const hiddenWallets = getHiddenWallets();
  ui.walletsList.innerHTML = sharedData.wallets.map(wallet => {
    const transactions = sharedData.walletTransactions[wallet.id] || [];
    const totalSpent = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
    const goalAmount = Number.isFinite(wallet.goalAmount) && wallet.goalAmount > 0 ? wallet.goalAmount : (Number(wallet.amount) || 0);
    const capAmount = Number.isFinite(wallet.capAmount) && wallet.capAmount > 0 ? wallet.capAmount : null;
    const progressPct = goalAmount > 0 ? Math.min(100, Math.round((totalSpent / goalAmount) * 100)) : 0;
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
      const label = isCurrentMember(m) ? `${m} (you)` : m;
      return `<span class="wallet-chip">${label}</span>`;
    });
    if (isOwner && !members.some(isCurrentMember)) {
      memberChips.unshift('<span class="wallet-chip">You</span>');
    }
    if (!memberChips.length && currentUser) {
      memberChips.push('<span class="wallet-chip">You</span>');
    }
    const membersHtml = memberChips.length
      ? `<div class="wallet-chip-group">${memberChips.join('')}</div>`
      : '<div class="wallet-muted">No members set.</div>';

    const transactionHtml = transactions.length
      ? transactions.slice(0, 4).map(txn => `
        <div class="wallet-txn-item">
          <div>
            <strong>${txn.member}</strong>
            <span>${txn.category}</span>
            ${txn.note ? `<em>${txn.note}</em>` : ''}
          </div>
          <span class="wallet-txn-amount">-${txn.amount.toLocaleString()} RSD</span>
        </div>
      `).join('')
      : '<div class="wallet-muted">No transactions yet.</div>';

    return `
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
              ${capAmount ? `<span class="${capExceeded ? 'wallet-cap-danger' : ''}">Cap: <strong>${capAmount.toLocaleString()} RSD</strong></span>` : ''}
            </div>
            <button class="ghost wallet-toggle" data-id="${wallet.id}">${isHidden ? 'Show details' : 'Hide wallet'}</button>
            ${isOwner ? `<button class="ghost wallet-delete" data-id="${wallet.id}">Delete</button>` : ''}
            ${canLeave ? `<button class="ghost wallet-leave" data-id="${wallet.id}">Leave</button>` : ''}
          </div>
        </div>
        <div class="wallet-progress">
          <div class="wallet-progress-bar">
            <div class="wallet-progress-fill ${progressState}" style="width:${progressPct}%;"></div>
          </div>
          <span>${progressPct}% of goal</span>
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
  }).join('');
}

function renderSplits() {
  if (!ui.splitsList) return;
  if (sharedData.splits.length === 0) {
    renderEmpty(ui.splitsList, 'No splits yet.');
    return;
  }
  ui.splitsList.innerHTML = sharedData.splits.map(split => {
    const members = split.members.length ? split.members.join(', ') : 'No members';
    return `
      <div class="shared-item">
        <div>
          <h4>${split.name}</h4>
          <p>${members}</p>
        </div>
        <span class="shared-amount">${split.amount.toLocaleString()} RSD</span>
      </div>
    `;
  }).join('');
}

function renderAll() {
  renderInvites();
  renderWallets();
  renderSplits();
  renderFriends();
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
    const members = ui.sharedMembers?.value
      ? ui.sharedMembers.value.split(',').map(value => value.trim()).filter(Boolean)
      : [];
    const categories = ui.sharedCategories?.dataset.all === 'true'
      ? ['*']
      : (ui.sharedCategories?.value
        ? ui.sharedCategories.value.split(',').map(value => value.trim()).filter(Boolean)
        : []);
    apiFetch('/wallets', {
      method: 'POST',
      body: JSON.stringify({ name, amount, notes: ui.sharedNotes.value.trim(), goalAmount, capAmount, deadline, members, categories })
    }).then((wallet) => {
      sharedData.wallets.unshift(wallet);
      sharedData.walletTransactions[wallet.id] = [];
      renderWallets();
      closeModal();
    }).catch(() => {
      closeModal();
    });
    return;
  }

  if (currentType === 'split') {
    const amount = Number(ui.sharedAmount.value || 0);
    const members = ui.sharedMembers.value
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    apiFetch('/splits', {
      method: 'POST',
      body: JSON.stringify({ name, amount, members })
    }).then((split) => {
      sharedData.splits.unshift(split);
      renderSplits();
      closeModal();
    }).catch(() => {
      closeModal();
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
ui.closeModal?.addEventListener('click', closeModal);
ui.cancelModal?.addEventListener('click', closeModal);
ui.modal?.addEventListener('click', (event) => {
  if (event.target === ui.modal) closeModal();
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

  if (target.classList.contains('wallet-toggle')) {
    const hiddenWallets = getHiddenWallets();
    hiddenWallets[walletId] = !hiddenWallets[walletId];
    setHiddenWallets(hiddenWallets);
    renderWallets();
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
