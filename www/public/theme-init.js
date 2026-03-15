(function(){
    try{
        var raw = localStorage.getItem('mt_settings_v1');
        var parsed = raw ? JSON.parse(raw) : null;
        var theme = parsed && parsed.appearance && parsed.appearance.theme ? parsed.appearance.theme : 'light';
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
