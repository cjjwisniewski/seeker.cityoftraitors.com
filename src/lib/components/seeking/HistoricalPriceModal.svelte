<script>
	import { focusTrap } from '$lib/actions/focusTrap';
	import { auth } from '$lib/stores/auth';
	import {
		getWebpImageUri,
		formatExactTimestamp,
		formatPrice,
		formatVendorDisplayName,
		formatRelativeTime
	} from '$lib/utils/seekingUtils';

	export let show = false;
	export let card = null;
	export let nowTick = Date.now();
	export let onClose = () => {};
	export let onEditCard = () => {};

	$: vendorKeys = $auth.user?.isAdmin
		? ['cardtrader', 'tcgplayer', 'manapool', 'cardkingdom', 'cardmarket', 'himarket', 'hareruya']
		: ['cardtrader', 'tcgplayer', 'manapool', 'cardkingdom', 'himarket', 'hareruya'];

	function buildSparklineData(history) {
		if (!Array.isArray(history) || history.length < 2) return null;
		const W = 440;
		const H = 96;
		const PAD_X = 8;
		const PAD_Y = 10;
		const allVals = [];
		for (const pt of history) {
			if (pt.nm_cents > 0) allVals.push(pt.nm_cents);
			if (pt.played_cents > 0) allVals.push(pt.played_cents);
		}
		if (allVals.length < 2) return null;
		const minVal = Math.min(...allVals);
		const maxVal = Math.max(...allVals);
		const span = Math.max(1, maxVal - minVal);
		const xFor = (i) =>
			history.length === 1
				? W / 2
				: PAD_X + (i / (history.length - 1)) * (W - PAD_X * 2);
		const yFor = (v) => PAD_Y + (1 - (v - minVal) / span) * (H - PAD_Y * 2);

		const nmPts = [];
		const plPts = [];
		history.forEach((pt, idx) => {
			const x = Number(xFor(idx).toFixed(1));
			if (pt.nm_cents > 0) {
				nmPts.push({ x, y: Number(yFor(pt.nm_cents).toFixed(1)), cents: pt.nm_cents, date: pt.date });
			}
			if (pt.played_cents > 0) {
				plPts.push({ x, y: Number(yFor(pt.played_cents).toFixed(1)), cents: pt.played_cents, date: pt.date });
			}
		});

		const toPath = (pts) =>
			pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

		return {
			width: W,
			height: H,
			minVal,
			maxVal,
			startDate: history[0].date,
			endDate: history[history.length - 1].date,
			nmPts,
			plPts,
			nmPath: nmPts.length >= 2 ? toPath(nmPts) : '',
			plPath: plPts.length >= 2 ? toPath(plPts) : ''
		};
	}

	$: sparkline = buildSparklineData(card?.historical_pricing?.history);
</script>

