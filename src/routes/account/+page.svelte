<script>
	import { auth } from '$lib/stores/auth'; // Import the auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
	import {
		PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL,
		PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL
	} from '$env/static/public';
	import { browser } from '$app/environment'; // To ensure code runs client-side
	import { languageNames } from '$lib/utils/languageUtils'; // Import language support

	// State variables
	let showConfirmDialog = false;
	let deleteError = null;
	let settingsError = null;
	let isUpdatingSetting = false;
	let copiedUserId = false;

	// Reactive declarations based on the auth store
	$: user = $auth.user;
	$: token = $auth.token;
	$: isLoading = $auth.isLoading;

	// Split the user ID into chunks for readability without adding real spaces (facilitates copying)
	$: userIdChunks = $auth.user?.id?.match(/.{1,4}/g) || [];

	// Default settings derived from user payload
	$: isPremiumOrLegacy = $auth.user?.membershipTier === 'Premium' || $auth.user?.membershipTier === 'Legacy';
	$: stockAlertEnabled = $auth.user?.settings?.stockAlertEnabled ?? true;
	$: stockDigestEnabled = $auth.user?.settings?.stockDigestEnabled ?? true;
	$: priceDropAlertEnabled = $auth.user?.settings?.priceDropAlertEnabled ?? true;
	$: priceDropThreshold = $auth.user?.settings?.priceDropThreshold ?? 5;
	$: preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
	$: preferredFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';
	$: marketplaceCardtraderEnabled = $auth.user?.settings?.marketplaceCardtraderEnabled ?? true;
	$: marketplaceTcgplayerEnabled = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceTcgplayerEnabled ?? true) : false;
	$: marketplaceEbayEnabled = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceEbayEnabled ?? true) : false;
	$: marketplaceManapoolEnabled = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceManapoolEnabled ?? true) : false;

	async function copyUserId() {
		if (!user?.id) return;
		try {
			await navigator.clipboard.writeText(user.id);
			copiedUserId = true;
			setTimeout(() => {
				copiedUserId = false;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy user ID:', e);
		}
	}

	// --- Update Setting Logic ---
	async function updateSetting(settingName, newValue) {
		if (!token) return;

		isUpdatingSetting = true;
		settingsError = null;

		// Store old value for rollback
		let oldValue;
		if (settingName === 'stockAlertEnabled') oldValue = stockAlertEnabled;
		if (settingName === 'stockDigestEnabled') oldValue = stockDigestEnabled;
		if (settingName === 'priceDropAlertEnabled') oldValue = priceDropAlertEnabled;
		if (settingName === 'priceDropThreshold') oldValue = priceDropThreshold;
		if (settingName === 'preferredLanguage') oldValue = preferredLanguage;
		if (settingName === 'preferredFinish') oldValue = preferredFinish;
		if (settingName === 'marketplaceCardtraderEnabled') oldValue = marketplaceCardtraderEnabled;
		if (settingName === 'marketplaceTcgplayerEnabled') oldValue = marketplaceTcgplayerEnabled;
		if (settingName === 'marketplaceEbayEnabled') oldValue = marketplaceEbayEnabled;
		if (settingName === 'marketplaceManapoolEnabled') oldValue = marketplaceManapoolEnabled;

		// Optimistic UI update
		if (settingName === 'stockAlertEnabled') stockAlertEnabled = newValue;
		if (settingName === 'stockDigestEnabled') stockDigestEnabled = newValue;
		if (settingName === 'priceDropAlertEnabled') priceDropAlertEnabled = newValue;
		if (settingName === 'priceDropThreshold') priceDropThreshold = newValue;
		if (settingName === 'preferredLanguage') preferredLanguage = newValue;
		if (settingName === 'preferredFinish') preferredFinish = newValue;
		if (settingName === 'marketplaceCardtraderEnabled') marketplaceCardtraderEnabled = newValue;
		if (settingName === 'marketplaceTcgplayerEnabled') marketplaceTcgplayerEnabled = newValue;
		if (settingName === 'marketplaceEbayEnabled') marketplaceEbayEnabled = newValue;
		if (settingName === 'marketplaceManapoolEnabled') marketplaceManapoolEnabled = newValue;

		try {
			const response = await fetchWithAuth(PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					settingName: settingName,
					settingValue: newValue
				})
			});

			if (!response || !response.ok) {
				const status = response?.status;
				const text = await response?.text().catch(() => '(unreadable)');
				console.error(`Failed to update setting. Status: ${status}, Body: ${text}`);

				// Revert optimistic UI update on failure
				if (settingName === 'stockAlertEnabled') stockAlertEnabled = oldValue;
				if (settingName === 'stockDigestEnabled') stockDigestEnabled = oldValue;
				if (settingName === 'priceDropAlertEnabled') priceDropAlertEnabled = oldValue;
				if (settingName === 'priceDropThreshold') priceDropThreshold = oldValue;
				if (settingName === 'preferredLanguage') preferredLanguage = oldValue;
				if (settingName === 'preferredFinish') preferredFinish = oldValue;
				if (settingName === 'marketplaceCardtraderEnabled') marketplaceCardtraderEnabled = oldValue;
				if (settingName === 'marketplaceTcgplayerEnabled') marketplaceTcgplayerEnabled = oldValue;
				if (settingName === 'marketplaceEbayEnabled') marketplaceEbayEnabled = oldValue;
				if (settingName === 'marketplaceManapoolEnabled') marketplaceManapoolEnabled = oldValue;
				settingsError = 'Error updating setting. Please try again.';
				return;
			}

			auth.updateSettings({ [settingName]: newValue });
		} catch (error) {
			console.error('Error in updateSetting:', error);
			// Revert on error
			if (settingName === 'stockAlertEnabled') stockAlertEnabled = oldValue;
			if (settingName === 'stockDigestEnabled') stockDigestEnabled = oldValue;
			if (settingName === 'priceDropAlertEnabled') priceDropAlertEnabled = oldValue;
			if (settingName === 'priceDropThreshold') priceDropThreshold = oldValue;
			if (settingName === 'preferredLanguage') preferredLanguage = oldValue;
			if (settingName === 'preferredFinish') preferredFinish = oldValue;
			if (settingName === 'marketplaceCardtraderEnabled') marketplaceCardtraderEnabled = oldValue;
			if (settingName === 'marketplaceTcgplayerEnabled') marketplaceTcgplayerEnabled = oldValue;
			if (settingName === 'marketplaceEbayEnabled') marketplaceEbayEnabled = oldValue;
			if (settingName === 'marketplaceManapoolEnabled') marketplaceManapoolEnabled = oldValue;
			settingsError = 'Error updating setting. Please try again.';
		} finally {
			isUpdatingSetting = false;
		}
	}

	// --- Delete Account Logic ---
	async function handleDeleteAccount() {
		deleteError = null;

		if (!token) {
			deleteError = 'Action failed: Authentication token is missing.';
			showConfirmDialog = false;
			return;
		}

		const userIdToDelete = user?.id;
		if (!userIdToDelete) {
			deleteError = 'Action failed: User ID is missing.';
			showConfirmDialog = false;
			return;
		}

		try {
			const response = await fetchWithAuth(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (!response) {
				deleteError = 'Authentication failed. Please log in again.';
				showConfirmDialog = false;
				return;
			}

			if (!response.ok) {
				let errorText = await response.text();
				try {
					const errorJson = JSON.parse(errorText);
					errorText = errorJson.message || errorJson.error || JSON.stringify(errorJson);
				} catch (e) {
					// Ignore parse error, use raw text
				}
				throw new Error(`Failed to delete account (Status: ${response.status}): ${errorText}`);
			}

			await auth.logout();
		} catch (e) {
			deleteError = e.message;
			console.error('Error deleting account:', e);
		} finally {
			showConfirmDialog = false;
		}
	}

	// --- Keyboard handler for modal ---
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			showConfirmDialog = false;
		}
	}
