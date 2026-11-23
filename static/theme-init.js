(function () {
	const themeKey = 'color-theme';
	let storedTheme = null;
	try {
		storedTheme = localStorage.getItem(themeKey);
	} catch {
		/* ignore storage access errors */
	}
	let themeToApply;

	if (storedTheme && ['light', 'dark'].includes(storedTheme)) {
		themeToApply = storedTheme;
	} else {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		themeToApply = prefersDark ? 'dark' : 'light';
	}

	document.documentElement.setAttribute('data-theme', themeToApply);
})();
