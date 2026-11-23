import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const THEME_KEY = 'color-theme';

// Helper function to apply the theme attribute
const applyTheme = (theme) => {
	if (!browser) return; // Guard against server-side execution

	const root = document.documentElement;
	if (theme === 'system') {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
	} else {
		root.setAttribute('data-theme', theme);
	}
};

// Get the initial theme value
const getInitialTheme = () => {
	if (!browser) return 'system'; // Default to system on server
	try {
		const storedTheme = localStorage.getItem(THEME_KEY);
		if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
			return storedTheme;
		}
	} catch {
		/* ignore storage access errors */
	}
	return 'system'; // Default to system if nothing stored or invalid
};

const initialTheme = getInitialTheme();

// Create the writable store
const theme = writable(initialTheme);

// Update localStorage and apply theme attribute when the store changes
if (browser) {
	theme.subscribe((value) => {
		try {
			localStorage.setItem(THEME_KEY, value);
		} catch {
			/* ignore storage access errors */
		}
		applyTheme(value);
	});

	// Listen for system theme changes if the current setting is 'system'
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (getInitialTheme() === 'system') {
			// Re-check in case user changed away from system
			applyTheme('system'); // Re-apply based on the new system preference
		}
	});

	// Apply initial theme on load
	applyTheme(initialTheme);
}

export default theme;
