<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth'; // Import auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import global fetch helper
	import { goto } from '$app/navigation'; // For redirecting unauthorized users
	import {
		PUBLIC_GET_USER_TABLES_FUNCTION_URL,
		PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
		PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL,
		PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL,
		PUBLIC_GET_BANNER_FUNCTION_URL,
		PUBLIC_UPDATE_BANNER_FUNCTION_URL,
		PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL
	} from '$env/static/public';
	import * as publicEnv from '$env/static/public';

	// Define Role ID
	const ADMIN_ROLE_ID = '1352632325640294411';

	// State variables
	let userTables = [];
	let userSearchQuery = '';
	let tierFilter = 'all'; // 'all', 'basic', 'premium', 'legacy', 'none'
	let sortBy = 'lastAccessed'; // 'username', 'userId', 'itemCount', 'tier', 'lastAccessed'
	let sortDirection = 'desc'; // 'asc', 'desc'
	let expandedTable = null;
	let expandedTableData = [];
	let loading = true; // Loading state for user tables list
	let tableDataLoading = false; // Separate loading state for expanded table data
	let statusLoading = true; // Loading state for system status
	let error = null; // General error display
	let statusError = null; // Error display for system status
	let systemStatus = null;

	// Tier counts for filter pills
	$: tierCounts = {
		all: userTables.length,
		basic: userTables.filter((t) => (t.membershipTier || 'Basic').toLowerCase() === 'basic').length,
		premium: userTables.filter((t) => (t.membershipTier || '').toLowerCase() === 'premium').length,
		legacy: userTables.filter((t) => (t.membershipTier || '').toLowerCase() === 'legacy').length,
		banned: userTables.filter((t) => (t.membershipTier || '').toLowerCase() === 'banned').length
	};

	function toggleSort(field) {
		if (sortBy === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortDirection = field === 'username' || field === 'userId' ? 'asc' : 'desc';
		}
	}

	// Reactive variables from auth store
	$: user = $auth.user;
	$: token = $auth.token;
	$: authLoading = $auth.isLoading;
	$: isAuthenticated = $auth.isAuthenticated;

	// Authorization check
	$: isAdmin = user?.roles?.includes(ADMIN_ROLE_ID) ?? false;
	$: isAuthorized = isAuthenticated && isAdmin;
	$: showUnauthorized = !authLoading && (!isAuthenticated || !isAdmin);

	// Redirect if unauthorized after loading finishes
	$: if (showUnauthorized) {
		console.warn('Admin Page: User is not authorized.');
	}

	// Helper function to format date
	function formatLocalDate(utcTimestamp) {
		if (!utcTimestamp) return 'Never';
		const date = new Date(utcTimestamp);
		return date.toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function isMarketplaceEnabled(tableObj, mk) {
		if (!tableObj || !tableObj.marketplaces) {
			return mk === 'cardtrader';
		}
		return Boolean(tableObj.marketplaces[mk]);
	}

	// Filtered & sorted users for admin management
	$: filteredUserTables = userTables
		.filter((table) => {
			if (tierFilter !== 'all') {
				const tier = (table.membershipTier || 'basic').toLowerCase();
				if (tierFilter === 'none') {
					if (tier !== 'none' && tier !== '') return false;
				} else if (tier !== tierFilter) {
					return false;
				}
			}
			if (!userSearchQuery.trim()) return true;
			const q = userSearchQuery.toLowerCase();
			return (
				(table.username && table.username.toLowerCase().includes(q)) ||
				(table.globalName && table.globalName.toLowerCase().includes(q)) ||
				(table.userId && table.userId.toLowerCase().includes(q)) ||
				(table.membershipTier && table.membershipTier.toLowerCase().includes(q))
			);
		})
		.sort((a, b) => {
			let cmp = 0;
			if (sortBy === 'username') {
				const nameA = a.globalName || a.username || '';
				const nameB = b.globalName || b.username || '';
				cmp = nameA.localeCompare(nameB);
			} else if (sortBy === 'userId') {
				cmp = (a.userId || '').localeCompare(b.userId || '');
			} else if (sortBy === 'itemCount') {
				cmp = (a.itemCount || 0) - (b.itemCount || 0);
			} else if (sortBy === 'tier') {
				const rank = { legacy: 3, premium: 2, basic: 1, none: 0, banned: -1 };
				const rankA = rank[(a.membershipTier || '').toLowerCase()] ?? 0;
				const rankB = rank[(b.membershipTier || '').toLowerCase()] ?? 0;
				cmp = rankA - rankB;
			} else if (sortBy === 'lastAccessed') {
				const timeA = a.lastAccessed ? new Date(a.lastAccessed).getTime() : 0;
				const timeB = b.lastAccessed ? new Date(b.lastAccessed).getTime() : 0;
				cmp = timeA - timeB;
			}
			return sortDirection === 'asc' ? cmp : -cmp;
		});

	// --- API Call Functions ---

	async function loadUserTables() {
		if (!isAuthorized) return;
		loading = true;
		error = null;
		try {
			const response = await fetchWithAuth(PUBLIC_GET_USER_TABLES_FUNCTION_URL);

			if (!response) {
				error = 'Authentication failed while fetching user tables.';
				console.error(error);
				return;
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to load user tables (Status: ${response.status}): ${errorText}`);
			}
			userTables = await response.json();
		} catch (e) {
			error = e.message;
			console.error('Error loading user tables:', e);
		} finally {
			loading = false;
		}
	}

	async function loadTableData(targetUserId) {
		if (!isAuthorized) return;
		tableDataLoading = true;
		error = null;
		expandedTableData = [];
		try {
			const urlWithQuery = `${PUBLIC_GET_SEEKING_LIST_FUNCTION_URL}?targetUserId=${encodeURIComponent(targetUserId)}`;
			const response = await fetchWithAuth(urlWithQuery);

			if (!response) {
				error = `Authentication failed while fetching data for user ${targetUserId}.`;
				console.error(error);
				return;
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Failed to load seeking list for ${targetUserId} (Status: ${response.status}): ${errorText}`
				);
			}
			const responseData = await response.json();
			expandedTableData = responseData.cards || [];
		} catch (e) {
			console.error(`Error loading table data for ${targetUserId}:`, e);
			error = e.message;
			expandedTableData = [];
		} finally {
			tableDataLoading = false;
		}
	}

	// Delete confirmation modal state
	let showDeleteModal = false;
	let userToDelete = null;
	let isDeletingUser = false;

	// Requeue stock checks state
	let requeuingUser = null; // userId currently being requeued
	let requeueFeedback = null; // { userId, text, type }

	async function handleRequeueChecks(targetUserId, username) {
		if (requeuingUser || !isAuthorized) return;
		requeuingUser = targetUserId;
		requeueFeedback = null;
		try {
			const requeueUrl = publicEnv.PUBLIC_REQUEUE_USER_STOCK_CHECKS_FUNCTION_URL || 'https://seeker.azure-api.net/seeker/requeueUserStockChecks';
			const response = await fetchWithAuth(requeueUrl, {
				method: 'POST',
				body: JSON.stringify({ targetUserId })
			});

			if (!response || !response.ok) {
				const errText = response ? await response.text() : 'Network error';
				throw new Error(errText || 'Failed to requeue stock checks');
			}

			const data = await response.json();
			requeueFeedback = {
				userId: targetUserId,
				text: `Queued ${data.cards_queued ?? 0} cards (${data.total_messages ?? 0} checks) across ${data.marketplaces?.join(', ') || 'all marketplaces'}.`,
				type: 'success'
			};
		} catch (err) {
			requeueFeedback = {
				userId: targetUserId,
				text: err.message || 'Error requeuing checks.',
				type: 'error'
			};
		} finally {
			requeuingUser = null;
			setTimeout(() => {
				if (requeueFeedback && requeueFeedback.userId === targetUserId) {
					requeueFeedback = null;
				}
			}, 6000);
		}
	}

	function promptDeleteAccount(targetUserId) {
		userToDelete = targetUserId;
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		if (isDeletingUser) return;
		showDeleteModal = false;
		userToDelete = null;
	}

	// Tier override modal state & functions
	let showTierModal = false;
	let userToEditTier = null;
	let selectedTier = 'Basic';
	let isUpdatingTier = false;

	function openTierModal(table) {
		userToEditTier = table;
		selectedTier = table.membershipTier || 'Basic';
		showTierModal = true;
	}

	function closeTierModal() {
		if (isUpdatingTier) return;
		showTierModal = false;
		userToEditTier = null;
	}

	async function handleSaveTier() {
		if (!userToEditTier || !isAuthorized) return;
		isUpdatingTier = true;
		error = null;
		try {
			const response = await fetchWithAuth(PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL, {
				method: 'POST',
				body: JSON.stringify({
					targetUserId: userToEditTier.userId,
					settingName: 'membershipTier',
					settingValue: selectedTier
				})
			});
			if (!response || !response.ok) {
				const errText = response ? await response.text() : 'Network error';
				throw new Error(`Failed to update tier: ${errText}`);
			}
			userTables = userTables.map((u) => {
				if (u.userId === userToEditTier.userId) {
					return {
						...u,
						membershipTier: selectedTier,
						tierOverride: selectedTier !== 'None'
					};
				}
				return u;
			});
			closeTierModal();
		} catch (e) {
			console.error('Error updating user tier:', e);
			error = e.message;
		} finally {
			isUpdatingTier = false;
		}
	}

	// Poison queue inspect and manage state & functions
	let showPoisonModal = false;
	let activePoisonQueue = null;
	let poisonMessages = [];
	let poisonLoading = false;
	let poisonActionLoading = false;
	let poisonFeedback = null;

	async function openPoisonInspectModal(q) {
		activePoisonQueue = q;
		showPoisonModal = true;
		poisonLoading = true;
		poisonFeedback = null;
		poisonMessages = [];
		try {
			const url = `${PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL}?action=peek_poison&queue=${encodeURIComponent(q.name)}`;
			const response = await fetchWithAuth(url);
			if (response && response.ok) {
				const data = await response.json();
				poisonMessages = data.messages || [];
			} else {
				const errText = response ? await response.text() : 'Failed to fetch poison queue messages';
				poisonFeedback = { type: 'error', text: errText };
			}
		} catch (e) {
			console.error('Error fetching poison queue:', e);
			poisonFeedback = { type: 'error', text: e.message };
		} finally {
			poisonLoading = false;
		}
	}

	function closePoisonModal() {
		if (poisonActionLoading) return;
		showPoisonModal = false;
		activePoisonQueue = null;
		poisonMessages = [];
		poisonFeedback = null;
	}

	async function handleReplayPoison(queueName) {
		poisonActionLoading = true;
		poisonFeedback = null;
		try {
			const url = `${PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL}?action=replay_poison&queue=${encodeURIComponent(queueName)}`;
			const response = await fetchWithAuth(url);
			if (response && response.ok) {
				const data = await response.json();
				poisonFeedback = { type: 'success', text: data.message || 'Messages replayed successfully.' };
				await loadSystemStatus();
				if (showPoisonModal && activePoisonQueue) {
					const refreshQ = activePoisonQueue;
					await openPoisonInspectModal(refreshQ);
				}
			} else {
				const errText = response ? await response.text() : 'Failed to replay poison messages';
				poisonFeedback = { type: 'error', text: errText };
			}
		} catch (e) {
			console.error('Error replaying poison queue:', e);
			poisonFeedback = { type: 'error', text: e.message };
		} finally {
			poisonActionLoading = false;
		}
	}

	async function handleClearPoison(queueName) {
		if (!confirm(`Are you sure you want to permanently clear all poison messages for ${queueName}?`)) {
			return;
		}
		poisonActionLoading = true;
		poisonFeedback = null;
		try {
			const url = `${PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL}?action=clear_poison&queue=${encodeURIComponent(queueName)}`;
			const response = await fetchWithAuth(url);
			if (response && response.ok) {
				const data = await response.json();
				poisonFeedback = { type: 'success', text: data.message || 'Poison queue cleared.' };
				await loadSystemStatus();
				if (showPoisonModal && activePoisonQueue) {
					const refreshQ = activePoisonQueue;
					await openPoisonInspectModal(refreshQ);
				}
			} else {
				const errText = response ? await response.text() : 'Failed to clear poison queue';
				poisonFeedback = { type: 'error', text: errText };
			}
		} catch (e) {
			console.error('Error clearing poison queue:', e);
			poisonFeedback = { type: 'error', text: e.message };
		} finally {
			poisonActionLoading = false;
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			if (showDeleteModal) closeDeleteModal();
			if (showTierModal) closeTierModal();
			if (showPoisonModal) closePoisonModal();
		}
	}

	async function handleDeleteAccount() {
		if (!userToDelete || !isAuthorized) return;
		const targetUserId = userToDelete;
		isDeletingUser = true;
		error = null;
		try {
			const requestBody = { targetUserIdToDelete: targetUserId };
			const response = await fetchWithAuth(PUBLIC_DELETE_USER_ACCOUNT_FUNCTION_URL, {
				method: 'DELETE',
				body: JSON.stringify(requestBody)
			});

			if (!response) {
				error = `Authentication failed while attempting to delete user ${targetUserId}.`;
				console.error(error);
				return;
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Failed to delete account ${targetUserId} (Status: ${response.status}): ${errorText}`
				);
			}

			await loadUserTables();
			if (expandedTable === targetUserId) {
				expandedTable = null;
				expandedTableData = [];
			}
		} catch (e) {
			error = e.message;
			console.error(`Error deleting account ${targetUserId}:`, e);
		} finally {
			isDeletingUser = false;
			showDeleteModal = false;
			userToDelete = null;
		}
	}

	async function loadSystemStatus() {
		if (!isAuthorized) return;
		statusLoading = true;
		statusError = null;
		try {
			const response = await fetchWithAuth(PUBLIC_GET_SYSTEM_STATUS_FUNCTION_URL);

			if (!response) {
				statusError = 'Authentication failed while fetching system status.';
				console.error(statusError);
				return;
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to load system status (Status: ${response.status}): ${errorText}`);
			}
			systemStatus = await response.json();
		} catch (e) {
			statusError = e.message;
			console.error('Error loading system status:', e);
		} finally {
			statusLoading = false;
		}
	}

	// Banner state
	let bannerMessage = '';
	let bannerType = 'info';
	let bannerEnabled = false;
	let bannerSendDm = false;
	let bannerLoading = false;
	let bannerSaving = false;
	let bannerStatusMessage = null;
	let bannerStatusType = 'success';

	async function loadBanner() {
		if (!isAuthorized) return;
		bannerLoading = true;
		try {
			const response = await fetch(PUBLIC_GET_BANNER_FUNCTION_URL);
			if (response.ok) {
				const data = await response.json();
				bannerMessage = data.message;
				bannerType = data.type;
				bannerEnabled = data.enabled;
			}
		} catch (e) {
			console.error('Error loading banner:', e);
		} finally {
			bannerLoading = false;
		}
	}

	async function saveBanner() {
		if (!isAuthorized) return;
		bannerSaving = true;
		bannerStatusMessage = null;
		try {
			const response = await fetchWithAuth(PUBLIC_UPDATE_BANNER_FUNCTION_URL, {
				method: 'POST',
				body: JSON.stringify({
					message: bannerMessage,
					type: bannerType,
					enabled: bannerEnabled,
					send_dm: bannerSendDm
				})
			});
			if (response && response.ok) {
				const resData = await response.json().catch(() => ({}));
				bannerStatusType = 'success';
				let msg = 'Banner settings updated successfully.';
				if (resData.dm_stats && resData.dm_stats.attempted) {
					if (resData.dm_stats.error) {
						msg += ` (DM broadcast failed: ${resData.dm_stats.error})`;
					} else {
						msg += ` (Broadcast DM sent to ${resData.dm_stats.sent} users, ${resData.dm_stats.failed} failed)`;
					}
					bannerSendDm = false; // Reset toggle after broadcast
				}
				bannerStatusMessage = msg;
			} else {
				throw new Error('Failed to update banner');
			}
		} catch (e) {
			bannerStatusType = 'error';
			bannerStatusMessage = 'Error updating banner: ' + e.message;
		} finally {
			bannerSaving = false;
		}
	}

	// Statistics Logic
	$: totalUsers = userTables.length;
	$: totalItems = userTables.reduce((sum, table) => sum + (table.itemCount || 0), 0);

	$: estimatedCTTimeSeconds = totalItems * 2;
	$: estimatedTCGTimeSeconds = totalItems * 2;
	$: estimatedEbayTimeSeconds = totalItems * 1;
	$: estimatedManapoolTimeSeconds = totalItems * 1;
	$: estimatedHimarketTimeSeconds = totalItems * 1;
	$: estimatedHareruyaTimeSeconds = totalItems * 2;
	$: estimatedRutenTimeSeconds = totalItems * 2;

	function formatCents(cents) {
		if (cents === null || cents === undefined || cents <= 0) return '—';
		return `$${(cents / 100).toFixed(2)}`;
	}

	function formatDollars(dollars) {
		if (dollars === null || dollars === undefined || Number(dollars) <= 0) return '—';
		return `$${Number(dollars).toFixed(2)}`;
	}

	function formatDuration(seconds) {
		if (!seconds) return '0s';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);

		const parts = [];
		if (h > 0) parts.push(`${h}h`);
		if (m > 0) parts.push(`${m}m`);
		if (s > 0 || parts.length === 0) parts.push(`${s}s`);

		return parts.join(' ');
	}

	// Lifecycle
	$: if (!authLoading && isAuthorized) {
		loadUserTables();
		loadSystemStatus();
		loadBanner();
	} else if (!authLoading && !isAuthorized) {
		loading = false;
		statusLoading = false;
	}
