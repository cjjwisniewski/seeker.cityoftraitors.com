<script>
	import { onMount, onDestroy } from 'svelte'; // Import onDestroy
	import { auth } from '$lib/stores/auth'; // Import auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
	import {
		PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
		PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL,
		PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL,
		PUBLIC_ADD_TO_SEEKING_FUNCTION_URL,
		PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL
	} from '$env/static/public';

	let cards = [];
	let error = null;
	let loading = true; // Re-declare the loading variable
	let setCodeToNameMap = {}; // Map of set code to full set name from Scryfall
	let unsubscribe; // Declare unsubscribe in the component scope
	let isCondensed = false; // State for condensed view
	let activeMenuId = null; // State for identifying which kebab menu is open

	let showSettingsModal = false;
	let selectedCardForSettings = null;
	let maxPriceInput = '';
	let isSavingSettings = false;

	// Multi-select & Bulk action state
	let selectedKeys = new Set();
	let lastSelectedIndex = -1;
	let showBulkDeleteModal = false;
	let showBulkPriceCapModal = false;
	let bulkPriceCapInput = '';
	let isProcessingBulkAction = false;
	let bulkActionProgress = { current: 0, total: 0 };

	// Quick filter pills state
	let filterInStockOnly = false;
	let filterUnderPriceCap = false;
	let filterFoilOnly = false;
	let filterSetCode = '';

	// Decklist Import (Moxfield URL & Text/Clipboard) state
	let showImportModal = false;
	let importStep = 'input'; // 'input' | 'preview'
	let importMode = 'moxfield'; // 'moxfield' | 'text'
	let moxfieldUrlInput = '';
	let decklistTextInput = '';
	let importDefaultFinish = 'nonfoil';
	let importDefaultLanguage = 'en';
	let excludeBasicLands = true;
	let isResolvingImport = false;
	let importResolveStatus = '';
	let importError = null;
	let importedDeckName = '';
	let importPreviewCards = [];
	let isImportingCards = false;
	let importProgress = { current: 0, total: 0, added: 0, skipped: 0 };

	const BASIC_LAND_NAMES = new Set([
		'plains',
		'island',
		'swamp',
		'mountain',
		'forest',
		'wastes',
		'snow-covered plains',
		'snow-covered island',
		'snow-covered swamp',
		'snow-covered mountain',
		'snow-covered forest',
		'snow-covered wastes'
	]);

	function isBasicLandCard(name, typeLine = '') {
		const normName = String(name || '').trim().toLowerCase();
		if (BASIC_LAND_NAMES.has(normName)) return true;
		const normType = String(typeLine || '').toLowerCase();
		return normType.includes('basic land') || normType.includes('basic snow land');
	}

	function openImportModal() {
		if (($auth.user?.membershipTier || '').toLowerCase() === 'banned') return;
		importDefaultFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';
		importDefaultLanguage = $auth.user?.settings?.preferredLanguage || 'en';
		importStep = 'input';
		importError = null;
		importResolveStatus = '';
		importedDeckName = '';
		importPreviewCards = [];
		isResolvingImport = false;
		isImportingCards = false;
		showImportModal = true;
	}

	function closeImportModal() {
		if (isResolvingImport || isImportingCards) return;
		showImportModal = false;
	}

	function parseDecklistText(rawText) {
		const lines = String(rawText || '').split(/\r?\n/);
		const parsed = [];
		const seen = new Set();

		const sectionHeaders = /^(commander|commanders|companion|companions|mainboard|maindeck|deck|sideboard|maybeboard|considering|lands|creatures|spells|artifacts|enchantments|planeswalkers|instants|sorceries)\s*:?\s*$/i;

		for (let rawLine of lines) {
			let line = rawLine.trim();
			if (!line || line.startsWith('//') || line.startsWith('#') || sectionHeaders.test(line)) {
				continue;
			}
			if (/^SB:\s*/i.test(line)) {
				line = line.replace(/^SB:\s*/i, '').trim();
			}
			// Strip leading quantity like "1 ", "4x ", "1X "
			line = line.replace(/^\d+\s*[xX]?\s+/, '').trim();
			if (!line) continue;

			// Strip Archidekt category/collection markers like ^Have,#37d67a^ or [Ramp] at end if preceded by set
			line = line.replace(/\s*\^[^^]+\^\s*$/g, '').trim();

			// Detect foil/etched markers
			let isFoil = false;
			const foilRegex = /\s*(?:\*[fFeE]\*|\((?:foil|etched)\)|\[(?:foil|etched)\])\s*$/i;
			while (foilRegex.test(line)) {
				isFoil = true;
				line = line.replace(foilRegex, '').trim();
			}
			// Check if *F* or *E* appears anywhere at the end after collector number
			if (/\s+\*[fFeE]\*\b/i.test(line)) {
				isFoil = true;
				line = line.replace(/\s+\*[fFeE]\*\b/gi, '').trim();
			}

			// Strip trailing #Category tags (e.g. Moxfield/Archidekt tags)
			line = line.replace(/\s+#[\w\-]+\s*$/g, '').trim();

			let name = line;
			let set_code = '';
			let collector_number = '';

			// Match "Card Name (SET) 123" or "Card Name [SET] 123"
			const setAndCnMatch = line.match(/^(.+?)\s+[\(\[]([A-Za-z0-9]{2,6})[\)\]]\s+([A-Za-z0-9★†\-]+)$/);
			if (setAndCnMatch) {
				name = setAndCnMatch[1].trim();
				set_code = setAndCnMatch[2].toLowerCase();
				collector_number = setAndCnMatch[3].trim();
			} else {
				// Match "Card Name (SET)" or "Card Name [SET]"
				const setOnlyMatch = line.match(/^(.+?)\s+[\(\[]([A-Za-z0-9]{2,6})[\)\]]$/);
				if (setOnlyMatch) {
					name = setOnlyMatch[1].trim();
					set_code = setOnlyMatch[2].toLowerCase();
				}
			}

			const finish = isFoil ? 'foil' : importDefaultFinish;
			const language = importDefaultLanguage || 'en';
			const key = `${name.toLowerCase()}|${set_code}|${collector_number}|${language}|${finish}`;
			if (seen.has(key)) continue;
			seen.add(key);

			parsed.push({
				name,
				set_code,
				collector_number,
				language,
				finish
			});
		}

		return parsed;
	}

	function extractScryfallImage(scryCard) {
		if (!scryCard) return '';
		if (scryCard.image_uris) {
			return scryCard.image_uris.grid || scryCard.image_uris.normal || scryCard.image_uris.large || '';
		}
		if (scryCard.card_faces && scryCard.card_faces[0]?.image_uris) {
			const faceUris = scryCard.card_faces[0].image_uris;
			return faceUris.grid || faceUris.normal || faceUris.large || '';
		}
		return '';
	}

	async function resolveCardsWithScryfall(rawItems) {
		const existingKeySet = new Set(cards.map(getCardKey));
		const resolvedByIndex = new Map();
		const chunkSize = 75;

		// Build initial identifiers for Scryfall /cards/collection
		const requestsMeta = rawItems.map((item, idx) => {
			if (item.scryfall_id) {
				return { idx, item, identifier: { id: item.scryfall_id }, mode: 'id' };
			}
			if (item.set_code && item.collector_number) {
				return {
					idx,
					item,
					identifier: { set: item.set_code.toLowerCase(), collector_number: String(item.collector_number) },
					mode: 'set_cn'
				};
			}
			if (item.name && item.set_code) {
				return {
					idx,
					item,
					identifier: { name: item.name, set: item.set_code.toLowerCase() },
					mode: 'name_set'
				};
			}
			return { idx, item, identifier: { name: item.name }, mode: 'name' };
		});

		const fallbackQueue = [];

		for (let i = 0; i < requestsMeta.length; i += chunkSize) {
			const batch = requestsMeta.slice(i, i + chunkSize);
			importResolveStatus = `Resolving card data with Scryfall (${Math.min(i + batch.length, requestsMeta.length)} / ${requestsMeta.length})...`;

			const res = await fetch('https://api.scryfall.com/cards/collection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ identifiers: batch.map((b) => b.identifier) })
			});

			if (!res.ok) {
				throw new Error(`Scryfall collection lookup failed (Status ${res.status})`);
			}

			const data = await res.json();
			const foundCards = data.data || [];

			// Match returned Scryfall cards back to batch items
			for (const b of batch) {
				const it = b.item;
				let matched = null;
				if (b.mode === 'id') {
					matched = foundCards.find((c) => c.id === it.scryfall_id);
				} else if (b.mode === 'set_cn') {
					matched = foundCards.find(
						(c) =>
							c.set?.toLowerCase() === it.set_code.toLowerCase() &&
							String(c.collector_number).toLowerCase() === String(it.collector_number).toLowerCase()
					);
				} else if (b.mode === 'name_set') {
					const targetLower = it.name.toLowerCase();
					matched = foundCards.find(
						(c) =>
							c.set?.toLowerCase() === it.set_code.toLowerCase() &&
							(c.name?.toLowerCase() === targetLower ||
								c.name?.toLowerCase().startsWith(targetLower + ' //'))
					);
				}
				if (!matched && it.name) {
					const targetLower = it.name.toLowerCase();
					matched = foundCards.find(
						(c) =>
							c.name?.toLowerCase() === targetLower ||
							c.name?.toLowerCase().startsWith(targetLower + ' //')
					);
				}

				if (matched) {
					resolvedByIndex.set(b.idx, matched);
				} else if (b.mode !== 'name' && it.name) {
					fallbackQueue.push(b);
				}
			}

			if (i + chunkSize < requestsMeta.length) {
				await new Promise((r) => setTimeout(r, 100));
			}
		}

		// Fallback by card name for any printings whose set/collector_number wasn't matched
		if (fallbackQueue.length > 0) {
			for (let i = 0; i < fallbackQueue.length; i += chunkSize) {
				const batch = fallbackQueue.slice(i, i + chunkSize);
				const res = await fetch('https://api.scryfall.com/cards/collection', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ identifiers: batch.map((b) => ({ name: b.item.name })) })
				});
				if (res.ok) {
					const data = await res.json();
					const foundCards = data.data || [];
					for (const b of batch) {
						const targetLower = b.item.name.toLowerCase();
						const matched = foundCards.find(
							(c) =>
								c.name?.toLowerCase() === targetLower ||
								c.name?.toLowerCase().startsWith(targetLower + ' //')
						);
						if (matched) {
							resolvedByIndex.set(b.idx, matched);
						}
					}
				}
			}
		}

		const finalPreview = [];
		const previewDedup = new Set();

		rawItems.forEach((item, idx) => {
			const scry = resolvedByIndex.get(idx);
			if (!scry) return;

			const set_code = (scry.set || item.set_code || '').toLowerCase();
			const set_name = scry.set_name || item.set_name || setCodeToNameMap[set_code] || set_code.toUpperCase();
			const collector_number = String(scry.collector_number || item.collector_number || 'N/A');
			const language = (item.language || importDefaultLanguage || 'en').toLowerCase();
			const finish = item.finish === 'foil' ? 'foil' : 'nonfoil';
			const name = scry.name || item.name;
			const type_line = scry.type_line || item.type_line || '';
			const oracle_id = scry.oracle_id || item.oracle_id || scry.id;
			const image_uri = extractScryfallImage(scry);
			if (!image_uri || !set_code) return;

			const cardKey = `${set_code}-${collector_number}-${language}-${finish}`;
			if (previewDedup.has(cardKey)) return;
			previewDedup.add(cardKey);

			const alreadyExists = existingKeySet.has(cardKey);
			const isBasicLand = isBasicLandCard(name, type_line);

			finalPreview.push({
				previewKey: cardKey,
				id: crypto.randomUUID(),
				name,
				set_code,
				set_name,
				collector_number,
				language,
				finish,
				oracle_id,
				image_uri,
				tcgplayer_id: scry.tcgplayer_id || item.tcgplayer_id || null,
				cardmarket_id: scry.cardmarket_id || item.cardmarket_id || null,
				isBasicLand,
				alreadyExists,
				selected: !alreadyExists && !(excludeBasicLands && isBasicLand)
			});
		});

		return finalPreview;
	}

	async function handlePreviewImport() {
		if (isResolvingImport) return;
		importError = null;
		isResolvingImport = true;
		importResolveStatus = '';

		try {
			let rawItems = [];
			if (importMode === 'moxfield') {
				const trimmed = moxfieldUrlInput.trim();
				if (!trimmed) {
					throw new Error('Please enter a Moxfield deck URL.');
				}
				const urlMatch = trimmed.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/i);
				const rawIdMatch = trimmed.match(/^[A-Za-z0-9_-]{6,64}$/);
				const publicId = urlMatch ? urlMatch[1] : rawIdMatch ? rawIdMatch[0] : null;

				if (!publicId) {
					throw new Error('Invalid Moxfield deck URL. Expected format: https://www.moxfield.com/decks/{deckId}');
				}

				importResolveStatus = 'Fetching decklist from Moxfield...';
				let response = null;
				if (PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL) {
					try {
						response = await fetchWithAuth(PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ publicId })
						});
					} catch (e) {
						response = null;
					}
				}

				// Fallback to addToSeeking action='fetch_moxfield' if dedicated APIM operation is not yet deployed
				let data = null;
				if (response && response.ok) {
					data = await response.json();
				} else {
					let errJson = null;
					if (response) {
						try {
							errJson = await response.json();
						} catch (e) {
							errJson = null;
						}
					}
					if (!response || (response.status === 404 && (!errJson || errJson.error !== 'DECK_NOT_FOUND'))) {
						const fallbackRes = await fetchWithAuth(PUBLIC_ADD_TO_SEEKING_FUNCTION_URL, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ action: 'fetch_moxfield', publicId })
						});
						if (!fallbackRes) {
							throw new Error('Authentication failed while fetching Moxfield deck.');
						}
						try {
							errJson = await fallbackRes.json();
						} catch (e) {
							errJson = null;
						}
						if (!fallbackRes.ok) {
							if (errJson?.error === 'MOXFIELD_UNAVAILABLE') {
								importMode = 'text';
							}
							throw new Error(errJson?.message || `Failed to fetch Moxfield deck (Status ${fallbackRes.status}).`);
						}
						data = errJson;
					} else {
						if (errJson?.error === 'MOXFIELD_UNAVAILABLE') {
							importMode = 'text';
						}
						throw new Error(errJson?.message || `Failed to fetch Moxfield deck (Status ${response.status}).`);
					}
				}

				importedDeckName = data?.deck_name || 'Moxfield Deck';
				rawItems = data?.cards || [];
				if (rawItems.length === 0) {
					throw new Error('No cards were found in this Moxfield deck.');
				}
			} else {
				if (!decklistTextInput.trim()) {
					throw new Error('Please paste a decklist in the text box.');
				}
				importResolveStatus = 'Parsing decklist lines...';
				rawItems = parseDecklistText(decklistTextInput);
				importedDeckName = 'Decklist Import';
				if (rawItems.length === 0) {
					throw new Error('Could not parse any valid card lines from the text input.');
				}
			}

			const resolved = await resolveCardsWithScryfall(rawItems);
			if (resolved.length === 0) {
				throw new Error('None of the cards could be matched on Scryfall. Please check your card names or format.');
			}

			// If Basic tier user has limited slots, pre-select up to remaining slots
			if (!isPremiumOrLegacy) {
				let remaining = Math.max(0, 25 - cards.length);
				for (const item of resolved) {
					if (item.selected) {
						if (remaining > 0) {
							remaining--;
						} else {
							item.selected = false;
						}
					}
				}
			}

			importPreviewCards = resolved;
			importStep = 'preview';
		} catch (err) {
			importError = err.message || 'Failed to resolve decklist.';
		} finally {
			isResolvingImport = false;
			importResolveStatus = '';
		}
	}

	function handleToggleExcludeBasicLands() {
		const existingKeySet = new Set(cards.map(getCardKey));
		importPreviewCards = importPreviewCards.map((c) => {
			if (c.isBasicLand) {
				const key = `${c.set_code}-${c.collector_number}-${c.language}-${c.finish}`;
				const exists = existingKeySet.has(key);
				return {
					...c,
					alreadyExists: exists,
					selected: excludeBasicLands ? false : !exists
				};
			}
			return c;
		});
	}

	function toggleImportCardFinish(cardItem) {
		const existingKeySet = new Set(cards.map(getCardKey));
		const newFinish = cardItem.finish === 'foil' ? 'nonfoil' : 'foil';
		const newKey = `${cardItem.set_code}-${cardItem.collector_number}-${cardItem.language}-${newFinish}`;
		const exists = existingKeySet.has(newKey);

		importPreviewCards = importPreviewCards.map((c) => {
			if (c.previewKey === cardItem.previewKey) {
				return {
					...c,
					finish: newFinish,
					previewKey: newKey,
					alreadyExists: exists,
					selected: exists ? false : c.selected
				};
			}
			return c;
		});
	}

	$: visibleImportPreviewCards = excludeBasicLands
		? importPreviewCards.filter((c) => !c.isBasicLand)
		: importPreviewCards;

	$: hiddenBasicLandCount = importPreviewCards.filter((c) => c.isBasicLand).length;

	$: selectedImportCards = visibleImportPreviewCards.filter((c) => c.selected && !c.alreadyExists);

	$: remainingBasicSlots = isPremiumOrLegacy ? Infinity : Math.max(0, 25 - cards.length);

	function selectAllImportPreview() {
		let budget = remainingBasicSlots;
		importPreviewCards = importPreviewCards.map((c) => {
			if (c.alreadyExists || (excludeBasicLands && c.isBasicLand)) {
				return { ...c, selected: false };
			}
			if (budget > 0) {
				budget--;
				return { ...c, selected: true };
			}
			return { ...c, selected: false };
		});
	}

	function deselectAllImportPreview() {
		importPreviewCards = importPreviewCards.map((c) => ({ ...c, selected: false }));
	}

	async function handleConfirmImport() {
		if (selectedImportCards.length === 0 || isImportingCards) return;
		isImportingCards = true;
		importError = null;

		const toImport = isPremiumOrLegacy
			? selectedImportCards
			: selectedImportCards.slice(0, remainingBasicSlots);

		importProgress = { current: 0, total: toImport.length, added: 0, skipped: 0 };
		const batchSize = 20;
		const nowIso = new Date().toISOString();

		try {
			for (let i = 0; i < toImport.length; i += batchSize) {
				const chunk = toImport.slice(i, i + batchSize);
				const batchPayload = chunk.map((c) => ({
					id: c.id || crypto.randomUUID(),
					name: c.name,
					set_code: c.set_code,
					set_name: c.set_name,
					collector_number: c.collector_number,
					language: c.language,
					oracle_id: c.oracle_id,
					image_uri: c.image_uri,
					timestamp: nowIso,
					finish: c.finish,
					tcgplayer_id: c.tcgplayer_id,
					cardmarket_id: c.cardmarket_id
				}));

				const res = await fetchWithAuth(PUBLIC_ADD_TO_SEEKING_FUNCTION_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'add_batch',
						cards: batchPayload
					})
				});

				if (!res) {
					throw new Error('Authentication failed during decklist import.');
				}

				const result = await res.json();
				if (!res.ok) {
					throw new Error(result?.message || `Batch import failed (Status ${res.status})`);
				}

				if (Array.isArray(result.added) && result.added.length > 0) {
					cards = [...cards, ...result.added];
					importProgress.added += result.added.length;
				}
				importProgress.skipped += result.skipped_count || 0;
				importProgress.current = Math.min(toImport.length, i + chunk.length);
				importProgress = { ...importProgress };

				if (result.limit_reached) {
					break;
				}
			}

			showImportModal = false;
		} catch (err) {
			importError = err.message || 'Failed while importing cards.';
		} finally {
			isImportingCards = false;
		}
	}

	function toggleMenu(id, event) {
		event.stopPropagation();
		activeMenuId = activeMenuId === id ? null : id;
	}

	function closeMenu() {
		activeMenuId = null;
	}

	function getCardKey(card) {
		return `${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`;
	}

	function handleRowClick(card, index, event) {
		// Ignore clicks on links, buttons, inputs, images with zoom, or kebab menu
		const target = event.target;
		if (
			target.closest('a') ||
			target.closest('button') ||
			target.closest('input') ||
			target.closest('.card-thumbnail') ||
			target.closest('.kebab-dropdown')
		) {
			return;
		}

		const key = getCardKey(card);
		const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
		const isMultiModifier = isMac ? event.metaKey : event.ctrlKey;

		if (event.shiftKey && lastSelectedIndex >= 0) {
			// Range selection
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
			// Toggle single item
			event.preventDefault();
			const newSelected = new Set(selectedKeys);
			if (newSelected.has(key)) {
				newSelected.delete(key);
			} else {
				newSelected.add(key);
			}
			selectedKeys = newSelected;
			lastSelectedIndex = index;
		} else {
			// Regular click - if cards are already selected, clear or toggle
			if (selectedKeys.size > 0) {
				if (selectedKeys.has(key) && selectedKeys.size === 1) {
					selectedKeys = new Set();
					lastSelectedIndex = -1;
				} else {
					selectedKeys = new Set([key]);
					lastSelectedIndex = index;
				}
			}
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
			if (showImportModal && !isResolvingImport && !isImportingCards) {
				showImportModal = false;
			} else if (showBulkDeleteModal) {
				showBulkDeleteModal = false;
			} else if (showBulkPriceCapModal) {
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
	let enlargedCardImage = null; // State for enlarged card image overlay
	let showFilter = false; // State for filter search bar visibility
	let searchQuery = ''; // State for search query input

	// Sorting state
	let sortKey = 'name'; // Default sort key
	let sortDirection = 'asc'; // Default sort direction ('asc' or 'desc')

	// Reactive check for authentication status
	$: isAuthenticated = $auth.isAuthenticated;
	$: authLoading = $auth.isLoading;

	// Reactive checks for enabled marketplaces from user settings
	$: isPremiumOrLegacy = $auth.user?.membershipTier === 'Premium' || $auth.user?.membershipTier === 'Legacy';
	$: showCardTrader = $auth.user?.settings?.marketplaceCardtraderEnabled ?? true;
	$: showTCGPlayer = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceTcgplayerEnabled ?? true) : false;
	$: showEbay = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceEbayEnabled ?? true) : false;
	$: showManapool = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceManapoolEnabled ?? true) : false;

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

	// Fetch data when component mounts and user is authenticated
	onMount(() => {
		// Load condensed state from localStorage
		const storedCondensed = localStorage.getItem('seeking-list-condensed');
		if (storedCondensed !== null) {
			isCondensed = storedCondensed === 'true';
		}

		fetchScryfallSets();

		// Wait for auth store to initialize if needed
		unsubscribe = auth.subscribe((state) => {
			// Assign to the component-scoped variable
			if (!state.isLoading) {
				if (state.isAuthenticated) {
					fetchSeekingList();
				} else {
					// Handle case where user is not logged in (layout should redirect, but good practice)
					error = 'Please log in to view your seeking list.';
					loading = false;
				}
				// REMOVED: unsubscribe(); // Do not unsubscribe immediately
			}
		});
	});

	// Unsubscribe when the component is destroyed
	// Moved outside the subscribe callback, but still registered during onMount
	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	async function fetchSeekingList() {
		loading = true;
		error = null;

		try {
			// Use fetchWithAuth - it handles token and 401 errors
			const response = await fetchWithAuth(PUBLIC_GET_SEEKING_LIST_FUNCTION_URL);

			// fetchWithAuth returns undefined if it redirects (e.g., on 401)
			if (!response) {
				error = 'Authentication failed while fetching seeking list.';
				console.error(error);
				return; // Stop execution
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
		} catch (e) {
			error = e.message;
			console.error('Error fetching cards:', e);
		} finally {
			loading = false;
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
				error = `Authentication failed while attempting to delete card.`;
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

	async function handleUpdateSettings() {
		if (!selectedCardForSettings) return;
		isSavingSettings = true;
		error = null;

		try {
			// Convert input to cents. If empty, send null to clear.
			let max_price_cap = null;
			if (maxPriceInput !== null && maxPriceInput !== undefined && String(maxPriceInput).trim() !== '') {
				max_price_cap = Math.round(parseFloat(maxPriceInput) * 100);
				if (isNaN(max_price_cap)) throw new Error('Invalid price format');
			}

			const requestBody = {
				partitionKey: selectedCardForSettings.set_code,
				rowKey: `${selectedCardForSettings.collector_number}_${selectedCardForSettings.language}_${selectedCardForSettings.finish}`,
				max_price_cap: max_price_cap
			};

			const response = await fetchWithAuth(PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response) {
				error = `Authentication failed while updating card settings.`;
				return;
			}

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Failed to update settings: ${text}`);
			}

			// Update local state
			cards = cards.map((c) => {
				if (
					c.set_code === selectedCardForSettings.set_code &&
					c.collector_number === selectedCardForSettings.collector_number &&
					c.language === selectedCardForSettings.language &&
					c.finish === selectedCardForSettings.finish
				) {
					return { ...c, max_price_cap: max_price_cap };
				}
				return c;
			});

			showSettingsModal = false;
		} catch (e) {
			error = `Update failed: ${e.message}`;
			console.error('Error updating settings:', e);
		} finally {
			isSavingSettings = false;
		}
	}

	function openSettings(card) {
		selectedCardForSettings = card;
		// Initialize input with current value (convert cents to dollars)
		maxPriceInput =
			card.max_price_cap !== null && card.max_price_cap !== undefined
				? (card.max_price_cap / 100).toFixed(2)
				: '';
		showSettingsModal = true;
		closeMenu();
	}

	function getStockIcon(status) {
		switch (status) {
			case 'available':
				return 'fa-solid fa-circle-check';
			case 'unavailable':
				return 'fa-solid fa-circle-xmark';
			default:
				return 'fa-solid fa-circle-question';
		}
	}

	function getStockColor(status) {
		switch (status) {
			case 'available':
				return 'text-success';
			case 'unavailable':
				return 'text-error';
			default:
				return 'text-muted';
		}
	}

	function getStockStatus(stockValue) {
		if (stockValue === true) {
			return 'available';
		} else if (stockValue === false) {
			return 'unavailable';
		} else {
			return 'unknown';
		}
	}

	// Helper function to ensure legacy Scryfall JPEG URLs in storage are loaded as WebP ('grid')
	function getWebpImageUri(uri) {
		if (!uri) return '';
		if (uri.includes('cards.scryfall.io/normal/')) {
			return uri
				.replace('cards.scryfall.io/normal/', 'cards.scryfall.io/grid/')
				.replace(/\.jpg(\?.*)?$/, '.webp$1');
		}
		return uri;
	}

	// Helper function to map specific set codes for icons
	function getSetIconCode(originalCode) {
		const codeMap = {
			'4bb': '4ed', // Fourth Edition Foreign Black Border -> Fourth Edition
			fbb: '3ed', // Foreign Black Border (Revised) -> Revised Edition (3ED)
			sld: 'pmei', // Secret Lair Drop -> Media Promos
			tsb: 'tsp' // Time Spiral Timeshifted -> Time Spiral
		};
		return codeMap[originalCode.toLowerCase()] || originalCode;
	}

	// Helper function to format price from cents to dollars
	function formatPrice(cents) {
		if (cents === null || cents === undefined) {
			return ''; // Or handle as needed, e.g., return 'N/A'
		}
		const dollars = cents / 100;
		// Format to 2 decimal places and prepend '$'
		return `$${dollars.toFixed(2)}`;
	}

	// Helper function to format price from dollars (no conversion needed)
	function formatDollarPrice(dollars) {
		if (dollars === null || dollars === undefined) {
			return '';
		}
		// Format to 2 decimal places and prepend '$'
		return `$${Number(dollars).toFixed(2)}`;
	}

	const languageMap = {
		en: 'English',
		ja: 'Japanese',
		jp: 'Japanese',
		de: 'German',
		fr: 'French',
		it: 'Italian',
		es: 'Spanish',
		pt: 'Portuguese',
		ru: 'Russian',
		ko: 'Korean',
		kr: 'Korean',
		zht: 'Chinese (T)',
		zhs: 'Chinese (S)'
	};

	function getTCGPlayerUrl(card) {
		let url = `https://www.tcgplayer.com/product/${card.tcgplayer_id}`;
		const params = [];

		if (card.language && languageMap[card.language]) {
			params.push(`Language=${encodeURIComponent(languageMap[card.language])}`);
		}

		if (card.finish) {
			// Default to Normal for nonfoil and others, Foil for foil
			const printing = card.finish === 'foil' ? 'Foil' : 'Normal';
			params.push(`Printing=${printing}`);
		}

		if (params.length > 0) {
			url += `?${params.join('&')}`;
		}

		return url;
	}

	function getEbayUrl(card, map) {
		if (card.ebay_id && getStockStatus(card.ebay_stock) === 'available') {
			const rawId = String(card.ebay_id);
			const cleanId = rawId.includes('|') ? rawId.split('|')[1] : rawId;
			if (/^\d+$/.test(cleanId)) {
				return `https://www.ebay.com/itm/${cleanId}`;
			}
		}
		let lang = card.language !== 'en' && languageMap[card.language] ? languageMap[card.language] : '';
		if (card.language === 'zhs') lang = 'Simplified Chinese';
		if (card.language === 'zht') lang = 'Traditional Chinese';
		const finish = card.finish === 'foil' ? 'foil' : '';
		const set = card.set_name || (map && map[card.set_code.toLowerCase()]) || card.set_code;
		const keywords = `${card.name} ${set} ${lang} ${finish}`.replace(/\s+/g, ' ').trim();
		return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keywords)}&_sop=15`;
	}

	// Function to handle sorting
	function sortBy(key) {
		if (sortKey === key) {
			// If clicking the same key, reverse direction
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// If clicking a new key, set it and default to ascending
			sortKey = key;
			sortDirection = 'asc';
		}
	}

	// Derive all unique set codes present in the cards list for the set filter dropdown
	$: availableSetCodes = [...new Set(cards.map((c) => c.set_code.toUpperCase()))].sort();

	// Reactive sorted & filtered list
	$: filteredCards = cards.filter((card) => {
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const matchesQuery = (
				card.name.toLowerCase().includes(query) ||
				card.set_code.toLowerCase().includes(query) ||
				card.language.toLowerCase().includes(query) ||
				card.finish.toLowerCase().includes(query)
			);
			if (!matchesQuery) return false;
		}

		// Quick filter pills
		if (filterFoilOnly && card.finish.toLowerCase() !== 'foil') {
			return false;
		}

		if (filterSetCode && card.set_code.toUpperCase() !== filterSetCode.toUpperCase()) {
			return false;
		}

		if (filterInStockOnly) {
			const hasStock = (
				(showCardTrader && card.cardtrader_stock === true) ||
				(showTCGPlayer && card.tcgplayer_stock === true) ||
				(showEbay && card.ebay_stock === true) ||
				(showManapool && card.manapool_stock === true)
			);
			if (!hasStock) return false;
		}

		if (filterUnderPriceCap) {
			if (card.max_price_cap === null || card.max_price_cap === undefined) return false;
			const cap = card.max_price_cap;
			const prices = [];
			if (showCardTrader && card.cardtrader_low_price > 0) prices.push(card.cardtrader_low_price);
			if (showTCGPlayer && card.tcgplayer_low_price > 0 && getStockStatus(card.tcgplayer_stock) === 'available') {
				prices.push(Math.round(card.tcgplayer_low_price * 100));
			}
			if (showEbay && card.ebay_low_price > 0 && getStockStatus(card.ebay_stock) === 'available') {
				prices.push(card.ebay_low_price);
			}
			if (showManapool && card.manapool_low_price > 0 && getStockStatus(card.manapool_stock) === 'available') {
				prices.push(card.manapool_low_price);
			}
			const hasPriceUnderCap = prices.some((p) => p <= cap);
			if (!hasPriceUnderCap) return false;
		}

		return true;
	});

	$: sortedCards = [...filteredCards].sort((a, b) => {
		// Handle potentially missing values (treat null/undefined as lowest)
		let aValue = a[sortKey];
		let bValue = b[sortKey];

		// Specific handling for price/stock if needed, e.g., nulls last
		if (sortKey.includes('_price')) {
			const normalizePrice = (card, val) => {
				if (val === null || val === undefined || val <= 0) return null;
				if (sortKey === 'tcgplayer_low_price' && getStockStatus(card.tcgplayer_stock) !== 'available') {
					return null;
				}
				return val;
			};
			aValue = normalizePrice(a, aValue) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
			bValue = normalizePrice(b, bValue) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
		} else if (sortKey.includes('_stock')) {
			// Define a sort order for stock: available (1) > unknown (0) > unavailable (-1)
			const stockOrder = { available: 1, unknown: 0, unavailable: -1 };
			aValue = stockOrder[getStockStatus(aValue)] ?? 0;
			bValue = stockOrder[getStockStatus(bValue)] ?? 0;
		} else if (typeof aValue === 'string' && typeof bValue === 'string') {
			// Case-insensitive sort for strings
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

	function downloadCSV() {
		if (!cards || cards.length === 0) return;

		const headers = [
			'Name',
			'Set Code',
			'Collector Number',
			'Language',
			'Finish',
			'CardTrader Stock',
			'CardTrader Price',
			'TCGPlayer Stock',
			'TCGPlayer Price',
			// 'CardMarket Stock',
			// 'CardMarket Price',
			'eBay Stock',
			'eBay Price',
			'Mana Pool Stock',
			'Mana Pool Price',
			'Max Price Cap'
		];
		const csvRows = [headers.join(',')];

		for (const card of cards) {
			const row = [
				`"${card.name.replace(/"/g, '""')}"`, // Escape quotes
				card.set_code,
				card.collector_number,
				card.language,
				card.finish,
				getStockStatus(card.cardtrader_stock),
				card.cardtrader_low_price !== null && card.cardtrader_low_price !== undefined
					? (card.cardtrader_low_price / 100).toFixed(2)
					: '',
				getStockStatus(card.tcgplayer_stock),
				card.tcgplayer_low_price !== null && card.tcgplayer_low_price !== undefined
					? Number(card.tcgplayer_low_price).toFixed(2)
					: '',
				getStockStatus(card.ebay_stock),
				card.ebay_low_price !== null && card.ebay_low_price !== undefined
					? (card.ebay_low_price / 100).toFixed(2)
					: '',
				getStockStatus(card.manapool_stock),
				card.manapool_low_price !== null && card.manapool_low_price !== undefined
					? (card.manapool_low_price / 100).toFixed(2)
					: '',
				card.max_price_cap !== null && card.max_price_cap !== undefined
					? (card.max_price_cap / 100).toFixed(2)
					: ''
			];
			csvRows.push(row.join(','));
		}

		const csvString = csvRows.join('\n');
		const blob = new Blob([csvString], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'seeking_list.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<svelte:window on:click={closeMenu} on:keydown={handleGlobalKeyDown} />

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
					on:click={() => {
						filterInStockOnly = false;
						filterUnderPriceCap = false;
						filterFoilOnly = false;
						filterSetCode = '';
						searchQuery = '';
					}}
					title="Reset all filters"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{/if}
		</div>
	</div>

	<div class="toolbar-right">
		<div class="card-counter" title="Total sought cards">
			<i class="fa-solid fa-layer-group"></i>
			<span>
				{#if ($auth.user?.membershipTier || '').toLowerCase() === 'banned'}
					<span class="suspended-tag">Suspended</span>
				{:else if isPremiumOrLegacy}
					<strong>{cards.length}</strong> cards
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
			<button class="toolbar-icon-btn" on:click={downloadCSV} title="Export CSV">
				<i class="fa-solid fa-file-csv"></i>
			</button>
			<button
				on:click={toggleCondensed}
				class="toolbar-icon-btn"
				class:active={isCondensed}
				title={isCondensed ? "Expanded view" : "Compact view"}
			>
				<i class="fa-solid {isCondensed ? 'fa-maximize' : 'fa-minimize'}"></i>
			</button>
		</div>
	</div>
</div>

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
	<div class="empty">No cards in seeking list</div>
{:else}
	<div class="seeking-list">
		<table>
			<thead>
				<tr>
					<th on:click={() => sortBy('name')} class:active={sortKey === 'name'}>
						Card
						{#if sortKey === 'name'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					<th on:click={() => sortBy('set_code')} class:active={sortKey === 'set_code'}>
						Set
						{#if sortKey === 'set_code'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					<th on:click={() => sortBy('language')} class:active={sortKey === 'language'}>
						Language
						{#if sortKey === 'language'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					<th on:click={() => sortBy('finish')} class:active={sortKey === 'finish'}>
						Finish
						{#if sortKey === 'finish'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					{#if showCardTrader}
					<th
						on:click={() => sortBy('cardtrader_low_price')}
						class:active={sortKey === 'cardtrader_low_price'}
					>
						CardTrader
						{#if sortKey === 'cardtrader_low_price'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					{/if}
					{#if showTCGPlayer}
					<th
						on:click={() => sortBy('tcgplayer_low_price')}
						class:active={sortKey === 'tcgplayer_low_price'}
					>
						TCGPlayer
						{#if sortKey === 'tcgplayer_low_price'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					{/if}
					<th class="disabled-column display-none" title="CardMarket stock check coming soon">
						CardMarket
						<!-- Add sorting later if needed -->
					</th>
					{#if showEbay}
					<th
						on:click={() => sortBy('ebay_low_price')}
						class:active={sortKey === 'ebay_low_price'}
					>
						EBay
						{#if sortKey === 'ebay_low_price'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					{/if}
					{#if showManapool}
					<th
						on:click={() => sortBy('manapool_low_price')}
						class:active={sortKey === 'manapool_low_price'}
					>
						Mana Pool
						{#if sortKey === 'manapool_low_price'}
							<i
								class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"
							></i>
						{/if}
					</th>
					{/if}
					<th class="actions-header"></th>
					<!-- Not sortable -->
				</tr>
			</thead>
			<tbody>
				{#each sortedCards as card, index (`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`)}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
					<tr
						class:condensed={isCondensed}
						class:selected={selectedKeys.has(getCardKey(card))}
						on:click={(e) => handleRowClick(card, index, e)}
						style={activeMenuId ===
						`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`
							? 'z-index: 50; position: relative;'
							: ''}
					>
						<td data-label="Card">
							<div class="card-info">
								{#if !isCondensed}
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
									<img
										src={getWebpImageUri(card.image_uri)}
										alt={card.name}
										class="card-thumbnail"
										on:click={() => (enlargedCardImage = getWebpImageUri(card.image_uri))}
									/>
								{/if}
								<div class="card-name-group">
									<span>{card.name}</span>
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
								</div>
							</div>
						</td>
						<td data-label="Set" class="set-column">
							<img
								src="https://svgs.scryfall.io/sets/{getSetIconCode(card.set_code)}.svg"
								alt="{card.set_code} set icon"
								title={card.set_code.toUpperCase()}
								class="set-icon"
							/>
						</td>
						<td data-label="Language" class="language-column">{card.language}</td>
						<td data-label="Finish">{card.finish}</td>
						{#if showCardTrader}
						<td data-label="CardTrader" class="vendor-stock-cell">
							{#if card.cardtrader_id}
								<a
									href="https://www.cardtrader.com/cards/{card.cardtrader_id}"
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div class="stock-indicator">
										<i
											class="{getStockIcon(getStockStatus(card.cardtrader_stock))} {getStockColor(
												getStockStatus(card.cardtrader_stock)
											)}"
										></i>
										{#if card.cardtrader_low_price !== null && card.cardtrader_low_price !== undefined}
											<span class="price-text">{formatPrice(card.cardtrader_low_price)}</span>
										{/if}
									</div>
								</a>
							{:else}
								<!-- Show only question mark if CardTrader ID is missing -->
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-question text-muted"
										title="Card not found on CardTrader"
									></i>
									<!-- No price shown when ID is missing -->
								</div>
							{/if}
						</td>
						{/if}
						{#if showTCGPlayer}
						<td data-label="TCGPlayer" class="vendor-stock-cell">
							{#if card.tcgplayer_id}
								<a
									href={getTCGPlayerUrl(card)}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div class="stock-indicator">
										<i
											class="{getStockIcon(getStockStatus(card.tcgplayer_stock))} {getStockColor(
												getStockStatus(card.tcgplayer_stock)
											)}"
										></i>
										{#if card.tcgplayer_low_price > 0 && getStockStatus(card.tcgplayer_stock) === 'available'}
											<span class="price-text">{formatDollarPrice(card.tcgplayer_low_price)}</span>
										{/if}
									</div>
								</a>
							{:else}
								<!-- Show only question mark if TCGPlayer ID is missing -->
								<div class="stock-indicator">
									<i
										class="fa-solid fa-circle-question text-muted"
										title="Card not found on TCGPlayer"
									></i>
									<!-- No price shown when ID is missing -->
								</div>
							{/if}
						</td>
						{/if}
						<td data-label="CardMarket" class="vendor-stock-cell disabled-column display-none">
							<div class="stock-indicator">
								<i
									class="{getStockIcon(getStockStatus(card.cardmarket_stock))} {getStockColor(
										getStockStatus(card.cardmarket_stock)
									)}"
								></i>
								{#if card.cardmarket_low_price !== null && card.cardmarket_low_price !== undefined}
									<span class="price-text">{formatPrice(card.cardmarket_low_price)}</span>
								{/if}
							</div>
						</td>
						{#if showEbay}
						<td data-label="EBay" class="vendor-stock-cell">
							<a
								href={getEbayUrl(card, setCodeToNameMap)}
								target="_blank"
								rel="noopener noreferrer"
								class="vendor-link"
							>
								<div class="stock-indicator">
									<i
										class="{getStockIcon(getStockStatus(card.ebay_stock))} {getStockColor(
											getStockStatus(card.ebay_stock)
										)}"
									></i>
									{#if card.ebay_low_price !== null && card.ebay_low_price !== undefined && getStockStatus(card.ebay_stock) === 'available'}
										<span class="price-text">{formatPrice(card.ebay_low_price)}</span>
									{/if}
								</div>
							</a>
						</td>
						{/if}
						{#if showManapool}
						<td data-label="Mana Pool" class="vendor-stock-cell">
							{#if card.manapool_url}
								<a
									href={card.manapool_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div class="stock-indicator">
										<i
											class="{getStockIcon(getStockStatus(card.manapool_stock))} {getStockColor(
												getStockStatus(card.manapool_stock)
											)}"
										></i>
										{#if card.manapool_low_price !== null && card.manapool_low_price !== undefined && getStockStatus(card.manapool_stock) === 'available'}
											<span class="price-text">{formatPrice(card.manapool_low_price)}</span>
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
						<td data-label="Actions" class="actions-column">
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
									<div class="kebab-dropdown" class:drop-up={index >= sortedCards.length - 2} on:click|stopPropagation>
										<button class="dropdown-item" on:click={() => openSettings(card)}>
											<i class="fa-solid fa-gear"></i> Settings
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
	</div>
{/if}

{#if showSettingsModal && selectedCardForSettings}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => (showSettingsModal = false)}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Card Settings</h2>
				<button class="close-modal-btn" on:click={() => (showSettingsModal = false)}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				<div class="card-details-mini">
					<img src={getWebpImageUri(selectedCardForSettings.image_uri)} alt={selectedCardForSettings.name} />
					<div>
						<h3>{selectedCardForSettings.name}</h3>
						<p>
							{selectedCardForSettings.set_code.toUpperCase()} • {selectedCardForSettings.language.toUpperCase()}
							• {selectedCardForSettings.finish}
						</p>
					</div>
				</div>

				<div class="settings-group">
					<label for="max-price-cap">Max Price Cap ($)</label>
					<p class="setting-description">
						Only receive stock alerts and digests if the price is at or below this threshold. Leave
						empty for no limit.
					</p>
					<div class="input-with-prefix">
						<span>$</span>
						<input
							id="max-price-cap"
							type="number"
							step="0.01"
							min="0"
							bind:value={maxPriceInput}
							placeholder="e.g. 50.00"
							class="modal-input"
						/>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button class="modal-btn secondary" on:click={() => (showSettingsModal = false)}
					>Cancel</button
				>
				<button
					class="modal-btn primary"
					on:click={handleUpdateSettings}
					disabled={isSavingSettings}
				>
					{isSavingSettings ? 'Saving...' : 'Save Settings'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showBulkPriceCapModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => !isProcessingBulkAction && (showBulkPriceCapModal = false)}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Set Price Cap ({selectedKeys.size} Cards)</h2>
				<button class="close-modal-btn" on:click={() => !isProcessingBulkAction && (showBulkPriceCapModal = false)}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				<p class="setting-description">
					Apply a maximum price cap to all <strong>{selectedKeys.size}</strong> selected cards. Leave empty to remove the cap on selected cards.
				</p>
				<div class="settings-group">
					<label for="bulk-price-cap">Max Price Cap ($)</label>
					<div class="input-with-prefix">
						<span>$</span>
						<input
							id="bulk-price-cap"
							type="number"
							step="0.01"
							min="0"
							bind:value={bulkPriceCapInput}
							placeholder="e.g. 25.00"
							class="modal-input"
							disabled={isProcessingBulkAction}
						/>
					</div>
				</div>
				{#if isProcessingBulkAction}
					<div class="bulk-progress-text">
						Updating {bulkActionProgress.current} of {bulkActionProgress.total}...
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={() => (showBulkPriceCapModal = false)}
					disabled={isProcessingBulkAction}
				>
					Cancel
				</button>
				<button
					class="modal-btn primary"
					on:click={handleBulkSetPriceCap}
					disabled={isProcessingBulkAction}
				>
					{isProcessingBulkAction ? 'Applying...' : 'Apply Price Cap'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showBulkDeleteModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => !isProcessingBulkAction && (showBulkDeleteModal = false)}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Delete {selectedKeys.size} Cards?</h2>
				<button class="close-modal-btn" on:click={() => !isProcessingBulkAction && (showBulkDeleteModal = false)}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				<p class="setting-description text-error-desc">
					Are you sure you want to remove <strong>{selectedKeys.size}</strong> selected cards from your Seeking list? This action cannot be undone.
				</p>
				{#if isProcessingBulkAction}
					<div class="bulk-progress-text">
						Deleting {bulkActionProgress.current} of {bulkActionProgress.total}...
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={() => (showBulkDeleteModal = false)}
					disabled={isProcessingBulkAction}
				>
					Cancel
				</button>
				<button
					class="modal-btn danger"
					on:click={handleBulkDelete}
					disabled={isProcessingBulkAction}
				>
					{isProcessingBulkAction ? 'Deleting...' : `Delete ${selectedKeys.size} Cards`}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showImportModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={closeImportModal}>
		<div class="modal-content import-modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<div class="import-modal-title-group">
					<h2>
						<i class="fa-solid fa-file-import"></i>
						{importStep === 'input' ? 'Import Decklist' : importedDeckName || 'Confirm Import'}
					</h2>
					{#if importStep === 'preview'}
						<span class="import-subtitle-badge">
							{visibleImportPreviewCards.length} card{visibleImportPreviewCards.length === 1 ? '' : 's'} shown
						</span>
					{/if}
				</div>
				<button class="close-modal-btn" on:click={closeImportModal} disabled={isResolvingImport || isImportingCards}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>

			<div class="modal-body import-modal-body">
				{#if importError}
					<div class="import-alert error">
						<i class="fa-solid fa-circle-exclamation"></i>
						<span>{importError}</span>
					</div>
				{/if}

				{#if importStep === 'input'}
					<div class="import-mode-tabs">
						<button
							type="button"
							class="import-tab-btn"
							class:active={importMode === 'moxfield'}
							on:click={() => {
								importMode = 'moxfield';
								importError = null;
							}}
							disabled={isResolvingImport}
						>
							<i class="fa-solid fa-link"></i>
							Moxfield URL
						</button>
						<button
							type="button"
							class="import-tab-btn"
							class:active={importMode === 'text'}
							on:click={() => {
								importMode = 'text';
								importError = null;
							}}
							disabled={isResolvingImport}
						>
							<i class="fa-solid fa-paste"></i>
							Text / Clipboard
						</button>
					</div>

					{#if importMode === 'moxfield'}
						<div class="settings-group">
							<label for="moxfield-url-input">Public Moxfield Deck URL</label>
							<p class="setting-description">
								Paste a link to any public Moxfield deck to import its exact printings, set codes, collector numbers, and foil finishes.
							</p>
							<input
								id="moxfield-url-input"
								type="url"
								bind:value={moxfieldUrlInput}
								placeholder="https://www.moxfield.com/decks/..."
								class="modal-input import-full-input"
								disabled={isResolvingImport}
								on:keydown={(e) => e.key === 'Enter' && handlePreviewImport()}
							/>
						</div>
					{:else}
						<div class="settings-group">
							<label for="decklist-text-input">Paste Decklist Text</label>
							<p class="setting-description">
								Supports Moxfield (<code>1 Card Name (SET) 123 *F*</code>), Archidekt, MTGO, Arena, or plain card names (one per line).
							</p>
							<textarea
								id="decklist-text-input"
								rows="8"
								bind:value={decklistTextInput}
								placeholder={"1 City of Traitors (EXO) 143\n1 Lightning Bolt (LEA) 161 *F*\n1 Lotus Petal (TMP) 294"}
								class="modal-input import-textarea"
								disabled={isResolvingImport}
							></textarea>

							<div class="import-defaults-row">
								<div class="import-default-field">
									<label for="import-default-finish">Default Finish</label>
									<select id="import-default-finish" bind:value={importDefaultFinish} class="import-select" disabled={isResolvingImport}>
										<option value="nonfoil">Non-Foil</option>
										<option value="foil">Foil</option>
									</select>
								</div>
								<div class="import-default-field">
									<label for="import-default-lang">Language</label>
									<select id="import-default-lang" bind:value={importDefaultLanguage} class="import-select" disabled={isResolvingImport}>
										{#each Object.entries(languageMap) as [code, label]}
											{#if code !== 'jp' && code !== 'kr'}
												<option value={code}>{label}</option>
											{/if}
										{/each}
									</select>
								</div>
							</div>
						</div>
					{/if}

					<label class="import-checkbox-row">
						<input
							type="checkbox"
							bind:checked={excludeBasicLands}
							disabled={isResolvingImport}
						/>
						<span>Exclude standard Basic Lands (Plains, Island, Swamp, Mountain, Forest, Wastes)</span>
					</label>

					{#if isResolvingImport && importResolveStatus}
						<div class="import-status-banner">
							<i class="fa-solid fa-circle-notch fa-spin"></i>
							<span>{importResolveStatus}</span>
						</div>
					{/if}
				{:else}
					<div class="import-preview-toolbar">
						<label class="import-checkbox-row compact">
							<input
								type="checkbox"
								bind:checked={excludeBasicLands}
								on:change={handleToggleExcludeBasicLands}
								disabled={isImportingCards}
							/>
							<span>
								Exclude Basic Lands
								{#if hiddenBasicLandCount > 0}
									<small>({hiddenBasicLandCount} basic land{hiddenBasicLandCount === 1 ? '' : 's'})</small>
								{/if}
							</span>
						</label>

						<div class="import-preview-actions">
							<button
								type="button"
								class="import-mini-btn"
								on:click={selectAllImportPreview}
								disabled={isImportingCards}
							>
								Select All
							</button>
							<button
								type="button"
								class="import-mini-btn"
								on:click={deselectAllImportPreview}
								disabled={isImportingCards}
							>
								Clear
							</button>
						</div>
					</div>

					{#if !isPremiumOrLegacy}
						<div class="import-slot-notice" class:warning={remainingBasicSlots === 0 || selectedImportCards.length >= remainingBasicSlots}>
							<i class="fa-solid fa-circle-info"></i>
							<span>
								Basic Tier: <strong>{cards.length} / 25</strong> slots used ({remainingBasicSlots} remaining).
								{#if selectedImportCards.length > 0}
									Importing <strong>{Math.min(selectedImportCards.length, remainingBasicSlots)}</strong> card{Math.min(selectedImportCards.length, remainingBasicSlots) === 1 ? '' : 's'}.
								{/if}
							</span>
						</div>
					{/if}

					<div class="import-preview-list">
						{#each visibleImportPreviewCards as item (item.previewKey)}
							<div
								class="import-preview-row"
								class:selected={item.selected && !item.alreadyExists}
								class:exists={item.alreadyExists}
							>
								<label class="import-row-check">
									<input
										type="checkbox"
										checked={item.selected && !item.alreadyExists}
										disabled={item.alreadyExists || isImportingCards || (!item.selected && !isPremiumOrLegacy && selectedImportCards.length >= remainingBasicSlots)}
										on:change={(e) => {
											item.selected = e.currentTarget.checked;
											importPreviewCards = [...importPreviewCards];
										}}
									/>
								</label>

								<img
									src={getWebpImageUri(item.image_uri)}
									alt={item.name}
									class="import-row-thumb"
									loading="lazy"
								/>

								<div class="import-row-info">
									<div class="import-row-name">{item.name}</div>
									<div class="import-row-meta">
										<img
											src="https://svgs.scryfall.io/sets/{getSetIconCode(item.set_code)}.svg"
											alt={item.set_code}
											class="import-set-icon"
										/>
										<span>{item.set_code.toUpperCase()} #{item.collector_number}</span>
										<span>•</span>
										<span>{item.language.toUpperCase()}</span>
									</div>
								</div>

								<div class="import-row-right">
									{#if item.alreadyExists}
										<span class="import-exists-badge">Already in Seeking</span>
									{:else}
										<button
											type="button"
											class="import-finish-pill"
											class:foil={item.finish === 'foil'}
											on:click={() => toggleImportCardFinish(item)}
											disabled={isImportingCards}
											title="Click to toggle Foil / Nonfoil"
										>
											{item.finish === 'foil' ? '✦ Foil' : 'Nonfoil'}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					{#if isImportingCards}
						<div class="import-progress-box">
							<div class="import-progress-label">
								<span>Importing cards ({importProgress.current} / {importProgress.total})...</span>
								<span>{Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%</span>
							</div>
							<div class="import-progress-track">
								<div
									class="import-progress-fill"
									style="width: {Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%"
								></div>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<div class="modal-footer">
				{#if importStep === 'preview'}
					<button
						type="button"
						class="modal-btn secondary"
						on:click={() => {
							importStep = 'input';
							importError = null;
						}}
						disabled={isImportingCards}
					>
						<i class="fa-solid fa-arrow-left"></i> Back
					</button>
					<button
						type="button"
						class="modal-btn primary"
						on:click={handleConfirmImport}
						disabled={isImportingCards || selectedImportCards.length === 0 || (!isPremiumOrLegacy && remainingBasicSlots === 0)}
					>
						{#if isImportingCards}
							<i class="fa-solid fa-circle-notch fa-spin"></i> Importing...
						{:else}
							Import {Math.min(selectedImportCards.length, remainingBasicSlots)} Card{Math.min(selectedImportCards.length, remainingBasicSlots) === 1 ? '' : 's'}
						{/if}
					</button>
				{:else}
					<button
						type="button"
						class="modal-btn secondary"
						on:click={closeImportModal}
						disabled={isResolvingImport}
					>
						Cancel
					</button>
					<button
						type="button"
						class="modal-btn primary"
						on:click={handlePreviewImport}
						disabled={isResolvingImport}
					>
						{#if isResolvingImport}
							<i class="fa-solid fa-circle-notch fa-spin"></i> Resolving...
						{:else}
							Preview Cards <i class="fa-solid fa-arrow-right"></i>
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if selectedKeys.size > 0}
	<aside class="floating-bulk-bar" aria-label="Bulk actions toolbar">
		<div class="bulk-info">
			<span class="bulk-count"><strong>{selectedKeys.size}</strong> card{selectedKeys.size === 1 ? '' : 's'} selected</span>
			<span class="bulk-hint desktop-only">(Shift/Ctrl to multi-select)</span>
		</div>
		<div class="bulk-actions">
			<button class="bulk-btn" on:click={() => (showBulkPriceCapModal = true)}>
				<i class="fa-solid fa-tag"></i> Set Price Cap
			</button>
			<button class="bulk-btn danger" on:click={() => (showBulkDeleteModal = true)}>
				<i class="fa-solid fa-trash"></i> Delete Selected
			</button>
			<button class="bulk-btn secondary" on:click={selectAllFiltered}>
				Select All ({sortedCards.length})
			</button>
			<button class="bulk-btn secondary" on:click={clearSelection} title="Clear selection (Esc)">
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	</aside>
{/if}

<style>
	.seeking-list {
		margin: 2rem auto;
		max-width: 1200px;
		padding: 0 1rem;
		animation: fadeIn 0.5s ease-out;
	}

	.seeking-suspended-banner {
		margin: 1.5rem auto 0.5rem auto;
		max-width: 1200px;
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
		margin: 1.5rem auto 1rem auto;
		max-width: 1200px;
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
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.search-box:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(99, 102, 241, 0.2));
	}

	.search-icon {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.search-input {
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		font-size: 0.85rem;
		outline: none;
		width: 150px;
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
		gap: 0.75rem;
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

	@media (max-width: 768px) {
		.workspace-toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
			padding: 0.75rem;
		}

		.toolbar-left {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}

		.search-box {
			width: 100%;
		}

		.search-input,
		.search-input:focus {
			width: 100%;
		}

		.filter-group {
			width: 100%;
		}

		.toolbar-right {
			justify-content: space-between;
			width: 100%;
		}
	}

	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		background: var(--glass-bg);
		backdrop-filter: blur(var(--backdrop-blur));
		-webkit-backdrop-filter: blur(var(--backdrop-blur));
		border-radius: 12px;
		margin-top: 1rem;
		box-shadow: var(--glass-shadow);
		border: 1px solid var(--glass-border);
	}

	/* Keep rounded corners on the table headers and footers since overflow: hidden was removed to allow kebab menu dropdowns */
	table thead tr:first-child th:first-child {
		border-top-left-radius: 11px;
	}

	table thead tr:first-child th:last-child {
		border-top-right-radius: 11px;
	}

	table tbody tr:last-child td:first-child {
		border-bottom-left-radius: 11px;
	}

	table tbody tr:last-child td:last-child {
		border-bottom-right-radius: 11px;
	}

	th,
	td {
		padding: 1rem;
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
		padding-right: 1.5em;
		white-space: nowrap;
		text-transform: uppercase;
		font-size: 0.85rem;
		letter-spacing: 0.05em;
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


	/* Floating Bulk Actions Toolbar */
	.floating-bulk-bar {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--color-bg-elevated, #1e1e2d);
		border: 1px solid var(--color-border);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		border-radius: 12px;
		padding: 0.75rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		z-index: 900;
		animation: slideUp 0.25s ease-out;
		max-width: 90vw;
	}

	.bulk-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
		color: var(--color-text-primary);
		font-size: 0.9rem;
	}

	.bulk-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bulk-btn {
		background: var(--color-primary);
		color: white;
		border: none;
		padding: 0.4rem 0.85rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		transition: opacity var(--transition-fast), transform var(--transition-fast);
		white-space: nowrap;
	}

	.bulk-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.bulk-btn.danger,
	.modal-btn.danger {
		background: var(--color-error, #ef4444);
		color: white;
		border: none;
	}

	.bulk-btn.secondary {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
	}

	.bulk-btn.secondary:hover {
		background: var(--color-bg-hover);
	}

	.text-error-desc {
		color: var(--color-error) !important;
	}

	.bulk-progress-text {
		font-size: 0.85rem;
		color: var(--color-primary);
		font-weight: 500;
		margin-top: 0.5rem;
	}

	@keyframes slideUp {
		from {
			transform: translate(-50%, 20px);
			opacity: 0;
		}
		to {
			transform: translate(-50%, 0);
			opacity: 1;
		}
	}

	.sort-icon {
		position: absolute;
		right: 0.5em;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.8em;
	}

	th.disabled-column {
		cursor: not-allowed;
		pointer-events: none;
		padding-right: 1rem;
	}
	th.disabled-column:hover {
		background-color: var(--color-bg-secondary);
	}

	.display-none {
		display: none;
	}

	.card-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		text-align: left;
	}

	.card-info img {
		width: 40px;
		height: auto;
		border-radius: 4px;
		transition: all var(--transition-normal);
		opacity: 1;
		margin-right: 1rem;
		box-shadow: var(--shadow-sm);
	}

	.card-info img:hover {
		transform: scale(1.5);
		z-index: 10;
		box-shadow: var(--shadow-md);
	}

	tr.condensed .card-info img {
		width: 0;
		opacity: 0;
		margin-right: 0;
		display: none;
	}

	.vendor-stock-cell {
		text-align: center;
		vertical-align: middle;
		padding-top: 1rem;
		padding-bottom: 1rem;
	}

	.stock-indicator {
		display: inline-block;
		text-align: center;
	}

	.stock-indicator i {
		display: block;
		font-size: 1.1rem;
		margin-bottom: 0.25rem;
		transition: transform var(--transition-fast);
	}

	.vendor-link:hover .stock-indicator i {
		transform: scale(1.1);
	}

	.price-text {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		line-height: 1;
		font-weight: 500;
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

	.language-column {
		text-transform: uppercase;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.disabled-column {
		opacity: 0.5;
		cursor: not-allowed;
		position: relative;
		filter: grayscale(1);
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
		table {
			background: transparent;
			box-shadow: none;
			border: none;
			border-radius: 0;
			display: block;
		}

		thead {
			display: none;
		}

		tbody {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		tbody tr {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			grid-template-areas:
				'cardinfo cardinfo cardinfo'
				'set      language finish';
			background: var(--glass-bg);
			backdrop-filter: blur(var(--backdrop-blur));
			border: 1px solid var(--glass-border);
			border-radius: 12px;
			padding: 1rem;
			box-shadow: var(--shadow-sm);
			margin-bottom: 0;
			position: relative;
			gap: 0.5rem;
		}

		tbody tr:hover td {
			background-color: transparent;
		}

		td {
			border: none;
			padding: 0.5rem;
			text-align: center;
		}

		td[data-label='Card'] {
			grid-area: cardinfo;
			border-bottom: 1px solid var(--color-border);
			margin-bottom: 0.5rem;
			padding-bottom: 0.75rem;
		}

		td[data-label='Card'] .card-info {
			justify-content: center;
			flex-direction: column;
			gap: 0.5rem;
		}

		td[data-label='Card'] .card-name-group {
			align-items: center;
		}

		td[data-label='Card'] .card-info img {
			margin-right: 0;
			width: 60px;
		}

		td[data-label='Card'] .card-info span {
			font-weight: 600;
			font-size: 1.1rem;
			padding: 0 2rem; /* Symmetric padding keeps name centered and prevents overlap with top-right menu */
		}

		td[data-label='Set'] {
			grid-area: set;
		}

		td[data-label='Language'] {
			grid-area: language;
		}

		td[data-label='Finish'] {
			grid-area: finish;
		}

		td[data-label='CardMarket'] {
			display: none;
		}

		td[data-label='Actions'] {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			border-top: none;
			padding-top: 0;
			margin-top: 0;
			background: none;
		}
		td[data-label='CardTrader']::before,
		td[data-label='TCGPlayer']::before,
		td[data-label='EBay']::before,
		td[data-label='Mana Pool']::before {
			content: attr(data-label);
			font-weight: 600;
			color: var(--color-text-secondary);
			display: block;
			margin-bottom: 0.25rem;
			font-size: 0.75rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		td[data-label='CardTrader'],
		td[data-label='TCGPlayer'],
		td[data-label='EBay'],
		td[data-label='Mana Pool'] {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
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
		cursor: zoom-out;
		animation: fadeIn 0.3s ease;
	}

	.enlarged-card {
		max-width: 90vw;
		max-height: 90vh;
		object-fit: contain;
		border-radius: 4.5% / 3.5%; /* Approximate MTG card corner radius ratio */
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

	.search-container {
		display: flex;
		align-items: center;
		background-color: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0 0.5rem;
		margin-right: 0.5rem;
		height: 38px; /* Match button height if possible */
		animation: fadeIn 0.3s ease;
	}

	.search-input {
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		padding: 0.5rem;
		font-size: 0.9rem;
		outline: none;
		width: 150px;
		transition: width var(--transition-normal);
	}

	.search-input:focus {
		width: 200px;
	}

	.clear-search-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.25rem;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.clear-search-btn:hover {
		color: var(--color-text-primary);
	}

	.header-btn.active {
		background-color: var(--color-primary);
		color: var(--color-bg-primary);
		border-color: var(--color-primary);
	}

	/* Modal Styles */
	.modal-content {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		width: 90%;
		max-width: 500px;
		padding: 1.5rem;
		box-shadow: var(--shadow-lg);
		animation: scaleIn 0.3s ease-out;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 1rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}

	.close-modal-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0.5rem;
	}

	.card-details-mini {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 8px;
	}

	.card-details-mini img {
		width: 60px;
		height: auto;
		border-radius: 4px;
	}

	.card-details-mini h3 {
		margin: 0;
		font-size: 1.1rem;
	}

	.card-details-mini p {
		margin: 0.25rem 0 0 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.settings-group {
		margin-bottom: 1.5rem;
	}

	.settings-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--color-text-primary);
	}

	.setting-description {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin-bottom: 1rem;
		line-height: 1.4;
	}

	.input-with-prefix {
		display: flex;
		align-items: center;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0 0.75rem;
		transition: border-color 0.2s;
	}

	.input-with-prefix:focus-within {
		border-color: var(--color-primary);
	}

	.input-with-prefix span {
		color: var(--color-text-muted);
		margin-right: 0.5rem;
	}

	.modal-input {
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		padding: 0.75rem 0;
		font-size: 1rem;
		width: 100%;
		outline: none;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2rem;
		border-top: 1px solid var(--color-border);
		padding-top: 1.5rem;
	}

	.modal-btn {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 600;
		transition: all 0.2s;
	}

	.modal-btn.primary {
		background-color: var(--color-primary);
		color: white;
		border: none;
	}

	.modal-btn.primary:hover:not(:disabled) {
		background-color: var(--color-primary-dark, #0056b3);
		transform: translateY(-1px);
	}

	.modal-btn.secondary {
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
	}

	.modal-btn.secondary:hover {
		background-color: var(--color-bg-hover);
	}

	.modal-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.cap-badge:hover {
		transform: translateY(-1px);
		opacity: 0.9;
	}

	/* Import Decklist Button & Modal */
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

	.import-modal-content {
		max-width: 620px;
		width: 94%;
	}

	.import-modal-title-group {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.import-modal-title-group h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
	}

	.import-subtitle-badge {
		font-size: 0.75rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-weight: 600;
	}

	.import-modal-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.import-alert.error {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.75rem 0.9rem;
		border-radius: 8px;
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #ef4444;
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.import-mode-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		background: var(--color-bg-secondary);
		padding: 0.3rem;
		border-radius: 10px;
		border: 1px solid var(--color-border);
	}

	.import-tab-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.55rem 0.75rem;
		border-radius: 7px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.import-tab-btn.active {
		background: var(--color-primary);
		color: #fff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.import-full-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.7rem 0.85rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.9rem;
	}

	.import-textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 0.85rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-family: monospace;
		font-size: 0.83rem;
		resize: vertical;
		line-height: 1.45;
	}

	.import-defaults-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.import-default-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.import-default-field label {
		font-size: 0.78rem;
		color: var(--color-text-secondary);
		font-weight: 600;
	}

	.import-select {
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.85rem;
	}

	.import-checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.85rem;
		color: var(--color-text-primary);
		cursor: pointer;
		user-select: none;
	}

	.import-checkbox-row.compact {
		font-size: 0.82rem;
	}

	.import-checkbox-row small {
		color: var(--color-text-secondary);
	}

	.import-status-banner {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.85rem;
	}

	.import-preview-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.import-preview-actions {
		display: flex;
		gap: 0.4rem;
	}

	.import-mini-btn {
		padding: 0.3rem 0.65rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}

	.import-mini-btn:hover:not(:disabled) {
		background: var(--color-bg-hover);
	}

	.import-slot-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.8rem;
		border-radius: 8px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.import-slot-notice.warning {
		border-color: rgba(245, 158, 11, 0.45);
		background: rgba(245, 158, 11, 0.1);
		color: #f59e0b;
	}

	.import-preview-list {
		max-height: 340px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-right: 0.25rem;
	}

	.import-preview-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.45rem 0.65rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.import-preview-row.selected {
		border-color: var(--color-primary);
		background: rgba(99, 102, 241, 0.06);
	}

	.import-preview-row.exists {
		opacity: 0.6;
	}

	.import-row-thumb {
		width: 32px;
		height: 44px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.import-row-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.import-row-name {
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.import-row-meta {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		color: var(--color-text-secondary);
	}

	.import-set-icon {
		width: 14px;
		height: 14px;
		filter: var(--set-icon-filter, none);
	}

	.import-row-right {
		flex-shrink: 0;
	}

	.import-exists-badge {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: var(--color-bg-hover);
		color: var(--color-text-secondary);
		font-weight: 600;
	}

	.import-finish-pill {
		font-size: 0.74rem;
		padding: 0.22rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-hover);
		color: var(--color-text-secondary);
		font-weight: 600;
		cursor: pointer;
	}

	.import-finish-pill.foil {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.import-progress-box {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.import-progress-label {
		display: flex;
		justify-content: space-between;
		font-size: 0.78rem;
		color: var(--color-text-secondary);
		font-weight: 600;
	}

	.import-progress-track {
		height: 8px;
		border-radius: 999px;
		background: var(--color-bg-secondary);
		overflow: hidden;
	}

	.import-progress-fill {
		height: 100%;
		background: var(--color-primary);
		transition: width 0.2s ease;
	}
</style>
