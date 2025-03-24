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

    async function handleAddToSeeking(event) {
        if (!mounted) return;
        const cardData = event.detail;
        console.log('Adding to Seeking:', cardData);
        try {
            // Add your CosmosDB API call here
            console.log('Card added to Seeking list');
        } catch (error) {
            console.error('Error adding card to Seeking:', error);
        }
    }
</script>

{#if mounted}
    <main class="container">
        <h1>Seeker</h1>
        <CardSearchForm 
            on:search={handleSearch}
        />
        <CardList 
            {cards} 
            {hasSearched} 
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
