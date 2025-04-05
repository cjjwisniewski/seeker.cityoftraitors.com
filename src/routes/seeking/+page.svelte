<script>
    import { onMount, onDestroy } from 'svelte'; // Import onDestroy
    import { auth } from '$lib/stores/auth'; // Import auth store
    import { fetchWithAuth } from '$lib/utils/api'; // Import fetch helper
    import { PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL } from '$env/static/public';

    let cards = [];
    let error = null;
    let loading = true; // Re-declare the loading variable

    // Reactive check for authentication status
    $: isAuthenticated = $auth.isAuthenticated;
    $: authLoading = $auth.isLoading;

    // Fetch data when component mounts and user is authenticated
    onMount(() => {
        // Declare unsubscribe variable first
        let unsubscribe;
        // Wait for auth store to initialize if needed
        unsubscribe = auth.subscribe(state => {
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

        // Unsubscribe when the component is destroyed
        onDestroy(() => {
            if (unsubscribe) {
                unsubscribe();
            }
        });
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
</script>

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
                    <th>Card</th>
                    <th>Set</th>
                    <th>Language</th>
                    <th>Finish</th>
                    <th>CardTrader</th>
                    <th class="disabled-column" title="TCGPlayer stock check coming soon">TCGPlayer</th>
                    <th class="disabled-column" title="CardMarket stock check coming soon">CardMarket</th>
                    <th class="disabled-column" title="Ebay stock check coming soon">EBay</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each cards as card (card.id)}
                    <tr>
                        <td>
                            <div class="card-info">
                                <img src={card.image_uri} alt={card.name} />
                                <span>{card.name}</span>
                            </div>
                        </td>
                        <td>{card.set_code}</td>
                        <td>{card.language}</td>
                        <td>{card.finish}</td>
                        <td class="stock-icon">
                            <i class="{getStockIcon(getStockStatus(card.cardtrader_stock))} {getStockColor(getStockStatus(card.cardtrader_stock))}"></i>
                        </td>
                        <td class="stock-icon disabled-column">
                            <i class="{getStockIcon(getStockStatus(card.tcgplayer_stock))} {getStockColor(getStockStatus(card.tcgplayer_stock))}"></i>
                        </td>
                        <td class="stock-icon disabled-column">
                            <i class="{getStockIcon(getStockStatus(card.cardmarket_stock))} {getStockColor(getStockStatus(card.cardmarket_stock))}"></i>
                        </td>
                        <td class="stock-icon disabled-column">
                            <i class="{getStockIcon(getStockStatus(card.ebay_stock))} {getStockColor(getStockStatus(card.ebay_stock))}"></i>
                        </td>
                        <td class="delete-btn-column">
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
    }

    .stock-icon {
        text-align: center;
        font-size: 1rem;
    }

    /* Style for visually disabled columns */
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
        padding: 0.5rem;
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
</style>
