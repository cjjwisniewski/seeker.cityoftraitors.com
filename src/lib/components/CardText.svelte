<script lang="ts">
	import { parseOracleText } from '$lib/utils/cardSymbols';

	export let text: string | null | undefined = '';
	export let className: string = '';

	$: paragraphs = parseOracleText(text);
</script>

{#if paragraphs.length > 0}
	<div class="card-text-container {className}">
		{#each paragraphs as paragraph}
			<p class="card-text-paragraph">
				{#each paragraph as token}
					{#if token.type === 'symbol'}
						<img
							class="card-symbol"
							src={token.svg}
							alt={token.alt || token.raw}
							title={token.raw}
							loading="lazy"
						/>
					{:else}
						<span>{token.value}</span>
					{/if}
				{/each}
			</p>
		{/each}
	</div>
{/if}

<style>
	.card-text-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		line-height: 1.55;
	}

	.card-text-paragraph {
		margin: 0;
	}

	.card-symbol {
		display: inline-block;
		width: 0.95em;
		height: 0.95em;
		vertical-align: -0.1em;
		margin: 0 0.12em;
		border-radius: 50%;
		filter: drop-shadow(-1px 1px 0 rgba(0, 0, 0, 0.7));
	}
</style>
