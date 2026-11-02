<script>
	import { createEventDispatcher } from 'svelte';
	import { getLanguageName, getAvailableLanguages } from '$lib/utils/languageUtils';
	import { PUBLIC_ADD_TO_SEEKING_FUNCTION_URL } from '$env/static/public';
	import { auth } from '$lib/stores/auth'; // Import the auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import fetchWithAuth

	const dispatch = createEventDispatcher();

	export let cards = [];
	export let hasSearched = false;
	// REMOVED: export let userId;

	let selectedFinishes = {}; // Track foil status for each card
	let buttonErrors = {}; // Add error state tracking (original state tracking) - Note: This seems unused, consider removing if buttonStates covers it.
	let buttonStates = {}; // Track button states (error, success, exists) (original state tracking)
	// REMOVED: let accessToken = null;
	// REMOVED: getCookie function
	// REMOVED: onMount logic for accessToken and userId

	// Helper to resolve Scryfall WebP ('grid') image URI with fallbacks
	function getCardImageUri(cardData) {
		const uris = cardData?.image_uris || cardData?.card_faces?.[0]?.image_uris;
		return uris?.grid || uris?.normal || uris?.jpeg;
	}

	// --- Original Functions (handleSetChange, handleLanguageChange, etc.) ---
	async function handleSetDropdownOpen(card) {
		if (!card || card.prints_loaded || !card.prints_search_uri) return;

		try {
			const printsResponse = await fetch(card.prints_search_uri);
			if (!printsResponse.ok) return;
			const printsData = await printsResponse.json();
			if (!Array.isArray(printsData?.data)) return;

			const prints = printsData.data
				.map((print) => ({
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
				}))
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

		// Update card information for the selected printing
		card.set = newPrint.set_code;
		card.collector_number = newPrint.collector_number;
		card.image_uris = {
			grid: newPrint.image_uri,
			normal: newPrint.image_uri
		};

		// Fetch available languages for this specific printing (cached on newPrint to avoid repeat requests)
		if (!newPrint.languages) {
			newPrint.languages = await getAvailableLanguages(
				newPrint.set_code,
				newPrint.collector_number
			);
		}
		card.available_languages = newPrint.languages;

		// Select language in order: preferred → en → first available
		const preferredLang = $auth.user?.settings?.preferredLanguage || 'en';
		if (card.available_languages.includes(preferredLang)) {
			card.selected_language = preferredLang;
		} else if (card.available_languages.includes('en')) {
			card.selected_language = 'en';
		} else {
			card.selected_language = card.available_languages[0] || 'en';
		}

		// Update other card information based on the selected print
		card.flavor_text = newPrint.flavor_text;
		card.oracle_text = newPrint.oracle_text;
		card.type_line = newPrint.type_line;
		card.mana_cost = newPrint.mana_cost;

		// Update available finishes and ensure a valid finish is selected BEFORE remapping for Svelte
		const preferredFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';
		const availableFinishes = newPrint.finishes || [];

		if (availableFinishes.includes(preferredFinish)) {
			// Apply preference if available
			selectedFinishes[card.id] = preferredFinish;
		} else if (
			availableFinishes.length > 0 &&
			!availableFinishes.includes(selectedFinishes[card.id])
		) {
			// If current selection is invalid, grab the first valid finish
			selectedFinishes[card.id] = availableFinishes[0];
		}
		selectedFinishes = { ...selectedFinishes };

		// If the selected language matches the print's native language, just update the UI.
		// Otherwise fetch the localized image and card text via handleLanguageChange.
		if (card.selected_language === (newPrint.lang || 'en')) {
			sortedCards = sortedCards.map((c) => (c.id === card.id ? { ...card } : c));
		} else {
			await handleLanguageChange(card, card.selected_language);
		}
	}

	async function handleLanguageChange(card, language) {
		if (!card || !language) return;

		// Find the currently selected print based on card.set and card.collector_number
		const currentPrint = card.all_prints.find(
			(p) => p.set_code === card.set && p.collector_number === card.collector_number
		);
		if (!currentPrint) {
			console.error(
				'Could not find current print for language change:',
				card.set,
				card.collector_number
			);
			return; // Cannot proceed without the correct print context
		}

		// Construct the API URI for the language-specific card data using the correct collector_number
		const cardUri = `https://api.scryfall.com/cards/${currentPrint.set_code}/${currentPrint.collector_number}/${language}`;

		try {
			// Fetch the language-specific card data
			const response = await fetch(cardUri);
			if (!response.ok) throw new Error('Failed to fetch card data');
			const cardData = await response.json();

			// Get the correct image URI from the response (preferring Scryfall WebP 'grid')
			const imageUri = getCardImageUri(cardData);
			if (!imageUri) throw new Error('No image URI found');

			// Update card image and language while maintaining other print information
			sortedCards = sortedCards.map((c) => {
				if (c.id === card.id) {
					return {
						...c,
						image_uris: { grid: imageUri, normal: imageUri },
						selected_language: language,
						// Ensure set and collector number remain consistent with the selected print
						set: currentPrint.set_code,
						collector_number: currentPrint.collector_number,
						// Update text fields from the language-specific data
						flavor_text: cardData.flavor_text || currentPrint.flavor_text,
						oracle_text: cardData.oracle_text || currentPrint.oracle_text,
						type_line: cardData.type_line || currentPrint.type_line,
						mana_cost: currentPrint.mana_cost // Keep from selected print
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

		// Use cached languages if already fetched, otherwise fetch and cache
		if (!print.languages) {
			print.languages = await getAvailableLanguages(print.set_code, print.collector_number);
			card.available_languages = print.languages;
			sortedCards = [...sortedCards];
		} else if (card.available_languages !== print.languages) {
			card.available_languages = print.languages;
			sortedCards = [...sortedCards];
		}
	}

	// --- MODIFIED: Add Card to Seeking List ---
	async function handleAddToSeeking(card) {
		// REMOVED: Checks for accessToken and userId

		// Check authentication status directly from the store
		if (!$auth.isAuthenticated) {
			console.error('Cannot add card: User not authenticated.');
			buttonStates[card.id] = {
				error: true,
				success: false,
				exists: false,
				message: 'Login required'
			};
			buttonStates = { ...buttonStates };
			setTimeout(() => {
				buttonStates[card.id] = { error: false, success: false, exists: false };
				buttonStates = { ...buttonStates };
			}, 3000);
			return;
		}

		try {
			// Reset button state (original logic)
			buttonStates[card.id] = { error: false, success: false, exists: false };
			buttonStates = { ...buttonStates }; // Force Svelte reactivity

			// Find the currently selected print based on card.set and card.collector_number
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

			const payload = {
				// Use the current card state
				id: crypto.randomUUID(),
				name: card.name,
				set_code: card.set, // Use card.set (updated by handleSetChange)
				set_name: currentPrint.set || card.set_name,
				collector_number: card.collector_number, // Use card.collector_number (updated by handleSetChange)
				language: card.selected_language || 'en',
				oracle_id: card.oracle_id,
				image_uri: getCardImageUri(card) || currentPrint.image_uri, // Use current WebP image URI
				timestamp: new Date().toISOString(),
				finish: selectedFinishes[card.id] || 'nonfoil',
				tcgplayer_id: currentPrint.tcgplayer_id || null,
				cardmarket_id: currentPrint.cardmarket_id || null
			};

			console.log('Adding card to seeking list with payload:', payload);

			// --- Use fetchWithAuth ---
			const response = await fetchWithAuth(PUBLIC_ADD_TO_SEEKING_FUNCTION_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
					// Authorization header is added by fetchWithAuth
				},
				body: JSON.stringify(payload)
			});

			// fetchWithAuth returns undefined if it triggered a redirect (e.g., on 401)
			if (!response) {
				console.warn('Add to seeking aborted because fetchWithAuth triggered a redirect.');
				// Set error state
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
				return; // Stop processing
			}

			const result = await response.json();

			// Original status handling logic
			if (response.status === 409) {
				buttonStates[card.id] = { error: false, success: false, exists: true };
				buttonStates = { ...buttonStates };

				setTimeout(() => {
					buttonStates[card.id] = { error: false, success: false, exists: false };
					buttonStates = { ...buttonStates };
				}, 3000);
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

			dispatch('cardAdded', result); // Original dispatch
		} catch (error) {
			console.error('Error adding card to seeking list:', error);
			// Original error handling for button state
			buttonStates[card.id] = { error: true, success: false, exists: false, message: 'Add failed' }; // Added generic message
			buttonStates = { ...buttonStates };

			setTimeout(() => {
				buttonStates[card.id] = { error: false, success: false, exists: false };
				buttonStates = { ...buttonStates };
			}, 3000);
		}
	}

	// --- Original Functions (handleFinishChange, sortedCards, getManaCost, getTypeLine - UNCHANGED from message #19) ---
	function handleFinishChange(cardId, finish) {
		selectedFinishes[cardId] = finish;
		selectedFinishes = { ...selectedFinishes };
	}

	$: sortedCards = cards.map((card) => {
		if (!card.all_prints) return card;

		// Map the initial preferred finish based on the first initially selected print
		const preferredFinish = $auth.user?.settings?.preferredFinish || 'nonfoil';
		const currentPrint = card.all_prints.find(
			(p) => p.set_code === card.set && p.collector_number === card.collector_number
		);

		return {
			...card,
			all_prints: [...card.all_prints].sort((a, b) => (a.set || '').localeCompare(b.set || ''))
		};
	});

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
						selectedFinishes[card.id] = 'nonfoil'; // fallback
					}
					finishesUpdated = true;
				}
			}
		}
		if (finishesUpdated) {
			selectedFinishes = { ...selectedFinishes };
		}
	}

	function getManaCost(card) {
		return card.mana_cost || '';
	}

	function getTypeLine(card) {
		return [card.type_line, card.oracle_text].filter(Boolean).join('\n');
	}

	// REMOVED: userId warning check