</script>

<svelte:window on:keydown={showConfirmDialog ? handleKeydown : null} />

<svelte:head>
	<title>Account - Seeker</title>
</svelte:head>

{#if isLoading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading account profile...</p>
	</div>
{:else if !user}
	<div class="error-container">
		<div class="error-icon-box">
			<i class="fa-solid fa-user-xmark"></i>
		</div>
		<p>Could not load user account. You may need to log in again.</p>
		<button class="primary-btn" on:click={() => auth.login()}>
			<i class="fa-solid fa-right-to-bracket"></i>
			<span>Login</span>
		</button>
	</div>
{:else}
	<div class="profile-container">
		<!-- Profile Header Card -->
		<div class="profile-header">
			<div class="profile-left">
				<div class="avatar-wrapper">
					{#if user.id && user.avatar}
						<img
							src="https://cdn.discordapp.com/avatars/{user.id}/{user.avatar}.png?size=128"
							alt="{user.username}'s avatar"
							class="profile-avatar"
							loading="lazy"
						/>
					{:else}
						<div class="profile-avatar placeholder-avatar">
							<i class="fa-solid fa-user"></i>
						</div>
					{/if}
					<div class="avatar-status-dot" title="Connected"></div>
				</div>
				<div class="profile-title">
					<div class="username-wrapper">
						<h1>{user.global_name || user.username || 'User'}</h1>
						<span class="tier-badge tier-{(user.membershipTier || 'None').toLowerCase()}">
							<i
								class="fa-solid {user.membershipTier === 'Premium' ||
								user.membershipTier === 'Legacy'
									? 'fa-crown'
									: 'fa-certificate'}"
							></i>
							{user.membershipTier || 'Basic'}
						</span>
					</div>
					{#if user.global_name && user.username}
						<span class="handle-text">@{user.username}</span>
					{/if}
				</div>
			</div>

			<div class="profile-right">
				<div class="discord-status-badge">
					<span class="discord-pulse-dot"></span>
					<i class="fa-brands fa-discord"></i>
					<span>Discord Connected</span>
				</div>
			</div>
		</div>

		<!-- Profile Sections Grid -->
		<div class="profile-content">
			<!-- Section 1: Account Information -->
			<section class="profile-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-id-card"></i>
					</div>
					<h2>Account Information</h2>
				</div>
				<div class="info-grid">
					<div class="info-card">
						<span class="info-label">Username</span>
						<span class="info-value">{user.username || 'N/A'}</span>
					</div>
					{#if user.global_name}
						<div class="info-card">
							<span class="info-label">Display Name</span>
							<span class="info-value">{user.global_name}</span>
						</div>
					{/if}
					<div class="info-card">
						<span class="info-label">Membership Tier</span>
						<div class="info-value">
							<span class="tier-badge tier-{(user.membershipTier || 'None').toLowerCase()}">
								<i
									class="fa-solid {user.membershipTier === 'Premium' ||
									user.membershipTier === 'Legacy'
										? 'fa-crown'
										: 'fa-certificate'}"
								></i>
								{user.membershipTier || 'Basic'}
							</span>
						</div>
					</div>
					<div class="info-card id-card">
						<div class="id-header">
							<span class="info-label">User ID</span>
							<button
								type="button"
								class="copy-id-btn"
								on:click={copyUserId}
								title="Copy Discord User ID"
							>
								<i class="fa-solid {copiedUserId ? 'fa-check' : 'fa-copy'}"></i>
								<span>{copiedUserId ? 'Copied' : 'Copy'}</span>
							</button>
						</div>
						<span class="info-value user-id">
							{#each userIdChunks as chunk}
								<span class="id-chunk">{chunk}</span>
							{/each}
							{#if userIdChunks.length === 0}
								{$auth.user?.id || 'N/A'}
							{/if}
						</span>
					</div>
				</div>
			</section>

			<!-- Section 2: User Settings -->
			<section class="profile-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-sliders"></i>
					</div>
					<h2>Notification &amp; Search Preferences</h2>
				</div>
				<div class="settings-content">
					{#if settingsError}
						<div class="error-message mini" role="alert">
							<i class="fa-solid fa-triangle-exclamation"></i>
							<span>{settingsError}</span>
						</div>
					{/if}

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="setting-icon-pill">
								<i class="fa-solid fa-bell"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">Stock Alerts</span>
								<span class="setting-desc"
									>Receive immediate Direct Messages when a card on your list is found in stock at a
									new low price.</span
								>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={stockAlertEnabled}
								on:change={() => updateSetting('stockAlertEnabled', !stockAlertEnabled)}
								disabled={isUpdatingSetting}
							/>
							<span class="slider round"></span>
						</label>
					</div>

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="setting-icon-pill">
								<i class="fa-solid fa-envelope-open-text"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">Stock Digest</span>
								<span class="setting-desc"
									>Receive a periodic summary of all cards on your list that currently have stock.</span
								>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={stockDigestEnabled}
								on:change={() => updateSetting('stockDigestEnabled', !stockDigestEnabled)}
								disabled={isUpdatingSetting}
							/>
							<span class="slider round"></span>
						</label>
					</div>

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="setting-icon-pill">
								<i class="fa-solid fa-arrow-trend-down"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">Price Drop Alerts</span>
								<span class="setting-desc"
									>Receive notifications when a card on your list drops in price by at least your
									configured threshold.</span
								>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={priceDropAlertEnabled}
								on:change={() => updateSetting('priceDropAlertEnabled', !priceDropAlertEnabled)}
								disabled={isUpdatingSetting}
							/>
							<span class="slider round"></span>
						</label>
					</div>

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="setting-icon-pill">
								<i class="fa-solid fa-percent"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">Price Drop Threshold %</span>
								<span class="setting-desc"
									>Only alert if the price drops by at least this percentage of the original price.</span
								>
							</div>
						</div>
						<div class="threshold-input-wrapper {(!priceDropAlertEnabled || isUpdatingSetting) ? 'disabled' : ''}">
							<input
								type="number"
								min="1"
								max="100"
								step="1"
								class="threshold-input"
								value={priceDropThreshold}
								on:change={(e) => updateSetting('priceDropThreshold', parseInt(e.target.value))}
								disabled={isUpdatingSetting || !priceDropAlertEnabled}
							/>
							<span class="unit">%</span>
						</div>
					</div>

					<!-- Localization Setting -->
					<div class="setting-item">
						<div class="setting-item-left">
							<div class="setting-icon-pill">
								<i class="fa-solid fa-language"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">Preferred Language</span>
								<span class="setting-desc"
									>Select the default language for card search results. Falls back to English if
									unavailable.</span
								>
							</div>
						</div>
						<div class="select-wrapper">
							<select
								class="custom-select"
								value={preferredLanguage}
								on:change={(e) => updateSetting('preferredLanguage', e.target.value)}
								disabled={isUpdatingSetting}
							>
								{#each Object.entries(languageNames) as [code, name]}
									<option value={code}>{name}</option>
								{/each}
							</select>
							<i class="fa-solid fa-chevron-down select-chevron"></i>
						</div>
					</div>

					<!-- Finish Setting -->
					<div class="setting-item">
						<div class="setting-item-left">
							<div class="setting-icon-pill">
								<i class="fa-solid fa-wand-magic-sparkles"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">Preferred Finish</span>
								<span class="setting-desc"
									>Select your preferred card finish (foil vs nonfoil) to default to on card searches.</span
								>
							</div>
						</div>
						<div class="select-wrapper">
							<select
								class="custom-select"
								value={preferredFinish}
								on:change={(e) => updateSetting('preferredFinish', e.target.value)}
								disabled={isUpdatingSetting}
							>
								<option value="nonfoil">Nonfoil</option>
								<option value="foil">Foil</option>
							</select>
							<i class="fa-solid fa-chevron-down select-chevron"></i>
						</div>
					</div>
				</div>
			</section>

			<!-- Section 3: Marketplace Settings -->
			<section class="profile-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-store"></i>
					</div>
					<h2>Marketplace Integrations</h2>
				</div>
				<div class="settings-content">
					<div class="setting-item">
						<div class="setting-item-left">
							<div class="vendor-avatar ct-badge">
								<i class="fa-solid fa-cube"></i>
							</div>
							<div class="setting-info">
								<span class="setting-title">CardTrader</span>
								<span class="setting-desc">Enable/disable stock checks and price tracking on CardTrader.</span>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={marketplaceCardtraderEnabled}
								on:change={() => updateSetting('marketplaceCardtraderEnabled', !marketplaceCardtraderEnabled)}
								disabled={isUpdatingSetting}
							/>
							<span class="slider round"></span>
						</label>
					</div>

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="vendor-avatar tcg-badge">
								<i class="fa-solid fa-store"></i>
							</div>
							<div class="setting-info">
								<div class="label-with-tier">
									<span class="setting-title">TCGPlayer</span>
									{#if !isPremiumOrLegacy}
										<span class="tier-pill-locked">
											<i class="fa-solid fa-lock"></i> Premium
										</span>
									{/if}
								</div>
								<span class="setting-desc">Enable/disable stock checks and price tracking on TCGPlayer.</span>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={marketplaceTcgplayerEnabled}
								on:change={() => updateSetting('marketplaceTcgplayerEnabled', !marketplaceTcgplayerEnabled)}
								disabled={isUpdatingSetting || !isPremiumOrLegacy}
							/>
							<span class="slider round"></span>
						</label>
					</div>

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="vendor-avatar ebay-badge">
								<i class="fa-brands fa-ebay"></i>
							</div>
							<div class="setting-info">
								<div class="label-with-tier">
									<span class="setting-title">eBay</span>
									{#if !isPremiumOrLegacy}
										<span class="tier-pill-locked">
											<i class="fa-solid fa-lock"></i> Premium
										</span>
									{/if}
								</div>
								<span class="setting-desc">Enable/disable stock checks and price tracking on eBay.</span>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={marketplaceEbayEnabled}
								on:change={() => updateSetting('marketplaceEbayEnabled', !marketplaceEbayEnabled)}
								disabled={isUpdatingSetting || !isPremiumOrLegacy}
							/>
							<span class="slider round"></span>
						</label>
					</div>

					<div class="setting-item">
						<div class="setting-item-left">
							<div class="vendor-avatar manapool-badge">
								<i class="fa-solid fa-droplet"></i>
							</div>
							<div class="setting-info">
								<div class="label-with-tier">
									<span class="setting-title">Mana Pool</span>
									{#if !isPremiumOrLegacy}
										<span class="tier-pill-locked">
											<i class="fa-solid fa-lock"></i> Premium
										</span>
									{/if}
								</div>
								<span class="setting-desc">Enable/disable stock checks and price tracking on Mana Pool.</span>
							</div>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={marketplaceManapoolEnabled}
								on:change={() => updateSetting('marketplaceManapoolEnabled', !marketplaceManapoolEnabled)}
								disabled={isUpdatingSetting || !isPremiumOrLegacy}
							/>
							<span class="slider round"></span>
						</label>
					</div>
				</div>
			</section>

			<!-- Section 4: Danger Zone -->
			<section class="profile-section danger-zone">
				<div class="section-title-row">
					<div class="section-title-icon danger">
						<i class="fa-solid fa-triangle-exclamation"></i>
					</div>
					<h2>Danger Zone</h2>
				</div>
				<div class="danger-content">
					<div class="danger-item">
						<div class="danger-info">
							<span class="danger-title">Delete Account</span>
							<span class="danger-desc"
								>Permanently remove your account and all associated seeking cards and preferences from Seeker.</span
							>
						</div>
						<button
							class="delete-btn"
							on:click={() => (showConfirmDialog = true)}
							disabled={!token || !user}
							title={!token || !user
								? 'Cannot delete account: Authentication missing.'
								: 'Delete your account'}
						>
							<i class="fa-solid fa-trash-can"></i>
							<span>Delete Account</span>
						</button>
					</div>
				</div>
			</section>

			{#if deleteError}
				<div class="error-message" role="alert">
					<i class="fa-solid fa-circle-exclamation"></i>
					<div>
						<strong>Error:</strong>
						{deleteError}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Delete Account Confirmation Modal -->
	{#if showConfirmDialog}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="modal-overlay"
			on:click={() => (showConfirmDialog = false)}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') showConfirmDialog = false;
			}}
			role="button"
			tabindex="0"
			aria-label="Close dialog"
		>
			<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
			<div
				class="modal"
				on:click|stopPropagation
				on:keydown|stopPropagation
				role="dialog"
				aria-modal="true"
				aria-labelledby="dialog-title"
				tabindex="-1"
			>
				<div class="modal-icon-badge danger">
					<i class="fa-solid fa-triangle-exclamation"></i>
				</div>
				<h3 id="dialog-title">Confirm Account Deletion</h3>
				<p>Are you sure you want to delete your account? This action cannot be undone.</p>
				<p class="modal-subtext">All your seeking list cards and settings within Seeker will be permanently deleted.</p>

				<div class="modal-buttons">
					<button class="cancel-btn" on:click={() => (showConfirmDialog = false)}>Cancel</button>
					<button class="confirm-btn" on:click={handleDeleteAccount}>
						<i class="fa-solid fa-trash-can"></i>
						<span>Yes, Delete Account</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 280px;
		text-align: center;
		padding: 2.5rem 1rem;
		gap: 1rem;
	}

	.loading-spinner {
		width: 44px;
		height: 44px;
		border: 3px solid var(--color-border);
		border-radius: 50%;
		border-top-color: var(--color-primary);
		animation: spin 1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-icon-box {
		width: 56px;
		height: 56px;
		border-radius: 14px;
		background: rgba(239, 68, 68, 0.12);
		color: var(--color-error);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
	}

	.primary-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		color: white;
		border: none;
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: 0 4px 12px var(--color-primary-alpha);
	}

	.primary-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px var(--color-primary-alpha);
	}

	.profile-container {
		max-width: 860px;
		margin: 2rem auto;
		padding: 0 1.25rem;
		animation: fadeIn 0.4s ease-out;
	}

	/* Profile Header Card */
	.profile-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 2rem;
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px solid var(--glass-border, var(--color-border));
		border-radius: 16px;
		padding: 1.5rem 1.75rem;
		box-shadow: var(--shadow-sm);
		flex-wrap: wrap;
	}

	.profile-left {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.profile-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.avatar-wrapper {
		position: relative;
		width: 76px;
		height: 76px;
		flex-shrink: 0;
	}

	.profile-avatar {
		width: 76px;
		height: 76px;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
		object-fit: cover;
		background-color: var(--color-bg-secondary);
		transition: transform var(--transition-fast);
	}

	.profile-avatar:hover {
		transform: scale(1.04);
	}

	.placeholder-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-bg-secondary);
		color: var(--color-text-secondary);
		font-size: 1.75rem;
	}

	.avatar-status-dot {
		position: absolute;
		bottom: 2px;
		right: 2px;
		width: 14px;
		height: 14px;
		background-color: #22c55e;
		border: 2.5px solid var(--color-bg-elevated);
		border-radius: 50%;
		box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
	}

	.profile-title {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.username-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.profile-title h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.handle-text {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.discord-status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.9rem;
		background: rgba(88, 101, 242, 0.1);
		border: 1px solid rgba(88, 101, 242, 0.25);
		color: #5865f2;
		border-radius: 10px;
		font-size: 0.825rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.discord-pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background-color: #5865f2;
		box-shadow: 0 0 8px rgba(88, 101, 242, 0.7);
		animation: pulseDiscord 2s infinite;
	}

	@keyframes pulseDiscord {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.85); }
	}

	/* Sections */
	.profile-content {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.profile-section {
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border-radius: 16px;
		padding: 1.6rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--glass-border, var(--color-border));
		transition: border-color var(--transition-fast);
	}

	.section-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.section-title-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.12));
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.section-title-icon.danger {
		background: rgba(239, 68, 68, 0.12);
		color: var(--color-error);
	}

	.profile-section h2 {
		margin: 0;
		color: var(--color-text-primary);
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	/* Info Grid */
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.85rem;
	}

	.info-card {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		transition: border-color var(--transition-fast);
	}

	.info-card:hover {
		border-color: var(--color-border-hover);
	}

	.info-card.id-card {
		grid-column: 1 / -1;
	}

	.id-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.info-label {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.info-value {
		color: var(--color-text-primary);
		font-weight: 600;
		font-size: 0.95rem;
		word-break: break-word;
	}

	.user-id {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.9rem;
		font-weight: 500;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.id-chunk {
		background: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		letter-spacing: 0.05em;
	}

	.copy-id-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.copy-id-btn:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
		background: var(--color-primary-alpha);
	}

	/* Settings List */
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.25rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		transition: border-color var(--transition-fast), background-color var(--transition-fast);
	}

	.setting-item:hover {
		border-color: var(--color-border-hover);
	}

	.setting-item-left {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex-grow: 1;
	}

	.setting-icon-pill {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--color-bg-hover, rgba(0, 0, 0, 0.04));
		border: 1px solid var(--color-border);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.setting-title {
		color: var(--color-text-primary);
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.setting-desc {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	/* Vendor Branding Badges */
	.vendor-avatar {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.ct-badge {
		background: rgba(59, 130, 246, 0.12);
		border: 1px solid rgba(59, 130, 246, 0.25);
		color: #3b82f6;
	}

	.tcg-badge {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.25);
		color: #10b981;
	}

	.ebay-badge {
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.25);
		color: #f59e0b;
		font-size: 1.25rem;
	}

	.manapool-badge {
		background: rgba(139, 92, 246, 0.12);
		border: 1px solid rgba(139, 92, 246, 0.25);
		color: #8b5cf6;
	}

	.label-with-tier {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tier-pill-locked {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.3);
		color: #d97706;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	/* Toggle Switch Styles */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 48px;
		height: 26px;
		flex-shrink: 0;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--color-bg-hover, #e2e8f0);
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid var(--color-border);
	}

	.slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: #ffffff;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	input:checked + .slider {
		background-color: var(--color-success);
		border-color: var(--color-success);
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.25);
	}

	input:checked + .slider:before {
		transform: translateX(22px);
	}

	input:disabled + .slider {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.slider.round {
		border-radius: 999px;
	}

	.slider.round:before {
		border-radius: 50%;
	}

	/* Inputs & Selects */
	.threshold-input-wrapper {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background-color: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 0 0.75rem 0 0.5rem;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.threshold-input-wrapper:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.threshold-input-wrapper.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.threshold-input {
		width: 54px;
		padding: 0.45rem 0.25rem 0.45rem 0.5rem;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.95rem;
		font-weight: 600;
		text-align: right;
		outline: none;
	}

	.threshold-input::-webkit-outer-spin-button,
	.threshold-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.threshold-input[type='number'] {
		-moz-appearance: textfield;
	}

	.unit {
		color: var(--color-text-secondary);
		font-weight: 700;
		font-size: 0.85rem;
		user-select: none;
	}

	.select-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}

	.custom-select {
		padding: 0.5rem 2.25rem 0.5rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background-color: var(--color-bg-elevated);
		color: var(--color-text-primary);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		appearance: none;
		transition: all var(--transition-fast);
	}

	.custom-select:hover:not(:disabled) {
		border-color: var(--color-border-hover);
	}

	.custom-select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.custom-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.select-chevron {
		position: absolute;
		right: 0.75rem;
		pointer-events: none;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	/* Danger Zone */
	.danger-zone {
		border: 1px solid rgba(239, 68, 68, 0.35);
		background: rgba(239, 68, 68, 0.03);
	}

	.danger-zone .section-title-row {
		border-bottom-color: rgba(239, 68, 68, 0.2);
	}

	.danger-zone h2 {
		color: var(--color-error);
	}

	.danger-item {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1.25rem;
		padding: 0.5rem 0;
	}

	.danger-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-grow: 1;
	}

	.danger-title {
		color: var(--color-error);
		font-size: 1rem;
		font-weight: 600;
	}

	.danger-desc {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background-color: var(--color-error);
		color: white;
		border: none;
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
		font-weight: 600;
		font-size: 0.9rem;
		box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
	}

	.delete-btn:hover:not(:disabled) {
		background-color: #b91c1c;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
	}

	.delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Modals */
	.modal-overlay {
		position: fixed;
		z-index: 2000;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease-out;
	}

	.modal {
		background: var(--color-bg-elevated);
		padding: 2rem;
		border-radius: 16px;
		box-shadow: var(--shadow-lg), 0 20px 30px rgba(0, 0, 0, 0.25);
		max-width: 480px;
		width: 100%;
		border: 1px solid var(--color-border);
		animation: scaleIn 0.2s ease-out;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.modal-icon-badge {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		margin-bottom: 1.25rem;
	}

	.modal-icon-badge.danger {
		background: rgba(239, 68, 68, 0.12);
		color: var(--color-error);
		border: 1px solid rgba(239, 68, 68, 0.25);
	}

	.modal h3 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text-primary);
		font-size: 1.25rem;
		font-weight: 700;
	}

	.modal p {
		margin: 0.25rem 0;
		color: var(--color-text-secondary);
		line-height: 1.5;
		font-size: 0.95rem;
	}

	.modal-subtext {
		font-size: 0.85rem !important;
		color: var(--color-text-muted) !important;
		margin-top: 0.5rem !important;
	}

	.modal-buttons {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.75rem;
		width: 100%;
		justify-content: flex-end;
	}

	.cancel-btn {
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		cursor: pointer;
		transition: all var(--transition-fast);
		font-weight: 600;
		font-size: 0.9rem;
		flex: 1;
	}

	.cancel-btn:hover {
		background-color: var(--color-bg-hover);
		border-color: var(--color-border-hover);
	}

	.confirm-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: var(--color-error);
		color: white;
		border: none;
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		cursor: pointer;
		transition: all var(--transition-fast);
		font-weight: 600;
		font-size: 0.9rem;
		flex: 1;
		box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
	}

	.confirm-btn:hover {
		background-color: #b91c1c;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-error);
		background-color: rgba(239, 68, 68, 0.1);
		margin-top: 1rem;
		padding: 0.9rem 1.2rem;
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 12px;
		font-size: 0.9rem;
	}

	.error-message.mini {
		padding: 0.6rem 0.9rem;
		margin-top: 0;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
	}

	@media (max-width: 640px) {
		.profile-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.setting-item {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.setting-item > label.toggle-switch,
		.setting-item > .threshold-input-wrapper,
		.setting-item > .select-wrapper {
			align-self: flex-end;
		}

		.modal-buttons {
			flex-direction: column;
		}
	}
</style>
