<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';
	import { getLanguageName, getAvailableLanguages } from '$lib/utils/languageUtils';
	import { auth } from '$lib/stores/auth'; // Import auth store

	const dispatch = createEventDispatcher();

	let searchTerm = '';
	let suggestions: string[] = [];
	let showDropdown = false;
	let selectedIndex = -1;
	let isSearching = false;
	let searchInput: HTMLInputElement;
	let dropdownContainer: HTMLDivElement;
	let debounceTimer: number;

	const SCRYFALL_API = 'https://api.scryfall.com';
	const AUTOCOMPLETE_URL = `${SCRYFALL_API}/cards/autocomplete`;
	const SEARCH_URL = `${SCRYFALL_API}/cards/search`;
	const NAMED_URL = `${SCRYFALL_API}/cards/named`;

	// Prefer Scryfall's WebP 'grid' format, with fallback to legacy 'normal'/'jpeg' and double-faced card_faces
	const getCardImageUri = (cardData: any): string | undefined => {
		const uris = cardData?.image_uris || cardData?.card_faces?.[0]?.image_uris;
		return uris?.grid || uris?.normal || uris?.jpeg;
	};

	// Normalizes a printing object with full multi-face, stats, and market metadata
	const normalizePrint = (print: any, fallbackCard?: any) => {
		const cardFaces = print.card_faces && print.card_faces.length > 0 ? print.card_faces : null;
		const manaCost =
			print.mana_cost ||
			(cardFaces ? cardFaces.map((f: any) => f.mana_cost || '').filter(Boolean).join(' // ') : '') ||
			'';
		const typeLine =
			print.type_line ||
			(cardFaces ? cardFaces.map((f: any) => f.type_line || '').filter(Boolean).join(' // ') : '') ||
			'';
		const oracleText =
			print.oracle_text ||
			(cardFaces
				? cardFaces
						.map((f: any) => (cardFaces.length > 1 && f.name ? `[${f.name}]\n${f.oracle_text || ''}` : f.oracle_text || ''))
						.filter(Boolean)
						.join('\n\n')
				: '') ||
			'';
		const flavorText =
			print.flavor_text ||
			(cardFaces ? cardFaces.map((f: any) => f.flavor_text).filter(Boolean).join('\n\n') : '') ||
			'';
		const power =
			print.power !== undefined
				? print.power
				: cardFaces
					? cardFaces.map((f: any) => f.power).filter((p: any) => p !== undefined).join(' // ')
					: null;
		const toughness =
			print.toughness !== undefined
				? print.toughness
				: cardFaces
					? cardFaces.map((f: any) => f.toughness).filter((t: any) => t !== undefined).join(' // ')
					: null;
		const loyalty =
			print.loyalty !== undefined
				? print.loyalty
				: cardFaces
					? cardFaces.map((f: any) => f.loyalty).filter((l: any) => l !== undefined).join(' // ')
					: null;

		return {
			id: print.id || fallbackCard?.id,
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
			rarity: print.rarity || fallbackCard?.rarity || 'common',
			artist: print.artist || fallbackCard?.artist || '',
			prices: print.prices || fallbackCard?.prices || null,
			finishes: print.finishes || [],
			tcgplayer_id: print.tcgplayer_id || null,
			cardmarket_id: print.cardmarket_id || null,
			card_faces: cardFaces
		};
	};

	// Normalizes the root card object ensuring split, transform, and normal cards have rich metadata
	const normalizeCard = (card: any) => {
		const cardFaces = card.card_faces && card.card_faces.length > 0 ? card.card_faces : null;
		const manaCost =
			card.mana_cost ||
			(cardFaces ? cardFaces.map((f: any) => f.mana_cost || '').filter(Boolean).join(' // ') : '') ||
			'';
		const typeLine =
			card.type_line ||
			(cardFaces ? cardFaces.map((f: any) => f.type_line || '').filter(Boolean).join(' // ') : '') ||
			'';
		const oracleText =
			card.oracle_text ||
			(cardFaces
				? cardFaces
						.map((f: any) => (cardFaces.length > 1 && f.name ? `[${f.name}]\n${f.oracle_text || ''}` : f.oracle_text || ''))
						.filter(Boolean)
						.join('\n\n')
				: '') ||
			'';
		const flavorText =
			card.flavor_text ||
			(cardFaces ? cardFaces.map((f: any) => f.flavor_text).filter(Boolean).join('\n\n') : '') ||
			'';
		const power =
			card.power !== undefined
				? card.power
				: cardFaces
					? cardFaces.map((f: any) => f.power).filter((p: any) => p !== undefined).join(' // ')
					: null;
		const toughness =
			card.toughness !== undefined
				? card.toughness
				: cardFaces
					? cardFaces.map((f: any) => f.toughness).filter((t: any) => t !== undefined).join(' // ')
					: null;
		const loyalty =
			card.loyalty !== undefined
				? card.loyalty
				: cardFaces
					? cardFaces.map((f: any) => f.loyalty).filter((l: any) => l !== undefined).join(' // ')
					: null;

		return {
			...card,
			card_faces: cardFaces,
			mana_cost: manaCost,
			type_line: typeLine,
			oracle_text: oracleText,
			flavor_text: flavorText,
			power,
			toughness,
			loyalty,
			rarity: card.rarity || 'common',
			artist: card.artist || '',
			prices: card.prices || null
		};
	};

	// Fetches the localized image/text for a card if the selected language differs from its native lang.
	// Returns an object with the fields to override, or null if no override is needed.
	const fetchLocalizedData = async (
		setCode: string,
		collectorNumber: string,
		lang: string
	): Promise<{
		image_uris: { grid: string; normal: string };
		card_faces?: any;
		flavor_text?: string;
		oracle_text?: string;
		type_line?: string;
		printed_name?: string;
	} | null> => {
		try {
			const url = `${SCRYFALL_API}/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(collectorNumber)}/${encodeURIComponent(lang)}`;
			const res = await fetch(url);
			if (!res.ok) return null;
			const data = await res.json();
			const imageUri = getCardImageUri(data);
			if (!imageUri) return null;
			const cardFaces = data.card_faces && data.card_faces.length > 0 ? data.card_faces : null;
			const oracle_text =
				data.oracle_text ||
				(cardFaces
					? cardFaces
							.map((f: any) => (cardFaces.length > 1 && (f.printed_name || f.name) ? `[${f.printed_name || f.name}]\n${f.printed_text || f.oracle_text || ''}` : f.printed_text || f.oracle_text || ''))
							.filter(Boolean)
							.join('\n\n')
					: '') ||
				'';
			const flavor_text =
				data.flavor_text ||
				(cardFaces ? cardFaces.map((f: any) => f.flavor_text).filter(Boolean).join('\n\n') : '') ||
				'';
			const type_line =
				data.printed_type_line ||
				data.type_line ||
				(cardFaces ? cardFaces.map((f: any) => f.printed_type_line || f.type_line || '').filter(Boolean).join(' // ') : '') ||
				'';
			const printed_name =
				data.printed_name ||
				(cardFaces ? cardFaces.map((f: any) => f.printed_name || f.name).join(' // ') : '') ||
				data.name;

			return {
				image_uris: { grid: imageUri, normal: imageUri },
				card_faces: cardFaces,
				flavor_text,
				oracle_text,
				type_line,
				printed_name
			};
		} catch {
			return null;
		}
	};

	// Sanitize input to prevent XSS
	const sanitizeInput = (input: string): string => {
		// Remove any HTML tags
		return input.replace(/<[^>]*>/g, '');
	};

	// Validate search term
	const validateSearchTerm = (term: string): boolean => {
		// Allow Unicode letters/numbers, spaces, and valid MTG card name / Scryfall query characters
		return /^[\p{L}\p{N}\s\-'.,/:&!?"()+]+$/u.test(term);
	};

	onMount(() => {
		// Close dropdown when clicking outside
		document.addEventListener('click', (e: MouseEvent) => {
			if (
				!dropdownContainer?.contains(e.target as Node) &&
				!searchInput?.contains(e.target as Node)
			) {
				showDropdown = false;
			}
		});
	});

	const handleInput = async () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Sanitize and validate input
		const sanitizedTerm = sanitizeInput(searchTerm);
		if (sanitizedTerm !== searchTerm) {
			searchTerm = sanitizedTerm;
		}

		if (searchTerm.length < 2) {
			suggestions = [];
			showDropdown = false;
			selectedIndex = -1;
			return;
		}

		if (!validateSearchTerm(searchTerm)) {
			suggestions = [];
			showDropdown = false;
			selectedIndex = -1;
			return;
		}

		debounceTimer = setTimeout(async () => {
			try {
				const response = await fetch(`${AUTOCOMPLETE_URL}?q=${encodeURIComponent(searchTerm)}`);
				const data = await response.json();
				suggestions = data.data || [];
				selectedIndex = -1;
				showDropdown = suggestions.length > 0;
			} catch (error) {
				console.error('Error fetching suggestions:', error);
			}
		}, 300);
	};

	const selectSuggestion = async (suggestion: string) => {
		searchTerm = sanitizeInput(suggestion);
		showDropdown = false;
		selectedIndex = -1;
		await fetchExactCard(suggestion);
	};

	const fetchExactCard = async (name: string) => {
		isSearching = true;
		try {
			const exactUrl = `${NAMED_URL}?exact=${encodeURIComponent(name)}`;
			const response = await fetch(exactUrl);

			if (!response.ok) {
				if (response.status === 404) {
					console.warn(`Card not found by exact name: ${name}. Falling back to general search.`);
					await performSearch();
					return;
				}
				throw new Error(`Failed to fetch exact card: ${response.statusText}`);
			}

			const rawCard = await response.json();
			const card = normalizeCard(rawCard);

			let cardWithPrints = card;
			if (card.prints_search_uri) {
				try {
					const printsResponse = await fetch(card.prints_search_uri);
					const printsData = await printsResponse.json();
					const prints = printsData.data.map((print: any) => normalizePrint(print, card));

					// Collect unique languages from all prints
					const availableLanguages = [...new Set(prints.map((p: any) => p.lang).filter(Boolean))];
					if (!availableLanguages.includes('en')) availableLanguages.push('en');
					// Get the correct available languages for the initially displayed printing
					const initialLanguages = await getAvailableLanguages(card.set, card.collector_number);
					const preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
					const selectedLanguage = initialLanguages.includes(preferredLanguage)
						? preferredLanguage
						: initialLanguages.includes('en')
							? 'en'
							: initialLanguages[0];

					// Cache languages on the matching print to avoid re-fetching later
					const initialPrint =
						prints.find(
							(p: any) =>
								(p.set_code || '').toLowerCase() === (card.set || '').toLowerCase() &&
								String(p.collector_number) === String(card.collector_number)
						) || prints[0];
					if (initialPrint) initialPrint.languages = initialLanguages;

					cardWithPrints = {
						...card,
						all_prints: prints,
						available_languages: initialLanguages,
						selected_language: selectedLanguage
					};

					// Fetch localized image/text if selected language differs from the card's native lang
					if (selectedLanguage !== (card.lang || 'en')) {
						const localized = await fetchLocalizedData(
							card.set,
							card.collector_number,
							selectedLanguage
						);
						if (localized) Object.assign(cardWithPrints, localized);
					}
				} catch (error) {
					console.error(`Error fetching prints for ${card.name}:`, error);
				}
			} else {
				const initialLanguages = await getAvailableLanguages(card.set, card.collector_number);
				const preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
				const selectedLanguage = initialLanguages.includes(preferredLanguage)
					? preferredLanguage
					: initialLanguages.includes('en')
						? 'en'
						: initialLanguages[0] || 'en';

				const defaultPrint = normalizePrint(card, card);
				defaultPrint.languages = initialLanguages;

				cardWithPrints = {
					...card,
					image_uris: {
						...card.image_uris,
						grid: getCardImageUri(card),
						normal: getCardImageUri(card)
					},
					all_prints: [defaultPrint],
					prints_loaded: true,
					available_languages: initialLanguages,
					selected_language: selectedLanguage
				};

				if (selectedLanguage !== (card.lang || 'en')) {
					const localized = await fetchLocalizedData(
						card.set,
						card.collector_number,
						selectedLanguage
					);
					if (localized) Object.assign(cardWithPrints, localized);
				}
			}

			dispatch('search', [cardWithPrints]);
		} catch (error) {
			console.error(`Error fetching exact card "${name}":`, error);
			dispatch('search', []);
		} finally {
			isSearching = false;
		}
	};

	const performSearch = async () => {
		if (!searchTerm.trim() || !validateSearchTerm(searchTerm.trim())) {
			return;
		}
		isSearching = true;
		try {
			const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(searchTerm)}`);
			if (!response.ok) {
				if (response.status === 404) {
					console.log(`No cards found for search term: "${searchTerm}"`);
					dispatch('search', []);
					return;
				}
				throw new Error(`Search failed: ${response.statusText}`);
			}
			const data = await response.json();

			if (!data.data || data.data.length === 0) {
				console.log(`No cards found for search term: "${searchTerm}"`);
				dispatch('search', []);
				return;
			}

			// Initialize search results with their default print and available languages.
			// Eagerly resolve languages for initial results (up to 12 cards) for instant
			// preferred-language rendering, with subsequent results resolved on demand.
			const preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
			const cardsWithPrints = await Promise.all(
				data.data.map(async (rawCard: any, index: number) => {
					const card = normalizeCard(rawCard);

					let initialLanguages: string[] = [card.lang || 'en'];
					if (index < 12) {
						initialLanguages = await getAvailableLanguages(card.set, card.collector_number);
					}

					let selectedLanguage = initialLanguages.includes(preferredLanguage)
						? preferredLanguage
						: initialLanguages.includes('en')
							? 'en'
							: initialLanguages[0] || 'en';

					const cardImg = getCardImageUri(card);
					const defaultPrint = normalizePrint(card, card);
					defaultPrint.languages = initialLanguages;

					const cardWithPrints = {
						...card,
						image_uris: {
							...card.image_uris,
							grid: cardImg,
							normal: cardImg
						},
						all_prints: [defaultPrint],
						prints_loaded: !card.prints_search_uri,
						available_languages: initialLanguages,
						selected_language: selectedLanguage
					};

					if (selectedLanguage !== (card.lang || 'en')) {
						const localized = await fetchLocalizedData(
							card.set,
							card.collector_number,
							selectedLanguage
						);
						if (localized) Object.assign(cardWithPrints, localized);
					}

					return cardWithPrints;
				})
			);

			dispatch('search', cardsWithPrints);
		} catch (error) {
			console.error('Error performing search:', error);
			dispatch('search', []);
		} finally {
			isSearching = false;
		}
	};

	const handleKeyDown = async (event: KeyboardEvent) => {
		if (showDropdown && suggestions.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				selectedIndex = (selectedIndex + 1) % suggestions.length;
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				selectedIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				showDropdown = false;
				selectedIndex = -1;
				return;
			}
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (showDropdown && selectedIndex >= 0 && suggestions[selectedIndex]) {
				await selectSuggestion(suggestions[selectedIndex]);
			} else {
				showDropdown = false;
				selectedIndex = -1;
				await performSearch();
			}
		}
	};
</script>

<div class="search-form">
	<div class="search-container">
		<div class="input-group">
			<div class="search-icon-wrapper">
				<i class="fa-solid fa-magnifying-glass search-icon"></i>
			</div>
			<input
				bind:this={searchInput}
				type="text"
				bind:value={searchTerm}
				on:input={handleInput}
				on:keydown={handleKeyDown}
				placeholder="Search MTG cards (e.g. Fire // Ice, Black Lotus)..."
				aria-autocomplete="list"
				aria-expanded={showDropdown && suggestions.length > 0}
			/>
			{#if searchTerm}
				<button
					type="button"
					class="clear-btn"
					on:click={() => {
						searchTerm = '';
						suggestions = [];
						showDropdown = false;
						searchInput?.focus();
					}}
					title="Clear search"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{/if}
			<button class="search-submit-btn" on:click={performSearch} disabled={isSearching}>
				{#if isSearching}
					<i class="fa-solid fa-spinner fa-spin"></i>
					<span>Searching</span>
				{:else}
					<span>Search</span>
				{/if}
			</button>
		</div>

		{#if showDropdown && suggestions.length > 0}
			<div class="dropdown-container" bind:this={dropdownContainer}>
				<ul class="suggestions-list" role="listbox">
					{#each suggestions as suggestion, i}
						<li role="option" aria-selected={i === selectedIndex}>
							<button
								type="button"
								class="suggestion-button"
								class:selected={i === selectedIndex}
								on:mouseenter={() => (selectedIndex = i)}
								on:click={() => selectSuggestion(suggestion)}
							>
								<i class="fa-solid fa-magnifying-glass suggestion-icon"></i>
								<span class="suggestion-text">{suggestion}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>

<style>
	.search-form {
		margin-bottom: 1rem;
		width: 100%;
		max-width: 580px;
		margin-left: auto;
		margin-right: auto;
	}

	.search-container {
		position: relative;
		width: 100%;
	}

	.input-group {
		display: flex;
		align-items: center;
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px solid var(--glass-border, var(--color-border));
		border-radius: 9999px;
		padding: 0.35rem 0.45rem 0.35rem 1rem;
		box-shadow: var(--shadow-sm);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.input-group:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-alpha);
	}

	.search-icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
		margin-right: 0.65rem;
		font-size: 0.95rem;
	}

	input {
		flex: 1;
		min-width: 120px;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.95rem;
		font-weight: 500;
		outline: none;
		padding: 0.4rem 0;
	}

	input::placeholder {
		color: var(--color-text-muted);
	}

	.clear-btn {
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.4rem 0.6rem;
		border-radius: 50%;
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color var(--transition-fast);
	}

	.clear-btn:hover {
		color: var(--color-text-primary);
	}

	.search-submit-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1.25rem;
		border: none;
		border-radius: 9999px;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		color: white;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
		white-space: nowrap;
	}

	.search-submit-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
	}

	.search-submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.dropdown-container {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		max-height: 320px;
		overflow-y: auto;
		z-index: 1000;
		box-shadow: var(--shadow-lg);
		padding: 0.35rem;
		backdrop-filter: blur(var(--backdrop-blur, 10px));
	}

	.suggestions-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.suggestions-list li {
		margin-bottom: 2px;
	}

	.suggestion-button {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.6rem 0.85rem;
		border: none;
		background: none;
		border-radius: 8px;
		cursor: pointer;
		color: var(--color-text-primary);
		font-size: 0.9rem;
		text-align: left;
		transition: background-color var(--transition-fast), color var(--transition-fast);
	}

	.suggestion-icon {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.suggestion-button:hover,
	.suggestion-button.selected {
		background-color: var(--color-primary-alpha);
		color: var(--color-primary);
	}

	.suggestion-button:hover .suggestion-icon,
	.suggestion-button.selected .suggestion-icon {
		color: var(--color-primary);
	}
</style>
