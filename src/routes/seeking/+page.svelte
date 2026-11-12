<script>
	import { onMount, onDestroy } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { fetchWithAuth } from '$lib/utils/api';
	import {
		initExchangeRates,
		formatHkdPrice,
		formatJpyPrice,
		formatTwdPrice,
		formatEurPrice
	} from '$lib/stores/exchangeRate';
	import {
		PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
		PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL,
		PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL
	} from '$env/static/public';
	import { env as publicEnv } from '$env/dynamic/public';
	import {
		getCardKey,
		formatMinConditionLabel,
		formatRelativeTime,
		formatExactTimestamp,
		getCardCooldownRemainingSec,
		formatCooldownRemaining,
		getStockIcon,
		getStockColor,
		getStockStatus,
		getWebpImageUri,
		getSetIconCode,
		formatPrice,
		formatDollarPrice,
		getTCGPlayerUrl,
		getEbayUrl,
		getCardmarketUrl,
		getCardmarketConditionClass,
		getLowestOffer,
		isBestVendorPrice,
		getBestOfferDetails,
		getCardHistoricalBadgeInfo,
		formatCardAsDecklistLine,
		buildSeekingCsvString
	} from '$lib/utils/seekingUtils';
	import HistoricalPriceModal from '$lib/components/seeking/HistoricalPriceModal.svelte';
	import EditCardModal from '$lib/components/seeking/EditCardModal.svelte';
	import DecklistImportModal from '$lib/components/seeking/DecklistImportModal.svelte';
	import BulkActionModals from '$lib/components/seeking/BulkActionModals.svelte';
	import EmptySeekingState from '$lib/components/seeking/EmptySeekingState.svelte';

	let cards = [];
	let lastChecked = {
		cardtrader: null,
		tcgplayer: null,
		ebay: null,
		manapool: null,
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
				await fetchWithAuth(PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});
				cards = cards.filter((c) => getCardKey(c) !== getCardKey(card));
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
			if (!isNaN(floatVal) && floatVal >= 0) {
				parsedCap = Math.round(floatVal * 100);
			}
		}

		for (const card of cardsToUpdate) {
			try {
				const requestBody = {
					partitionKey: card.set_code,
					rowKey: `${card.collector_number}_${card.language}_${card.finish}`,
					max_price_cap: parsedCap
				};
				await fetchWithAuth(PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});
				card.max_price_cap = parsedCap;
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
			if (showHistoricalModal) {
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

		unsubscribe = auth.subscribe((state) => {
			if (!state.isLoading) {
				if (state.isAuthenticated) {
					fetchSeekingList();
				} else {
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
					showCardmarket
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

	function checkHeaderPinned() {
		if (!tableContainerEl || typeof window === 'undefined') {
			isHeaderPinned = false;
			return;
		}
		const rect = tableContainerEl.getBoundingClientRect();
		const navEl = document.querySelector('nav');
		const navHeight = navEl ? navEl.offsetHeight : 64;
		isHeaderPinned = rect.top <= navHeight + 1 && rect.bottom > navHeight;
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
				showCardmarket
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
					showCardmarket
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
{:else if cards.length === 0}
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
					{#each displayedCards as card, index (`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`)}
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
						nowTick
					)}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
					<tr
						class:condensed={isCondensed}
						class:selected={selectedKeys.has(getCardKey(card))}
						on:click={(e) => handleRowClick(card, index, e)}
						on:touchstart={(e) => handleRowTouchStart(card, index, e)}
						on:touchmove={handleRowTouchMove}
						on:touchend={handleRowTouchEnd}
						on:touchcancel={handleRowTouchEnd}
						on:contextmenu={handleRowContextMenu}
						style={activeMenuId ===
						`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`
							? 'z-index: 50; position: relative;'
							: ''}
					>
						<td data-label="Card" class="col-card">
							<div class="card-info">
								{#if !isCondensed}
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
									<img
										src={getWebpImageUri(card.image_uri)}
										alt={card.name}
										class="card-thumbnail"
										loading="lazy"
										decoding="async"
										on:click={() => (enlargedCardImage = getWebpImageUri(card.image_uri))}
									/>
								{/if}
								<div class="card-name-group">
									<span>{card.name}</span>
									{#if (card.max_price_cap !== null && card.max_price_cap !== undefined) || card.min_condition || histBadge}
										<div class="card-badges-row">
											{#if histBadge}
												<button
													type="button"
													class="cap-badge hist-badge hist-{histBadge.type}"
													title={histBadge.title}
													on:click|stopPropagation={() => openHistoricalModal(card)}
												>
													{histBadge.label}
												</button>
											{/if}
											{#if card.max_price_cap !== null && card.max_price_cap !== undefined}
												<button
													type="button"
													class="cap-badge"
													title="Click to edit Max Price Cap"
													on:click|stopPropagation={() => openSettings(card)}
												>
													MAX {formatPrice(card.max_price_cap)}
												</button>
											{/if}
											{#if card.min_condition}
												<button
													type="button"
													class="cap-badge cond-override-badge"
													title="Minimum Condition Override: {formatMinConditionLabel(card.min_condition)} (Click to edit)"
													on:click|stopPropagation={() => openSettings(card)}
												>
													{card.min_condition === 'NM'
														? 'NM ONLY'
														: card.min_condition === 'ANY'
															? 'ANY COND'
															: `MIN ${card.min_condition}+`}
												</button>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</td>
						<td data-label="Set" class="set-column col-set">
							<button
								type="button"
								class="inline-variant-btn set-variant-btn"
								title="Set: {card.set_code.toUpperCase()} (Click to edit)"
								on:click|stopPropagation={() => openSettings(card)}
							>
								<img
									src="https://svgs.scryfall.io/sets/{getSetIconCode(card.set_code)}.svg"
									alt="{card.set_code} set icon"
									title={card.set_code.toUpperCase()}
									class="set-icon"
									loading="lazy"
									decoding="async"
								/>
								<span class="set-code-text">{card.set_code.toUpperCase()}</span>
							</button>
						</td>
						<td data-label="Language" class="language-column col-lang">
							<button
								type="button"
								class="inline-variant-btn"
								title="Click to edit language or finish"
								on:click|stopPropagation={() => openSettings(card)}
							>
								{card.language.toUpperCase()}
							</button>
						</td>
						<td data-label="Finish" class="finish-column col-finish">
							<button
								type="button"
								class="inline-variant-btn"
								class:foil-variant={card.finish.toLowerCase() === 'foil'}
								title="Click to edit finish or language"
								on:click|stopPropagation={() => openSettings(card)}
							>
								{card.finish.toLowerCase() === 'foil' ? '✦ Foil' : 'Nonfoil'}
							</button>
						</td>
						{#if isCondensed}
						{@const bestOffer = getBestOfferDetails(
							card,
							showCardTrader,
							showTCGPlayer,
							showEbay,
							showManapool,
							showHimarket,
							showHareruya,
							showRuten,
							showCardmarket,
							setCodeToNameMap
						)}
						<td data-label="Best Price" class="vendor-stock-cell col-vendor col-best-price">
							{#if bestOffer.inStock}
								{#if bestOffer.url}
									<a
										href={bestOffer.url}
										target="_blank"
										rel="noopener noreferrer"
										class="vendor-link"
										title="Buy on {bestOffer.vendorDisplayName}"
									>
										<div class="best-offer-row">
											<span class="best-price-badge">{bestOffer.priceFormatted}</span>
											<span class="best-vendor-pill">{bestOffer.vendorDisplayName}</span>
											{#if bestOffer.condition}
												<span
													class="condition-bubble cond-{bestOffer.conditionClass}"
													title="Condition: {bestOffer.condition}"
												>
													{bestOffer.condition}
												</span>
											{/if}
											{#if bestOffer.otherOffersCount > 0}
												<span
													class="other-stores-chip"
													title="{bestOffer.otherOffersCount} other store{bestOffer.otherOffersCount > 1 ? 's' : ''} in stock"
												>
													+{bestOffer.otherOffersCount}
												</span>
											{/if}
										</div>
									</a>
								{:else}
									<div class="best-offer-row">
										<span class="best-price-badge">{bestOffer.priceFormatted}</span>
										<span class="best-vendor-pill">{bestOffer.vendorDisplayName}</span>
										{#if bestOffer.condition}
											<span
												class="condition-bubble cond-{bestOffer.conditionClass}"
												title="Condition: {bestOffer.condition}"
											>
												{bestOffer.condition}
											</span>
										{/if}
										{#if bestOffer.otherOffersCount > 0}
											<span
												class="other-stores-chip"
												title="{bestOffer.otherOffersCount} other store{bestOffer.otherOffersCount > 1 ? 's' : ''} in stock"
											>
												+{bestOffer.otherOffersCount}
											</span>
										{/if}
									</div>
								{/if}
							{:else if card.historical_pricing?.last_seen_cents}
								<div
									class="oos-compact"
									title="Out of stock. Last seen on {card.historical_pricing.last_seen_vendor || 'vendor'} at ${(card.historical_pricing.last_seen_cents / 100).toFixed(2)}"
								>
									<i class="fa-solid fa-circle-xmark text-danger"></i>
									<span class="last-seen-text">Last: ${(card.historical_pricing.last_seen_cents / 100).toFixed(2)}</span>
								</div>
							{:else}
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-xmark text-danger"
										title="Out of stock across all enabled stores"
									></i>
								</div>
							{/if}
						</td>
						{:else}
						{#if showCardTrader}
						<td data-label="CardTrader" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'cardtrader', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if card.cardtrader_id}
								<a
									href="https://www.cardtrader.com/cards/{card.cardtrader_id}"
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'cardtrader', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.cardtrader_stock))} {getStockColor(
												getStockStatus(card.cardtrader_stock)
											)}"
										></i>
										{#if card.cardtrader_low_price !== null && card.cardtrader_low_price !== undefined}
											<span class="price-text">
												{formatPrice(card.cardtrader_low_price)}
												{#if card.cardtrader_condition && getStockStatus(card.cardtrader_stock) === 'available'}
													<span
														class="condition-bubble cond-{card.cardtrader_condition.toLowerCase()}"
														title="Condition: {card.cardtrader_condition}"
													>
														{card.cardtrader_condition}
													</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-question text-muted"
										title="Card not found on CardTrader"
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{#if showTCGPlayer}
						<td data-label="TCGPlayer" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'tcgplayer', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if card.tcgplayer_id}
								<a
									href={getTCGPlayerUrl(card)}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'tcgplayer', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.tcgplayer_stock))} {getStockColor(
												getStockStatus(card.tcgplayer_stock)
											)}"
										></i>
										{#if card.tcgplayer_low_price > 0 && getStockStatus(card.tcgplayer_stock) === 'available'}
											<span class="price-text">
												{formatDollarPrice(card.tcgplayer_low_price)}
												{#if card.tcgplayer_condition}
													<span
														class="condition-bubble cond-{card.tcgplayer_condition.toLowerCase()}"
														title="Condition: {card.tcgplayer_condition}"
													>
														{card.tcgplayer_condition}
													</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-question text-muted"
										title="Card not found on TCGPlayer"
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{#if showManapool}
						<td data-label="Mana Pool" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'manapool', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if card.manapool_url}
								<a
									href={card.manapool_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'manapool', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.manapool_stock))} {getStockColor(
												getStockStatus(card.manapool_stock)
											)}"
										></i>
										{#if card.manapool_low_price !== null && card.manapool_low_price !== undefined && getStockStatus(card.manapool_stock) === 'available'}
											<span class="price-text">
												{formatPrice(card.manapool_low_price)}
												{#if card.manapool_condition}
													<span
														class="condition-bubble cond-{card.manapool_condition.toLowerCase()}"
														title="Condition: {card.manapool_condition}"
													>
														{card.manapool_condition}
													</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-question text-muted"
										title="Card not found on Mana Pool"
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{#if showCardmarket}
						<td data-label="CardMarket" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'cardmarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if card.cardmarket_id}
								<a
									href={getCardmarketUrl(card)}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'cardmarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.cardmarket_stock))} {getStockColor(
												getStockStatus(card.cardmarket_stock)
											)}"
										></i>
										{#if card.cardmarket_low_price !== null && card.cardmarket_low_price !== undefined && getStockStatus(card.cardmarket_stock) === 'available'}
											<span class="price-text" title={formatEurPrice(card.cardmarket_price_eur)}>
												{formatPrice(card.cardmarket_low_price)}
												{#if card.cardmarket_condition}
													<span
														class="condition-bubble cond-{getCardmarketConditionClass(card.cardmarket_condition)}"
														title="Condition: {card.cardmarket_condition}{card.cardmarket_price_eur ? ` (${formatEurPrice(card.cardmarket_price_eur)})` : ''}"
													>
														{card.cardmarket_condition}
													</span>
												{/if}
												{#if card.cardmarket_price_eur}
													<span class="currency-tag">EUR</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-question text-muted"
										title="Card not found on CardMarket"
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{#if showEbay}
						<td data-label="EBay" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'ebay', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							<a
								href={getEbayUrl(card, setCodeToNameMap)}
								target="_blank"
								rel="noopener noreferrer"
								class="vendor-link"
							>
								<div
									class="stock-indicator"
									class:best-price={isBestVendorPrice(card, 'ebay', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
								>
									<i
										class="{getStockIcon(getStockStatus(card.ebay_stock))} {getStockColor(
											getStockStatus(card.ebay_stock)
										)}"
									></i>
									{#if card.ebay_low_price !== null && card.ebay_low_price !== undefined && getStockStatus(card.ebay_stock) === 'available'}
										<span class="price-text">
											{formatPrice(card.ebay_low_price)}
											{#if card.ebay_condition}
												<span
													class="condition-bubble cond-{card.ebay_condition.toLowerCase()}"
													title="Condition: {card.ebay_condition}"
												>
													{card.ebay_condition}
												</span>
											{/if}
										</span>
									{/if}
								</div>
							</a>
						</td>
						{/if}
						{#if showHimarket}
						<td data-label="HiMarket" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'himarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if card.himarket_url}
								<a
									href={card.himarket_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'himarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.himarket_stock))} {getStockColor(
												getStockStatus(card.himarket_stock)
											)}"
										></i>
										{#if card.himarket_low_price !== null && card.himarket_low_price !== undefined && getStockStatus(card.himarket_stock) === 'available'}
											<span class="price-text" title={formatHkdPrice(card.himarket_price_hkd)}>
												{formatPrice(card.himarket_low_price)}
												{#if card.himarket_condition}
													<span
														class="condition-bubble cond-{card.himarket_condition.toLowerCase()}"
														title="Condition: {card.himarket_condition}{card.himarket_price_hkd ? ` (${formatHkdPrice(card.himarket_price_hkd)})` : ''}"
													>
														{card.himarket_condition}
													</span>
												{/if}
												{#if card.himarket_price_hkd}
													<span class="currency-tag">HKD</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="{getStockIcon(getStockStatus(card.himarket_stock))} {getStockColor(
											getStockStatus(card.himarket_stock)
										)}"
										title={getStockStatus(card.himarket_stock) === 'unavailable' ? 'Out of stock on HiMarket' : 'Not searched on HiMarket'}
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{#if showHareruya}
						<td data-label="Hareruya" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'hareruya', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if card.hareruya_url}
								<a
									href={card.hareruya_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'hareruya', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.hareruya_stock))} {getStockColor(
												getStockStatus(card.hareruya_stock)
											)}"
										></i>
										{#if card.hareruya_low_price !== null && card.hareruya_low_price !== undefined && getStockStatus(card.hareruya_stock) === 'available'}
											<span class="price-text" title={formatJpyPrice(card.hareruya_price_jpy)}>
												{formatPrice(card.hareruya_low_price)}
												{#if card.hareruya_condition}
													<span
														class="condition-bubble cond-{card.hareruya_condition.toLowerCase()}"
														title="Condition: {card.hareruya_condition}{card.hareruya_price_jpy ? ` (${formatJpyPrice(card.hareruya_price_jpy)})` : ''}"
													>
														{card.hareruya_condition}
													</span>
												{/if}
												{#if card.hareruya_price_jpy}
													<span class="currency-tag">JPY</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="{getStockIcon(getStockStatus(card.hareruya_stock))} {getStockColor(
											getStockStatus(card.hareruya_stock)
										)}"
										title={getStockStatus(card.hareruya_stock) === 'unavailable' ? 'Out of stock on Hareruya' : 'Not searched on Hareruya'}
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{#if showRuten}
						<td data-label="Ruten" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'ruten', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}>
							{#if !['zht', 'en'].includes((card.language || '').toLowerCase())}
								<div class="stock-indicator">
									<span
										class="unsupported-lang-dash"
										title="Ruten only checks Traditional Chinese (ZHT) and English (EN) cards"
									>—</span>
								</div>
							{:else if card.ruten_url}
								<a
									href={card.ruten_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'ruten', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
									>
										<i
											class="{getStockIcon(getStockStatus(card.ruten_stock))} {getStockColor(
												getStockStatus(card.ruten_stock)
											)}"
										></i>
										{#if card.ruten_low_price !== null && card.ruten_low_price !== undefined && getStockStatus(card.ruten_stock) === 'available'}
											<span class="price-text" title={formatTwdPrice(card.ruten_price_twd)}>
												{formatPrice(card.ruten_low_price)}
												{#if card.ruten_condition}
													<span
														class="condition-bubble cond-{card.ruten_condition.toLowerCase()}"
														title="Condition: {card.ruten_condition}{card.ruten_price_twd ? ` (${formatTwdPrice(card.ruten_price_twd)})` : ''}"
													>
														{card.ruten_condition}
													</span>
												{/if}
												{#if card.ruten_price_twd}
													<span class="currency-tag">TWD</span>
												{/if}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="stock-indicator">
									<i
										class="{getStockIcon(getStockStatus(card.ruten_stock))} {getStockColor(
											getStockStatus(card.ruten_stock)
										)}"
										title={getStockStatus(card.ruten_stock) === 'unavailable' ? 'Out of stock on Ruten' : 'Not searched on Ruten'}
									></i>
								</div>
							{/if}
						</td>
						{/if}
						{/if}
						<td data-label="Actions" class="actions-column col-actions">
							<div class="kebab-menu-container">
								<button
									class="kebab-button"
									aria-label="Actions menu"
									on:click={(e) =>
										toggleMenu(
											`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`,
											e
										)}
								>
									<i class="fa-solid fa-ellipsis-vertical"></i>
								</button>
								{#if activeMenuId === `${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`}
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div class="kebab-dropdown" class:drop-up={index >= displayedCards.length - 2} on:click|stopPropagation>
										<button
											class="dropdown-item"
											on:click={() => {
												toggleCardSelection(card, index);
												closeMenu();
											}}
										>
											<i class="fa-solid {selectedKeys.has(getCardKey(card)) ? 'fa-square-check' : 'fa-check-double'}"></i>
											{selectedKeys.has(getCardKey(card)) ? 'Deselect' : 'Select'}
										</button>
										{#if canManualCheckStock}
											{@const cooldownSec = getCardCooldownRemainingSec(card, isAdmin, nowTick)}
											{@const isCheckingCard = checkingStockCardKeys.has(getCardKey(card))}
											<button
												class="dropdown-item"
												disabled={isCheckingCard || cooldownSec > 0}
												title={cooldownSec > 0
													? `Checked recently (${formatExactTimestamp(card.last_manual_check)}). Available again in ${formatCooldownRemaining(cooldownSec)}.`
													: 'Queue an on-demand stock check across enabled marketplaces'}
												on:click={() => handleManualStockCheck(card)}
											>
												{#if isCheckingCard}
													<i class="fa-solid fa-arrows-rotate fa-spin"></i> Checking...
												{:else if cooldownSec > 0}
													<i class="fa-regular fa-clock"></i> Checked ({formatCooldownRemaining(cooldownSec)})
												{:else}
													<i class="fa-solid fa-arrows-rotate"></i> Check Stock Now
												{/if}
											</button>
										{/if}
										<button
											class="dropdown-item"
											on:click={() => {
												copyDecklistToClipboard([card]);
												closeMenu();
											}}
										>
											<i class="fa-solid fa-copy"></i> Copy Line
										</button>
										<button
											class="dropdown-item"
											on:click={() => {
												openHistoricalModal(card);
												closeMenu();
											}}
										>
											<i class="fa-solid fa-chart-line"></i> Price History
										</button>
										<button class="dropdown-item" on:click={() => openSettings(card)}>
											<i class="fa-solid fa-pen-to-square"></i> Edit Card
										</button>
										<button
											class="dropdown-item text-error"
											on:click={() => {
												handleDelete(card);
												closeMenu();
											}}
											disabled={!isAuthenticated}
										>
											<i class="fa-solid fa-trash"></i> Delete
										</button>
									</div>
								{/if}
							</div>
						</td>
					</tr>
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

	.card-info {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		text-align: left;
		min-width: 0;
	}

	.card-info img {
		width: 36px;
		height: auto;
		border-radius: 4px;
		transition: transform var(--transition-normal);
		opacity: 1;
		margin-right: 0;
		box-shadow: var(--shadow-sm);
		flex-shrink: 0;
	}

	.card-info img:hover {
		transform: scale(1.55);
		z-index: 20;
		box-shadow: var(--shadow-md);
	}

	tr.condensed .card-info img {
		width: 0;
		opacity: 0;
		margin-right: 0;
		display: none;
	}

	.card-name-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
	}

	tr.condensed .card-name-group {
		align-items: center;
	}

	.card-badges-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		align-items: center;
	}

	.cap-badge {
		display: inline-block;
		font-size: 0.65rem;
		background: var(--color-bg-hover);
		color: var(--color-accent);
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 700;
		border: 1px solid var(--color-accent);
		cursor: pointer;
		transition: transform var(--transition-fast), opacity var(--transition-fast);
	}

	.cap-badge.cond-override-badge {
		color: var(--color-primary);
		border-color: var(--color-primary);
		background: rgba(99, 102, 241, 0.1);
	}

	.cap-badge:hover {
		transform: translateY(-1px);
		opacity: 0.9;
	}

	.hist-badge.hist-at-low {
		background: rgba(249, 115, 22, 0.16);
		border-color: rgba(249, 115, 22, 0.5);
		color: #fdba74;
		font-weight: 700;
	}

	.hist-badge.hist-floor {
		background: rgba(16, 185, 129, 0.12);
		border-color: rgba(16, 185, 129, 0.35);
		color: #6ee7b7;
	}

	.hist-badge.hist-last-seen {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.32);
		color: #cbd5e1;
	}

	.vendor-stock-cell {
		text-align: center;
		vertical-align: middle;
		padding: 0.55rem 0.35rem;
	}

	.stock-indicator {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.18rem;
		min-width: 0;
	}

	.stock-indicator i {
		font-size: 1.05rem;
		transition: transform var(--transition-fast);
		line-height: 1;
	}

	.vendor-link:hover .stock-indicator i {
		transform: scale(1.15);
	}

	.stock-indicator.best-price {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.45);
		border-radius: 999px;
		padding: 0.18rem 0.55rem;
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.12);
	}

	.stock-indicator.best-price .price-text {
		color: #10b981;
		font-weight: 700;
	}

	.price-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		font-size: 0.76rem;
		color: var(--color-text-muted);
		line-height: 1.15;
		font-weight: 500;
		white-space: nowrap;
	}

	.currency-tag {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--color-text-muted);
		padding: 0.04rem 0.22rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		letter-spacing: 0.02em;
		display: inline-block;
		vertical-align: middle;
		line-height: 1.1;
	}

	.unsupported-lang-dash {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-muted);
		opacity: 0.45;
		cursor: help;
		user-select: none;
	}

	.condition-bubble {
		font-size: 0.6rem;
		font-weight: 700;
		padding: 0.05rem 0.3rem;
		border-radius: 999px;
		letter-spacing: 0.03em;
		display: inline-block;
		vertical-align: middle;
		line-height: 1.1;
		background: rgba(148, 163, 184, 0.16);
		color: #cbd5e1;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.condition-bubble.cond-nm {
		background: rgba(16, 185, 129, 0.16);
		color: #34d399;
		border-color: rgba(16, 185, 129, 0.35);
	}

	.condition-bubble.cond-sp {
		background: rgba(56, 189, 248, 0.16);
		color: #38bdf8;
		border-color: rgba(56, 189, 248, 0.35);
	}

	.condition-bubble.cond-mp {
		background: rgba(245, 158, 11, 0.16);
		color: #fbbf24;
		border-color: rgba(245, 158, 11, 0.35);
	}

	.condition-bubble.cond-hp,
	.condition-bubble.cond-po {
		background: rgba(249, 115, 22, 0.16);
		color: #fb923c;
		border-color: rgba(249, 115, 22, 0.35);
	}

	.best-offer-row {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.22rem 0.6rem;
		background: rgba(16, 185, 129, 0.08);
		border: 1px solid rgba(16, 185, 129, 0.35);
		border-radius: 999px;
		transition: all var(--transition-fast);
		cursor: pointer;
	}

	.vendor-link:hover .best-offer-row {
		background: rgba(16, 185, 129, 0.18);
		border-color: rgba(16, 185, 129, 0.65);
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
		transform: translateY(-1px);
	}

	.best-price-badge {
		font-weight: 700;
		font-size: 0.85rem;
		color: #10b981;
		line-height: 1.1;
	}

	.best-vendor-pill {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-text-primary);
		line-height: 1.1;
	}

	.other-stores-chip {
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.05rem 0.32rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
		line-height: 1.1;
	}

	.oos-compact {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.oos-compact .last-seen-text {
		font-size: 0.68rem;
		opacity: 0.8;
	}

	.set-column {
		text-align: center;
	}

	.set-icon {
		height: 1.5em;
		width: 1.5em;
		vertical-align: middle;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
	}

	:global([data-theme='dark']) .set-icon {
		filter: invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
	}

	.set-variant-btn {
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.set-code-text {
		display: none;
	}

	.language-column {
		text-transform: uppercase;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.inline-variant-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.inline-variant-btn:hover {
		border-color: var(--color-primary);
		background: var(--color-bg-hover);
		transform: translateY(-1px);
	}

	.inline-variant-btn.foil-variant {
		border-color: rgba(245, 158, 11, 0.45);
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
	}

	.actions-header {
		width: 50px;
	}

	.actions-column {
		text-align: center;
		position: relative;
	}

	.kebab-menu-container {
		position: relative;
		display: inline-block;
	}

	.kebab-button {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		transition: all var(--transition-fast);
		text-align: center;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.kebab-button:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.kebab-dropdown {
		position: absolute;
		right: 0;
		top: 100%;
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		box-shadow: var(--shadow-md);
		min-width: 140px;
		z-index: 50;
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
		margin-top: 0.25rem;
		animation: fadeIn 0.2s ease-out;
	}

	.kebab-dropdown.drop-up {
		top: auto;
		bottom: 100%;
		margin-top: 0;
		margin-bottom: 0.25rem;
	}

	.dropdown-item {
		background: none;
		border: none;
		padding: 0.75rem 1rem;
		text-align: left;
		cursor: pointer;
		color: var(--color-text-primary);
		font-size: 0.9rem;
		transition: background-color var(--transition-fast);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.dropdown-item i {
		width: 16px;
		text-align: center;
	}

	.dropdown-item:hover:not(:disabled) {
		background-color: var(--color-bg-hover);
	}

	.dropdown-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-item.text-error {
		color: var(--color-error);
	}

	.dropdown-item.text-error:hover:not(:disabled) {
		background-color: var(--color-error);
		color: white;
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

		tbody tr {
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			background: var(--glass-bg);
			backdrop-filter: blur(var(--backdrop-blur));
			-webkit-backdrop-filter: blur(var(--backdrop-blur));
			border: 1px solid var(--glass-border);
			border-radius: 14px;
			padding: 0.75rem;
			box-shadow: var(--shadow-sm);
			margin-bottom: 0;
			position: relative;
			gap: 0.45rem;
			width: 100%;
			box-sizing: border-box;
		}

		tbody tr:hover td {
			background-color: transparent;
		}

		td,
		td.col-set,
		td.col-lang,
		td.col-finish,
		td.col-vendor,
		td.col-card,
		td.col-actions {
			border: none;
			padding: 0.35rem;
			text-align: center;
			min-width: 0 !important;
			max-width: none !important;
			width: 100% !important;
			box-sizing: border-box;
		}

		td[data-label='Card'] {
			grid-column: 1 / -1;
			border-bottom: 1px solid var(--color-border);
			margin-bottom: 0.1rem;
			padding: 0 2rem 0.55rem 0;
			text-align: left;
		}

		td[data-label='Card'] .card-info {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			gap: 0.75rem;
			width: 100%;
			min-width: 0;
		}

		tr.condensed td[data-label='Card'] .card-info {
			justify-content: flex-start;
		}

		td[data-label='Card'] .card-name-group {
			align-items: flex-start;
			min-width: 0;
			flex: 1;
			gap: 0.3rem;
		}

		tr.condensed td[data-label='Card'] .card-name-group {
			align-items: flex-start;
		}

		td[data-label='Card'] .card-info img {
			margin-right: 0;
			width: 48px;
			height: auto;
			border-radius: 6px;
			flex-shrink: 0;
		}

		td[data-label='Card'] .card-info span {
			font-weight: 700;
			font-size: 0.98rem;
			line-height: 1.25;
			padding: 0;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.set-code-text {
			display: inline-block;
			font-weight: 700;
			font-size: 0.72rem;
		}

		td[data-label='Set'],
		td[data-label='Language'],
		td[data-label='Finish'] {
			grid-column: span 2;
			width: 100% !important;
			max-width: none !important;
			min-width: 0 !important;
			background: var(--color-bg-secondary);
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 0.42rem 0.45rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: space-between;
			gap: 0.25rem;
			box-sizing: border-box;
		}

		td[data-label='Set']::before,
		td[data-label='Language']::before,
		td[data-label='Finish']::before {
			content: attr(data-label);
			font-weight: 700;
			color: var(--color-text-secondary);
			display: block;
			font-size: 0.68rem;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			text-align: left;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			line-height: 1.2;
		}

		td[data-label='Set'] .inline-variant-btn,
		td[data-label='Language'] .inline-variant-btn,
		td[data-label='Finish'] .inline-variant-btn {
			width: 100%;
			height: 28px;
			padding: 0 0.35rem;
			font-size: 0.72rem;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.35rem;
			box-sizing: border-box;
			border-radius: 6px;
			background: var(--color-bg-elevated);
			border: 1px solid var(--color-border);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		td[data-label='Set'] .set-icon {
			height: 1.15em;
			width: 1.15em;
			margin: 0;
			flex-shrink: 0;
		}

		td[data-label='Actions'] {
			position: absolute;
			top: 0.65rem;
			right: 0.6rem;
			border-top: none;
			padding: 0;
			margin: 0;
			background: none;
			width: auto !important;
			max-width: none !important;
		}

		td[data-label='Best Price'] {
			grid-column: 1 / -1;
			width: 100% !important;
			max-width: none !important;
			min-width: 0 !important;
			background: var(--color-bg-secondary);
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 0.45rem 0.65rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0.25rem;
			box-sizing: border-box;
			transition: all var(--transition-fast);
		}

		td[data-label='Best Price'] .best-offer-row {
			justify-content: flex-start;
			background: transparent;
			border: none;
			padding: 0;
		}

		td[data-label='Best Price'] .oos-compact {
			justify-content: flex-start;
		}

		td[data-label='CardTrader'],
		td[data-label='TCGPlayer'],
		td[data-label='EBay'],
		td[data-label='eBay'],
		td[data-label='Mana Pool'],
		td[data-label='CardMarket'],
		td[data-label='HiMarket'],
		td[data-label='Hareruya'],
		td[data-label='Ruten'] {
			grid-column: span 3;
			width: 100% !important;
			max-width: none !important;
			min-width: 0 !important;
			background: var(--color-bg-secondary);
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 0.42rem 0.55rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0.25rem;
			box-sizing: border-box;
			transition: all var(--transition-fast);
		}

		td.vendor-stock-cell.is-best-price,
		td.vendor-stock-cell:has(.best-price) {
			border-color: rgba(16, 185, 129, 0.7) !important;
			background: rgba(16, 185, 129, 0.14) !important;
			box-shadow: 0 0 12px rgba(16, 185, 129, 0.18);
		}

		td.vendor-stock-cell.is-best-price::before,
		td.vendor-stock-cell:has(.best-price)::before {
			color: #10b981 !important;
		}

		td.vendor-stock-cell.is-best-price .price-text,
		td.vendor-stock-cell:has(.best-price) .price-text {
			color: #10b981;
			font-weight: 700;
		}

		td.vendor-stock-cell .stock-indicator.best-price {
			background: transparent !important;
			border: none !important;
			box-shadow: none !important;
			padding: 0 !important;
			border-radius: 0 !important;
			width: 100% !important;
		}

		td[data-label='Best Price']::before,
		td[data-label='CardTrader']::before,
		td[data-label='TCGPlayer']::before,
		td[data-label='EBay']::before,
		td[data-label='eBay']::before,
		td[data-label='Mana Pool']::before,
		td[data-label='CardMarket']::before,
		td[data-label='HiMarket']::before,
		td[data-label='Hareruya']::before,
		td[data-label='Ruten']::before {
			content: attr(data-label);
			font-weight: 700;
			color: var(--color-text-secondary);
			display: block;
			font-size: 0.68rem;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			text-align: left;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			line-height: 1.2;
		}

		td.vendor-stock-cell .vendor-link {
			display: flex;
			align-items: center;
			min-width: 0;
			width: 100%;
			justify-content: flex-start;
		}

		td.vendor-stock-cell .stock-indicator {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			min-width: 0;
			width: 100%;
			flex-wrap: wrap;
			justify-content: flex-start;
		}

		td.vendor-stock-cell .stock-indicator i {
			display: inline-block;
			font-size: 0.95rem;
			margin-bottom: 0;
			flex-shrink: 0;
		}

		td.vendor-stock-cell .price-text {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: 0.8rem;
			font-weight: 700;
			white-space: nowrap;
			min-width: 0;
			flex-wrap: wrap;
		}

		td.vendor-stock-cell .currency-tag {
			font-size: 0.62rem;
			padding: 0.04rem 0.22rem;
			margin-left: 0.1rem;
		}

		td.vendor-stock-cell .condition-bubble {
			font-size: 0.62rem;
			padding: 0.06rem 0.3rem;
			margin-left: 0.1rem;
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
