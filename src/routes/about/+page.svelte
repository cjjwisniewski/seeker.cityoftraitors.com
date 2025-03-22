<script>
    import { onMount } from 'svelte';
    
    let mounted = false;

    onMount(() => {
        mounted = true;
    });
</script>

{#if mounted}
    <main class="container">
        <h1>About Seeker</h1>
        <div class="about-content">
            <p>Seeker is a tool that helps collectors find specific cards for their collections across multiple marketplaces.</p>
            
            <h2>Features</h2>
            <ul>
                <li>item 1</li>
                <li>item 2</li>
                <li>item 3</li>
            </ul>
            <h2>To-Do:</h2>
            <ul>
                <li>item 1</li>
                <li>item 2</li>
                <li>item 3</li>
            </ul>
            <h2>Contact</h2>
            <p>For support or questions, please reach out to @undomian on the City of Traitors Discord.</p>
        </div>
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

    .about-content {
        text-align: left;
        margin-top: 2em;
    }

    ul {
        list-style-position: inside;
        padding-left: 1em;
    }

    h2 {
        margin-top: 1.5em;
    }
</style>