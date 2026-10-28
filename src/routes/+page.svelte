<script>
	import { onMount } from 'svelte';
	import CardSearchForm from '$lib/components/CardSearchForm.svelte';
	import CardList from '$lib/components/CardList.svelte';

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
</script>

{#if mounted}
	<div class="home-container">
		<h1>Add to Seeking</h1>
		<CardSearchForm on:search={handleSearch} />

		{#if !hasSearched}
			<div class="instructions">
				<h2>How to use Seeker</h2>
				<ol>
					<li>
						Search for the cards that you need to finish your collection and add them to your
						Seeking list.
					</li>
					<li>
						Seeker will automatically search for the cards on your wishlist on a regular basis.
					</li>
					<li>When Seeker finds your card, it will DM you on Discord to let you know!</li>
				</ol>
			</div>
		{/if}

		<CardList {cards} {hasSearched} />
	</div>
{/if}

<style>
	.home-container {
		text-align: center;
		padding: 2em;
		max-width: 800px;
		margin: 0 auto;
		margin-top: 2em;
		animation: fadeIn 0.5s ease-out;
	}

	h1 {
		margin-bottom: 1.5rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline-block;
	}

	.instructions {
		margin-top: 3rem;
		text-align: left;
		background: var(--color-surface, rgba(255, 255, 255, 0.05));
		padding: 2rem;
		border-radius: 12px;
		display: inline-block;
		max-width: 600px;
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
	}

	.instructions h2 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		color: var(--color-text-primary, inherit);
		text-align: center;
	}

	.instructions ol {
		padding-left: 1.5rem;
		margin: 0;
	}

	.instructions li {
		margin-bottom: 0.75rem;
		line-height: 1.5;
		color: var(--color-text-secondary, inherit);
	}

	.instructions li:last-child {
		margin-bottom: 0;
	}
</style>
