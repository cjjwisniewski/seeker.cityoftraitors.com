<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth'; // Import the auth store
	import Logo from '$lib/components/Logo.svelte'; // Import Logo component

	// Remove redirectTo logic - it's handled by auth store now
	let errorMessage = '';

	onMount(() => {
		// Error handling (keep this part)
		const error = $page.url.searchParams.get('error');
		const message = $page.url.searchParams.get('message') || '';
		// Removed duplicate declarations below

		if (error) {
			console.log('Login error detected:', { error, message });
			switch (error) {
				case 'server_required':
					errorMessage = 'Login failed: You must be a member of the required Discord server.';
					break;
				case 'role_required':
					errorMessage =
						'Login failed: You do not have the required "Seeker" role in the Discord server.';
					break;
				case 'callback_failed':
					// This might now include role failures if fetchUserInfo returned 403
					errorMessage =
						message ||
						'Authentication failed after callback. This might be due to missing roles or an issue fetching user details. Please ensure you have the "Seeker" role in Discord.';
					break;
				case 'discord_api_error':
					errorMessage = message || 'Communication error with Discord. Please try again later.';
					break;
				case 'config_error':
					errorMessage = message || 'Server configuration error prevents login.';
					break;
				case 'no_code':
					errorMessage = message || 'Authorization code missing from Discord callback.';
					break;
				case 'invalid_state':
					errorMessage = message || 'Your login session expired or was invalid. Please try again.';
					break;
				default:
					errorMessage = message || 'An unknown authentication error occurred.';
			}
		}
	});
</script>

<div class="login-container">
	<div class="login-box">
		<div class="login-logo">
			<Logo size="4rem" />
		</div>
		<h2>Welcome to Seeker</h2>
		<p class="subtitle">Track down your missing pieces.</p>

		{#if errorMessage}
			<div class="error">
				{errorMessage}
			</div>
		{/if}

		<button on:click={() => auth.login()} class="login-button">
			<i class="fa-brands fa-discord"></i>
			Login with Discord
		</button>

		<div class="demo-divider"><span>or explore without signing in</span></div>

		<button
			type="button"
			class="demo-button"
			on:click={() => {
				auth.enterDemoMode(true);
				goto('/seeking');
			}}
		>
			<i class="fa-solid fa-flask"></i>
			Try Interactive Demo (No Login Required)
		</button>
		<p class="demo-hint">
			Browse 12 curated cards across 8 marketplaces, test live Scryfall search/import, and preview Discord alerts in your browser.
		</p>
	</div>
</div>

<style>
	.login-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 4rem); /* Adjust for footer height */
		padding: 2rem;
		background: linear-gradient(
			to bottom,
			var(--color-bg-secondary) 0%,
			var(--color-bg-primary) 100%
		);
		animation: fadeIn 0.5s ease-out;
	}

	.login-box {
		background-color: var(--color-bg-elevated);
		padding: 2rem;
		border-radius: 12px;
		box-shadow: var(--shadow-lg);
		text-align: center;
		max-width: 400px;
		width: 100%;
		margin-bottom: 2rem; /* Add space above footer */
		border: 1px solid var(--color-border);
	}

	.login-logo {
		margin-bottom: 1.5rem;
		color: var(--color-primary);
		display: flex;
		justify-content: center;
	}

	.login-box h2 {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 700;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline-block;
	}

	.subtitle {
		color: var(--color-text-secondary);
		margin: 0.5rem 0 1.5rem 0;
	}

	.login-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.875rem 2rem;
		background-color: #5865f2; /* Discord Blurple */
		color: white;
		text-decoration: none;
		border-radius: 8px;
		font-weight: 600;
		transition: all var(--transition-fast);
		width: 100%;
		max-width: 250px;
		border: none;
		cursor: pointer;
		box-shadow: var(--shadow-sm);
	}

	.login-button:hover {
		background-color: #4752c4;
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	.login-button i {
		font-size: 1.25rem;
	}

	.error {
		background-color: var(--color-bg-error-light, #fee2e2);
		border: 1px solid var(--color-error, #ef4444);
		color: var(--color-error, #991b1b);
		padding: 1rem;
		border-radius: 8px;
		margin: 1rem 0;
		text-align: center;
	}

	.demo-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0 1rem;
		color: var(--color-text-secondary);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.demo-divider::before,
	.demo-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.demo-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		padding: 0.8rem 1.4rem;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(59, 130, 246, 0.16) 100%);
		color: var(--color-text-primary);
		border: 1px solid rgba(16, 185, 129, 0.5);
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.92rem;
		width: 100%;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.demo-button:hover {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.demo-hint {
		margin: 0.65rem 0 0;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		line-height: 1.4;
	}
</style>
