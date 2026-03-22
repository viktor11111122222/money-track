// ── Subtle UI sounds via Web Audio API (no external files) ──
(function () {
    var _ctx = null;

    function soundsEnabled() {
        try {
            var raw = localStorage.getItem('mt_settings_v1');
            if (!raw) return true;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.notifications && parsed.notifications.sounds === false) return false;
        } catch (e) {}
        return true;
    }

    function ctx() {
        if (!_ctx) {
            try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        // iOS / Safari require resume after a user gesture
        if (_ctx && _ctx.state === 'suspended') { try { _ctx.resume(); } catch (e) {} }
        return _ctx;
    }

    // Short soft "tick" – for button clicks
    function playClick() {
        if (!soundsEnabled()) return;
        var c = ctx(); if (!c) return;
        try {
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
        } catch (e) {}
    }

    // Rising soft blip – toggle ON
    function playToggleOn() {
        if (!soundsEnabled()) return;
        var c = ctx(); if (!c) return;
        try {
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
        } catch (e) {}
    }

    // Falling soft blip – toggle OFF
    function playToggleOff() {
        if (!soundsEnabled()) return;
        var c = ctx(); if (!c) return;
        try {
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
        } catch (e) {}
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
