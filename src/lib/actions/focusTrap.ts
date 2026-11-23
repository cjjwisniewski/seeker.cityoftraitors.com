const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Svelte action that traps keyboard Tab navigation inside a modal container
 * and restores focus to the previously active element when the modal closes.
 */
export function focusTrap(node: HTMLElement) {
	const previouslyFocused =
		typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

	function getFocusable(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
			(el) => el.offsetParent !== null || el.getClientRects().length > 0
		);
	}

	// Move initial focus inside the modal if focus isn't already within it
	const rafId = requestAnimationFrame(() => {
		if (!node.contains(document.activeElement)) {
			const focusable = getFocusable();
			if (focusable.length > 0) {
				focusable[0].focus({ preventScroll: true });
			} else {
				if (!node.hasAttribute('tabindex')) {
					node.setAttribute('tabindex', '-1');
				}
				node.focus({ preventScroll: true });
			}
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		const focusable = getFocusable();
		if (focusable.length === 0) {
			event.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement as HTMLElement | null;

		if (event.shiftKey) {
			if (!active || active === first || !node.contains(active)) {
				event.preventDefault();
				last.focus();
			}
		} else {
			if (!active || active === last || !node.contains(active)) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			cancelAnimationFrame(rafId);
			node.removeEventListener('keydown', handleKeydown);
			if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
				try {
					previouslyFocused.focus({ preventScroll: true });
				} catch {
					/* ignore if opener was removed from DOM */
				}
			}
		}
	};
}
