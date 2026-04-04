(() => {
  const THRESHOLD  = 60;   // px of pull needed to trigger refresh
  const RESISTANCE = 0.65; // pill travel per px of finger movement

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #_ptr {
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      left: 50%;
      transform: translate(-50%, -100%);
      visibility: hidden;
      background: var(--card-bg, #fff);
      border-radius: 0 0 22px 22px;
      padding: 10px 20px 13px;
      display: flex; align-items: center; gap: 9px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.14);
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      font-size: 13px; font-weight: 500;
      color: var(--text, #1e293b);
      z-index: 99990; pointer-events: none;
      will-change: transform;
      transition: transform 0.28s cubic-bezier(.4,0,.2,1),
                  visibility 0s linear 0.28s;
    }
    #_ptr.ptr-pulling {
      visibility: visible;
      transition: none;
    }
    #_ptr.ptr-spinning {
      visibility: visible;
    }
    #_ptr.ptr-ready { color: #6366f1; }
    #_ptr svg { flex-shrink: 0; }
    #_ptr.ptr-spinning svg { animation: _ptr_spin 0.65s linear infinite; }
    @keyframes _ptr_spin { to { transform: rotate(360deg); } }
    .dark-theme #_ptr { background: #1a2332; color: #e2e8f0; box-shadow: 0 6px 28px rgba(0,0,0,0.4); }

    #_ptr_overlay {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 22px;
      background: var(--bg, #f4f6f8);
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s ease;
    }
    #_ptr_overlay.ptr-show { opacity: 1; pointer-events: all; }
    #_ptr_overlay .ptr-logo {
      width: 72px; height: 72px;
      filter: drop-shadow(0 0 16px rgba(100,80,255,.55));
    }
    #_ptr_overlay .ptr-dots { display: flex; gap: 7px; }
    #_ptr_overlay .ptr-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #6366f1;
      animation: _ptr_dot 1.2s ease infinite;
    }
    #_ptr_overlay .ptr-dot:nth-child(2) { animation-delay: .2s; }
    #_ptr_overlay .ptr-dot:nth-child(3) { animation-delay: .4s; }
    @keyframes _ptr_dot {
      0%,55%,100% { transform: translateY(0); opacity:.35; }
      27%          { transform: translateY(-6px); opacity:1; }
    }
    .dark-theme #_ptr_overlay { background: #070c18; }
  `;
  document.head.appendChild(style);

  // ── Elements ─────────────────────────────────────────────────────────────────
  const ptr = document.createElement('div');
  ptr.id = '_ptr';
  ptr.innerHTML = `
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    <span id="_ptr_txt">Pull to refresh</span>
  `;
  document.body.appendChild(ptr);
  const txt = document.getElementById('_ptr_txt');

  const overlay = document.createElement('div');
  overlay.id = '_ptr_overlay';
  overlay.innerHTML = `
    <img class="ptr-logo" src="/public/logo_2.svg" alt="">
    <div class="ptr-dots">
      <div class="ptr-dot"></div><div class="ptr-dot"></div><div class="ptr-dot"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Measure pill height after layout
  let pillH = 43;
  requestAnimationFrame(() => { pillH = ptr.offsetHeight || 43; });

  // ── AdMob banner helpers ──────────────────────────────────────────────────────
  // The AdMob banner is a native view that sits above the WebView.
  // We hide it while pulling so the pill is visible, then restore it on cancel.
  let bannerHidden = false;

  function hideAdBanner() {
    if (bannerHidden) return;
    bannerHidden = true;
    try {
      const p = window.Capacitor?.Plugins?.AdMob;
      if (p) p.hideBanner().catch(() => {});
    } catch (_) {}
  }

  function restoreAdBanner() {
    if (!bannerHidden) return;
    bannerHidden = false;
    try {
      if (window._adMob) window._adMob.show();
    } catch (_) {}
  }

  // ── Scroll detection ─────────────────────────────────────────────────────────
  function getScrollTop() {
    // Check window/body first — this is the real scroll position on mobile.
    // Do NOT rely on main.overflowY: setting overflow-x:hidden forces
    // overflow-y to 'auto' by spec, making main.scrollTop always return 0
    // even when the page has scrolled.
    const winScroll = window.scrollY
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || 0;
    if (winScroll > 0) return winScroll;
    // Fallback: a fixed-height inner scroll container (if present)
    const main = document.querySelector('main');
    if (main && main.scrollTop > 0) return main.scrollTop;
    return 0;
  }

  // ── Touch state ───────────────────────────────────────────────────────────────
  let startY        = 0;
  let startedAtTop  = false;
  let active        = false;
  let triggered     = false;

  document.addEventListener('touchstart', e => {
    // Always capture startY so it's fresh for every new gesture.
    // Only allow pull-to-refresh if the gesture begins while already at the top.
    startY       = e.touches[0].clientY;
    startedAtTop = getScrollTop() <= 4;
    active       = false;
    triggered    = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (triggered || !startedAtTop) return;
    // If user scrolled away from top during this gesture, cancel
    if (getScrollTop() > 4) { startedAtTop = false; return; }
    const dy = e.touches[0].clientY - startY;

    if (dy <= 0) {
      // User pulled back up — retract the pill immediately
      if (active) {
        active = false;
        ptr.classList.add('ptr-pulling'); // no transition while following finger
        ptr.style.transform = 'translate(-50%, -100%)';
        ptr.classList.remove('ptr-ready');
        txt.textContent = 'Pull to refresh';
        ptr.querySelector('svg').style.transform = '';
        restoreAdBanner();
      }
      return;
    }

    // Hide native ad banner as soon as user starts pulling
    if (dy > 12) hideAdBanner();

    active = true;
    // travel proportional to dy, capped so full pill slides into view
    const travel = Math.min(dy * RESISTANCE, pillH + 8);
    ptr.classList.add('ptr-pulling');
    ptr.classList.toggle('ptr-ready', dy >= THRESHOLD);
    ptr.style.transform = `translate(-50%, calc(-100% + ${travel}px))`;

    ptr.querySelector('svg').style.transform = `rotate(${Math.min(dy * 3, 330)}deg)`;
    txt.textContent = dy >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (triggered) return;
    const dy = e.changedTouches[0].clientY - startY;
    active = false;

    if (startedAtTop && dy >= THRESHOLD && getScrollTop() <= 4) {
      triggered = true;
      doRefresh();
    } else {
      retractPill();
      restoreAdBanner();
    }
  }, { passive: true });

  // ── Actions ───────────────────────────────────────────────────────────────────
  function retractPill() {
    // Re-enable transition so pill smoothly slides back up
    ptr.classList.remove('ptr-pulling', 'ptr-ready', 'ptr-spinning');
    ptr.style.transform = '';
    txt.textContent = 'Pull to refresh';
    ptr.querySelector('svg').style.transform = '';
  }

  function doRefresh() {
    ptr.classList.remove('ptr-pulling', 'ptr-ready');
    ptr.classList.add('ptr-spinning');
    ptr.style.transform = 'translate(-50%, 0)';
    txt.textContent = 'Refreshing…';

    setTimeout(() => {
      overlay.classList.add('ptr-show');
      sessionStorage.removeItem('mt_app_loaded');
      setTimeout(() => window.location.reload(), 300);
    }, 350);
  }
})();
