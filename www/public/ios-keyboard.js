// iOS WKWebView keyboard fix — touchend must call .focus() explicitly
(function () {
  function fixKeyboard(e) {
    var el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      if (!el.readOnly && !el.disabled) {
        setTimeout(function () { el.focus(); }, 50);
      }
    }
  }
  document.addEventListener('touchend', fixKeyboard, { passive: true, capture: true });
})();
