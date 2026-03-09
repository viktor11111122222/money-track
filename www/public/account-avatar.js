(() => {
  const API_BASE = (window.location.port === '5500' || window.location.port === '5501') ? 'http://localhost:8080/api' : '/api';
  const TOKEN_KEY = 'sharedBudgetToken';
  const chip = document.getElementById('accountChip');
  if (!chip) return;

  const img = chip.querySelector('img');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'account-dropdown';
  dropdown.style.cssText = `
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    min-width: 160px;
    z-index: 1000;
    overflow: hidden;
  `;

  const changeAvatarBtn = document.createElement('button');
  changeAvatarBtn.type = 'button';
  changeAvatarBtn.textContent = '🖼️ Change Avatar';
  changeAvatarBtn.style.cssText = `
    display: block; width: 100%; padding: 10px 14px;
    background: none; border: none; text-align: left;
    cursor: pointer; font-size: 13px; color: var(--text, #1e293b);
    border-bottom: 1px solid var(--border, #e2e8f0);
  `;
  changeAvatarBtn.addEventListener('mouseenter', () => { changeAvatarBtn.style.background = 'var(--hover-bg, #f1f5f9)'; });
  changeAvatarBtn.addEventListener('mouseleave', () => { changeAvatarBtn.style.background = 'none'; });

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.textContent = '🚪 Logout';
  logoutBtn.style.cssText = `
    display: block; width: 100%; padding: 10px 14px;
    background: none; border: none; text-align: left;
    cursor: pointer; font-size: 13px; color: #ef4444;
  `;
  logoutBtn.addEventListener('mouseenter', () => { logoutBtn.style.background = 'var(--hover-bg, #f1f5f9)'; });
  logoutBtn.addEventListener('mouseleave', () => { logoutBtn.style.background = 'none'; });

  dropdown.appendChild(changeAvatarBtn);
  dropdown.appendChild(logoutBtn);

  chip.style.position = 'relative';
  chip.appendChild(dropdown);

  let dropdownOpen = false;

  function openDropdown() {
    dropdown.style.display = 'block';
    dropdownOpen = true;
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
    dropdownOpen = false;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function applyAvatar(dataUrl) {
    if (img && dataUrl) img.src = dataUrl;
  }

  function applyUserName(name) {
    if (!chip || !name) return;
    let nameLabel = chip.querySelector('.account-name');
    if (!nameLabel) {
      nameLabel = document.createElement('span');
      nameLabel.className = 'account-name';
      chip.insertBefore(nameLabel, dropdown);
    }
    nameLabel.textContent = name;
  }

  async function fetchMe() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const user = await res.json();
    if (user.avatar) applyAvatar(user.avatar);
    if (user.name) applyUserName(user.name);
  }

  async function uploadAvatar(file) {
    const token = getToken();
    if (!token) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') return;
      const res = await fetch(`${API_BASE}/me/avatar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatar: dataUrl })
      });
      if (res.ok) applyAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdownOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  changeAvatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDropdown();
    input.click();
  });

  logoutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/shared/index.html';
  });

  document.addEventListener('click', () => {
    if (dropdownOpen) closeDropdown();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) uploadAvatar(file);
    input.value = '';
  });

  fetchMe();
})();
