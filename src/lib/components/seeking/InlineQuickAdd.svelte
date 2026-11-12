<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { fetchWithAuth } from '$lib/utils/api';
	import { PUBLIC_ADD_TO_SEEKING_FUNCTION_URL } from '$env/static/public';
	import { languageMap } from '$lib/utils/languageUtils';

	export let disabled = false;

	const dispatch = createEventDispatcher();

	let query = '';
	let suggestions = [];
	let showSuggestions = false;
	let selectedIndex = -1;
	let debounceTimer = null;
	let containerEl;
	let inputEl;

	let isLoadingPrints = false;
	let selectedCardName = '';
	let prints = [];
	let selectedPrintId = '';
	let selectedFinish = 'nonfoil';
	let selectedLanguage = 'en';
	let isAdding = false;
	let inlineError = '';

	$: selectedPrint = prints.find((p) => p.id === selectedPrintId) || prints[0] || null;
	$: availableFinishes = selectedPrint?.finishes?.length ? selectedPrint.finishes : ['nonfoil'];
	$: if (selectedPrint && !availableFinishes.includes(selectedFinish)) {
		const prefFinish = ($auth.user?.settings?.preferredFinish || 'nonfoil').toLowerCase();
		selectedFinish = availableFinishes.includes(prefFinish) ? prefFinish : availableFinishes[0];
	}

	const quickLanguages = ['en', 'ja', 'zht', 'zhs', 'de', 'fr', 'it', 'es', 'pt', 'ko', 'ru', 'ph'];

	onMount(() => {
		const handleDocClick = (e) => {
			if (containerEl && !containerEl.contains(e.target)) {
				showSuggestions = false;
			}
		};
		document.addEventListener('click', handleDocClick);
		return () => {
			document.removeEventListener('click', handleDocClick);
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function handleInput() {
		inlineError = '';
		if (debounceTimer) clearTimeout(debounceTimer);
		const trimmed = query.trim();
		if (trimmed.length < 2) {
			suggestions = [];
			showSuggestions = false;
			return;
		}
		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(trimmed)}`
				);
				if (res.ok) {
					const data = await res.json();
					suggestions = (data.data || []).slice(0, 8);
					showSuggestions = suggestions.length > 0;
					selectedIndex = -1;
				}
			} catch {
				suggestions = [];
				showSuggestions = false;
			}
		}, 220);
	}

	function handleKeyDown(e) {
		if (!showSuggestions || suggestions.length === 0) {
			if (e.key === 'Escape') {
				clearSelection();
			}
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const choice = selectedIndex >= 0 ? suggestions[selectedIndex] : suggestions[0];
			if (choice) selectCardName(choice);
		} else if (e.key === 'Escape') {
			showSuggestions = false;
		}
	}

	function getScryfallImage(cardObj) {
		if (cardObj?.image_uris?.normal) return cardObj.image_uris.normal;
		if (cardObj?.image_uris?.small) return cardObj.image_uris.small;
		if (cardObj?.card_faces?.[0]?.image_uris?.normal) return cardObj.card_faces[0].image_uris.normal;
		if (cardObj?.card_faces?.[0]?.image_uris?.small) return cardObj.card_faces[0].image_uris.small;
		return '';
	}

	async function selectCardName(cardName) {
		query = cardName;
		showSuggestions = false;
		suggestions = [];
		selectedCardName = cardName;
		inlineError = '';
		isLoadingPrints = true;
		prints = [];

		try {
			const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(
				`!"${cardName}"`
			)}&unique=prints&order=released`;
			let res = await fetch(searchUrl);
			let list = [];
			if (res.ok) {
				const data = await res.json();
				list = (data.data || []).filter((c) => !c.digital);
				if (list.length === 0) list = data.data || [];
			} else {
				const exactRes = await fetch(
					`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
				);
				if (exactRes.ok) {
					list = [await exactRes.json()];
				}
			}

			if (list.length === 0) {
				inlineError = `Could not load printings for "${cardName}".`;
				selectedCardName = '';
				return;
			}

			prints = list;
			selectedPrintId = list[0].id;
			const prefLang = ($auth.user?.settings?.preferredLanguage || 'en').toLowerCase();
			selectedLanguage = quickLanguages.includes(prefLang) ? prefLang : 'en';
			const prefFin = ($auth.user?.settings?.preferredFinish || 'nonfoil').toLowerCase();
			const firstFinishes = list[0].finishes || ['nonfoil'];
			selectedFinish = firstFinishes.includes(prefFin) ? prefFin : firstFinishes[0];
		} catch (err) {
			inlineError = 'Failed to fetch card printings from Scryfall.';
			selectedCardName = '';
		} finally {
			isLoadingPrints = false;
		}
	}

	function clearSelection() {
		query = '';
		suggestions = [];
		showSuggestions = false;
		selectedCardName = '';
		prints = [];
		selectedPrintId = '';
		inlineError = '';
	}

	async function handleQuickAdd() {
		if (!selectedPrint || isAdding || disabled) return;
		isAdding = true;
		inlineError = '';

		try {
			const payload = {
				id: selectedPrint.id,
				name: selectedPrint.name,
				set_code: selectedPrint.set,
				set_name: selectedPrint.set_name,
				collector_number: selectedPrint.collector_number,
				language: selectedLanguage,
				oracle_id: selectedPrint.oracle_id,
				image_uri: getScryfallImage(selectedPrint),
				timestamp: new Date().toISOString(),
				finish: selectedFinish,
				tcgplayer_id: selectedPrint.tcgplayer_id || null,
				cardmarket_id: selectedPrint.cardmarket_id || null
			};

			const response = await fetchWithAuth(PUBLIC_ADD_TO_SEEKING_FUNCTION_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response) return;

			let result = {};
			try {
				result = await response.json();
			} catch {
				result = {};
			}

			if (response.status === 409) {
				inlineError = 'This exact printing is already on your seeking list.';
				return;
			}

			if (!response.ok) {
				inlineError = result.message || result.error || `Failed to add card (${response.status}).`;
				return;
			}

			const addedName = selectedPrint.name;
			clearSelection();
			dispatch('added', { cardName: addedName });
		} catch (err) {
			inlineError = err?.message || 'Network error while adding card.';
		} finally {
			isAdding = false;
		}
	}
</script>

<div class="quick-add-wrapper" bind:this={containerEl}>
	<div class="quick-add-bar">
		<div class="quick-add-input-wrap">
			<i class="fa-solid fa-plus quick-add-icon"></i>
			<input
				bind:this={inputEl}
				type="text"
				bind:value={query}
				on:input={handleInput}
				on:keydown={handleKeyDown}
				placeholder="Quick-add card to seeking list..."
				class="quick-add-input"
				aria-label="Quick-add card to seeking list"
				{disabled}
			/>
			{#if query || selectedCardName}
				<button
					type="button"
					class="quick-clear-btn"
					on:click={clearSelection}
					aria-label="Clear quick-add"
					title="Clear"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			{/if}
		</div>

		{#if showSuggestions && suggestions.length > 0}
			<ul class="quick-suggestions" role="listbox" aria-label="Card suggestions">
				{#each suggestions as suggestion, i}
					<li role="option" aria-selected={i === selectedIndex}>
						<button
							type="button"
							class="quick-suggestion-btn"
							class:selected={i === selectedIndex}
							on:mouseenter={() => (selectedIndex = i)}
							on:click={() => selectCardName(suggestion)}
						>
							<i class="fa-solid fa-magnifying-glass"></i>
							<span>{suggestion}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if isLoadingPrints}
		<div class="quick-add-confirm">
			<span class="quick-loading">
				<i class="fa-solid fa-spinner fa-spin"></i> Loading printings for {selectedCardName}...
			</span>
		</div>
	{:else if selectedPrint}
		<div class="quick-add-confirm">
			<div class="quick-card-preview">
				{#if getScryfallImage(selectedPrint)}
					<img src={getScryfallImage(selectedPrint)} alt={selectedPrint.name} class="quick-thumb" />
				{/if}
				<span class="quick-card-title">{selectedPrint.name}</span>
			</div>

			<div class="quick-controls">
				<select bind:value={selectedPrintId} class="quick-select quick-print-select" aria-label="Select printing">
					{#each prints as p}
						<option value={p.id}>
							{p.set_name} ({p.set.toUpperCase()} #{p.collector_number})
						</option>
					{/each}
				</select>

				<select bind:value={selectedFinish} class="quick-select" aria-label="Select finish">
					{#each availableFinishes as fin}
						<option value={fin}>
							{fin === 'foil' ? 'Foil' : fin === 'etched' ? 'Etched' : 'Nonfoil'}
						</option>
					{/each}
				</select>

				<select bind:value={selectedLanguage} class="quick-select" aria-label="Select language">
					{#each quickLanguages as lang}
						<option value={lang}>{languageMap[lang]?.name || lang.toUpperCase()}</option>
					{/each}
				</select>

				<button
					type="button"
					class="quick-submit-btn"
					on:click={handleQuickAdd}
					disabled={isAdding || disabled}
				>
					{#if isAdding}
						<i class="fa-solid fa-spinner fa-spin"></i> Adding...
					{:else}
						<i class="fa-solid fa-plus"></i> Add Card
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if inlineError}
		<div class="quick-add-error" role="alert">
			<i class="fa-solid fa-circle-exclamation"></i>
			<span>{inlineError}</span>
		</div>
	{/if}
</div>

<style>
	.quick-add-wrapper {
		position: relative;
		margin: 1rem auto 0.65rem auto;
		width: calc(100% - 2rem);
		max-width: calc(1540px - 2rem);
		box-sizing: border-box;
		z-index: 25;
	}

	.quick-add-bar {
		position: relative;
	}

	.quick-add-input-wrap {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 0.85rem;
		height: 40px;
		background: var(--glass-bg);
		backdrop-filter: blur(var(--backdrop-blur));
		-webkit-backdrop-filter: blur(var(--backdrop-blur));
		border: 1px solid var(--glass-border);
		border-radius: 10px;
		box-shadow: var(--shadow-sm);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	.quick-add-input-wrap:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(99, 102, 241, 0.2));
	}

	.quick-add-icon {
		color: var(--color-primary);
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.quick-add-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.88rem;
		font-weight: 500;
		outline: none;
	}

	.quick-add-input::placeholder {
		color: var(--color-text-muted);
	}

	.quick-clear-btn {
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.quick-clear-btn:hover {
		color: var(--color-text-primary);
	}

	.quick-suggestions {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		margin: 0;
		padding: 0.35rem;
		list-style: none;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		box-shadow: var(--shadow-lg);
		max-height: 280px;
		overflow-y: auto;
		z-index: 40;
	}

	.quick-suggestion-btn {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: 7px;
		color: var(--color-text-primary);
		font-size: 0.86rem;
		text-align: left;
		cursor: pointer;
	}

	.quick-suggestion-btn i {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.quick-suggestion-btn:hover,
	.quick-suggestion-btn.selected {
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.14));
		color: var(--color-primary);
	}

	.quick-add-confirm {
		margin-top: 0.5rem;
		padding: 0.6rem 0.85rem;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.quick-card-preview {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.quick-thumb {
		width: 28px;
		height: 39px;
		object-fit: cover;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.quick-card-title {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quick-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		flex: 1;
		justify-content: flex-end;
	}

	.quick-select {
		height: 34px;
		padding: 0 0.6rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.82rem;
		outline: none;
		max-width: 100%;
	}

	.quick-print-select {
		max-width: 260px;
	}

	.quick-submit-btn {
		height: 34px;
		padding: 0 0.9rem;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #ffffff;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
	}

	.quick-submit-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.quick-loading {
		font-size: 0.84rem;
		color: var(--color-text-secondary);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.quick-add-error {
		margin-top: 0.4rem;
		padding: 0.45rem 0.75rem;
		border-radius: 8px;
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
		font-size: 0.82rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	@media (max-width: 768px) {
		.quick-add-wrapper {
			width: calc(100% - 1.5rem);
			max-width: none;
			margin: 0.75rem auto 0.5rem auto;
		}

		.quick-add-confirm {
			flex-direction: column;
			align-items: stretch;
		}

		.quick-controls {
			justify-content: stretch;
		}

		.quick-select,
		.quick-print-select,
		.quick-submit-btn {
			flex: 1 1 auto;
			max-width: none;
		}
	}
</style>