</script>

<svelte:head>
	<title>Admin Console - Seeker</title>
</svelte:head>

<svelte:window on:keydown={showDeleteModal ? handleKeydown : null} />

{#if authLoading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Checking admin authorization...</p>
	</div>
{:else if showUnauthorized}
	<div class="unauthorized-container">
		<div class="unauthorized-icon-badge">
			<i class="fa-solid fa-lock"></i>
		</div>
		<h2>Restricted Access</h2>
		<p>You do not have administrative privileges to view this console.</p>
		<a href="/" class="return-home-btn">
			<i class="fa-solid fa-arrow-left"></i>
			<span>Return to Home</span>
		</a>
	</div>
{:else}
	<div class="admin-container">
		<!-- Workspace Toolbar -->
		<div class="workspace-toolbar">
			<div class="toolbar-left">
				<div class="admin-badge">
					<i class="fa-solid fa-shield-halved"></i>
					<span>Admin Console</span>
				</div>
				{#if user}
					<span class="user-pill" title="Logged in as {user.username}">
						<i class="fa-solid fa-user-gear"></i>
						<span>{user.username}</span>
					</span>
				{/if}
			</div>

			<div class="toolbar-right">
				{#if systemStatus}
					<div class="status-indicator-pill" title="System Status: {systemStatus.state || 'Active'}">
						<span class="pulse-dot"></span>
						<span>System Healthy</span>
					</div>
				{/if}
				<div class="card-counter" title="Total registered users">
					<i class="fa-solid fa-users"></i>
					<span><strong>{totalUsers}</strong> users</span>
				</div>
				<button
					class="toolbar-icon-btn"
					on:click={() => {
						loadUserTables();
						loadSystemStatus();
						loadBanner();
					}}
					title="Refresh All Admin Data"
				>
					<i class="fa-solid fa-rotate {loading || statusLoading || bannerLoading ? 'fa-spin' : ''}"></i>
				</button>
			</div>
		</div>

		<div class="admin-content">
			<!-- Section 1: Overview Statistics -->
			<section class="admin-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-chart-pie"></i>
					</div>
					<h2>Overview Statistics</h2>
				</div>

				{#if loading}
					<div class="section-loading">
						<div class="loading-spinner small"></div>
						<span>Calculating stats...</span>
					</div>
				{:else}
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">Total Users</span>
								<div class="stat-icon-badge users">
									<i class="fa-solid fa-users"></i>
								</div>
							</div>
							<div class="stat-value">{totalUsers}</div>
							<div class="stat-sub">Registered accounts</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">Total Items</span>
								<div class="stat-icon-badge items">
									<i class="fa-solid fa-layer-group"></i>
								</div>
							</div>
							<div class="stat-value">{totalItems}</div>
							<div class="stat-sub">Across all wishlists</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">CardTrader Time</span>
								<div class="stat-icon-badge ct">
									<i class="fa-solid fa-cube"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedCTTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 2s / card</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">TCGPlayer Time</span>
								<div class="stat-icon-badge tcg">
									<i class="fa-solid fa-store"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedTCGTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 2s / card</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">Mana Pool Time</span>
								<div class="stat-icon-badge manapool">
									<i class="fa-solid fa-droplet"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedManapoolTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 1s / card</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">eBay Time</span>
								<div class="stat-icon-badge ebay">
									<i class="fa-brands fa-ebay"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedEbayTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 1s / card</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">HiMarket Time</span>
								<div class="stat-icon-badge himarket">
									<i class="fa-solid fa-earth-asia"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedHimarketTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 1s / card</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">Hareruya Time</span>
								<div class="stat-icon-badge hareruya">
									<i class="fa-solid fa-sun"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedHareruyaTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 2s / card</div>
						</div>

						<div class="stat-card">
							<div class="stat-card-header">
								<span class="stat-title">Ruten Time</span>
								<div class="stat-icon-badge ruten">
									<i class="fa-solid fa-shop"></i>
								</div>
							</div>
							<div class="stat-value">{formatDuration(estimatedRutenTimeSeconds)}</div>
							<div class="stat-sub">Est. @ 2s / card (ZHT/EN)</div>
						</div>
					</div>
				{/if}
			</section>

			<!-- Section 2: Notification Banner -->
			<section class="admin-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-bullhorn"></i>
					</div>
					<h2>Notification Banner</h2>
				</div>

				{#if bannerLoading}
					<div class="section-loading">
						<div class="loading-spinner small"></div>
						<span>Loading banner settings...</span>
					</div>
				{:else}
					<div class="banner-manager">
						<div class="form-group">
							<label for="banner-message">Banner Message</label>
							<input
								id="banner-message"
								type="text"
								bind:value={bannerMessage}
								placeholder="e.g. Scheduled maintenance in 15 minutes..."
								class="styled-input"
							/>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label for="banner-type">Banner Alert Style</label>
								<div class="select-wrapper">
									<select id="banner-type" bind:value={bannerType} class="styled-select">
										<option value="info">Info (Blue)</option>
										<option value="warning">Warning (Amber)</option>
										<option value="error">Error (Red)</option>
									</select>
									<i class="fa-solid fa-chevron-down select-chevron"></i>
								</div>
							</div>

							<div class="form-group toggle-group">
								<label class="toggle-control-label" for="banner-toggle-switch">Display Active</label>
								<div class="toggle-wrapper">
									<label class="toggle-switch" id="banner-toggle-switch">
										<input type="checkbox" bind:checked={bannerEnabled} />
										<span class="slider round"></span>
									</label>
									<span class="toggle-status-text {bannerEnabled ? 'active' : ''}">
										{bannerEnabled ? 'Visible' : 'Hidden'}
									</span>
								</div>
							</div>

							<div class="form-group toggle-group">
								<label class="toggle-control-label" for="banner-dm-switch">Broadcast Discord DM</label>
								<div class="toggle-wrapper">
									<label class="toggle-switch" id="banner-dm-switch">
										<input type="checkbox" bind:checked={bannerSendDm} />
										<span class="slider round"></span>
									</label>
									<span class="toggle-status-text {bannerSendDm ? 'active' : ''}">
										{bannerSendDm ? 'Send to All Users' : 'Off'}
									</span>
								</div>
							</div>
						</div>

						<div class="banner-actions">
							<button class="save-btn" on:click={saveBanner} disabled={bannerSaving}>
								<i class="fa-solid {bannerSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>
								<span>{bannerSaving ? 'Saving...' : 'Save Banner'}</span>
							</button>

							{#if bannerStatusMessage}
								<div class="banner-feedback {bannerStatusType}" role="status">
									<i class="fa-solid {bannerStatusType === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
									<span>{bannerStatusMessage}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</section>

			<!-- Section 3: System Status -->
			<section class="admin-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-heart-pulse"></i>
					</div>
					<h2>System Status &amp; Microservices</h2>
					<button
						class="header-refresh-btn"
						on:click={loadSystemStatus}
						disabled={statusLoading}
						title="Refresh system status"
					>
						<i class="fa-solid fa-arrows-rotate {statusLoading ? 'fa-spin' : ''}"></i>
					</button>
				</div>

				{#if statusLoading}
					<div class="section-loading">
						<div class="loading-spinner small"></div>
						<span>Querying system status...</span>
					</div>
				{:else if statusError}
					<div class="error-banner">
						<i class="fa-solid fa-triangle-exclamation"></i>
						<span>{statusError}</span>
					</div>
				{:else if systemStatus}
					<div class="status-summary-row">
						<div class="status-chip">
							<span class="chip-label">State</span>
							<span class="status-badge {systemStatus.state?.toLowerCase() || 'unknown'}">
								<span class="dot"></span>
								{systemStatus.state || 'N/A'}
							</span>
						</div>
						<div class="status-chip">
							<span class="chip-label">Availability</span>
							<span class="status-badge {systemStatus.availability?.toLowerCase() || 'unknown'}">
								<span class="dot"></span>
								{systemStatus.availability || 'N/A'}
							</span>
						</div>
						<div class="status-chip">
							<span class="chip-label">Last Checked</span>
							<span class="chip-value">
								<i class="fa-regular fa-clock"></i>
								{formatLocalDate(systemStatus.last_checked)}
							</span>
						</div>
					</div>

					{#if systemStatus.functions && systemStatus.functions.length > 0}
						<div class="subsection">
							<h3 class="subsection-title">Azure Functions</h3>
							<div class="function-grid">
								{#each systemStatus.functions as func}
									{#if func.name !== 'callback'}
										<div class="function-card">
											<div class="func-header">
												<span class="func-name">{func.name}</span>
												<span class="status-badge {func.status}">
													<span class="dot"></span>
													{func.status}
												</span>
											</div>
											<div class="func-details">
												{#if func.response_time}
													<span class="metric-pill">
														<i class="fa-solid fa-stopwatch"></i>
														{func.response_time}
													</span>
												{/if}
												{#if func.status_code}
													<span class="metric-pill">
														<i class="fa-solid fa-signal"></i>
														{func.status_code}
													</span>
												{/if}
												{#if func.error}
													<span class="error-pill">
														<i class="fa-solid fa-triangle-exclamation"></i>
														{func.error}
													</span>
												{/if}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					{#if systemStatus.queues && systemStatus.queues.length > 0}
						<div class="subsection">
							<h3 class="subsection-title">Queue Health &amp; Backlog</h3>
							<div class="function-grid">
								{#each systemStatus.queues as q}
									<div class="function-card">
										<div class="func-header">
											<span class="func-name">{q.label || q.name}</span>
											<span class="status-badge {q.poison_messages > 0 ? 'degraded' : 'running'}">
												<span class="dot"></span>
												{q.poison_messages > 0 ? `${q.poison_messages} poison` : 'healthy'}
											</span>
										</div>
										<div class="func-details">
											<span class="metric-pill">
												<i class="fa-solid fa-layer-group"></i>
												Queued: {q.active_messages}
											</span>
											{#if q.poison_messages > 0}
												<span class="error-pill">
													<i class="fa-solid fa-skull-crossbones"></i>
													Poison: {q.poison_messages}
												</span>
											{/if}
										</div>
										<div class="queue-actions-row">
											<button
												type="button"
												class="queue-action-btn inspect-btn"
												on:click={() => openPoisonInspectModal(q)}
												title="Inspect messages in poison queue"
											>
												<i class="fa-solid fa-eye"></i>
												<span>Inspect</span>
											</button>
											{#if q.poison_messages > 0}
												<button
													type="button"
													class="queue-action-btn replay-btn"
													on:click={() => handleReplayPoison(q.name)}
													disabled={poisonActionLoading}
													title="Replay all poison messages back to active queue"
												>
													<i class="fa-solid fa-rotate-left"></i>
													<span>Replay All</span>
												</button>
												<button
													type="button"
													class="queue-action-btn clear-btn"
													on:click={() => handleClearPoison(q.name)}
													disabled={poisonActionLoading}
													title="Permanently purge poison messages"
												>
													<i class="fa-solid fa-trash-can"></i>
													<span>Purge</span>
												</button>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</section>

			<!-- Section 4: User Management -->
			<section class="admin-section">
				<div class="section-title-row">
					<div class="section-title-icon">
						<i class="fa-solid fa-users-gear"></i>
					</div>
					<h2>User Management</h2>
					<span class="user-count-badge">
						{filteredUserTables.length} of {userTables.length} {userTables.length === 1 ? 'user' : 'users'}
					</span>
				</div>

				<!-- User Filter & Sort Toolbar -->
				<div class="user-toolbar-card">
					<div class="toolbar-top-row">
						<div class="search-input-wrapper">
							<i class="fa-solid fa-magnifying-glass search-icon"></i>
							<input
								type="text"
								bind:value={userSearchQuery}
								placeholder="Filter by username, user ID, or tier..."
								class="user-search-input"
							/>
							{#if userSearchQuery}
								<button class="clear-search-btn" on:click={() => (userSearchQuery = '')} title="Clear search">
									<i class="fa-solid fa-xmark"></i>
								</button>
							{/if}
						</div>

						<!-- Sort Controls -->
						<div class="sort-controls-wrapper">
							<span class="sort-label"><i class="fa-solid fa-arrow-down-short-wide"></i> Sort:</span>
							<button
								type="button"
								class="sort-pill"
								class:active={sortBy === 'username'}
								on:click={() => toggleSort('username')}
								title="Sort by Username"
							>
								<span>User</span>
								{#if sortBy === 'username'}
									<i class="fa-solid fa-arrow-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
								{/if}
							</button>
							<button
								type="button"
								class="sort-pill"
								class:active={sortBy === 'itemCount'}
								on:click={() => toggleSort('itemCount')}
								title="Sort by Card Count"
							>
								<span>Cards</span>
								{#if sortBy === 'itemCount'}
									<i class="fa-solid fa-arrow-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
								{/if}
							</button>
							<button
								type="button"
								class="sort-pill"
								class:active={sortBy === 'tier'}
								on:click={() => toggleSort('tier')}
								title="Sort by Tier"
							>
								<span>Tier</span>
								{#if sortBy === 'tier'}
									<i class="fa-solid fa-arrow-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
								{/if}
							</button>
							<button
								type="button"
								class="sort-pill"
								class:active={sortBy === 'lastAccessed'}
								on:click={() => toggleSort('lastAccessed')}
								title="Sort by Last Activity"
							>
								<span>Activity</span>
								{#if sortBy === 'lastAccessed'}
									<i class="fa-solid fa-arrow-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
								{/if}
							</button>
						</div>
					</div>

					<!-- Tier Filter Pills -->
					<div class="tier-pills-row">
						<span class="filter-pills-label"><i class="fa-solid fa-filter"></i> Tier:</span>
						<button
							type="button"
							class="tier-filter-pill"
							class:active={tierFilter === 'all'}
							on:click={() => (tierFilter = 'all')}
						>
							All ({tierCounts.all})
						</button>
						<button
							type="button"
							class="tier-filter-pill tier-basic"
							class:active={tierFilter === 'basic'}
							on:click={() => (tierFilter = 'basic')}
						>
							Basic ({tierCounts.basic})
						</button>
						<button
							type="button"
							class="tier-filter-pill tier-premium"
							class:active={tierFilter === 'premium'}
							on:click={() => (tierFilter = 'premium')}
						>
							Premium ({tierCounts.premium})
						</button>
						<button
							type="button"
							class="tier-filter-pill tier-legacy"
							class:active={tierFilter === 'legacy'}
							on:click={() => (tierFilter = 'legacy')}
						>
							Legacy ({tierCounts.legacy})
						</button>
						<button
							type="button"
							class="tier-filter-pill tier-banned"
							class:active={tierFilter === 'banned'}
							on:click={() => (tierFilter = 'banned')}
						>
							Banned ({tierCounts.banned})
						</button>
					</div>
				</div>

				{#if loading}
					<div class="section-loading">
						<div class="loading-spinner small"></div>
						<span>Loading registered user directories...</span>
					</div>
				{:else if error}
					<div class="error-banner">
						<i class="fa-solid fa-triangle-exclamation"></i>
						<span>{error}</span>
					</div>
				{:else if filteredUserTables.length === 0}
					<div class="empty-state">
						<i class="fa-solid fa-user-slash"></i>
						<p>No user accounts found matching "{userSearchQuery}".</p>
					</div>
				{:else}
					<div class="user-accordion-list">
						{#each filteredUserTables as table}
							<div class="user-card {expandedTable === table.userId ? 'is-expanded' : ''}">
								<div class="user-card-header">
									<div class="user-main-info">
										<div class="user-avatar-badge">
											{#if table.avatarUrl}
												<img
													src={table.avatarUrl}
													alt={table.username}
													class="user-avatar-img"
													loading="lazy"
													on:error={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											{/if}
											<i class="fa-solid fa-user" class:hidden={!!table.avatarUrl}></i>
										</div>
										<div class="user-titles">
											<div class="user-name-line">
												<span class="user-name">{table.globalName || table.username}</span>
												{#if table.globalName && table.username && table.globalName !== table.username}
													<span class="user-handle">@{table.username}</span>
												{/if}
												<span class="tier-badge tier-{(table.membershipTier || 'Basic').toLowerCase()}">
													<i
														class="fa-solid {table.membershipTier === 'Premium' ||
														table.membershipTier === 'Legacy'
															? 'fa-crown'
															: table.membershipTier === 'Banned'
																? 'fa-ban'
																: 'fa-certificate'}"
													></i>
													{table.membershipTier || 'Basic'}
												</span>
												{#if table.tierOverride}
													<span class="override-pill" title="Tier manually overridden by administrator">
														<i class="fa-solid fa-user-pen"></i> Override
													</span>
												{/if}
												<button
													type="button"
													class="edit-tier-pill-btn"
													on:click|stopPropagation={() => openTierModal(table)}
													title="Change or override membership tier"
												>
													<i class="fa-solid fa-pen-to-square"></i>
													<span>Edit Tier</span>
												</button>
											</div>
											<div class="user-meta-column">
												<div class="user-meta-line">
													<span class="user-id-chip" title="User ID: {table.userId}">
														<i class="fa-solid fa-id-badge"></i>
														{table.userId}
													</span>
													<div class="user-marketplaces-row">
														{#if isMarketplaceEnabled(table, 'cardtrader')}
															<span class="mk-icon-badge ct" title="CardTrader: Enabled">
																<i class="fa-solid fa-cube"></i> CT
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'tcgplayer')}
															<span class="mk-icon-badge tcg" title="TCGPlayer: Enabled">
																<i class="fa-solid fa-store"></i> TCG
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'manapool')}
															<span class="mk-icon-badge manapool" title="Mana Pool: Enabled">
																<i class="fa-solid fa-droplet"></i> MP
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'ebay')}
															<span class="mk-icon-badge ebay" title="eBay: Enabled">
																<i class="fa-brands fa-ebay"></i> EB
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'himarket')}
															<span class="mk-icon-badge himarket" title="HiMarket: Enabled">
																<i class="fa-solid fa-earth-asia"></i> HM
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'hareruya')}
															<span class="mk-icon-badge hareruya" title="Hareruya: Enabled">
																<i class="fa-solid fa-sun"></i> HR
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'ruten')}
															<span class="mk-icon-badge ruten" title="Ruten: Enabled">
																<i class="fa-solid fa-shop"></i> RT
															</span>
														{/if}
														{#if isMarketplaceEnabled(table, 'cardmarket')}
															<span class="mk-icon-badge cardmarket" title="CardMarket: Enabled">
																<i class="fa-solid fa-euro-sign"></i> CM
															</span>
														{/if}
														{#if table.minCondition && table.minCondition !== 'ANY'}
															<span class="user-cond-badge" title="Account Default Minimum Condition: {table.minCondition}+">
																<i class="fa-solid fa-shield-halved"></i> {table.minCondition === 'NM' ? 'NM' : `${table.minCondition}+`}
															</span>
														{:else if table.minCondition === 'ANY'}
															<span class="user-cond-badge any" title="Account Default Minimum Condition: Any Condition">
																<i class="fa-solid fa-shield-halved"></i> ANY
															</span>
														{/if}
													</div>
												</div>
												<div class="user-meta-subline">
													<span class="user-activity-timestamp">
														<i class="fa-regular fa-clock"></i>
														Last Login: {formatLocalDate(table.lastAccessed)}
													</span>
												</div>
											</div>
										</div>
									</div>

									<div class="user-actions">
										<span class="item-count-chip">
											<i class="fa-solid fa-layer-group"></i>
											{table.itemCount} items
										</span>
										<button
											class="requeue-user-btn"
											on:click={() => handleRequeueChecks(table.userId, table.username)}
											disabled={!token || requeuingUser === table.userId}
											title="Requeue all stock checks for this user"
											aria-label="Requeue all stock checks for this user"
										>
											{#if requeuingUser === table.userId}
												<i class="fa-solid fa-spinner fa-spin"></i>
											{:else}
												<i class="fa-solid fa-paper-plane"></i>
											{/if}
										</button>
										<button
											class="expand-btn"
											on:click={() => {
												if (expandedTable === table.userId) {
													expandedTable = null;
													expandedTableData = [];
												} else {
													expandedTable = table.userId;
													loadTableData(table.userId);
												}
											}}
											disabled={!token}
											title={expandedTable === table.userId ? 'Collapse card list' : 'Expand card list'}
											aria-label={expandedTable === table.userId ? 'Collapse card list' : 'Expand card list'}
										>
											<i class="fa-solid {expandedTable === table.userId ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
										</button>
										<button
											class="delete-user-btn"
											on:click={() => promptDeleteAccount(table.userId)}
											disabled={!token}
											title="Delete user account and all wishlist data"
										>
											<i class="fa-solid fa-trash-can"></i>
										</button>
									</div>
								</div>

								{#if requeueFeedback && requeueFeedback.userId === table.userId}
									<div class="requeue-feedback-banner {requeueFeedback.type}">
										<i class="fa-solid {requeueFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
										<span>{requeueFeedback.text}</span>
									</div>
								{/if}

								<!-- Expanded Seeking Table -->
								{#if expandedTable === table.userId}
									<div class="user-table-wrapper">
										{#if tableDataLoading}
											<div class="section-loading">
												<div class="loading-spinner small"></div>
												<span>Loading seeking list...</span>
											</div>
										{:else if error && expandedTable === table.userId}
											<div class="error-banner">
												<i class="fa-solid fa-triangle-exclamation"></i>
												<span>{error}</span>
											</div>
										{:else if expandedTableData.length === 0}
											<div class="empty-table-state">
												<i class="fa-solid fa-box-open"></i>
												<p>No cards found in this user's seeking list.</p>
											</div>
										{:else}
											<div class="table-scroll-container">
												<table class="modern-table">
													<thead>
														<tr>
															<th class="col-name">Card Name</th>
															<th class="col-set">Set</th>
															<th class="col-num">#</th>
															<th class="col-lang">Lang</th>
															<th class="col-finish">Finish</th>
															{#if isMarketplaceEnabled(table, 'cardtrader')}
																<th class="col-vendor">CardTrader</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'tcgplayer')}
																<th class="col-vendor">TCGPlayer</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'manapool')}
																<th class="col-vendor">Mana Pool</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'ebay')}
																<th class="col-vendor">eBay</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'himarket')}
																<th class="col-vendor">HiMarket</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'hareruya')}
																<th class="col-vendor">Hareruya</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'ruten')}
																<th class="col-vendor">Ruten</th>
															{/if}
															{#if isMarketplaceEnabled(table, 'cardmarket')}
																<th class="col-vendor">CardMarket</th>
															{/if}
															<th class="col-cond">Min Cond</th>
														</tr>
													</thead>
													<tbody>
														{#each expandedTableData as card}
															<tr>
																<td class="col-name" data-label="Name">
																	<span class="card-name-text">{card.name}</span>
																</td>
																<td class="col-set" data-label="Set">
																	<div class="set-cell">
																		<img
																			class="set-icon"
																			src="https://svgs.scryfall.io/sets/{card.set_code?.toLowerCase()}.svg"
																			alt="{card.set_code}"
																			loading="lazy"
																		/>
																		<span class="set-code">{card.set_code?.toUpperCase()}</span>
																	</div>
																</td>
																<td class="col-num" data-label="Number">
																	<span class="collector-number">{card.collector_number}</span>
																</td>
																<td class="col-lang" data-label="Language">
																	<span class="lang-pill">{card.language?.toUpperCase()}</span>
																</td>
																<td class="col-finish" data-label="Finish">
																	{#if card.finish === 'foil'}
																		<span class="finish-pill foil">
																			<i class="fa-solid fa-sparkles"></i> Foil
																		</span>
																	{:else}
																		<span class="finish-pill nonfoil">Nonfoil</span>
																	{/if}
																</td>
																{#if isMarketplaceEnabled(table, 'cardtrader')}
																	<td class="col-vendor" data-label="CardTrader">
																		{#if card.cardtrader_stock}
																			<span class="stock-pill in-stock">
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.cardtrader_low_price)}
																				{#if card.cardtrader_condition}
																					<span class="cond-pill">{card.cardtrader_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'tcgplayer')}
																	<td class="col-vendor" data-label="TCGPlayer">
																		{#if card.tcgplayer_stock}
																			<span class="stock-pill in-stock">
																				<i class="fa-solid fa-check"></i>
																				{formatDollars(card.tcgplayer_low_price)}
																				{#if card.tcgplayer_condition}
																					<span class="cond-pill">{card.tcgplayer_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'manapool')}
																	<td class="col-vendor" data-label="Mana Pool">
																		{#if card.manapool_stock}
																			<span class="stock-pill in-stock">
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.manapool_low_price)}
																				{#if card.manapool_condition}
																					<span class="cond-pill">{card.manapool_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'ebay')}
																	<td class="col-vendor" data-label="eBay">
																		{#if card.ebay_stock}
																			<span class="stock-pill in-stock">
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.ebay_low_price)}
																				{#if card.ebay_condition}
																					<span class="cond-pill">{card.ebay_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'himarket')}
																	<td class="col-vendor" data-label="HiMarket">
																		{#if card.himarket_stock}
																			<span class="stock-pill in-stock" title={card.himarket_price_hkd ? `HK$ ${Number(card.himarket_price_hkd).toFixed(2)}${card.himarket_condition ? ` (${card.himarket_condition})` : ''}` : ''}>
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.himarket_low_price)}
																				{#if card.himarket_condition}
																					<span class="cond-pill">{card.himarket_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'hareruya')}
																	<td class="col-vendor" data-label="Hareruya">
																		{#if card.hareruya_stock}
																			<span class="stock-pill in-stock" title={card.hareruya_price_jpy ? `¥${Number(card.hareruya_price_jpy).toLocaleString()}${card.hareruya_condition ? ` (${card.hareruya_condition})` : ''}` : ''}>
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.hareruya_low_price)}
																				{#if card.hareruya_condition}
																					<span class="cond-pill">{card.hareruya_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'ruten')}
																	<td class="col-vendor" data-label="Ruten">
																		{#if !['zht', 'en'].includes((card.language || '').toLowerCase())}
																			<span class="stock-pill out-of-stock" title="Ruten only checks Traditional Chinese (ZHT) and English (EN) cards">—</span>
																		{:else if card.ruten_stock}
																			<span class="stock-pill in-stock" title={card.ruten_price_twd ? `NT$ ${Number(card.ruten_price_twd).toLocaleString()}${card.ruten_condition ? ` (${card.ruten_condition})` : ''}` : ''}>
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.ruten_low_price)}
																				{#if card.ruten_condition}
																					<span class="cond-pill">{card.ruten_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																{#if isMarketplaceEnabled(table, 'cardmarket')}
																	<td class="col-vendor" data-label="CardMarket">
																		{#if card.cardmarket_stock}
																			<span class="stock-pill in-stock" title={card.cardmarket_price_eur ? `€${Number(card.cardmarket_price_eur).toFixed(2)}${card.cardmarket_condition ? ` (${card.cardmarket_condition})` : ''}` : ''}>
																				<i class="fa-solid fa-check"></i>
																				{formatCents(card.cardmarket_low_price)}
																				{#if card.cardmarket_condition}
																					<span class="cond-pill">{card.cardmarket_condition}</span>
																				{/if}
																			</span>
																		{:else}
																			<span class="stock-pill out-of-stock">Out of Stock</span>
																		{/if}
																	</td>
																{/if}
																<td class="col-cond" data-label="Min Cond">
																	{#if card.min_condition && card.min_condition !== 'ANY'}
																		<span class="cond-req-pill cond-{card.min_condition.toLowerCase()}" title="Card Condition Override: {card.min_condition}+">
																			{card.min_condition === 'NM' ? 'NM ONLY' : `MIN ${card.min_condition}+`}
																		</span>
																	{:else if card.min_condition === 'ANY'}
																		<span class="cond-req-pill cond-any" title="Card Condition Override: Any Condition">ANY COND</span>
																	{:else if table.minCondition && table.minCondition !== 'ANY'}
																		<span class="cond-req-pill inherited cond-{table.minCondition.toLowerCase()}" title="Inherited Account Condition: {table.minCondition}+">
																			{table.minCondition === 'NM' ? 'NM (Acct)' : `${table.minCondition}+ (Acct)`}
																		</span>
																	{:else}
																		<span class="cond-req-pill cond-any inherited" title="Default: Any Condition">ANY</span>
																	{/if}
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	</div>

	<!-- Delete User Modal -->
	{#if showDeleteModal}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="modal-overlay"
			on:click={closeDeleteModal}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') closeDeleteModal();
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
				aria-labelledby="admin-delete-dialog-title"
				tabindex="-1"
			>
				<div class="modal-icon-badge danger">
					<i class="fa-solid fa-triangle-exclamation"></i>
				</div>
				<h3 id="admin-delete-dialog-title">Confirm User Account Deletion</h3>
				<p>
					Are you sure you want to delete user account <strong class="delete-user-id">{userToDelete}</strong>?
				</p>
				<p class="modal-subtext">This action is irreversible and deletes all seeking list cards associated with this user.</p>

				<div class="modal-buttons">
					<button class="cancel-btn" on:click={closeDeleteModal} disabled={isDeletingUser}>
						Cancel
					</button>
					<button class="confirm-btn" on:click={handleDeleteAccount} disabled={isDeletingUser}>
						<i class="fa-solid {isDeletingUser ? 'fa-spinner fa-spin' : 'fa-trash-can'}"></i>
						<span>{isDeletingUser ? 'Deleting...' : 'Yes, Delete Account'}</span>
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit Tier Modal -->
	{#if showTierModal && userToEditTier}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="modal-overlay"
			on:click={closeTierModal}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') closeTierModal();
			}}
			role="button"
			tabindex="0"
			aria-label="Close dialog"
		>
			<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
			<div
				class="modal tier-modal"
				on:click|stopPropagation
				on:keydown|stopPropagation
				role="dialog"
				aria-modal="true"
				aria-labelledby="admin-tier-dialog-title"
				tabindex="-1"
			>
				<div class="modal-icon-badge tier">
					<i class="fa-solid fa-crown"></i>
				</div>
				<h3 id="admin-tier-dialog-title">Override Membership Tier</h3>
				<p>
					Update membership tier for user <strong class="tier-target-user">{userToEditTier.username || userToEditTier.userId}</strong>
				</p>
				<p class="modal-subtext">Setting an explicit tier will override Discord role synchronization until reset to 'None'.</p>

				<div class="tier-select-options">
					{#each [
						{ id: 'Basic', label: 'Basic', desc: 'Standard free tier (25 cards)', icon: 'fa-certificate' },
						{ id: 'Premium', label: 'Premium', desc: 'Premium tier (enhanced limits)', icon: 'fa-gem' },
						{ id: 'Legacy', label: 'Legacy', desc: 'Legacy supporter (unlimited alerts)', icon: 'fa-wand-magic-sparkles' },
						{ id: 'Banned', label: 'Banned', desc: 'Suspended (cannot add cards, checks disabled)', icon: 'fa-ban' },
						{ id: 'None', label: 'Reset (Discord Sync)', desc: 'Remove manual override, sync with Discord roles', icon: 'fa-rotate' }
					] as opt}
						<button
							type="button"
							class="tier-choice-btn tier-btn-{opt.id.toLowerCase()}"
							class:selected={selectedTier.toLowerCase() === opt.id.toLowerCase()}
							on:click={() => (selectedTier = opt.id)}
						>
							<i class="fa-solid {opt.icon}"></i>
							<div class="tier-choice-label">
								<span class="tier-choice-name">{opt.label}</span>
								<span class="tier-choice-desc">{opt.desc}</span>
							</div>
							{#if selectedTier.toLowerCase() === opt.id.toLowerCase()}
								<i class="fa-solid fa-circle-check check-icon"></i>
							{/if}
						</button>
					{/each}
				</div>

				<div class="modal-buttons">
					<button class="cancel-btn" on:click={closeTierModal} disabled={isUpdatingTier}>
						Cancel
					</button>
					<button class="confirm-btn save-tier-btn" on:click={handleSaveTier} disabled={isUpdatingTier}>
						<i class="fa-solid {isUpdatingTier ? 'fa-spinner fa-spin' : 'fa-check'}"></i>
						<span>{isUpdatingTier ? 'Saving...' : 'Save Tier'}</span>
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Poison Queue Inspector Modal -->
	{#if showPoisonModal && activePoisonQueue}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="modal-overlay"
			on:click={closePoisonModal}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') closePoisonModal();
			}}
			role="button"
			tabindex="0"
			aria-label="Close poison inspector"
		>
			<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
			<div
				class="modal modal-wide"
				on:click|stopPropagation
				on:keydown|stopPropagation
				role="dialog"
				aria-modal="true"
				aria-labelledby="admin-poison-dialog-title"
				tabindex="-1"
			>
				<div class="modal-header-row">
					<div class="modal-header-title">
						<div class="modal-icon-badge danger small">
							<i class="fa-solid fa-skull"></i>
						</div>
						<div>
							<h3 id="admin-poison-dialog-title">Poison Queue: {activePoisonQueue.name}-poison</h3>
							<span class="modal-subtitle">Dead-letter messages that failed execution multiple times</span>
						</div>
					</div>
					<button class="modal-close-icon-btn" on:click={closePoisonModal} title="Close">
						<i class="fa-solid fa-xmark"></i>
					</button>
				</div>

				{#if poisonFeedback}
					<div class="poison-feedback-banner {poisonFeedback.type}">
						<i class="fa-solid {poisonFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
						<span>{poisonFeedback.text}</span>
					</div>
				{/if}

				{#if poisonLoading}
					<div class="poison-loading-wrap">
						<div class="loading-spinner small"></div>
						<span>Peeking poison messages...</span>
					</div>
				{:else if poisonMessages.length === 0}
					<div class="poison-empty-wrap">
						<i class="fa-solid fa-shield-halved"></i>
						<p>No messages currently in poison queue.</p>
					</div>
				{:else}
					<div class="poison-messages-list">
						{#each poisonMessages as msg, idx}
							<div class="poison-message-card">
								<div class="poison-msg-header">
									<span class="poison-msg-id"><i class="fa-solid fa-envelope"></i> Msg #{idx + 1} ({msg.id || 'N/A'})</span>
									<span class="poison-msg-time">{msg.inserted_on ? new Date(msg.inserted_on).toLocaleString() : ''} (Deq: {msg.dequeue_count ?? 'N/A'})</span>
								</div>
								<div class="poison-msg-content">
									<pre><code>{msg.content || '(empty)'}</code></pre>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<div class="modal-footer-row">
					<button class="cancel-btn" on:click={closePoisonModal} disabled={poisonActionLoading}>
						Close
					</button>
					<div class="poison-actions-group">
						<button
							class="purge-action-btn"
							on:click={() => handleClearPoison(activePoisonQueue.name)}
							disabled={poisonActionLoading || poisonMessages.length === 0}
							title="Permanently remove all poison messages"
						>
							<i class="fa-solid {poisonActionLoading ? 'fa-spinner fa-spin' : 'fa-trash'}"></i>
							<span>Purge All</span>
						</button>
						<button
							class="replay-action-btn"
							on:click={() => handleReplayPoison(activePoisonQueue.name)}
							disabled={poisonActionLoading || poisonMessages.length === 0}
							title="Re-enqueue all poison messages back to active queue"
						>
							<i class="fa-solid {poisonActionLoading ? 'fa-spinner fa-spin' : 'fa-arrow-rotate-right'}"></i>
							<span>Replay All</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.loading-container,
	.unauthorized-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 350px;
		text-align: center;
		padding: 3rem 1.5rem;
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

	.loading-spinner.small {
		width: 20px;
		height: 20px;
		border-width: 2px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.unauthorized-icon-badge {
		width: 60px;
		height: 60px;
		border-radius: 16px;
		background: rgba(239, 68, 68, 0.12);
		color: var(--color-error);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.75rem;
	}

	.unauthorized-container h2 {
		margin: 0;
		color: var(--color-text-primary);
		font-size: 1.5rem;
		font-weight: 700;
	}

	.unauthorized-container p {
		margin: 0;
		color: var(--color-text-secondary);
		max-width: 400px;
	}

	.return-home-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.65rem 1.25rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		color: white;
		text-decoration: none;
		border-radius: 10px;
		font-weight: 600;
		font-size: 0.95rem;
		box-shadow: 0 4px 12px var(--color-primary-alpha);
		transition: all var(--transition-fast);
	}

	.return-home-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px var(--color-primary-alpha);
	}

	.admin-container {
		max-width: 1200px;
		margin: 2rem auto;
		padding: 0 1.25rem;
		animation: fadeIn 0.4s ease-out;
	}

	/* Workspace Toolbar */
	.workspace-toolbar {
		margin-bottom: 2rem;
		padding: 0.75rem 1.25rem;
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px solid var(--glass-border, var(--color-border));
		border-radius: 16px;
		box-shadow: var(--shadow-sm);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.admin-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.85rem;
		height: 36px;
		border-radius: 10px;
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.12));
		border: 1px solid var(--color-primary-alpha, rgba(99, 102, 241, 0.25));
		color: var(--color-primary, #6366f1);
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.user-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		padding: 0 0.85rem;
		height: 36px;
		border-radius: 10px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.user-pill i {
		color: var(--color-text-secondary);
	}

	.status-indicator-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.25);
		color: #22c55e;
		padding: 0 0.85rem;
		height: 36px;
		border-radius: 10px;
		font-size: 0.825rem;
		font-weight: 600;
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: #22c55e;
		box-shadow: 0 0 8px #22c55e;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.85); }
	}

	.card-counter {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.825rem;
		color: var(--color-text-secondary);
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		padding: 0 0.85rem;
		height: 36px;
		border-radius: 10px;
		font-weight: 500;
	}

	.card-counter strong {
		color: var(--color-text-primary);
		font-weight: 700;
	}

	.toolbar-icon-btn {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.9rem;
		transition: all var(--transition-fast);
	}

	.toolbar-icon-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: var(--color-bg-hover);
	}

	/* Content Layout */
	.admin-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.admin-section {
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border-radius: 16px;
		padding: 1.75rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--glass-border, var(--color-border));
	}

	.section-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--color-border);
	}

	.section-title-icon {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.12));
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.admin-section h2 {
		margin: 0;
		color: var(--color-text-primary);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		flex-grow: 1;
	}

	.section-loading {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		padding: 1rem 0;
	}

	.header-refresh-btn {
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.85rem;
		transition: all var(--transition-fast);
	}

	.header-refresh-btn:hover:not(:disabled) {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.header-refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		padding: 1.15rem;
		background: var(--color-bg-secondary);
		border-radius: 14px;
		border: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		transition: transform var(--transition-fast), border-color var(--transition-fast);
	}

	.stat-card:hover {
		transform: translateY(-2px);
		border-color: var(--color-border-hover);
	}

	.stat-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.stat-title {
		font-size: 0.8rem;
		text-transform: uppercase;
		color: var(--color-text-secondary);
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.stat-icon-badge {
		width: 28px;
		height: 28px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
	}

	.stat-icon-badge.users {
		background: rgba(99, 102, 241, 0.12);
		color: #6366f1;
	}

	.stat-icon-badge.items {
		background: rgba(16, 185, 129, 0.12);
		color: #10b981;
	}

	.stat-icon-badge.ct {
		background: rgba(59, 130, 246, 0.12);
		color: #3b82f6;
	}

	.stat-icon-badge.tcg {
		background: rgba(16, 185, 129, 0.12);
		color: #10b981;
	}

	.stat-icon-badge.manapool {
		background: rgba(139, 92, 246, 0.12);
		color: #8b5cf6;
	}

	.stat-icon-badge.ebay {
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
	}

	.stat-icon-badge.himarket {
		background: rgba(236, 72, 153, 0.12);
		color: #ec4899;
	}

	.stat-icon-badge.hareruya {
		background: rgba(249, 115, 22, 0.12);
		color: #f97316;
	}

	.stat-icon-badge.ruten {
		background: rgba(20, 184, 166, 0.12);
		color: #14b8a6;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text-primary);
		letter-spacing: -0.02em;
	}

	.stat-sub {
		font-size: 0.775rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	/* Banner Manager */
	.banner-manager {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.styled-input {
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.95rem;
		outline: none;
		transition: all var(--transition-fast);
	}

	.styled-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		align-items: center;
	}

	.select-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.styled-select {
		width: 100%;
		padding: 0.75rem 2.25rem 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.95rem;
		font-weight: 500;
		outline: none;
		appearance: none;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.styled-select:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.select-chevron {
		position: absolute;
		right: 1rem;
		pointer-events: none;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.toggle-group {
		justify-content: center;
	}

	.toggle-control-label {
		margin-bottom: 0.35rem;
	}

	.toggle-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 42px;
	}

	.toggle-status-text {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.toggle-status-text.active {
		color: var(--color-success);
	}

	/* Toggle Switch */
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

	.slider.round {
		border-radius: 999px;
	}

	.slider.round:before {
		border-radius: 50%;
	}

	.banner-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.save-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		color: white;
		border: none;
		border-radius: 10px;
		padding: 0.75rem 1.5rem;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: 0 4px 12px var(--color-primary-alpha);
	}

	.save-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px var(--color-primary-alpha);
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.banner-feedback {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.banner-feedback.success {
		background: rgba(34, 197, 94, 0.12);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.25);
	}

	.banner-feedback.error {
		background: rgba(239, 68, 68, 0.12);
		color: var(--color-error);
		border: 1px solid rgba(239, 68, 68, 0.25);
	}

	/* System Status */
	.status-summary-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.status-chip {
		flex: 1 1 200px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.chip-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--color-text-secondary);
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.chip-value {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-primary);
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		font-size: 0.775rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		width: fit-content;
	}

	.status-badge .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.status-badge.running,
	.status-badge.healthy,
	.status-badge.normal {
		background: rgba(34, 197, 94, 0.12);
		border: 1px solid rgba(34, 197, 94, 0.25);
		color: #22c55e;
	}
	.status-badge.running .dot,
	.status-badge.healthy .dot,
	.status-badge.normal .dot {
		background-color: #22c55e;
	}

	.status-badge.limited,
	.status-badge.degraded {
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.25);
		color: #f59e0b;
	}
	.status-badge.limited .dot,
	.status-badge.degraded .dot {
		background-color: #f59e0b;
	}

	.status-badge.stopped,
	.status-badge.error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: var(--color-error);
	}
	.status-badge.stopped .dot,
	.status-badge.error .dot {
		background-color: var(--color-error);
	}

	.subsection {
		margin-top: 1.5rem;
	}

	.subsection-title {
		margin: 0 0 0.85rem 0;
		font-size: 0.95rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
	}

	.function-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.85rem;
	}

	.function-card {
		padding: 0.85rem 1rem;
		background: var(--color-bg-secondary);
		border-radius: 12px;
		border: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: border-color var(--transition-fast);
	}

	.function-card:hover {
		border-color: var(--color-border-hover);
	}

	.func-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.func-name {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-primary);
		word-break: break-all;
	}

	.func-details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.metric-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		background: var(--color-bg-hover, rgba(0, 0, 0, 0.04));
		border: 1px solid var(--color-border);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.error-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: var(--color-error);
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.25);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.queue-actions-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.25rem;
		padding-top: 0.4rem;
		border-top: 1px dashed var(--color-border);
	}

	.queue-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.25rem 0.55rem;
		border-radius: 6px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.queue-action-btn:hover:not(:disabled) {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
		border-color: var(--color-border-hover);
	}

	.queue-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.queue-action-btn.inspect-btn:hover:not(:disabled) {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.queue-action-btn.replay-btn:hover:not(:disabled) {
		color: #eab308;
		border-color: #eab308;
	}

	.queue-action-btn.clear-btn:hover:not(:disabled) {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	/* User Management */
	.user-count-badge {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.user-filter-bar {
		margin-bottom: 1.25rem;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 480px;
	}

	.search-icon {
		position: absolute;
		left: 0.85rem;
		color: var(--color-text-muted);
		font-size: 0.9rem;
		pointer-events: none;
	}

	.user-search-input {
		width: 100%;
		padding: 0.65rem 2.25rem 0.65rem 2.4rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		color: var(--color-text-primary);
		font-size: 0.9rem;
		outline: none;
		transition: all var(--transition-fast);
	}

	.user-search-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.clear-search-btn {
		position: absolute;
		right: 0.75rem;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.2rem;
		font-size: 0.85rem;
	}

	.clear-search-btn:hover {
		color: var(--color-text-primary);
	}

	.user-toolbar-card {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 0.85rem 1rem;
		margin-bottom: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.toolbar-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.toolbar-top-row .search-input-wrapper {
		flex: 1;
		min-width: 260px;
		max-width: 450px;
	}

	.sort-controls-wrapper {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.sort-label,
	.filter-pills-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-right: 0.2rem;
	}

	.sort-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		padding: 0.35rem 0.65rem;
		border-radius: 8px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.sort-pill:hover {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.sort-pill.active {
		background: rgba(59, 130, 246, 0.12);
		border-color: var(--color-primary);
		color: var(--color-primary);
		font-weight: 600;
	}

	.tier-pills-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding-top: 0.65rem;
		border-top: 1px solid var(--color-border);
	}

	.tier-filter-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.tier-filter-pill:hover {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.tier-filter-pill.active {
		font-weight: 600;
	}

	.tier-filter-pill.active:not(.tier-basic):not(.tier-premium):not(.tier-legacy) {
		background: var(--color-text-primary);
		border-color: var(--color-text-primary);
		color: var(--color-bg-primary);
	}

	.tier-filter-pill.tier-basic.active {
		background: rgba(148, 163, 184, 0.2);
		border-color: #94a3b8;
		color: #e2e8f0;
	}

	.tier-filter-pill.tier-premium.active {
		background: rgba(59, 130, 246, 0.2);
		border-color: #3b82f6;
		color: #60a5fa;
	}

	.tier-filter-pill.tier-legacy.active {
		background: rgba(168, 85, 247, 0.2);
		border-color: #a855f7;
		color: #c084fc;
	}

	.tier-filter-pill.tier-banned.active {
		background: rgba(239, 68, 68, 0.2);
		border-color: #ef4444;
		color: #f87171;
	}

	.user-accordion-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.user-card {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		overflow: hidden;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.user-card:hover {
		border-color: var(--color-border-hover);
	}

	.user-card.is-expanded {
		border-color: var(--color-primary-alpha, rgba(99, 102, 241, 0.4));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.user-card-header {
		padding: 1rem 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.user-main-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		flex-grow: 1;
	}

	.user-avatar-badge {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		flex-shrink: 0;
		overflow: hidden;
		position: relative;
	}

	.user-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.user-avatar-badge i.hidden {
		display: none;
	}

	.user-titles {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.user-name-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.override-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		background: rgba(234, 179, 8, 0.15);
		border: 1px solid rgba(234, 179, 8, 0.35);
		color: #eab308;
	}

	.edit-tier-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 500;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		background: var(--color-bg-hover, rgba(255, 255, 255, 0.06));
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.edit-tier-pill-btn:hover {
		background: rgba(59, 130, 246, 0.12);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.user-name {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.user-handle {
		font-size: 0.825rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.user-id-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		padding: 0.12rem 0.5rem;
		border-radius: 6px;
	}

	.user-meta-column {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.2rem;
	}

	.user-meta-line {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.user-meta-subline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.user-marketplaces-row {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.mk-icon-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		cursor: help;
		transition: all 0.15s ease;
		line-height: 1.2;
	}

	.mk-icon-badge:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
	}

	.mk-icon-badge.ct {
		color: #3b82f6;
		border-color: rgba(59, 130, 246, 0.35);
		background: rgba(59, 130, 246, 0.1);
	}

	.mk-icon-badge.tcg {
		color: #10b981;
		border-color: rgba(16, 185, 129, 0.35);
		background: rgba(16, 185, 129, 0.1);
	}

	.mk-icon-badge.manapool {
		color: #8b5cf6;
		border-color: rgba(139, 92, 246, 0.35);
		background: rgba(139, 92, 246, 0.1);
	}

	.mk-icon-badge.ebay {
		color: #f59e0b;
		border-color: rgba(245, 158, 11, 0.35);
		background: rgba(245, 158, 11, 0.1);
	}

	.mk-icon-badge.himarket {
		color: #ec4899;
		border-color: rgba(236, 72, 153, 0.35);
		background: rgba(236, 72, 153, 0.1);
	}

	.mk-icon-badge.hareruya {
		color: #f97316;
		border-color: rgba(249, 115, 22, 0.35);
		background: rgba(249, 115, 22, 0.1);
	}

	.mk-icon-badge.ruten {
		color: #14b8a6;
		border-color: rgba(20, 184, 166, 0.35);
		background: rgba(20, 184, 166, 0.1);
	}

	.mk-icon-badge.cardmarket {
		color: #38bdf8;
		border-color: rgba(56, 189, 248, 0.35);
		background: rgba(56, 189, 248, 0.1);
	}

	.user-cond-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.35);
		color: #818cf8;
		cursor: help;
		line-height: 1.2;
	}

	.user-cond-badge.any {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--color-border);
		color: var(--color-text-secondary);
	}

	.user-activity-timestamp {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.775rem;
		color: var(--color-text-muted);
	}

	.user-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.item-count-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		font-size: 0.825rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
	}

	.item-count-chip i {
		color: var(--color-text-secondary);
	}

	.expand-btn {
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		border-radius: 8px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.expand-btn:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: var(--color-bg-hover);
		transform: translateY(-1px);
	}

	.requeue-user-btn {
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		color: #10b981;
		border-radius: 8px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.requeue-user-btn:hover:not(:disabled) {
		background: #10b981;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.requeue-feedback-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		margin: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.825rem;
		font-weight: 500;
	}

	.requeue-feedback-banner.success {
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: #10b981;
	}

	.requeue-feedback-banner.error {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: var(--color-error);
	}

	.delete-user-btn {
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: var(--color-error);
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all var(--transition-fast);
	}

	.delete-user-btn:hover:not(:disabled) {
		background: var(--color-error);
		color: white;
		transform: translateY(-1px);
	}

	/* Expanded Table Container */
	.user-table-wrapper {
		border-top: 1px solid var(--color-border);
		background: var(--color-bg-elevated);
		padding: 1.25rem;
		overflow: hidden;
	}

	.table-scroll-container {
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-x pan-y;
		overscroll-behavior-x: contain;
		padding-bottom: 0.5rem;
	}

	.table-scroll-container::-webkit-scrollbar {
		height: 6px;
	}

	.table-scroll-container::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.table-scroll-container::-webkit-scrollbar-thumb {
		background: var(--color-primary);
		border-radius: 4px;
	}

	.modern-table {
		width: 100%;
		min-width: max-content;
		border-collapse: separate;
		border-spacing: 0;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		font-size: 0.875rem;
	}

	.modern-table th {
		background: var(--color-bg-secondary);
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 700;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.modern-table td {
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-primary);
		vertical-align: middle;
		background: var(--color-bg-elevated);
		transition: background-color var(--transition-fast);
	}

	.modern-table tbody tr:hover td {
		background: var(--color-bg-hover);
	}

	.modern-table tbody tr:last-child td {
		border-bottom: none;
	}

	.card-name-text {
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.set-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.set-icon {
		height: 1.35em;
		width: 1.35em;
		vertical-align: middle;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
	}

	:global([data-theme='dark']) .set-icon {
		filter: invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
	}

	.set-code {
		font-weight: 700;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.collector-number {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.lang-pill {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.finish-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.finish-pill.foil {
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.3);
		color: #d97706;
	}

	.finish-pill.nonfoil {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.stock-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.stock-pill.in-stock {
		color: #22c55e;
	}

	.stock-pill.out-of-stock {
		color: var(--color-text-muted);
		font-weight: 500;
		font-size: 0.75rem;
	}

	.cond-pill {
		display: inline-flex;
		align-items: center;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.08rem 0.35rem;
		border-radius: 999px;
		background: rgba(16, 185, 129, 0.14);
		border: 1px solid rgba(16, 185, 129, 0.35);
		color: #10b981;
		letter-spacing: 0.03em;
	}

	th.col-cond {
		text-align: center;
		width: 100px;
	}

	td.col-cond {
		text-align: center;
	}

	.cond-req-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.cond-req-pill.cond-nm {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: #10b981;
	}

	.cond-req-pill.cond-sp,
	.cond-req-pill.cond-lp {
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.4);
		color: #3b82f6;
	}

	.cond-req-pill.cond-mp {
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.4);
		color: #f59e0b;
	}

	.cond-req-pill.cond-hp {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #ef4444;
	}

	.cond-req-pill.cond-any {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.cond-req-pill.inherited {
		opacity: 0.85;
		font-style: italic;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-error);
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.25);
		border-radius: 10px;
		padding: 0.85rem 1.25rem;
		font-size: 0.9rem;
	}

	.empty-state,
	.empty-table-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--color-text-muted);
	}

	.empty-state i,
	.empty-table-state i {
		font-size: 2rem;
		opacity: 0.5;
	}

	.empty-state p,
	.empty-table-state p {
		margin: 0;
		font-size: 0.95rem;
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

	.delete-user-id {
		color: var(--color-text-primary);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		word-break: break-all;
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

	.confirm-btn:hover:not(:disabled) {
		background-color: #b91c1c;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
	}

	.confirm-btn:disabled,
	.cancel-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-icon-badge.tier {
		background: rgba(168, 85, 247, 0.12);
		color: #a855f7;
		border: 1px solid rgba(168, 85, 247, 0.25);
	}

	.modal-icon-badge.danger.small {
		width: 38px;
		height: 38px;
		font-size: 1.15rem;
		margin-bottom: 0;
	}

	.tier-target-user {
		color: var(--color-text-primary);
	}

	.tier-select-options {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		width: 100%;
		margin: 1.25rem 0 0.5rem 0;
	}

	.tier-choice-btn {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		background: var(--color-bg-secondary);
		border: 2px solid var(--color-border);
		color: var(--color-text-primary);
		cursor: pointer;
		text-align: left;
		transition: all var(--transition-fast);
		width: 100%;
	}

	.tier-choice-btn i {
		font-size: 1.2rem;
		width: 24px;
		text-align: center;
	}

	.tier-choice-label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
	}

	.tier-choice-name {
		font-weight: 700;
		font-size: 0.95rem;
	}

	.tier-choice-desc {
		font-size: 0.78rem;
		color: var(--color-text-secondary);
	}

	.tier-choice-btn .check-icon {
		color: var(--color-primary);
		font-size: 1.1rem;
		margin-left: auto;
	}

	.tier-choice-btn:hover {
		border-color: var(--color-border-hover);
		background: var(--color-bg-hover);
	}

	.tier-choice-btn.selected {
		border-color: var(--color-primary);
		background: rgba(59, 130, 246, 0.08);
	}

	.tier-choice-btn.tier-btn-legacy.selected {
		border-color: #a855f7;
		background: rgba(168, 85, 247, 0.08);
	}

	.tier-choice-btn.tier-btn-legacy i {
		color: #c084fc;
	}

	.tier-choice-btn.tier-btn-premium.selected {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.08);
	}

	.tier-choice-btn.tier-btn-premium i {
		color: #60a5fa;
	}

	.tier-choice-btn.tier-btn-basic.selected {
		border-color: #94a3b8;
		background: rgba(148, 163, 184, 0.08);
	}

	.tier-choice-btn.tier-btn-basic i {
		color: #94a3b8;
	}

	.tier-choice-btn.tier-btn-banned.selected {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}

	.tier-choice-btn.tier-btn-banned i {
		color: #ef4444;
	}

	.save-tier-btn {
		background: var(--color-primary);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	.save-tier-btn:hover:not(:disabled) {
		background-color: var(--color-primary-hover, #2563eb);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
	}

	/* Modal Wide (Poison Inspector) */
	.modal-wide {
		max-width: 780px;
		width: 100%;
		text-align: left;
		align-items: stretch;
	}

	.modal-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 1rem;
		margin-bottom: 1rem;
	}

	.modal-header-title {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.modal-header-title h3 {
		margin: 0;
		font-size: 1.15rem;
	}

	.modal-subtitle {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.modal-close-icon-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
	}

	.modal-close-icon-btn:hover {
		color: var(--color-text-primary);
		background: var(--color-bg-hover);
	}

	.poison-feedback-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 10px;
		font-size: 0.88rem;
		margin-bottom: 1rem;
	}

	.poison-feedback-banner.success {
		background: rgba(34, 197, 94, 0.12);
		border: 1px solid rgba(34, 197, 94, 0.3);
		color: #22c55e;
	}

	.poison-feedback-banner.error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: var(--color-error);
	}

	.poison-loading-wrap,
	.poison-empty-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 0.75rem;
		color: var(--color-text-secondary);
		background: var(--color-bg-secondary);
		border-radius: 12px;
		border: 1px dashed var(--color-border);
		text-align: center;
	}

	.poison-empty-wrap i {
		font-size: 2.25rem;
		color: #22c55e;
	}

	.poison-messages-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 420px;
		overflow-y: auto;
		padding-right: 0.35rem;
	}

	.poison-message-card {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 0.85rem;
	}

	.poison-msg-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.poison-msg-id {
		font-weight: 600;
		color: var(--color-text-primary);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.poison-msg-time {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.poison-msg-content pre {
		margin: 0;
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0.65rem 0.85rem;
		font-size: 0.78rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
		color: var(--color-text-primary);
		max-height: 180px;
	}

	.modal-footer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.poison-actions-group {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.replay-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #eab308;
		color: #1a1a1a;
		border: none;
		padding: 0.65rem 1.15rem;
		border-radius: 10px;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.88rem;
		transition: all var(--transition-fast);
	}

	.replay-action-btn:hover:not(:disabled) {
		background: #ca8a04;
		color: #ffffff;
	}

	.purge-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: rgba(239, 68, 68, 0.15);
		color: var(--color-error);
		border: 1px solid rgba(239, 68, 68, 0.3);
		padding: 0.65rem 1.15rem;
		border-radius: 10px;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.88rem;
		transition: all var(--transition-fast);
	}

	.purge-action-btn:hover:not(:disabled) {
		background: var(--color-error);
		color: white;
	}

	.replay-action-btn:disabled,
	.purge-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.workspace-toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 0.85rem;
		}

		.toolbar-left,
		.toolbar-right {
			justify-content: space-between;
			width: 100%;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.user-card-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.user-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.user-table-wrapper {
			padding: 0.75rem 0.5rem;
		}

		.modal-buttons {
			flex-direction: column;
		}
	}
</style>
