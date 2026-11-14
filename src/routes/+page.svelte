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
						<p>Seeker continuously polls major domestic and international marketplaces around the clock.</p>
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

			{#if !$auth.isAuthenticated}
				<div class="demo-promo-banner">
					<div class="demo-promo-copy">
						<span class="demo-promo-badge">No Discord Login Required</span>
						<strong>Want to see Seeker in action first?</strong>
						<span>Explore a live 12-card interactive watchlist across 8 marketplaces, import sample decklists, and preview Discord DM alerts.</span>
					</div>
					<a href="/demo" class="demo-promo-cta">
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
		border-radius: 12px;
		background: var(--glass-bg);
		border: 1px solid var(--border-color, var(--color-border));
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

	.demo-promo-banner {
		margin-top: 1.5rem;
		padding: 1rem 1.25rem;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(88, 101, 242, 0.1) 100%);
		border: 1px solid rgba(16, 185, 129, 0.35);
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
		font-size: 0.98rem;
	}

	.demo-promo-badge {
		align-self: flex-start;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #10b981;
	}

	.demo-promo-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.15rem;
		border-radius: 8px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #fff;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.demo-promo-cta:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}
</style>
