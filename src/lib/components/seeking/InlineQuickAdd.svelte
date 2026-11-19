<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { fetchWithAuth } from '$lib/utils/api';
	import { PUBLIC_ADD_TO_SEEKING_FUNCTION_URL } from '$env/static/public';
	import { getLanguageName } from '$lib/utils/languageUtils';

	export let disabled = false;

	const dispatch = createEventDispatcher();

	let query = '';
	let suggestions = [];
	let showSuggestions = false;
	let selectedIndex = -1;
	let debounceTimer = null;
	let autocompleteAbortController = null;
	let autocompleteRequestSeq = 0;
	let containerEl;
	let inputEl;

	let isLoadingPrints = false;
	let selectedCardName = '';
	let prints = [];
	let selectedPrintId = '';
	let selectedFinish = 'nonfoil';
	let selectedLanguage = 'en';
	let selectedPriceCap = '';
	let selectedMinCondition = '';
	let isAdding = false;
	let inlineError = '';

	let isLoadingLanguages = false;
	let availableLanguages = ['en'];
	let printLanguageVariants = {};
	const printVariantsCache = new Map();
	let activeLangFetchKey = '';

	$: selectedPrint = prints.find((p) => p.id === selectedPrintId) || prints[0] || null;
	$: availableFinishes = selectedPrint?.finishes?.length ? selectedPrint.finishes : ['nonfoil'];
	$: if (selectedPrint && !availableFinishes.includes(selectedFinish)) {
		const prefFinish = ($auth.user?.settings?.preferredFinish || 'nonfoil').toLowerCase();
		selectedFinish = availableFinishes.includes(prefFinish) ? prefFinish : availableFinishes[0];
	}
	$: if (selectedPrint) {
		loadPrintLanguages(selectedPrint);
	}

	async function loadPrintLanguages(printObj) {
		if (!printObj?.set || !printObj?.collector_number) {
			availableLanguages = ['en'];
			printLanguageVariants = {};
			selectedLanguage = 'en';
			return;
		}
		const cacheKey = `${printObj.set.toLowerCase()}_${printObj.collector_number}`;
		if (activeLangFetchKey === cacheKey && Object.keys(printLanguageVariants).length > 0) {
			return;
		}
		activeLangFetchKey = cacheKey;

		const applyVariants = (variantsMap) => {
			const langs = Object.keys(variantsMap);
			availableLanguages = langs.length > 0 ? langs : [(printObj.lang || 'en').toLowerCase()];
			printLanguageVariants = variantsMap;
			if (!availableLanguages.includes(selectedLanguage)) {
				const prefLang = ($auth.user?.settings?.preferredLanguage || 'en').toLowerCase();
				selectedLanguage = availableLanguages.includes(prefLang)
					? prefLang
					: availableLanguages.includes('en')
						? 'en'
						: availableLanguages[0];
			}
		};

		if (printVariantsCache.has(cacheKey)) {
			applyVariants(printVariantsCache.get(cacheKey));
			return;
		}

		const fallbackLang = (printObj.lang || 'en').toLowerCase();
		availableLanguages = [fallbackLang];
		printLanguageVariants = { [fallbackLang]: printObj };
		selectedLanguage = fallbackLang;
		isLoadingLanguages = true;

		try {
			const url = `https://api.scryfall.com/cards/search?q=cn%3A${encodeURIComponent(
				printObj.collector_number
			)}+set%3A${encodeURIComponent(printObj.set)}&include_multilingual=true&unique=prints`;
			const res = await fetch(url);
			if (activeLangFetchKey !== cacheKey) return;
			if (!res.ok) return;
			const data = await res.json();
			const variants = data.data || [];
			if (variants.length === 0) return;

			const variantsMap = {};
			for (const v of variants) {
				if (v.lang) {
					const code = v.lang.toLowerCase();
					if (!variantsMap[code]) {
						variantsMap[code] = v;
					}
				}
			}
			if (Object.keys(variantsMap).length > 0) {
				printVariantsCache.set(cacheKey, variantsMap);
				applyVariants(variantsMap);
			}
		} catch {
			// Keep fallback printing language if Scryfall multilingual lookup fails
		} finally {
			if (activeLangFetchKey === cacheKey) {
				isLoadingLanguages = false;
			}
		}
	}

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
		if (autocompleteAbortController) {
			autocompleteAbortController.abort();
			autocompleteAbortController = null;
		}
		const requestSeq = ++autocompleteRequestSeq;
		debounceTimer = setTimeout(async () => {
			const controller = new AbortController();
			autocompleteAbortController = controller;
			try {
				const res = await fetch(
					`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(trimmed)}`,
					{ signal: controller.signal }
				);
				if (requestSeq !== autocompleteRequestSeq) return;
				if (res.ok) {
					const data = await res.json();
					if (requestSeq !== autocompleteRequestSeq) return;
					suggestions = (data.data || []).slice(0, 8);
					showSuggestions = suggestions.length > 0;
					selectedIndex = -1;
				}
			} catch (err) {
				if (err?.name === 'AbortError') return;
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
		availableLanguages = ['en'];
		printLanguageVariants = {};
		activeLangFetchKey = '';
		selectedPriceCap = '';
		selectedMinCondition = '';
		inlineError = '';
	}

	async function handleQuickAdd() {
		if (!selectedPrint || isAdding || disabled) return;
		inlineError = '';

		let parsedMaxPriceCap = null;
		const rawCap = String(selectedPriceCap ?? '').trim();
		if (rawCap !== '') {
			const capFloat = parseFloat(rawCap);
			if (!Number.isFinite(capFloat) || capFloat < 0) {
				inlineError = 'Max cap must be a valid non-negative dollar amount.';
				return;
			}
			parsedMaxPriceCap = Math.round(capFloat * 100);
		}
		const chosenMinCond = String(selectedMinCondition || '').trim() || null;

		isAdding = true;

		try {
			const langVariant = printLanguageVariants[selectedLanguage] || selectedPrint;
			const variantPrices = langVariant?.prices;
			const hasVariantPrice = Boolean(
				variantPrices &&
					(variantPrices.usd ||
						variantPrices.usd_foil ||
						variantPrices.usd_etched ||
						variantPrices.eur ||
						variantPrices.eur_foil)
			);
			const payload = {
				id: langVariant.id || selectedPrint.id,
				name: selectedPrint.name,
				set_code: selectedPrint.set,
				set_name: selectedPrint.set_name,
				collector_number: selectedPrint.collector_number,
				language: selectedLanguage,
				oracle_id: selectedPrint.oracle_id,
				image_uri: getScryfallImage(langVariant) || getScryfallImage(selectedPrint),
				timestamp: new Date().toISOString(),
				finish: selectedFinish,
				max_price_cap: parsedMaxPriceCap,
				min_condition: chosenMinCond,
				tcgplayer_id:
					selectedFinish === 'etched'
						? langVariant.tcgplayer_etched_id || selectedPrint.tcgplayer_etched_id || null
						: langVariant.tcgplayer_id || selectedPrint.tcgplayer_id || null,
				cardmarket_id: langVariant.cardmarket_id || selectedPrint.cardmarket_id || null,
				...($auth.isDemo
					? { demo_scryfall_prices: hasVariantPrice ? variantPrices : selectedPrint.prices || null }
					: {})
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
				placeholder="Quick-add card..."
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
			<div class="quick-confirm-header">
				{#if getScryfallImage(selectedPrint)}
					<img src={getScryfallImage(selectedPrint)} alt={selectedPrint.name} class="quick-thumb" />
				{/if}
				<div class="quick-card-meta">
					<span class="quick-card-title">{selectedPrint.name}</span>
					<span class="quick-card-sub">
						{selectedPrint.set_name} ({selectedPrint.set.toUpperCase()} #{selectedPrint.collector_number})
					</span>
				</div>
				<button
					type="button"
					class="quick-popover-close"
					on:click={clearSelection}
					aria-label="Close quick-add"
					title="Cancel"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="quick-controls">
				<label class="quick-field quick-field-full">
					<span class="quick-field-label">Printing</span>
					<select bind:value={selectedPrintId} class="quick-select" aria-label="Select printing">
						{#each prints as p}
							<option value={p.id}>
								{p.set_name} ({p.set.toUpperCase()} #{p.collector_number})
							</option>
						{/each}
					</select>
				</label>

				<div class="quick-controls-row">
					<label class="quick-field">
						<span class="quick-field-label">Finish</span>
						<select bind:value={selectedFinish} class="quick-select" aria-label="Select finish">
							{#each availableFinishes as fin}
								<option value={fin}>
									{fin === 'foil' ? '✦ Foil' : fin === 'etched' ? '◈ Etched' : 'Nonfoil'}
								</option>
							{/each}
						</select>
					</label>

					<label class="quick-field">
						<span class="quick-field-label">
							Language {#if isLoadingLanguages}<i class="fa-solid fa-spinner fa-spin"></i>{/if}
						</span>
						<select
							bind:value={selectedLanguage}
							class="quick-select"
							aria-label="Select language"
							disabled={isLoadingLanguages}
						>
							{#each availableLanguages as lang}
								<option value={lang}>{getLanguageName(lang)}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="quick-controls-row">
					<label class="quick-field">
						<span class="quick-field-label">Max Cap</span>
						<div class="quick-cap-group">
							<span class="quick-cap-prefix">$</span>
							<input
								type="number"
								step="0.01"
								min="0"
								bind:value={selectedPriceCap}
								placeholder="None"
								class="quick-cap-input"
								aria-label="Optional max price cap in USD"
							/>
						</div>
					</label>

					<label class="quick-field">
						<span class="quick-field-label">Min Condition</span>
						<select
							bind:value={selectedMinCondition}
							class="quick-select"
							aria-label="Optional minimum condition"
						>
							<option value="">Default</option>
							<option value="NM">NM</option>
							<option value="SP">SP / LP</option>
							<option value="MP">MP</option>
							<option value="HP">HP</option>
							<option value="ANY">Any</option>
						</select>
					</label>
				</div>

				<button
					type="button"
					class="quick-submit-btn"
					on:click={handleQuickAdd}
					disabled={isAdding || disabled}
				>
					{#if isAdding}
						<i class="fa-solid fa-spinner fa-spin"></i> Adding...
					{:else}
						<i class="fa-solid fa-plus"></i> Add to Seeking List
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
		width: 220px;
		flex-shrink: 0;
		box-sizing: border-box;
		z-index: 30;
		transition: width 0.18s ease;
	}

	.quick-add-wrapper:focus-within {
		width: 260px;
	}

	.quick-add-bar {
		position: relative;
	}

	.quick-add-input-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.75rem;
		height: 36px;
		background: var(--color-bg-secondary, var(--glass-bg));
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-radius: 8px;
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
	}

	@media (max-width: 768px) {
		.quick-add-wrapper {
			width: 100%;
		}
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
		top: calc(100% + 0.4rem);
		left: 0;
		min-width: 290px;
		max-width: min(380px, 92vw);
		margin: 0;
		padding: 0.35rem;
		list-style: none;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		box-sizing: border-box;
		box-shadow: var(--shadow-lg);
		max-height: 280px;
		overflow-y: auto;
		z-index: 60;
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
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		width: 370px;
		max-width: min(400px, 92vw);
		padding: 0.9rem;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-sizing: border-box;
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		z-index: 60;
	}

	@media (max-width: 768px) {
		.quick-add-wrapper:focus-within {
			width: 100%;
		}
		.quick-suggestions {
			min-width: 0;
			width: 100%;
		}
		.quick-add-confirm {
			width: 100%;
			max-width: 100%;
		}
	}

	.quick-confirm-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid var(--color-border);
	}

	.quick-thumb {
		width: 40px;
		height: 56px;
		object-fit: cover;
		border-radius: 5px;
		box-shadow: var(--shadow-sm);
		flex-shrink: 0;
	}

	.quick-card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.quick-card-title {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quick-card-sub {
		font-size: 0.78rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quick-popover-close {
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.quick-popover-close:hover {
		color: var(--color-text-primary);
		background: var(--glass-bg);
	}

	.quick-controls {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.quick-controls-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.quick-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.quick-field-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.quick-select {
		height: 36px;
		width: 100%;
		padding: 0 0.6rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.83rem;
		outline: none;
	}

	.quick-select:focus {
		border-color: var(--color-primary);
	}

	.quick-cap-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.5rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-primary);
		height: 33px;
		box-sizing: border-box;
		transition: border-color var(--transition-fast);
	}

	.quick-cap-group:focus-within {
		border-color: var(--color-primary);
	}

	.quick-cap-prefix {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		user-select: none;
	}

	.quick-cap-input {
		width: 100%;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.8rem;
		padding: 0;
		outline: none;
	}

	.quick-submit-btn {
		height: 38px;
		width: 100%;
		padding: 0 1rem;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #ffffff;
		font-size: 0.86rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		transition: filter var(--transition-fast), transform var(--transition-fast);
	}

	.quick-submit-btn:hover:not(:disabled) {
		filter: brightness(1.08);
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
		position: absolute;
		top: calc(100% + 0.45rem);
		left: 0;
		min-width: 280px;
		max-width: min(480px, 90vw);
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		background: var(--color-bg-elevated);
		border: 1px solid rgba(239, 68, 68, 0.45);
		box-shadow: var(--shadow-md);
		color: #ef4444;
		font-size: 0.82rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		z-index: 60;
	}

	@media (max-width: 768px) {
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
