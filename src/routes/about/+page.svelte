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
				'On-Demand Checks': '—',
				'Max Price Caps': 'Included',
				'Price Drop Alerts': 'Included'
			}
		},
		{
			id: 'premium',
			name: 'Premium',
			badgeClass: 'tier-premium',
			icon: 'fa-gem',
			premium: true,
			features: {
				'Saved Cards': '150',
				Marketplaces: 'All supported domestic & international marketplaces',
				'Scan Frequency': 'Every 3 hours (24h for eBay)',
				'On-Demand Checks': 'Included',
				'Max Price Caps': 'Included',
				'Price Drop Alerts': 'Included'
			}
		}
	];

	const featureList = Object.keys(tiers[0].features);

	const supportedMarketplaces = [
		{ name: 'CardTrader', region: 'Global', icon: 'fa-solid fa-cube', color: '#3b82f6' },
		{ name: 'TCGPlayer', region: 'US', icon: 'fa-solid fa-store', color: '#10b981' },
		{ name: 'Mana Pool', region: 'US', icon: 'fa-solid fa-droplet', color: '#8b5cf6' },
		{ name: 'Card Kingdom', region: 'US', icon: 'fa-solid fa-crown', color: '#3b82f6' },
		{ name: 'eBay', region: 'US', icon: 'fa-brands fa-ebay', color: '#f59e0b' },
		{ name: 'HiMarket', region: 'HK', icon: 'fa-solid fa-earth-asia', color: '#ec4899' },
		{ name: 'Hareruya', region: 'JP', icon: 'fa-solid fa-sun', color: '#f97316' },
		{ name: 'Ruten', region: 'TW', icon: 'fa-solid fa-shop', color: '#14b8a6' }
	];

	const slashCommands = [
		{ cmd: '/seeker add', desc: 'Add a card printing, finish, and language to your list' },
		{ cmd: '/seeker price', desc: 'Check live lowest prices across enabled marketplaces' },
		{ cmd: '/seeker history', desc: 'View historical price snapshots for a card' },
		{ cmd: '/seeker digest', desc: 'Send your current in-stock digest to Discord' },
		{ cmd: '/seeker delete', desc: 'Remove a card from your seeking list' },
		{ cmd: '/seeker settings', desc: 'Inspect or toggle alerts and preferences' }
	];
</script>

{#if mounted}
	<div class="about-container">
		<div class="about-content">
			<p>
				Seeker is designed to help Magic: The Gathering collectors efficiently find the
				specific cards they need to complete their collections. Whether you're searching for a rare
				foil, a specific language version, or that one missing card from a vintage set, Seeker
				streamlines the process by continuously searching across multiple marketplaces and
				notifying you directly via Discord when your card is listed.
			</p>

			<div class="contact-card">
				<div class="contact-icon">
					<i class="fa-brands fa-discord"></i>
				</div>
				<div class="contact-details">
					<strong>Have questions or feedback?</strong>
					<span>Reach out to <a href="https://discord.com/users/213058259076913152" target="_blank" rel="noopener noreferrer">@undomian</a> on the City of Traitors Discord.</span>
				</div>
			</div>

			<h2>Membership Tiers</h2>
			<p>Support the development of Seeker and unlock advanced features with Premium membership.</p>

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

			<h2>Supported Marketplaces</h2>
			<p>Seeker monitors domestic and international storefronts with exact set, finish, and language matching:</p>
			<div class="marketplace-pills-grid">
				{#each supportedMarketplaces as mk}
					<div class="marketplace-pill">
						<span class="mk-pill-icon" style="color: {mk.color}; background: {mk.color}1a;">
							<i class={mk.icon}></i>
						</span>
						<span class="mk-pill-name">{mk.name}</span>
						<span class="mk-pill-region">{mk.region}</span>
					</div>
				{/each}
			</div>

			<h2>Discord Bot Commands</h2>
			<p>Manage your seeking list and check prices directly from Discord using <code>/seeker</code> slash commands:</p>
			<div class="commands-grid">
				{#each slashCommands as item}
					<div class="command-card">
						<code class="command-name">{item.cmd}</code>
						<span class="command-desc">{item.desc}</span>
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
		padding: 2rem 1rem 3rem 1rem;
		max-width: 860px;
		margin: 0 auto;
		animation: fadeIn 0.5s ease-out;
	}

	.about-content {
		text-align: left;
		background: var(--glass-bg, var(--color-bg-elevated));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		-webkit-backdrop-filter: blur(var(--backdrop-blur, 10px));
		padding: 2rem;
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--glass-border, var(--color-border));
	}

	.contact-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		margin: 1.5rem 0;
	}

	.contact-icon {
		font-size: 1.75rem;
		color: #5865f2;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.contact-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
	}

	.contact-details strong {
		color: var(--color-text-primary);
	}

	.contact-details span {
		color: var(--color-text-secondary);
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

	/* Supported Marketplaces & Discord Commands */
	.marketplace-pills-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
		gap: 0.65rem;
		margin: 1rem 0 2rem;
	}

	.marketplace-pill {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
	}

	.mk-pill-icon {
		width: 28px;
		height: 28px;
		border-radius: 7px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.mk-pill-name {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--color-text-primary);
		flex: 1;
		min-width: 0;
	}

	.mk-pill-region {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--color-text-muted);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 0.1rem 0.4rem;
	}

	.commands-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.command-card {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.8rem 0.95rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 10px;
	}

	.command-name {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.command-desc {
		font-size: 0.82rem;
		color: var(--color-text-secondary);
		line-height: 1.4;
	}
</style>
