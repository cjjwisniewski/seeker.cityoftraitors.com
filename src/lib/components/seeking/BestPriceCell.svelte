<script>
	export let card;
	export let bestOffer = null;
</script>

<td data-label="Best Price" class="vendor-stock-cell col-vendor col-best-price">
	{#if bestOffer && bestOffer.inStock}
		{#if bestOffer.url}
			<a
				href={bestOffer.url}
				target="_blank"
				rel="noopener noreferrer"
				class="vendor-link"
				title="Buy on {bestOffer.vendorDisplayName}"
			>
				<div class="best-offer-row">
					<span class="best-price-badge">{bestOffer.priceFormatted}</span>
					<span class="best-vendor-pill">{bestOffer.vendorDisplayName}</span>
					{#if bestOffer.condition}
						<span
							class="condition-bubble cond-{bestOffer.conditionClass}"
							title="Condition: {bestOffer.condition}"
						>
							{bestOffer.condition}
						</span>
					{/if}
					{#if bestOffer.otherOffersCount > 0}
						<span
							class="other-stores-chip"
							title="{bestOffer.otherOffersCount} other store{bestOffer.otherOffersCount > 1 ? 's' : ''} in stock"
						>
							+{bestOffer.otherOffersCount}
						</span>
					{/if}
				</div>
			</a>
		{:else}
			<div class="best-offer-row">
				<span class="best-price-badge">{bestOffer.priceFormatted}</span>
				<span class="best-vendor-pill">{bestOffer.vendorDisplayName}</span>
				{#if bestOffer.condition}
					<span
						class="condition-bubble cond-{bestOffer.conditionClass}"
						title="Condition: {bestOffer.condition}"
					>
						{bestOffer.condition}
					</span>
				{/if}
				{#if bestOffer.otherOffersCount > 0}
					<span
						class="other-stores-chip"
						title="{bestOffer.otherOffersCount} other store{bestOffer.otherOffersCount > 1 ? 's' : ''} in stock"
					>
						+{bestOffer.otherOffersCount}
					</span>
				{/if}
			</div>
		{/if}
	{:else if card?.historical_pricing?.last_seen_cents}
		<div
			class="oos-compact"
			title="Out of stock. Last seen on {card.historical_pricing.last_seen_vendor || 'vendor'} at ${(card.historical_pricing.last_seen_cents / 100).toFixed(2)}"
		>
			<i class="fa-solid fa-circle-xmark text-danger"></i>
			<span class="last-seen-text">Last: ${(card.historical_pricing.last_seen_cents / 100).toFixed(2)}</span>
		</div>
	{:else}
		<div class="stock-indicator">
			<i
				class="fa-solid fa-circle-xmark text-danger"
				title="Out of stock across all enabled stores"
			></i>
		</div>
	{/if}
</td>

<style>
	.vendor-stock-cell {
		text-align: center;
		vertical-align: middle;
		padding: 0.55rem 0.35rem;
		border-bottom: 1px solid var(--color-border);
		transition: background-color var(--transition-fast);
	}

	.col-best-price {
		min-width: 170px;
		max-width: 250px;
	}

	.vendor-link {
		color: inherit;
		text-decoration: none;
		display: inline-block;
	}

	.best-offer-row {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.22rem 0.6rem;
		background: rgba(16, 185, 129, 0.08);
		border: 1px solid rgba(16, 185, 129, 0.35);
		border-radius: 999px;
		transition: all var(--transition-fast);
		cursor: pointer;
	}

	.vendor-link:hover .best-offer-row {
		background: rgba(16, 185, 129, 0.18);
		border-color: rgba(16, 185, 129, 0.65);
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
		transform: translateY(-1px);
	}

	.best-price-badge {
		font-weight: 700;
		font-size: 0.85rem;
		color: #10b981;
		line-height: 1.1;
	}

	.best-vendor-pill {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-text-primary);
		line-height: 1.1;
	}

	.other-stores-chip {
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.05rem 0.32rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
		line-height: 1.1;
	}

	.oos-compact {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.oos-compact .last-seen-text {
		font-size: 0.68rem;
		opacity: 0.8;
	}

	.stock-indicator {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.18rem;
		min-width: 0;
	}

	.stock-indicator i {
		font-size: 1.05rem;
		transition: transform var(--transition-fast);
		line-height: 1;
	}

	.condition-bubble {
		font-size: 0.6rem;
		font-weight: 700;
		padding: 0.05rem 0.3rem;
		border-radius: 999px;
		letter-spacing: 0.03em;
		display: inline-block;
		vertical-align: middle;
		line-height: 1.1;
		background: rgba(148, 163, 184, 0.16);
		color: #cbd5e1;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.condition-bubble.cond-nm {
		background: rgba(16, 185, 129, 0.16);
		color: #34d399;
		border-color: rgba(16, 185, 129, 0.35);
	}

	.condition-bubble.cond-sp {
		background: rgba(56, 189, 248, 0.16);
		color: #38bdf8;
		border-color: rgba(56, 189, 248, 0.35);
	}

	.condition-bubble.cond-mp {
		background: rgba(245, 158, 11, 0.16);
		color: #fbbf24;
		border-color: rgba(245, 158, 11, 0.35);
	}

	.condition-bubble.cond-hp,
	.condition-bubble.cond-po {
		background: rgba(249, 115, 22, 0.16);
		color: #fb923c;
		border-color: rgba(249, 115, 22, 0.35);
	}

	:global(.text-danger) {
		color: var(--color-error, #ef4444);
	}

	@media (max-width: 768px) {
		td[data-label='Best Price'] {
			grid-column: 1 / -1;
			width: 100% !important;
			max-width: none !important;
			min-width: 0 !important;
			background: var(--color-bg-secondary);
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 0.45rem 0.65rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0.25rem;
			box-sizing: border-box;
			transition: all var(--transition-fast);
		}

		td[data-label='Best Price']::before {
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

		td[data-label='Best Price'] .best-offer-row {
			justify-content: flex-start;
			background: transparent;
			border: none;
			padding: 0;
		}

		td[data-label='Best Price'] .oos-compact {
			justify-content: flex-start;
		}
	}
</style>
