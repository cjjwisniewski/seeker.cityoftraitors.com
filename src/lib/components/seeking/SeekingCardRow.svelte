<script>
	import { createEventDispatcher } from 'svelte';
	import VendorStockCell from './VendorStockCell.svelte';
	import BestPriceCell from './BestPriceCell.svelte';
	import CardActionsMenu from './CardActionsMenu.svelte';
	import {
		getWebpImageUri,
		getSetIconCode,
		formatPrice,
		formatMinConditionLabel,
		getBestOfferDetails,
		isBestVendorPrice
	} from '$lib/utils/seekingUtils.js';

	const dispatch = createEventDispatcher();

	export let card;
	export let index = 0;
	export let isCondensed = false;
	export let isSelected = false;
	export let isMenuOpen = false;
	export let isDropUp = false;
	export let histBadge = null;
	export let showCardTrader = true;
	export let showTCGPlayer = true;
	export let showEbay = true;
	export let showManapool = true;
	export let showHimarket = true;
	export let showHareruya = true;
	export let showRuten = true;
	export let showCardmarket = true;
	export let setCodeToNameMap = {};
	export let canManualCheckStock = false;
	export let isAdmin = false;
	export let isCheckingCard = false;
	export let cooldownSec = 0;
	export let isAuthenticated = true;

	$: bestOffer = isCondensed
		? getBestOfferDetails(
				card,
				showCardTrader,
				showTCGPlayer,
				showEbay,
				showManapool,
				showHimarket,
				showHareruya,
				showRuten,
				showCardmarket,
				setCodeToNameMap
			)
		: null;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<tr
	class:condensed={isCondensed}
	class:selected={isSelected}
	on:click={(e) => dispatch('rowClick', e)}
	on:touchstart={(e) => dispatch('rowTouchStart', e)}
	on:touchmove={(e) => dispatch('rowTouchMove', e)}
	on:touchend={(e) => dispatch('rowTouchEnd', e)}
	on:touchcancel={(e) => dispatch('rowTouchEnd', e)}
	on:contextmenu={(e) => dispatch('rowContextMenu', e)}
	style={isMenuOpen ? 'z-index: 50; position: relative;' : ''}
