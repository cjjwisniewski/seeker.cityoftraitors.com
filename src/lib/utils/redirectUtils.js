const DEFAULT_ORIGIN = 'https://seeker.cityoftraitors.com';

/**
 * Safely validates an OAuth redirect/state path so it can only navigate
 * within the current origin. Rejects protocol-relative URLs, backslashes,
 * and ASCII control characters (e.g. `/%09/evil.com` which WHATWG URL parsing
 * strips before resolving the host).
 *
 * @param {string | null | undefined} rawState
 * @param {string} [origin]
 * @returns {string}
 */
export function sanitizeInternalRedirect(
	rawState,
	origin = typeof window !== 'undefined' ? window.location.origin : DEFAULT_ORIGIN
) {
	if (typeof rawState !== 'string' || !rawState) {
		return '/';
	}
	// Reject ASCII control characters (including \t, \r, \n, NUL, DEL)
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001F\u007F]/.test(rawState)) {
		return '/';
	}
	if (!rawState.startsWith('/') || rawState.startsWith('//') || rawState.includes('\\')) {
		return '/';
	}
	try {
		const parsed = new URL(rawState, origin);
		if (parsed.origin !== origin) {
			return '/';
		}
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return '/';
	}
}
