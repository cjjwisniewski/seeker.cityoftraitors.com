<script>
	import { onMount } from 'svelte';

	let mounted = false;

	onMount(() => {
		mounted = true;
	});
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
			<p>
				Support the development of Seeker and unlock advanced features by choosing a membership
				tier.
			</p>
			<div class="tier-comparison">
				<table>
					<thead>
						<tr>
							<th>Feature</th>
							<th>Basic</th>
							<th>Premium / Legacy</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Saved Cards</td>
							<td>25</td>
							<td>Unlimited</td>
						</tr>
						<tr>
							<td>Marketplaces</td>
							<td>CardTrader</td>
							<td>CardTrader, TCGPlayer+</td>
						</tr>
						<tr>
							<td>Scan Frequency</td>
							<td>Once per day</td>
							<td>Every 6 hours</td>
						</tr>
					</tbody>
				</table>
			</div>
			<h2>Support the Developer</h2>
			<p>
				Want to support the developer? Contributions help keep Seeker running and fund future
				improvements. You can send a tip via <a
					href="https://paypal.me/cameronwisniewski"
					target="_blank"
					rel="noopener noreferrer">PayPal</a
				>.
			</p>
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
		overflow-x: auto;
	}

	.tier-comparison table {
		width: 100%;
		border-collapse: collapse;
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

	@media (max-width: 600px) {
		.tier-comparison th,
		.tier-comparison td {
			padding: 0.75rem;
			font-size: 0.85rem;
		}
	}
</style>
