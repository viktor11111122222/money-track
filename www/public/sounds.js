// ── Subtle UI sounds – WAV generated in JS, played via HTMLAudioElement ──
// HTMLAudioElement is more reliable than Web Audio API on Android WebView.
(function () {

    function soundsEnabled() {
        try {
            var raw = localStorage.getItem('mt_settings_v1');
            if (!raw) return true;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.notifications && parsed.notifications.sounds === false) return false;
        } catch (e) {}
        return true;
    }

    // Generate a mono 16-bit PCM WAV with a frequency sweep + decay envelope.
    // Returns a blob: URL (cached after first call).
    var _cache = {};
    function makeSoundURL(freqStart, freqEnd, duration) {
        var key = freqStart + '_' + freqEnd + '_' + duration;
        if (_cache[key]) return _cache[key];

        var SR = 44100;
        var n  = Math.floor(SR * duration);
        var buf = new ArrayBuffer(44 + n * 2);
        var v   = new DataView(buf);

        // WAV header
        var s = function(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
        s(0,  'RIFF'); v.setUint32(4,  36 + n * 2, true);
        s(8,  'WAVE'); s(12, 'fmt ');
        v.setUint32(16, 16,      true);  // subchunk1 size
        v.setUint16(20, 1,       true);  // PCM
        v.setUint16(22, 1,       true);  // mono
        v.setUint32(24, SR,      true);  // sample rate
        v.setUint32(28, SR * 2,  true);  // byte rate
        v.setUint16(32, 2,       true);  // block align
        v.setUint16(34, 16,      true);  // bits per sample
        s(36, 'data'); v.setUint32(40, n * 2, true);

        // PCM samples: exponential frequency sweep + exponential decay
        var phase = 0;
        for (var i = 0; i < n; i++) {
            var t   = i / SR;
            var progress = t / duration;
            var freq = freqStart * Math.pow(freqEnd / freqStart, progress);
            phase += 2 * Math.PI * freq / SR;
            var env  = Math.exp(-5 * progress);          // decay
            var sample = Math.round(Math.sin(phase) * env * 0.55 * 32767);
            v.setInt16(44 + i * 2, sample, true);
        }

        try {
            var url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
            _cache[key] = url;
            return url;
        } catch (e) {
            return null;
        }
    }

    // Pre-build URLs at idle time so first tap is instant
    var _click_url, _on_url, _off_url;
    function preload() {
        _click_url = makeSoundURL(1100, 600,  0.055);
        _on_url    = makeSoundURL(600,  1000, 0.09);
        _off_url   = makeSoundURL(1000, 550,  0.09);
    }
    if (window.requestIdleCallback) {
        requestIdleCallback(preload);
    } else {
        setTimeout(preload, 500);
    }

    function playURL(url) {
        if (!url) return;
        try {
            var a = new Audio(url);
            a.volume = 1.0;
            var p = a.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e) {}
    }

    function playClick()    { if (soundsEnabled()) playURL(_click_url || makeSoundURL(1100, 600,  0.055)); }
    function playToggleOn()  { if (soundsEnabled()) playURL(_on_url    || makeSoundURL(600,  1000, 0.09));  }
    function playToggleOff() { if (soundsEnabled()) playURL(_off_url   || makeSoundURL(1000, 550,  0.09));  }

    // ── Wire via event delegation ──
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button, [role="button"]');
        if (!btn) return;
        if (btn.classList.contains('color-swatch')) return;
        playClick();
    }, true);

    document.addEventListener('change', function (e) {
        var el = e.target;
        if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked) playToggleOn();
            else playToggleOff();
        }
    }, true);

    window._uiSound = { click: playClick, on: playToggleOn, off: playToggleOff };
})();
