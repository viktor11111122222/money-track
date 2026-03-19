(() => {
  const TOKEN_KEY = 'sharedBudgetToken';
  const SESSION_FLAG = 'mt_session_active';
  const SESSION_ONLY = 'mt_session_only';

  // ── Fresh launch detection ─────────────────────────────────────────────────
  // sessionStorage je prazna samo pri cold startu (WKWebView process restart).
  // Ako nema SESSION_FLAG → korisnik je upravo otvorio app od nule.
  const isSessionActive = sessionStorage.getItem(SESSION_FLAG);
  if (!isSessionActive) {
    // Cold start: ako token nije trebalo da se pamti, obriši ga
    if (localStorage.getItem(SESSION_ONLY)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_ONLY);
    }
    // Postavi flag — važi do sledećeg zatvaranja app-a
    sessionStorage.setItem(SESSION_FLAG, '1');
  }
  // ──────────────────────────────────────────────────────────────────────────

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  // Local auth mode: token je validan ako počinje sa "local_"
  if (window.__LOCAL_AUTH__) {
    if (!token.startsWith('local_')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_ONLY);
    }
    return;
  }

  // Real backend mode: proveri token na serveru
  const API_BASE = window.__API_BASE__ || '/api';
  fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((res) => {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_ONLY);
      }
    })
    .catch(() => {
      // Backend nedostupan — ostavi sesiju aktivnom
    });
})();
