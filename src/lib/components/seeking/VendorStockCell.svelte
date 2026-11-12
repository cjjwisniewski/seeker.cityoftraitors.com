<script>
	import {
		getStockIcon,
		getStockColor,
		getStockStatus,
		formatPrice,
		formatDollarPrice,
		getTCGPlayerUrl,
		getCardmarketUrl,
		getCardmarketConditionClass,
		getEbayUrl
	} from '$lib/utils/seekingUtils.js';
	import {
		formatHkdPrice,
		formatJpyPrice,
		formatTwdPrice,
		formatEurPrice
	} from '$lib/stores/exchangeRate';

	export let card;
	export let vendorKey; // 'cardtrader' | 'tcgplayer' | 'manapool' | 'cardmarket' | 'ebay' | 'himarket' | 'hareruya' | 'ruten'
	export let isBestPrice = false;
	export let setCodeToNameMap = {};

	$: lang = (card?.language || '').toLowerCase();
	$: isRutenUnsupportedLang = vendorKey === 'ruten' && !['zht', 'en'].includes(lang);

	$: vendorConfig = getVendorConfig(card, vendorKey, setCodeToNameMap);
	$: status = getStockStatus(vendorConfig.stock);
	$: iconClass = getStockIcon(status);
	$: colorClass = getStockColor(status);

	function getVendorConfig(c, key, map) {
		if (!c) {
			return {
				dataLabel: key,
				url: null,
				stock: null,
				formattedPrice: null,
				condition: null,
				conditionClass: '',
				currencyTag: null,
				currencyTitle: null,
				fallbackTooltip: ''
			};
		}

		switch (key) {
			case 'cardtrader':
				return {
					dataLabel: 'CardTrader',
					url: c.cardtrader_id ? `https://www.cardtrader.com/cards/${c.cardtrader_id}` : null,
					stock: c.cardtrader_stock,
					formattedPrice:
						c.cardtrader_low_price !== null && c.cardtrader_low_price !== undefined
							? formatPrice(c.cardtrader_low_price)
							: null,
					condition: c.cardtrader_condition,
					conditionClass: c.cardtrader_condition ? c.cardtrader_condition.toLowerCase() : '',
					currencyTag: null,
					currencyTitle: null,
					fallbackTooltip: 'Card not found on CardTrader'
				};

			case 'tcgplayer':
				return {
					dataLabel: 'TCGPlayer',
					url: c.tcgplayer_id ? getTCGPlayerUrl(c) : null,
					stock: c.tcgplayer_stock,
					formattedPrice:
						c.tcgplayer_low_price > 0 && getStockStatus(c.tcgplayer_stock) === 'available'
							? formatDollarPrice(c.tcgplayer_low_price)
							: null,
					condition: c.tcgplayer_condition,
					conditionClass: c.tcgplayer_condition ? c.tcgplayer_condition.toLowerCase() : '',
					currencyTag: null,
					currencyTitle: null,
					fallbackTooltip: 'Card not found on TCGPlayer'
				};

			case 'manapool':
				return {
					dataLabel: 'Mana Pool',
					url: c.manapool_url || null,
					stock: c.manapool_stock,
					formattedPrice:
						c.manapool_low_price !== null &&
						c.manapool_low_price !== undefined &&
						getStockStatus(c.manapool_stock) === 'available'
							? formatPrice(c.manapool_low_price)
							: null,
					condition: c.manapool_condition,
					conditionClass: c.manapool_condition ? c.manapool_condition.toLowerCase() : '',
					currencyTag: null,
					currencyTitle: null,
					fallbackTooltip: 'Card not found on Mana Pool'
				};

			case 'cardmarket':
				return {
					dataLabel: 'CardMarket',
					url: c.cardmarket_id ? getCardmarketUrl(c) : null,
					stock: c.cardmarket_stock,
					formattedPrice:
						c.cardmarket_low_price !== null &&
						c.cardmarket_low_price !== undefined &&
						getStockStatus(c.cardmarket_stock) === 'available'
							? formatPrice(c.cardmarket_low_price)
							: null,
					condition: c.cardmarket_condition,
					conditionClass: getCardmarketConditionClass(c.cardmarket_condition),
					currencyTag: c.cardmarket_price_eur ? 'EUR' : null,
					currencyTitle: c.cardmarket_price_eur ? formatEurPrice(c.cardmarket_price_eur) : null,
					fallbackTooltip: 'Card not found on CardMarket'
				};

			case 'ebay':
				return {
					dataLabel: 'EBay',
					url: getEbayUrl(c, map),
					stock: c.ebay_stock,
					formattedPrice:
						c.ebay_low_price !== null &&
						c.ebay_low_price !== undefined &&
						getStockStatus(c.ebay_stock) === 'available'
							? formatPrice(c.ebay_low_price)
							: null,
					condition: c.ebay_condition,
					conditionClass: c.ebay_condition ? c.ebay_condition.toLowerCase() : '',
					currencyTag: null,
					currencyTitle: null,
					fallbackTooltip: 'Card not found on eBay'
				};

			case 'himarket':
				return {
					dataLabel: 'HiMarket',
					url: c.himarket_url || null,
					stock: c.himarket_stock,
					formattedPrice:
						c.himarket_low_price !== null &&
						c.himarket_low_price !== undefined &&
						getStockStatus(c.himarket_stock) === 'available'
							? formatPrice(c.himarket_low_price)
							: null,
					condition: c.himarket_condition,
					conditionClass: c.himarket_condition ? c.himarket_condition.toLowerCase() : '',
					currencyTag: c.himarket_price_hkd ? 'HKD' : null,
					currencyTitle: c.himarket_price_hkd ? formatHkdPrice(c.himarket_price_hkd) : null,
					fallbackTooltip:
						getStockStatus(c.himarket_stock) === 'unavailable'
							? 'Out of stock on HiMarket'
							: 'Not searched on HiMarket'
				};

			case 'hareruya':
				return {
					dataLabel: 'Hareruya',
					url: c.hareruya_url || null,
					stock: c.hareruya_stock,
					formattedPrice:
						c.hareruya_low_price !== null &&
						c.hareruya_low_price !== undefined &&
						getStockStatus(c.hareruya_stock) === 'available'
							? formatPrice(c.hareruya_low_price)
							: null,
					condition: c.hareruya_condition,
					conditionClass: c.hareruya_condition ? c.hareruya_condition.toLowerCase() : '',
					currencyTag: c.hareruya_price_jpy ? 'JPY' : null,
					currencyTitle: c.hareruya_price_jpy ? formatJpyPrice(c.hareruya_price_jpy) : null,
					fallbackTooltip:
						getStockStatus(c.hareruya_stock) === 'unavailable'
							? 'Out of stock on Hareruya'
							: 'Not searched on Hareruya'
				};

			case 'ruten':
				return {
					dataLabel: 'Ruten',
					url: c.ruten_url || null,
					stock: c.ruten_stock,
					formattedPrice:
						c.ruten_low_price !== null &&
						c.ruten_low_price !== undefined &&
						getStockStatus(c.ruten_stock) === 'available'
							? formatPrice(c.ruten_low_price)
							: null,
					condition: c.ruten_condition,
					conditionClass: c.ruten_condition ? c.ruten_condition.toLowerCase() : '',
					currencyTag: c.ruten_price_twd ? 'TWD' : null,
					currencyTitle: c.ruten_price_twd ? formatTwdPrice(c.ruten_price_twd) : null,
					fallbackTooltip:
						getStockStatus(c.ruten_stock) === 'unavailable'
							? 'Out of stock on Ruten'
							: 'Not searched on Ruten'
				};

			default:
				return {
					dataLabel: key,
					url: null,
					stock: null,
					formattedPrice: null,
					condition: null,
					conditionClass: '',
					currencyTag: null,
					currencyTitle: null,
					fallbackTooltip: `Not found on ${key}`
				};
		}
	}
