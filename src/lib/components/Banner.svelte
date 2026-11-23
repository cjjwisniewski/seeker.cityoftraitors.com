<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let message = '';
	export let type = 'info'; // info, warning, error
	export let enabled = false;

	let dismissed = false;

	// Reset dismissal if the message changes
	$: if (message && browser) {
		let savedDismissed = null;
		try {
			savedDismissed = localStorage.getItem('banner_dismissed_message');
		} catch {
			/* ignore storage access errors */
		}
		if (savedDismissed !== message) {
			dismissed = false;
		} else {
			dismissed = true;
		}
	}

	function dismiss() {
		dismissed = true;
		if (browser) {
			try {
				localStorage.setItem('banner_dismissed_message', message);
			} catch {
				/* ignore storage access errors */
			}
		}
	}
</script>

{#if enabled && message && !dismissed}
	<div class="banner banner-{type}" role="alert">
		<div class="banner-content">
			<div class="banner-message">
				{#if type === 'warning'}
					<i class="fa-solid fa-triangle-exclamation"></i>
				{:else if type === 'error'}
					<i class="fa-solid fa-circle-exclamation"></i>
				{:else}
					<i class="fa-solid fa-circle-info"></i>
				{/if}
				<span>{message}</span>
			</div>
			<button class="dismiss-btn" on:click={dismiss} aria-label="Dismiss banner">
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	</div>
{/if}

<style>
	.banner {
		width: 100%;
		padding: 0.75rem 1rem;
		z-index: 1001;
		display: flex;
		justify-content: center;
		align-items: center;
		transition: all var(--transition-normal);
		box-shadow: var(--shadow-sm);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
	}

	.banner-content {
		width: 100%;
		max-width: 1540px;
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
		padding: 0 2rem;
	}

	.banner-message {
		font-weight: 600;
		font-size: 0.9rem;
		text-align: center;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		line-height: 1.4;
	}

	.banner-message i {
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.dismiss-btn {
		position: absolute;
		right: 0;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: currentColor;
		opacity: 0.7;
		transition: opacity var(--transition-fast);
	}

	.dismiss-btn:hover {
		opacity: 1;
	}

	/* Banner Types */
	.banner-info {
		background: var(--color-primary);
		color: white;
	}

	.banner-warning {
		background: var(--color-warning);
		color: white;
	}

	.banner-error {
		background: var(--color-error);
		color: white;
	}

	@media (max-width: 768px) {
		.banner-content {
			padding: 0 1.5rem;
		}
		.banner-message {
			font-size: 0.85rem;
		}
	}
</style>
