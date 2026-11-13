<script lang="ts">
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
		formatRelativeTime,
		getWebpImageUri,
		sanitizeExternalUrl
	} from '$lib/utils/seekingUtils';

	let activeTab: 'alerts' | 'digest' = 'alerts';

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && $demoAlertModalOpen) {
			closeDemoAlertPreviews();
		}
	}

	function getEmbedTitle(kind: DemoAlertPreview['kind']): string {
		switch (kind) {
			case 'restock':
				return 'In Stock Alert';
			case 'price_drop':
				return 'Price Drop Alert';
			case 'historical_low':
				return 'New Historical Low';
		}
	}

	function getEmbedBadgeClass(kind: DemoAlertPreview['kind']): string {
		switch (kind) {
			case 'restock':
				return 'embed-restock';
			case 'price_drop':
				return 'embed-drop';
			case 'historical_low':
				return 'embed-atl';
		}
	}

	function finishBadge(finish: string): string {
		if (finish === 'foil') return 'Foil';
		if (finish === 'etched') return 'Etched';
		return 'Nonfoil';
	}

	interface DigestGroup {
		vendor: string;
		vendorLabel: string;
		entries: Array<{
			name: string;
			setCode: string;
			collectorNumber: string;
			language: string;
			finish: string;
			priceCents: number;
			condition: string;
			buyUrl: string;
		}>;
	}

	function buildDigestPreview(cards: DemoCardRecord[], settings: DemoUserSettings): DigestGroup[] {
		const vendorDefs: Array<{
			key: string;
			label: string;
			enabled: boolean;
			getOffer: (c: DemoCardRecord) => { price: number | null; stock: boolean; cond: string | null; url: string };
		}> = [
			{
				key: 'cardtrader',
				label: 'CardTrader',
				enabled: settings.marketplaceCardtraderEnabled,
				getOffer: (c) => ({
					stock: c.cardtrader_stock,
					price: c.cardtrader_low_price,
					cond: c.cardtrader_condition,
					url: `https://www.cardtrader.com/cards?search=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'tcgplayer',
				label: 'TCGPlayer',
				enabled: settings.marketplaceTcgplayerEnabled,
				getOffer: (c) => ({
					stock: c.tcgplayer_stock,
					price: c.tcgplayer_low_price,
					cond: c.tcgplayer_condition,
					url: c.tcgplayer_id
						? `https://www.tcgplayer.com/product/${encodeURIComponent(String(c.tcgplayer_id))}`
						: `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'manapool',
				label: 'ManaPool',
				enabled: settings.marketplaceManapoolEnabled,
				getOffer: (c) => ({
					stock: c.manapool_stock,
					price: c.manapool_low_price,
					cond: c.manapool_condition,
					url: c.manapool_url || `https://manapool.com/cards?q=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'hareruya',
				label: 'Hareruya',
				enabled: settings.marketplaceHareruyaEnabled,
				getOffer: (c) => ({
					stock: c.hareruya_stock,
					price: c.hareruya_low_price,
					cond: c.hareruya_condition,
					url:
						c.hareruya_url ||
						`https://www.hareruyamtg.com/en/products/search?product=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'himarket',
				label: 'HiMarket',
				enabled: settings.marketplaceHimarketEnabled,
				getOffer: (c) => ({
					stock: c.himarket_stock,
					price: c.himarket_low_price,
					cond: c.himarket_condition,
					url: c.himarket_url || `https://www.himarket.hk/search?q=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'ruten',
				label: 'Ruten',
				enabled: settings.marketplaceRutenEnabled,
				getOffer: (c) => ({
					stock: c.ruten_stock,
					price: c.ruten_low_price,
					cond: c.ruten_condition,
					url: c.ruten_url || `https://www.ruten.com.tw/find/?q=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'cardkingdom',
				label: 'Card Kingdom',
				enabled: settings.marketplaceCardkingdomEnabled,
				getOffer: (c) => ({
					stock: c.cardkingdom_stock,
					price: c.cardkingdom_low_price,
					cond: c.cardkingdom_condition,
					url:
						c.cardkingdom_url ||
						`https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${encodeURIComponent(c.name)}`
				})
			},
			{
				key: 'ebay',
				label: 'eBay',
				enabled: settings.marketplaceEbayEnabled,
				getOffer: (c) => ({
					stock: c.ebay_stock,
					price: c.ebay_low_price,
					cond: c.ebay_condition,
					url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(c.name)}&_sop=15`
				})
			}
		];

		const groups: DigestGroup[] = [];
		for (const def of vendorDefs) {
			if (!def.enabled) continue;
			const entries: DigestGroup['entries'] = [];
			for (const card of cards) {
				if (def.key === 'ruten' && !['zht', 'en'].includes(card.language.toLowerCase())) {
					continue;
				}
				const offer = def.getOffer(card);
				if (!offer.stock || !offer.price || offer.price <= 0) continue;
				if (card.max_price_cap !== null && offer.price > card.max_price_cap) continue;
				const safeUrl = sanitizeExternalUrl(offer.url, '');
				if (!safeUrl) continue;
				entries.push({
					name: card.name,
					setCode: card.set_code,
					collectorNumber: card.collector_number,
					language: card.language,
					finish: card.finish,
					priceCents: offer.price,
					condition: offer.cond || 'NM',
					buyUrl: safeUrl
				});
			}
			if (entries.length > 0) {
				groups.push({ vendor: def.key, vendorLabel: def.label, entries: entries.slice(0, 6) });
			}
		}
		return groups;
	}

	$: orderedAlerts = $demoSelectedAlertId
		? [
				...$demoAlertsStore.filter((a) => a.id === $demoSelectedAlertId),
				...$demoAlertsStore.filter((a) => a.id !== $demoSelectedAlertId)
			]
		: $demoAlertsStore;

	$: currentSettings = $demoAlertModalOpen && $auth.isDemo ? loadDemoSettings() : null;
	$: digestGroups =
		$demoAlertModalOpen && $auth.isDemo && currentSettings
			? buildDigestPreview(loadDemoCards(), currentSettings)
			: [];
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
		<div class="preview-modal">
			<div class="preview-header">
				<div class="preview-title">
					<i class="fa-brands fa-discord discord-icon" aria-hidden="true"></i>
					<div>
						<h2>Simulated Discord DM Previews</h2>
						<p>Rendered directly from your demo watchlist, price caps, and Account alert preferences.</p>
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

			<div class="preview-tabs" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'alerts'}
					class:active={activeTab === 'alerts'}
					on:click={() => (activeTab = 'alerts')}
				>
					<i class="fa-solid fa-bolt" aria-hidden="true"></i>
					Instant DM Alerts ({orderedAlerts.length})
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'digest'}
					class:active={activeTab === 'digest'}
					on:click={() => (activeTab = 'digest')}
				>
					<i class="fa-solid fa-layer-group" aria-hidden="true"></i>
					Daily Stock Digest ({digestGroups.reduce((acc, g) => acc + g.entries.length, 0)})
				</button>
			</div>

			<div class="discord-chat-surface">
				{#if activeTab === 'alerts'}
					{#if currentSettings && !currentSettings.stockAlertEnabled}
						<div class="paused-note">
							Instant stock alerts are currently toggled OFF in your <a href="/account" on:click={closeDemoAlertPreviews}>Account Settings</a>. Historical samples triggered before pausing remain below.
						</div>
					{/if}
					{#if orderedAlerts.length === 0}
						<div class="empty-preview">
							No simulated DM alerts recorded yet. Trigger a manual stock check on any card or adjust a Price Cap to generate a live preview.
						</div>
					{:else}
						{#each orderedAlerts as alert (alert.id)}
							{@const safeThumb = sanitizeExternalUrl(getWebpImageUri(alert.imageUri) || alert.imageUri, '')}
							{@const safeBuyUrl = sanitizeExternalUrl(alert.buyUrl, '')}
							<div class="discord-message" class:highlighted={alert.id === $demoSelectedAlertId}>
								<div class="bot-avatar" aria-hidden="true">S</div>
								<div class="message-body">
									<div class="author-row">
										<span class="bot-name">Seeker</span>
										<span class="bot-tag">APP</span>
										<span class="msg-time">{formatRelativeTime(alert.createdAt) || 'Just now'}</span>
									</div>

									<div class="discord-embed {getEmbedBadgeClass(alert.kind)}">
										<div class="embed-main">
											<div class="embed-kicker">{getEmbedTitle(alert.kind)}</div>
											<div class="embed-card-title">
												{alert.cardName} ({alert.setCode.toUpperCase()} #{alert.collectorNumber})
											</div>
											<div class="embed-meta">
												{alert.language.toUpperCase()} &bull; {finishBadge(alert.finish)} &bull; {alert.vendorDisplayName}
											</div>

											<div class="embed-fields">
												<div class="embed-field">
													<span class="field-label">Price</span>
													<span class="field-value price">{formatPrice(alert.priceCents)}</span>
												</div>
												<div class="embed-field">
													<span class="field-label">Condition</span>
													<span class="field-value">{alert.condition}</span>
												</div>
												{#if alert.priceCapCents}
													<div class="embed-field">
														<span class="field-label">Your Cap</span>
														<span class="field-value">{formatPrice(alert.priceCapCents)}</span>
													</div>
												{/if}
												{#if alert.kind === 'price_drop' && alert.oldPriceCents}
													<div class="embed-field">
														<span class="field-label">Drop</span>
														<span class="field-value drop">
															-{alert.percentageDrop}% (was {formatPrice(alert.oldPriceCents)})
														</span>
													</div>
												{:else if alert.kind === 'historical_low' && alert.historicalLowCents}
													<div class="embed-field">
														<span class="field-label">Prior Low</span>
														<span class="field-value atl">{formatPrice(alert.historicalLowCents)}</span>
													</div>
												{/if}
											</div>

											{#if safeBuyUrl}
												<a
													href={safeBuyUrl}
													target="_blank"
													rel="noopener noreferrer"
													class="embed-link"
												>
													View {alert.vendorDisplayName} Listing
													<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
												</a>
											{/if}
										</div>

										{#if safeThumb}
											<img src={safeThumb} alt={alert.cardName} class="embed-thumb" />
										{/if}
									</div>
								</div>
							</div>
						{/each}
					{/if}
				{:else}
					{#if currentSettings && !currentSettings.stockDigestEnabled}
						<div class="paused-note">
							Scheduled Stock Digests are currently disabled in your <a href="/account" on:click={closeDemoAlertPreviews}>Account Settings</a>. Enable the toggle to schedule at {String(currentSettings.stockDigestHourUtc).padStart(2, '0')}:00 UTC.
						</div>
					{/if}
					{#if digestGroups.length === 0}
						<div class="empty-preview">
							No currently enabled marketplaces match your demo watchlist & price caps. Enable marketplaces in Account or raise a card cap!
						</div>
					{:else}
						<div class="discord-message">
							<div class="bot-avatar" aria-hidden="true">S</div>
							<div class="message-body">
								<div class="author-row">
									<span class="bot-name">Seeker</span>
									<span class="bot-tag">APP</span>
									<span class="msg-time">
										Scheduled daily at {String(currentSettings?.stockDigestHourUtc ?? 14).padStart(2, '0')}:00 UTC
									</span>
								</div>

								{#each digestGroups as group (group.vendor)}
									<div class="discord-embed embed-digest">
										<div class="embed-main">
											<div class="embed-kicker">{group.vendorLabel} &mdash; Stock Digest ({group.entries.length} matches)</div>
											<ul class="digest-list">
												{#each group.entries as entry (`${group.vendor}-${entry.name}-${entry.setCode}-${entry.collectorNumber}-${entry.language}-${entry.finish}`)}
													<li>
														<a href={entry.buyUrl} target="_blank" rel="noopener noreferrer" class="digest-card-link">
															{entry.name} [{entry.setCode.toUpperCase()} #{entry.collectorNumber} {entry.language.toUpperCase()} {finishBadge(entry.finish)}]
														</a>
														<span class="digest-price">
															&mdash; {formatPrice(entry.priceCents)} ({entry.condition})
														</span>
													</li>
												{/each}
											</ul>
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
		background: rgba(8, 10, 16, 0.72);
		backdrop-filter: blur(4px);
		z-index: 2500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.preview-modal {
		width: 100%;
		max-width: 780px;
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
		font-size: 1.1rem;
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

	.preview-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		background: #2b2d31;
		border-bottom: 1px solid #3f4147;
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
		font-size: 0.85rem;
		cursor: pointer;
	}

	.preview-tabs button.active {
		background: rgba(88, 101, 242, 0.22);
		border-color: rgba(88, 101, 242, 0.55);
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

	.bot-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: linear-gradient(135deg, #5865f2, #10b981);
		color: #fff;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.message-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.author-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.bot-name {
		font-weight: 700;
		color: #fff;
		font-size: 0.92rem;
	}

	.bot-tag {
		background: #5865f2;
		color: #fff;
		font-size: 0.64rem;
		font-weight: 700;
		padding: 0.08rem 0.34rem;
		border-radius: 4px;
	}

	.msg-time {
		font-size: 0.74rem;
		color: #949ba4;
	}

	.discord-embed {
		background: #2b2d31;
		border-radius: 6px;
		border-left: 4px solid #2ecc71;
		padding: 0.8rem 0.95rem;
		display: flex;
		justify-content: space-between;
		gap: 0.85rem;
	}

	.discord-embed.embed-drop {
		border-left-color: #3498db;
	}

	.discord-embed.embed-atl {
		border-left-color: #f39c12;
	}

	.discord-embed.embed-digest {
		border-left-color: #5865f2;
	}

	.embed-main {
		flex: 1;
		min-width: 0;
	}

	.embed-kicker {
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #b5bac1;
		margin-bottom: 0.25rem;
	}

	.embed-card-title {
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
	}

	.embed-meta {
		font-size: 0.82rem;
		color: #b5bac1;
		margin-top: 0.15rem;
	}

	.embed-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 0.65rem;
	}

	.embed-field {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.field-label {
		font-size: 0.72rem;
		color: #949ba4;
		font-weight: 600;
	}

	.field-value {
		font-size: 0.88rem;
		font-weight: 700;
		color: #f2f3f5;
	}

	.field-value.price {
		color: #57f287;
	}

	.field-value.drop {
		color: #60a5fa;
	}

	.field-value.atl {
		color: #fbbf24;
	}

	.embed-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.65rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: #00a8fc;
		text-decoration: none;
	}

	.embed-link:hover {
		text-decoration: underline;
	}

	.embed-thumb {
		width: 66px;
		height: 92px;
		border-radius: 5px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.digest-list {
		margin: 0.45rem 0 0;
		padding-left: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.32rem;
		font-size: 0.84rem;
	}

	.digest-card-link {
		color: #00a8fc;
		text-decoration: none;
		font-weight: 600;
	}

	.digest-card-link:hover {
		text-decoration: underline;
	}

	.digest-price {
		color: #dbdee1;
	}
</style>
