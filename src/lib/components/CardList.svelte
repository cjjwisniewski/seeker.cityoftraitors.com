<script>
	import { createEventDispatcher } from 'svelte';
	import { getLanguageName, getAvailableLanguages } from '$lib/utils/languageUtils';
	import { PUBLIC_ADD_TO_SEEKING_FUNCTION_URL } from '$env/static/public';
	import { auth } from '$lib/stores/auth';
	import { fetchWithAuth } from '$lib/utils/api';
	import { parseManaCost } from '$lib/utils/cardSymbols';
	import CardText from '$lib/components/CardText.svelte';

	const dispatch = createEventDispatcher();

	export let cards = [];
	export let hasSearched = false;

	let selectedFinishes = {};
	let buttonStates = {};
	let faceIndices = {};

	// Helper to resolve Scryfall WebP ('grid') image URI with fallbacks
	function getCardImageUri(cardData) {
		const uris = cardData?.image_uris || cardData?.card_faces?.[0]?.image_uris;
		return uris?.grid || uris?.normal || uris?.jpeg;
	}

	function hasMultipleImageFaces(card) {
		return !!(card?.card_faces?.[0]?.image_uris && card?.card_faces?.[1]?.image_uris);
	}

	function getActiveCardImage(card, currentPrint) {
		const faceIdx = faceIndices[card.id] || 0;
		if (faceIdx === 1 && card.card_faces?.[1]?.image_uris) {
			return getCardImageUri(card.card_faces[1]);
		}
		if (faceIdx === 0 && card.card_faces?.[0]?.image_uris) {
			return getCardImageUri(card.card_faces[0]);
		}
		return getCardImageUri(card) || currentPrint?.image_uri;
	}

	function toggleCardFace(cardId) {
		faceIndices[cardId] = faceIndices[cardId] === 1 ? 0 : 1;
		faceIndices = { ...faceIndices };
	}


	function getSetIconCode(originalCode) {
		if (!originalCode) return '';
		const codeMap = {
			'4bb': '4ed',
			fbb: '3ed',
			sld: 'pmei',
			tsb: 'tsp'
		};
		return codeMap[originalCode.toLowerCase()] || originalCode.toLowerCase();
	}

	function formatCardPrice(val) {
		if (val === null || val === undefined || isNaN(Number(val))) return null;
		return `$${parseFloat(val).toFixed(2)}`;
	}

	async function handleSetDropdownOpen(card) {
		if (!card || card.prints_loaded || !card.prints_search_uri) return;

		try {
			const printsResponse = await fetch(card.prints_search_uri);
			if (!printsResponse.ok) return;
			const printsData = await printsResponse.json();
			if (!Array.isArray(printsData?.data)) return;

			const prints = printsData.data
				.map((print) => {
					const cardFaces = print.card_faces && print.card_faces.length > 0 ? print.card_faces : null;
					const manaCost =
						print.mana_cost ||
						(cardFaces ? cardFaces.map((f) => f.mana_cost || '').filter(Boolean).join(' // ') : '') ||
						'';
					const typeLine =
						print.type_line ||
						(cardFaces ? cardFaces.map((f) => f.type_line || '').filter(Boolean).join(' // ') : '') ||
						'';
					const oracleText =
						print.oracle_text ||
						(cardFaces
							? cardFaces
									.map((f) => (cardFaces.length > 1 && f.name ? `[${f.name}]\n${f.oracle_text || ''}` : f.oracle_text || ''))
									.filter(Boolean)
									.join('\n\n')
							: '') ||
						'';
					const flavorText =
						print.flavor_text ||
						(cardFaces ? cardFaces.map((f) => f.flavor_text).filter(Boolean).join('\n\n') : '') ||
						'';
					const power =
						print.power !== undefined
							? print.power
							: cardFaces
								? cardFaces.map((f) => f.power).filter((p) => p !== undefined).join(' // ')
								: null;
					const toughness =
						print.toughness !== undefined
							? print.toughness
							: cardFaces
								? cardFaces.map((f) => f.toughness).filter((t) => t !== undefined).join(' // ')
								: null;
					const loyalty =
						print.loyalty !== undefined
							? print.loyalty
							: cardFaces
								? cardFaces.map((f) => f.loyalty).filter((l) => l !== undefined).join(' // ')
								: null;

					return {
						id: print.id,
						set: print.set_name || print.set,
						set_code: print.set || print.set_code,
						lang: print.lang || 'en',
						collector_number: print.collector_number,
						image_uri: getCardImageUri(print),
						flavor_text: flavorText,
						oracle_text: oracleText,
						type_line: typeLine,
						mana_cost: manaCost,
						power,
						toughness,
						loyalty,
						rarity: print.rarity || card.rarity || 'common',
						artist: print.artist || card.artist || '',
						prices: print.prices || card.prices || null,
						finishes: print.finishes || [],
						tcgplayer_id: print.tcgplayer_id || null,
						tcgplayer_etched_id: print.tcgplayer_etched_id || null,
						cardmarket_id: print.cardmarket_id || null,
						card_faces: cardFaces
					};
				})
				.sort((a, b) => (a.set || '').localeCompare(b.set || ''));

			card.all_prints = prints;
			card.prints_loaded = true;
			sortedCards = sortedCards.map((c) => (c.id === card.id ? { ...card } : c));
		} catch (error) {
			console.error(`Error lazy-loading prints for ${card.name}:`, error);
		}
	}

	async function handleSetChange(card, newPrint) {
		if (!card || !newPrint) return;

		card.set = newPrint.set_code;
		card.collector_number = newPrint.collector_number;
		// Clear any localized upstream IDs from the previous set/printing so failed
		// language fetches can never leave stale cross-set IDs attached
		card.localized_id = null;
		card.localized_tcgplayer_id = null;
		card.localized_tcgplayer_etched_id = null;
		card.localized_cardmarket_id = null;
		card.image_uris = {
			grid: newPrint.image_uri,
			normal: newPrint.image_uri
		};

		if (faceIndices[card.id]) {
			faceIndices[card.id] = 0;
			faceIndices = { ...faceIndices };
		}

		if (!newPrint.languages) {
			newPrint.languages = await getAvailableLanguages(
				newPrint.set_code,
				newPrint.collector_number
			);
		}
		card.available_languages = newPrint.languages;

		const preferredLang = $auth.user?.settings?.preferredLanguage || 'en';
		if (card.available_languages.includes(preferredLang)) {
			card.selected_language = preferredLang;
		} else if (card.available_languages.includes('en')) {
			card.selected_language = 'en';
		} else {
			card.selected_language = card.available_languages[0] || 'en';
		}

		card.flavor_text = newPrint.flavor_text;
		card.oracle_text = newPrint.oracle_text;
		card.type_line = newPrint.type_line;
		card.mana_cost = newPrint.mana_cost;
		card.card_faces = newPrint.card_faces || card.card_faces;
		card.rarity = newPrint.rarity || card.rarity;
		card.artist = newPrint.artist || card.artist;
		card.prices = newPrint.prices || card.prices;
		card.power = newPrint.power ?? card.power;
		card.toughness = newPrint.toughness ?? card.toughness;
		card.loyalty = newPrint.loyalty ?? card.loyalty;
		card.printed_name = undefined;

		const preferredFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';
		const availableFinishes = newPrint.finishes || [];

		if (availableFinishes.includes(preferredFinish)) {
			selectedFinishes[card.id] = preferredFinish;
		} else if (
			availableFinishes.length > 0 &&
			!availableFinishes.includes(selectedFinishes[card.id])
		) {
			selectedFinishes[card.id] = availableFinishes[0];
		}
		selectedFinishes = { ...selectedFinishes };

		if (card.selected_language === (newPrint.lang || 'en')) {
			sortedCards = sortedCards.map((c) => (c.id === card.id ? { ...card } : c));
		} else {
			await handleLanguageChange(card, card.selected_language);
		}
	}

	async function handleLanguageChange(card, language) {
		if (!card || !language) return;

		const currentPrint = card.all_prints?.find(
			(p) => p.set_code === card.set && p.collector_number === card.collector_number
		);
		if (!currentPrint) {
			console.error(
				'Could not find current print for language change:',
				card.set,
				card.collector_number
			);
			return;
		}

		const cardUri = `https://api.scryfall.com/cards/${currentPrint.set_code}/${currentPrint.collector_number}/${language}`;

		try {
			const response = await fetch(cardUri);
			if (!response.ok) throw new Error('Failed to fetch card data');
			const cardData = await response.json();

			const imageUri = getCardImageUri(cardData);
			if (!imageUri) throw new Error('No image URI found');

			const cardFaces = cardData.card_faces && cardData.card_faces.length > 0 ? cardData.card_faces : null;
			const oracle_text =
				cardData.oracle_text ||
				(cardFaces
					? cardFaces
							.map((f) => (cardFaces.length > 1 && (f.printed_name || f.name) ? `[${f.printed_name || f.name}]\n${f.printed_text || f.oracle_text || ''}` : f.printed_text || f.oracle_text || ''))
							.filter(Boolean)
							.join('\n\n')
					: '') ||
				currentPrint.oracle_text;
			const flavor_text =
				cardData.flavor_text ||
				(cardFaces ? cardFaces.map((f) => f.flavor_text).filter(Boolean).join('\n\n') : '') ||
				currentPrint.flavor_text;
			const type_line =
				cardData.printed_type_line ||
				cardData.type_line ||
				(cardFaces ? cardFaces.map((f) => f.printed_type_line || f.type_line || '').filter(Boolean).join(' // ') : '') ||
				currentPrint.type_line;
			const printed_name =
				cardData.printed_name ||
				(cardFaces ? cardFaces.map((f) => f.printed_name || f.name).join(' // ') : '') ||
				card.name;

			card.selected_language = language;
			card.localized_id = cardData.id || null;
			card.localized_tcgplayer_id = cardData.tcgplayer_id || null;
			card.localized_tcgplayer_etched_id = cardData.tcgplayer_etched_id || null;
			card.localized_cardmarket_id = cardData.cardmarket_id || null;
			card.image_uris = { grid: imageUri, normal: imageUri };
			card.flavor_text = flavor_text;
			card.oracle_text = oracle_text;
			card.type_line = type_line;
			card.card_faces = cardFaces || currentPrint.card_faces;
			card.printed_name = printed_name;

			sortedCards = sortedCards.map((c) => {
				if (c.id === card.id) {
					return {
						...c,
						image_uris: { grid: imageUri, normal: imageUri },
						selected_language: language,
						set: currentPrint.set_code,
						collector_number: currentPrint.collector_number,
						flavor_text,
						oracle_text,
						type_line,
						mana_cost: currentPrint.mana_cost,
						card_faces: cardFaces || currentPrint.card_faces,
						printed_name
					};
				}
				return c;
			});
		} catch (error) {
			console.error('Error fetching language-specific card data:', error);
		}
	}

	async function handleLanguageDropdownOpen(card) {
		const print = card.all_prints?.find(
			(p) => p.set_code === card.set && p.collector_number === card.collector_number
		);
		if (!print) return;

		if (!print.languages || print.languages.length <= 1) {
			print.languages = await getAvailableLanguages(print.set_code, print.collector_number);
			card.available_languages = print.languages;
			sortedCards = sortedCards.map((c) => (c.id === card.id ? { ...c, ...card } : c));
		} else if (card.available_languages !== print.languages) {
			card.available_languages = print.languages;
			sortedCards = sortedCards.map((c) => (c.id === card.id ? { ...c, ...card } : c));
		}
	}

	async function handleAddToSeeking(card) {
		if (!$auth.isAuthenticated) {
			console.error('Cannot add card: User not authenticated.');
			buttonStates[card.id] = {
				error: true,
				success: false,
				exists: false,
				message: 'Login or try Demo'
			};
			buttonStates = { ...buttonStates };
			setTimeout(() => {
				buttonStates[card.id] = { error: false, success: false, exists: false };
				buttonStates = { ...buttonStates };
			}, 3000);
			return;
		}

		try {
			buttonStates[card.id] = { error: false, success: false, exists: false };
			buttonStates = { ...buttonStates };

			const currentPrint = card.all_prints?.find(
				(p) => p.set_code === card.set && p.collector_number === card.collector_number
			);
			if (!currentPrint) {
				console.error(
					'Could not find current print for adding to seeking:',
					card.set,
					card.collector_number
				);
				buttonStates[card.id] = {
					error: true,
					success: false,
					exists: false,
					message: 'Invalid print'
				};
				buttonStates = { ...buttonStates };
				setTimeout(() => {
					buttonStates[card.id] = { error: false, success: false, exists: false };
					buttonStates = { ...buttonStates };
				}, 3000);
				return;
			}

			const targetLang = (card.selected_language || 'en').toLowerCase();
			const baseLang = (currentPrint.lang || 'en').toLowerCase();
			const useBaseIds = targetLang === baseLang;

			const selectedFinish = selectedFinishes[card.id] || 'nonfoil';
			const cardPrices = card?.prices;
			const hasCardPrice = Boolean(
				cardPrices &&
					(cardPrices.usd ||
						cardPrices.usd_foil ||
						cardPrices.usd_etched ||
						cardPrices.eur ||
						cardPrices.eur_foil)
			);
			const payload = {
				id: useBaseIds ? (currentPrint.id || card.id || crypto.randomUUID()) : (card.localized_id || crypto.randomUUID()),
				name: card.name,
				set_code: card.set,
				set_name: currentPrint.set || card.set_name,
				collector_number: card.collector_number,
				language: card.selected_language || 'en',
				oracle_id: card.oracle_id,
				image_uri: getCardImageUri(card) || currentPrint.image_uri,
				timestamp: new Date().toISOString(),
				finish: selectedFinish,
				tcgplayer_id:
					selectedFinish === 'etched'
						? useBaseIds
							? currentPrint.tcgplayer_etched_id || null
							: card.localized_tcgplayer_etched_id || null
						: useBaseIds
							? currentPrint.tcgplayer_id || null
							: card.localized_tcgplayer_id || null,
				cardmarket_id: useBaseIds ? (currentPrint.cardmarket_id || null) : (card.localized_cardmarket_id || null),
				...($auth.isDemo
					? { demo_scryfall_prices: hasCardPrice ? cardPrices : currentPrint.prices || null }
					: {})
			};

			const response = await fetchWithAuth(PUBLIC_ADD_TO_SEEKING_FUNCTION_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response) {
				console.warn('Add to seeking aborted because fetchWithAuth triggered a redirect.');
				buttonStates[card.id] = {
					error: true,
					success: false,
					exists: false,
					message: 'Auth failed'
				};
				buttonStates = { ...buttonStates };
				setTimeout(() => {
					buttonStates[card.id] = { error: false, success: false, exists: false };
					buttonStates = { ...buttonStates };
				}, 3000);
				return;
			}

			const result = await response.json();

			if (response.status === 409) {
				buttonStates[card.id] = { error: false, success: false, exists: true };
				buttonStates = { ...buttonStates };

				setTimeout(() => {
					buttonStates[card.id] = { error: false, success: false, exists: false };
					buttonStates = { ...buttonStates };
				}, 3000);
				return;
			}

			if (response.status === 403 && result.error === 'ACCOUNT_BANNED') {
				buttonStates[card.id] = {
					error: true,
					success: false,
					exists: false,
					message: 'Suspended'
				};
				buttonStates = { ...buttonStates };

				setTimeout(() => {
					buttonStates[card.id] = { error: false, success: false, exists: false };
					buttonStates = { ...buttonStates };
				}, 4000);
				return;
			}

			if (response.status === 403 && result.error === 'LIMIT_REACHED') {
				buttonStates[card.id] = {
					error: true,
					success: false,
					exists: false,
					message: 'Limit reached'
				};
				buttonStates = { ...buttonStates };

				setTimeout(() => {
					buttonStates[card.id] = { error: false, success: false, exists: false };
					buttonStates = { ...buttonStates };
				}, 3000);
				return;
			}

			if (!response.ok) {
				throw new Error(`Failed to add card: ${result.message || `HTTP ${response.status}`}`);
			}

			buttonStates[card.id] = { error: false, success: true, exists: false };
			buttonStates = { ...buttonStates };

			setTimeout(() => {
				buttonStates[card.id] = { error: false, success: false, exists: false };
				buttonStates = { ...buttonStates };
			}, 3000);

			dispatch('cardAdded', result);
		} catch (error) {
			console.error('Error adding card to seeking list:', error);
			buttonStates[card.id] = { error: true, success: false, exists: false, message: 'Add failed' };
			buttonStates = { ...buttonStates };

			setTimeout(() => {
				buttonStates[card.id] = { error: false, success: false, exists: false };
				buttonStates = { ...buttonStates };
			}, 3000);
		}
	}

	function handleFinishChange(cardId, finish) {
		selectedFinishes[cardId] = finish;
		selectedFinishes = { ...selectedFinishes };
	}

	const languageFetchPromises = new Map();

	async function ensureCardLanguages(card) {
		if (!card || !card.set || !card.collector_number) return;
		if (card.available_languages && card.available_languages.length > 1) return;
		const key = `${card.id || ''}:${card.set}:${card.collector_number}`;
		if (languageFetchPromises.has(key)) return;

		const fetchPromise = (async () => {
			try {
				const langs = await getAvailableLanguages(card.set, card.collector_number);
				if (langs && langs.length > 0) {
					card.available_languages = langs;
					const currentPrint = card.all_prints?.find(
						(p) => p.set_code === card.set && p.collector_number === card.collector_number
					);
					if (currentPrint) currentPrint.languages = langs;

					const preferredLang = $auth.user?.settings?.preferredLanguage || 'en';
					if (!card.selected_language || card.selected_language === 'en') {
						if (langs.includes(preferredLang) && preferredLang !== 'en') {
							card.selected_language = preferredLang;
							await handleLanguageChange(card, preferredLang);
						}
					}
					sortedCards = sortedCards.map((c) => (c.id === card.id ? { ...c, ...card } : c));
				}
			} catch (err) {
				console.error('Error ensuring card languages:', err);
			}
		})();

		languageFetchPromises.set(key, fetchPromise);
	}

	$: sortedCards = cards.map((card) => {
		if (!card.all_prints) return card;

		return {
			...card,
			all_prints: [...card.all_prints].sort((a, b) => (a.set || '').localeCompare(b.set || ''))
		};
	});

	$: {
		// Only eagerly resolve languages for the first 12 cards (matching CardSearchForm);
		// remaining cards resolve lazily on hover/focus to avoid Scryfall N+1 rate-limit storms.
		if (sortedCards && sortedCards.length > 0) {
			for (const card of sortedCards.slice(0, 12)) {
				if (!card.available_languages || card.available_languages.length <= 1) {
					ensureCardLanguages(card);
				}
			}
		}
	}

	$: {
		const preferredFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';
		let finishesUpdated = false;
		if (sortedCards) {
			for (const card of sortedCards) {
				const currentPrint = card.all_prints?.find(
					(p) => p.set_code === card.set && p.collector_number === card.collector_number
				);
				if (!selectedFinishes[card.id] && currentPrint?.finishes) {
					const availableFinishes = currentPrint.finishes;
					if (availableFinishes.includes(preferredFinish)) {
						selectedFinishes[card.id] = preferredFinish;
					} else if (availableFinishes.length > 0) {
						selectedFinishes[card.id] = availableFinishes[0];
					} else {
						selectedFinishes[card.id] = 'nonfoil';
					}
					finishesUpdated = true;
				}
			}
		}
		if (finishesUpdated) {
			selectedFinishes = { ...selectedFinishes };
		}
	}
