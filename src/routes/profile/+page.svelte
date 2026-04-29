<script>
	import { auth } from '$lib/stores/auth'; // Import the auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
	import {
		PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL,
		PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL
	} from '$env/static/public';
	import { browser } from '$app/environment'; // To ensure code runs client-side
	import { languageNames } from '$lib/utils/languageUtils'; // Import language support

	// Define Role IDs (ensure these match your Discord setup)
	const REQUIRED_ROLE_ID = '1352632428342280212'; // Seeker Role
	const ADMIN_ROLE_ID = '1352632325640294411'; // Admin Role

	// State variables
	let showConfirmDialog = false;
	let deleteError = null;
	let settingsError = null;
	let isUpdatingSetting = false;

	// Reactive declarations based on the auth store
	// These will run client-side due to ssr=false in layout
	$: user = $auth.user; // Directly access store value
	$: token = $auth.token; // Directly access store value
	$: isLoading = $auth.isLoading; // Directly access store value

	// Split the user ID into chunks for readability without adding real spaces (facilitates copying)
	$: userIdChunks = $auth.user?.id?.match(/.{1,4}/g) || [];

	// Derive status from user roles (assuming roles are fetched by auth store)
	// Use $auth.user directly here too for consistency
	// Note: 'guildMember' might be implicitly true if roles are present.
	// Adjust logic if your /api/userinfo provides explicit guild membership.
	$: guildMember = !!$auth.user?.roles; // Assumes roles array exists only if they are a member
	$: hasRole = $auth.user?.roles?.includes(REQUIRED_ROLE_ID) ?? false;
	$: isAdmin = $auth.user?.roles?.includes(ADMIN_ROLE_ID) ?? false;

	// Default settings derived from user payload
	$: stockAlertEnabled = $auth.user?.settings?.stockAlertEnabled ?? true;
	$: stockDigestEnabled = $auth.user?.settings?.stockDigestEnabled ?? true;
	$: priceDropAlertEnabled = $auth.user?.settings?.priceDropAlertEnabled ?? true;
	$: priceDropThreshold = $auth.user?.settings?.priceDropThreshold ?? 5;
	$: preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
	$: preferredFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';

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

		// Optimistic UI update
		if (settingName === 'stockAlertEnabled') stockAlertEnabled = newValue;
		if (settingName === 'stockDigestEnabled') stockDigestEnabled = newValue;
		if (settingName === 'priceDropAlertEnabled') priceDropAlertEnabled = newValue;
		if (settingName === 'priceDropThreshold') priceDropThreshold = newValue;
		if (settingName === 'preferredLanguage') preferredLanguage = newValue;
		if (settingName === 'preferredFinish') preferredFinish = newValue;

		try {
			console.log(`Updating setting ${settingName} to ${newValue}...`);
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
				settingsError = 'Error updating setting. Please try again.';
				return;
			}

			console.log(`Setting ${settingName} updated successfully.`);
		} catch (error) {
			console.error('Error in updateSetting:', error);
			// Revert on error
			if (settingName === 'stockAlertEnabled') stockAlertEnabled = oldValue;
			if (settingName === 'stockDigestEnabled') stockDigestEnabled = oldValue;
			if (settingName === 'priceDropAlertEnabled') priceDropAlertEnabled = oldValue;
			if (settingName === 'priceDropThreshold') priceDropThreshold = oldValue;
			if (settingName === 'preferredLanguage') preferredLanguage = oldValue;
			if (settingName === 'preferredFinish') preferredFinish = oldValue;
			settingsError = 'Error updating setting. Please try again.';
		} finally {
			isUpdatingSetting = false;
		}
	}

	// --- Delete Account Logic ---
	async function handleDeleteAccount() {
		deleteError = null; // Clear previous errors

		if (!token) {
			deleteError = 'Action failed: Authentication token is missing.';
			console.error('Delete attempt failed: token is null.');
			showConfirmDialog = false; // Close dialog
			return;
		}

		const userIdToDelete = user?.id;
		if (!userIdToDelete) {
			deleteError = 'Action failed: User ID is missing.';
			console.error('Delete attempt failed: user ID is null.');
			showConfirmDialog = false; // Close dialog
			return;
		}

		console.log(`Attempting to delete account for user ID: ${userIdToDelete}`);

		try {
			// Use fetchWithAuth - it adds the Authorization header automatically
			const response = await fetchWithAuth(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
				method: 'DELETE',
				headers: {
					// Add Content-Type if required by your Azure Function
					'Content-Type': 'application/json'
				},
				// Add body if required by your Azure Function
				body: JSON.stringify({}) // Sending empty JSON object as before
			});

			// fetchWithAuth returns undefined if it redirects (e.g., on 401)
			if (!response) {
				// Error/redirect is handled by fetchWithAuth (logged to console, triggers login)
				// We might want to set a local error state here too.
				deleteError = 'Authentication failed. Please log in again.';
				console.error('Delete account fetch failed or was redirected by fetchWithAuth.');
				showConfirmDialog = false;
				return; // Stop execution
			}

			if (!response.ok) {
				let errorText = await response.text();
				try {
					// Attempt to parse as JSON for structured errors
					const errorJson = JSON.parse(errorText);
					errorText = errorJson.message || errorJson.error || JSON.stringify(errorJson);
				} catch (e) {
					// Ignore parse error, use raw text
				}
				// This is where the error logged at line 96 is constructed
				throw new Error(`Failed to delete account (Status: ${response.status}): ${errorText}`); // Log line 84 reference points inside this throw path
			}

			console.log('Account deletion request successful.');
			// Call the auth store's logout method for proper cleanup and redirect
			await auth.logout();
		} catch (e) {
			// This catch block handles errors from fetchWithAuth or response processing
			deleteError = e.message;
			console.error('Error deleting account:', e);
		} finally {
			// Ensure dialog is closed even if logout redirect fails for some reason
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

<!-- Listen for keydown events when the modal is shown -->
<svelte:window on:keydown={showConfirmDialog ? handleKeydown : null} />

{#if isLoading}
	<div class="loading-container">
		<p>Loading profile...</p>
		<!-- Add a spinner or other loading indicator here -->
	</div>
{:else if !user}
	<div class="error-container">
		<p>Could not load user profile. You may need to log in again.</p>
		<button on:click={() => auth.login()}>Login</button>
	</div>
{:else}
	<div class="profile-container">
		<div class="profile-header">
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
			<div class="profile-title">
				<h1>{user.global_name || user.username || 'User'}</h1>
			</div>
		</div>

		<div class="profile-content">
			<section class="profile-section">
				<h2>Account Information</h2>
				<div class="info-grid">
					<!-- Profile Information -->
					<div class="info-item">
						<span class="label">Username</span>
						<span class="value">{user.username || 'N/A'}</span>
					</div>
					{#if user.global_name}
						<div class="info-item">
							<span class="label">Display Name</span>
							<span class="value">{user.global_name}</span>
						</div>
					{/if}
					<div class="info-item">
						<span class="label">User ID</span>
						<span class="value user-id">
							{#each userIdChunks as chunk}
								<span>{chunk}</span>
							{/each}
							{#if userIdChunks.length === 0}
								{$auth.user?.id || 'N/A'}
							{/if}
						</span>
					</div>

					<!-- Status Information -->
					<div class="info-item">
						<span class="label">Server Member</span>
						<span class="value status {guildMember ? 'active' : 'inactive'}">
							<i class="fa-solid {guildMember ? 'fa-check' : 'fa-xmark'}"></i>
							{guildMember ? 'Member' : 'Not Detected'}
						</span>
					</div>
					<div class="info-item">
						<span class="label">Seeker Role</span>
						<span class="value status {hasRole ? 'active' : 'inactive'}">
							<i class="fa-solid {hasRole ? 'fa-check' : 'fa-xmark'}"></i>
							{hasRole ? 'Has Role' : 'No Role'}
						</span>
					</div>
					<div class="info-item">
						<span class="label">Admin Status</span>
						<span class="value status {isAdmin ? 'active' : 'inactive'}">
							<i class="fa-solid {isAdmin ? 'fa-shield' : 'fa-user'}"></i>
							{isAdmin ? 'Admin' : 'Not Admin'}
						</span>
					</div>
					<div class="info-item">
						<span class="label">Membership Tier</span>
						<span class="value tier-badge tier-{(user.membershipTier || 'None').toLowerCase()}">
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
			</section>

			<section class="profile-section">
				<h2>User Settings</h2>
				<div class="settings-content">
					{#if settingsError}
						<div class="error-message mini" role="alert">{settingsError}</div>
					{/if}
					<div class="setting-item">
						<div class="setting-info">
							<span class="label">Stock Alerts</span>
							<span class="description"
								>Receive immediate Direct Messages when a card on your list is found in stock at a
								new low price.</span
							>
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
						<div class="setting-info">
							<span class="label">Stock Digest</span>
							<span class="description"
								>Receive a periodic summary of all cards on your list that currently have stock.</span
							>
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
						<div class="setting-info">
							<span class="label">Price Drop Alerts</span>
							<span class="description"
								>Receive notifications when a card on your list drops in price by at least your
								configured threshold.</span
							>
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
						<div class="setting-info">
							<span class="label">Price Drop Threshold %</span>
							<span class="description"
								>Only alert if the price drops by at least this percentage of the original price.</span
							>
						</div>
						<div class="threshold-input-wrapper">
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
						<div class="setting-info">
							<span class="label">Preferred Language</span>
							<span class="description"
								>Select the default language for card search results. Falls back to English if
								unavailable.</span
							>
						</div>
						<div class="language-select-wrapper">
							<select
								class="language-select"
								value={preferredLanguage}
								on:change={(e) => updateSetting('preferredLanguage', e.target.value)}
								disabled={isUpdatingSetting}
							>
								{#each Object.entries(languageNames) as [code, name]}
									<option value={code}>{name}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Finish Setting -->
					<div class="setting-item">
						<div class="setting-info">
							<span class="label">Preferred Finish</span>
							<span class="description"
								>Select your preferred card finish (foil vs nonfoil) to default to on card searches.
								Falls back to available finishes.</span
							>
						</div>
						<div class="language-select-wrapper">
							<select
								class="language-select"
								value={preferredFinish}
								on:change={(e) => updateSetting('preferredFinish', e.target.value)}
								disabled={isUpdatingSetting}
							>
								<option value="nonfoil">Nonfoil</option>
								<option value="foil">Foil</option>
							</select>
						</div>
					</div>
				</div>
			</section>

			<section class="profile-section danger-zone">
				<h2>Danger Zone</h2>
				<div class="danger-content">
					<div class="danger-item">
						<div class="danger-info">
							<span class="label">Delete Account</span>
							<span class="description"
								>Permanently remove your account and all associated data from this application.</span
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
							Delete Account
						</button>
					</div>
				</div>
			</section>
			{#if deleteError}
				<div class="error-message" role="alert">
					<strong>Error:</strong>
					{deleteError}
				</div>
			{/if}
		</div>
	</div>

	{#if showConfirmDialog}
		<!-- Added keydown handler to the overlay -->
		<!-- Make overlay focusable and handle keydown for accessibility -->
		<!-- Comments moved outside the tag definition -->
		<!-- Removed role, tabindex, aria-label, aria-modal from overlay -->
		<!-- Keyboard interaction (Escape) is handled by svelte:window -->
		<!-- Added role, tabindex, aria-label, and keydown handler to overlay for accessibility -->
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
			<!-- Added role="dialog", aria-modal, aria-labelledby to the modal content container -->
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
				<!-- Clicks inside modal won't close it -->
				<h3 id="dialog-title">Confirm Account Deletion</h3>
				<p>Are you sure you want to delete your account? This action cannot be undone.</p>
				<p>All your seeking list data within this application will be permanently deleted.</p>

				<div class="modal-buttons">
					<button class="cancel-btn" on:click={() => (showConfirmDialog = false)}> Cancel </button>
					<button class="confirm-btn" on:click={handleDeleteAccount}>
						Yes, Delete My Account
					</button>
				</div>
			</div>
		</div>
	{/if}
	<!-- Closing the modal #if block -->
{/if}

<!-- Closing the main #if isLoading / !user / else block -->

<style>
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		text-align: center;
		padding: 2rem;
	}
	.error-container button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
	}

	.profile-container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 0 1rem;
		animation: fadeIn 0.5s ease-out;
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
		flex-wrap: wrap;
	}

	.profile-avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		border: 3px solid var(--color-bg-elevated);
		box-shadow: var(--shadow-md);
		object-fit: cover;
	}
	.placeholder-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-bg-secondary);
		color: var(--color-text-secondary);
		font-size: 2rem;
		width: 80px;
		height: 80px;
	}

	.profile-title {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.profile-title h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.user-id {
		font-family: monospace;
		font-size: 0.9rem;
		font-weight: normal;
		display: flex;
		flex-wrap: wrap;
	}

	.user-id span:not(:last-child) {
		margin-right: 0.5rem;
	}

	.profile-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.profile-section {
		background: var(--color-bg-elevated);
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
	}

	.profile-section h2 {
		margin: 0 0 1.5rem 0;
		color: var(--color-text-primary);
		font-size: 1.25rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.5rem;
	}

	.info-grid {
		display: grid;
		gap: 1rem 1.5rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.label {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.value {
		color: var(--color-text-primary);
		font-weight: 500;
		word-break: break-word;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status .fa-solid {
		width: 1em;
		text-align: center;
	}

	.status.active {
		color: var(--color-success);
	}

	.status.inactive {
		color: var(--color-error);
	}

	@media (min-width: 640px) {
		.info-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.danger-zone {
		border: 1px solid var(--color-error);
		background: var(--color-bg-elevated);
	}

	.danger-zone h2 {
		color: var(--color-error);
		border-bottom-color: var(--color-error);
	}

	.danger-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.danger-item {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.danger-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-grow: 1;
	}

	.danger-info .label {
		color: var(--color-error);
		font-size: 1rem;
		text-transform: none;
	}

	.danger-info .description {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.delete-btn {
		background-color: var(--color-error);
		color: white;
		border: none;
		padding: 0.6rem 1.2rem;
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
		font-weight: 600;
		box-shadow: var(--shadow-sm);
	}

	.delete-btn:hover:not(:disabled) {
		background-color: #b91c1c;
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	.delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Settings Styles */
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.setting-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-grow: 1;
	}

	.setting-info .label {
		color: var(--color-text-primary);
		font-size: 1rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: normal;
	}

	.setting-info .description {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		line-height: 1.4;
	}

	/* Toggle Switch Styles */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 50px;
		height: 28px;
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
		background-color: var(--color-bg-secondary);
		transition: 0.3s;
		border: 1px solid var(--color-border);
	}

	.slider:before {
		position: absolute;
		content: '';
		height: 20px;
		width: 20px;
		left: 3px;
		bottom: 3px;
		background-color: #fff;
		transition: 0.3s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	input:checked + .slider {
		background-color: var(--color-success);
		border-color: var(--color-success);
	}

	input:disabled + .slider {
		opacity: 0.6;
		cursor: not-allowed;
	}

	input:focus + .slider {
		box-shadow: 0 0 1px var(--color-success);
	}

	input:checked + .slider:before {
		transform: translateX(22px);
	}

	.slider.round {
		border-radius: 34px;
	}

	.slider.round:before {
		border-radius: 50%;
	}

	.modal-overlay {
		position: fixed;
		z-index: 2000; /* Increased z-index to be above nav */
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.2s ease-out;
	}

	.modal {
		background: var(--color-bg-elevated);
		padding: 2rem;
		border-radius: 12px;
		box-shadow: var(--shadow-lg);
		max-width: 450px;
		width: 90%;
		border: 1px solid var(--color-border);
		animation: scaleIn 0.2s ease-out;
	}

	.modal h3 {
		margin: 0 0 1rem 0;
		color: var(--color-text-primary);
		font-size: 1.25rem;
		font-weight: 600;
	}
	.modal p {
		margin: 0.5rem 0;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.modal-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		justify-content: flex-end;
	}

	.cancel-btn {
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		padding: 0.5rem 1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
		font-weight: 500;
	}
	.cancel-btn:hover {
		background-color: var(--color-bg-hover);
		border-color: var(--color-border-hover);
	}

	.language-select-wrapper {
		display: flex;
		align-items: center;
	}

	.language-select {
		padding: 0.5rem 2rem 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background-color: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		appearance: none; /* Hide default dropdown arrow */
		/* Custom dropdown arrow via background image */
		background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23#a0aec0%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
		background-repeat: no-repeat, repeat;
		background-position:
			right 0.7em top 50%,
			0 0;
		background-size:
			0.65em auto,
			100%;
		transition: all var(--transition-fast);
	}

	.language-select:hover:not(:disabled) {
		border-color: var(--color-border-hover);
		background-color: var(--color-bg-hover);
	}

	.language-select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.language-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.threshold-input-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding-right: 0.75rem;
		transition: all var(--transition-fast);
	}

	.threshold-input-wrapper:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.threshold-input {
		width: 60px;
		padding: 0.5rem 0.5rem 0.5rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 1rem;
		font-weight: 600;
		text-align: right;
		outline: none;
	}

	/* Remove arrows/spinners from number input */
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
		font-weight: 600;
		user-select: none;
	}

	.threshold-input:disabled + .unit {
		opacity: 0.6;
	}

	.threshold-input-wrapper:has(input:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.confirm-btn {
		background: var(--color-error);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
		font-weight: 500;
		box-shadow: var(--shadow-sm);
	}
	.confirm-btn:hover {
		background-color: #b91c1c;
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	.error-message {
		color: var(--color-error);
		background-color: var(--color-bg-error-light, #fef2f2);
		margin-top: 1rem;
		padding: 1rem;
		border: 1px solid var(--color-error);
		border-radius: 8px;
		word-break: break-word;
	}

	.error-message.mini {
		padding: 0.5rem 1rem;
		margin-top: 0;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
	}
</style>
