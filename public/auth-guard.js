(() => {
  const API_BASE = 'http://localhost:4000/api';
  const TOKEN_KEY = 'sharedBudgetToken';
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href = '../shared/index.html';
    return;
  }

  fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((res) => {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '../shared/index.html';
        return null;
      }
      return null;
    })
    .catch(() => {
      // If backend is down, keep the session and avoid redirect.
    });
})();
