<script>
    import CardSearchForm from '$lib/components/CardSearchForm.svelte';
    import CardList from '$lib/components/CardList.svelte';

    let cards = [];

    const handleSearch = (searchResults) => {
    cards = searchResults;
    };
</script>

<main class="container">
    <h1>Seeker</h1>
    <CardSearchForm on:search={handleSearch} />
    <CardList {cards} />
</main>

<style>
    main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
    }
</style>