</script>

<!-- REMOVED: script context="module" block -->

<!-- REMOVED: #if !userId block -->
<div class="card-list">
	{#if sortedCards?.length > 0}
		<div class="cards-list">
			{#each sortedCards as card (card.id)}
				<!-- MODIFIED: Get current print based on card's set AND collector_number -->
				{@const currentPrint = card.all_prints?.find(
					(p) => p.set_code === card.set && p.collector_number === card.collector_number
				)}
					{@const cardImageUri = getCardImageUri(card) || currentPrint?.image_uri}
					<div class="card-item">
					<div class="card-image-section">
						<div class="card-image-container">
							{#if cardImageUri}
								<img src={cardImageUri} alt={card.name} class="card-image" />
							{/if}
						</div>
						{#if card.all_prints}
							<div class="set-selector">
								<!-- MODIFIED: Select binds to a combined value representing the current print -->
								<select
									value="{card.set}|{card.collector_number}"
									on:focus={() => handleSetDropdownOpen(card)}
									on:change={(e) => {
										const [set_code, collector_number] = e.target.value.split('|');
										// Find the specific print object based on both parts
										const newPrint = card.all_prints.find(
											(p) => p.set_code === set_code && p.collector_number === collector_number
										);
										if (newPrint) handleSetChange(card, newPrint); // Pass the found print object
									}}
									aria-label="Select card set and printing"
								>
									<option value="">Select a print...</option>
									<!-- MODIFIED: Option value includes both set_code and collector_number -->
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
					</div>
					<div class="card-details">
						<div class="card-header">
							<div class="name-line">
								<h3>{card.name}</h3>
								<span class="mana-cost">{getManaCost(card)}</span>
							</div>
						</div>
						<div class="card-text">
							<p class="type-line">{card.type_line}</p>
							<p class="oracle-text">{card.oracle_text}</p>
							{#if card.flavor_text}
								<p class="flavor-text">"{card.flavor_text}"</p>
							{/if}
						</div>
						<!-- MODIFIED: Pass card directly, handleLanguageDropdownOpen finds print inside -->
						{#if card.available_languages?.length > 0}
							<div class="language-selector">
								<label for="language-{card.id}">Language:</label>
								<select
									id="language-{card.id}"
									value={card.selected_language || 'en'}
									on:focus={() => handleLanguageDropdownOpen(card)}
									on:change={(e) => handleLanguageChange(card, e.target.value)}
								>
									{#each card.available_languages as lang}
										<option value={lang}>
											{getLanguageName(lang)}
										</option>
									{/each}
								</select>
							</div>
						{/if}
						<div class="card-finishes">
							<label class="finish-label">
								<input
									type="radio"
									name="finish-{card.id}"
									value="nonfoil"
									checked={selectedFinishes[card.id] === 'nonfoil'}
									on:change={() => handleFinishChange(card.id, 'nonfoil')}
									disabled={currentPrint?.finishes && !currentPrint.finishes.includes('nonfoil')}
								/>
								<span
									class="finish-text {currentPrint?.finishes &&
									!currentPrint.finishes.includes('nonfoil')
										? 'disabled'
										: ''}">Nonfoil</span
								>
							</label>
							<label class="finish-label">
								<input
									type="radio"
									name="finish-{card.id}"
									value="foil"
									checked={selectedFinishes[card.id] === 'foil'}
									on:change={() => handleFinishChange(card.id, 'foil')}
									disabled={currentPrint?.finishes && !currentPrint.finishes.includes('foil')}
								/>
								<span
									class="finish-text {currentPrint?.finishes &&
									!currentPrint.finishes.includes('foil')
										? 'disabled'
										: ''}">Foil</span
								>
							</label>
						</div>
						<div class="card-actions">
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
									Error {buttonStates[card.id]?.message ? `(${buttonStates[card.id].message})` : ''}
								{:else if buttonStates[card.id]?.success}
									Added to Seeking
								{:else if buttonStates[card.id]?.exists}
									Already in Seeking
								{:else}
									Add to Seeking
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if hasSearched}
		<p class="no-results">No cards found.</p>
	{/if}
</div>

<!-- REMOVED: closing {:else} -->

<style>
	.card-list {
		width: 100%;
		max-width: 1200px;
		margin: 2rem auto;
		padding: 0 1rem;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card-item {
		display: flex;
		gap: 2rem;
		padding: 1.5rem;
		background: var(--color-bg-elevated);
		border-radius: 8px;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.card-item:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
		border-color: var(--color-border-hover);
	}

	.card-image-section {
		flex-shrink: 0;
		width: 250px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-image-container {
		width: 100%;
	}

	.card-image {
		width: 100%;
		height: auto;
		border-radius: 4.75%;
		box-shadow: var(--shadow-sm);
	}

	.card-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.name-line {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	h3 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}

	.mana-cost {
		font-family: monospace;
		color: var(--color-text-secondary);
	}

	.type-line {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		margin: 0;
	}

	.oracle-text {
		white-space: pre-wrap;
		margin: 0.5rem 0;
	}

	.flavor-text {
		color: var(--color-text-secondary);
		font-style: italic;
		margin: 0.5rem 0;
	}

	.set-selector {
		width: 100%;
	}

	.set-selector select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
		font-size: 0.9rem;
	}

	select:hover {
		border-color: var(--color-border-hover);
	}

	select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.language-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.language-selector label {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.language-selector select {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
		font-size: 0.9rem;
	}
	.card-actions {
		margin-top: auto; /* This pushes the button to the bottom */
		padding-top: 0.5rem;
	}

	.add-to-seeking-btn {
		/* renamed selector */
		width: 100%; /* Make button full width */
		padding: 0.75rem 1rem;
		background-color: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.add-to-seeking-btn:hover:not(:disabled) {
		/* renamed selector */
		background-color: var(--color-primary-dark);
	}

	.add-to-seeking-btn:disabled {
		/* renamed selector */
		background-color: var(--color-disabled);
		cursor: not-allowed;
		opacity: 0.7;
	}

	.add-to-seeking-btn.error {
		background-color: var(--color-error, #dc2626);
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	.add-to-seeking-btn.success {
		background-color: var(--color-success, #22c55e);
		animation: pulse 1.5s ease-in-out;
	}

	.add-to-seeking-btn.exists {
		background-color: var(--color-warning, #f59e0b);
		animation: pulse 1.5s ease-in-out;
	}

	@keyframes shake {
		10%,
		90% {
			transform: translate3d(-1px, 0, 0);
		}

		20%,
		80% {
			transform: translate3d(2px, 0, 0);
		}

		30%,
		50%,
		70% {
			transform: translate3d(-4px, 0, 0);
		}

		40%,
		60% {
			transform: translate3d(4px, 0, 0);
		}
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
		}
	}

	.card-finishes {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem;
		background: var(--color-bg-secondary, #f3f4f6);
		border: 1px solid var(--color-border, transparent);
		border-radius: 6px;
	}

	.finish-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.finish-label:hover {
		background-color: var(--color-bg-hover, #e5e7eb);
	}

	.finish-text {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #374151);
	}

	input[type='radio'] {
		accent-color: var(--color-primary, #6b7280);
		margin: 0;
	}

	input[type='radio']:checked + .finish-text {
		font-weight: 500;
		color: var(--color-text-primary, #1f2937);
	}

	.finish-text.disabled {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.no-results {
		/* Original style */
		text-align: center;
		color: var(--color-text-secondary);
		margin-top: 2rem;
	}

	@media (max-width: 768px) {
		/* Original responsive styles */
		.card-item {
			flex-direction: column;
			gap: 1rem;
		}

		.card-image-section {
			width: 100%;
			max-width: 300px;
			margin: 0 auto;
		}
	}
	/* Removed second media query block from previous attempt */
</style>
