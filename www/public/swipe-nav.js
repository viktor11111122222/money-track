// Swipe navigation — in-place content swap, zero page reload, zero flash
(function () {
  if (window !== window.top) return;
  if (window._swipeNavActive) return;
  window._swipeNavActive = true;

  var PAGES = [
    '/dashboard/index.html',
    '/expenses/index.html',
    '/shared/index.html',
    '/shared/settings.html'
  ];
  var THRESHOLD  = 60;
  var RESISTANCE = 0.15;

  // ── Find current page index ───────────────────────────────────
  var path = window.location.pathname;
  var idx  = -1;
  for (var i = 0; i < PAGES.length; i++) {
    if (path === PAGES[i] || path.endsWith(PAGES[i])) { idx = i; break; }
  }
  if (idx === -1) return;

  var W  = window.innerWidth;
  // Use the actual background colour so the iframe placeholder matches the theme
  var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() ||
           getComputedStyle(document.body).backgroundColor || '#0b1220';

  // ── Preload cache: url → hidden iframe (body-level, loaded in background) ─
  var preloadCache = {};

  function startPreload(url) {
    if (!url || preloadCache[url]) return;
    var f = document.createElement('iframe');
    f.src = url;
    f.setAttribute('scrolling', 'no');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + W + 'px;height:100%;border:none;background:' + bg + ';visibility:hidden;';
    document.body.appendChild(f);
    preloadCache[url] = f;
  }

  function takePreloaded(url) {
    var f = preloadCache[url];
    if (!f) return null;
    delete preloadCache[url];
    // Remove from body — caller will add it to the track
    f.parentNode && f.parentNode.removeChild(f);
    // Restore visibility and reset positioning for use in the track
    f.style.cssText = [
      'flex:0 0 ' + W + 'px;width:' + W + 'px;height:100%;',
      'border:none;flex-shrink:0;background:' + bg + ';visibility:visible;'
    ].join('');
    return f;
  }

  // ── Navigation generation counter (used to cancel stale timeouts) ─
  window._swipeNavGen = (window._swipeNavGen || 0) + 1;

  // ── Build layout ──────────────────────────────────────────────
  var clip = document.createElement('div');
  clip.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;';

  var track = document.createElement('div');
  track.style.cssText = [
    'position:absolute;top:0;left:0;height:100%;',
    'display:flex;flex-wrap:nowrap;',
    'width:' + W + 'px;',
    'transform:translateX(0);will-change:transform;'
  ].join('');

  var curSlot = document.createElement('div');
  curSlot.style.cssText = [
    'flex:0 0 ' + W + 'px;width:' + W + 'px;height:100%;',
    'overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;',
    'position:relative;'
  ].join('');

  while (document.body.firstChild) curSlot.appendChild(document.body.firstChild);
  track.appendChild(curSlot);
  clip.appendChild(track);
  document.body.style.overflow = 'hidden';
  document.body.style.height   = '100%';
  document.body.appendChild(clip);

  // ── State ─────────────────────────────────────────────────────
  var startX    = 0, startY = 0;
  var dragging  = false, blocked = false;
  var goLeft    = false;
  var ifr       = null;
  var targetUrl = null;
  var committed = false;

  // ── Helpers ───────────────────────────────────────────────────
  function setTrackX(x, animated) {
    track.style.transition = animated
      ? 'transform .28s cubic-bezier(.25,.46,.45,.94)'
      : 'none';
    track.style.transform = 'translateX(' + x + 'px)';
  }

  function baseX() { return goLeft ? 0 : -W; }

  function spawnIframe(url) {
    var f = document.createElement('iframe');
    f.src = url;
    f.setAttribute('scrolling', 'no');
    f.style.cssText = [
      'flex:0 0 ' + W + 'px;width:' + W + 'px;height:100%;',
      'border:none;flex-shrink:0;background:' + bg + ';'
    ].join('');
    return f;
  }

  function cleanup() {
    if (committed) return;
    track.style.transition = 'none';
    if (ifr) { ifr.remove(); ifr = null; }
    track.style.width     = W + 'px';
    track.style.transform = 'translateX(0)';
    targetUrl = null;
    dragging  = false;
    blocked   = false;
    // Discard any preloaded iframes from the previous touch (they'll be
    // re-preloaded fresh on the next touchstart).
    Object.keys(preloadCache).forEach(function (url) {
      preloadCache[url].parentNode && preloadCache[url].parentNode.removeChild(preloadCache[url]);
      delete preloadCache[url];
    });
  }

  function snapBack() {
    setTrackX(baseX(), true);
  }

  // ── Head resource sync ────────────────────────────────────────
  // pageHeadNodes  – newly-added head nodes; used for opacity-reveal timing
  // currentPageCssLinks – ALL stylesheet <link> elements currently in <head>
  //   (includes the initial page's links so they are removed on first nav)
  var pageHeadNodes = [];
  var currentPageCssLinks = [];
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
    currentPageCssLinks.push(l);
  });

  function syncHeadResources(ifrDoc) {
    pageHeadNodes = [];

    // ── Stylesheets: diff-based swap ───────────────────────────────────────
    // Build set of hrefs the new page needs
    var newHrefs = {};
    ifrDoc.head.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
      newHrefs[l.href] = true;
    });

    // Remove stylesheets the new page does NOT need
    currentPageCssLinks.forEach(function (link) {
      if (!newHrefs[link.href]) link.remove();
    });

    // Snapshot what is still in <head> after removals
    var existingLinkMap = {};
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
      existingLinkMap[l.href] = l;
    });

    // Add missing stylesheets; rebuild currentPageCssLinks to match new page
    currentPageCssLinks = [];
    ifrDoc.head.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
      var href = l.href;
      if (existingLinkMap[href]) {
        currentPageCssLinks.push(existingLinkMap[href]); // kept — already loaded
      } else {
        var nl = document.createElement('link');
        nl.rel  = 'stylesheet';
        nl.href = href;
        document.head.appendChild(nl);
        existingLinkMap[href] = nl;
        currentPageCssLinks.push(nl);
        pageHeadNodes.push(nl);  // newly added → wait for load before reveal
      }
    });

    // ── Scripts: only add new ones (executed scripts cannot be unloaded) ───
    var existingScripts = {};
    document.head.querySelectorAll('script[src]').forEach(function (s) {
      existingScripts[s.src] = true;
    });
    ifrDoc.head.querySelectorAll('script[src]').forEach(function (s) {
      var src = s.src;
      if (!existingScripts[src]) {
        var ns = document.createElement('script');
        ns.src = src;
        document.head.appendChild(ns);
        pageHeadNodes.push(ns);
        existingScripts[src] = true;
      }
    });
  }

  // ── Script re-execution with generation-aware timers ──────────
  // Wraps setTimeout/setInterval so callbacks from old pages auto-cancel
  // when the user navigates away before they fire.
  function reexecuteScripts(scripts) {
    var gen = window._swipeNavGen;

    // Save originals (idempotent — only patch once)
    var _origST = window._origSwipeST || window.setTimeout;
    var _origSI = window._origSwipeSI || window.setInterval;
    var _origCI = window._origSwipeCI || window.clearInterval;
    if (!window._origSwipeST) {
      window._origSwipeST = window.setTimeout;
      window._origSwipeSI = window.setInterval;
      window._origSwipeCI = window.clearInterval;
    }

    // Install generation-aware shims
    window.setTimeout = function(fn, delay) {
      var capturedGen = gen;
      return _origST.call(window, function() {
        if (window._swipeNavGen === capturedGen) fn.apply(this, arguments);
      }, delay);
    };
    window.setInterval = function(fn, delay) {
      var capturedGen = gen;
      var id;
      id = _origSI.call(window, function() {
        if (window._swipeNavGen !== capturedGen) { _origCI.call(window, id); return; }
        fn.apply(this, arguments);
      }, delay);
      return id;
    };

    // Re-execute each script, restore shims after all external ones load
    var pending = 0;
    Array.prototype.slice.call(scripts).forEach(function (old) {
      var neo = document.createElement('script');
      Array.prototype.slice.call(old.attributes).forEach(function (a) {
        neo.setAttribute(a.name, a.value);
      });
      if (old.src) {
        pending++;
        function done() {
          pending--;
          if (pending === 0) restore();
        }
        neo.addEventListener('load',  done);
        neo.addEventListener('error', done);
      } else {
        neo.textContent = old.textContent;
      }
      old.parentNode.replaceChild(neo, old);
    });

    if (pending === 0) restore();

    function restore() {
      window.setTimeout  = _origST;
      window.setInterval = _origSI;
      // Re-fire DOMContentLoaded so scripts that attach listeners inside
      // document.addEventListener('DOMContentLoaded', ...) re-attach them
      // after in-place content swap (the document never truly reloaded).
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
  }

  // ── In-place content swap (no page reload, no flash) ──────────
  function swapContent(ifrDoc, url) {
    // 1. Sync head resources (stylesheets + page-specific scripts like Chart.js)
    syncHeadResources(ifrDoc);

    // 2. Sync accent CSS variables from iframe html → main html (class stays untouched
    //    so dark-theme applied by theme-init.js is never accidentally removed)
    var ifrStyle = ifrDoc.documentElement.style;
    var props = ['--accent','--accent-hover','--accent-rgb','--accent-grad'];
    props.forEach(function(p){
      var v = ifrStyle.getPropertyValue(p);
      if (v) document.documentElement.style.setProperty(p, v);
    });

    // 3. Hide curSlot NOW — new page-specific stylesheets are loading async;
    //    revealing before they arrive causes the half-dark / white-bg flash.
    curSlot.style.transition = 'none';
    curSlot.style.opacity    = '0';

    // 4. Destroy any existing Chart.js instances before clearing the slot
    if (window.Chart) {
      curSlot.querySelectorAll('canvas').forEach(function (canvas) {
        var c = window.Chart.getChart ? window.Chart.getChart(canvas) : null;
        if (c) c.destroy();
      });
    }

    // 5. Replace slot content with iframe body
    while (curSlot.firstChild) curSlot.removeChild(curSlot.firstChild);
    var ifrBody = ifrDoc.body;
    while (ifrBody.firstChild) curSlot.appendChild(ifrBody.firstChild);
    curSlot.scrollTop = 0;

    // 6. Update URL and current page index
    history.replaceState(null, '', url);
    for (var i = 0; i < PAGES.length; i++) {
      if (url === PAGES[i] || url.endsWith(PAGES[i])) { idx = i; break; }
    }

    // 7. Increment nav generation so stale timers from the previous page cancel
    window._swipeNavGen = (window._swipeNavGen || 0) + 1;

    // 8. Re-execute body scripts with generation-aware timer shims
    reexecuteScripts(curSlot.querySelectorAll('script'));

    // 9. Reset track — order matters to avoid blank frame:
    //    goLeft  → [curSlot][ifr] at -W: reset to 0 first (shows curSlot), THEN remove ifr
    //    goRight → [ifr][curSlot] at  0: remove ifr first (curSlot shifts to 0), then reset width
    track.style.transition = 'none';
    if (goLeft) {
      track.style.width     = W + 'px';
      track.style.transform = 'translateX(0)';
      if (ifr) { ifr.remove(); ifr = null; }
    } else {
      if (ifr) { ifr.remove(); ifr = null; }
      track.style.width     = W + 'px';
      track.style.transform = 'translateX(0)';
    }

    targetUrl = null;
    committed = false;
    dragging  = false;
    blocked   = false;

    // 10. Reveal curSlot once new stylesheets have loaded (or immediately if none).
    //     Local Capacitor assets are typically cached and load in < 30 ms.
    var pendingLinks = pageHeadNodes.filter(function (n) { return n.tagName === 'LINK'; });
    if (pendingLinks.length === 0) {
      curSlot.style.opacity = '1';
    } else {
      var remaining = pendingLinks.length;
      function onReady() {
        if (--remaining <= 0) {
          curSlot.style.transition = 'opacity 0.12s ease';
          curSlot.style.opacity    = '1';
        }
      }
      pendingLinks.forEach(function (link) {
        link.addEventListener('load',  onReady, { once: true });
        link.addEventListener('error', onReady, { once: true });
      });
      // Safety fallback: reveal after 400 ms even if a stylesheet stalls
      setTimeout(function () {
        if (curSlot.style.opacity !== '1') {
          curSlot.style.transition = 'opacity 0.12s ease';
          curSlot.style.opacity    = '1';
        }
      }, 400);
    }
  }

  function commit() {
    committed = true;
    setTrackX(goLeft ? -W : 0, true);

    var done = false;
    var transitionReady = false;
    var iframeReady     = false;

    function trySwap() {
      if (done || !transitionReady || !iframeReady) return;
      done = true;
      swapContent(ifr.contentDocument, targetUrl);
    }

    // Wait for slide transition to finish
    track.addEventListener('transitionend', function () {
      transitionReady = true;
      trySwap();
    }, { once: true });
    // Safety: transitionend sometimes doesn't fire on iOS
    setTimeout(function () { transitionReady = true; trySwap(); }, 320);

    // Check iframe load state
    function checkIframe() {
      try {
        var d = ifr.contentDocument;
        if (d && d.readyState === 'complete' && d.body) {
          iframeReady = true;
          trySwap();
          return;
        }
      } catch (e) { /* cross-origin guard — shouldn't happen for local files */ }
      ifr.addEventListener('load', function () {
        iframeReady = true;
        trySwap();
      }, { once: true });
    }
    checkIframe();
  }

  // ── Touch events ──────────────────────────────────────────────
  document.addEventListener('touchstart', function (e) {
    cleanup();
    W      = window.innerWidth;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    // Preload adjacent pages now — gives maximum time for iframes to load
    // before the user's swipe reaches the commit threshold.
    if (idx > 0)                startPreload(PAGES[idx - 1]);
    if (idx < PAGES.length - 1) startPreload(PAGES[idx + 1]);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (blocked || committed) return;
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;

    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { blocked = true; return; }

      var el = e.target;
      while (el && el !== document.body) {
        var ox = getComputedStyle(el).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 4) {
          blocked = true; return;
        }
        el = el.parentElement;
      }

      goLeft    = dx < 0;
      targetUrl = goLeft
        ? (idx < PAGES.length - 1 ? PAGES[idx + 1] : null)
        : (idx > 0                ? PAGES[idx - 1] : null);

      if (targetUrl) {
        // Reuse the preloaded iframe if available (already loading/loaded)
        ifr = takePreloaded(targetUrl) || spawnIframe(targetUrl);
        track.style.width = (2 * W) + 'px';
        if (goLeft) {
          track.appendChild(ifr);
        } else {
          track.insertBefore(ifr, curSlot);
          track.style.transform = 'translateX(-' + W + 'px)';
        }
      }
      dragging = true;
    }

    var x = targetUrl ? dx : dx * RESISTANCE;
    setTrackX(baseX() + x, false);
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!dragging || committed) return;
    dragging = false;
    var dx = e.changedTouches[0].clientX - startX;
    if (targetUrl && Math.abs(dx) >= THRESHOLD) commit();
    else snapBack();
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    if (!committed) snapBack();
  }, { passive: true });

})();
