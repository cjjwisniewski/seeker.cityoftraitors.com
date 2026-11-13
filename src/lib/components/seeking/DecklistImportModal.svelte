<script>
	import { auth } from '$lib/stores/auth';
	import { fetchWithAuth } from '$lib/utils/api';
	import { SAMPLE_DEMO_DECKS } from '$lib/demo/demoSeed';
	import {
		PUBLIC_ADD_TO_SEEKING_FUNCTION_URL,
		PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL
	} from '$env/static/public';
	import {
		getCardKey,
		languageMap,
		isBasicLandCard,
		parseDecklistText,
		extractScryfallImage,
		getWebpImageUri,
		getSetIconCode
	} from '$lib/utils/seekingUtils';

	export let show = false;
	export let cards = [];
	export let setCodeToNameMap = {};
	export let isPremiumOrLegacy = false;
	export let membershipTier = 'Basic';
	export let preferredFinish = 'nonfoil';
	export let preferredLanguage = 'en';
	export let isBusy = false;
	export let onClose = () => {};
	export let onCardsAdded = () => {};

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
	let wasShown = false;

	$: isBusy = isResolvingImport || isImportingCards;

	$: if (show && !wasShown) {
		wasShown = true;
		importDefaultFinish = preferredFinish || 'nonfoil';
		importDefaultLanguage = preferredLanguage || 'en';
		importStep = 'input';
		importError = null;
		importResolveStatus = '';
		importedDeckName = '';
		importPreviewCards = [];
		isResolvingImport = false;
		isImportingCards = false;
	} else if (!show && wasShown) {
		wasShown = false;
	}

	function handleClose() {
		if (isResolvingImport || isImportingCards) return;
		onClose();
	}

	async function resolveCardsWithScryfall(rawItems) {
		const existingKeySet = new Set(cards.map(getCardKey));
		const resolvedByIndex = new Map();
		const chunkSize = 75;

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
			const finish = item.finish === 'etched' ? 'etched' : (item.finish === 'foil' ? 'foil' : 'nonfoil');
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

			const requestedLang = (item.preset_language
				? item.preset_language
				: importMode === 'moxfield'
					? (importDefaultLanguage || 'en')
					: (item.language || importDefaultLanguage || 'en')
			).toLowerCase();

			const language = availableLanguages.includes(requestedLang)
				? requestedLang
				: (availableLanguages.includes('en') ? 'en' : (availableLanguages[0] || 'en'));

			const cardKey = `${set_code}-${collector_number}-${language}-${finish}`;
			if (previewDedup.has(cardKey)) return;
			previewDedup.add(cardKey);

			const alreadyExists = existingKeySet.has(cardKey);
			const isBasicLand = isBasicLandCard(name, type_line);

			const scryLang = String(scry.lang || 'en').toLowerCase();
			const sameLang = language === scryLang;

			finalPreview.push({
				previewKey: cardKey,
				id: crypto.randomUUID(),
				scryfall_id: sameLang ? (scry.id || item.scryfall_id || null) : null,
				name,
				set_code,
				set_name,
				collector_number,
				language,
				availableLanguages,
				finish,
				oracle_id,
				image_uri,
				tcgplayer_id: sameLang
					? finish === 'etched'
						? scry.tcgplayer_etched_id || null
						: scry.tcgplayer_id || item.tcgplayer_id || null
					: null,
				cardmarket_id: sameLang ? (scry.cardmarket_id || item.cardmarket_id || null) : null,
				demo_scryfall_prices: scry.prices || null,
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
				rawItems = parseDecklistText(decklistTextInput, importDefaultFinish, importDefaultLanguage);
				importedDeckName = 'Decklist Import';
				if (rawItems.length === 0) {
					throw new Error('Could not parse any valid card lines from the text input.');
				}
			}

			const resolved = await resolveCardsWithScryfall(rawItems);
			if (resolved.length === 0) {
				throw new Error('None of the cards could be matched on Scryfall. Please check your card names or format.');
			}

			if (isCapped) {
				let remaining = remainingSlots;
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

	async function handleLoadSampleDeck(preset) {
		if (!preset || isResolvingImport) return;
		importError = null;
		isResolvingImport = true;
		importResolveStatus = `Loading "${preset.title}" via Scryfall...`;
		importedDeckName = preset.title;
		try {
			const rawItems = preset.cards.map((c) => ({
				name: c.name,
				set_code: c.set_code || '',
				collector_number: c.collector_number || '',
				finish: c.finish || preset.defaultFinish || 'nonfoil',
				language: c.language || preset.defaultLanguage || 'en',
				preset_language: c.language || preset.defaultLanguage || 'en'
			}));
			const resolved = await resolveCardsWithScryfall(rawItems);
			if (resolved.length === 0) {
				throw new Error('Could not resolve sample deck cards from Scryfall.');
			}
			if (isCapped) {
				let remaining = remainingSlots;
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
			importError = err.message || 'Failed to resolve sample deck.';
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

	$: tierLimit = membershipTier === 'Legacy' ? Infinity : (membershipTier === 'Premium' ? 150 : 25);
	$: isCapped = tierLimit !== Infinity;
	$: remainingSlots = isCapped ? Math.max(0, tierLimit - cards.length) : Infinity;

	function selectAllImportPreview() {
		let budget = remainingSlots;
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

		const toImport = isCapped
			? selectedImportCards.slice(0, remainingSlots)
			: selectedImportCards;

		importProgress = { current: 0, total: toImport.length, added: 0, skipped: 0 };
		const batchSize = 20;
		const nowIso = new Date().toISOString();
		const importSessionId = crypto.randomUUID();

		try {
			for (let i = 0; i < toImport.length; i += batchSize) {
				const chunk = toImport.slice(i, i + batchSize);
				const batchPayload = chunk.map((c) => ({
					id: c.scryfall_id || c.id || crypto.randomUUID(),
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
					cardmarket_id: c.cardmarket_id,
					...($auth.isDemo ? { demo_scryfall_prices: c.demo_scryfall_prices || null } : {})
				}));

				const res = await fetchWithAuth(PUBLIC_ADD_TO_SEEKING_FUNCTION_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'add_batch',
						import_session_id: importSessionId,
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
					onCardsAdded(result.added);
					importProgress.added += result.added.length;
				}
				importProgress.skipped += result.skipped_count || 0;
				importProgress.current = Math.min(toImport.length, i + chunk.length);
				importProgress = { ...importProgress };

				if (result.limit_reached) {
					break;
				}
			}

			onClose();
		} catch (err) {
			importError = err.message || 'Failed while importing cards.';
		} finally {
			isImportingCards = false;
		}
	}
</script>

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={handleClose}>
		<div class="modal-content import-modal-content" role="dialog" aria-modal="true" aria-label="Import Decklist" on:click|stopPropagation>
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
				<button class="close-modal-btn" aria-label="Close modal" on:click={handleClose} disabled={isResolvingImport || isImportingCards}>
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
							{#if $auth.isDemo}
								<div class="demo-moxfield-notice">
									<i class="fa-solid fa-shield-halved"></i>
									<div>
										<strong>Demo Sample Decks</strong>
										<span>Live Moxfield URL proxying is disabled in Demo Mode to keep the sandbox strictly client-side. Pick a Sample Deck below (resolved live via Scryfall) or switch to the <strong>Text / Clipboard</strong> tab!</span>
									</div>
								</div>

								<div class="demo-sample-deck-list">
									{#each SAMPLE_DEMO_DECKS as preset (preset.id)}
										<button
											type="button"
											class="demo-sample-deck-btn"
											disabled={isResolvingImport}
											on:click={() => handleLoadSampleDeck(preset)}
										>
											<div class="sample-deck-info">
												<strong>{preset.title}</strong>
												<span>{preset.subtitle}</span>
											</div>
											<span class="sample-deck-cta">
												Load Deck <i class="fa-solid fa-arrow-right"></i>
											</span>
										</button>
									{/each}
								</div>
							{:else}
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
							{/if}
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
										<option value="etched">Etched</option>
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

					{#if isCapped}
						<div class="import-slot-notice" class:warning={remainingSlots === 0 || selectedImportCards.length >= remainingSlots}>
							<i class="fa-solid fa-circle-info"></i>
							<span>
								{membershipTier} Tier: <strong>{cards.length} / {tierLimit}</strong> slots used ({remainingSlots} remaining).
								{#if selectedImportCards.length > 0}
									Importing <strong>{Math.min(selectedImportCards.length, remainingSlots)}</strong> card{Math.min(selectedImportCards.length, remainingSlots) === 1 ? '' : 's'}.
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
										disabled={item.alreadyExists || isImportingCards || (!item.selected && isCapped && selectedImportCards.length >= remainingSlots)}
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
												class:foil={item.finish === 'foil' || item.finish === 'etched'}
												on:click={() => toggleImportCardFinish(item)}
												disabled={isImportingCards}
												title="Click to toggle Finish"
											>
												{item.finish === 'etched' ? '✦ Etched' : item.finish === 'foil' ? '✦ Foil' : 'Nonfoil'}
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
						disabled={isImportingCards || selectedImportCards.length === 0 || (isCapped && remainingSlots === 0)}
					>
						{#if isImportingCards}
							<i class="fa-solid fa-circle-notch fa-spin"></i> Importing...
						{:else}
							Import {isCapped ? Math.min(selectedImportCards.length, remainingSlots) : selectedImportCards.length} Card{(isCapped ? Math.min(selectedImportCards.length, remainingSlots) : selectedImportCards.length) === 1 ? '' : 's'}
						{/if}
					</button>
				{:else}
					<button
						type="button"
						class="modal-btn secondary"
						on:click={handleClose}
						disabled={isResolvingImport}
					>
						Cancel
					</button>
					{#if !(importMode === 'moxfield' && $auth.isDemo)}
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
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
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
		animation: fadeIn 0.3s ease;
	}

	.modal-content {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		max-width: 620px;
		width: 94%;
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
		font-size: 1.25rem;
		color: var(--color-text-primary);
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

	.close-modal-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0.5rem;
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

	.settings-group {
		margin-bottom: 0.5rem;
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

	.import-full-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.7rem 0.85rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.9rem;
		outline: none;
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
		outline: none;
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
		margin-bottom: 0;
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

	@media (max-width: 580px) {
		.modal-content {
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

	.demo-moxfield-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.75rem 0.85rem;
		border-radius: 8px;
		background: rgba(88, 101, 242, 0.12);
		border: 1px solid rgba(88, 101, 242, 0.35);
		font-size: 0.84rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.85rem;
	}

	.demo-moxfield-notice i {
		color: #8ea1ff;
		margin-top: 0.15rem;
	}

	.demo-moxfield-notice strong {
		display: block;
		color: var(--color-text-primary);
		margin-bottom: 0.15rem;
	}

	.demo-sample-deck-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.demo-sample-deck-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0.9rem;
		border-radius: 9px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.demo-sample-deck-btn:hover:not(:disabled) {
		border-color: var(--color-primary);
		background: rgba(59, 130, 246, 0.08);
	}

	.sample-deck-info strong {
		display: block;
		font-size: 0.92rem;
		color: var(--color-text-primary);
	}

	.sample-deck-info span {
		display: block;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: 0.1rem;
	}

	.sample-deck-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-primary);
		white-space: nowrap;
	}
</style>
