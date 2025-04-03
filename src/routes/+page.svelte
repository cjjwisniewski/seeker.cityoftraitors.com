<script>
    import { onMount } from 'svelte';
    import CardSearchForm from '$lib/components/CardSearchForm.svelte';
    import CardList from '$lib/components/CardList.svelte';
    import { page } from '$app/stores';

    let cards = [];
    let hasSearched = false;
    let mounted = false;

    onMount(() => {
        mounted = true;
    });

    const handleSearch = (event) => {
        cards = event.detail;
        hasSearched = true;
    };

    async function handleAddToSeeking(card) {
        const response = await fetch('/api/addToSeeking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-finish': selectedFinishes[card.id] || 'nonfoil'
            },
            body: JSON.stringify(cardData)
        });

        if (!response.ok) {
            // Handle error
            console.error('Failed to add card to seeking list');
            return;
        }

        const result = await response.json();
        // Handle success
    }
</script>

{#if mounted}
    <main class="container">
        <h1>Add to Seeking</h1>
        <CardSearchForm 
            on:search={handleSearch}
        />
        <CardList 
            {cards} 
            {hasSearched}
            userId={$page.data.user?.id}
            on:addToSeeking={handleAddToSeeking}
        />
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
</style>