</script>

<div class="card-list">
	{#if sortedCards?.length > 0}
		<div class="cards-list">
			{#each sortedCards as card (card.id)}
				{@const currentPrint = card.all_prints?.find(
					(p) => p.set_code === card.set && p.collector_number === card.collector_number
				)}
				{@const cardImageUri = getActiveCardImage(card, currentPrint)}
				{@const currentPrices = currentPrint?.prices || card.prices}

				<div
					class="card-item"
					on:mouseenter={() => ensureCardLanguages(card)}
					on:focusin={() => ensureCardLanguages(card)}
				>
					<div class="card-image-section">
						<div class="card-image-container">
							{#if cardImageUri}
								<img src={cardImageUri} alt={card.name} class="card-image" loading="lazy" />
							{/if}
							{#if hasMultipleImageFaces(card)}
								<button
									type="button"
									class="flip-badge-btn"
									on:click={() => toggleCardFace(card.id)}
									title="Flip card to view opposite face"
								>
									<i class="fa-solid fa-arrows-rotate"></i>
									<span>{faceIndices[card.id] === 1 ? 'Front Face' : 'Back Face'}</span>
								</button>
							{/if}
						</div>

						<div class="card-print-controls">
							{#if card.all_prints}
								<div class="select-wrapper">
									<i class="fa-solid fa-layer-group select-icon"></i>
									<select
										value="{card.set}|{card.collector_number}"
										on:focus={() => handleSetDropdownOpen(card)}
										on:change={(e) => {
											const [set_code, collector_number] = e.target.value.split('|');
											const newPrint = card.all_prints.find(
												(p) => p.set_code === set_code && p.collector_number === collector_number
											);
											if (newPrint) handleSetChange(card, newPrint);
										}}
										aria-label="Select card set and printing"
									>
										<option value="">Select a print...</option>
										{#each [...new Map(card.all_prints
													.filter((p) => p?.set_code && p?.set && p?.collector_number)
													.map((p) => [`${p.set_code}|${p.collector_number}`, p])).values()] as print}
											<option value="{print.set_code}|{print.collector_number}">
												{print.set} ({print.collector_number})
											</option>
										{/each}
									</select>
								</div>
							{/if}

							{#if card.available_languages?.length > 1}
								<div class="select-wrapper">
									<i class="fa-solid fa-globe select-icon"></i>
									<select
										id="language-{card.id}"
										value={card.selected_language || 'en'}
										on:focus={() => handleLanguageDropdownOpen(card)}
										on:change={(e) => handleLanguageChange(card, e.target.value)}
										aria-label="Select card language"
									>
										{#each card.available_languages as lang}
											<option value={lang}>
												{getLanguageName(lang)}
											</option>
										{/each}
									</select>
								</div>
							{/if}
						</div>
					</div>

					<div class="card-details">
						<div class="card-header-bar">
							<div class="title-and-mana">
								<h3 class="card-name">{card.printed_name || card.name}</h3>
								{#if card.mana_cost}
									<div class="mana-cost-display">
										{#each parseManaCost(card.mana_cost) as m}
											{#if m.type === 'symbol'}
												<img
													class="mana-symbol-svg"
													src="{m.svg}"
													alt="{m.raw}"
													title="{m.raw}"
													loading="lazy"
												/>
											{:else}
												<span class="mana-separator">{m.value}</span>
											{/if}
										{/each}
									</div>
								{/if}
							</div>

							<div class="header-badges">
								{#if card.rarity}
									<span class="rarity-badge {card.rarity.toLowerCase()}">{card.rarity}</span>
								{/if}
								{#if card.set}
									<span class="set-badge" title="{currentPrint?.set || card.set_name || card.set}">
										<img
											src="https://svgs.scryfall.io/sets/{getSetIconCode(card.set)}.svg"
											alt=""
											class="set-icon"
										/>
										<span>{card.set.toUpperCase()} #{card.collector_number}</span>
									</span>
								{/if}
								{#if currentPrices?.usd}
									<span class="price-pill" title="Estimated Regular Market Price">
										<i class="fa-solid fa-tag"></i>
										<span>{formatCardPrice(currentPrices.usd)}</span>
									</span>
								{/if}
								{#if currentPrices?.usd_foil}
									<span class="price-pill foil-price" title="Estimated Foil Market Price">
										<i class="fa-solid fa-sparkles"></i>
										<span>Foil {formatCardPrice(currentPrices.usd_foil)}</span>
									</span>
								{/if}
							</div>
						</div>

						<div class="card-content-body">
							{#if card.card_faces && card.card_faces.length > 1}
								<div class="faces-grid">
									{#each card.card_faces as face}
										<div class="face-panel">
											<div class="face-header-line">
												<div class="face-title-group">
													<span class="face-name">{face.name || face.printed_name}</span>
													{#if face.type_line || face.printed_type_line}
														<span class="face-type-sep">•</span>
														<span class="face-type">{face.type_line || face.printed_type_line}</span>
													{/if}
												</div>
												{#if face.mana_cost}
													<div class="face-mana-row">
														{#each parseManaCost(face.mana_cost) as m}
															{#if m.type === 'symbol'}
																<img
																	class="mana-symbol-svg small"
																	src="{m.svg}"
																	alt="{m.raw}"
																	title="{m.raw}"
																	loading="lazy"
																/>
															{:else}
																<span class="mana-separator">{m.value}</span>
															{/if}
														{/each}
													</div>
												{/if}
											</div>

											{#if face.oracle_text || face.printed_text}
												<CardText text="{face.oracle_text || face.printed_text}" className="face-oracle-text" />
											{/if}

											{#if face.flavor_text}
												<p class="face-flavor-text">"{face.flavor_text}"</p>
											{/if}

											{#if face.power !== undefined && face.power !== null && face.power !== ''}
												<div class="stats-row">
													<span class="pt-pill">{face.power}/{face.toughness}</span>
												</div>
											{:else if face.loyalty}
												<div class="stats-row">
													<span class="loyalty-pill"><i class="fa-solid fa-shield-halved"></i> Loyalty: {face.loyalty}</span>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="single-card-body">
									<p class="type-line-text">{card.type_line}</p>

									{#if card.oracle_text}
										<CardText text="{card.oracle_text}" className="oracle-text-display" />
									{/if}

									{#if card.flavor_text}
										<p class="flavor-text-display">"{card.flavor_text}"</p>
									{/if}

									{#if card.power !== undefined && card.power !== null && card.power !== ''}
										<div class="stats-row">
											<span class="pt-pill">{card.power}/{card.toughness}</span>
										</div>
									{:else if card.loyalty}
										<div class="stats-row">
											<span class="loyalty-pill"><i class="fa-solid fa-shield-halved"></i> Loyalty: {card.loyalty}</span>
										</div>
									{/if}
								</div>
							{/if}

							{#if card.artist}
								<div class="artist-line">
									<i class="fa-solid fa-paintbrush"></i>
									<span>Illustrated by <strong>{card.artist}</strong></span>
								</div>
							{/if}
						</div>

						<div class="card-footer-actions">
							<div class="finish-segmented-picker">
								<span class="finish-title">Finish:</span>
								<div class="finish-buttons">
									<button
										type="button"
										class="finish-toggle-btn"
										class:selected={selectedFinishes[card.id] === 'nonfoil'}
										disabled={currentPrint?.finishes && !currentPrint.finishes.includes('nonfoil')}
										on:click={() => handleFinishChange(card.id, 'nonfoil')}
									>
										Nonfoil
									</button>
									<button
										type="button"
										class="finish-toggle-btn foil-option"
										class:selected={selectedFinishes[card.id] === 'foil'}
										disabled={currentPrint?.finishes && !currentPrint.finishes.includes('foil')}
										on:click={() => handleFinishChange(card.id, 'foil')}
									>
										<i class="fa-solid fa-sparkles"></i>
										<span>Foil</span>
									</button>
									{#if currentPrint?.finishes?.includes('etched')}
										<button
											type="button"
											class="finish-toggle-btn foil-option"
											class:selected={selectedFinishes[card.id] === 'etched'}
											on:click={() => handleFinishChange(card.id, 'etched')}
										>
											<i class="fa-solid fa-sparkles"></i>
											<span>Etched</span>
										</button>
									{/if}
								</div>
							</div>

							<button
								class="add-to-seeking-btn
										{buttonStates[card.id]?.error ? 'error' : ''}
										{buttonStates[card.id]?.success ? 'success' : ''}
										{buttonStates[card.id]?.exists ? 'exists' : ''}"
								on:click={() => handleAddToSeeking(card)}
								disabled={!card.set || !card.collector_number || !$auth.isAuthenticated}
								title={!$auth.isAuthenticated
									? 'Login required'
									: !card.set || !card.collector_number
										? 'Select a print first'
										: 'Add to Seeking List'}
							>
								{#if buttonStates[card.id]?.error}
									<i class="fa-solid fa-triangle-exclamation"></i>
									<span>Error {buttonStates[card.id]?.message ? `(${buttonStates[card.id].message})` : ''}</span>
								{:else if buttonStates[card.id]?.success}
									<i class="fa-solid fa-circle-check"></i>
									<span>Added to Seeking</span>
								{:else if buttonStates[card.id]?.exists}
									<i class="fa-solid fa-check"></i>
									<span>Already in Seeking</span>
								{:else}
									<i class="fa-solid fa-plus"></i>
									<span>Add to Seeking</span>
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if hasSearched}
		<div class="no-results-card">
			<div class="no-results-icon">
				<i class="fa-solid fa-magnifying-glass"></i>
			</div>
			<p class="no-results-title">No cards found matching your search</p>
			<span class="no-results-hint">Check for typos or try searching with card names like <em>Fire // Ice</em> or <em>Black Lotus</em>.</span>
		</div>
	{/if}
</div>

<style>
	.card-list {
		width: 100%;
		max-width: 1000px;
		margin: 1.5rem auto 3rem auto;
		padding: 0 0.5rem;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.card-item {
		display: flex;
		gap: 1.75rem;
		padding: 1.5rem;
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border-radius: 16px;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--glass-border, var(--color-border));
		transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
		text-align: left;
	}

	.card-item:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
		border-color: var(--color-primary-alpha);
	}

	/* Left side: Image and selectors */
	.card-image-section {
		flex-shrink: 0;
		width: 240px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-image-container {
		position: relative;
		width: 100%;
		border-radius: 4.75%;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		background: rgba(0, 0, 0, 0.05);
	}

	.card-image {
		width: 100%;
		height: auto;
		display: block;
		transition: transform var(--transition-normal);
	}

	.flip-badge-btn {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.75);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		backdrop-filter: blur(4px);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast), transform var(--transition-fast);
	}

	.flip-badge-btn:hover {
		background: var(--color-primary);
		transform: scale(1.05);
	}

	.card-print-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}

	.select-wrapper {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
	}

	.select-icon {
		position: absolute;
		left: 0.75rem;
		font-size: 0.8rem;
		color: var(--color-text-muted);
		pointer-events: none;
	}

	.select-wrapper select {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2.1rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.85rem;
		font-weight: 500;
		outline: none;
		cursor: pointer;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.select-wrapper select:hover {
		border-color: var(--color-border-hover);
	}

	.select-wrapper select:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	/* Right side: Card details */
	.card-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.card-header-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.title-and-mana {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.card-name {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--color-text-primary);
		letter-spacing: -0.01em;
	}

	.mana-cost-display {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		flex-wrap: wrap;
	}

	.mana-symbol-svg {
		width: 19px;
		height: 19px;
		border-radius: 50%;
		filter: drop-shadow(-1px 1px 0 rgba(0, 0, 0, 0.75));
		vertical-align: middle;
		display: inline-block;
		flex-shrink: 0;
		transition: transform var(--transition-fast);
	}

	.mana-symbol-svg:hover {
		transform: scale(1.15);
	}

	.mana-symbol-svg.small {
		width: 16px;
		height: 16px;
	}

	.mana-separator {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-text-muted);
		padding: 0 0.15rem;
	}

	.header-badges {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.rarity-badge {
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.rarity-badge.mythic {
		background: rgba(234, 88, 12, 0.15);
		color: #ea580c;
		border: 1px solid rgba(234, 88, 12, 0.3);
	}
	.rarity-badge.rare {
		background: rgba(202, 138, 4, 0.15);
		color: #ca8a04;
		border: 1px solid rgba(202, 138, 4, 0.3);
	}
	.rarity-badge.uncommon {
		background: rgba(2, 132, 199, 0.15);
		color: #0284c7;
		border: 1px solid rgba(2, 132, 199, 0.3);
	}
	.rarity-badge.common {
		background: rgba(100, 116, 139, 0.15);
		color: #64748b;
		border: 1px solid rgba(100, 116, 139, 0.25);
	}

	.set-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.set-icon {
		width: 14px;
		height: 14px;
		object-fit: contain;
		display: inline-block;
	}

	.price-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.25);
		color: #16a34a;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.price-pill.foil-price {
		background: rgba(168, 85, 247, 0.1);
		border-color: rgba(168, 85, 247, 0.25);
		color: #9333ea;
	}

	/* Card content body */
	.card-content-body {
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}

	.type-line-text {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	:global(.oracle-text-display) {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--color-text-primary);
	}

	.flavor-text-display {
		margin: 0;
		font-size: 0.85rem;
		font-style: italic;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.stats-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.25rem;
	}

	.pt-pill,
	.loyalty-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.65rem;
		border-radius: 6px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
		font-size: 0.85rem;
		font-weight: 700;
	}

	/* Faces Grid for Multi-Face & Split Cards */
	.faces-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.85rem;
	}

	.face-panel {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.face-header-line {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-border-light, var(--color-border));
		flex-wrap: wrap;
	}

	.face-title-group {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.face-name {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--color-text-primary);
	}

	.face-type-sep {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.face-type {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.face-mana-row {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
	}

	:global(.face-oracle-text) {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--color-text-primary);
	}

	.face-flavor-text {
		margin: 0;
		font-size: 0.8rem;
		font-style: italic;
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.artist-line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--color-text-muted);
		margin-top: auto;
		padding-top: 0.4rem;
	}

	.artist-line strong {
		color: var(--color-text-secondary);
	}

	/* Footer actions */
	.card-footer-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.finish-segmented-picker {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.finish-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.finish-buttons {
		display: inline-flex;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 2px;
		gap: 2px;
	}

	.finish-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 0.825rem;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.finish-toggle-btn:hover:not(:disabled) {
		color: var(--color-text-primary);
		background: var(--color-bg-hover);
	}

	.finish-toggle-btn.selected {
		background: var(--color-primary-alpha);
		color: var(--color-primary);
	}

	.finish-toggle-btn.foil-option.selected {
		background: rgba(168, 85, 247, 0.15);
		color: #9333ea;
	}

	.finish-toggle-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		text-decoration: line-through;
	}

	.add-to-seeking-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.6rem 1.4rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
		white-space: nowrap;
	}

	.add-to-seeking-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
	}

	.add-to-seeking-btn:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
		opacity: 0.7;
		box-shadow: none;
		transform: none;
	}

	.add-to-seeking-btn.error {
		background: var(--color-error, #dc2626);
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	.add-to-seeking-btn.success {
		background: var(--color-success, #22c55e);
		animation: pulse 1.5s ease-in-out;
	}

	.add-to-seeking-btn.exists {
		background: var(--color-warning, #f59e0b);
		animation: pulse 1.5s ease-in-out;
	}

	@keyframes shake {
		10%, 90% { transform: translate3d(-1px, 0, 0); }
		20%, 80% { transform: translate3d(2px, 0, 0); }
		30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
		40%, 60% { transform: translate3d(4px, 0, 0); }
	}

	@keyframes pulse {
		0% { transform: scale(1); }
		50% { transform: scale(1.04); }
		100% { transform: scale(1); }
	}

	/* Empty state */
	.no-results-card {
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px solid var(--glass-border, var(--color-border));
		border-radius: 16px;
		padding: 3rem 2rem;
		text-align: center;
		box-shadow: var(--shadow-sm);
		max-width: 500px;
		margin: 2rem auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.no-results-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-primary-alpha);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
	}

	.no-results-title {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.no-results-hint {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	@media (max-width: 768px) {
		.card-item {
			flex-direction: column;
			gap: 1.25rem;
			padding: 1.25rem;
		}

		.card-image-section {
			width: 100%;
			max-width: 260px;
			margin: 0 auto;
		}

		.card-header-bar {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.card-footer-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.finish-segmented-picker {
			justify-content: space-between;
			width: 100%;
		}

		.add-to-seeking-btn {
			width: 100%;
		}
	}
</style>
