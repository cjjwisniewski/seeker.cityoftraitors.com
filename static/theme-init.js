(function () {
	const themeKey = 'color-theme';
	const storedTheme = localStorage.getItem(themeKey);
	let themeToApply;

	if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
		themeToApply = storedTheme;
	} else {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		themeToApply = prefersDark ? 'dark' : 'light';
	}

	document.documentElement.setAttribute('data-theme', themeToApply);
})();