</script>

<td data-label={vendorConfig.dataLabel} class="vendor-stock-cell col-vendor" class:is-best-price={isBestPrice}>
	{#if isRutenUnsupportedLang}
		<div class="stock-indicator">
			<span
				class="unsupported-lang-dash"
				title="Ruten only checks Traditional Chinese (ZHT) and English (EN) cards"
			>—</span>
		</div>
	{:else if vendorConfig.url}
		<a
			href={vendorConfig.url}
			target="_blank"
			rel="noopener noreferrer"
			class="vendor-link"
		>
			<div class="stock-indicator" class:best-price={isBestPrice}>
				<i class="{iconClass} {colorClass}"></i>
				{#if vendorConfig.formattedPrice}
					<span class="price-text" title={vendorConfig.currencyTitle || undefined}>
						{vendorConfig.formattedPrice}
						{#if vendorConfig.condition && status === 'available'}
							<span
								class="condition-bubble cond-{vendorConfig.conditionClass}"
								title="Condition: {vendorConfig.condition}{vendorConfig.currencyTitle ? ` (${vendorConfig.currencyTitle})` : ''}"
							>
								{vendorConfig.condition}
							</span>
						{/if}
						{#if vendorConfig.currencyTag}
							<span class="currency-tag">{vendorConfig.currencyTag}</span>
						{/if}
					</span>
				{/if}
			</div>
		</a>
	{:else}
		<div class="stock-indicator">
			{#if ['himarket', 'hareruya', 'ruten'].includes(vendorKey)}
				<i
					class="{iconClass} {colorClass}"
					title={vendorConfig.fallbackTooltip}
				></i>
			{:else}
				<i
					class="fa-solid fa-circle-question text-muted"
					title={vendorConfig.fallbackTooltip}
				></i>
			{/if}
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

	.col-vendor {
		min-width: 96px;
		max-width: 135px;
		text-align: center;
		padding: 0.55rem 0.35rem;
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

	.vendor-link {
		color: inherit;
		text-decoration: none;
		display: inline-block;
	}

	.vendor-link:hover .stock-indicator i {
		transform: scale(1.15);
	}

	.stock-indicator.best-price {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.45);
		border-radius: 999px;
		padding: 0.18rem 0.55rem;
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.12);
	}

	.stock-indicator.best-price .price-text {
		color: #10b981;
		font-weight: 700;
	}

	.price-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		font-size: 0.76rem;
		color: var(--color-text-muted);
		line-height: 1.15;
		font-weight: 500;
		white-space: nowrap;
	}

	.currency-tag {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--color-text-muted);
		padding: 0.04rem 0.22rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		letter-spacing: 0.02em;
		display: inline-block;
		vertical-align: middle;
		line-height: 1.1;
	}

	.unsupported-lang-dash {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-muted);
		opacity: 0.45;
		cursor: help;
		user-select: none;
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

	.text-muted {
		color: var(--color-text-muted);
	}

	:global(.text-danger) {
		color: var(--color-error, #ef4444);
	}

	:global(.text-success) {
		color: var(--color-success, #10b981);
	}

	@media (max-width: 768px) {
		td.vendor-stock-cell {
			grid-column: span 3;
			width: 100% !important;
			max-width: none !important;
			min-width: 0 !important;
			background: var(--color-bg-secondary);
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 0.42rem 0.55rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			gap: 0.25rem;
			box-sizing: border-box;
			transition: all var(--transition-fast);
			text-align: center;
		}

		td.vendor-stock-cell::before {
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

		td.vendor-stock-cell.is-best-price {
			border-color: rgba(16, 185, 129, 0.7) !important;
			background: rgba(16, 185, 129, 0.14) !important;
			box-shadow: 0 0 12px rgba(16, 185, 129, 0.18);
		}

		td.vendor-stock-cell.is-best-price::before {
			color: #10b981 !important;
		}

		td.vendor-stock-cell.is-best-price .price-text {
			color: #10b981;
			font-weight: 700;
		}

		td.vendor-stock-cell .stock-indicator.best-price {
			background: transparent !important;
			border: none !important;
			box-shadow: none !important;
			padding: 0 !important;
			border-radius: 0 !important;
			width: 100% !important;
		}

		td.vendor-stock-cell .vendor-link {
			display: flex;
			align-items: center;
			min-width: 0;
			width: 100%;
			justify-content: flex-start;
		}

		td.vendor-stock-cell .stock-indicator {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			min-width: 0;
			width: 100%;
			flex-wrap: wrap;
			justify-content: flex-start;
		}

		td.vendor-stock-cell .stock-indicator i {
			display: inline-block;
			font-size: 0.95rem;
			margin-bottom: 0;
			flex-shrink: 0;
		}

		td.vendor-stock-cell .price-text {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: 0.8rem;
			font-weight: 700;
			white-space: nowrap;
			min-width: 0;
			flex-wrap: wrap;
		}

		td.vendor-stock-cell .currency-tag {
			font-size: 0.62rem;
			padding: 0.04rem 0.22rem;
			margin-left: 0.1rem;
		}

		td.vendor-stock-cell .condition-bubble {
			font-size: 0.62rem;
			padding: 0.06rem 0.3rem;
			margin-left: 0.1rem;
		}
	}
</style>
