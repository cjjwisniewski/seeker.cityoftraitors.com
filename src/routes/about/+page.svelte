<script lang="ts">
	import { onMount } from 'svelte';

	let mounted = false;

	onMount(() => {
		mounted = true;
	});

	interface Tier {
		id: string;
		name: string;
		badgeClass: string;
		icon: string;
		premium?: boolean;
		features: Record<string, string>;
	}

	const tiers: Tier[] = [
		{
			id: 'basic',
			name: 'Basic',
			badgeClass: 'tier-basic',
			icon: 'fa-certificate',
			features: {
				'Saved Cards': '25',
				Marketplaces: 'CardTrader',
				'Scan Frequency': 'Once per day',
				'Max Price Caps': 'Included',
				'Price Drop Alerts': 'Included'
			}
		},
		{
			id: 'premium',
			name: 'Premium',
			badgeClass: 'tier-premium',
			icon: 'fa-crown',
			premium: true,
			features: {
				'Saved Cards': 'Unlimited',
				Marketplaces: 'CardTrader, TCGPlayer, eBay & Mana Pool',
				'Scan Frequency': 'Every 6 hours',
				'Max Price Caps': 'Included',
				'Price Drop Alerts': 'Included'
			}
		}
	];

	const featureList = Object.keys(tiers[0].features);
</script>

{#if mounted}
	<div class="about-container">
		<h1>About Seeker</h1>
		<div class="about-content">
			<p>
				Seeker is a tool designed to help Magic: The Gathering collectors efficiently find the
				specific cards they need to complete their collections. Whether you're searching for a rare
				foil, a specific language version, or just that one missing card from a set, Seeker
				streamlines the process by automatically searching across multiple online marketplaces and
				notifying you when the card you're Seeking is found.
			</p>
			<h2>Contact</h2>
			<p>
				For support, feature requests, or any questions, please reach out to <a
					href="https://discord.com/users/213058259076913152"
					target="_blank"
					rel="noopener noreferrer">@undomian</a
				> on the City of Traitors Discord.
			</p>
			<h2>Membership Tiers</h2>
			<p>Support the development of Seeker and unlock advanced features by upgrading to Premium!</p>

			<div class="tier-comparison desktop-only">
				<table>
					<thead>
						<tr>
							<th>Feature</th>
							{#each tiers as tier}
								<th class={tier.premium ? 'premium-col' : ''}>
									<span class="tier-badge {tier.badgeClass}">
										<i class="fa-solid {tier.icon}"></i>
										{tier.name}
									</span>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each featureList as feature}
							<tr>
								<td>{feature}</td>
								{#each tiers as tier}
									<td class={tier.premium ? 'premium-col' : ''}>{tier.features[feature]}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="tier-cards-container mobile-only">
				{#each tiers as tier}
					<div class="tier-card {tier.id} {tier.premium ? 'premium-col' : ''}">
						<div class="tier-card-header">
							<span class="tier-badge {tier.badgeClass}">
								<i class="fa-solid {tier.icon}"></i>
								{tier.name}
							</span>
						</div>
						<ul class="tier-card-features">
							{#each featureList as feature}
								<li>
									<span class="feature-label">{feature}</span>
									<span class="feature-value">{tier.features[feature]}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>

			<!--
			<h2>Support the Developer</h2>
			<p>
				Want to support the developer? Contributions help keep Seeker running and fund future
				improvements. You can send a tip via <a
					href="https://paypal.me/cameronwisniewski"
					target="_blank"
					rel="noopener noreferrer">PayPal</a
				>.
			</p>
			-->
		</div>
	</div>
{/if}

<style>
	.about-container {
		text-align: center;
		padding: 2em;
		max-width: 800px;
		margin: 0 auto;
		margin-top: 2em;
		animation: fadeIn 0.5s ease-out;
	}

	.about-content {
		text-align: left;
		margin-top: 2em;
		background: var(--color-bg-elevated);
		padding: 2rem;
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
	}

	.about-content h2 {
		margin-top: 1.5em;
		margin-bottom: 1rem;
		color: var(--color-text-primary);
		font-size: 1.5rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.5rem;
	}

	h1 {
		margin-bottom: 1rem;
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline-block; /* Ensures gradient applies correctly to text width */
	}

	p {
		color: var(--color-text-secondary);
		line-height: 1.6;
	}

	a {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}

	a:hover {
		text-decoration: underline;
	}

	.tier-comparison {
		margin: 1.5rem 0;
	}

	.tier-comparison table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--color-border);
	}

	.tier-comparison th,
	.tier-comparison td {
		padding: 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.tier-comparison th {
		background-color: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.8rem;
		letter-spacing: 0.05em;
	}

	.tier-comparison tr:last-child td {
		border-bottom: none;
	}

	.tier-comparison td {
		font-size: 0.95rem;
	}

	.tier-comparison td:first-child {
		font-weight: 600;
		color: var(--color-text-primary);
		background-color: var(--color-bg-secondary);
		width: 30%;
	}

	.tier-comparison th:not(:first-child),
	.tier-comparison td:not(:first-child) {
		text-align: center;
	}

	.tier-comparison .premium-col {
		background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%);
		color: white;
	}

	.tier-comparison th.premium-col {
		font-weight: 700;
		color: white;
		border-top-left-radius: 8px;
	}

	.tier-comparison tr:last-child td.premium-col {
		border-bottom-left-radius: 8px;
	}

	/* Mobile Tier Cards */
	.tier-cards-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin: 1.5rem 0;
	}

	.tier-card {
		background: var(--color-bg-secondary);
		border-radius: 12px;
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-sm);
	}

	.tier-card.premium-col {
		background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%);
		color: white;
		box-shadow: var(--shadow-md);
		border: none;
	}

	.tier-card-header {
		text-align: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.premium-col .tier-card-header {
		border-bottom-color: rgba(255, 255, 255, 0.2);
	}

	.tier-card-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.tier-card-features li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
		gap: 1rem;
	}

	.tier-card-features li:last-child {
		border-bottom: none;
	}

	.premium-col .tier-card-features li {
		border-bottom-color: rgba(255, 255, 255, 0.1);
	}

	.feature-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.premium-col .feature-label {
		color: rgba(255, 255, 255, 0.8);
	}

	.feature-value {
		font-size: 0.95rem;
		color: var(--color-text-primary);
		text-align: right;
	}

	.premium-col .feature-value {
		color: white;
		font-weight: 500;
	}

	/* Responsive Visibility */
	.desktop-only {
		display: block;
	}

	.mobile-only {
		display: none;
	}

	@media (max-width: 600px) {
		.desktop-only {
			display: none;
		}

		.mobile-only {
			display: block;
		}

		.about-container {
			padding: 1em;
		}

		.about-content {
			padding: 1.5rem;
		}
	}
</style>
