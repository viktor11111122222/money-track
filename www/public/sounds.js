// ── Subtle UI sounds via Web Audio API (no external files) ──
(function () {
    var _ctx = null;
    var _unlocked = false;

    function soundsEnabled() {
        try {
            var raw = localStorage.getItem('mt_settings_v1');
            if (!raw) return true;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.notifications && parsed.notifications.sounds === false) return false;
        } catch (e) {}
        return true;
    }

    function getCtx() {
        if (!_ctx) {
            try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        return _ctx;
    }

    // Android WebView keeps AudioContext suspended until explicitly resumed
    // after a real user gesture. Unlock on first touchstart/click.
    function unlockAudio() {
        if (_unlocked) return;
        var c = getCtx();
        if (!c) return;
        if (c.state === 'suspended') {
            c.resume().then(function () { _unlocked = true; }).catch(function () {});
        } else {
            _unlocked = true;
        }
    }

    document.addEventListener('touchstart', unlockAudio, { passive: true, capture: true });
    document.addEventListener('click', unlockAudio, { capture: true });

    // Resume if suspended, then run fn(context)
    function play(fn) {
        if (!soundsEnabled()) return;
        var c = getCtx();
        if (!c) return;
        if (c.state === 'suspended') {
            c.resume().then(function () { try { fn(c); } catch (e) {} }).catch(function () {});
        } else {
            try { fn(c); } catch (e) {}
        }
    }

    // Short soft "tick" – for button clicks
    function playClick() {
        play(function (c) {
            var osc  = c.createOscillator();
            var gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1100, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.055);
            gain.gain.setValueAtTime(0.07, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.055);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + 0.055);
        });
    }

    // Rising soft blip – toggle ON
    function playToggleOn() {
        play(function (c) {
            var osc  = c.createOscillator();
            var gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, c.currentTime + 0.09);
            gain.gain.setValueAtTime(0.06, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + 0.09);
        });
    }

    // Falling soft blip – toggle OFF
    function playToggleOff() {
        play(function (c) {
            var osc  = c.createOscillator();
            var gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(550, c.currentTime + 0.09);
            gain.gain.setValueAtTime(0.06, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + 0.09);
        });
    }

    // ── Wire via event delegation (catches dynamic elements too) ──
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button, [role="button"]');
        if (!btn) return;
        // Skip color swatches (accent picker) – they already trigger applyAccent
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

    // Expose for manual use if needed
    window._uiSound = { click: playClick, on: playToggleOn, off: playToggleOff };
})();
