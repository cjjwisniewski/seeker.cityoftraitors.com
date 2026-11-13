<script>
	import { createEventDispatcher } from 'svelte';
	import {
		getWebpImageUri,
		getSetIconCode,
		formatPrice,
		formatMinConditionLabel,
		getLowestOffer,
		getBestOfferDetails,
		formatExactTimestamp,
		formatCooldownRemaining,
		getStockIcon,
		getStockColor,
		getStockStatus,
		getTCGPlayerUrl,
		getEbayUrl,
		getCardmarketUrl,
		getCardmarketConditionClass,
		sanitizeExternalUrl
	} from '$lib/utils/seekingUtils.js';
	import {
		formatHkdPrice,
		formatJpyPrice,
		formatTwdPrice,
		formatEurPrice
	} from '$lib/stores/exchangeRate';

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
	export let showCardkingdom = true;
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

	// Single-pass lowest offer calculation per row (collapsing 8 separate calls to 1)
	$: lowestOffer = !isCondensed
		? getLowestOffer(
				card,
				showCardTrader,
				showTCGPlayer,
				showEbay,
				showManapool,
				showHimarket,
				showHareruya,
				showRuten,
				showCardmarket,
				showCardkingdom
			)
		: null;

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
				setCodeToNameMap,
				showCardkingdom
			)
		: null;

	function isBestVendor(vendor) {
		return Boolean(lowestOffer && lowestOffer.offerCount >= 2 && lowestOffer.bestVendors.has(vendor));
	}

	$: activeLowestCents = isCondensed
		? (bestOffer?.minPriceCents ?? null)
		: (lowestOffer?.minPriceCents ?? null);
	$: isUnderCap = Boolean(
		card.max_price_cap > 0 && activeLowestCents !== null && activeLowestCents <= card.max_price_cap
	);

	// Inline quick-edit state for Max Price Cap & Min Condition
	let editingCap = false;
	let capDraft = '';
	let editingCond = false;
	let condDraft = '';

	function startEditCap() {
		editingCond = false;
		capDraft =
			card.max_price_cap !== null && card.max_price_cap !== undefined
				? (card.max_price_cap / 100).toFixed(2)
				: '';
		editingCap = true;
	}

	function saveInlineCap() {
		if (!editingCap) return;
		const trimmed = String(capDraft).trim();
		let nextCap = null;
		if (trimmed !== '') {
			const parsed = Math.round(parseFloat(trimmed) * 100);
			if (isNaN(parsed) || parsed < 0) {
				editingCap = false;
				return;
			}
			nextCap = parsed;
		}
		editingCap = false;
		if (nextCap !== (card.max_price_cap ?? null)) {
			dispatch('quickUpdate', { card, patch: { max_price_cap: nextCap } });
		}
	}

	function handleCapKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveInlineCap();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editingCap = false;
		}
	}

	function startEditCond() {
		editingCap = false;
		condDraft = (card.min_condition || '').toUpperCase();
		editingCond = true;
	}

	function handleCondChange(e) {
		const val = e.target.value;
		editingCond = false;
		const nextCond = val ? val : null;
		if (nextCond !== (card.min_condition || null)) {
			dispatch('quickUpdate', { card, patch: { min_condition: nextCond } });
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<tr
	class:condensed={isCondensed}
	class:selected={isSelected}
	class:under-cap={isUnderCap}
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
				{#if (card.max_price_cap !== null && card.max_price_cap !== undefined) || card.min_condition || histBadge || isUnderCap || editingCap || editingCond}
					<div class="card-badges-row">
						{#if isUnderCap}
							<span
								class="cap-badge under-cap-badge"
								title="In stock at {formatPrice(activeLowestCents)} (at or below your {formatPrice(card.max_price_cap)} cap)"
							>
								<i class="fa-solid fa-tag"></i> UNDER CAP
							</span>
						{/if}
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
						{#if editingCap}
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="inline-badge-editor" on:click|stopPropagation>
								<span class="inline-currency">$</span>
								<input
									type="number"
									step="0.01"
									min="0"
									bind:value={capDraft}
									on:keydown={handleCapKeydown}
									on:blur={saveInlineCap}
									placeholder="No cap"
									class="inline-cap-input"
									aria-label="Edit max price cap"
									autofocus
								/>
							</div>
						{:else if card.max_price_cap !== null && card.max_price_cap !== undefined}
							<button
								type="button"
								class="cap-badge"
								title="Click to edit Max Price Cap inline"
								on:click|stopPropagation={startEditCap}
							>
								MAX {formatPrice(card.max_price_cap)}
							</button>
						{/if}
						{#if editingCond}
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="inline-badge-editor" on:click|stopPropagation>
								<select
									bind:value={condDraft}
									on:change={handleCondChange}
									on:blur={() => (editingCond = false)}
									class="inline-cond-select"
									aria-label="Edit minimum condition"
									autofocus
								>
									<option value="">Account Default</option>
									<option value="ANY">ANY</option>
									<option value="HP">HP+</option>
									<option value="MP">MP+</option>
									<option value="SP">SP+</option>
									<option value="NM">NM Only</option>
								</select>
							</div>
						{:else if card.min_condition}
							<button
								type="button"
								class="cap-badge cond-override-badge"
								title="Minimum Condition Override: {formatMinConditionLabel(card.min_condition)} (Click to edit inline)"
								on:click|stopPropagation={startEditCond}
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
		<td data-label="Best Price" class="vendor-stock-cell col-vendor col-best-price">
			{#if bestOffer && bestOffer.inStock}
				{#if bestOffer.url}
					<a
						href={sanitizeExternalUrl(bestOffer.url) || undefined}
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
	{:else}
		{#if showCardTrader}
			<td data-label="CardTrader" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('cardtrader')}>
				{#if card.cardtrader_id}
					<a
						href="https://www.cardtrader.com/cards/{card.cardtrader_id}"
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('cardtrader')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.cardtrader_stock))} {getStockColor(
									getStockStatus(card.cardtrader_stock)
								)}"
							></i>
							{#if card.cardtrader_low_price !== null && card.cardtrader_low_price !== undefined}
								<span class="price-text">
									{formatPrice(card.cardtrader_low_price)}
									{#if card.cardtrader_condition && getStockStatus(card.cardtrader_stock) === 'available'}
										<span
											class="condition-bubble cond-{card.cardtrader_condition.toLowerCase()}"
											title="Condition: {card.cardtrader_condition}"
										>
											{card.cardtrader_condition}
										</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="fa-solid fa-circle-question text-muted"
							title="Card not found on CardTrader"
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showTCGPlayer}
			<td data-label="TCGPlayer" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('tcgplayer')}>
				{#if card.tcgplayer_id}
					<a
						href={getTCGPlayerUrl(card)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('tcgplayer')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.tcgplayer_stock))} {getStockColor(
									getStockStatus(card.tcgplayer_stock)
								)}"
							></i>
							{#if card.tcgplayer_low_price > 0 && getStockStatus(card.tcgplayer_stock) === 'available'}
								<span class="price-text">
									{formatPrice(card.tcgplayer_low_price)}
									{#if card.tcgplayer_condition}
										<span
											class="condition-bubble cond-{card.tcgplayer_condition.toLowerCase()}"
											title="Condition: {card.tcgplayer_condition}"
										>
											{card.tcgplayer_condition}
										</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="fa-solid fa-circle-question text-muted"
							title="Card not found on TCGPlayer"
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showManapool}
			<td data-label="Mana Pool" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('manapool')}>
				{#if sanitizeExternalUrl(card.manapool_url)}
					<a
						href={sanitizeExternalUrl(card.manapool_url)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('manapool')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.manapool_stock))} {getStockColor(
									getStockStatus(card.manapool_stock)
								)}"
							></i>
							{#if card.manapool_low_price !== null && card.manapool_low_price !== undefined && getStockStatus(card.manapool_stock) === 'available'}
								<span class="price-text">
									{formatPrice(card.manapool_low_price)}
									{#if card.manapool_condition}
										<span
											class="condition-bubble cond-{card.manapool_condition.toLowerCase()}"
											title="Condition: {card.manapool_condition}"
										>
											{card.manapool_condition}
										</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="fa-solid fa-circle-question text-muted"
							title="Card not found on Mana Pool"
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showCardkingdom}
			<td data-label="Card Kingdom" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('cardkingdom')}>
				{#if sanitizeExternalUrl(card.cardkingdom_url)}
					<a
						href={sanitizeExternalUrl(card.cardkingdom_url)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('cardkingdom')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.cardkingdom_stock))} {getStockColor(
									getStockStatus(card.cardkingdom_stock)
								)}"
							></i>
							{#if card.cardkingdom_low_price !== null && card.cardkingdom_low_price !== undefined && getStockStatus(card.cardkingdom_stock) === 'available'}
								<span class="price-text">
									{formatPrice(card.cardkingdom_low_price)}
									{#if card.cardkingdom_condition}
										<span
											class="condition-bubble cond-{card.cardkingdom_condition.toLowerCase()}"
											title="Condition: {card.cardkingdom_condition}"
										>
											{card.cardkingdom_condition}
										</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div
						class="stock-indicator {getStockColor(
							getStockStatus(card.cardkingdom_stock)
						)}"
					>
						<i
							class="{getStockIcon(getStockStatus(card.cardkingdom_stock))} {getStockColor(
								getStockStatus(card.cardkingdom_stock)
							)}"
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showCardmarket}
			<td data-label="CardMarket" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('cardmarket')}>
				{#if card.cardmarket_id}
					<a
						href={getCardmarketUrl(card)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('cardmarket')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.cardmarket_stock))} {getStockColor(
									getStockStatus(card.cardmarket_stock)
								)}"
							></i>
							{#if card.cardmarket_low_price !== null && card.cardmarket_low_price !== undefined && getStockStatus(card.cardmarket_stock) === 'available'}
								<span class="price-text" title={formatEurPrice(card.cardmarket_price_eur)}>
									{formatPrice(card.cardmarket_low_price)}
									{#if card.cardmarket_condition}
										<span
											class="condition-bubble cond-{getCardmarketConditionClass(card.cardmarket_condition)}"
											title="Condition: {card.cardmarket_condition}{card.cardmarket_price_eur ? ` (${formatEurPrice(card.cardmarket_price_eur)})` : ''}"
										>
											{card.cardmarket_condition}
										</span>
									{/if}
									{#if card.cardmarket_price_eur}
										<span class="currency-tag">EUR</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="fa-solid fa-circle-question text-muted"
							title="Card not found on CardMarket"
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showEbay}
			<td data-label="EBay" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('ebay')}>
				<a
					href={getEbayUrl(card, setCodeToNameMap)}
					target="_blank"
					rel="noopener noreferrer"
					class="vendor-link"
				>
					<div
						class="stock-indicator"
						class:best-price={isBestVendor('ebay')}
					>
						<i
							class="{getStockIcon(getStockStatus(card.ebay_stock))} {getStockColor(
								getStockStatus(card.ebay_stock)
							)}"
						></i>
						{#if card.ebay_low_price !== null && card.ebay_low_price !== undefined && getStockStatus(card.ebay_stock) === 'available'}
							<span class="price-text">
								{formatPrice(card.ebay_low_price)}
								{#if card.ebay_condition}
									<span
										class="condition-bubble cond-{card.ebay_condition.toLowerCase()}"
										title="Condition: {card.ebay_condition}"
									>
										{card.ebay_condition}
									</span>
								{/if}
							</span>
						{/if}
					</div>
				</a>
			</td>
		{/if}

		{#if showHimarket}
			<td data-label="HiMarket" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('himarket')}>
				{#if sanitizeExternalUrl(card.himarket_url)}
					<a
						href={sanitizeExternalUrl(card.himarket_url)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('himarket')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.himarket_stock))} {getStockColor(
									getStockStatus(card.himarket_stock)
								)}"
							></i>
							{#if card.himarket_low_price !== null && card.himarket_low_price !== undefined && getStockStatus(card.himarket_stock) === 'available'}
								<span class="price-text" title={formatHkdPrice(card.himarket_price_hkd)}>
									{formatPrice(card.himarket_low_price)}
									{#if card.himarket_condition}
										<span
											class="condition-bubble cond-{card.himarket_condition.toLowerCase()}"
											title="Condition: {card.himarket_condition}{card.himarket_price_hkd ? ` (${formatHkdPrice(card.himarket_price_hkd)})` : ''}"
										>
											{card.himarket_condition}
										</span>
									{/if}
									{#if card.himarket_price_hkd}
										<span class="currency-tag">HKD</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="{getStockIcon(getStockStatus(card.himarket_stock))} {getStockColor(
								getStockStatus(card.himarket_stock)
							)}"
							title={getStockStatus(card.himarket_stock) === 'unavailable' ? 'Out of stock on HiMarket' : 'Not searched on HiMarket'}
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showHareruya}
			<td data-label="Hareruya" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('hareruya')}>
				{#if sanitizeExternalUrl(card.hareruya_url)}
					<a
						href={sanitizeExternalUrl(card.hareruya_url)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('hareruya')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.hareruya_stock))} {getStockColor(
									getStockStatus(card.hareruya_stock)
								)}"
							></i>
							{#if card.hareruya_low_price !== null && card.hareruya_low_price !== undefined && getStockStatus(card.hareruya_stock) === 'available'}
								<span class="price-text" title={formatJpyPrice(card.hareruya_price_jpy)}>
									{formatPrice(card.hareruya_low_price)}
									{#if card.hareruya_condition}
										<span
											class="condition-bubble cond-{card.hareruya_condition.toLowerCase()}"
											title="Condition: {card.hareruya_condition}{card.hareruya_price_jpy ? ` (${formatJpyPrice(card.hareruya_price_jpy)})` : ''}"
										>
											{card.hareruya_condition}
										</span>
									{/if}
									{#if card.hareruya_price_jpy}
										<span class="currency-tag">JPY</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="{getStockIcon(getStockStatus(card.hareruya_stock))} {getStockColor(
								getStockStatus(card.hareruya_stock)
							)}"
							title={getStockStatus(card.hareruya_stock) === 'unavailable' ? 'Out of stock on Hareruya' : 'Not searched on Hareruya'}
						></i>
					</div>
				{/if}
			</td>
		{/if}

		{#if showRuten}
			<td data-label="Ruten" class="vendor-stock-cell col-vendor" class:is-best-price={isBestVendor('ruten')}>
				{#if !['zht', 'en'].includes((card.language || '').toLowerCase())}
					<div class="stock-indicator">
						<span
							class="unsupported-lang-dash"
							title="Ruten only checks Traditional Chinese (ZHT) and English (EN) cards"
						>—</span>
					</div>
				{:else if sanitizeExternalUrl(card.ruten_url)}
					<a
						href={sanitizeExternalUrl(card.ruten_url)}
						target="_blank"
						rel="noopener noreferrer"
						class="vendor-link"
					>
						<div
							class="stock-indicator"
							class:best-price={isBestVendor('ruten')}
						>
							<i
								class="{getStockIcon(getStockStatus(card.ruten_stock))} {getStockColor(
									getStockStatus(card.ruten_stock)
								)}"
							></i>
							{#if card.ruten_low_price !== null && card.ruten_low_price !== undefined && getStockStatus(card.ruten_stock) === 'available'}
								<span class="price-text" title={formatTwdPrice(card.ruten_price_twd)}>
									{formatPrice(card.ruten_low_price)}
									{#if card.ruten_condition}
										<span
											class="condition-bubble cond-{card.ruten_condition.toLowerCase()}"
											title="Condition: {card.ruten_condition}{card.ruten_price_twd ? ` (${formatTwdPrice(card.ruten_price_twd)})` : ''}"
										>
											{card.ruten_condition}
										</span>
									{/if}
									{#if card.ruten_price_twd}
										<span class="currency-tag">TWD</span>
									{/if}
								</span>
							{/if}
						</div>
					</a>
				{:else}
					<div class="stock-indicator">
						<i
							class="{getStockIcon(getStockStatus(card.ruten_stock))} {getStockColor(
								getStockStatus(card.ruten_stock)
							)}"
							title={getStockStatus(card.ruten_stock) === 'unavailable' ? 'Out of stock on Ruten' : 'Not searched on Ruten'}
						></i>
					</div>
				{/if}
			</td>
		{/if}
	{/if}

	<td data-label="Actions" class="actions-column col-actions">
		<div class="kebab-menu-container">
			<button
				type="button"
				class="kebab-button"
				aria-label="Actions menu"
				on:click={(e) => {
					e.stopPropagation();
					dispatch('toggleMenu', e);
				}}
			>
				<i class="fa-solid fa-ellipsis-vertical"></i>
			</button>
			{#if isMenuOpen}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div class="kebab-dropdown" class:drop-up={isDropUp} on:click|stopPropagation>
					<button
						type="button"
						class="dropdown-item"
						on:click={() => {
							dispatch('toggleSelect');
							dispatch('closeMenu');
						}}
					>
						<i class="fa-solid {isSelected ? 'fa-square-check' : 'fa-check-double'}"></i>
						{isSelected ? 'Deselect' : 'Select'}
					</button>
					{#if canManualCheckStock}
						<button
							type="button"
							class="dropdown-item"
							disabled={isCheckingCard || cooldownSec > 0}
							title={cooldownSec > 0
								? `Checked recently (${formatExactTimestamp(card?.last_manual_check)}). Available again in ${formatCooldownRemaining(cooldownSec)}.`
								: 'Queue an on-demand stock check across enabled marketplaces'}
							on:click={() => {
								dispatch('manualStockCheck');
								dispatch('closeMenu');
							}}
						>
							{#if isCheckingCard}
								<i class="fa-solid fa-arrows-rotate fa-spin"></i> Checking...
							{:else if cooldownSec > 0}
								<i class="fa-regular fa-clock"></i> Checked ({formatCooldownRemaining(cooldownSec)})
							{:else}
								<i class="fa-solid fa-arrows-rotate"></i> Check Stock Now
							{/if}
						</button>
					{/if}
					<button
						type="button"
						class="dropdown-item"
						on:click={() => {
							dispatch('copyLine');
							dispatch('closeMenu');
						}}
					>
						<i class="fa-solid fa-copy"></i> Copy Line
					</button>
					<button
						type="button"
						class="dropdown-item"
						on:click={() => {
							dispatch('openHistory');
							dispatch('closeMenu');
						}}
					>
						<i class="fa-solid fa-chart-line"></i> Price History
					</button>
					<button
						type="button"
						class="dropdown-item"
						on:click={() => {
							dispatch('openSettings');
							dispatch('closeMenu');
						}}
					>
						<i class="fa-solid fa-pen-to-square"></i> Edit Card
					</button>
					<button
						type="button"
						class="dropdown-item text-error"
						on:click={() => {
							dispatch('deleteCard');
							dispatch('closeMenu');
						}}
						disabled={!isAuthenticated}
					>
						<i class="fa-solid fa-trash"></i> Delete
					</button>
				</div>
			{/if}
		</div>
	</td>
</tr>

<style>
	tr {
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	tr:hover td {
		background-color: var(--color-bg-hover);
	}

	tr.selected td {
		background-color: var(--color-primary-alpha, rgba(99, 102, 241, 0.15)) !important;
	}

	tr.selected {
		box-shadow: inset 3px 0 0 var(--color-primary, #6366f1);
	}

	tr.under-cap:not(.selected) td {
		background-color: rgba(34, 197, 94, 0.06);
	}

	tr.under-cap:not(.selected) {
		box-shadow: inset 3px 0 0 #22c55e;
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

	.col-vendor {
		min-width: 96px;
		max-width: 135px;
		text-align: center;
		padding: 0.55rem 0.35rem;
	}

	.col-best-price {
		min-width: 170px;
		max-width: 250px;
	}

	.actions-column {
		width: 46px;
		min-width: 42px;
		max-width: 48px;
		text-align: center;
		padding: 0.6rem 0.2rem;
		position: relative;
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

	.cap-badge.under-cap-badge {
		color: #16a34a;
		background: rgba(34, 197, 94, 0.14);
		border-color: rgba(34, 197, 94, 0.4);
		cursor: default;
	}

	.cap-badge.under-cap-badge:hover {
		background: rgba(34, 197, 94, 0.14);
		border-color: rgba(34, 197, 94, 0.4);
		transform: none;
	}

	.inline-badge-editor {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-primary);
		border-radius: 999px;
		padding: 0.05rem 0.4rem;
		box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(99, 102, 241, 0.2));
	}

	.inline-currency {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	.inline-cap-input {
		width: 58px;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.68rem;
		font-weight: 700;
		outline: none;
		padding: 0;
	}

	.inline-cond-select {
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.66rem;
		font-weight: 700;
		outline: none;
		cursor: pointer;
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

	.hist-badge.hist-breakthrough:hover {
		background: rgba(239, 68, 68, 0.25);
		border-color: rgba(239, 68, 68, 0.7);
	}

	.hist-badge.hist-at-floor,
	.hist-badge.hist-at-low {
		background: rgba(16, 185, 129, 0.14);
		border-color: rgba(16, 185, 129, 0.45);
		color: #6ee7b7;
	}

	.hist-badge.hist-at-floor:hover,
	.hist-badge.hist-at-low:hover {
		background: rgba(16, 185, 129, 0.25);
		border-color: rgba(16, 185, 129, 0.7);
	}

	.hist-badge.hist-last-seen {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.32);
		color: #cbd5e1;
	}

	.hist-badge.hist-last-seen:hover {
		background: rgba(148, 163, 184, 0.22);
		border-color: rgba(148, 163, 184, 0.55);
	}

	.hist-badge.hist-floor {
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.12);
		border-color: rgba(59, 130, 246, 0.35);
	}

	.hist-badge.hist-floor:hover {
		background: rgba(59, 130, 246, 0.22);
		border-color: rgba(59, 130, 246, 0.6);
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

	.vendor-stock-cell {
		text-align: center;
		vertical-align: middle;
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

	.kebab-menu-container {
		position: relative;
		display: inline-block;
	}

	.kebab-button {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		transition: all var(--transition-fast);
		text-align: center;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.kebab-button:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.kebab-dropdown {
		position: absolute;
		right: 0;
		top: 100%;
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		box-shadow: var(--shadow-md);
		min-width: 140px;
		z-index: 50;
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
		margin-top: 0.25rem;
		animation: fadeIn 0.2s ease-out;
	}

	.kebab-dropdown.drop-up {
		top: auto;
		bottom: 100%;
		margin-top: 0;
		margin-bottom: 0.25rem;
	}

	.dropdown-item {
		background: none;
		border: none;
		padding: 0.75rem 1rem;
		text-align: left;
		cursor: pointer;
		color: var(--color-text-primary);
		font-size: 0.9rem;
		transition: background-color var(--transition-fast);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.dropdown-item i {
		width: 16px;
		text-align: center;
	}

	.dropdown-item:hover:not(:disabled) {
		background-color: var(--color-bg-hover);
	}

	.dropdown-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-item.text-error {
		color: var(--color-error, #ef4444);
	}

	.dropdown-item.text-error:hover:not(:disabled) {
		background-color: var(--color-error, #ef4444);
		color: white;
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

		tr:hover td {
			background-color: transparent;
		}

		td,
		td.col-set,
		td.col-lang,
		td.col-finish,
		td.col-vendor,
		td.col-card,
		td.col-actions {
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

		td[data-label='Actions'] {
			position: absolute;
			top: 0.65rem;
			right: 0.6rem;
			border-top: none;
			padding: 0;
			margin: 0;
			background: none;
			width: auto !important;
			max-width: none !important;
		}

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

		td[data-label='Best Price'] .best-offer-row {
			justify-content: flex-start;
			background: transparent;
			border: none;
			padding: 0;
		}

		td[data-label='Best Price'] .oos-compact {
			justify-content: flex-start;
		}

		td[data-label='CardTrader'],
		td[data-label='TCGPlayer'],
		td[data-label='EBay'],
		td[data-label='eBay'],
		td[data-label='Mana Pool'],
		td[data-label='Card Kingdom'],
		td[data-label='CardMarket'],
		td[data-label='HiMarket'],
		td[data-label='Hareruya'],
		td[data-label='Ruten'] {
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
		}

		td.vendor-stock-cell.is-best-price,
		td.vendor-stock-cell:has(.best-price) {
			border-color: rgba(16, 185, 129, 0.7) !important;
			background: rgba(16, 185, 129, 0.14) !important;
			box-shadow: 0 0 12px rgba(16, 185, 129, 0.18);
		}

		td.vendor-stock-cell.is-best-price::before,
		td.vendor-stock-cell:has(.best-price)::before {
			color: #10b981 !important;
		}

		td.vendor-stock-cell.is-best-price .price-text,
		td.vendor-stock-cell:has(.best-price) .price-text {
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

		td[data-label='Best Price']::before,
		td[data-label='CardTrader']::before,
		td[data-label='TCGPlayer']::before,
		td[data-label='EBay']::before,
		td[data-label='eBay']::before,
		td[data-label='Mana Pool']::before,
		td[data-label='Card Kingdom']::before,
		td[data-label='CardMarket']::before,
		td[data-label='HiMarket']::before,
		td[data-label='Hareruya']::before,
		td[data-label='Ruten']::before {
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
