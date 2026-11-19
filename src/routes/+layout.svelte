<script>
	import { onMount } from 'svelte'; // Import onMount
	import { goto, replaceState } from '$app/navigation'; // Import replaceState
	import Footer from '$lib/components/Footer.svelte';
	import { page } from '$app/stores'; // Import the page store
	import { auth } from '$lib/stores/auth'; // Import the auth store
	import { browser } from '$app/environment'; // Import browser check
	import ThemeToggle from '$lib/components/ThemeToggle.svelte'; // Import the theme toggle
	import Logo from '$lib/components/Logo.svelte'; // Import Logo component
	import Banner from '$lib/components/Banner.svelte'; // Import Banner component
	import DemoBanner from '$lib/components/demo/DemoBanner.svelte';
	import DemoAlertPreviewModal from '$lib/components/demo/DemoAlertPreviewModal.svelte';
	import { PUBLIC_GET_BANNER_FUNCTION_URL } from '$env/static/public';

	// Import global styles
	import '$lib/styles/theme.css';
	import '$lib/styles/global.css';
	import '$lib/styles/components.css';

	// Remove export let data; - Data now comes from the auth store

	let showDropdown = false;

	// Logout function now calls the auth store's logout method
	const logout = () => {
		showDropdown = false; // Close dropdown
		auth.logout();
	};

	const goToAccount = () => {
		showDropdown = false; // Close dropdown
		goto('/account');
	};

	let bannerData = { message: '', type: 'info', enabled: false };

	const fetchBanner = async () => {
		try {
			const res = await fetch(PUBLIC_GET_BANNER_FUNCTION_URL);
			if (res.ok) {
				bannerData = await res.json();
			}
		} catch (e) {
			console.error('Failed to fetch banner:', e);
		}
	};

	// Handle token from URL fragment after component mounts
	onMount(async () => {
		fetchBanner();
		if (browser) {
			// Remove the static loading spinner
			const loader = document.getElementById('app-loading');
			if (loader) {
				loader.style.opacity = '0';
				setTimeout(() => loader.remove(), 300);
			}

			// Skip layout fragment handling on /callback where callback/+page.svelte handles it
			if (window.location.pathname === '/callback') {
				return;
			}

			const hashParams = new URLSearchParams(window.location.hash.substring(1));
			const token = hashParams.get('token');
			const rawState = hashParams.get('state') || '/';
			const state = rawState.startsWith('/') && !rawState.startsWith('//') && !rawState.includes('\\') ? rawState : '/';

			if (token) {
				console.log('Layout onMount: Found token in URL fragment. Handling callback...');
				// Always strip the sensitive #token=... fragment immediately from the URL
				replaceState(window.location.pathname + window.location.search, history.state);

				const callbackResult = await auth.handleCallback(token);

				if (callbackResult.success) {
					console.log('Layout onMount: Callback successful, navigating to state:', state);
					// Use goto for client-side navigation after successful callback
					await goto(state, { replaceState: true, invalidateAll: true });
				} else {
					console.error(
						'Layout onMount: Callback token handling failed, redirecting to login with error.'
					);
					// Redirect to login page with error
					// Use the specific error from the callback result if available
					const errorCode = encodeURIComponent(callbackResult.error || 'callback_failed');
					await goto(`/login?error=${errorCode}`, { replaceState: true });
				}
			}
		}
	});
</script>

<svelte:window
	on:click={(e) => {
		if (showDropdown && !e.target?.closest?.('.user-dropdown')) {
			showDropdown = false;
		}
	}}
/>

