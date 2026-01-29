(() => {
  const API_BASE = 'http://localhost:4000/api';
  const TOKEN_KEY = 'sharedBudgetToken';
  const chip = document.getElementById('accountChip');
  if (!chip) return;

  const img = chip.querySelector('img');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

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
      chip.appendChild(nameLabel);
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

  chip.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) uploadAvatar(file);
    input.value = '';
  });

  fetchMe();
})();
