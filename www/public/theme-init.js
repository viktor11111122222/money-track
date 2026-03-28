(function(){
    try{
        // Detect Capacitor platform and add class to <html> immediately
        try {
            var _cap = window.Capacitor;
            var _plat = (_cap && _cap.getPlatform) ? _cap.getPlatform() : 'web';
            document.documentElement.classList.add('platform-' + _plat);
        } catch(e) {}

        // Force sidebar width to 0 immediately — prevents FOUC where margin-left: var(--sidebar-width)
        // resolves to 360px or 100% before mobile-nav.css overrides kick in on Android WebView
        document.documentElement.style.setProperty('--sidebar-width', '0px');

        // Inline !important beats all author stylesheet !important — definitive layout fix
        document.addEventListener('DOMContentLoaded', function(){
            var main = document.querySelector('main');
            if(main){
                main.style.setProperty('margin-left', '0px', 'important');
                main.style.setProperty('margin-right', '0px', 'important');
                main.style.setProperty('width', '100%', 'important');
                main.style.setProperty('max-width', '100vw', 'important');
                main.style.setProperty('overflow-x', 'hidden', 'important');
                main.style.setProperty('flex', '0 1 auto', 'important');
            }
            var mc = document.querySelector('.main-container');
            if(mc){
                mc.style.setProperty('grid-template-columns', '1fr', 'important');
                mc.style.setProperty('overflow-x', 'hidden', 'important');
                mc.style.setProperty('width', '100%', 'important');
                mc.style.setProperty('max-width', '100%', 'important');
            }
            var html = document.documentElement;
            html.style.setProperty('height', 'auto', 'important');
            html.style.setProperty('overflow', 'visible', 'important');
            var body = document.body;
            if(body) body.style.setProperty('height', 'auto', 'important');
        });

        // One-time migration: previous buggy code could have written 'dark' to
        // mt_theme_pref by reading stale mt_settings_v1 data. Reset it on first
        // run of this version so the user's explicit setting (or light default) wins.
        if (!localStorage.getItem('mt_theme_v3')) {
            try {
                var raw0 = localStorage.getItem('mt_settings_v1');
                var p0 = raw0 ? JSON.parse(raw0) : null;
                var migrated = (p0 && p0.appearance && p0.appearance.theme) || 'light';
                localStorage.setItem('mt_theme_pref', migrated);
                localStorage.setItem('mt_theme_v3', '1');
            } catch(e) {}
        }

        var raw = localStorage.getItem('mt_settings_v1');
        var parsed = raw ? JSON.parse(raw) : null;
        var theme = localStorage.getItem('mt_theme_pref') || 'light';
        // Always persist so the next cold start reads the correct value
        try { localStorage.setItem('mt_theme_pref', theme); } catch(e) {}
        var root = document.documentElement;
        function setMode(mode){
            if(mode === 'dark') root.classList.add('dark-theme');
            else root.classList.remove('dark-theme');
        }
        if(theme === 'system'){
            var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
            var isDark = mq ? mq.matches : false;
            setMode(isDark ? 'dark' : 'light');
            if(mq){
                try{ mq.addEventListener('change', function(e){ setMode(e.matches ? 'dark' : 'light'); }); }
                catch(e){ try{ mq.addListener(function(e){ setMode(e.matches ? 'dark' : 'light'); }); }catch(_){} }
            }
        } else {
            setMode(theme === 'dark' ? 'dark' : 'light');
        }
        // Apply accent color immediately
        var accent = parsed && parsed.appearance && parsed.appearance.accent ? parsed.appearance.accent : 'indigo';
        var accentMap = {
            indigo: { main: '#6366f1', hover: '#4f46e5', rgb: '99,102,241',  grad: '#06b6d4' },
            blue:   { main: '#2563eb', hover: '#1d4ed8', rgb: '37,99,235',   grad: '#60a5fa' },
            green:  { main: '#10b981', hover: '#059669', rgb: '16,185,129',  grad: '#34d399' },
            purple: { main: '#7c3aed', hover: '#6d28d9', rgb: '124,58,237', grad: '#a78bfa' },
            pink:   { main: '#ec4899', hover: '#db2777', rgb: '236,72,153', grad: '#f472b6' },
            gray:   { main: '#64748b', hover: '#475569', rgb: '100,116,139', grad: '#94a3b8' }
        };
        var a = accentMap[accent] || accentMap.blue;
        root.style.setProperty('--accent', a.main);
        root.style.setProperty('--accent-hover', a.hover);
        root.style.setProperty('--accent-rgb', a.rgb);
        root.style.setProperty('--accent-grad', a.grad);
    }catch(e){ /* ignore */ }
})();