{#if show && card}
	{@const hp = card.historical_pricing}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={onClose}>
		<div class="modal-content hist-modal-content" use:focusTrap role="dialog" aria-modal="true" aria-label="Historical Price Intelligence" on:click|stopPropagation>
			<div class="modal-header">
				<div class="hist-modal-title-group">
					<h2>
						<i class="fa-solid fa-chart-line"></i>
						Historical Price Intelligence
					</h2>
					{#if hp}
						<span class="hist-status-pill" class:calibrated={hp.is_calibrated}>
							<i class="fa-solid {hp.is_calibrated ? 'fa-shield-halved' : 'fa-hourglass-half'}"></i>
							{hp.is_calibrated ? 'Verified Baseline' : 'Initial 48h Baseline Sweep'}
						</span>
					{/if}
				</div>
				<button class="close-modal-btn" aria-label="Close modal" on:click={onClose}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>

			<div class="modal-body">
				<div class="card-details-mini">
					<img src={getWebpImageUri(card.image_uri)} alt={card.name} />
					<div>
						<h3>{card.name}</h3>
						<p>
							{card.set_code.toUpperCase()} #{card.collector_number}
							• {card.language.toUpperCase()}
							• {card.finish.toLowerCase() === 'foil'
								? '✦ Foil'
								: card.finish.toLowerCase() === 'etched'
									? '◈ Etched'
									: 'Nonfoil'}
						</p>
						{#if hp?.first_observed_at}
							<span class="hist-tracked-since">
								Tracked since {formatExactTimestamp(hp.first_observed_at)} ({hp.observation_count || 1} observation{hp.observation_count === 1 ? '' : 's'})
							</span>
						{/if}
					</div>
				</div>

				{#if !hp || (!hp.nm_low_cents && !hp.played_low_cents && !hp.last_seen_cents)}
					<div class="hist-empty-box">
						<i class="fa-solid fa-satellite-dish"></i>
						<h4>No Verified In-Stock History Yet</h4>
						<p>
							This printing has not yet been observed in stock on a catalog-verified marketplace (CardTrader, TCGPlayer, Mana Pool, Card Kingdom, HiMarket, or Hareruya). As soon as a copy appears during any user's scan, Seeker will permanently record its price and date here.
						</p>
					</div>
				{:else}
					<div class="hist-tiers-grid">
						<div class="hist-tier-card clean-tier">
							<div class="hist-tier-header">
								<span class="hist-tier-title">Clean Tier (NM / LP)</span>
								<span class="hist-tier-sub">Near Mint &amp; Lightly Played</span>
							</div>
							{#if hp.nm_low_cents > 0}
								<div class="hist-tier-main-price">
									{formatPrice(hp.nm_low_cents)}
									{#if hp.nm_low_condition}
										<span class="condition-bubble cond-{hp.nm_low_condition.toLowerCase()}">
											{hp.nm_low_condition}
										</span>
									{/if}
								</div>
								<div class="hist-tier-meta">
									<span>
										Floor on <strong>{formatVendorDisplayName(hp.nm_low_vendor)}</strong>
									</span>
									{#if hp.nm_low_at}
										<span>• {formatRelativeTime(hp.nm_low_at, nowTick) || 'Recently'}</span>
									{/if}
								</div>
								{#if hp.nm_last_seen_cents > 0}
									<div class="hist-tier-foot">
										Last seen: <strong>{formatPrice(hp.nm_last_seen_cents)}</strong> ({hp.nm_last_seen_condition || 'NM'} on {formatVendorDisplayName(hp.nm_last_seen_vendor)}, {formatRelativeTime(hp.nm_last_seen_at, nowTick) || 'Recently'})
									</div>
								{/if}
							{:else}
								<div class="hist-tier-empty">No NM/LP copies recorded yet</div>
							{/if}
						</div>

						<div class="hist-tier-card played-tier">
							<div class="hist-tier-header">
								<span class="hist-tier-title">Played Tier (MP / HP)</span>
								<span class="hist-tier-sub">Moderately &amp; Heavily Played</span>
							</div>
							{#if hp.played_low_cents > 0}
								<div class="hist-tier-main-price">
									{formatPrice(hp.played_low_cents)}
									{#if hp.played_low_condition}
										<span class="condition-bubble cond-{hp.played_low_condition.toLowerCase()}">
											{hp.played_low_condition}
										</span>
									{/if}
								</div>
								<div class="hist-tier-meta">
									<span>
										Floor on <strong>{formatVendorDisplayName(hp.played_low_vendor)}</strong>
									</span>
									{#if hp.played_low_at}
										<span>• {formatRelativeTime(hp.played_low_at, nowTick) || 'Recently'}</span>
									{/if}
								</div>
								{#if hp.played_last_seen_cents > 0}
									<div class="hist-tier-foot">
										Last seen: <strong>{formatPrice(hp.played_last_seen_cents)}</strong> ({hp.played_last_seen_condition || 'MP'} on {formatVendorDisplayName(hp.played_last_seen_vendor)}, {formatRelativeTime(hp.played_last_seen_at, nowTick) || 'Recently'})
									</div>
								{/if}
							{:else}
								<div class="hist-tier-empty">No MP/HP copies recorded yet</div>
							{/if}
						</div>
					</div>

					{#if sparkline}
						<div class="hist-sparkline-section">
							<div class="hist-sparkline-header">
								<span class="hist-sparkline-title">
									<i class="fa-solid fa-wave-square"></i>
									Observed Floor Trend
								</span>
								<div class="hist-sparkline-legend">
									{#if sparkline.nmPts.length >= 2}
										<span class="legend-item nm"><span class="legend-dot"></span>NM/LP</span>
									{/if}
									{#if sparkline.plPts.length >= 2}
										<span class="legend-item pl"><span class="legend-dot"></span>Played</span>
									{/if}
									<span class="legend-range">{formatPrice(sparkline.minVal)} – {formatPrice(sparkline.maxVal)}</span>
								</div>
							</div>
							<svg
								class="hist-sparkline-svg"
								viewBox="0 0 {sparkline.width} {sparkline.height}"
								preserveAspectRatio="none"
								role="img"
								aria-label="Historical floor price trend from {sparkline.startDate} to {sparkline.endDate}"
							>
								{#if sparkline.plPath}
									<path d={sparkline.plPath} fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
								{/if}
								{#if sparkline.nmPath}
									<path d={sparkline.nmPath} fill="none" stroke="#10b981" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
								{/if}
								{#each sparkline.plPts as pt}
									<circle cx={pt.x} cy={pt.y} r="3" fill="#f59e0b">
										<title>{pt.date}: Played {formatPrice(pt.cents)}</title>
									</circle>
								{/each}
								{#each sparkline.nmPts as pt}
									<circle cx={pt.x} cy={pt.y} r="3" fill="#10b981">
										<title>{pt.date}: NM/LP {formatPrice(pt.cents)}</title>
									</circle>
								{/each}
							</svg>
							<div class="hist-sparkline-dates">
								<span>{sparkline.startDate}</span>
								<span>{sparkline.endDate}</span>
							</div>
						</div>
					{/if}

					{#if hp.vendor_lows && Object.keys(hp.vendor_lows).length > 0}
						<div class="hist-vendors-section">
							<h4>Verified Marketplace History</h4>
							<div class="hist-vendors-list">
								{#each vendorKeys as vKey}
									{@const vData = hp.vendor_lows[vKey]}
									{#if vData && vData.low_cents > 0}
										<div class="hist-vendor-row">
											<span class="hist-vendor-name">{formatVendorDisplayName(vKey)}</span>
											<div class="hist-vendor-stats">
												<span class="hist-vendor-stat">
													Floor: <strong>{formatPrice(vData.low_cents)}</strong>
													{#if vData.low_cond}
														<small>[{vData.low_cond}]</small>
													{/if}
												</span>
												{#if vData.last_cents > 0}
													<span class="hist-vendor-stat muted">
														Last: {formatPrice(vData.last_cents)} ({formatRelativeTime(vData.last_at, nowTick) || 'Recently'})
													</span>
												{/if}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<div class="hist-footnote">
					<i class="fa-solid fa-circle-info"></i>
					<span>
						Out-of-stock scarce cards never lose their historical memory. Only deterministic catalog stores contribute to floors (eBay &amp; Ruten are excluded to prevent keyword noise).
					</span>
				</div>
			</div>

			<div class="modal-footer">
				<button
					type="button"
					class="modal-btn secondary"
					on:click={() => {
						const target = card;
						onClose();
						onEditCard(target);
					}}
				>
					<i class="fa-solid fa-sliders"></i> Edit Card Settings
				</button>
				<button type="button" class="modal-btn primary" on:click={onClose}>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.85);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		box-sizing: border-box;
		animation: fadeIn 0.3s ease;
	}

	.modal-content {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		width: 100%;
		max-width: 560px;
		max-height: calc(100vh - 1.5rem);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 1.35rem;
		box-shadow: var(--shadow-lg);
		animation: scaleIn 0.3s ease-out;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 1rem;
	}

	.hist-modal-title-group {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.hist-modal-title-group h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.15rem;
		margin: 0;
		color: var(--color-text-primary);
	}

	.hist-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.35);
		color: #fcd34d;
	}

	.hist-status-pill.calibrated {
		background: rgba(16, 185, 129, 0.14);
		border-color: rgba(16, 185, 129, 0.38);
		color: #6ee7b7;
	}

	.close-modal-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0.5rem;
	}

	.card-details-mini {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 8px;
	}

	.card-details-mini img {
		width: 60px;
		height: auto;
		border-radius: 4px;
	}

	.card-details-mini h3 {
		margin: 0;
		font-size: 1.1rem;
	}

	.card-details-mini p {
		margin: 0.25rem 0 0 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.hist-tracked-since {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.2rem;
	}

	.hist-tiers-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.hist-tier-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.hist-tier-header {
		display: flex;
		flex-direction: column;
	}

	.hist-tier-title {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.hist-tier-sub {
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.hist-tier-main-price {
		font-size: 1.35rem;
		font-weight: 800;
		color: #34d399;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.2rem;
	}

	.hist-tier-meta {
		font-size: 0.78rem;
		color: var(--color-text-secondary);
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.hist-tier-foot {
		margin-top: 0.25rem;
		padding-top: 0.35rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.73rem;
		color: var(--color-text-muted);
	}

	.hist-tier-empty {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		padding: 0.65rem 0;
		font-style: italic;
	}

	.hist-sparkline-section {
		margin-top: 1rem;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
	}

	.hist-sparkline-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.45rem;
		font-size: 0.78rem;
	}

	.hist-sparkline-title {
		font-weight: 600;
		color: var(--color-text-primary);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.hist-sparkline-legend {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		color: var(--color-text-secondary);
		font-size: 0.74rem;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.legend-dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		display: inline-block;
	}

	.legend-item.nm .legend-dot {
		background: #10b981;
	}

	.legend-item.pl .legend-dot {
		background: #f59e0b;
	}

	.hist-sparkline-svg {
		width: 100%;
		height: 92px;
		display: block;
		overflow: visible;
	}

	.hist-sparkline-dates {
		display: flex;
		justify-content: space-between;
		margin-top: 0.25rem;
		font-size: 0.72rem;
		color: var(--color-text-muted);
	}

	.hist-vendors-section {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
		margin-bottom: 0.9rem;
	}

	.hist-vendors-section h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.hist-vendors-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.hist-vendor-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.82rem;
		padding: 0.3rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.hist-vendor-row:last-child {
		border-bottom: none;
	}

	.hist-vendor-name {
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.hist-vendor-stats {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.hist-vendor-stat.muted {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.hist-empty-box {
		text-align: center;
		padding: 1.5rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px dashed var(--color-border);
		border-radius: 10px;
		margin-bottom: 0.9rem;
	}

	.hist-empty-box h4 {
		margin: 0.4rem 0;
		font-size: 0.95rem;
	}

	.hist-empty-box p {
		margin: 0;
		font-size: 0.82rem;
		color: var(--color-text-secondary);
		line-height: 1.45;
	}

	.hist-footnote {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		line-height: 1.4;
		background: rgba(255, 255, 255, 0.02);
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
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

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2rem;
		border-top: 1px solid var(--color-border);
		padding-top: 1.5rem;
	}

	.modal-btn {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 600;
		transition: all 0.2s;
	}

	.modal-btn.primary {
		background-color: var(--color-primary);
		color: white;
		border: none;
	}

	.modal-btn.primary:hover:not(:disabled) {
		background-color: var(--color-primary-dark, #0056b3);
		transform: translateY(-1px);
	}

	.modal-btn.secondary {
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
	}

	.modal-btn.secondary:hover {
		background-color: var(--color-bg-hover);
	}

	@media (max-width: 580px) {
		.hist-tiers-grid {
			grid-template-columns: 1fr;
		}
		.modal-footer {
			margin-top: 1.25rem;
			padding-top: 1rem;
			gap: 0.6rem;
		}
		.modal-btn {
			flex: 1;
			min-height: 44px;
			padding: 0.7rem 1rem;
			text-align: center;
		}
	}
</style>
