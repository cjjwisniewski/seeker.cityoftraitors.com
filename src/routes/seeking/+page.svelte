<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores'; // Still potentially useful for user ID display etc.
    import { PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL } from '$env/static/public';

    let cards = [];
    let loading = true;
    let error = null;
    let accessToken = null; // Variable to store the token

    // Helper function to read a specific cookie
    function getCookie(name) {
        if (typeof document === 'undefined') return null; // Check if running client-side
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            // Decode the cookie value in case it contains special characters
            try {
                return decodeURIComponent(parts.pop().split(';').shift());
            } catch(e) {
                console.error("Error decoding cookie", e);
                return null;
            }
        }
        return null;
    }

    onMount(() => {
        accessToken = getCookie('discord_token'); // Read the token on mount (client-side)
        if (accessToken) {
            fetchSeekingList();
        } else {
            error = "Authentication token not found. Please log in.";
            loading = false;
            console.error(error);
            // Optional: redirect to login page
            // import { goto } from '$app/navigation';
            // goto('/login');
        }
    });

    async function fetchSeekingList() {
        if (!accessToken) {
            error = "Cannot fetch list: missing access token.";
            loading = false;
            return;
        }
        loading = true; // Set loading true when fetching starts
        error = null; // Clear previous errors

        try {
            // Call APIM endpoint directly
            const response = await fetch(PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, {
                headers: {
                    // ADD Authorization header with token from cookie
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    // REMOVE x-ms-client-principal-id header (APIM handles it)
                }
            });

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

    // No longer need onMount(fetchSeekingList); - it's called inside onMount now

    async function handleDelete(card) {
        if (!accessToken) {
             error = "Cannot delete card: missing access token.";
             console.error(error);
             return;
        }
        // Consider adding a loading state for delete operations if desired

        try {
            // ... (rest of delete logic, preparing requestBody) ...
             const requestBody = {
                partitionKey: card.set_code,
                rowKey: `${card.collector_number}_${card.language}_${card.finish}`
            };

            // Call APIM endpoint directly
            const response = await fetch(PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL, {
                method: 'DELETE',
                headers: {
                    // ADD Authorization header with token from cookie
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    // REMOVE x-ms-client-principal-id header (APIM handles it)
                },
                body: JSON.stringify(requestBody)
            });

            // ... (rest of response handling) ...
             console.log('Delete Response status:', response.status);
             const responseText = await response.text();
             console.log('Delete Response body:', responseText);

             if (!response.ok) {
                 throw new Error(`Failed to delete card: ${responseText}`);
             }

             cards = cards.filter(c => c.id !== card.id);
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

{#if loading}
    <div class="loading">Loading...</div>
{:else if error}
    <div class="error">{error}</div>
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
        text-align: left;
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