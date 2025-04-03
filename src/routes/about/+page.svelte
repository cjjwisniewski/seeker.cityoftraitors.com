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
            <p>
                Seeker is a tool designed to help Magic: The Gathering collectors efficiently find the specific cards they need to complete their collections.  Whether you're searching for a rare foil, a specific language version, or just that one missing card from a set, Seeker streamlines the process by searching across multiple online marketplaces.
            </p>

            <h2>Features</h2>
            <ul>
                <li>
                    <strong>Multi-Marketplace Search:</strong> Seeker aggregates listings from popular MTG marketplaces like CardTrader (others coming soon), allowing you to compare prices and availability in one place.
                </li>
                <li>
                    <strong>Precise Filtering:</strong> Find exactly what you're looking for with advanced filtering options, including set, language, and finish (foil/non-foil).
                </li>
                <li>
                    <strong>Personalized Seeking List:</strong> Create and manage a personalized "Seeking List" to track the cards you need.
                </li>
                <li>
                    <strong>Real-Time Stock Indicators:</strong> See at a glance whether a card is currently available or unavailable on each marketplace.
                </li>
            </ul>

            <h2>How It Works</h2>
            <p>
                Seeker simplifies the card-hunting process. Simply add the cards you're looking for to your Seeking List. Seeker will then check the connected marketplaces and display the availability and links to the cards.
            </p>

            <h2>Future Development (To-Do)</h2>
            <ul>
                <li>
                    <strong>Expanded Marketplace Support:</strong> Add support for more MTG marketplaces.
                </li>
                <li>
                    <strong>Mobile Optimization:</strong> Improve the mobile experience.
                </li>
                <li>
                    <strong>Direct Links:</strong> Quickly jump to the card's listing on each marketplace with direct links. Your cards are just one click away!
                </li>
            </ul>

            <h2>Community</h2>
            <p>
                Seeker is a community-driven project, created for and by MTG collectors. It is part of the City of Traitors community.
            </p>

            <h2>Contact</h2>
            <p>
                For support, feature requests, or any questions, please reach out to <a href="https://discord.com/users/213058259076913152" target="_blank" rel="noopener noreferrer">@undomian</a> on the City of Traitors Discord.
            </p>
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
    a {
        color: var(--color-primary);
    }
</style>