<div class="layout">
	<Banner {...bannerData} />
	{#if $page.url.pathname !== '/login'}
		<nav>
			<div class="nav-content">
				<div class="nav-left">
					<a href="/" class="brand-link">
						<Logo size="1.75rem" className="nav-logo" />
						<h3>Seeker</h3>
					</a>
				</div>
				<div class="nav-right">
					<a
						href="/about"
						class="nav-link about-link"
						class:active={$page.url.pathname === '/about'}
						aria-current={$page.url.pathname === '/about' ? 'page' : undefined}
						title="About"
						aria-label="About"
					>
						<i class="fa-solid fa-circle-info" aria-hidden="true"></i>
						<span class="nav-label">About</span>
					</a>
					<a
						href="/seeking"
						class="nav-link seeking-link"
						class:active={$page.url.pathname === '/seeking'}
						aria-current={$page.url.pathname === '/seeking' ? 'page' : undefined}
						title="Seeking List"
						aria-label="Seeking List"
					>
						<i class="fa-solid fa-sd-card" aria-hidden="true"></i>
						<span class="nav-label">Seeking</span>
					</a>
					<a
						href="/"
						class="nav-link search-link"
						class:active={$page.url.pathname === '/'}
						aria-current={$page.url.pathname === '/' ? 'page' : undefined}
						title="Search Cards"
						aria-label="Search Cards"
					>
						<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
						<span class="nav-label">Search</span>
					</a>
					{#if $auth.isAuthenticated && $auth.user}
						<div class="user-dropdown">
							<button
								class="user-button"
								on:click={() => (showDropdown = !showDropdown)}
								aria-expanded={showDropdown}
								aria-haspopup="menu"
							>
								{#if $auth.user.avatar}
									<img
										src="https://cdn.discordapp.com/avatars/{$auth.user.id}/{$auth.user.avatar}.png"
										alt="{$auth.user.username}'s avatar"
										class="user-avatar"
									/>
								{:else}
									<!-- Placeholder or default avatar if none exists -->
									<div class="user-avatar default-avatar">
										{$auth.user.username.charAt(0).toUpperCase()}
									</div>
								{/if}
								<span class="username">{$auth.user.username}</span>
								<i class="fa-solid fa-chevron-down"></i>
							</button>
							{#if showDropdown}
								<div
									class="dropdown-menu"
									role="menu"
									tabindex="-1"
									on:mouseleave={() => (showDropdown = false)}
								>
									<button class="dropdown-item" role="menuitem" tabindex="0" on:click={goToAccount}>
										<i class="fa-solid fa-user"></i>
										Account
									</button>
									<!-- Check roles from the auth store user object -->
									{#if !$auth.isDemo && $auth.user?.roles?.includes('1352632325640294411')}
										<button
											class="dropdown-item"
											role="menuitem"
											tabindex="0"
											on:click={() => {
												showDropdown = false;
												goto('/admin');
											}}
										>
											<i class="fa-solid fa-shield"></i>
											Admin
										</button>
									{/if}
									<button on:click={logout} class="dropdown-item" role="menuitem" tabindex="0">
										<i class="fa-solid fa-right-from-bracket"></i>
										{$auth.isDemo ? 'Exit Demo' : 'Logout'}
									</button>
									<!-- Add Theme Toggle Here -->
									<div class="dropdown-divider"></div>
									<div class="theme-toggle-container">
										<ThemeToggle />
									</div>
								</div>
							{/if}
						</div>
					{:else if !$auth.isLoading}
						<!-- Offer both Demo Sandbox and Discord Login for public visitors -->
						<a href="/demo" data-sveltekit-preload-data="off" class="login-button demo-nav-btn">Try Demo</a>
						<a href="/login" class="login-button">Login</a>
					{/if}
				</div>
			</div>
		</nav>
		<DemoBanner />
	{/if}

	<main class={$page.url.pathname === '/login' ? 'no-padding-top' : ''}>
		{#if !$auth.isLoading}
			<slot />
		{:else}
			<!-- Optional: Show a loading indicator while auth is resolving -->
			<div class="loading-indicator">Loading...</div>
		{/if}
	</main>
	<DemoAlertPreviewModal />
	<Footer />
</div>

<style>
	/* Define nav height as variable (adjust value as needed) */

	nav {
		position: sticky;
		top: 0;
		left: 0;
		right: 0;
		height: var(--nav-height);
		padding: 0 1rem;
		background: var(--glass-bg);
		backdrop-filter: blur(var(--backdrop-blur));
		-webkit-backdrop-filter: blur(var(--backdrop-blur));
		z-index: 1000;
		border-bottom: 1px solid var(--glass-border);
		box-shadow: var(--shadow-sm);
		display: flex;
		align-items: center;
		transition:
			background var(--transition-normal),
			border-color var(--transition-normal);
	}

	.nav-content {
		width: 100%;
		max-width: 1540px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.brand-link {
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-primary); /* Ensure logo inherits this if currentcolor is used */
	}

	h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: -0.02em;
	}

	.nav-right {
		display: flex;
		gap: 0.55rem;
		align-items: center;
	}

	/* Links in nav-right */
	.nav-link {
		color: var(--color-text-secondary);
		text-decoration: none;
		padding: 0.42rem 0.78rem;
		border-radius: 9999px;
		border: 1px solid transparent;
		transition: all var(--transition-fast);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.nav-link:hover {
		color: var(--color-primary);
		background: var(--color-bg-hover);
		transform: translateY(-1px);
	}

	.nav-link.active {
		color: var(--color-primary);
		background: var(--color-primary-alpha);
		border-color: rgba(59, 130, 246, 0.35);
	}

	/* User Dropdown */
	.user-dropdown {
		position: relative;
		display: inline-block;
	}

	.user-button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.35rem 0.75rem 0.35rem 0.35rem;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		border-radius: 9999px; /* Pill shape */
		transition: all var(--transition-fast);
	}

	.user-button:hover,
	.user-button[aria-expanded='true'] {
		background: var(--color-bg-hover);
		border-color: var(--color-border);
	}

	.user-button i.fa-chevron-down {
		font-size: 0.7em;
		margin-left: 0.25rem;
		transition: transform var(--transition-normal);
		color: var(--color-text-muted);
	}
	.user-button[aria-expanded='true'] i.fa-chevron-down {
		transform: rotate(180deg);
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		box-shadow: 0 0 0 2px var(--color-bg-primary);
	}

	/* Style for default avatar placeholder */
	.default-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
		color: white;
		font-weight: bold;
		font-size: 1rem;
		box-shadow: 0 0 0 2px var(--color-bg-primary);
	}

	.username {
		color: var(--color-text-primary);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: var(--color-bg-elevated); /* Use solid elevated background instead of glass */
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow: var(--shadow-lg);
		min-width: 180px;
		padding: 0.5rem;
		z-index: 1001;
		transform-origin: top right;
		animation: scaleIn 0.2s ease-out forwards;
	}

	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Styling for the divider and container */
	.dropdown-divider {
		height: 1px;
		background-color: var(--color-border);
		margin: 0.5rem 0;
	}

	.theme-toggle-container {
		padding: 0 0.5rem;
		margin-top: 0.25rem;
		display: flex;
		justify-content: center;
	}

	/* Invisible area to prevent menu from closing when moving mouse to it */
	.dropdown-menu::before {
		content: '';
		position: absolute;
		top: -0.5rem;
		left: 0;
		right: 0;
		height: 0.5rem;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.6rem 1rem;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		text-align: left;
		text-decoration: none;
		font-size: 0.9rem;
		white-space: nowrap;
		border-radius: 8px;
		transition: all var(--transition-fast);
		font-weight: 500;
	}

	.dropdown-item i {
		width: 1.25em;
		text-align: center;
		color: var(--color-text-muted);
		transition: color var(--transition-fast);
	}

	.dropdown-item:hover {
		background: var(--color-primary-alpha);
		color: var(--color-primary);
	}

	.dropdown-item:hover i {
		color: var(--color-primary);
	}

	/* Optional: Style for Login button */
	.login-button {
		padding: 0.5rem 1.25rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
		color: white;
		border-radius: 9999px;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		transition: all var(--transition-fast);
		box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
	}
	.login-button:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
	}
	.demo-nav-btn {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		box-shadow: 0 2px 4px rgba(16, 185, 129, 0.25);
	}
	.demo-nav-btn:hover {
		box-shadow: 0 4px 8px rgba(16, 185, 129, 0.35);
	}

	/* Layout structure */
	.layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		background: var(--color-bg-primary);
		flex: 1;
		transition: background var(--transition-normal);
		animation: fadeIn 0.5s ease-out;
	}

	/* Class to remove padding when navbar is hidden */
	main.no-padding-top {
		padding-top: 0;
	}

	.loading-indicator {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		font-size: 1.2rem;
		color: var(--color-text-secondary);
	}

	@media (max-width: 768px) {
		.nav-right {
			gap: 0.45rem;
		}

		.username,
		.nav-label {
			display: none;
		}

		.nav-link {
			width: 34px;
			height: 34px;
			padding: 0.4rem;
			border-radius: 50%;
		}
	}
</style>
