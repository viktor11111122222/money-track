(() => {
  const API_BASE = (window.location.port === '5500' || window.location.port === '5501') ? 'http://localhost:8080/api' : '/api';
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
