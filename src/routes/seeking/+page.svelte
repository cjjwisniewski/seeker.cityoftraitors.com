<script>
    import { onMount, onDestroy } from 'svelte'; // Import onDestroy
    import { auth } from '$lib/stores/auth'; // Import auth store
    import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
    import { PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL } from '$env/static/public';

    let cards = [];
    let error = null;
    let loading = true; // Re-declare the loading variable
    let unsubscribe; // Declare unsubscribe in the component scope
    let isCondensed = false; // State for condensed view

    // Sorting state
    let sortKey = 'name'; // Default sort key
    let sortDirection = 'asc'; // Default sort direction ('asc' or 'desc')

    // Reactive check for authentication status
    $: isAuthenticated = $auth.isAuthenticated;
    $: authLoading = $auth.isLoading;

    // Fetch data when component mounts and user is authenticated
    onMount(() => {
        // REMOVED: let unsubscribe; - Moved to component scope
        // Wait for auth store to initialize if needed
        unsubscribe = auth.subscribe(state => { // Assign to the component-scoped variable
            if (!state.isLoading) {
                if (state.isAuthenticated) {
                    fetchSeekingList();
                } else {
                    // Handle case where user is not logged in (layout should redirect, but good practice)
                    error = "Please log in to view your seeking list.";
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
                error = "Authentication failed while fetching seeking list.";
                console.error(error);
                return; // Stop execution
            }

            if (!response.ok) {
                let errorBody = await response.text();
                try { errorBody = JSON.parse(errorBody); } catch(e) { /* Ignore */ }
                console.error("Fetch error response:", errorBody);
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
                    'Content-Type': 'application/json',
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
             cards = cards.filter(c =>
                !(c.set_code === card.set_code &&
                  c.collector_number === card.collector_number &&
                  c.language === card.language &&
                  c.finish === card.finish)
             );
             console.log('Card removed from local state');

        } catch (e) {
            error = `Delete failed: ${e.message}`; // Update error state
            console.error('Error deleting card:', e);
        }
    }

    function getStockIcon(status) {
        switch(status) {
            case 'available':
                return 'fa-solid fa-circle-check';
            case 'unavailable':
                return 'fa-solid fa-circle-xmark';
            default:
                return 'fa-solid fa-circle-question';
        }
    }

    function getStockColor(status) {
        switch(status) {
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
            '4bb': '4ed',  // Fourth Edition Foreign Black Border -> Fourth Edition
            'fbb': '3ed',  // Foreign Black Border (Revised) -> Revised Edition (3ED)
            'sld': 'pmei', // Secret Lair Drop -> Media Promos
            'tsb': 'tsp',   // Time Spiral Timeshifted -> Time Spiral
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
    $: sortedCards = [...cards].sort((a, b) => {
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
</script>

<div class="page-title">
    <h1>Seeking List</h1>
</div>

{#if authLoading || loading}
    <div class="loading">Loading seeking list...</div>
{:else if error}
    <div class="error">{error}</div>
{:else if !isAuthenticated}
     <div class="empty">Please log in to view your seeking list.</div>
{:else if cards.length === 0}
    <div class="empty">No cards in seeking list</div>
{:else}
    <div class="view-controls">
        <button on:click={() => isCondensed = !isCondensed} class="toggle-view-btn">
            <i class="fa-solid {isCondensed ? 'fa-maximize' : 'fa-minimize'}"></i>
            {isCondensed ? 'Expand View' : 'Condense View'}
        </button>
    </div>
    <div class="seeking-list">
        <table>
            <thead>
                <tr>
                    <th on:click={() => sortBy('name')} class:active={sortKey === 'name'}>
                        Card
                        {#if sortKey === 'name'}
                            <i class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                        {/if}
                    </th>
                    <th on:click={() => sortBy('set_code')} class:active={sortKey === 'set_code'}>
                        Set
                        {#if sortKey === 'set_code'}
                            <i class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                        {/if}
                    </th>
                    <th on:click={() => sortBy('language')} class:active={sortKey === 'language'}>
                        Language
                        {#if sortKey === 'language'}
                            <i class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                        {/if}
                    </th>
                    <th on:click={() => sortBy('finish')} class:active={sortKey === 'finish'}>
                        Finish
                        {#if sortKey === 'finish'}
                             <i class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                        {/if}
                    </th>
                    <th on:click={() => sortBy('cardtrader_low_price')} class:active={sortKey === 'cardtrader_low_price'}>
                        CardTrader
                        {#if sortKey === 'cardtrader_low_price'}
                             <i class="sort-icon fa-solid {sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>
                        {/if}
                    </th>
                    <th class="disabled-column" title="TCGPlayer stock check coming soon">
                        TCGPlayer
                        <!-- Add sorting later if needed -->
                        <!-- <i class="sort-icon fa-solid ..."></i> -->
                    </th>
                    <th class="disabled-column display-none" title="CardMarket stock check coming soon">
                         CardMarket
                         <!-- Add sorting later if needed -->
                    </th>
                    <th class="disabled-column" title="Ebay stock check coming soon">
                        EBay
                        <!-- Add sorting later if needed -->
                    </th>
                    <th>Actions</th> <!-- Not sortable -->
                </tr>
            </thead>
            <tbody>
                {#each sortedCards as card (card.id)}
                    <tr class:condensed={isCondensed}>
                        <td data-label="Card">
                            <div class="card-info">
                                {#if !isCondensed}
                                    <img src={card.image_uri} alt={card.name} class="card-thumbnail" />
                                {/if}
                                <span>{card.name}</span>
                            </div>
                        </td>
                        <td data-label="Set" class="set-column">
                            <img
                                src="https://svgs.scryfall.io/sets/{getSetIconCode(card.set_code)}.svg"
                                alt="{card.set_code} set icon"
                                title="{card.set_code.toUpperCase()}"
                                class="set-icon"
                            />
                        </td>
                        <td data-label="Language" class="language-column">{card.language}</td>
                        <td data-label="Finish">{card.finish}</td>
                        <td data-label="CardTrader" class="vendor-stock-cell">
                            {#if card.cardtrader_id}
                                <a href="https://www.cardtrader.com/cards/{card.cardtrader_id}" target="_blank" rel="noopener noreferrer" class="vendor-link">
                                    <div class="stock-indicator">
                                        <i class="{getStockIcon(getStockStatus(card.cardtrader_stock))} {getStockColor(getStockStatus(card.cardtrader_stock))}"></i>
                                        {#if card.cardtrader_low_price !== null && card.cardtrader_low_price !== undefined}
                                            <span class="price-text">{formatPrice(card.cardtrader_low_price)}</span>
                                        {/if}
                                    </div>
                                </a>
                            {:else}
                                <!-- Show only question mark if CardTrader ID is missing -->
                                <div class="stock-indicator">
                                     <i class="fa-solid fa-circle-question text-muted" title="Card not found on CardTrader"></i>
                                     <!-- No price shown when ID is missing -->
                                </div>
                            {/if}
                        </td>
                        <td data-label="TCGPlayer" class="vendor-stock-cell disabled-column">
                             <div class="stock-indicator">
                                <i class="{getStockIcon(getStockStatus(card.tcgplayer_stock))} {getStockColor(getStockStatus(card.tcgplayer_stock))}"></i>
                                {#if card.tcgplayer_low_price !== null && card.tcgplayer_low_price !== undefined}
                                    <span class="price-text">{formatPrice(card.tcgplayer_low_price)}</span>
                                {/if}
                            </div>
                        </td>
                        <td data-label="CardMarket" class="vendor-stock-cell disabled-column display-none">
                             <div class="stock-indicator">
                                <i class="{getStockIcon(getStockStatus(card.cardmarket_stock))} {getStockColor(getStockStatus(card.cardmarket_stock))}"></i>
                                {#if card.cardmarket_low_price !== null && card.cardmarket_low_price !== undefined}
                                    <span class="price-text">{formatPrice(card.cardmarket_low_price)}</span>
                                {/if}
                            </div>
                        </td>
                        <td data-label="EBay" class="vendor-stock-cell disabled-column">
                             <div class="stock-indicator">
                                <i class="{getStockIcon(getStockStatus(card.ebay_stock))} {getStockColor(getStockStatus(card.ebay_stock))}"></i>
                                {#if card.ebay_low_price !== null && card.ebay_low_price !== undefined}
                                    <span class="price-text">{formatPrice(card.ebay_low_price)}</span>
                                {/if}
                            </div>
                        </td>
                        <td data-label="Actions" class="delete-btn-column">
                            <button
                                class="delete-btn"
                                aria-label="Delete card"
                                on:click={() => handleDelete(card)}
                                disabled={!isAuthenticated}
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
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
    }

    table {
        width: 100%;
        border-collapse: collapse;
        background: var(--color-bg-elevated);
        border-radius: 8px;
        overflow: hidden;
        margin-top: 1rem; /* Add space below the toggle button */
    }

    th, td {
        padding: 1rem;
        text-align: center;
        border-bottom: 1px solid var(--color-border);
    }

    th {
        background: var(--color-bg-secondary);
        font-weight: 600;
        color: var(--color-text-primary);
        text-align: center;
        cursor: pointer; /* Indicate clickable headers */
        position: relative; /* For positioning the sort icon */
        user-select: none; /* Prevent text selection on click */
        padding-right: 1.5em; /* Make space for the sort icon */
        white-space: nowrap; /* Prevent header text wrapping */
    }

    th.active {
        color: var(--color-accent); /* Highlight active sort column */
    }

    th:not([class*="disabled-column"]):hover {
        background-color: var(--color-bg-hover); /* Hover effect */
    }

    .sort-icon {
        position: absolute;
        right: 0.5em; /* Position icon to the right */
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.8em;
    }

    /* Disable pointer events and hover on disabled columns */
    th.disabled-column {
        cursor: not-allowed;
        pointer-events: none;
        padding-right: 1rem; /* Reset padding if no icon */
    }
    th.disabled-column:hover {
        background-color: var(--color-bg-secondary); /* No hover effect */
    }

    .display-none {
        display: none;
    }

    .card-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .card-info img {
        width: 40px;
        height: auto;
        border-radius: 4px;
        /* Add transition for smoother appearance/disappearance */
        transition: width 0.3s ease, opacity 0.3s ease, margin-right 0.3s ease;
        opacity: 1;
        margin-right: 1rem; /* Ensure space is maintained */
    }

    /* When condensed, hide the image smoothly */
    tr.condensed .card-info img {
        width: 0;
        opacity: 0;
        margin-right: 0;
        display: none; 
    }

    .vendor-stock-cell {
        text-align: center;
        vertical-align: middle; /* Vertically center content in the cell */
        padding-top: 1rem;
        padding-bottom: 1rem;
    }

    .stock-indicator {
        display: inline-block; /* Allows text-align:center on parent td to work */
        text-align: center;
    }

    .stock-indicator i {
        display: block; /* Icon takes its own line */
        font-size: 1rem; /* Icon size */
        margin-bottom: 0.25rem; /* Space below icon */
    }

    .price-text {
        display: block; /* Price takes its own line */
        font-size: 0.7rem; /* Smaller font size for price */
        color: var(--color-text-muted); /* Muted color */
        line-height: 1;
    }

    .set-column {
        /* text-transform: uppercase; */ /* No longer needed for text */
        text-align: center; /* Center the icon */
    }

    .set-icon {
        height: 1.5em; /* Adjust size as needed */
        width: 1.5em;  /* Adjust size as needed */
        vertical-align: middle; /* Align icon nicely in the cell */
    }

    /* Example dark mode adjustment (add this if your theme needs it) */
    /* html[data-theme='dark'] .set-icon {
        --set-icon-invert: 1;
    } */

    .language-column {
        text-transform: uppercase;
    }

    .disabled-column {
        opacity: 0.5;
        cursor: not-allowed;
        position: relative;
        filter: grayscale(1);
    }

    .delete-btn-column {
        text-align: center;
    }

    .delete-btn {
        background: none;
        border: none;
        color: var(--color-error);
        cursor: pointer;
        padding: 0.25rem 0.5rem; /* Adjust padding */
        border-radius: 4px;
        transition: background-color 0.2s;
        text-align: center;
    }

    .delete-btn:hover {
        background: var(--color-error);
        color: white;
    }

    .text-success { color: var(--color-success); }
    .text-error { color: var(--color-error); }
    .text-muted { color: var(--color-text-muted); }

    .loading, .error, .empty {
        text-align: center;
        padding: 2rem;
        color: var(--color-text-secondary);
    }

    .error {
        color: var(--color-error);
    }

    .vendor-link {
        text-decoration: none; /* Remove underline from link */
        color: inherit; /* Inherit color from parent */
        display: inline-block; /* Ensure it behaves like the div it replaces */
    }

    /* Add Responsive Styles */
    @media (max-width: 768px) {
        thead {
            display: none; /* Hide original header */
        }

        tbody,
        tbody tr,
        tbody td {
            display: block; /* Reset to block for basic stacking */
            width: 100%;
            box-sizing: border-box;
        }

        tbody tr {
            display: grid; /* Make the row the grid container */
            grid-template-columns: repeat(3, 1fr); /* Three equal columns */
            grid-template-areas:
                "cardinfo cardinfo cardinfo"
                "set      language finish"  
                "vendor1  vendor2  vendor3" 
                "actions  actions  actions";
            gap: 0.5rem 1rem; /* Row gap, Column gap */
            margin-bottom: 1rem;
            border: 1px solid var(--color-border);
            border-radius: 6px;
            padding: 1rem;
            background-color: var(--color-bg-elevated);
            box-shadow: var(--shadow-sm);
        }

        tbody td {
            grid-area: initial; /* Reset area first */
            padding: 0; /* Reset padding */
            border: none; /* Remove default borders */
            text-align: center; /* Center content */
            display: flex; /* Use flex for internal alignment */
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            min-height: 3.5em; /* Ensure cells have height */
        }
        
        /* Add headers using ::before */
        tbody td::before {
            content: attr(data-label);
            font-size: 0.75rem;
            color: var(--color-text-muted);
            font-weight: 600;
            text-transform: uppercase;
        }
        
        /* --- Assign Grid Areas --- */
        td[data-label="Card"]       { grid-area: cardinfo; }
        td[data-label="Set"]        { grid-area: set; }
        td[data-label="Language"]   { grid-area: language; }
        td[data-label="Finish"]     { grid-area: finish; }
        td[data-label="CardTrader"] { grid-area: vendor1; }
        td[data-label="TCGPlayer"]  { grid-area: vendor2; }
        td[data-label="EBay"]       { grid-area: vendor3; }
        td[data-label="Actions"]    { grid-area: actions; }
        
         /* Hide CardMarket by default if needed */
        td[data-label="CardMarket"] { display: none; }

        /* --- Style Specific Cells --- */
        
        /* Card Info */
        td[data-label="Card"] {
             border-bottom: 1px solid var(--color-border-light); /* Separator */
             margin-bottom: 0.5rem; /* Space below */
             padding-bottom: 0.5rem; /* Space below */
             flex-direction: row; /* Keep image and name side-by-side */
             justify-content: center; /* Center them */
        }
        td[data-label="Card"]::before { display: none; } /* Hide "Card" header */
        .card-info {
            gap: 0.5rem; /* Reduce gap for mobile */
        }
         .card-info img {
            width: 35px; /* Adjust size */
        }
        
        /* Language Value */
        td[data-label="Language"] .language-column { /* Target the value if needed */
            text-transform: uppercase;
        }
        
        /* Set Value */
        td[data-label="Set"] .set-icon {
             height: 1.8em;
             width: 1.8em;
        }
        
        /* Vendor Cells */
        .vendor-stock-cell .stock-indicator {
            /* Styles already handle stacking */
        }
        .vendor-stock-cell .stock-indicator i {
             font-size: 1.1rem;
        }
         .vendor-stock-cell .price-text {
            font-size: 0.75rem;
        }
        
        /* Actions Cell */
        td[data-label="Actions"] {
            justify-content: flex-end; /* Align button right */
             border-top: 1px solid var(--color-border-light); /* Separator */
             margin-top: 0.5rem; /* Space above */
             padding-top: 0.5rem; /* Space above */
        }
         td[data-label="Actions"]::before { display: none; } /* Hide "Actions" header */

        .delete-btn {
             padding: 0.25rem 0.5rem; /* Adjust padding */
        }
        
         /* Disabled Styling */
         .disabled-column {
            opacity: 0.6;
        }
         .display-none { 
              display: none !important; /* Ensure it hides */
         }
    }

    /* Style for the toggle button */
    .view-controls {
        display: flex;
        justify-content: flex-end; /* Position button to the right */
        margin: 1rem auto;
        max-width: 1200px;
        padding: 0 1rem;
    }

    .toggle-view-btn {
        background-color: var(--color-bg-secondary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s, border-color 0.2s;
        display: inline-flex; /* Align icon and text */
        align-items: center;
        gap: 0.5rem; /* Space between icon and text */
    }

    .toggle-view-btn:hover {
        background-color: var(--color-bg-elevated);
        border-color: var(--color-border-hover);
    }

    /* Adjust card info alignment in condensed mobile view */
    tr.condensed .card-info {
        justify-content: center; /* Center the name when image is hidden */
    }
</style>
