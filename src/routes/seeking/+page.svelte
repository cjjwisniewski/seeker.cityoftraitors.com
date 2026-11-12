<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { fetchWithAuth } from '$lib/utils/api';
	import { initExchangeRates } from '$lib/stores/exchangeRate';
	import {
		PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
		PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL,
		PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL
	} from '$env/static/public';
	import { env as publicEnv } from '$env/dynamic/public';
	import {
		getCardKey,
		formatRelativeTime,
		formatExactTimestamp,
		getCardCooldownRemainingSec,
		formatCooldownRemaining,
		getStockIcon,
		getStockColor,
		getStockStatus,
		formatPrice,
		getLowestOffer,
		getCardHistoricalBadgeInfo,
		formatCardAsDecklistLine,
		buildSeekingCsvString
	} from '$lib/utils/seekingUtils';
	import HistoricalPriceModal from '$lib/components/seeking/HistoricalPriceModal.svelte';
	import EditCardModal from '$lib/components/seeking/EditCardModal.svelte';
	import DecklistImportModal from '$lib/components/seeking/DecklistImportModal.svelte';
	import BulkActionModals from '$lib/components/seeking/BulkActionModals.svelte';
	import EmptySeekingState from '$lib/components/seeking/EmptySeekingState.svelte';
	import SeekingCardRow from '$lib/components/seeking/SeekingCardRow.svelte';
	import InlineQuickAdd from '$lib/components/seeking/InlineQuickAdd.svelte';

	let cards = [];
	let lastChecked = {
		cardtrader: null,
		tcgplayer: null,
		ebay: null,
		manapool: null,
		cardkingdom: null,
		himarket: null,
		hareruya: null,
		ruten: null,
		cardmarket: null
	};
	let checkingStockCardKeys = new Set();
	let stockCheckToast = null;
	let stockCheckToastTimer = null;
	let nowTick = Date.now();
	let cooldownInterval = null;
	let error = null;
	let loading = true;
	let setCodeToNameMap = {};
	let unsubscribe;
	let isCondensed = false;
	let activeMenuId = null;

	// Modals state
	let showSettingsModal = false;
	let selectedCardForSettings = null;
	let showHistoricalModal = false;
	let selectedCardForHistory = null;
	let showImportModal = false;
	let isImportBusy = false;

	// Multi-select & Bulk action state
	let selectedKeys = new Set();
	let lastSelectedIndex = -1;
	let longPressTimer = null;
	let longPressTriggered = false;
	let touchStartPos = { x: 0, y: 0 };
	const LONG_PRESS_DURATION_MS = 450;
	const TOUCH_MOVE_THRESHOLD_PX = 10;
	let showBulkDeleteModal = false;
	let showBulkPriceCapModal = false;
	let bulkPriceCapInput = '';
	let isProcessingBulkAction = false;
	let bulkActionProgress = { current: 0, total: 0 };
	let autoPollTimers = [];

	// Quick filter pills & search state
	let filterInStockOnly = false;
	let filterUnderPriceCap = false;
	let filterFoilOnly = false;
	let filterSetCode = '';
	let searchQuery = '';
	let enlargedCardImage = null;
	$: previewEmpty = $page.url.searchParams.get('preview') === 'empty';

	// Sorting state
	let sortKey = 'name';
	let sortDirection = 'asc';

	// Reactive auth & marketplace flags
	$: isAuthenticated = $auth.isAuthenticated;
	$: authLoading = $auth.isLoading;
	$: accountMinCondition = ($auth.user?.settings?.minCondition || 'ANY').toUpperCase();
	$: membershipTier = $auth.user?.membershipTier || 'Basic';
	$: isLegacy = membershipTier === 'Legacy';
	$: isPremium = membershipTier === 'Premium';
	$: isPremiumOrLegacy = isPremium || isLegacy;
	$: isAdmin = Boolean($auth.user?.isAdmin);
	$: canManualCheckStock = isPremiumOrLegacy || isAdmin;
	$: showCardTrader = $auth.user?.settings?.marketplaceCardtraderEnabled ?? true;
	$: showTCGPlayer = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceTcgplayerEnabled ?? true)
		: false;
	$: showEbay = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceEbayEnabled ?? false) : false;
	$: showManapool = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceManapoolEnabled ?? true)
		: false;
	$: showCardkingdom = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceCardkingdomEnabled ?? false)
		: false;
	$: showHimarket = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceHimarketEnabled ?? false)
		: false;
	$: showHareruya = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceHareruyaEnabled ?? false)
		: false;
	$: showRuten = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceRutenEnabled ?? false)
		: false;
	$: showCardmarket = isPremiumOrLegacy
		? ($auth.user?.settings?.marketplaceCardmarketEnabled ?? false)
		: false;

	function openHistoricalModal(card) {
		selectedCardForHistory = card;
		showHistoricalModal = true;
	}

	function openSettings(card) {
		selectedCardForSettings = card;
		showSettingsModal = true;
		closeMenu();
	}

	function openImportModal() {
		if (($auth.user?.membershipTier || '').toLowerCase() === 'banned') return;
		showImportModal = true;
	}

	function toggleMenu(id, event) {
		event.stopPropagation();
		activeMenuId = activeMenuId === id ? null : id;
	}

	function closeMenu() {
		activeMenuId = null;
	}

	function isInteractiveRowTarget(target) {
		if (!target || typeof target.closest !== 'function') return false;
		return Boolean(
			target.closest('a') ||
				target.closest('button') ||
				target.closest('input') ||
				target.closest('.card-thumbnail') ||
				target.closest('.kebab-dropdown')
		);
	}

	function toggleCardSelection(card, index = -1) {
		const key = getCardKey(card);
		const newSelected = new Set(selectedKeys);
		if (newSelected.has(key)) {
			newSelected.delete(key);
		} else {
			newSelected.add(key);
		}
		selectedKeys = newSelected;
		if (index >= 0) {
			lastSelectedIndex = newSelected.size > 0 ? index : -1;
		}
	}

	function cancelLongPressTimer() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handleRowTouchStart(card, index, event) {
		if (!event.touches || event.touches.length !== 1) return;
		if (isInteractiveRowTarget(event.target)) return;

		const touch = event.touches[0];
		touchStartPos = { x: touch.clientX, y: touch.clientY };
		cancelLongPressTimer();
		longPressTriggered = false;

		longPressTimer = setTimeout(() => {
			longPressTimer = null;
			longPressTriggered = true;
			const key = getCardKey(card);
			const newSelected = new Set(selectedKeys);
			newSelected.add(key);
			selectedKeys = newSelected;
			lastSelectedIndex = index;
			if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
				try {
					navigator.vibrate(15);
				} catch (e) {
					/* Ignore vibration errors on unsupported browsers */
				}
			}
		}, LONG_PRESS_DURATION_MS);
	}

	function handleRowTouchMove(event) {
		if (!longPressTimer || !event.touches || !event.touches[0]) return;
		const touch = event.touches[0];
		const dx = Math.abs(touch.clientX - touchStartPos.x);
		const dy = Math.abs(touch.clientY - touchStartPos.y);
		if (dx > TOUCH_MOVE_THRESHOLD_PX || dy > TOUCH_MOVE_THRESHOLD_PX) {
			cancelLongPressTimer();
		}
	}

	function handleRowTouchEnd() {
		cancelLongPressTimer();
	}

	function handleRowContextMenu(event) {
		if (longPressTriggered || longPressTimer) {
			event.preventDefault();
		}
	}

	function handleRowClick(card, index, event) {
		if (longPressTriggered) {
			longPressTriggered = false;
			event.preventDefault();
			return;
		}

		if (isInteractiveRowTarget(event.target)) {
			return;
		}

		const isMac =
			typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
		const isMultiModifier = isMac ? event.metaKey : event.ctrlKey;

		if (event.shiftKey && lastSelectedIndex >= 0) {
			event.preventDefault();
			const start = Math.min(lastSelectedIndex, index);
			const end = Math.max(lastSelectedIndex, index);
			const newSelected = new Set(selectedKeys);
			for (let i = start; i <= end; i++) {
				if (sortedCards[i]) {
					newSelected.add(getCardKey(sortedCards[i]));
				}
			}
			selectedKeys = newSelected;
		} else if (isMultiModifier) {
			event.preventDefault();
			toggleCardSelection(card, index);
		} else if (selectedKeys.size > 0) {
			event.preventDefault();
			toggleCardSelection(card, index);
		}
	}

	function clearSelection() {
		selectedKeys = new Set();
		lastSelectedIndex = -1;
	}

	function selectAllFiltered() {
		selectedKeys = new Set(sortedCards.map(getCardKey));
	}

	async function handleBulkDelete() {
		if (selectedKeys.size === 0 || isProcessingBulkAction) return;
		isProcessingBulkAction = true;
		error = null;

		const cardsToDelete = cards.filter((c) => selectedKeys.has(getCardKey(c)));
		bulkActionProgress = { current: 0, total: cardsToDelete.length };

		for (const card of cardsToDelete) {
			try {
				const requestBody = {
					partitionKey: card.set_code,
					rowKey: `${card.collector_number}_${card.language}_${card.finish}`
				};
				const res = await fetchWithAuth(PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});
				if (res && res.ok) {
					cards = cards.filter((c) => getCardKey(c) !== getCardKey(card));
				} else {
					console.error(`Failed to delete card ${card.name}: HTTP ${res?.status}`);
				}
			} catch (err) {
				console.error(`Failed to delete card ${card.name}:`, err);
			}
			bulkActionProgress.current++;
			bulkActionProgress = { ...bulkActionProgress };
		}

		clearSelection();
		showBulkDeleteModal = false;
		isProcessingBulkAction = false;
	}

	async function handleBulkSetPriceCap() {
		if (selectedKeys.size === 0 || isProcessingBulkAction) return;
		isProcessingBulkAction = true;
		error = null;

		const cardsToUpdate = cards.filter((c) => selectedKeys.has(getCardKey(c)));
		bulkActionProgress = { current: 0, total: cardsToUpdate.length };

		let parsedCap = null;
		if (bulkPriceCapInput && bulkPriceCapInput.trim() !== '') {
			const floatVal = parseFloat(bulkPriceCapInput);
			if (isNaN(floatVal) || floatVal < 0) {
				error = 'Price cap must be a valid non-negative number.';
				isProcessingBulkAction = false;
				return;
			}
			parsedCap = Math.round(floatVal * 100);
		}

		for (const card of cardsToUpdate) {
			try {
				const requestBody = {
					partitionKey: card.set_code,
					rowKey: `${card.collector_number}_${card.language}_${card.finish}`,
					max_price_cap: parsedCap
				};
				const res = await fetchWithAuth(PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});
				if (res && res.ok) {
					card.max_price_cap = parsedCap;
				} else {
					console.error(`Failed to set price cap for ${card.name}: HTTP ${res?.status}`);
				}
			} catch (err) {
				console.error(`Failed to set price cap for ${card.name}:`, err);
			}
			bulkActionProgress.current++;
			bulkActionProgress = { ...bulkActionProgress };
		}

		cards = [...cards];
		clearSelection();
		showBulkPriceCapModal = false;
		isProcessingBulkAction = false;
		bulkPriceCapInput = '';
	}

	function handleGlobalKeyDown(event) {
		if (event.key === 'Escape') {
			if (enlargedCardImage) {
				enlargedCardImage = null;
			} else if (showSettingsModal) {
				showSettingsModal = false;
			} else if (showHistoricalModal) {
				showHistoricalModal = false;
			} else if (showImportModal && !isImportBusy) {
				showImportModal = false;
			} else if (showBulkDeleteModal && !isProcessingBulkAction) {
				showBulkDeleteModal = false;
			} else if (showBulkPriceCapModal && !isProcessingBulkAction) {
				showBulkPriceCapModal = false;
			} else if (selectedKeys.size > 0) {
				clearSelection();
			}
		}
	}

	function toggleCondensed() {
		isCondensed = !isCondensed;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('seeking-list-condensed', isCondensed.toString());
		}
	}

	function resetFilters() {
		filterInStockOnly = false;
		filterUnderPriceCap = false;
		filterFoilOnly = false;
		filterSetCode = '';
		searchQuery = '';
	}

	function showStockCheckFeedback(type, message) {
		stockCheckToast = { type, message };
		if (stockCheckToastTimer) clearTimeout(stockCheckToastTimer);
		stockCheckToastTimer = setTimeout(() => {
			stockCheckToast = null;
		}, 4500);
	}

	async function handleManualStockCheck(card) {
		if (!card || !canManualCheckStock) return;
		const cardKey = getCardKey(card);
		if (checkingStockCardKeys.has(cardKey)) return;

		const remainingSec = getCardCooldownRemainingSec(card, isAdmin, Date.now());
		if (remainingSec > 0) {
			showStockCheckFeedback(
				'warning',
				`${card.name} was checked recently. Available again in ${formatCooldownRemaining(remainingSec)}.`
			);
			return;
		}

		checkingStockCardKeys.add(cardKey);
		checkingStockCardKeys = new Set(checkingStockCardKeys);
		closeMenu();

		const payload = {
			action: 'check_stock',
			partitionKey: card.set_code,
			rowKey: `${card.collector_number}_${card.language}_${card.finish}`
		};

		try {
			const dedicatedUrl = publicEnv.PUBLIC_TRIGGER_STOCK_CHECK_FUNCTION_URL;
			let response = null;

			if (dedicatedUrl) {
				response = await fetchWithAuth(dedicatedUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			if (!response || response.status === 404) {
				response = await fetchWithAuth(PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			if (!response) {
				showStockCheckFeedback('error', 'Authentication failed while queuing stock check.');
				return;
			}

			let result = null;
			try {
				result = await response.json();
			} catch (e) {
				result = null;
			}

			if (response.status === 429) {
				if (result?.last_manual_check) {
					cards = cards.map((c) =>
						getCardKey(c) === cardKey ? { ...c, last_manual_check: result.last_manual_check } : c
					);
					if (selectedCardForSettings && getCardKey(selectedCardForSettings) === cardKey) {
						selectedCardForSettings = {
							...selectedCardForSettings,
							last_manual_check: result.last_manual_check
						};
					}
				}
				nowTick = Date.now();
				showStockCheckFeedback(
					'warning',
					result?.message || 'This card was checked recently. Please wait before checking again.'
				);
				return;
			}

			if (!response.ok) {
				throw new Error(result?.message || `Failed to queue stock check (Status ${response.status})`);
			}

			const checkedIso = result?.last_manual_check || new Date().toISOString();
			cards = cards.map((c) =>
				getCardKey(c) === cardKey ? { ...c, last_manual_check: checkedIso } : c
			);
			if (selectedCardForSettings && getCardKey(selectedCardForSettings) === cardKey) {
				selectedCardForSettings = {
					...selectedCardForSettings,
					last_manual_check: checkedIso
				};
			}
			nowTick = Date.now();
			showStockCheckFeedback('success', `Queued live stock check for ${card.name}.`);
			scheduleAutoPoll();
		} catch (e) {
			console.error('Error triggering manual stock check:', e);
			showStockCheckFeedback('error', e.message || 'Could not queue stock check.');
		} finally {
			checkingStockCardKeys.delete(cardKey);
			checkingStockCardKeys = new Set(checkingStockCardKeys);
		}
	}

	async function fetchScryfallSets() {
		try {
			const res = await fetch('https://api.scryfall.com/sets');
			if (res.ok) {
				const data = await res.json();
				const sets = data.data || [];
				setCodeToNameMap = sets.reduce((acc, s) => {
					if (s.code && s.name) {
						acc[s.code.toLowerCase()] = s.name;
					}
					return acc;
				}, {});
			}
		} catch (e) {
			console.error('Error fetching Scryfall sets:', e);
		}
	}

	onMount(() => {
		const storedCondensed = localStorage.getItem('seeking-list-condensed');
		if (storedCondensed !== null) {
			isCondensed = storedCondensed === 'true';
		}

		fetchScryfallSets();
		initExchangeRates();
		cooldownInterval = setInterval(() => {
			nowTick = Date.now();
		}, 15000);

		let hasFetchedInitialList = false;
		unsubscribe = auth.subscribe((state) => {
			if (!state.isLoading) {
				if (state.isAuthenticated) {
					if (!hasFetchedInitialList) {
						hasFetchedInitialList = true;
						fetchSeekingList();
					}
				} else {
					hasFetchedInitialList = false;
					error = 'Please log in to view your seeking list.';
					loading = false;
				}
			}
		});
	});

	function clearAutoPollTimers() {
		autoPollTimers.forEach((timerId) => clearTimeout(timerId));
		autoPollTimers = [];
	}

	function scheduleAutoPoll() {
		clearAutoPollTimers();
		// Automatically refresh cards at t+6s, t+15s, and t+30s in the background
		const pollDelays = [6000, 15000, 30000];
		pollDelays.forEach((delay) => {
			const timerId = setTimeout(async () => {
				await fetchSeekingList(true);
			}, delay);
			autoPollTimers.push(timerId);
		});
	}

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
		if (cooldownInterval) {
			clearInterval(cooldownInterval);
		}
		if (stockCheckToastTimer) {
			clearTimeout(stockCheckToastTimer);
		}
		clearAutoPollTimers();
	});

	async function fetchSeekingList(silent = false) {
		if (!silent) {
			loading = true;
		}
		error = null;

		try {
			const response = await fetchWithAuth(PUBLIC_GET_SEEKING_LIST_FUNCTION_URL);

			if (!response) {
				if (!silent) {
					error = 'Authentication failed while fetching seeking list.';
				}
				console.error('Authentication failed while fetching seeking list.');
				return;
			}

			if (!response.ok) {
				let errorBody = await response.text();
				try {
					errorBody = JSON.parse(errorBody);
				} catch (e) {
					/* Ignore */
				}
				console.error('Fetch error response:', errorBody);
				throw new Error(`Failed to fetch seeking list (Status: ${response.status})`);
			}

			const data = await response.json();
			cards = data.cards;
			if (data.lastChecked) {
				lastChecked = {
					cardtrader: data.lastChecked.cardtrader || null,
					tcgplayer: data.lastChecked.tcgplayer || null,
					ebay: data.lastChecked.ebay || null,
					manapool: data.lastChecked.manapool || null,
					cardkingdom: data.lastChecked.cardkingdom || null,
					himarket: data.lastChecked.himarket || null,
					hareruya: data.lastChecked.hareruya || null,
					ruten: data.lastChecked.ruten || null,
					cardmarket: data.lastChecked.cardmarket || null
				};
			}
		} catch (e) {
			if (!silent) {
				error = e.message;
			}
			console.error('Error fetching cards:', e);
		} finally {
			if (!silent) {
				loading = false;
			}
		}
	}

	async function handleDelete(card) {
		error = null;
		try {
			const requestBody = {
				partitionKey: card.set_code,
				rowKey: `${card.collector_number}_${card.language}_${card.finish}`
			};
			const response = await fetchWithAuth(PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response) {
				error = 'Authentication failed while attempting to delete card.';
				return;
			}

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Failed to delete card (Status: ${response.status}): ${text}`);
			}

			cards = cards.filter(
				(c) =>
					!(
						c.set_code === card.set_code &&
						c.collector_number === card.collector_number &&
						c.language === card.language &&
						c.finish === card.finish
					)
			);
		} catch (e) {
			error = `Delete failed: ${e.message}`;
			console.error('Error deleting card:', e);
		}
	}

	function sortBy(key) {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'asc';
		}
	}

	$: availableSetCodes = [...new Set(cards.map((c) => c.set_code.toUpperCase()))].sort();

	$: filteredCards = cards.filter((card) => {
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const matchesQuery =
				card.name.toLowerCase().includes(query) ||
				card.set_code.toLowerCase().includes(query) ||
				card.language.toLowerCase().includes(query) ||
				card.finish.toLowerCase().includes(query);
			if (!matchesQuery) return false;
		}

		if (filterFoilOnly && card.finish.toLowerCase() !== 'foil') {
			return false;
		}

		if (filterSetCode && card.set_code.toUpperCase() !== filterSetCode.toUpperCase()) {
			return false;
		}

		if (filterInStockOnly) {
			const hasStock =
				(showCardTrader && card.cardtrader_stock === true) ||
				(showTCGPlayer && card.tcgplayer_stock === true) ||
				(showEbay && card.ebay_stock === true) ||
				(showManapool && card.manapool_stock === true) ||
				(showCardkingdom && card.cardkingdom_stock === true) ||
				(showHimarket && card.himarket_stock === true) ||
				(showHareruya && card.hareruya_stock === true) ||
				(showRuten &&
					['zht', 'en'].includes((card.language || '').toLowerCase()) &&
					card.ruten_stock === true) ||
				(showCardmarket && card.cardmarket_stock === true);
			if (!hasStock) return false;
		}

		if (filterUnderPriceCap) {
			if (card.max_price_cap === null || card.max_price_cap === undefined) return false;
			const cap = card.max_price_cap;
			const prices = [];
			if (showCardTrader && card.cardtrader_low_price > 0) prices.push(card.cardtrader_low_price);
			if (
				showTCGPlayer &&
				card.tcgplayer_low_price > 0 &&
				getStockStatus(card.tcgplayer_stock) === 'available'
			) {
				prices.push(Math.round(card.tcgplayer_low_price * 100));
			}
			if (showEbay && card.ebay_low_price > 0 && getStockStatus(card.ebay_stock) === 'available') {
				prices.push(card.ebay_low_price);
			}
			if (
				showManapool &&
				card.manapool_low_price > 0 &&
				getStockStatus(card.manapool_stock) === 'available'
			) {
				prices.push(card.manapool_low_price);
			}
			if (
				showCardkingdom &&
				card.cardkingdom_low_price > 0 &&
				getStockStatus(card.cardkingdom_stock) === 'available'
			) {
				prices.push(card.cardkingdom_low_price);
			}
			if (
				showHimarket &&
				card.himarket_low_price > 0 &&
				getStockStatus(card.himarket_stock) === 'available'
			) {
				prices.push(card.himarket_low_price);
			}
			if (
				showHareruya &&
				card.hareruya_low_price > 0 &&
				getStockStatus(card.hareruya_stock) === 'available'
			) {
				prices.push(card.hareruya_low_price);
			}
			if (
				showRuten &&
				['zht', 'en'].includes((card.language || '').toLowerCase()) &&
				card.ruten_low_price > 0 &&
				getStockStatus(card.ruten_stock) === 'available'
			) {
				prices.push(card.ruten_low_price);
			}
			if (
				showCardmarket &&
				card.cardmarket_low_price > 0 &&
				getStockStatus(card.cardmarket_stock) === 'available'
			) {
				prices.push(card.cardmarket_low_price);
			}
			const hasPriceUnderCap = prices.some((p) => p <= cap);
			if (!hasPriceUnderCap) return false;
		}

		return true;
	});

	$: sortedCards = [...filteredCards].sort((a, b) => {
		let aValue = a[sortKey];
		let bValue = b[sortKey];

		if (sortKey === 'best_price') {
			const getBest = (card) => {
				const info = getLowestOffer(
					card,
					showCardTrader,
					showTCGPlayer,
					showEbay,
					showManapool,
					showHimarket,
					showHareruya,
					showRuten,
					showCardmarket,
					showCardkingdom
				);
				return info.minPriceCents;
			};
			aValue = getBest(a) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
			bValue = getBest(b) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
		} else if (sortKey.includes('_price')) {
			const normalizePrice = (card, val) => {
				if (val === null || val === undefined || val <= 0) return null;
				if (
					sortKey === 'tcgplayer_low_price' &&
					getStockStatus(card.tcgplayer_stock) !== 'available'
				) {
					return null;
				}
				return val;
			};
			aValue = normalizePrice(a, aValue) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
			bValue = normalizePrice(b, bValue) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
		} else if (sortKey.includes('_stock')) {
			const stockOrder = { available: 1, unknown: 0, unavailable: -1 };
			aValue = stockOrder[getStockStatus(aValue)] ?? 0;
			bValue = stockOrder[getStockStatus(bValue)] ?? 0;
		} else if (typeof aValue === 'string' && typeof bValue === 'string') {
			aValue = aValue.toLowerCase();
			bValue = bValue.toLowerCase();
		}

		let comparison = 0;
		if (aValue > bValue) {
			comparison = 1;
		} else if (aValue < bValue) {
			comparison = -1;
		}

		return sortDirection === 'asc' ? comparison : comparison * -1;
	});

	let displayLimit = 100;
	let scrollY = 0;
	$: showBackToTop = scrollY > 400;

	let tableContainerEl;
	let isHeaderPinned = false;
	let pinnedCheckRaf = null;
	let cachedNavHeight = null;

	function checkHeaderPinned() {
		if (!tableContainerEl || typeof window === 'undefined') {
			isHeaderPinned = false;
			return;
		}
		if (pinnedCheckRaf) return;
		pinnedCheckRaf = requestAnimationFrame(() => {
			pinnedCheckRaf = null;
			if (!tableContainerEl) return;
			const rect = tableContainerEl.getBoundingClientRect();
			if (cachedNavHeight === null) {
				const navEl = document.querySelector('nav');
				cachedNavHeight = navEl ? navEl.offsetHeight : 64;
			}
			isHeaderPinned = rect.top <= cachedNavHeight + 1 && rect.bottom > cachedNavHeight;
		});
	}

	$: if (scrollY !== undefined || tableContainerEl) {
		checkHeaderPinned();
	}

	$: if (
		searchQuery ||
		filterInStockOnly ||
		filterUnderPriceCap ||
		filterFoilOnly ||
		filterSetCode ||
		sortKey ||
		sortDirection
	) {
		displayLimit = 100;
	}

	$: displayedCards = sortedCards.slice(0, displayLimit);

	function loadAllCards() {
		displayLimit = sortedCards.length;
	}

	function setupObserver(node) {
		if (typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && displayLimit < sortedCards.length) {
					displayLimit = Math.min(displayLimit + 100, sortedCards.length);
				}
			},
			{ rootMargin: '400px' }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	$: inStockSummary = filteredCards.reduce(
		(acc, card) => {
			const offer = getLowestOffer(
				card,
				showCardTrader,
				showTCGPlayer,
				showEbay,
				showManapool,
				showHimarket,
				showHareruya,
				showRuten,
				showCardmarket,
				showCardkingdom
			);
			if (offer.minPriceCents !== null) {
				acc.inStockCount += 1;
				acc.totalLowestCents += offer.minPriceCents;
			}
			return acc;
		},
		{ inStockCount: 0, totalLowestCents: 0 }
	);

	$: selectedCostSummary = cards
		.filter((c) => selectedKeys.has(getCardKey(c)))
		.reduce(
			(acc, card) => {
				const offer = getLowestOffer(
					card,
					showCardTrader,
					showTCGPlayer,
					showEbay,
					showManapool,
					showHimarket,
					showHareruya,
					showRuten,
					showCardmarket,
					showCardkingdom
				);
				if (offer.minPriceCents !== null) {
					acc.inStockCount += 1;
					acc.totalLowestCents += offer.minPriceCents;
				}
				return acc;
			},
			{ inStockCount: 0, totalLowestCents: 0 }
		);

	function downloadCSV(customCards = null) {
		const targetCards =
			customCards ||
			(selectedKeys.size > 0
				? sortedCards.filter((c) => selectedKeys.has(getCardKey(c)))
				: sortedCards);

		if (!targetCards || targetCards.length === 0) {
			showStockCheckFeedback('warning', 'No cards to export.');
			return;
		}

		const csvString = buildSeekingCsvString(targetCards);
		const blob = new Blob([csvString], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'seeking_list.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		showStockCheckFeedback(
			'success',
			`Exported ${targetCards.length} card${targetCards.length === 1 ? '' : 's'} to CSV`
		);
	}

	let isCopiedDecklist = false;
	let copyDecklistTimer = null;

	async function copyDecklistToClipboard(customCards = null) {
		const targetCards =
			customCards ||
			(selectedKeys.size > 0
				? sortedCards.filter((c) => selectedKeys.has(getCardKey(c)))
				: sortedCards);

		if (!targetCards || targetCards.length === 0) {
			showStockCheckFeedback('warning', 'No cards to copy.');
			return;
		}

		const text = targetCards.map(formatCardAsDecklistLine).filter(Boolean).join('\n');

		let success = false;
		if (navigator?.clipboard?.writeText) {
			try {
				await navigator.clipboard.writeText(text);
				success = true;
			} catch (err) {
				console.warn('navigator.clipboard.writeText failed, falling back:', err);
			}
		}

		if (!success) {
			try {
				const textarea = document.createElement('textarea');
				textarea.value = text;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				success = document.execCommand('copy');
				document.body.removeChild(textarea);
			} catch (fallbackErr) {
				console.error('Fallback clipboard copy failed:', fallbackErr);
			}
		}

		if (success) {
			isCopiedDecklist = true;
			if (copyDecklistTimer) clearTimeout(copyDecklistTimer);
			copyDecklistTimer = setTimeout(() => {
				isCopiedDecklist = false;
			}, 2500);

			showStockCheckFeedback(
				'success',
				`Copied ${targetCards.length} card${targetCards.length === 1 ? '' : 's'} to clipboard as decklist!`
			);
		} else {
			showStockCheckFeedback('error', 'Failed to copy decklist to clipboard.');
		}
	}
</script>

<svelte:window
	on:click={closeMenu}
	on:keydown={handleGlobalKeyDown}
	on:resize={checkHeaderPinned}
	bind:scrollY={scrollY}
/>

{#if ($auth.user?.membershipTier || '').toLowerCase() === 'banned'}
	<div class="seeking-suspended-banner">
		<i class="fa-solid fa-triangle-exclamation"></i>
		<div class="suspended-banner-content">
			<strong>Account Suspended</strong>
			<span>Your account has been suspended by an administrator. Stock checks are disabled and you cannot add new cards.</span>
		</div>
	</div>
{/if}

{#if isAuthenticated && !authLoading && !loading}
	<InlineQuickAdd
		disabled={($auth.user?.membershipTier || '').toLowerCase() === 'banned'}
		on:added={(e) => {
			fetchSeekingList(true);
			scheduleAutoPoll();
			showStockCheckFeedback('success', `Added "${e.detail.cardName}" to your seeking list!`);
		}}
	/>
{/if}

<div class="workspace-toolbar">
	<div class="toolbar-left">
		<div class="search-box">
			<i class="fa-solid fa-magnifying-glass search-icon"></i>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Filter cards..."
				class="search-input"
			/>
			{#if searchQuery}
				<button class="clear-btn" on:click={() => (searchQuery = '')} title="Clear filter">
					<i class="fa-solid fa-times"></i>
				</button>
			{/if}
		</div>

		<div class="filter-group">
			<button
				type="button"
				class="filter-pill"
				class:active={filterInStockOnly}
				on:click={() => (filterInStockOnly = !filterInStockOnly)}
			>
				<i class="fa-solid fa-circle-check"></i> In Stock
			</button>
			<button
				type="button"
				class="filter-pill"
				class:active={filterUnderPriceCap}
				on:click={() => (filterUnderPriceCap = !filterUnderPriceCap)}
			>
				<i class="fa-solid fa-tag"></i> Under Cap
			</button>
			<button
				type="button"
				class="filter-pill"
				class:active={filterFoilOnly}
				on:click={() => (filterFoilOnly = !filterFoilOnly)}
			>
				<i class="fa-solid fa-sparkles"></i> Foil
			</button>
			{#if availableSetCodes.length > 0}
				<select bind:value={filterSetCode} class="set-select" aria-label="Filter by Set">
					<option value="">All Sets ({availableSetCodes.length})</option>
					{#each availableSetCodes as code}
						<option value={code}>{code}</option>
					{/each}
				</select>
			{/if}
			{#if filterInStockOnly || filterUnderPriceCap || filterFoilOnly || filterSetCode || searchQuery}
				<button
					type="button"
					class="filter-pill reset"
					on:click={resetFilters}
					title="Reset all filters"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{/if}
		</div>
	</div>

	<div class="toolbar-right">
		{#if inStockSummary.inStockCount > 0}
			<button
				type="button"
				class="cost-summary-badge"
				class:active={filterInStockOnly}
				on:click={() => (filterInStockOnly = !filterInStockOnly)}
				title="Estimated lowest total across {inStockSummary.inStockCount} in-stock card(s) in current view. Click to toggle In Stock filter."
			>
				<i class="fa-solid fa-sack-dollar"></i>
				<span>
					Est. <strong>{formatPrice(inStockSummary.totalLowestCents)}</strong>
					<small>({inStockSummary.inStockCount} in stock)</small>
				</span>
			</button>
		{/if}

		<div class="card-counter" title="Total sought cards">
			<i class="fa-solid fa-layer-group"></i>
			<span>
				{#if ($auth.user?.membershipTier || '').toLowerCase() === 'banned'}
					<span class="suspended-tag">Suspended</span>
				{:else if isLegacy}
					<strong>{cards.length}</strong> cards
				{:else if isPremium}
					<strong>{cards.length}</strong> / 150 cards
				{:else}
					<strong>{cards.length}</strong> / 25 cards
				{/if}
			</span>
		</div>

		<div class="view-buttons">
			<button
				type="button"
				class="toolbar-import-btn"
				on:click={openImportModal}
				disabled={($auth.user?.membershipTier || '').toLowerCase() === 'banned'}
				title="Import cards from a Moxfield deck URL or text decklist"
			>
				<i class="fa-solid fa-file-import"></i>
				<span>Import</span>
			</button>
			<button
				type="button"
				class="toolbar-icon-btn"
				on:click={() => copyDecklistToClipboard()}
				class:copied={isCopiedDecklist}
				title={selectedKeys.size > 0
					? `Copy ${selectedKeys.size} selected cards as Decklist (Moxfield / Text format)`
					: sortedCards.length < cards.length
						? `Copy ${sortedCards.length} filtered cards as Decklist (Moxfield / Text format)`
						: 'Copy as Decklist (Moxfield / Text format)'}
			>
				<i class="fa-solid {isCopiedDecklist ? 'fa-check' : 'fa-copy'}"></i>
			</button>
			<button
				type="button"
				class="toolbar-icon-btn"
				on:click={() => downloadCSV()}
				title={selectedKeys.size > 0
					? `Export ${selectedKeys.size} selected cards as CSV`
					: sortedCards.length < cards.length
						? `Export ${sortedCards.length} filtered cards as CSV`
						: 'Export CSV'}
			>
				<i class="fa-solid fa-file-csv"></i>
			</button>
			<button
				type="button"
				on:click={toggleCondensed}
				class="toolbar-icon-btn"
				class:active={isCondensed}
				title={isCondensed ? 'Switch to expanded view (all stores)' : 'Switch to compact view (best price)'}
			>
				<i class="fa-solid {isCondensed ? 'fa-table-columns' : 'fa-compress'}"></i>
			</button>
		</div>
	</div>
</div>

{#if stockCheckToast}
	<div class="stock-check-toast {stockCheckToast.type}" role="status">
		<i
			class="fa-solid {stockCheckToast.type === 'success'
				? 'fa-circle-check'
				: stockCheckToast.type === 'warning'
					? 'fa-clock'
					: 'fa-circle-exclamation'}"
		></i>
		<span>{stockCheckToast.message}</span>
		<button
			type="button"
			class="toast-dismiss-btn"
			aria-label="Dismiss notification"
			on:click={() => (stockCheckToast = null)}
		>
			<i class="fa-solid fa-xmark"></i>
		</button>
	</div>
{/if}

{#if enlargedCardImage}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => (enlargedCardImage = null)}>
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
		<img
			src={enlargedCardImage}
			alt="Enlarged card"
			class="enlarged-card"
			on:click|stopPropagation
		/>
	</div>
{/if}

{#if authLoading || loading}
	<div class="loading">Loading seeking list...</div>
{:else if error}
	<div class="error">{error}</div>
{:else if !isAuthenticated}
	<div class="empty">Please log in to view your seeking list.</div>
{:else if cards.length === 0 || previewEmpty}
	<EmptySeekingState on:openImport={() => (showImportModal = true)} />
{:else if sortedCards.length === 0}
	<div class="seeking-list">
		<div class="empty-filter-state">
			<div class="empty-filter-icon">
				<i class="fa-solid fa-filter-circle-xmark"></i>
			</div>
			<h3>No matching cards found</h3>
			<p>No cards on your seeking list match your active search or filter settings.</p>
			<button type="button" class="clear-filters-btn" on:click={resetFilters}>
				<i class="fa-solid fa-rotate-left"></i> Reset Filters
			</button>
		</div>
	</div>
{:else}
	<div class="seeking-list">
		<div class="table-scroll-container" class:is-pinned={isHeaderPinned} bind:this={tableContainerEl}>
			<table>
				<thead>
					<tr>
						<th class="col-card" on:click={() => sortBy('name')} class:active={sortKey === 'name'}>
							<span class="th-header-wrap">
								Card
								{#if sortKey === 'name'}
									<i
										class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
									></i>
								{/if}
							</span>
						</th>
						<th class="col-set" on:click={() => sortBy('set_code')} class:active={sortKey === 'set_code'} title="Set">
							<span class="th-header-wrap">
								Set
								{#if sortKey === 'set_code'}
									<i
										class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
									></i>
								{/if}
							</span>
						</th>
						<th class="col-lang" on:click={() => sortBy('language')} class:active={sortKey === 'language'} title="Language">
							<span class="th-header-wrap">
								Lang
								{#if sortKey === 'language'}
									<i
										class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
									></i>
								{/if}
							</span>
						</th>
						<th class="col-finish" on:click={() => sortBy('finish')} class:active={sortKey === 'finish'} title="Finish">
							<span class="th-header-wrap">
								Finish
								{#if sortKey === 'finish'}
									<i
										class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
									></i>
								{/if}
							</span>
						</th>
						{#if isCondensed}
						<th
							class="th-vendor col-vendor col-best-price"
							on:click={() => sortBy('best_price')}
							class:active={sortKey === 'best_price'}
							title="Sort by lowest price available across all enabled stores"
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									Best Price
									{#if sortKey === 'best_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
							</div>
						</th>
						{:else}
						{#if showCardTrader}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('cardtrader_low_price')}
							class:active={sortKey === 'cardtrader_low_price'}
							title={lastChecked.cardtrader ? `CardTrader last checked: ${formatExactTimestamp(lastChecked.cardtrader)}` : 'CardTrader stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									CardTrader
									{#if sortKey === 'cardtrader_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.cardtrader, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.cardtrader, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showTCGPlayer}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('tcgplayer_low_price')}
							class:active={sortKey === 'tcgplayer_low_price'}
							title={lastChecked.tcgplayer ? `TCGPlayer last checked: ${formatExactTimestamp(lastChecked.tcgplayer)}` : 'TCGPlayer stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									TCGPlayer
									{#if sortKey === 'tcgplayer_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.tcgplayer, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.tcgplayer, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showManapool}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('manapool_low_price')}
							class:active={sortKey === 'manapool_low_price'}
							title={lastChecked.manapool ? `Mana Pool last checked: ${formatExactTimestamp(lastChecked.manapool)}` : 'Mana Pool stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									Mana Pool
									{#if sortKey === 'manapool_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.manapool, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.manapool, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showCardkingdom}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('cardkingdom_low_price')}
							class:active={sortKey === 'cardkingdom_low_price'}
							title={lastChecked.cardkingdom ? `Card Kingdom last checked: ${formatExactTimestamp(lastChecked.cardkingdom)}` : 'Card Kingdom stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									Card Kingdom
									{#if sortKey === 'cardkingdom_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.cardkingdom, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.cardkingdom, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showCardmarket}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('cardmarket_low_price')}
							class:active={sortKey === 'cardmarket_low_price'}
							title={lastChecked.cardmarket ? `CardMarket last checked: ${formatExactTimestamp(lastChecked.cardmarket)}` : 'CardMarket stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									CardMarket
									{#if sortKey === 'cardmarket_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.cardmarket, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.cardmarket, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showEbay}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('ebay_low_price')}
							class:active={sortKey === 'ebay_low_price'}
							title={lastChecked.ebay ? `eBay last checked: ${formatExactTimestamp(lastChecked.ebay)}` : 'eBay stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									eBay
									{#if sortKey === 'ebay_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.ebay, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.ebay, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showHimarket}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('himarket_low_price')}
							class:active={sortKey === 'himarket_low_price'}
							title={lastChecked.himarket ? `HiMarket last checked: ${formatExactTimestamp(lastChecked.himarket)}` : 'HiMarket stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									HiMarket
									{#if sortKey === 'himarket_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.himarket, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.himarket, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showHareruya}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('hareruya_low_price')}
							class:active={sortKey === 'hareruya_low_price'}
							title={lastChecked.hareruya ? `Hareruya last checked: ${formatExactTimestamp(lastChecked.hareruya)}` : 'Hareruya stock & lowest price'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									Hareruya
									{#if sortKey === 'hareruya_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.hareruya, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.hareruya, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{#if showRuten}
						<th
							class="th-vendor col-vendor"
							on:click={() => sortBy('ruten_low_price')}
							class:active={sortKey === 'ruten_low_price'}
							title={lastChecked.ruten ? `Ruten last checked: ${formatExactTimestamp(lastChecked.ruten)}` : 'Ruten stock & lowest price (ZHT & EN only)'}
						>
							<div class="th-vendor-wrap">
								<span class="th-vendor-title">
									Ruten
									{#if sortKey === 'ruten_low_price'}
										<i
											class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
										></i>
									{/if}
								</span>
								{#if formatRelativeTime(lastChecked.ruten, nowTick)}
									<span class="th-last-checked">
										<i class="fa-regular fa-clock"></i> {formatRelativeTime(lastChecked.ruten, nowTick)}
									</span>
								{/if}
							</div>
						</th>
						{/if}
						{/if}
						<th class="actions-header col-actions"></th>
					</tr>
				</thead>
				<tbody>
					{#each displayedCards as card, index (getCardKey(card))}
						{@const cardKey = getCardKey(card)}
						{@const histBadge = getCardHistoricalBadgeInfo(
							card,
							showCardTrader,
							showTCGPlayer,
							showEbay,
							showManapool,
							showHimarket,
							showHareruya,
							showRuten,
							showCardmarket,
							accountMinCondition,
							nowTick,
							showCardkingdom
						)}
						{@const cooldownSec = getCardCooldownRemainingSec(card, isAdmin, nowTick)}
						{@const isCheckingCard = checkingStockCardKeys.has(cardKey)}
						<SeekingCardRow
							{card}
							{index}
							{isCondensed}
							isSelected={selectedKeys.has(cardKey)}
							isMenuOpen={activeMenuId === cardKey}
							isDropUp={index >= displayedCards.length - 2}
							{histBadge}
							{showCardTrader}
							{showTCGPlayer}
							{showEbay}
							{showManapool}
							{showCardkingdom}
							{showHimarket}
							{showHareruya}
							{showRuten}
							{showCardmarket}
							{setCodeToNameMap}
							{canManualCheckStock}
							{isAdmin}
							{isCheckingCard}
							{cooldownSec}
							{isAuthenticated}
							on:rowClick={(e) => handleRowClick(card, index, e.detail)}
							on:rowTouchStart={(e) => handleRowTouchStart(card, index, e.detail)}
							on:rowTouchMove={(e) => handleRowTouchMove(e.detail)}
							on:rowTouchEnd={handleRowTouchEnd}
							on:rowContextMenu={(e) => handleRowContextMenu(e.detail)}
							on:toggleMenu={(e) => toggleMenu(cardKey, e.detail)}
							on:closeMenu={closeMenu}
							on:toggleSelect={() => toggleCardSelection(card, index)}
							on:manualStockCheck={() => handleManualStockCheck(card)}
							on:copyLine={() => copyDecklistToClipboard([card])}
							on:openHistory={() => openHistoricalModal(card)}
							on:openSettings={() => openSettings(card)}
							on:deleteCard={() => handleDelete(card)}
							on:enlargeImage={(e) => (enlargedCardImage = e.detail)}
						/>
					{/each}
				</tbody>
		</table>
		{#if displayedCards.length < sortedCards.length}
			<div class="list-load-trigger" use:setupObserver>
				<span class="load-status-text">
					Showing <strong>{displayedCards.length}</strong> of <strong>{sortedCards.length}</strong> cards
				</span>
				<button type="button" class="load-all-btn" on:click={loadAllCards}>
					Load all ({sortedCards.length})
				</button>
			</div>
		{/if}
	</div>
</div>
{/if}

{#if showBackToTop}
	<button
		type="button"
		class="scroll-top-btn"
		on:click={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
		title="Scroll to top"
		aria-label="Scroll to top"
	>
		<i class="fa-solid fa-arrow-up"></i>
	</button>
{/if}

<HistoricalPriceModal
	show={showHistoricalModal}
	card={selectedCardForHistory}
	{nowTick}
	onClose={() => (showHistoricalModal = false)}
	onEditCard={(targetCard) => openSettings(targetCard)}
/>

<EditCardModal
	show={showSettingsModal}
	card={selectedCardForSettings}
	{cards}
	{accountMinCondition}
	{canManualCheckStock}
	{isAdmin}
	{checkingStockCardKeys}
	{nowTick}
	onClose={() => (showSettingsModal = false)}
	onCardUpdated={(updatedCards) => {
		cards = updatedCards;
	}}
	onManualStockCheck={(targetCard) => handleManualStockCheck(targetCard)}
/>

<DecklistImportModal
	show={showImportModal}
	{cards}
	{setCodeToNameMap}
	{isPremiumOrLegacy}
	{membershipTier}
	preferredFinish={$auth.user?.settings?.preferredFinish || 'nonfoil'}
	preferredLanguage={$auth.user?.settings?.preferredLanguage || 'en'}
	bind:isBusy={isImportBusy}
	onClose={() => (showImportModal = false)}
	onCardsAdded={(addedCards) => {
		cards = [...cards, ...addedCards];
		scheduleAutoPoll();
	}}
/>

<BulkActionModals
	selectedCount={selectedKeys.size}
	totalFilteredCount={sortedCards.length}
	{selectedCostSummary}
	bind:showBulkPriceCapModal
	bind:showBulkDeleteModal
	bind:bulkPriceCapInput
	{isProcessingBulkAction}
	{bulkActionProgress}
	onCopySelected={() => copyDecklistToClipboard()}
	onExportCsvSelected={() => downloadCSV()}
	onSelectAllFiltered={selectAllFiltered}
	onClearSelection={clearSelection}
	onConfirmBulkPriceCap={handleBulkSetPriceCap}
	onConfirmBulkDelete={handleBulkDelete}
/>

<style>
	.seeking-list {
		margin: 1rem auto 2.5rem auto;
		max-width: 1540px;
		padding: 0 1rem;
		box-sizing: border-box;
		width: 100%;
		animation: fadeIn 0.5s ease-out;
	}

	.seeking-suspended-banner {
		margin: 1.25rem auto 0.5rem auto;
		width: calc(100% - 2rem);
		max-width: calc(1540px - 2rem);
		box-sizing: border-box;
		padding: 0.85rem 1.25rem;
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.35);
		border-radius: 12px;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		color: var(--color-text-primary);
	}

	.seeking-suspended-banner i {
		font-size: 1.35rem;
		color: #ef4444;
		flex-shrink: 0;
	}

	.suspended-banner-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.875rem;
	}

	.suspended-banner-content strong {
		color: #ef4444;
	}

	.suspended-banner-content span {
		color: var(--color-text-secondary);
	}

	.suspended-tag {
		color: #ef4444;
		font-weight: 700;
	}

	/* Workspace Toolbar */
	.workspace-toolbar {
		margin: 1.25rem auto 1rem auto;
		width: calc(100% - 2rem);
		max-width: calc(1540px - 2rem);
		box-sizing: border-box;
		padding: 0.65rem 1rem;
		background: var(--glass-bg);
		backdrop-filter: blur(var(--backdrop-blur));
		-webkit-backdrop-filter: blur(var(--backdrop-blur));
		border: 1px solid var(--glass-border);
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		flex: 1;
		min-width: 0;
	}

	.search-box {
		display: flex;
		align-items: center;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0 0.6rem;
		height: 36px;
		gap: 0.5rem;
		box-sizing: border-box;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.search-box:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(99, 102, 241, 0.2));
	}

	.search-icon {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.search-input {
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		font-size: 0.85rem;
		outline: none;
		width: 150px;
		min-width: 0;
		transition: width var(--transition-normal);
	}

	.search-input:focus {
		width: 200px;
	}

	.clear-btn {
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
	}

	.clear-btn:hover {
		color: var(--color-text-primary);
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.filter-pill {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		padding: 0 0.7rem;
		height: 34px;
		border-radius: 8px;
		font-size: 0.8rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all var(--transition-fast);
		font-weight: 500;
	}

	.filter-pill:hover {
		border-color: var(--color-primary);
		color: var(--color-text-primary);
	}

	.filter-pill.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: #ffffff;
	}

	.filter-pill.reset {
		background: transparent;
		border: 1px dashed var(--color-border);
		padding: 0 0.55rem;
	}

	.filter-pill.reset:hover {
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.set-select {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		padding: 0 0.65rem;
		height: 34px;
		border-radius: 8px;
		font-size: 0.8rem;
		cursor: pointer;
		outline: none;
		font-weight: 500;
		transition: border-color var(--transition-fast);
	}

	.set-select:focus {
		border-color: var(--color-primary);
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.card-counter {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.825rem;
		color: var(--color-text-muted);
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		padding: 0 0.75rem;
		height: 34px;
		border-radius: 8px;
		font-weight: 500;
	}

	.card-counter strong {
		color: var(--color-text-primary);
		font-weight: 700;
	}

	.view-buttons {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.toolbar-import-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 36px;
		padding: 0 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--color-primary);
		background: rgba(99, 102, 241, 0.12);
		color: var(--color-primary);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.toolbar-import-btn:hover:not(:disabled) {
		background: var(--color-primary);
		color: #fff;
		transform: translateY(-1px);
	}

	.toolbar-import-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toolbar-icon-btn {
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.875rem;
		transition: all var(--transition-fast);
	}

	.toolbar-icon-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: var(--color-bg-hover, rgba(255, 255, 255, 0.04));
	}

	.toolbar-icon-btn.active {
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.15));
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.toolbar-icon-btn.copied {
		background: rgba(16, 185, 129, 0.15);
		border-color: #10b981;
		color: #10b981;
	}

	.cost-summary-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		height: 36px;
		padding: 0 0.75rem;
		border-radius: 8px;
		border: 1px solid rgba(16, 185, 129, 0.4);
		background: rgba(16, 185, 129, 0.1);
		color: var(--color-text-primary);
		font-size: 0.82rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.cost-summary-badge i {
		color: #10b981;
	}

	.cost-summary-badge strong {
		color: #10b981;
		font-weight: 700;
	}

	.cost-summary-badge small {
		color: var(--color-text-secondary);
		font-size: 0.74rem;
		margin-left: 0.15rem;
	}

	.cost-summary-badge:hover,
	.cost-summary-badge.active {
		border-color: #10b981;
		background: rgba(16, 185, 129, 0.18);
		transform: translateY(-1px);
	}

	@media (max-width: 768px) {
		.seeking-list {
			margin: 0.75rem auto 2rem auto;
			padding: 0 0.75rem;
		}

		.seeking-suspended-banner,
		.workspace-toolbar,
		.stock-check-toast {
			width: calc(100% - 1.5rem);
			max-width: none;
		}

		.workspace-toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 0.65rem;
			padding: 0.75rem;
			margin: 0.85rem auto 0.75rem auto;
		}

		.toolbar-left {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
			width: 100%;
		}

		.search-box {
			width: 100%;
		}

		.search-input,
		.search-input:focus {
			width: 100%;
			flex: 1;
		}

		.filter-group {
			display: flex;
			flex-wrap: wrap;
			gap: 0.4rem;
			width: 100%;
		}

		.filter-pill {
			flex: 1 1 auto;
			justify-content: center;
			padding: 0 0.6rem;
			font-size: 0.78rem;
			min-width: 0;
		}

		.set-select {
			flex: 1 1 110px;
			min-width: 0;
			max-width: 100%;
			font-size: 0.78rem;
		}

		.toolbar-right {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
		}

		.cost-summary-badge {
			flex: 1 1 100%;
			justify-content: center;
			box-sizing: border-box;
		}

		.card-counter {
			font-size: 0.78rem;
			padding: 0 0.65rem;
			height: 34px;
		}

		.view-buttons {
			margin-left: auto;
		}
	}

	.table-scroll-container {
		width: 100%;
		overflow-x: auto;
		overflow-y: clip;
		overflow: auto clip;
		-webkit-overflow-scrolling: touch;
		border-radius: 12px;
		background: var(--glass-bg);
		backdrop-filter: blur(var(--backdrop-blur));
		-webkit-backdrop-filter: blur(var(--backdrop-blur));
		border: 1px solid var(--glass-border);
		box-shadow: var(--glass-shadow);
		margin-top: 1rem;
		position: relative;
	}

	table {
		width: 100%;
		min-width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		background: transparent;
		border: none;
		margin-top: 0;
		box-shadow: none;
		table-layout: fixed;
	}

	.table-scroll-container.is-pinned {
		border-top-left-radius: 0;
		border-top-right-radius: 0;
	}

	table thead tr:first-child th:first-child {
		border-top-left-radius: 11px;
	}

	table thead tr:first-child th:last-child {
		border-top-right-radius: 11px;
	}

	.table-scroll-container.is-pinned table thead tr:first-child th:first-child,
	.table-scroll-container.is-pinned table thead tr:first-child th:last-child {
		border-top-left-radius: 0;
		border-top-right-radius: 0;
	}

	table tbody tr:last-child td:first-child {
		border-bottom-left-radius: 11px;
	}

	table tbody tr:last-child td:last-child {
		border-bottom-right-radius: 11px;
	}

	.col-card {
		width: 24%;
		min-width: 195px;
		text-align: left;
	}

	.col-set {
		width: 48px;
		min-width: 44px;
		max-width: 52px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	.col-lang {
		width: 56px;
		min-width: 52px;
		max-width: 60px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	.col-finish {
		width: 78px;
		min-width: 72px;
		max-width: 84px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	.col-vendor {
		min-width: 96px;
		max-width: 135px;
		text-align: center;
		padding: 0.55rem 0.35rem;
	}

	.col-vendor.col-best-price {
		min-width: 170px;
		max-width: 250px;
	}

	.col-actions {
		width: 46px;
		min-width: 42px;
		max-width: 48px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	@media (min-width: 769px) {
		thead th {
			position: sticky;
			top: var(--nav-height, 64px);
			z-index: 60;
			box-shadow: var(--shadow-sm);
		}

		th.col-card {
			position: sticky;
			top: var(--nav-height, 64px);
			left: 0;
			z-index: 70;
			background: var(--color-bg-secondary);
		}

		th.col-card.active,
		th.col-card:hover {
			background-color: var(--color-bg-hover);
		}

		td.col-card {
			position: sticky;
			left: 0;
			z-index: 5;
			background: var(--color-bg-primary);
		}

		tbody tr:hover td.col-card {
			background: var(--color-bg-hover);
		}

		tbody tr.selected td.col-card {
			background: var(--color-primary-alpha, rgba(99, 102, 241, 0.15)) !important;
		}

		th.col-card::after,
		td.col-card::after {
			content: '';
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			width: 1px;
			background: var(--color-border);
			pointer-events: none;
		}
	}

	th,
	td {
		padding: 0.6rem 0.4rem;
		text-align: center;
		border-bottom: 1px solid var(--color-border);
		transition: background-color var(--transition-fast);
	}

	th {
		background: var(--color-bg-secondary);
		font-weight: 600;
		color: var(--color-text-primary);
		text-align: center;
		cursor: pointer;
		position: relative;
		user-select: none;
		white-space: nowrap;
		text-transform: uppercase;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
	}

	th.active {
		color: var(--color-primary);
		background-color: var(--color-bg-hover);
	}

	th:not([class*='disabled-column']):hover {
		background-color: var(--color-bg-hover);
	}

	tbody tr:hover td {
		background-color: var(--color-bg-hover);
	}

	tbody tr {
		cursor: pointer;
	}

	tbody tr.selected td {
		background-color: var(--color-primary-alpha, rgba(99, 102, 241, 0.15)) !important;
	}

	tbody tr.selected {
		box-shadow: inset 3px 0 0 var(--color-primary, #6366f1);
	}

	.th-header-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}

	.sort-icon {
		font-size: 0.72rem;
		color: var(--color-primary);
		display: inline-block;
		vertical-align: middle;
	}

	.actions-header {
		width: 50px;
	}


	.text-success {
		color: var(--color-success);
	}
	.text-error {
		color: var(--color-error);
	}
	.text-muted {
		color: var(--color-text-muted);
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: 3rem;
		color: var(--color-text-secondary);
		background: var(--glass-bg);
		backdrop-filter: blur(var(--backdrop-blur));
		border-radius: 12px;
		border: 1px solid var(--glass-border);
		margin: 2rem auto;
		max-width: 600px;
	}

	.empty-filter-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3.5rem 1.5rem;
		text-align: center;
		background: var(--glass-bg, rgba(255, 255, 255, 0.03));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px dashed var(--color-border);
		border-radius: 12px;
		margin: 1.5rem auto;
		max-width: 640px;
		animation: fadeIn 0.3s ease-out;
	}

	.empty-filter-icon {
		font-size: 2.25rem;
		color: var(--color-text-muted);
		margin-bottom: 0.85rem;
	}

	.empty-filter-state h3 {
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0 0 0.4rem 0;
	}

	.empty-filter-state p {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
		margin: 0 0 1.25rem 0;
		max-width: 420px;
		line-height: 1.45;
	}

	.clear-filters-btn {
		background: var(--color-primary);
		color: white;
		border: none;
		padding: 0.55rem 1.25rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		transition: opacity var(--transition-fast), transform var(--transition-fast);
	}

	.clear-filters-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.error {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.vendor-link {
		text-decoration: none;
		color: inherit;
		display: inline-block;
	}

	tr.condensed .card-info {
		justify-content: center;
	}

	@media (max-width: 768px) {
		.table-scroll-container {
			background: transparent;
			border: none;
			box-shadow: none;
			overflow-x: visible;
			margin-top: 0.5rem;
			border-radius: 0;
			min-height: auto;
		}

		table {
			background: transparent;
			box-shadow: none;
			border: none;
			border-radius: 0;
			display: block;
			margin-top: 0.5rem;
			width: 100%;
			table-layout: auto;
		}

		thead {
			display: none;
		}

		tbody {
			display: flex;
			flex-direction: column;
			gap: 0.85rem;
			width: 100%;
		}


	}

	.overlay-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.85);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		box-sizing: border-box;
		cursor: zoom-out;
		animation: fadeIn 0.3s ease;
	}

	.enlarged-card {
		max-width: 90vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: 4.5% / 3.5%;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
		z-index: 1001;
		cursor: default;
		animation: scaleIn 0.3s ease;
	}

	.card-thumbnail {
		cursor: zoom-in;
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.th-vendor-wrap {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.12rem;
		line-height: 1.15;
	}

	.th-vendor-title {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.th-last-checked {
		display: inline-flex;
		align-items: center;
		gap: 0.22rem;
		font-size: 0.66rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		opacity: 0.85;
		text-transform: none;
		letter-spacing: 0;
	}

	.stock-check-toast {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: calc(100% - 2rem);
		max-width: calc(1540px - 2rem);
		box-sizing: border-box;
		margin: 0 auto 0.85rem auto;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		font-size: 0.86rem;
		font-weight: 500;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-md);
	}

	.stock-check-toast.success {
		border-color: rgba(16, 185, 129, 0.45);
		background: rgba(16, 185, 129, 0.1);
		color: var(--color-text-primary);
	}

	.stock-check-toast.success > i {
		color: #10b981;
	}

	.stock-check-toast.warning {
		border-color: rgba(245, 158, 11, 0.45);
		background: rgba(245, 158, 11, 0.1);
		color: var(--color-text-primary);
	}

	.stock-check-toast.warning > i {
		color: #f59e0b;
	}

	.stock-check-toast.error {
		border-color: rgba(239, 68, 68, 0.45);
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-text-primary);
	}

	.stock-check-toast.error > i {
		color: #ef4444;
	}

	.toast-dismiss-btn {
		margin-left: auto;
		background: transparent;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 0.2rem 0.35rem;
		border-radius: 4px;
	}

	.toast-dismiss-btn:hover {
		color: var(--color-text-primary);
	}

	.list-load-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1.1rem;
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		border-bottom-left-radius: 11px;
		border-bottom-right-radius: 11px;
	}

	.load-status-text strong {
		color: var(--color-text-primary);
	}

	.load-all-btn {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		color: var(--color-primary);
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.load-all-btn:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.scroll-top-btn {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: var(--color-bg-elevated, #1e1e2d);
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		box-shadow: var(--shadow-md);
		cursor: pointer;
		z-index: 850;
		transition: all var(--transition-fast);
		opacity: 0.85;
	}

	.scroll-top-btn:hover {
		opacity: 1;
		transform: translateY(-2px);
		border-color: var(--color-primary);
		color: var(--color-primary);
		box-shadow: var(--shadow-lg);
	}

	@media (pointer: coarse), (max-width: 768px) {
		tbody tr {
			-webkit-touch-callout: none;
			user-select: none;
		}
	}
</style>
