<script>
    import { onMount } from 'svelte';

    export let data;
    let seekingList = [];
    let mounted = false;

    onMount(() => {
        mounted = true;
        // TODO: Fetch seeking list from CosmosDB for current user
        // data.user.id can be used to fetch user-specific cards
    });
</script>

{#if mounted}
    <main class="container">
        <h1>Seeking</h1>
        {#if seekingList.length > 0}
            <div class="seeking-list">
                {#each seekingList as card}
                    <div class="card-item">
                        <img src={card.image_uri} alt={card.name} />
                        <div class="card-info">
                            <h3>{card.name}</h3>
                            <p>{card.set_code} #{card.collector_number}</p>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <p>No cards in seeking list yet.</p>
        {/if}
    </main>
{/if}

<style>
    main {
        text-align: center;
        padding: 2em;
        max-width: 800px;
        margin: 0 auto;
        margin-top: 2em;
    }
    
    .seeking-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .card-item {
        background: var(--color-bg-elevated);
        border-radius: 8px;
        padding: 1rem;
        box-shadow: var(--shadow-sm);
    }

    .card-item img {
        width: 100%;
        height: auto;
        border-radius: 4.75%;
    }

    .card-info {
        margin-top: 0.5rem;
    }

    h3 {
        margin: 0;
        font-size: 1rem;
        color: var(--color-text-primary);
    }

    p {
        margin: 0.25rem 0 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary);
    }

    .user-info {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }
</style>