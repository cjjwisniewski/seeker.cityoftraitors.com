<script>
	import { onMount, onDestroy } from 'svelte'; // Import onDestroy
	import { auth } from '$lib/stores/auth'; // Import auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
	import { getLanguageName } from '$lib/utils/languageUtils';
	import { initExchangeRates, formatHkdPrice, formatJpyPrice, formatTwdPrice } from '$lib/stores/exchangeRate';
	import {
		PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
		PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL,
		PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL,
		PUBLIC_ADD_TO_SEEKING_FUNCTION_URL,
		PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL
	} from '$env/static/public';
	import { env as publicEnv } from '$env/dynamic/public';

	let cards = [];
	let lastChecked = {
		cardtrader: null,
		tcgplayer: null,
		ebay: null,
		manapool: null,
		himarket: null,
		hareruya: null,
		ruten: null
	};
	let checkingStockCardKeys = new Set();
	let stockCheckToast = null; // { type: 'success' | 'warning' | 'error', message: string }
	let stockCheckToastTimer = null;
	let nowTick = Date.now();
	let cooldownInterval = null;
	const MANUAL_CHECK_COOLDOWN_MS = 15 * 60 * 1000;
	const ADMIN_COOLDOWN_MS = 30 * 1000;
	let error = null;
	let loading = true; // Re-declare the loading variable
	let setCodeToNameMap = {}; // Map of set code to full set name from Scryfall
	let unsubscribe; // Declare unsubscribe in the component scope
	let isCondensed = false; // State for condensed view
	let activeMenuId = null; // State for identifying which kebab menu is open

	let showSettingsModal = false;
	let selectedCardForSettings = null;
	let maxPriceInput = '';
	let minConditionInput = '';
	let isSavingSettings = false;
	$: accountMinCondition = ($auth.user?.settings?.minCondition || 'ANY').toUpperCase();

	function formatMinConditionLabel(cond) {
		const normalized = String(cond || 'ANY').toUpperCase();
		switch (normalized) {
			case 'NM':
				return 'NM Only';
			case 'SP':
				return 'SP+';
			case 'MP':
				return 'MP+';
			case 'HP':
				return 'HP+';
			default:
				return 'Any Condition';
		}
	}
	let editLanguageInput = 'en';
	let editFinishInput = 'nonfoil';
	let editPreviewImageUri = '';
	let editAvailableLanguages = ['en'];
	let editLanguageImageMap = {};
	let editAvailableFinishes = ['nonfoil', 'foil'];
	let isLoadingCardPrintInfo = false;
	let settingsModalError = null;

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

		const candidates = [];
		rawItems.forEach((item, idx) => {
			const scry = resolvedByIndex.get(idx);
			if (!scry) return;

			const set_code = (scry.set || item.set_code || '').toLowerCase();
			const collector_number = String(scry.collector_number || item.collector_number || 'N/A');
			const finish = item.finish === 'foil' ? 'foil' : 'nonfoil';
			const name = scry.name || item.name;
			const type_line = scry.type_line || item.type_line || '';
			const oracle_id = scry.oracle_id || item.oracle_id || scry.id;
			const image_uri = extractScryfallImage(scry);
			if (!image_uri || !set_code) return;

			candidates.push({
				item,
				scry,
				set_code,
				collector_number,
				finish,
				name,
				type_line,
				oracle_id,
				image_uri
			});
		});

		// Collect unique printings to batch-validate their printed languages via Scryfall search
		importResolveStatus = 'Validating available card languages...';
		const printingsMap = new Map();
		const uniquePrints = [];
		const seenPrints = new Set();

		for (const cand of candidates) {
			const pKey = `${cand.set_code}-${cand.collector_number.toLowerCase()}`;
			if (!seenPrints.has(pKey) && cand.collector_number !== 'N/A') {
				seenPrints.add(pKey);
				uniquePrints.push({ set_code: cand.set_code, collector_number: cand.collector_number });
			}
		}

		const LANG_BATCH_SIZE = 15;
		for (let i = 0; i < uniquePrints.length; i += LANG_BATCH_SIZE) {
			const chunk = uniquePrints.slice(i, i + LANG_BATCH_SIZE);
			const query = chunk
				.map((p) => `(cn:${encodeURIComponent(p.collector_number)}+set:${encodeURIComponent(p.set_code)})`)
				.join('+OR+');
			try {
				const res = await fetch(`https://api.scryfall.com/cards/search?q=${query}&include_multilingual=true&unique=prints`);
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data?.data)) {
						for (const card of data.data) {
							const key = `${(card.set || '').toLowerCase()}-${String(card.collector_number || '').toLowerCase()}`;
							if (!printingsMap.has(key)) {
								printingsMap.set(key, new Set());
							}
							if (card.lang) {
								printingsMap.get(key).add(card.lang.toLowerCase());
							}
						}
					}
				}
			} catch (e) {
				console.warn('Failed to batch resolve languages for printings:', e);
			}
			if (i + LANG_BATCH_SIZE < uniquePrints.length) {
				await new Promise((r) => setTimeout(r, 80));
			}
		}

		const finalPreview = [];
		const previewDedup = new Set();

		candidates.forEach(({ item, scry, set_code, collector_number, finish, name, type_line, oracle_id, image_uri }) => {
			const set_name = scry.set_name || item.set_name || setCodeToNameMap[set_code] || set_code.toUpperCase();
			const pKey = `${set_code}-${collector_number.toLowerCase()}`;
			const langsSet = printingsMap.get(pKey);

			let availableLanguages = [];
			if (langsSet && langsSet.size > 0) {
				availableLanguages = Array.from(langsSet).filter((l) => languageMap[l] && l !== 'jp' && l !== 'kr');
			}
			if (availableLanguages.length === 0) {
				availableLanguages = ['en'];
			}
			if (!availableLanguages.includes('en') && (langsSet?.has('en') || availableLanguages.length === 0)) {
				availableLanguages.unshift('en');
			}

			const requestedLang = (importMode === 'moxfield'
				? (importDefaultLanguage || 'en')
				: (item.language || importDefaultLanguage || 'en')
			).toLowerCase();

			// Fallback: if requestedLang was not printed for this card, fallback to 'en', or first available
			const language = availableLanguages.includes(requestedLang)
				? requestedLang
				: (availableLanguages.includes('en') ? 'en' : (availableLanguages[0] || 'en'));

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
				availableLanguages,
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

	function updateImportCardLanguage(cardItem, newLang) {
		const existingKeySet = new Set(cards.map(getCardKey));
		const normLang = String(newLang || 'en').toLowerCase();
		const newKey = `${cardItem.set_code}-${cardItem.collector_number}-${normLang}-${cardItem.finish}`;
		const exists = existingKeySet.has(newKey);

		importPreviewCards = importPreviewCards.map((c) => {
			if (c.previewKey === cardItem.previewKey) {
				return {
					...c,
					language: normLang,
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

		// Ignore clicks on links, buttons, inputs, images with zoom, or kebab menu
		if (isInteractiveRowTarget(event.target)) {
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
			// Toggle single item via Ctrl/Cmd + Click
			event.preventDefault();
			toggleCardSelection(card, index);
		} else if (selectedKeys.size > 0) {
			// When selection mode is already active (e.g. after long-press or Ctrl+Click),
			// tapping/clicking additional rows toggles them in/out of the selection.
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

	function resetFilters() {
		filterInStockOnly = false;
		filterUnderPriceCap = false;
		filterFoilOnly = false;
		filterSetCode = '';
		searchQuery = '';
	}

	// Sorting state
	let sortKey = 'name'; // Default sort key
	let sortDirection = 'asc'; // Default sort direction ('asc' or 'desc')

	// Reactive check for authentication status
	$: isAuthenticated = $auth.isAuthenticated;
	$: authLoading = $auth.isLoading;

	// Reactive checks for enabled marketplaces from user settings
	$: isPremiumOrLegacy = $auth.user?.membershipTier === 'Premium' || $auth.user?.membershipTier === 'Legacy';
	$: canManualCheckStock = isPremiumOrLegacy || Boolean($auth.user?.isAdmin);
	$: showCardTrader = $auth.user?.settings?.marketplaceCardtraderEnabled ?? true;
	$: showTCGPlayer = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceTcgplayerEnabled ?? true) : false;
	$: showEbay = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceEbayEnabled ?? false) : false;
	$: showManapool = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceManapoolEnabled ?? true) : false;
	$: showHimarket = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceHimarketEnabled ?? false) : false;
	$: showHareruya = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceHareruyaEnabled ?? false) : false;
	$: showRuten = isPremiumOrLegacy ? ($auth.user?.settings?.marketplaceRutenEnabled ?? false) : false;

	function showStockCheckFeedback(type, message) {
		stockCheckToast = { type, message };
		if (stockCheckToastTimer) clearTimeout(stockCheckToastTimer);
		stockCheckToastTimer = setTimeout(() => {
			stockCheckToast = null;
		}, 4500);
	}

	function formatRelativeTime(isoStr, currentNow = nowTick) {
		if (!isoStr) return null;
		const parsed = Date.parse(isoStr);
		if (isNaN(parsed)) return null;
		const diffSec = Math.max(0, Math.floor((currentNow - parsed) / 1000));
		if (diffSec < 60) return 'Just now';
		const diffMin = Math.floor(diffSec / 60);
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		const diffDays = Math.floor(diffHr / 24);
		return `${diffDays}d ago`;
	}

	function formatExactTimestamp(isoStr) {
		if (!isoStr) return 'No scheduled check recorded yet';
		const parsed = Date.parse(isoStr);
		if (isNaN(parsed)) return 'No scheduled check recorded yet';
		return new Date(parsed).toLocaleString();
	}

	function getCardCooldownRemainingSec(card, currentNow = nowTick) {
		if (!card?.last_manual_check) return 0;
		const parsed = Date.parse(card.last_manual_check);
		if (isNaN(parsed)) return 0;
		const cooldownMs = $auth.user?.isAdmin ? ADMIN_COOLDOWN_MS : MANUAL_CHECK_COOLDOWN_MS;
		const remainingMs = cooldownMs - (currentNow - parsed);
		return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
	}

	function formatCooldownRemaining(seconds) {
		if (!seconds || seconds <= 0) return '';
		if (seconds < 60) return `${seconds}s`;
		return `${Math.ceil(seconds / 60)}m`;
	}

	async function handleManualStockCheck(card) {
		if (!card || !canManualCheckStock) return;
		const cardKey = getCardKey(card);
		if (checkingStockCardKeys.has(cardKey)) return;

		const remainingSec = getCardCooldownRemainingSec(card, Date.now());
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

			// Fallback to updateSeekingCard if dedicated endpoint is not yet provisioned in APIM
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

	// Fetch data when component mounts and user is authenticated
	onMount(() => {
		// Load condensed state from localStorage
		const storedCondensed = localStorage.getItem('seeking-list-condensed');
		if (storedCondensed !== null) {
			isCondensed = storedCondensed === 'true';
		}

		fetchScryfallSets();
		initExchangeRates();
		cooldownInterval = setInterval(() => {
			nowTick = Date.now();
		}, 15000);

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
		if (cooldownInterval) {
			clearInterval(cooldownInterval);
		}
		if (stockCheckToastTimer) {
			clearTimeout(stockCheckToastTimer);
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
			if (data.lastChecked) {
				lastChecked = {
					cardtrader: data.lastChecked.cardtrader || null,
					tcgplayer: data.lastChecked.tcgplayer || null,
					ebay: data.lastChecked.ebay || null,
					manapool: data.lastChecked.manapool || null,
					himarket: data.lastChecked.himarket || null,
					hareruya: data.lastChecked.hareruya || null,
					ruten: data.lastChecked.ruten || null
				};
			}
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

	$: isEditVariantChanged =
		selectedCardForSettings !== null &&
		(editLanguageInput.toLowerCase() !== String(selectedCardForSettings.language || 'en').toLowerCase() ||
			editFinishInput.toLowerCase() !== String(selectedCardForSettings.finish || 'nonfoil').toLowerCase());

	$: isEditVariantDuplicate =
		isEditVariantChanged &&
		selectedCardForSettings !== null &&
		cards.some(
			(c) =>
				c.set_code.toLowerCase() === selectedCardForSettings.set_code.toLowerCase() &&
				String(c.collector_number) === String(selectedCardForSettings.collector_number) &&
				String(c.language || 'en').toLowerCase() === editLanguageInput.toLowerCase() &&
				String(c.finish || 'nonfoil').toLowerCase() === editFinishInput.toLowerCase()
		);

	async function loadCardPrintVariants(card) {
		if (!card || !card.set_code || !card.collector_number || card.collector_number === 'N/A') {
			return;
		}
		isLoadingCardPrintInfo = true;
		try {
			const url = `https://api.scryfall.com/cards/search?q=cn%3A${encodeURIComponent(card.collector_number)}+set%3A${encodeURIComponent(card.set_code)}&include_multilingual=true&unique=prints`;
			const res = await fetch(url);
			if (!res.ok) return;
			const data = await res.json();
			const prints = data.data || [];
			if (prints.length === 0) return;

			const langs = [];
			const imgMap = { ...editLanguageImageMap };
			const finishesSet = new Set();

			for (const p of prints) {
				if (p.lang) {
					const code = p.lang.toLowerCase();
					if (!langs.includes(code)) {
						langs.push(code);
					}
					const img = extractScryfallImage(p);
					if (img) {
						imgMap[code] = img;
					}
				}
				if (Array.isArray(p.finishes)) {
					if (p.finishes.includes('nonfoil')) finishesSet.add('nonfoil');
					if (p.finishes.includes('foil') || p.finishes.includes('etched')) finishesSet.add('foil');
				}
			}

			const currentLang = String(card.language || 'en').toLowerCase();
			if (!langs.includes(currentLang)) {
				langs.unshift(currentLang);
			}
			const currentFinish = String(card.finish || 'nonfoil').toLowerCase();
			finishesSet.add(currentFinish);

			editAvailableLanguages = langs;
			editLanguageImageMap = imgMap;
			editAvailableFinishes = Array.from(finishesSet);
			if (imgMap[editLanguageInput]) {
				editPreviewImageUri = imgMap[editLanguageInput];
			}
		} catch (e) {
			console.warn('Could not load multilingual print variants from Scryfall:', e);
		} finally {
			isLoadingCardPrintInfo = false;
		}
	}

	function handleEditLanguageChange() {
		if (editLanguageImageMap[editLanguageInput]) {
			editPreviewImageUri = editLanguageImageMap[editLanguageInput];
		}
	}

	async function handleUpdateSettings() {
		if (!selectedCardForSettings || isEditVariantDuplicate) return;
		isSavingSettings = true;
		settingsModalError = null;

		try {
			// Convert input to cents. If empty, send null to clear.
			let max_price_cap = null;
			if (maxPriceInput !== null && maxPriceInput !== undefined && String(maxPriceInput).trim() !== '') {
				max_price_cap = Math.round(parseFloat(maxPriceInput) * 100);
				if (isNaN(max_price_cap) || max_price_cap < 0) throw new Error('Invalid price cap format.');
			}

			const min_condition = minConditionInput ? minConditionInput : null;

			const requestBody = {
				partitionKey: selectedCardForSettings.set_code,
				rowKey: `${selectedCardForSettings.collector_number}_${selectedCardForSettings.language}_${selectedCardForSettings.finish}`,
				max_price_cap: max_price_cap,
				min_condition: min_condition,
				new_language: editLanguageInput,
				new_finish: editFinishInput,
				new_image_uri: editPreviewImageUri || selectedCardForSettings.image_uri
			};

			const response = await fetchWithAuth(PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response) {
				settingsModalError = 'Authentication failed while updating card settings.';
				return;
			}

			let result = null;
			try {
				result = await response.json();
			} catch (e) {
				result = null;
			}

			if (!response.ok) {
				throw new Error(result?.message || `Failed to update card (Status ${response.status})`);
			}

			// Update local state
			const oldKey = getCardKey(selectedCardForSettings);
			cards = cards.map((c) => {
				if (getCardKey(c) === oldKey) {
					if (result?.rekeyed) {
						return {
							...c,
							id: result.new_row_key || `${c.collector_number}_${editLanguageInput}_${editFinishInput}`,
							language: editLanguageInput,
							finish: editFinishInput,
							image_uri: result.image_uri || editPreviewImageUri || c.image_uri,
							max_price_cap: max_price_cap,
							min_condition: min_condition,
							cardtrader_stock: false,
							cardtrader_low_price: null,
							cardtrader_condition: null,
							cardtrader_id: '',
							tcgplayer_stock: false,
							tcgplayer_low_price: null,
							tcgplayer_condition: null,
							cardmarket_stock: false,
							cardmarket_low_price: null,
							ebay_stock: false,
							ebay_low_price: null,
							ebay_condition: null,
							ebay_id: '',
							manapool_stock: false,
							manapool_low_price: null,
							manapool_condition: null,
							manapool_id: '',
							manapool_url: '',
							himarket_stock: false,
							himarket_low_price: null,
							himarket_price_hkd: null,
							himarket_condition: null,
							himarket_url: '',
							hareruya_stock: false,
							hareruya_low_price: null,
							hareruya_price_jpy: null,
							hareruya_condition: null,
							hareruya_url: '',
							ruten_stock: false,
							ruten_low_price: null,
							ruten_price_twd: null,
							ruten_condition: null,
							ruten_url: ''
						};
					}
					return { ...c, max_price_cap: max_price_cap, min_condition: min_condition };
				}
				return c;
			});

			showSettingsModal = false;
		} catch (e) {
			settingsModalError = e.message;
			console.error('Error updating card settings:', e);
		} finally {
			isSavingSettings = false;
		}
	}

	function openSettings(card) {
		selectedCardForSettings = card;
		const currentLang = String(card.language || 'en').toLowerCase();
		const currentFinish = String(card.finish || 'nonfoil').toLowerCase();
		editLanguageInput = currentLang;
		editFinishInput = currentFinish;
		editPreviewImageUri = card.image_uri || '';
		editAvailableLanguages = [currentLang];
		editLanguageImageMap = { [currentLang]: card.image_uri || '' };
		editAvailableFinishes = ['nonfoil', 'foil'];
		settingsModalError = null;
		// Initialize input with current value (convert cents to dollars)
		maxPriceInput =
			card.max_price_cap !== null && card.max_price_cap !== undefined
				? (card.max_price_cap / 100).toFixed(2)
				: '';
		minConditionInput = card.min_condition ? String(card.min_condition).toUpperCase() : '';
		showSettingsModal = true;
		closeMenu();
		loadCardPrintVariants(card);
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

	function getLowestOffer(card, ctEnabled = showCardTrader, tcgEnabled = showTCGPlayer, ebayEnabled = showEbay, mpEnabled = showManapool, hmEnabled = showHimarket, hrEnabled = showHareruya, rtEnabled = showRuten) {
		const offers = [];
		if (ctEnabled && getStockStatus(card.cardtrader_stock) === 'available' && card.cardtrader_low_price > 0) {
			offers.push({ vendor: 'cardtrader', cents: Math.round(card.cardtrader_low_price) });
		}
		if (tcgEnabled && getStockStatus(card.tcgplayer_stock) === 'available' && card.tcgplayer_low_price > 0) {
			offers.push({ vendor: 'tcgplayer', cents: Math.round(Number(card.tcgplayer_low_price) * 100) });
		}
		if (ebayEnabled && getStockStatus(card.ebay_stock) === 'available' && card.ebay_low_price > 0) {
			offers.push({ vendor: 'ebay', cents: Math.round(card.ebay_low_price) });
		}
		if (mpEnabled && getStockStatus(card.manapool_stock) === 'available' && card.manapool_low_price > 0) {
			offers.push({ vendor: 'manapool', cents: Math.round(card.manapool_low_price) });
		}
		if (hmEnabled && getStockStatus(card.himarket_stock) === 'available' && card.himarket_low_price > 0) {
			offers.push({ vendor: 'himarket', cents: Math.round(card.himarket_low_price) });
		}
		if (hrEnabled && getStockStatus(card.hareruya_stock) === 'available' && card.hareruya_low_price > 0) {
			offers.push({ vendor: 'hareruya', cents: Math.round(card.hareruya_low_price) });
		}
		if (rtEnabled && ['zht', 'en'].includes((card.language || '').toLowerCase()) && getStockStatus(card.ruten_stock) === 'available' && card.ruten_low_price > 0) {
			offers.push({ vendor: 'ruten', cents: Math.round(card.ruten_low_price) });
		}

		if (offers.length === 0) {
			return { minPriceCents: null, bestVendors: new Set(), offerCount: 0 };
		}

		const minPriceCents = Math.min(...offers.map((o) => o.cents));
		const bestVendors = new Set(offers.filter((o) => o.cents === minPriceCents).map((o) => o.vendor));
		return { minPriceCents, bestVendors, offerCount: offers.length };
	}

	function isBestVendorPrice(card, vendor, ctEnabled = showCardTrader, tcgEnabled = showTCGPlayer, ebayEnabled = showEbay, mpEnabled = showManapool, hmEnabled = showHimarket, hrEnabled = showHareruya, rtEnabled = showRuten) {
		const info = getLowestOffer(card, ctEnabled, tcgEnabled, ebayEnabled, mpEnabled, hmEnabled, hrEnabled, rtEnabled);
		return info.offerCount >= 2 && info.bestVendors.has(vendor);
	}

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
				(showManapool && card.manapool_stock === true) ||
				(showHimarket && card.himarket_stock === true) ||
				(showHareruya && card.hareruya_stock === true) ||
				(showRuten && ['zht', 'en'].includes((card.language || '').toLowerCase()) && card.ruten_stock === true)
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
			if (showHimarket && card.himarket_low_price > 0 && getStockStatus(card.himarket_stock) === 'available') {
				prices.push(card.himarket_low_price);
			}
			if (showHareruya && card.hareruya_low_price > 0 && getStockStatus(card.hareruya_stock) === 'available') {
				prices.push(card.hareruya_low_price);
			}
			if (showRuten && ['zht', 'en'].includes((card.language || '').toLowerCase()) && card.ruten_low_price > 0 && getStockStatus(card.ruten_stock) === 'available') {
				prices.push(card.ruten_low_price);
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

	let displayLimit = 100;
	let scrollY = 0;
	$: showBackToTop = scrollY > 400;

	// Reset display limit when filter, query, or sort order changes
	$: if (searchQuery || filterInStockOnly || filterUnderPriceCap || filterFoilOnly || filterSetCode || sortKey || sortDirection) {
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
			const offer = getLowestOffer(card, showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten);
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
				const offer = getLowestOffer(card, showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten);
				if (offer.minPriceCents !== null) {
					acc.inStockCount += 1;
					acc.totalLowestCents += offer.minPriceCents;
				}
				return acc;
			},
			{ inStockCount: 0, totalLowestCents: 0 }
		);

	function downloadCSV(customCards = null) {
		const targetCards = customCards || (
			selectedKeys.size > 0
				? sortedCards.filter((c) => selectedKeys.has(getCardKey(c)))
				: sortedCards
		);

		if (!targetCards || targetCards.length === 0) {
			showStockCheckFeedback('warning', 'No cards to export.');
			return;
		}

		const headers = [
			'Name',
			'Set Code',
			'Collector Number',
			'Language',
			'Finish',
			'CardTrader Stock',
			'CardTrader Price',
			'CardTrader Condition',
			'TCGPlayer Stock',
			'TCGPlayer Price',
			'TCGPlayer Condition',
			'Mana Pool Stock',
			'Mana Pool Price',
			'Mana Pool Condition',
			// 'CardMarket Stock',
			// 'CardMarket Price',
			'eBay Stock',
			'eBay Price',
			'eBay Condition',
			'HiMarket Stock',
			'HiMarket Price (USD)',
			'HiMarket Price (HKD)',
			'HiMarket Condition',
			'Hareruya Stock',
			'Hareruya Price (USD)',
			'Hareruya Price (JPY)',
			'Hareruya Condition',
			'Ruten Stock',
			'Ruten Price (USD)',
			'Ruten Price (TWD)',
			'Ruten Condition',
			'Max Price Cap',
			'Min Condition'
		];
		const csvRows = [headers.join(',')];

		for (const card of targetCards) {
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
				card.cardtrader_condition || '',
				getStockStatus(card.tcgplayer_stock),
				card.tcgplayer_low_price !== null && card.tcgplayer_low_price !== undefined
					? Number(card.tcgplayer_low_price).toFixed(2)
					: '',
				card.tcgplayer_condition || '',
				getStockStatus(card.manapool_stock),
				card.manapool_low_price !== null && card.manapool_low_price !== undefined
					? (card.manapool_low_price / 100).toFixed(2)
					: '',
				card.manapool_condition || '',
				getStockStatus(card.ebay_stock),
				card.ebay_low_price !== null && card.ebay_low_price !== undefined
					? (card.ebay_low_price / 100).toFixed(2)
					: '',
				card.ebay_condition || '',
				getStockStatus(card.himarket_stock),
				card.himarket_low_price !== null && card.himarket_low_price !== undefined
					? (card.himarket_low_price / 100).toFixed(2)
					: '',
				card.himarket_price_hkd !== null && card.himarket_price_hkd !== undefined
					? Number(card.himarket_price_hkd).toFixed(2)
					: '',
				card.himarket_condition || '',
				getStockStatus(card.hareruya_stock),
				card.hareruya_low_price !== null && card.hareruya_low_price !== undefined
					? (card.hareruya_low_price / 100).toFixed(2)
					: '',
				card.hareruya_price_jpy !== null && card.hareruya_price_jpy !== undefined
					? Math.round(Number(card.hareruya_price_jpy))
					: '',
				card.hareruya_condition || '',
				['zht', 'en'].includes((card.language || '').toLowerCase()) ? getStockStatus(card.ruten_stock) : 'unsupported',
				card.ruten_low_price !== null && card.ruten_low_price !== undefined
					? (card.ruten_low_price / 100).toFixed(2)
					: '',
				card.ruten_price_twd !== null && card.ruten_price_twd !== undefined
					? Math.round(Number(card.ruten_price_twd))
					: '',
				card.ruten_condition || '',
				card.max_price_cap !== null && card.max_price_cap !== undefined
					? (card.max_price_cap / 100).toFixed(2)
					: '',
				card.min_condition || ''
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
		showStockCheckFeedback(
			'success',
			`Exported ${targetCards.length} card${targetCards.length === 1 ? '' : 's'} to CSV`
		);
	}

	let isCopiedDecklist = false;
	let copyDecklistTimer = null;

	function formatCardAsDecklistLine(card) {
		if (!card || !card.name) return '';
		const setCode = (card.set_code || '').toUpperCase();
		const cn = card.collector_number || '';
		const isFoil = String(card.finish || '').toLowerCase() === 'foil';
		const isEtched = String(card.finish || '').toLowerCase() === 'etched';

		let line = `1 ${card.name}`;
		if (setCode && cn) {
			line += ` (${setCode}) ${cn}`;
		} else if (setCode) {
			line += ` (${setCode})`;
		}

		if (isFoil) {
			line += ' *F*';
		} else if (isEtched) {
			line += ' *E*';
		}

		return line;
	}

	async function copyDecklistToClipboard(customCards = null) {
		const targetCards = customCards || (
			selectedKeys.size > 0
				? sortedCards.filter((c) => selectedKeys.has(getCardKey(c)))
				: sortedCards
		);

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

<svelte:window on:click={closeMenu} on:keydown={handleGlobalKeyDown} bind:scrollY={scrollY} />

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
				title={isCondensed ? 'Expanded view' : 'Compact view'}
			>
				<i class="fa-solid {isCondensed ? 'fa-maximize' : 'fa-minimize'}"></i>
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
	<div class="empty">No cards in seeking list</div>
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
		<div class="table-scroll-container">
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
						<th class="disabled-column display-none" title="CardMarket stock check coming soon">
							CardMarket
							<!-- Add sorting later if needed -->
						</th>
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
						<th class="actions-header col-actions"></th>
						<!-- Not sortable -->
					</tr>
				</thead>
				<tbody>
					{#each displayedCards as card, index (`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`)}
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
									{#if (card.max_price_cap !== null && card.max_price_cap !== undefined) || card.min_condition}
										<div class="card-badges-row">
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
						{#if showCardTrader}
						<td data-label="CardTrader" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'cardtrader', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
							{#if card.cardtrader_id}
								<a
									href="https://www.cardtrader.com/cards/{card.cardtrader_id}"
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'cardtrader', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
						<td data-label="TCGPlayer" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'tcgplayer', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
							{#if card.tcgplayer_id}
								<a
									href={getTCGPlayerUrl(card)}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'tcgplayer', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
						{#if showManapool}
						<td data-label="Mana Pool" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'manapool', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
							{#if card.manapool_url}
								<a
									href={card.manapool_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'manapool', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
						<td data-label="CardMarket" class="vendor-stock-cell col-vendor disabled-column display-none">
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
						<td data-label="EBay" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'ebay', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
							<a
								href={getEbayUrl(card, setCodeToNameMap)}
								target="_blank"
								rel="noopener noreferrer"
								class="vendor-link"
							>
								<div
									class="stock-indicator"
									class:best-price={isBestVendorPrice(card, 'ebay', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
						<td data-label="HiMarket" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'himarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
							{#if card.himarket_url}
								<a
									href={card.himarket_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'himarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
						<td data-label="Hareruya" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'hareruya', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
							{#if card.hareruya_url}
								<a
									href={card.hareruya_url}
									target="_blank"
									rel="noopener noreferrer"
									class="vendor-link"
								>
									<div
										class="stock-indicator"
										class:best-price={isBestVendorPrice(card, 'hareruya', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
						<td data-label="Ruten" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendorPrice(card, 'ruten', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}>
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
										class:best-price={isBestVendorPrice(card, 'ruten', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten)}
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
											{@const cooldownSec = getCardCooldownRemainingSec(card, nowTick)}
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

{#if showSettingsModal && selectedCardForSettings}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => !isSavingSettings && (showSettingsModal = false)}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Edit Card</h2>
				<button class="close-modal-btn" on:click={() => !isSavingSettings && (showSettingsModal = false)}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				{#if settingsModalError}
					<div class="import-alert error" style="margin-bottom: 1rem;">
						<i class="fa-solid fa-circle-exclamation"></i>
						<span>{settingsModalError}</span>
					</div>
				{/if}

				<div class="card-details-mini">
					<img
						src={getWebpImageUri(editPreviewImageUri || selectedCardForSettings.image_uri)}
						alt={selectedCardForSettings.name}
					/>
					<div>
						<h3>{selectedCardForSettings.name}</h3>
						<p>
							{selectedCardForSettings.set_code.toUpperCase()} #{selectedCardForSettings.collector_number}
							• {editLanguageInput.toUpperCase()}
							• {editFinishInput === 'foil' ? '✦ Foil' : 'Nonfoil'}
						</p>
					</div>
				</div>

				<div class="edit-variant-grid">
					<div class="settings-group">
						<label for="edit-card-language">
							Language
							{#if isLoadingCardPrintInfo}
								<i class="fa-solid fa-circle-notch fa-spin" style="font-size: 0.75rem; margin-left: 0.35rem;"></i>
							{/if}
						</label>
						<select
							id="edit-card-language"
							bind:value={editLanguageInput}
							on:change={handleEditLanguageChange}
							class="modal-input edit-select-input"
							disabled={isSavingSettings}
						>
							{#each editAvailableLanguages as langCode}
								<option value={langCode}>
									{getLanguageName(langCode)} ({langCode.toUpperCase()})
								</option>
							{/each}
						</select>
					</div>

					<div class="settings-group">
						<span class="edit-field-label">Finish</span>
						<div class="edit-finish-segmented" role="group" aria-label="Card Finish">
							<button
								type="button"
								class="edit-finish-option"
								class:active={editFinishInput === 'nonfoil'}
								disabled={isSavingSettings || !editAvailableFinishes.includes('nonfoil')}
								on:click={() => (editFinishInput = 'nonfoil')}
							>
								Non-Foil
							</button>
							<button
								type="button"
								class="edit-finish-option foil"
								class:active={editFinishInput === 'foil'}
								disabled={isSavingSettings || !editAvailableFinishes.includes('foil')}
								on:click={() => (editFinishInput = 'foil')}
							>
								✦ Foil
							</button>
						</div>
					</div>
				</div>

				{#if isEditVariantDuplicate}
					<div class="import-alert error" style="margin-bottom: 1rem;">
						<i class="fa-solid fa-triangle-exclamation"></i>
						<span>This language and finish combination is already in your Seeking list.</span>
					</div>
				{:else if isEditVariantChanged}
					<div class="edit-rekey-notice">
						<i class="fa-solid fa-arrows-rotate"></i>
						<span>Switching language or finish will reset current stock statuses for this card and trigger a fresh stock check.</span>
					</div>
				{/if}

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
							disabled={isSavingSettings}
						/>
					</div>
				</div>

				<div class="settings-group">
					<label for="edit-min-condition">Minimum Condition</label>
					<p class="setting-description">
						Ignore listings graded worse than this condition. Defaults to your account-wide setting.
					</p>
					<select
						id="edit-min-condition"
						bind:value={minConditionInput}
						class="modal-input edit-select-input"
						disabled={isSavingSettings}
					>
						<option value="">Account Default ({formatMinConditionLabel(accountMinCondition)})</option>
						<option value="ANY">Any Condition</option>
						<option value="HP">Heavily Played or Better (HP+)</option>
						<option value="MP">Moderately Played or Better (MP+)</option>
						<option value="SP">Slightly / Lightly Played or Better (SP+)</option>
						<option value="NM">Near Mint Only (NM)</option>
					</select>
				</div>

				{#if canManualCheckStock}
					{@const modalCooldownSec = getCardCooldownRemainingSec(selectedCardForSettings, nowTick)}
					{@const isModalChecking = checkingStockCardKeys.has(getCardKey(selectedCardForSettings))}
					<div class="manual-check-box">
						<div class="manual-check-info">
							<span class="manual-check-title">
								<i class="fa-solid fa-bolt"></i> On-Demand Stock Check
							</span>
							<span class="manual-check-sub">
								{#if selectedCardForSettings.last_manual_check}
									Last manual check: {formatRelativeTime(selectedCardForSettings.last_manual_check, nowTick) || 'Recently'}
								{:else}
									Queue an immediate check across your enabled marketplaces.
								{/if}
							</span>
						</div>
						<button
							type="button"
							class="manual-check-btn"
							disabled={isSavingSettings || isModalChecking || modalCooldownSec > 0 || isEditVariantChanged}
							title={isEditVariantChanged
								? 'Save your language/finish changes to automatically queue a fresh check'
								: modalCooldownSec > 0
									? `Available again in ${formatCooldownRemaining(modalCooldownSec)}`
									: 'Check stock now'}
							on:click={() => handleManualStockCheck(selectedCardForSettings)}
						>
							{#if isModalChecking}
								<i class="fa-solid fa-arrows-rotate fa-spin"></i> Checking...
							{:else if modalCooldownSec > 0}
								<i class="fa-regular fa-clock"></i> Cooldown ({formatCooldownRemaining(modalCooldownSec)})
							{:else}
								<i class="fa-solid fa-arrows-rotate"></i> Check Now
							{/if}
						</button>
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={() => (showSettingsModal = false)}
					disabled={isSavingSettings}
				>
					Cancel
				</button>
				<button
					class="modal-btn primary"
					on:click={handleUpdateSettings}
					disabled={isSavingSettings || isEditVariantDuplicate}
				>
					{isSavingSettings ? 'Saving...' : 'Save Changes'}
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

							<div class="import-defaults-row" style="margin-top: 0.75rem;">
								<div class="import-default-field">
									<label for="moxfield-default-lang">Language</label>
									<select id="moxfield-default-lang" bind:value={importDefaultLanguage} class="import-select" disabled={isResolvingImport}>
										{#each Object.entries(languageMap) as [code, label]}
											{#if code !== 'jp' && code !== 'kr'}
												<option value={code}>{label}</option>
											{/if}
										{/each}
									</select>
								</div>
							</div>
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

								<div class="import-row-content">
									<div class="import-row-info">
										<div class="import-row-name" title={item.name}>{item.name}</div>
										<div class="import-row-meta">
											<img
												src="https://svgs.scryfall.io/sets/{getSetIconCode(item.set_code)}.svg"
												alt={item.set_code}
												class="import-set-icon"
											/>
											<span>{item.set_code.toUpperCase()} #{item.collector_number}</span>
										</div>
									</div>

									<div class="import-row-right">
										{#if item.alreadyExists}
											<span class="import-exists-badge">Already in Seeking</span>
										{:else}
											{#if item.availableLanguages && item.availableLanguages.length > 1}
												<select
													class="import-lang-mini-select"
													value={item.language}
													on:change={(e) => updateImportCardLanguage(item, e.currentTarget.value)}
													disabled={isImportingCards}
													title="Change card language"
												>
													{#each item.availableLanguages as code}
														<option value={code}>{code.toUpperCase()}</option>
													{/each}
												</select>
											{:else}
												<span class="import-lang-static-badge" title="Card printing is {item.language.toUpperCase()} only">
													{item.language.toUpperCase()}
												</span>
											{/if}

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
			{#if selectedCostSummary.inStockCount > 0}
				<span class="bulk-cost-pill" title="Estimated lowest total for {selectedCostSummary.inStockCount} in-stock selected card(s)">
					<i class="fa-solid fa-sack-dollar"></i>
					Est. {formatPrice(selectedCostSummary.totalLowestCents)} ({selectedCostSummary.inStockCount} in stock)
				</span>
			{/if}
			<span class="bulk-hint desktop-only">(Shift/Ctrl to multi-select)</span>
		</div>
		<div class="bulk-actions">
			<button class="bulk-btn secondary" on:click={() => copyDecklistToClipboard()} title="Copy selected cards as Decklist (Moxfield / Text format)">
				<i class="fa-solid fa-copy"></i> Copy ({selectedKeys.size})
			</button>
			<button class="bulk-btn secondary" on:click={() => downloadCSV()} title="Export selected cards as CSV">
				<i class="fa-solid fa-file-csv"></i> CSV ({selectedKeys.size})
			</button>
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

	/* Keep rounded corners on the table headers and footers */
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

	/* Column Sizing for Scalable Multi-Provider Support */
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

	.col-actions {
		width: 46px;
		min-width: 42px;
		max-width: 48px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	/* Sticky Card Column on Desktop Horizontal Scroll */
	@media (min-width: 769px) {
		th.col-card {
			position: sticky;
			left: 0;
			z-index: 15;
			background: var(--color-bg-secondary);
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

	th.disabled-column {
		cursor: not-allowed;
		pointer-events: none;
		padding-right: 0.5rem;
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

		td[data-label='CardMarket'] {
			display: none;
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

		td[data-label='CardTrader'],
		td[data-label='TCGPlayer'],
		td[data-label='EBay'],
		td[data-label='eBay'],
		td[data-label='Mana Pool'],
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

		/* Highlight entire vendor tile green for best price on mobile */
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

		/* Reset inner price circling on mobile so only the tile is highlighted */
		td.vendor-stock-cell .stock-indicator.best-price {
			background: transparent !important;
			border: none !important;
			box-shadow: none !important;
			padding: 0 !important;
			border-radius: 0 !important;
			width: 100% !important;
		}

		td[data-label='CardTrader']::before,
		td[data-label='TCGPlayer']::before,
		td[data-label='EBay']::before,
		td[data-label='eBay']::before,
		td[data-label='Mana Pool']::before,
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

		.desktop-only {
			display: none !important;
		}

		.floating-bulk-bar {
			left: 0.75rem;
			right: 0.75rem;
			bottom: 0.75rem;
			transform: none;
			max-width: none;
			width: auto;
			box-sizing: border-box;
			flex-direction: column;
			align-items: stretch;
			gap: 0.6rem;
			padding: 0.75rem 0.85rem;
		}

		.bulk-info {
			flex-wrap: wrap;
			justify-content: space-between;
			white-space: normal;
			font-size: 0.82rem;
		}

		.bulk-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.4rem;
			width: 100%;
		}

		.bulk-btn {
			flex: 1 1 auto;
			justify-content: center;
			padding: 0.42rem 0.6rem;
			font-size: 0.78rem;
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

	/* Modal Styles */
	.modal-content {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		width: 100%;
		max-width: 500px;
		max-height: calc(100vh - 1.5rem);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 1.35rem;
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

	.import-row-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
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
		display: flex;
		align-items: center;
		gap: 0.45rem;
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

	.import-lang-static-badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.18rem 0.4rem;
		border-radius: 6px;
		background: var(--color-bg-hover);
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
		line-height: 1.2;
		white-space: nowrap;
	}

	.import-lang-mini-select {
		background: var(--color-bg-hover);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.18rem 0.35rem;
		cursor: pointer;
		outline: none;
		transition: all var(--transition-fast);
		height: 27px;
		line-height: 1.2;
		white-space: nowrap;
	}

	.import-lang-mini-select:hover:not(:disabled) {
		border-color: var(--color-primary);
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
		height: 27px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		white-space: nowrap;
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

	/* Inline Variant Pills & Card Edit Modal Controls */
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

	.edit-variant-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
		margin-bottom: 0.5rem;
	}

	@media (max-width: 520px) {
		.edit-variant-grid {
			grid-template-columns: 1fr;
		}
	}

	.edit-select-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.88rem;
		height: 40px;
	}

	.edit-field-label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--color-text-primary);
	}

	.edit-finish-segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
		background: var(--color-bg-secondary);
		padding: 0.25rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		height: 40px;
		box-sizing: border-box;
	}

	.edit-finish-option {
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.edit-finish-option.active {
		background: var(--color-primary);
		color: #fff;
	}

	.edit-finish-option.foil.active {
		background: #f59e0b;
		color: #111827;
	}

	.edit-finish-option:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.edit-rekey-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.3);
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		line-height: 1.4;
		margin-bottom: 1rem;
	}

	.edit-rekey-notice i {
		color: var(--color-primary);
		margin-top: 0.15rem;
	}

	/* Lowest Available Price Highlight & Cost Summary */
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

	.bulk-cost-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: #10b981;
		font-size: 0.78rem;
		font-weight: 600;
	}

	/* Last Checked Column Header & Manual Stock Check Styles */
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

	.manual-check-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		margin-top: 1.1rem;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
	}

	.manual-check-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.manual-check-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-primary);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.manual-check-title i {
		color: var(--color-primary);
	}

	.manual-check-sub {
		font-size: 0.76rem;
		color: var(--color-text-secondary);
	}

	.manual-check-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.48rem 0.85rem;
		border-radius: 8px;
		border: 1px solid rgba(99, 102, 241, 0.45);
		background: rgba(99, 102, 241, 0.14);
		color: var(--color-text-primary);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.manual-check-btn:hover:not(:disabled) {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: #fff;
	}

	.manual-check-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
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

	/* Long List Performance & Progressive Loading Trigger */
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

	/* Floating Scroll-to-Top Button for Long Lists */
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

	@media (max-width: 580px) {
		.manual-check-box {
			flex-direction: column;
			align-items: stretch;
			gap: 0.65rem;
		}

		.manual-check-btn {
			justify-content: center;
			width: 100%;
		}

		.import-modal-content {
			width: 96%;
			padding: 1rem;
		}

		.import-modal-title-group h2 {
			font-size: 1.15rem;
		}

		.import-preview-row {
			align-items: flex-start;
			padding: 0.55rem 0.65rem;
		}

		.import-row-check {
			margin-top: 0.25rem;
		}

		.import-row-thumb {
			width: 36px;
			height: 50px;
		}

		.import-row-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.35rem;
		}

		.import-row-name {
			white-space: normal;
			font-size: 0.88rem;
			line-height: 1.3;
		}

		.import-row-right {
			width: 100%;
			justify-content: flex-start;
			gap: 0.4rem;
			flex-wrap: wrap;
		}

		.import-lang-mini-select,
		.import-finish-pill {
			height: 30px;
			padding: 0.25rem 0.6rem;
			font-size: 0.78rem;
		}

		.import-preview-list {
			max-height: min(48vh, 340px);
		}

		.import-preview-toolbar {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.import-preview-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.import-defaults-row {
			grid-template-columns: 1fr;
		}

		.modal-footer {
			margin-top: 1.25rem;
			padding-top: 1rem;
			gap: 0.6rem;
		}

		.modal-btn {
			flex: 1;
			min-height: 44px;
			padding: 0.7rem 1rem;
			text-align: center;
		}
	}
</style>
