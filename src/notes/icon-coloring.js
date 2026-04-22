// Apply current theme based on user settings
browser.storage.local.get('theme').then(({ theme = 'light' }) => {
    document.body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'dark') {
        document.body.classList.add('theme-dark');
    } else if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.add(isDark ? 'theme-dark' : 'theme-light');
    } else {
        document.body.classList.add('theme-light');
    }
});
