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
				streamlines the process by searching across multiple online marketplaces.
			</p>
			<h2>Next Steps</h2>
			<ul>
				<li>
					<strong>Marketplace Integrations:</strong>
					<ul>
						<li>Add TCGPlayer support.</li>
						<li>
							Investigate <code>infinite-api.tcgplayer.com</code> as a potential alternative API.
						</li>
						<li>Add eBay support.</li>
					</ul>
				</li>
				<li>
					<strong>TCGPlayer Processing Logic:</strong>
					<ul>
						<li>
							Schedule a task to run every 6 hours that adds all cards from each user's list to a
							message queue as individual items.
						</li>
						<li>Develop a process to handle each card individually from the queue.</li>
						<li>
							This needs to run locally on my server to bypass timeout issues with Azure Functions.
						</li>
					</ul>
				</li>
				<li>
					<strong>Notifications:</strong> Implement notifications via Discord PMs rather than channel
					pings.
				</li>
				<li>
					<strong>Secure Functions:</strong> Protect seeker-functions with AAD authentication. This
					may require application changes since the callback function currently uses the
					<code>Authorization</code>
					header instead of a custom one like <code>X-Client-Authorization</code>.
				</li>
				<li>
					<strong>Authentication:</strong> All functions are set up to use APIM with working authentication.
					Next, investigate adding a server/role check to the APIM auth process.
				</li>
			</ul>

			<h2>Future Features</h2>
			<ul>
				<li>???</li>
			</ul>

			<h2>Bugs</h2>
			<ul>
				<li>
					<strong>Data Source Limitation:</strong> The application's card knowledge is limited to what
					is available in the Scryfall database. This is sometimes a limitation when Scryfall does not
					have a given language listed for a card.
				</li>
				<li>
					<strong>Authentication Status:</strong> There is no clear indicator to the user when their
					session has expired; features simply stop working.
				</li>
			</ul>

			<h2>Contact</h2>
			<p>
				For support, feature requests, or any questions, please reach out to <a
					href="https://discord.com/users/213058259076913152"
					target="_blank"
					rel="noopener noreferrer">@undomian</a
				> on the City of Traitors Discord.
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

	.about-content ul {
		list-style-position: inside;
		padding-left: 1em;
		color: var(--color-text-secondary);
	}

	.about-content li {
		margin-bottom: 0.5rem;
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
		color: var(--color-text-primary);
		margin-bottom: 1rem;
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
</style>