>
	<td data-label="Card" class="col-card">
		<div class="card-info">
			{#if !isCondensed}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
				<img
					src={getWebpImageUri(card.image_uri)}
					alt={card.name}
					class="card-thumbnail"
					loading="lazy"
					decoding="async"
					on:click|stopPropagation={() => dispatch('enlargeImage', getWebpImageUri(card.image_uri))}
				/>
			{/if}
			<div class="card-name-group">
				<span>{card.name}</span>
				{#if (card.max_price_cap !== null && card.max_price_cap !== undefined) || card.min_condition || histBadge}
					<div class="card-badges-row">
						{#if histBadge}
							<button
								type="button"
								class="cap-badge hist-badge hist-{histBadge.type}"
								title={histBadge.title}
								on:click|stopPropagation={() => dispatch('openHistory')}
							>
								{histBadge.label}
							</button>
						{/if}
						{#if card.max_price_cap !== null && card.max_price_cap !== undefined}
							<button
								type="button"
								class="cap-badge"
								title="Click to edit Max Price Cap"
								on:click|stopPropagation={() => dispatch('openSettings')}
							>
								MAX {formatPrice(card.max_price_cap)}
							</button>
						{/if}
						{#if card.min_condition}
							<button
								type="button"
								class="cap-badge cond-override-badge"
								title="Minimum Condition Override: {formatMinConditionLabel(card.min_condition)} (Click to edit)"
								on:click|stopPropagation={() => dispatch('openSettings')}
							>
								{card.min_condition === 'NM'
									? 'NM ONLY'
									: card.min_condition === 'ANY'
										? 'ANY COND'
										: `MIN ${card.min_condition}+`}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</td>

	<td data-label="Set" class="set-column col-set">
		<button
			type="button"
			class="inline-variant-btn set-variant-btn"
			title="Set: {card.set_code?.toUpperCase()} (Click to edit)"
			on:click|stopPropagation={() => dispatch('openSettings')}
		>
			<img
				src="https://svgs.scryfall.io/sets/{getSetIconCode(card.set_code)}.svg"
				alt="{card.set_code} set icon"
				title={card.set_code?.toUpperCase()}
				class="set-icon"
				loading="lazy"
				decoding="async"
			/>
			<span class="set-code-text">{card.set_code?.toUpperCase()}</span>
		</button>
	</td>

	<td data-label="Language" class="language-column col-lang">
		<button
			type="button"
			class="inline-variant-btn"
			title="Click to edit language or finish"
			on:click|stopPropagation={() => dispatch('openSettings')}
		>
			{card.language?.toUpperCase()}
		</button>
	</td>

	<td data-label="Finish" class="finish-column col-finish">
		<button
			type="button"
			class="inline-variant-btn"
			class:foil-variant={(card.finish || '').toLowerCase() === 'foil'}
			title="Click to edit finish or language"
			on:click|stopPropagation={() => dispatch('openSettings')}
		>
			{(card.finish || '').toLowerCase() === 'foil' ? '✦ Foil' : 'Nonfoil'}
		</button>
	</td>

	{#if isCondensed}
		<BestPriceCell {card} {bestOffer} />
	{:else}
		{#if showCardTrader}
			<VendorStockCell
				{card}
				vendorKey="cardtrader"
				isBestPrice={isBestVendorPrice(card, 'cardtrader', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showTCGPlayer}
			<VendorStockCell
				{card}
				vendorKey="tcgplayer"
				isBestPrice={isBestVendorPrice(card, 'tcgplayer', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showManapool}
			<VendorStockCell
				{card}
				vendorKey="manapool"
				isBestPrice={isBestVendorPrice(card, 'manapool', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showCardmarket}
			<VendorStockCell
				{card}
				vendorKey="cardmarket"
				isBestPrice={isBestVendorPrice(card, 'cardmarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showEbay}
			<VendorStockCell
				{card}
				vendorKey="ebay"
				isBestPrice={isBestVendorPrice(card, 'ebay', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showHimarket}
			<VendorStockCell
				{card}
				vendorKey="himarket"
				isBestPrice={isBestVendorPrice(card, 'himarket', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showHareruya}
			<VendorStockCell
				{card}
				vendorKey="hareruya"
				isBestPrice={isBestVendorPrice(card, 'hareruya', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
		{#if showRuten}
			<VendorStockCell
				{card}
				vendorKey="ruten"
				isBestPrice={isBestVendorPrice(card, 'ruten', showCardTrader, showTCGPlayer, showEbay, showManapool, showHimarket, showHareruya, showRuten, showCardmarket)}
				{setCodeToNameMap}
			/>
		{/if}
	{/if}

	<CardActionsMenu
		{card}
		isOpen={isMenuOpen}
		{isDropUp}
		{isSelected}
		{canManualCheckStock}
		{isAdmin}
		{isCheckingCard}
		{cooldownSec}
		{isAuthenticated}
		on:toggleMenu
		on:closeMenu
		on:toggleSelect
		on:manualStockCheck
		on:copyLine
		on:openHistory
		on:openSettings
		on:deleteCard
	/>
</tr>

<style>
	tr {
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	tr:hover :global(td) {
		background-color: var(--color-bg-hover);
	}

	tr.selected :global(td) {
		background-color: var(--color-primary-alpha, rgba(99, 102, 241, 0.15)) !important;
	}

	tr.selected {
		box-shadow: inset 3px 0 0 var(--color-primary, #6366f1);
	}

	td {
		padding: 0.6rem 0.4rem;
		text-align: center;
		border-bottom: 1px solid var(--color-border);
		transition: background-color var(--transition-fast);
	}

	.col-card {
		width: 24%;
		min-width: 195px;
		text-align: left;
	}

	.col-set {
		width: 48px;
		min-width: 44px;
		max-width: 52px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	.col-lang {
		width: 56px;
		min-width: 52px;
		max-width: 60px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	.col-finish {
		width: 78px;
		min-width: 72px;
		max-width: 84px;
		text-align: center;
		padding: 0.6rem 0.2rem;
	}

	@media (min-width: 769px) {
		td.col-card {
			position: sticky;
			left: 0;
			z-index: 5;
			background: var(--color-bg-primary);
		}

		tr:hover td.col-card {
			background: var(--color-bg-hover);
		}

		tr.selected td.col-card {
			background: var(--color-primary-alpha, rgba(99, 102, 241, 0.15)) !important;
		}

		td.col-card::after {
			content: '';
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			width: 1px;
			background: var(--color-border);
			pointer-events: none;
		}
	}

	.card-info {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
	}

	.card-thumbnail {
		width: 36px;
		height: auto;
		border-radius: 4px;
		cursor: zoom-in;
		transition: transform var(--transition-fast);
		flex-shrink: 0;
	}

	.card-thumbnail:hover {
		transform: scale(1.1);
	}

	.card-name-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		min-width: 0;
	}

	.card-name-group span {
		font-weight: 600;
		color: var(--color-text-primary);
		line-height: 1.2;
		word-break: break-word;
	}

	.card-badges-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.cap-badge {
		font-size: 0.62rem;
		font-weight: 700;
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.12);
		border: 1px solid rgba(59, 130, 246, 0.35);
		border-radius: 999px;
		padding: 0.08rem 0.4rem;
		line-height: 1.2;
		cursor: pointer;
		transition: all var(--transition-fast);
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.cap-badge.cond-override-badge {
		color: #a855f7;
		background: rgba(168, 85, 247, 0.12);
		border-color: rgba(168, 85, 247, 0.35);
	}

	.cap-badge:hover {
		background: rgba(59, 130, 246, 0.22);
		border-color: rgba(59, 130, 246, 0.6);
		transform: translateY(-1px);
	}

	.cap-badge.cond-override-badge:hover {
		background: rgba(168, 85, 247, 0.22);
		border-color: rgba(168, 85, 247, 0.6);
	}

	.hist-badge {
		border-radius: 999px;
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.08rem 0.45rem;
		line-height: 1.2;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		transition: all var(--transition-fast);
	}

	.hist-badge.hist-breakthrough {
		background: rgba(239, 68, 68, 0.14);
		border-color: rgba(239, 68, 68, 0.45);
		color: #f87171;
	}

	.hist-badge.hist-at-floor {
		background: rgba(16, 185, 129, 0.14);
		border-color: rgba(16, 185, 129, 0.45);
		color: #6ee7b7;
	}

	.hist-badge.hist-last-seen {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.32);
		color: #cbd5e1;
	}

	.set-column {
		text-align: center;
	}

	.set-icon {
		height: 1.5em;
		width: 1.5em;
		vertical-align: middle;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
	}

	:global([data-theme='dark']) .set-icon {
		filter: invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
	}

	.set-variant-btn {
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.set-code-text {
		display: none;
	}

	.language-column {
		text-transform: uppercase;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.inline-variant-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.inline-variant-btn:hover {
		border-color: var(--color-primary);
		background: var(--color-bg-hover);
		transform: translateY(-1px);
	}

	.inline-variant-btn.foil-variant {
		border-color: rgba(245, 158, 11, 0.45);
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
	}

	@media (max-width: 768px) {
		tr {
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			background: var(--glass-bg);
			backdrop-filter: blur(var(--backdrop-blur));
			-webkit-backdrop-filter: blur(var(--backdrop-blur));
			border: 1px solid var(--glass-border);
			border-radius: 14px;
			padding: 0.75rem;
			box-shadow: var(--shadow-sm);
			margin-bottom: 0;
			position: relative;
			gap: 0.45rem;
			width: 100%;
			box-sizing: border-box;
		}

		tr:hover :global(td) {
			background-color: transparent;
		}

		td,
		td.col-set,
		td.col-lang,
		td.col-finish,
		td.col-card {
			border: none;
			padding: 0.35rem;
			text-align: center;
			min-width: 0 !important;
			max-width: none !important;
			width: 100% !important;
			box-sizing: border-box;
		}

		td[data-label='Card'] {
			grid-column: 1 / -1;
			border-bottom: 1px solid var(--color-border);
			margin-bottom: 0.1rem;
			padding: 0 2rem 0.55rem 0;
			text-align: left;
		}

		td[data-label='Card'] .card-info {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			gap: 0.75rem;
			width: 100%;
			min-width: 0;
		}

		tr.condensed td[data-label='Card'] .card-info {
			justify-content: flex-start;
		}

		td[data-label='Card'] .card-name-group {
			align-items: flex-start;
			min-width: 0;
			flex: 1;
			gap: 0.3rem;
		}

		tr.condensed td[data-label='Card'] .card-name-group {
			align-items: flex-start;
		}

		td[data-label='Card'] .card-info img {
			margin-right: 0;
			width: 48px;
			height: auto;
			border-radius: 6px;
			flex-shrink: 0;
		}

		td[data-label='Card'] .card-info span {
			font-weight: 700;
			font-size: 0.98rem;
			line-height: 1.25;
			padding: 0;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.set-code-text {
			display: inline-block;
			font-weight: 700;
			font-size: 0.72rem;
		}

		td[data-label='Set'],
		td[data-label='Language'],
		td[data-label='Finish'] {
			grid-column: span 2;
			width: 100% !important;
			max-width: none !important;
			min-width: 0 !important;
			background: var(--color-bg-secondary);
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 0.42rem 0.45rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: space-between;
			gap: 0.25rem;
			box-sizing: border-box;
		}

		td[data-label='Set']::before,
		td[data-label='Language']::before,
		td[data-label='Finish']::before {
			content: attr(data-label);
			font-weight: 700;
			color: var(--color-text-secondary);
			display: block;
			font-size: 0.68rem;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			text-align: left;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			line-height: 1.2;
		}

		td[data-label='Set'] .inline-variant-btn,
		td[data-label='Language'] .inline-variant-btn,
		td[data-label='Finish'] .inline-variant-btn {
			width: 100%;
			height: 28px;
			padding: 0 0.35rem;
			font-size: 0.72rem;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.35rem;
			box-sizing: border-box;
			border-radius: 6px;
			background: var(--color-bg-elevated);
			border: 1px solid var(--color-border);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		td[data-label='Set'] .set-icon {
			height: 1.15em;
			width: 1.15em;
			margin: 0;
			flex-shrink: 0;
		}
	}
</style>
