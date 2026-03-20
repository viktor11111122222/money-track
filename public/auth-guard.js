(() => {
  const TOKEN_KEY = 'sharedBudgetToken';
  const SESSION_FLAG = 'mt_session_active';
  const SESSION_ONLY = 'mt_session_only';
  const FORCE_LOGIN  = 'mt_force_login';
  const LOGIN_PAGE   = '/shared/index.html';

  function redirectToLogin() {
    if (window.location.pathname !== LOGIN_PAGE) {
      window.location.replace(LOGIN_PAGE);
    }
  }

  // ── Fresh launch detection ─────────────────────────────────────────────────
  // sessionStorage je prazna samo pri cold startu (WKWebView process restart).
  const isSessionActive = sessionStorage.getItem(SESSION_FLAG);
  if (!isSessionActive) {
    // Cold start: ako token nije trebalo da se pamti, obriši ga
    if (localStorage.getItem(SESSION_ONLY)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_ONLY);
      // Signaliziraj da korisnik mora ponovo da se uloguje
      sessionStorage.setItem(FORCE_LOGIN, '1');
    }
    sessionStorage.setItem(SESSION_FLAG, '1');
  }
  // ──────────────────────────────────────────────────────────────────────────

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    // Redirect SAMO ako je sesija namerno istekla (nije remember me).
    // Lokalni korisnici (bez backend naloga) prolaze slobodno.
    if (sessionStorage.getItem(FORCE_LOGIN)) {
      sessionStorage.removeItem(FORCE_LOGIN);
      redirectToLogin();
    }
    return;
  }

  // Local auth mode: token je validan ako počinje sa "local_"
  if (window.__LOCAL_AUTH__) {
    if (!token.startsWith('local_')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_ONLY);
      redirectToLogin();
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
        redirectToLogin();
      }
    })
    .catch(() => {
      // Backend nedostupan — ostavi sesiju aktivnom
    });
})();
