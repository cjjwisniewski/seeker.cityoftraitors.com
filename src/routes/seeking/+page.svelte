<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL } from '$env/static/public';

    let cards = [];
    let loading = true;
    let error = null;

    async function fetchSeekingList() {
        try {
            const response = await fetch(PUBLIC_GET_SEEKING_LIST_FUNCTION_URL, {
                headers: {
                    'x-ms-client-principal-id': `user${$page.data.user?.id}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch seeking list');
            }

            const data = await response.json();
            // Debug log to see the full card data
            data.cards.forEach(card => {
                console.log('Card data:', {
                    id: card.id,
                    name: card.name,
                    set_code: card.set_code,
                    collector_number: card.collector_number,
                    language: card.language,
                    finish: card.finish
                });
            });
            cards = data.cards;
        } catch (e) {
            error = e.message;
            console.error('Error fetching cards:', e);
        } finally {
            loading = false;
        }
    }

    onMount(fetchSeekingList);

    async function handleDelete(card) {
        try {
            // Debug log of the full card object
            console.log('Full card object:', card);
            
            if (!card.collector_number) {
                console.error('Missing collector_number for card:', card);
                throw new Error('Card is missing collector number');
            }

            const requestBody = {
                partitionKey: card.set_code,
                rowKey: `${card.collector_number}_${card.language}_${card.finish}`
            };
            console.log('Request body:', requestBody);

            const response = await fetch(PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ms-client-principal-id': `user${$page.data.user?.id}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status);
            const responseText = await response.text();
            console.log('Response body:', responseText);

            if (!response.ok) {
                throw new Error(`Failed to delete card: ${responseText}`);
            }

            try {
                const responseData = JSON.parse(responseText);
                console.log('Parsed response:', responseData);
            } catch (e) {
                console.log('Response was not JSON:', responseText);
            }

            // Remove the card from the local state only after successful deletion
            cards = cards.filter(c => c.id !== card.id);
            console.log('Card removed from local state');
        } catch (e) {
            error = e.message;
            console.error('Error deleting card:', {
                error: e,
                message: e.message,
                stack: e.stack
            });
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
                    <th>TCGPlayer</th>
                    <th>CardMarket</th>
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
                        <td>
                            <i class="{getStockIcon(card.stock.cardtrader)} {getStockColor(card.stock.cardtrader)}"></i>
                        </td>
                        <td>
                            <i class="{getStockIcon(card.stock.tcgplayer)} {getStockColor(card.stock.tcgplayer)}"></i>
                        </td>
                        <td>
                            <i class="{getStockIcon(card.stock.cardmarket)} {getStockColor(card.stock.cardmarket)}"></i>
                        </td>
                        <td>
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

    .delete-btn {
        background: none;
        border: none;
        color: var(--color-error);
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 4px;
        transition: background-color 0.2s;
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