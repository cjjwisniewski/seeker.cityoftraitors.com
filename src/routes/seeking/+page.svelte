<script>
	import { onMount, onDestroy } from 'svelte'; // Import onDestroy
	import { auth } from '$lib/stores/auth'; // Import auth store
	import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
	import {
		PUBLIC_GET_SEEKING_LIST_FUNCTION_URL,
		PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL
	} from '$env/static/public';

	let cards = [];
	let error = null;
	let loading = true; // Re-declare the loading variable
	let unsubscribe; // Declare unsubscribe in the component scope
	let isCondensed = false; // State for condensed view
	let activeMenuId = null; // State for identifying which kebab menu is open

	function toggleMenu(id, event) {
		event.stopPropagation();
		activeMenuId = activeMenuId === id ? null : id;
	}

	function closeMenu() {
		activeMenuId = null;
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

	// Fetch data when component mounts and user is authenticated
	onMount(() => {
		// Load condensed state from localStorage
		const storedCondensed = localStorage.getItem('seeking-list-condensed');
		if (storedCondensed !== null) {
			isCondensed = storedCondensed === 'true';
		}

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
		// Consider adding a specific loading state for the delete button if desired
		error = null; // Clear previous errors

		try {
			const requestBody = {
				partitionKey: card.set_code,
				rowKey: `${card.collector_number}_${card.language}_${card.finish}`
			}; // <-- Added missing closing brace here
			// Use fetchWithAuth for the delete request
			const response = await fetchWithAuth(PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			// fetchWithAuth returns undefined if it redirects (e.g., on 401)
			if (!response) {
				error = `Authentication failed while attempting to delete card.`;
				console.error(error);
				return; // Stop execution
			}

			console.log('Delete Response status:', response.status);
			const responseText = await response.text();
			console.log('Delete Response body:', responseText);

			if (!response.ok) {
				throw new Error(`Failed to delete card (Status: ${response.status}): ${responseText}`);
			}

			// Remove card from local state on success
			cards = cards.filter(
				(c) =>
					!(
						c.set_code === card.set_code &&
						c.collector_number === card.collector_number &&
						c.language === card.language &&
						c.finish === card.finish
					)
			);
			console.log('Card removed from local state');
		} catch (e) {
			error = `Delete failed: ${e.message}`; // Update error state
			console.error('Error deleting card:', e);
		}
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
		jp: 'Japanese',
		de: 'German',
		fr: 'French',
		it: 'Italian',
		es: 'Spanish',
		pt: 'Portuguese',
		ru: 'Russian',
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

	// Reactive sorted list
	$: filteredCards = cards.filter((card) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			card.name.toLowerCase().includes(query) ||
			card.set_code.toLowerCase().includes(query) ||
			card.language.toLowerCase().includes(query) ||
			card.finish.toLowerCase().includes(query)
		);
	});

	$: sortedCards = [...filteredCards].sort((a, b) => {
		// Handle potentially missing values (treat null/undefined as lowest)
		let aValue = a[sortKey];
		let bValue = b[sortKey];

		// Specific handling for price/stock if needed, e.g., nulls last
		if (sortKey.includes('_price')) {
			aValue = aValue ?? (sortDirection === 'asc' ? Infinity : -Infinity);
			bValue = bValue ?? (sortDirection === 'asc' ? Infinity : -Infinity);
		} else if (sortKey.includes('_stock')) {
			// Define a sort order for stock: true (available) > null (unknown) > false (unavailable)
			const stockOrder = { true: 1, null: 0, false: -1 };
			aValue = stockOrder[getStockStatus(aValue)];
			bValue = stockOrder[getStockStatus(bValue)];
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
			'TCGPlayer Price'
			// 'CardMarket Stock',
			// 'CardMarket Price',
			// 'eBay Stock',
			// 'eBay Price'
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
				card.cardtrader_low_price ? (card.cardtrader_low_price / 100).toFixed(2) : '',
				getStockStatus(card.tcgplayer_stock),
				card.tcgplayer_low_price ? card.tcgplayer_low_price : ''
				// getStockStatus(card.cardmarket_stock),
				// card.cardmarket_low_price ? (card.cardmarket_low_price / 100).toFixed(2) : '',
				// getStockStatus(card.ebay_stock),
				// card.ebay_low_price ? (card.ebay_low_price / 100).toFixed(2) : ''
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

<svelte:window on:click={closeMenu} />

<div class="page-title">
	<h1>Seeking List</h1>
	<div class="view-controls">
		{#if showFilter}
			<div class="search-container">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Filter cards..."
					class="search-input"
				/>
				<button class="clear-search-btn" on:click={() => (searchQuery = '')} title="Clear search">
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
		{/if}
		<button
			class="header-btn"
			on:click={() => (showFilter = !showFilter)}
			title="Toggle Filter"
			class:active={showFilter}
		>
			<i class="fa-solid fa-filter"></i>
		</button>
		<button class="header-btn" on:click={downloadCSV} title="Export CSV">
			<i class="fa-solid fa-file-csv"></i>
		</button>
		<button on:click={toggleCondensed} class="header-btn toggle-view-btn">
			<i class="fa-solid {isCondensed ? 'fa-maximize' : 'fa-minimize'}"></i>
		</button>
	</div>
</div>

{#if enlargedCardImage}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => (enlargedCardImage = null)}>
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
					<th class="disabled-column display-none" title="CardMarket stock check coming soon">
						CardMarket
						<!-- Add sorting later if needed -->
					</th>
					<th class="disabled-column display-none" title="Ebay stock check coming soon">
						EBay
						<!-- Add sorting later if needed -->
					</th>
					<th class="actions-header"></th>
					<!-- Not sortable -->
				</tr>
			</thead>
			<tbody>
				{#each sortedCards as card (`${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`)}
					<tr
						class:condensed={isCondensed}
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
										src={card.image_uri}
										alt={card.name}
										class="card-thumbnail"
										on:click={() => (enlargedCardImage = card.image_uri)}
									/>
								{/if}
								<span>{card.name}</span>
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
						<td data-label="EBay" class="vendor-stock-cell disabled-column display-none">
							<div class="stock-indicator">
								<i
									class="{getStockIcon(getStockStatus(card.ebay_stock))} {getStockColor(
										getStockStatus(card.ebay_stock)
									)}"
								></i>
								{#if card.ebay_low_price !== null && card.ebay_low_price !== undefined}
									<span class="price-text">{formatPrice(card.ebay_low_price)}</span>
								{/if}
							</div>
						</td>
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
									<div class="kebab-dropdown" on:click|stopPropagation>
										<button class="dropdown-item" disabled title="Settings coming soon">
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

<style>
	.seeking-list {
		margin: 2rem auto;
		max-width: 1200px;
		padding: 0 1rem;
		animation: fadeIn 0.5s ease-out;
	}

	.page-title {
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
		margin: 2rem auto;
		max-width: 1200px;
		padding: 0 1rem;
	}

	.page-title h1 {
		margin: 0;
		text-align: center;
		flex-grow: 1;
		font-weight: 700;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.view-controls {
		position: absolute;
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		gap: 0.5rem;
	}

	.header-btn {
		background-color: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		padding: 0.5rem 1rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all var(--transition-fast);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-sm);
	}

	.header-btn:hover {
		background-color: var(--color-bg-hover);
		border-color: var(--color-border-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	@media (max-width: 768px) {
		.page-title {
			flex-direction: column;
			gap: 1rem;
			margin: 1.5rem auto;
		}

		.view-controls {
			position: static;
			transform: none;
			width: 100%;
			justify-content: center;
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
		overflow: hidden;
		margin-top: 1rem;
		box-shadow: var(--glass-shadow);
		border: 1px solid var(--glass-border);
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
				'set      language finish'
				'vendor1  vendor2  vendor3';
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

		td[data-label='CardTrader'] {
			grid-area: vendor1;
		}

		td[data-label='TCGPlayer'] {
			grid-area: vendor2;
		}

		td[data-label='CardMarket'],
		td[data-label='EBay'] {
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
		td[data-label='TCGPlayer']::before {
			content: attr(data-label);
			font-weight: 600;
			color: var(--color-text-secondary);
			display: block;
			margin-bottom: 0.25rem;
		}

		td[data-label='CardTrader'],
		td[data-label='TCGPlayer'] {
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
</style>
