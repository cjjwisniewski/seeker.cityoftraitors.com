<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';
	import { auth } from '$lib/stores/auth';
	import {
		closeDemoAlertPreviews,
		demoAlertModalOpen,
		demoAlertsStore,
		demoSelectedAlertId,
		loadDemoCards,
		loadDemoSettings
	} from '$lib/demo/demoStore';
	import type { DemoAlertPreview, DemoCardRecord, DemoUserSettings } from '$lib/demo/demoTypes';
	import {
		formatPrice,
		formatVendorDisplayName,
		getWebpImageUri,
		sanitizeExternalUrl
	} from '$lib/utils/seekingUtils';

	let activeTab: 'alerts' | 'digest' = 'alerts';
	let alertViewMode: 'single' | 'batched' = 'single';

	const CONDITION_RANK: Record<string, number> = {
		NM: 5,
		M: 5,
		SP: 4,
		LP: 4,
		MP: 3,
		HP: 2,
		DMG: 1,
		D: 1
	};

	const TCGPLAYER_LANG_MAP: Record<string, string> = {
		en: 'English',
		ja: 'Japanese',
		jp: 'Japanese',
		de: 'German',
		fr: 'French',
		it: 'Italian',
		es: 'Spanish',
		pt: 'Portuguese',
		ru: 'Russian',
		ko: 'Korean',
		kr: 'Korean',
		zht: 'Chinese (T)',
		zhs: 'Chinese (S)'
	};

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && $demoAlertModalOpen) {
			closeDemoAlertPreviews();
		}
	}

	function getEmbedTitle(kind: DemoAlertPreview['kind'], cardName: string): string {
		switch (kind) {
			case 'price_drop':
				return `🔻 Price Drop: ${cardName}`;
			case 'historical_low':
				return `🔥 Historical Low: ${cardName}`;
			default:
				return `🟢 In Stock: ${cardName}`;
		}
	}

	function getEmbedColorClass(kind: DemoAlertPreview['kind']): string {
		switch (kind) {
			case 'price_drop':
				return 'embed-drop';
			case 'historical_low':
				return 'embed-atl';
			default:
				return 'embed-restock';
		}
	}

	function formatDiscordFinish(finish: string): string {
		const lower = String(finish || 'nonfoil').toLowerCase();
		if (lower === 'foil') return '✨ Foil';
		if (lower === 'etched') return 'Etched';
		return 'Nonfoil';
	}

	function formatRelativeAgeDays(isoStr: string | null | undefined): string {
		if (!isoStr) return '';
		const parsed = Date.parse(isoStr);
		if (!Number.isFinite(parsed)) return '';
		const days = Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000));
		if (days === 0) return '';
		if (days < 30) return `${days}d ago`;
		if (days < 365) return `${Math.max(1, Math.floor(days / 30))}mo ago`;
		return `${Math.max(1, Math.floor(days / 365))}y ago`;
	}

	function formatDiscordTimestamp(isoStr?: string | null): string {
		const dt = isoStr ? new Date(isoStr) : new Date();
		if (Number.isNaN(dt.getTime())) return 'Today';
		return `Today at ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
	}

	interface DigestVendorOffer {
		vendorName: string;
		priceCents: number;
		nativeText: string | null;
		condition: string | null;
		url: string;
	}

	interface DigestCardEntry {
		key: string;
		fieldTitle: string;
		languageUpper: string;
		finishLabel: string;
		offers: DigestVendorOffer[];
	}

	function buildCardDigestEntries(
		cards: DemoCardRecord[],
		settings: DemoUserSettings
	): DigestCardEntry[] {
		const entries: DigestCardEntry[] = [];

		for (const card of cards) {
			const langLower = String(card.language || 'en').toLowerCase();
			const finishLower = String(card.finish || 'nonfoil').toLowerCase();
			const effMinCond = (card.min_condition || settings.minCondition || 'ANY').toUpperCase();
			const minRank = CONDITION_RANK[effMinCond] ?? 0;

			const tcgLang = encodeURIComponent(TCGPLAYER_LANG_MAP[langLower] || 'English');
			const tcgPrint = encodeURIComponent(
				finishLower === 'foil' || finishLower === 'etched' ? 'Foil' : 'Normal'
			);

			const rawOffers: Array<{
				enabled: boolean;
				stock: boolean;
				vendorName: string;
				price: number | null;
				nativeText: string | null;
				cond: string | null;
				url: string;
			}> = [
				{
					enabled: settings.marketplaceCardtraderEnabled,
					stock: card.cardtrader_stock,
					vendorName: 'Cardtrader',
					price: card.cardtrader_low_price,
					nativeText: null,
					cond: card.cardtrader_condition,
					url: card.cardtrader_id
						? `https://www.cardtrader.com/cards/${encodeURIComponent(String(card.cardtrader_id))}`
						: `https://www.cardtrader.com/cards?search=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceTcgplayerEnabled,
					stock: card.tcgplayer_stock,
					vendorName: 'TCGplayer',
					price: card.tcgplayer_low_price,
					nativeText: null,
					cond: card.tcgplayer_condition,
					url: card.tcgplayer_id
						? `https://www.tcgplayer.com/product/${encodeURIComponent(String(card.tcgplayer_id))}?Language=${tcgLang}&Printing=${tcgPrint}`
						: `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceManapoolEnabled,
					stock: card.manapool_stock,
					vendorName: 'Mana Pool',
					price: card.manapool_low_price,
					nativeText: null,
					cond: card.manapool_condition,
					url: card.manapool_url || `https://manapool.com/cards?q=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceHimarketEnabled,
					stock: card.himarket_stock,
					vendorName: 'HiMarket',
					price: card.himarket_low_price,
					nativeText: card.himarket_price_hkd ? `(HK$${card.himarket_price_hkd.toFixed(2)})` : null,
					cond: card.himarket_condition,
					url:
						card.himarket_url || `https://www.himarket.hk/search?q=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceCardkingdomEnabled,
					stock: card.cardkingdom_stock,
					vendorName: 'Card Kingdom',
					price: card.cardkingdom_low_price,
					nativeText: null,
					cond: card.cardkingdom_condition,
					url:
						card.cardkingdom_url ||
						`https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceHareruyaEnabled,
					stock: card.hareruya_stock,
					vendorName: 'Hareruya',
					price: card.hareruya_low_price,
					nativeText: card.hareruya_price_jpy
						? `(¥${Math.round(card.hareruya_price_jpy).toLocaleString('en-US')})`
						: null,
					cond: card.hareruya_condition,
					url:
						card.hareruya_url ||
						`https://www.hareruyamtg.com/en/products/search?product=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceRutenEnabled && ['zht', 'en'].includes(langLower),
					stock: card.ruten_stock,
					vendorName: 'Ruten',
					price: card.ruten_low_price,
					nativeText: card.ruten_price_twd
						? `(NT$${Math.round(card.ruten_price_twd).toLocaleString('en-US')})`
						: null,
					cond: card.ruten_condition,
					url: card.ruten_url || `https://www.ruten.com.tw/find/?q=${encodeURIComponent(card.name)}`
				},
				{
					enabled: settings.marketplaceEbayEnabled,
					stock: card.ebay_stock,
					vendorName: 'eBay',
					price: card.ebay_low_price,
					nativeText: null,
					cond: card.ebay_condition,
					url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${card.name} ${card.set_name || card.set_code}`)}&_sop=15`
				}
			];

			const offers: DigestVendorOffer[] = [];
			for (const o of rawOffers) {
				if (!o.enabled || !o.stock || !o.price || o.price <= 0) continue;
				if (card.max_price_cap !== null && o.price > card.max_price_cap) continue;
				if (minRank > 0) {
					const condRank = CONDITION_RANK[(o.cond || 'NM').toUpperCase()] ?? 3;
					if (condRank < minRank) continue;
				}
				const safeUrl = sanitizeExternalUrl(o.url, '');
				if (!safeUrl) continue;
				offers.push({
					vendorName: o.vendorName,
					priceCents: o.price,
					nativeText: o.nativeText,
					condition: o.cond,
					url: safeUrl
				});
			}

			if (offers.length === 0) continue;
			offers.sort((a, b) => a.priceCents - b.priceCents);

			const setUpper = String(card.set_code || '').toUpperCase();
			const cnStr = card.collector_number ? ` #${card.collector_number}` : '';
			entries.push({
				key: `${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`,
				fieldTitle: `${card.name} (${setUpper}${cnStr})`,
				languageUpper: String(card.language || 'en').toUpperCase(),
				finishLabel: formatDiscordFinish(card.finish),
				offers
			});
		}

		return entries;
	}

	interface BatchedAlertCardGroup {
		key: string;
		badge: string;
		fieldTitle: string;
		setUpper: string;
		collectorNumber: string;
		languageUpper: string;
		finishLabel: string;
		offers: DemoAlertPreview[];
		historicalContext: DemoAlertPreview['historicalContext'];
	}

	function buildBatchedGroups(alerts: DemoAlertPreview[]): BatchedAlertCardGroup[] {
		const map = new Map<string, DemoAlertPreview[]>();
		for (const a of alerts) {
			const k = `${a.setCode}-${a.collectorNumber}-${a.language}-${a.finish}`;
			const existing = map.get(k) || [];
			existing.push(a);
			map.set(k, existing);
		}
		const groups: BatchedAlertCardGroup[] = [];
		for (const [key, list] of map.entries()) {
			const sorted = [...list].sort((a, b) => a.priceCents - b.priceCents);
			const base = sorted[0];
			const hasAtl = sorted.some(
				(o) => o.kind === 'historical_low' || o.historicalContext?.isLowBreakthrough
			);
			const hasDrop = sorted.some((o) => o.kind === 'price_drop');
			const badge = hasAtl ? '🔥' : hasDrop ? '🔻' : '🟢';
			groups.push({
				key,
				badge,
				fieldTitle: `${badge} ${base.cardName} (${base.setCode.toUpperCase()})`,
				setUpper: base.setCode.toUpperCase(),
				collectorNumber: base.collectorNumber,
				languageUpper: base.language.toUpperCase(),
				finishLabel: formatDiscordFinish(base.finish),
				offers: sorted,
				historicalContext: sorted.find((o) => o.historicalContext)?.historicalContext || null
			});
		}
		return groups;
	}

	function getBatchEmbedColorClass(alerts: DemoAlertPreview[]): string {
		if (alerts.some((a) => a.kind === 'historical_low' || a.historicalContext?.isLowBreakthrough)) {
			return 'embed-atl';
		}
		if (alerts.some((a) => a.kind === 'price_drop')) {
			return 'embed-drop';
		}
		return 'embed-restock';
	}

	$: orderedAlerts = $demoSelectedAlertId
		? [
				...$demoAlertsStore.filter((a) => a.id === $demoSelectedAlertId),
				...$demoAlertsStore.filter((a) => a.id !== $demoSelectedAlertId)
			]
		: $demoAlertsStore;

	$: batchedGroups = buildBatchedGroups(orderedAlerts);
	$: currentSettings = $demoAlertModalOpen && $auth.isDemo ? loadDemoSettings() : null;
	$: digestEntries =
		$demoAlertModalOpen && $auth.isDemo && currentSettings
			? buildCardDigestEntries(loadDemoCards(), currentSettings)
			: [];

	$: digestPages = (() => {
		const chunkSize = 20;
		const pages: DigestCardEntry[][] = [];
		for (let i = 0; i < digestEntries.length; i += chunkSize) {
			pages.push(digestEntries.slice(i, i + chunkSize));
		}
		return pages;
	})();
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $demoAlertModalOpen && $auth.isDemo}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		class="preview-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Simulated Discord Alert & Digest Previews"
		on:click|self={closeDemoAlertPreviews}
	>
		<div class="preview-modal" use:focusTrap>
			<div class="preview-header">
				<div class="preview-title">
					<i class="fa-brands fa-discord discord-icon" aria-hidden="true"></i>
					<div>
						<h2>Simulated Discord DM Previews</h2>
						<p>
							Faithful 1:1 embed previews rendered from your demo watchlist, caps, and Account
							settings.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="close-btn"
					aria-label="Close alert previews"
					on:click={closeDemoAlertPreviews}
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="preview-tabs-bar">
				<div class="preview-tabs" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === 'alerts'}
						class:active={activeTab === 'alerts'}
						on:click={() => (activeTab = 'alerts')}
					>
						<i class="fa-solid fa-bolt" aria-hidden="true"></i>
						DM Stock Alerts ({orderedAlerts.length})
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === 'digest'}
						class:active={activeTab === 'digest'}
						on:click={() => (activeTab = 'digest')}
					>
						<i class="fa-solid fa-box-open" aria-hidden="true"></i>
						Daily Stock Digest ({digestEntries.length})
					</button>
				</div>

				{#if activeTab === 'alerts' && orderedAlerts.length > 0}
					<div class="mode-switch" role="group" aria-label="DM Alert Format">
						<button
							type="button"
							class:selected={alertViewMode === 'single'}
							on:click={() => (alertViewMode = 'single')}
						>
							Individual DMs
						</button>
						<button
							type="button"
							class:selected={alertViewMode === 'batched'}
							on:click={() => (alertViewMode = 'batched')}
						>
							1-Min Batch Embed
						</button>
					</div>
				{/if}
			</div>

			<div class="discord-chat-surface">
				{#if activeTab === 'alerts'}
					{#if currentSettings && !currentSettings.stockAlertEnabled}
						<div class="paused-note">
							Instant stock alerts are currently toggled OFF in your
							<a href="/account" on:click={closeDemoAlertPreviews}>Account Settings</a>. Historical
							samples triggered before pausing remain below.
						</div>
					{/if}

					{#if orderedAlerts.length === 0}
						<div class="empty-preview">
							No simulated DM alerts recorded yet. Run a manual stock check or adjust a Price Cap on
							any card to trigger a live DM preview.
						</div>
					{:else if alertViewMode === 'batched'}
						<div class="discord-message">
							<img src="/favicon.png" alt="Seeker Bot" class="bot-avatar-img" />
							<div class="message-body">
								<div class="author-row">
									<span class="bot-name">Seeker Stock Alert</span>
									<span class="bot-tag">
										<i class="fa-solid fa-check bot-check" aria-hidden="true"></i>
										APP
									</span>
									<span class="msg-time">{formatDiscordTimestamp(orderedAlerts[0]?.createdAt)}</span
									>
								</div>

								<div class="discord-embed {getBatchEmbedColorClass(orderedAlerts)}">
									<div class="embed-content">
										<div class="embed-title-plain">
											📦 Restock Alert: {batchedGroups.length} Card{batchedGroups.length === 1
												? ''
												: 's'} Available
										</div>
										<div class="embed-desc">
											<strong>{batchedGroups.length}</strong> card(s) on your Seeking list are now available
											in stock:
										</div>

										<div class="embed-fields-stack">
											{#each batchedGroups as grp (grp.key)}
												{@const hist = grp.historicalContext}
												<div class="discord-field full-width">
													<div class="discord-field-name">{grp.fieldTitle}</div>
													<div class="discord-field-val">
														<div>
															<strong>{grp.setUpper}</strong> &middot;
															<code>#{grp.collectorNumber}</code>
															&middot; <strong>{grp.languageUpper}</strong> &middot; {grp.finishLabel}
														</div>
														{#each grp.offers as off (off.id)}
															{@const safeBuy = sanitizeExternalUrl(off.buyUrl, '#')}
															<div>
																&bull; <strong
																	><a
																		href={safeBuy}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="discord-link">{off.vendorDisplayName}</a
																	></strong
																>:
																{#if off.condition}<code>{off.condition}</code>
																{/if}<strong>{formatPrice(off.priceCents)}</strong
																>{#if off.nativePriceText}
																	<em class="native-fx">{off.nativePriceText}</em>{/if}
															</div>
														{/each}
														{#if hist}
															{#if hist.isLowBreakthrough && hist.previousLowCents}
																<div>
																	🔥 <strong>New {hist.tierLabel} Floor!</strong> (Beat
																	<strong>{formatPrice(hist.previousLowCents)}</strong>
																	on {formatVendorDisplayName(hist.previousLowVendor || '')})
																</div>
															{:else if hist.activeLowCents}
																<div>
																	Floor ({hist.tierLabel}):
																	<strong>{formatPrice(hist.activeLowCents)}</strong>
																	on {formatVendorDisplayName(hist.activeLowVendor || '')}
																	{#if hist.prevLastSeenCents && hist.prevLastSeenAt && formatRelativeAgeDays(hist.prevLastSeenAt)}
																		&middot; Last seen {formatRelativeAgeDays(hist.prevLastSeenAt)}:
																		<strong>{formatPrice(hist.prevLastSeenCents)}</strong>
																		({formatVendorDisplayName(hist.prevLastSeenVendor || '')})
																	{/if}
																</div>
															{/if}
														{/if}
													</div>
												</div>
											{/each}
										</div>

										<div class="embed-footer">
											<img src="/favicon.png" alt="" class="footer-icon" />
											<span>Seeker &middot; City of Traitors</span>
											<span>&bull;</span>
											<span>{formatDiscordTimestamp(orderedAlerts[0]?.createdAt)}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					{:else}
						{#each orderedAlerts as alert (alert.id)}
							{@const safeThumb = sanitizeExternalUrl(
								getWebpImageUri(alert.imageUri) || alert.imageUri,
								''
							)}
							{@const safeBuyUrl = sanitizeExternalUrl(alert.buyUrl, '')}
							{@const hist = alert.historicalContext}
							<div class="discord-message" class:highlighted={alert.id === $demoSelectedAlertId}>
								<img src="/favicon.png" alt="Seeker Bot" class="bot-avatar-img" />
								<div class="message-body">
									<div class="author-row">
										<span class="bot-name">Seeker Stock Alert</span>
										<span class="bot-tag">
											<i class="fa-solid fa-check bot-check" aria-hidden="true"></i>
											APP
										</span>
										<span class="msg-time">{formatDiscordTimestamp(alert.createdAt)}</span>
									</div>

									<div class="discord-embed {getEmbedColorClass(alert.kind)}">
										<div class="embed-content">
											<div class="embed-top-row">
												<div class="embed-main-col">
													{#if safeBuyUrl}
														<a
															href={safeBuyUrl}
															target="_blank"
															rel="noopener noreferrer"
															class="embed-title-link"
														>
															{getEmbedTitle(alert.kind, alert.cardName)}
														</a>
													{:else}
														<div class="embed-title-plain">
															{getEmbedTitle(alert.kind, alert.cardName)}
														</div>
													{/if}

													<div class="embed-desc">
														{#if alert.kind === 'price_drop' && alert.oldPriceCents}
															<strong>
																{#if safeBuyUrl}
																	<a
																		href={safeBuyUrl}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="discord-link">{alert.vendorDisplayName}</a
																	>
																{:else}
																	{alert.vendorDisplayName}
																{/if}
															</strong>
															dropped from <s>{formatPrice(alert.oldPriceCents)}</s> to
															<strong>{formatPrice(alert.priceCents)}</strong
															>{#if alert.nativePriceText}
																<em class="native-fx">{alert.nativePriceText}</em
																>{/if}{#if alert.percentageDrop}
																(-{alert.percentageDrop}%){/if}
														{:else}
															Now available on
															<strong>
																{#if safeBuyUrl}
																	<a
																		href={safeBuyUrl}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="discord-link">{alert.vendorDisplayName}</a
																	>
																{:else}
																	{alert.vendorDisplayName}
																{/if}
															</strong>
															for
															<strong>{formatPrice(alert.priceCents)}</strong
															>{#if alert.nativePriceText}
																<em class="native-fx">{alert.nativePriceText}</em>{/if}
														{/if}
													</div>

													<div class="embed-fields-grid">
														<div class="discord-field full-width">
															<div class="discord-field-name">Card</div>
															<div class="discord-field-val">
																<strong>{alert.setCode.toUpperCase()}</strong>
																{#if alert.collectorNumber}
																	&middot; <code>#{alert.collectorNumber}</code>{/if}
																&middot; <strong>{alert.language.toUpperCase()}</strong>
																&middot; {formatDiscordFinish(alert.finish)}
															</div>
														</div>

														{#if alert.kind === 'price_drop'}
															<div class="discord-field inline-field">
																<div class="discord-field-name">Listing</div>
																<div class="discord-field-val">
																	{#if alert.condition}<code>{alert.condition}</code>
																	{/if}
																	{#if safeBuyUrl}
																		<a
																			href={safeBuyUrl}
																			target="_blank"
																			rel="noopener noreferrer"
																			class="discord-link"
																		>
																			View on {alert.vendorDisplayName}
																		</a>
																	{:else}
																		{alert.vendorDisplayName}
																	{/if}
																</div>
															</div>
														{:else}
															<div class="discord-field inline-field">
																<div class="discord-field-name">Price &amp; Condition</div>
																<div class="discord-field-val">
																	{#if alert.condition}<code>{alert.condition}</code>
																	{/if}
																	<strong>{formatPrice(alert.priceCents)}</strong
																	>{#if alert.nativePriceText}
																		<em class="native-fx">{alert.nativePriceText}</em>{/if}
																</div>
															</div>
															<div class="discord-field inline-field">
																<div class="discord-field-name">Marketplace</div>
																<div class="discord-field-val">
																	{#if safeBuyUrl}
																		<a
																			href={safeBuyUrl}
																			target="_blank"
																			rel="noopener noreferrer"
																			class="discord-link"
																		>
																			View on {alert.vendorDisplayName}
																		</a>
																	{:else}
																		{alert.vendorDisplayName}
																	{/if}
																</div>
															</div>
														{/if}

														{#if hist}
															{#if hist.isLowBreakthrough && hist.previousLowCents}
																<div class="discord-field full-width">
																	<div class="discord-field-name">
																		Historical Floor ({hist.tierLabel})
																	</div>
																	<div class="discord-field-val">
																		🔥 <strong>New {hist.tierLabel} Low!</strong> (Beat
																		<strong>{formatPrice(hist.previousLowCents)}</strong>
																		on {formatVendorDisplayName(hist.previousLowVendor || '')})
																	</div>
																</div>
															{:else if hist.activeLowCents}
																<div class="discord-field full-width">
																	<div class="discord-field-name">
																		Historical Floor ({hist.tierLabel})
																	</div>
																	<div class="discord-field-val">
																		<strong>{formatPrice(hist.activeLowCents)}</strong> on {formatVendorDisplayName(
																			hist.activeLowVendor || ''
																		)}
																		{#if alert.kind === 'restock' && hist.prevLastSeenCents && hist.prevLastSeenAt && formatRelativeAgeDays(hist.prevLastSeenAt)}
																			&middot; Last seen {formatRelativeAgeDays(
																				hist.prevLastSeenAt
																			)}:
																			<strong>{formatPrice(hist.prevLastSeenCents)}</strong>
																			{#if hist.prevLastSeenCondition}<code
																					>{hist.prevLastSeenCondition}</code
																				>
																			{/if}
																			({formatVendorDisplayName(hist.prevLastSeenVendor || '')})
																		{/if}
																	</div>
																</div>
															{/if}
														{/if}
													</div>
												</div>

												{#if safeThumb}
													<img src={safeThumb} alt={alert.cardName} class="embed-thumb" />
												{/if}
											</div>

											<div class="embed-footer">
												<img src="/favicon.png" alt="" class="footer-icon" />
												<span>Seeker &middot; City of Traitors</span>
												<span>&bull;</span>
												<span>{formatDiscordTimestamp(alert.createdAt)}</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				{:else}
					{#if currentSettings && !currentSettings.stockDigestEnabled}
						<div class="paused-note">
							Scheduled Stock Digests are currently disabled in your
							<a href="/account" on:click={closeDemoAlertPreviews}>Account Settings</a>. Enable the
							toggle to schedule daily digests at {String(
								currentSettings.stockDigestHourUtc
							).padStart(2, '0')}:00 UTC.
						</div>
					{/if}

					{#if digestPages.length === 0}
						<div class="empty-preview">
							No currently enabled marketplaces match your demo watchlist, minimum condition, and
							price caps. Adjust filters in Account or Seeking to populate your digest.
						</div>
					{:else}
						<div class="discord-message">
							<img src="/favicon.png" alt="Seeker Bot" class="bot-avatar-img" />
							<div class="message-body">
								<div class="author-row">
									<span class="bot-name">Seeker Stock Digest</span>
									<span class="bot-tag">
										<i class="fa-solid fa-check bot-check" aria-hidden="true"></i>
										APP
									</span>
									<span class="msg-time">
										Scheduled daily at {String(currentSettings?.stockDigestHourUtc ?? 14).padStart(
											2,
											'0'
										)}:00 UTC
									</span>
								</div>

								{#each digestPages as chunk, idx (idx)}
									<div class="discord-embed embed-digest">
										<div class="embed-content">
											<div class="embed-title-plain">
												📦 Seeker In-Stock Digest{#if digestPages.length > 1}
													(Part {idx + 1} of {digestPages.length}){/if}
											</div>
											{#if idx === 0}
												<div class="embed-desc">
													Found <strong>{digestEntries.length}</strong> matching card(s) in stock for
													you:
												</div>
											{/if}

											<div class="embed-fields-stack">
												{#each chunk as cardEntry (cardEntry.key)}
													<div class="discord-field full-width">
														<div class="discord-field-name">{cardEntry.fieldTitle}</div>
														<div class="discord-field-val">
															<div class="digest-meta-line">
																<code>{cardEntry.languageUpper}</code> &middot; {cardEntry.finishLabel}
															</div>
															{#each cardEntry.offers as offer (`${cardEntry.key}-${offer.vendorName}`)}
																<div>
																	&bull; <strong
																		><a
																			href={offer.url}
																			target="_blank"
																			rel="noopener noreferrer"
																			class="discord-link">{offer.vendorName}</a
																		></strong
																	>:
																	{#if offer.condition}<code>{offer.condition}</code>
																	{/if}<strong>{formatPrice(offer.priceCents)}</strong
																	>{#if offer.nativeText}
																		<em class="native-fx">{offer.nativeText}</em>{/if}
																</div>
															{/each}
														</div>
													</div>
												{/each}
											</div>

											<div class="embed-footer">
												<img src="/favicon.png" alt="" class="footer-icon" />
												<span>Seeker &middot; City of Traitors</span>
												<span>&bull;</span>
												<span
													>Today at {String(currentSettings?.stockDigestHourUtc ?? 14).padStart(
														2,
														'0'
													)}:00 UTC</span
												>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.preview-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(8, 10, 16, 0.74);
		backdrop-filter: blur(4px);
		z-index: 2500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.preview-modal {
		width: 100%;
		max-width: 820px;
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		background: #232428;
		color: #f2f3f5;
		border: 1px solid #3f4147;
		border-radius: 14px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
		overflow: hidden;
	}

	.preview-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: #1e1f22;
		border-bottom: 1px solid #3f4147;
	}

	.preview-title {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.discord-icon {
		font-size: 1.65rem;
		color: #5865f2;
	}

	.preview-title h2 {
		margin: 0;
		font-size: 1.08rem;
		color: #fff;
	}

	.preview-title p {
		margin: 0.15rem 0 0;
		font-size: 0.82rem;
		color: #b5bac1;
	}

	.close-btn {
		background: transparent;
		border: 1px solid #3f4147;
		color: #b5bac1;
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: #fff;
		border-color: #6d6f78;
	}

	.preview-tabs-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.65rem 1.25rem;
		background: #2b2d31;
		border-bottom: 1px solid #3f4147;
	}

	.preview-tabs {
		display: flex;
		gap: 0.5rem;
	}

	.preview-tabs button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.42rem 0.85rem;
		border-radius: 7px;
		border: 1px solid transparent;
		background: transparent;
		color: #b5bac1;
		font-weight: 600;
		font-size: 0.84rem;
		cursor: pointer;
	}

	.preview-tabs button.active {
		background: rgba(88, 101, 242, 0.22);
		border-color: rgba(88, 101, 242, 0.55);
		color: #fff;
	}

	.mode-switch {
		display: inline-flex;
		background: #1e1f22;
		border-radius: 7px;
		padding: 0.18rem;
		border: 1px solid #3f4147;
	}

	.mode-switch button {
		background: transparent;
		border: none;
		color: #949ba4;
		font-size: 0.76rem;
		font-weight: 600;
		padding: 0.28rem 0.6rem;
		border-radius: 5px;
		cursor: pointer;
	}

	.mode-switch button.selected {
		background: #3f4147;
		color: #fff;
	}

	.discord-chat-surface {
		padding: 1rem 1.25rem;
		background: #313338;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.paused-note {
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.4);
		color: #fcd34d;
		font-size: 0.84rem;
	}

	.paused-note a {
		color: #fff;
		font-weight: 600;
	}

	.empty-preview {
		text-align: center;
		padding: 2rem 1rem;
		color: #b5bac1;
	}

	.discord-message {
		display: flex;
		gap: 0.85rem;
		padding: 0.45rem;
		border-radius: 8px;
	}

	.discord-message.highlighted {
		background: rgba(88, 101, 242, 0.1);
	}

	.bot-avatar-img {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		object-fit: cover;
		background: #1e1f22;
		flex-shrink: 0;
	}

	.message-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.author-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.bot-name {
		font-weight: 600;
		color: #fff;
		font-size: 0.94rem;
	}

	.bot-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background: #5865f2;
		color: #fff;
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.08rem 0.34rem;
		border-radius: 3px;
		line-height: 1.2;
	}

	.bot-check {
		font-size: 0.56rem;
	}

	.msg-time {
		font-size: 0.74rem;
		color: #949ba4;
	}

	/* Discord Embed Theme Colors matching sendStockAlert & sendStockDigest */
	.discord-embed {
		background: #2b2d31;
		border-radius: 4px;
		border-left: 4px solid #2563eb;
		padding: 0.75rem 1rem 0.85rem;
		max-width: 560px;
	}

	.discord-embed.embed-restock {
		border-left-color: #2563eb;
	}

	.discord-embed.embed-drop {
		border-left-color: #10b981;
	}

	.discord-embed.embed-atl {
		border-left-color: #ff4500;
	}

	.discord-embed.embed-digest {
		border-left-color: #4f46e5;
	}

	.embed-content {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.embed-top-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.embed-main-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.embed-title-link,
	.embed-title-plain {
		font-size: 0.98rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.embed-title-link {
		color: #00a8fc;
		text-decoration: none;
	}

	.embed-title-link:hover {
		text-decoration: underline;
	}

	.embed-title-plain {
		color: #ffffff;
	}

	.embed-desc {
		font-size: 0.86rem;
		line-height: 1.4;
		color: #dbdee1;
	}

	.embed-desc s {
		color: #949ba4;
	}

	.discord-link {
		color: #00a8fc;
		text-decoration: none;
	}

	.discord-link:hover {
		text-decoration: underline;
	}

	.native-fx {
		font-style: italic;
		color: #b5bac1;
	}

	.embed-fields-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem 0.9rem;
		margin-top: 0.15rem;
	}

	.embed-fields-stack {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-top: 0.15rem;
	}

	.discord-field.full-width {
		grid-column: 1 / -1;
	}

	.discord-field-name {
		font-size: 0.8rem;
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 0.16rem;
	}

	.discord-field-val {
		font-size: 0.83rem;
		line-height: 1.42;
		color: #dbdee1;
	}

	.discord-field-val code {
		background: #1e1f22;
		color: #e3e5e8;
		padding: 0.08rem 0.32rem;
		border-radius: 3px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.78rem;
	}

	.digest-meta-line {
		margin-bottom: 0.15rem;
	}

	.embed-thumb {
		width: 80px;
		height: 112px;
		border-radius: 4px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.embed-footer {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.25rem;
		font-size: 0.74rem;
		color: #949ba4;
	}

	.footer-icon {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		object-fit: cover;
	}
</style>
