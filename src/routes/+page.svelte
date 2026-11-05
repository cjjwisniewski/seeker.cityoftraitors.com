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
		<div class="search-hero" class:has-searched={hasSearched}>
			{#if !hasSearched}
				<p class="hero-prompt">
					Search any Magic card to track prices, foil printings, and multi-marketplace restocks
				</p>
			{/if}
			<CardSearchForm on:search={handleSearch} />
		</div>

		{#if !hasSearched}
			<div class="instructions-grid">
				<div class="instruction-card">
					<div class="card-icon-badge">
						<i class="fa-solid fa-magnifying-glass"></i>
					</div>
					<div class="card-body">
						<h3>Find & Configure</h3>
						<p>Search any card by name, choose your target set, preferred finish, and set a maximum price cap.</p>
					</div>
				</div>
				<div class="instruction-card">
					<div class="card-icon-badge">
						<i class="fa-solid fa-arrows-rotate"></i>
					</div>
					<div class="card-body">
						<h3>Automated Scanning</h3>
						<p>Seeker continuously polls CardTrader, TCGPlayer, eBay, Mana Pool, HiMarket, Hareruya, and Ruten around the clock.</p>
					</div>
				</div>
				<div class="instruction-card">
					<div class="card-icon-badge">
						<i class="fa-brands fa-discord"></i>
					</div>
					<div class="card-body">
						<h3>Discord Restock Alerts</h3>
						<p>Receive immediate Discord direct messages with direct buy links when a seller lists your card.</p>
					</div>
				</div>
			</div>
		{/if}

		<CardList {cards} {hasSearched} />
	</div>
{/if}

<style>
	.home-container {
		text-align: center;
		padding: 1.5rem 1rem 3rem 1rem;
		max-width: 900px;
		margin: 0 auto;
		animation: fadeIn 0.5s ease-out;
	}

	.search-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 2rem;
		transition: margin-bottom var(--transition-normal);
	}

	.search-hero.has-searched {
		margin-bottom: 0.75rem;
	}

	.hero-prompt {
		margin: 0 0 0.5rem 0;
		color: var(--color-text-secondary);
		font-size: 1rem;
		max-width: 600px;
		line-height: 1.5;
	}

	.instructions-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
		margin-top: 2rem;
		text-align: left;
	}

	.instruction-card {
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px solid var(--glass-border, var(--color-border));
		border-radius: 12px;
		padding: 1.25rem;
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: transform var(--transition-fast), border-color var(--transition-fast);
	}

	.instruction-card:hover {
		transform: translateY(-2px);
		border-color: var(--color-primary);
	}

	.card-icon-badge {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
	}

	.card-body h3 {
		margin: 0 0 0.4rem 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.card-body p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	@media (max-width: 768px) {
		.instructions-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.home-container {
			padding: 1rem 1rem 2rem 1rem;
		}
	}
</style>
