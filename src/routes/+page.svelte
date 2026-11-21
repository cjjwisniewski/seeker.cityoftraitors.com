<script>
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import CardSearchForm from '$lib/components/CardSearchForm.svelte';
	import CardList from '$lib/components/CardList.svelte';
	import DiscordInviteModal from '$lib/components/DiscordInviteModal.svelte';

	let cards = [];
	let hasSearched = false;
	let mounted = false;
	let showDiscordModal = false;

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
			<ol class="steps-strip">
				<li class="step-item">
					<span class="step-num">01</span>
					<div class="step-body">
						<h3>Find &amp; Configure</h3>
						<p>Search any card by name, choose your target set, preferred finish, and set a maximum price cap.</p>
					</div>
				</li>
				<li class="step-item">
					<span class="step-num">02</span>
					<div class="step-body">
						<h3>Automated Scanning</h3>
						<p>Seeker continuously polls major domestic and international marketplaces around the clock.</p>
					</div>
				</li>
				<li class="step-item">
					<span class="step-num">03</span>
					<div class="step-body">
						<h3>Discord Restock Alerts</h3>
						<p>Receive immediate Discord direct messages with direct buy links when a seller lists your card.</p>
					</div>
				</li>
			</ol>

			{#if !$auth.isAuthenticated}
				<div class="demo-promo-banner">
					<div class="demo-promo-copy">
						<span class="demo-promo-badge">No Discord Login Required</span>
						<strong>Want to see Seeker in action first?</strong>
						<span>Explore a live 12-card interactive watchlist across 8 marketplaces, import sample decklists, and preview Discord DM alerts.</span>
					</div>
					<a href="/demo" data-sveltekit-preload-data="off" class="demo-promo-cta">
						<i class="fa-solid fa-flask"></i>
						<span>View Live Demo Watchlist</span>
					</a>
				</div>

				<div class="discord-community-banner">
					<div class="discord-community-copy">
						<strong>Need an invite to the City of Traitors Discord?</strong>
						<span>Seeker DM alerts and community discussions live on the City of Traitors Discord server.</span>
					</div>
					<button
						type="button"
						class="discord-community-cta"
						on:click={() => (showDiscordModal = true)}
					>
						<i class="fa-brands fa-discord"></i>
						<span>Join Discord</span>
					</button>
				</div>
			{:else if $auth.isDemo}
				<div class="demo-promo-banner">
					<div class="demo-promo-copy">
						<span class="demo-promo-badge">Demo Sandbox Active</span>
						<span>Search any card above and click <strong>Add to Seeking</strong> to test adding it with live Scryfall pricing, or jump back to your watchlist.</span>
					</div>
					<a href="/seeking" class="demo-promo-cta">
						<i class="fa-solid fa-sd-card"></i>
						<span>Open Demo Watchlist</span>
					</a>
				</div>
			{/if}
		{/if}

		<CardList {cards} {hasSearched} />
	</div>

	<DiscordInviteModal open={showDiscordModal} on:close={() => (showDiscordModal = false)} />
{/if}

<style>
	.home-container {
		text-align: center;
		padding: 1.5rem 1rem 3rem 1rem;
		max-width: 900px;
		margin: 0 auto;
		animation: fadeIn 0.5s ease-out;
	}

	.discord-community-banner {
		margin-top: 1rem;
		padding: 1rem 1.25rem;
		border-radius: 10px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		text-align: left;
		flex-wrap: wrap;
	}

	.discord-community-copy {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.discord-community-copy strong {
		color: var(--color-text-primary);
		font-size: 0.95rem;
	}

	.discord-community-copy span {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.discord-community-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1rem;
		border-radius: 8px;
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			border-color var(--transition-fast);
	}

	.discord-community-cta:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-primary);
	}

	@media (max-width: 640px) {
		.discord-community-cta {
			width: 100%;
			justify-content: center;
			min-height: 44px;
		}
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

	.steps-strip {
		list-style: none;
		padding: 0;
		margin: 2rem 0 0 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		text-align: left;
		overflow: hidden;
	}

	.step-item {
		padding: 1.15rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.step-item + .step-item {
		border-left: 1px solid var(--color-border);
	}

	.step-num {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--color-primary);
	}

	.step-body h3 {
		margin: 0 0 0.35rem 0;
		font-size: 0.98rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.step-body p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	@media (max-width: 768px) {
		.steps-strip {
			grid-template-columns: 1fr;
		}

		.step-item + .step-item {
			border-left: none;
			border-top: 1px solid var(--color-border);
		}

		.home-container {
			padding: 1rem 1rem 2rem 1rem;
		}
	}

	.demo-promo-banner {
		margin-top: 1.25rem;
		padding: 1rem 1.25rem;
		border-radius: 10px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-left: 3px solid var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		text-align: left;
		flex-wrap: wrap;
	}

	.demo-promo-copy {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1 1 280px;
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}

	.demo-promo-copy strong {
		color: var(--color-text-primary);
		font-size: 0.96rem;
	}

	.demo-promo-badge {
		align-self: flex-start;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--color-primary);
	}

	.demo-promo-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.62rem 1.1rem;
		border-radius: 8px;
		background: var(--color-primary);
		color: var(--color-text-on-primary, #fff);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.88rem;
		white-space: nowrap;
		transition: background-color var(--transition-fast);
	}

	.demo-promo-cta:hover {
		background: var(--color-primary-dark);
	}
</style>
