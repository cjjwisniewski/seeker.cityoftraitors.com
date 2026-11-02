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

	// Fetches the localized image/text for a card if the selected language differs from its native lang.
	// Returns an object with the fields to override, or null if no override is needed.
	const fetchLocalizedData = async (
		setCode: string,
		collectorNumber: string,
		lang: string
	): Promise<{
		image_uris: { grid: string; normal: string };
		flavor_text?: string;
		oracle_text?: string;
		type_line?: string;
	} | null> => {
		try {
			const url = `${SCRYFALL_API}/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(collectorNumber)}/${encodeURIComponent(lang)}`;
			const res = await fetch(url);
			if (!res.ok) return null;
			const data = await res.json();
			const imageUri = getCardImageUri(data);
			if (!imageUri) return null;
			return {
				image_uris: { grid: imageUri, normal: imageUri },
				flavor_text: data.flavor_text,
				oracle_text: data.oracle_text,
				type_line: data.type_line
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

			const card = await response.json();

			let cardWithPrints = card;
			if (card.prints_search_uri) {
				try {
					const printsResponse = await fetch(card.prints_search_uri);
					const printsData = await printsResponse.json();
					const prints = printsData.data.map((print: any) => ({
						set: print.set_name,
						set_code: print.set,
						lang: print.lang,
						collector_number: print.collector_number,
						image_uri: getCardImageUri(print),
						flavor_text: print.flavor_text,
						oracle_text: print.oracle_text,
						type_line: print.type_line,
						mana_cost: print.mana_cost,
						finishes: print.finishes || [],
						tcgplayer_id: print.tcgplayer_id || null,
						cardmarket_id: print.cardmarket_id || null
					}));

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
					const initialPrint = prints.find(
						(p: any) => p.set_code === card.set && p.collector_number === card.collector_number
					);
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
				const availableLanguages = [card.lang || 'en'];
				const preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
				const selectedLanguage = availableLanguages.includes(preferredLanguage)
					? preferredLanguage
					: 'en';
				cardWithPrints = {
					...card,
					image_uris: {
						...card.image_uris,
						grid: getCardImageUri(card),
						normal: getCardImageUri(card)
					},
					all_prints: [
						{
							set: card.set_name,
							set_code: card.set,
							collector_number: card.collector_number,
							image_uri: getCardImageUri(card),
							languages: null,
							flavor_text: card.flavor_text,
							oracle_text: card.oracle_text,
							type_line: card.type_line,
							mana_cost: card.mana_cost,
							finishes: card.finishes || []
						}
					],
					available_languages: availableLanguages,
					selected_language: selectedLanguage
				};
			}

			// (selected_language is already set correctly above for both paths)

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

			// Initialize search results immediately with their default print;
			// additional printings are lazy-loaded when the user opens the set selector
			const cardsWithPrints = data.data.map((card: any) => {
				const preferredLanguage = $auth.user?.settings?.preferredLanguage || 'en';
				const availableLanguages = [card.lang || 'en'];
				let selectedLanguage = availableLanguages.includes(preferredLanguage)
					? preferredLanguage
					: 'en';
				if (!availableLanguages.includes(selectedLanguage))
					selectedLanguage = availableLanguages[0];

				const cardImg = getCardImageUri(card);
				return {
					...card,
					image_uris: {
						...card.image_uris,
						grid: cardImg,
						normal: cardImg
					},
					all_prints: [
						{
							set: card.set_name,
							set_code: card.set,
							lang: card.lang,
							collector_number: card.collector_number,
							image_uri: cardImg,
							languages: availableLanguages,
							flavor_text: card.flavor_text,
							oracle_text: card.oracle_text,
							type_line: card.type_line,
							mana_cost: card.mana_cost,
							finishes: card.finishes || [],
							tcgplayer_id: card.tcgplayer_id || null,
							cardmarket_id: card.cardmarket_id || null
						}
					],
					prints_loaded: !card.prints_search_uri,
					available_languages: availableLanguages,
					selected_language: selectedLanguage
				};
			});

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
			<input
				bind:this={searchInput}
				type="text"
				bind:value={searchTerm}
				on:input={handleInput}
				on:keydown={handleKeyDown}
				placeholder="Search for cards..."
				aria-autocomplete="list"
				aria-expanded={showDropdown && suggestions.length > 0}
			/>
			<button on:click={performSearch} disabled={isSearching}>
				{#if isSearching}
					<i class="fa-solid fa-spinner fa-spin"></i> Searching...
				{:else}
					Search
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
								{suggestion}
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
		margin-bottom: 20px;
		/* Allow form to take available width */
		width: 100%;
		max-width: 500px; /* Optional: Limit max width on larger screens */
		margin-left: auto; /* Center the form */
		margin-right: auto;
	}

	.search-container {
		position: relative;
		/* display: inline-block; Remove this */
		display: block; /* Make it block to use width: 100% */
		width: 100%; /* Take full width of parent (.search-form) */
	}

	.input-group {
		display: flex;
		gap: 0.5rem;
		align-items: stretch; /* Make items same height */
		width: 100%; /* Ensure group takes full width */
	}

	input {
		flex: 1; /* Allow input to grow */
		min-width: 150px; /* Prevent input becoming too small */
		padding: 0.5rem; /* Consistent padding */
		border: 1px solid var(--color-border, #ccc);
		border-radius: 4px;
		/* width: 300px; Remove fixed width */
		background-color: var(--color-bg-secondary, white);
		color: var(--color-text-primary, #111);
		font-size: 1rem;
	}
	input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	button {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border, #ccc);
		border-radius: 4px;
		background: var(--color-bg-secondary, white);
		color: var(--color-text-primary);
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-color 0.2s;
		white-space: nowrap;
	}

	button:hover {
		background-color: var(--color-bg-hover, #f0f0f0);
		border-color: var(--color-border-hover, #bbb);
	}

	.dropdown-container {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--color-bg-elevated, white);
		border: 1px solid var(--color-border, #ccc);
		border-top: none;
		border-radius: 0 0 4px 4px;
		max-height: 300px;
		overflow-y: auto;
		z-index: 1000;
		box-shadow: var(--shadow-md);
	}

	.suggestions-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.suggestion-button {
		width: 100%;
		text-align: left;
		padding: 0.5rem 1rem;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.suggestion-button:hover,
	.suggestion-button.selected {
		background-color: var(--color-bg-hover, #f0f0f0);
		color: var(--color-text-primary);
	}

	.suggestions-list li {
		padding: 0;
		border-bottom: 1px solid var(--color-border-light, #eee);
	}
	.suggestions-list li:last-child {
		border-bottom: none;
	}

	/* Optional: Media query for very small screens if needed */
	/* @media (max-width: 400px) {
        .input-group {
            flex-direction: column;
            align-items: stretch;
        }
        button {
            width: 100%;
        }
    } */
</style>
