<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	const handleOpenImport = () => {
		dispatch('openImport');
	};
</script>

<div class="empty-seeking-container">
	<div class="hero-badge">
		<i class="fa-solid fa-satellite-dish"></i>
	</div>

	<h2 class="hero-title">Your Seeking List is Empty</h2>
	<p class="hero-subtitle">
		Seeker monitors major domestic and international marketplaces around the clock and delivers
		instant Discord restock alerts with direct buy links when your cards become available below your
		target price.
	</p>

	<!-- Primary Action Cards -->
	<div class="action-cards-grid">
		<button type="button" class="action-card primary-action" on:click={handleOpenImport}>
			<div class="action-icon-wrap primary-icon">
				<i class="fa-solid fa-file-import"></i>
			</div>
			<div class="action-content">
				<div class="action-header">
					<span class="action-title">Import Decklist</span>
					<span class="action-pill">Recommended</span>
				</div>
				<p class="action-desc">
					Paste a Moxfield deck URL or raw card list to track 50–100+ cards in a single click.
				</p>
			</div>
			<div class="action-arrow">
				<i class="fa-solid fa-arrow-right"></i>
			</div>
		</button>

		<a href="/" class="action-card secondary-action">
			<div class="action-icon-wrap secondary-icon">
				<i class="fa-solid fa-magnifying-glass"></i>
			</div>
			<div class="action-content">
				<div class="action-header">
					<span class="action-title">Search & Add Cards</span>
				</div>
				<p class="action-desc">
					Find singles by name, set edition, and language with exact condition and finish targeting.
				</p>
			</div>
			<div class="action-arrow">
				<i class="fa-solid fa-arrow-right"></i>
			</div>
		</a>
	</div>

	<!-- 3-Step "How Seeker Works" Explainer -->
	<div class="steps-section">
		<h3 class="steps-heading">How Seeker Works</h3>
		<div class="steps-grid">
			<div class="step-item">
				<div class="step-badge">1</div>
				<div class="step-icon">
					<i class="fa-solid fa-list-check"></i>
				</div>
				<h4>Add Your Targets</h4>
				<p>
					Configure desired finish, language, and price cap. Override condition thresholds per card
					at any time.
				</p>
			</div>

			<div class="step-divider" aria-hidden="true">
				<i class="fa-solid fa-chevron-right"></i>
			</div>

			<div class="step-item">
				<div class="step-badge">2</div>
				<div class="step-icon">
					<i class="fa-solid fa-arrows-rotate"></i>
				</div>
				<h4>Automated Sweeps</h4>
				<p>
					Seeker continuously polls supported domestic and international marketplaces around the
					clock.
				</p>
			</div>

			<div class="step-divider" aria-hidden="true">
				<i class="fa-solid fa-chevron-right"></i>
			</div>

			<div class="step-item">
				<div class="step-badge">3</div>
				<div class="step-icon discord-icon">
					<i class="fa-brands fa-discord"></i>
				</div>
				<h4>Discord Alerts</h4>
				<p>Receive grouped DMs with direct purchase links and all-time floor intelligence.</p>
			</div>
		</div>
	</div>

	<!-- Marketplace & Condition Settings Callout -->
	<div class="preferences-settings-callout">
		<div class="callout-icon-wrap">
			<i class="fa-solid fa-sliders"></i>
		</div>
		<div class="callout-content">
			<div class="callout-title">Customize Marketplaces & Condition Filters</div>
			<p class="callout-desc">
				Core stores are active by default. You can enable additional domestic and international
				marketplaces, as well as set your global minimum card condition threshold (e.g. Near Mint or
				Lightly Played), in your account settings.
			</p>
		</div>
		<a href="/account" class="callout-btn">
			<span>Account Settings</span>
			<i class="fa-solid fa-arrow-right"></i>
		</a>
	</div>

	<!-- Discord DM Status Tip -->
	<div class="discord-tip">
		<div class="discord-tip-icon-wrap">
			<i class="fa-brands fa-discord"></i>
		</div>
		<div class="discord-tip-text">
			<strong>Discord Restock Delivery:</strong> Alerts are delivered directly to your Discord account.
			Ensure your server direct messages are enabled to receive instant alerts!
		</div>
	</div>
</div>

<style>
	.empty-seeking-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3rem 1.5rem 3.5rem 1.5rem;
		max-width: 820px;
		margin: 1.5rem auto 3rem auto;
		background: var(--glass-bg, rgba(255, 255, 255, 0.03));
		backdrop-filter: blur(var(--backdrop-blur, 10px));
		border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
		border-radius: 16px;
		box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
		text-align: center;
		animation: fadeIn 0.4s ease-out;
	}

	.hero-badge {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(59, 130, 246, 0.3));
		color: var(--color-primary, #3b82f6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.85rem;
		margin-bottom: 1.25rem;
		border: 1px solid var(--color-primary-alpha, rgba(37, 99, 235, 0.3));
		box-shadow: 0 0 24px rgba(37, 99, 235, 0.2);
	}

	.hero-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text-primary, #f1f5f9);
		margin: 0 0 0.65rem 0;
		letter-spacing: -0.02em;
	}

	.hero-subtitle {
		font-size: 1rem;
		color: var(--color-text-secondary, #94a3b8);
		max-width: 620px;
		line-height: 1.6;
		margin: 0 0 2rem 0;
	}

	/* Action Cards Grid */
	.action-cards-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
		width: 100%;
		margin-bottom: 2.25rem;
	}

	.action-card {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 1.35rem;
		background: var(--color-bg-secondary, #1e293b);
		border: 1px solid var(--color-border, #334155);
		border-radius: 12px;
		text-align: left;
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		transition:
			transform var(--transition-fast, 0.15s ease),
			border-color var(--transition-fast, 0.15s ease),
			box-shadow var(--transition-fast, 0.15s ease);
		position: relative;
		overflow: hidden;
	}

	.action-card:hover {
		transform: translateY(-2px);
		border-color: var(--color-primary, #3b82f6);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
	}

	.action-card.primary-action {
		background: linear-gradient(
			145deg,
			var(--color-bg-secondary, #1e293b),
			rgba(37, 99, 235, 0.08)
		);
		border-color: rgba(59, 130, 246, 0.4);
	}

	.action-card.primary-action:hover {
		border-color: var(--color-primary, #3b82f6);
		box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25);
	}

	.action-icon-wrap {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.35rem;
		flex-shrink: 0;
	}

	.action-icon-wrap.primary-icon {
		background: rgba(37, 99, 235, 0.18);
		color: var(--color-primary, #3b82f6);
	}

	.action-icon-wrap.secondary-icon {
		background: rgba(148, 163, 184, 0.12);
		color: var(--color-text-secondary, #94a3b8);
	}

	.action-content {
		flex: 1;
		min-width: 0;
	}

	.action-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.35rem;
	}

	.action-title {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-text-primary, #f1f5f9);
	}

	.action-pill {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: rgba(37, 99, 235, 0.2);
		color: var(--color-primary, #3b82f6);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.action-desc {
		font-size: 0.85rem;
		color: var(--color-text-secondary, #94a3b8);
		margin: 0;
		line-height: 1.45;
	}

	.action-arrow {
		color: var(--color-text-muted, #64748b);
		font-size: 0.95rem;
		transition:
			transform var(--transition-fast, 0.15s ease),
			color var(--transition-fast, 0.15s ease);
		flex-shrink: 0;
	}

	.action-card:hover .action-arrow {
		transform: translateX(4px);
		color: var(--color-primary, #3b82f6);
	}

	/* Steps Section */
	.steps-section {
		width: 100%;
		padding-top: 1.75rem;
		border-top: 1px solid var(--color-border, #334155);
		margin-bottom: 1.75rem;
	}

	.steps-heading {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-muted, #64748b);
		margin: 0 0 1.5rem 0;
	}

	.steps-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
	}

	.step-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1rem 0.75rem;
		background: rgba(0, 0, 0, 0.15);
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.04);
		position: relative;
	}

	.step-badge {
		position: absolute;
		top: -10px;
		left: 12px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--color-bg-secondary, #1e293b);
		border: 1px solid var(--color-border, #334155);
		color: var(--color-primary, #3b82f6);
		font-size: 0.7rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step-icon {
		font-size: 1.35rem;
		color: var(--color-text-secondary, #94a3b8);
		margin-bottom: 0.65rem;
	}

	.step-icon.discord-icon {
		color: #5865f2;
	}

	.step-item h4 {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-primary, #f1f5f9);
		margin: 0 0 0.35rem 0;
	}

	.step-item p {
		font-size: 0.8rem;
		color: var(--color-text-secondary, #94a3b8);
		margin: 0;
		line-height: 1.4;
	}

	.step-divider {
		color: var(--color-text-muted, #64748b);
		font-size: 0.85rem;
		opacity: 0.5;
	}

	/* Preferences (Marketplaces & Condition) Settings Callout */
	.preferences-settings-callout {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 1rem 1.25rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--color-border, #334155);
		border-radius: 12px;
		text-align: left;
		margin-bottom: 1.25rem;
		transition: border-color var(--transition-fast, 0.15s ease);
	}

	.preferences-settings-callout:hover {
		border-color: var(--color-primary, #3b82f6);
	}

	.preferences-settings-callout .callout-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: rgba(59, 130, 246, 0.15);
		color: var(--color-primary, #3b82f6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.15rem;
		flex-shrink: 0;
	}

	.preferences-settings-callout .callout-content {
		flex: 1;
		min-width: 0;
	}

	.preferences-settings-callout .callout-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text-primary, #f1f5f9);
		margin-bottom: 0.2rem;
	}

	.preferences-settings-callout .callout-desc {
		font-size: 0.825rem;
		color: var(--color-text-secondary, #94a3b8);
		margin: 0;
		line-height: 1.45;
	}

	.preferences-settings-callout .callout-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.95rem;
		background: var(--color-bg-secondary, #1e293b);
		border: 1px solid var(--color-border, #334155);
		border-radius: 8px;
		color: var(--color-text-primary, #f1f5f9);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		flex-shrink: 0;
		transition:
			background var(--transition-fast, 0.15s ease),
			border-color var(--transition-fast, 0.15s ease),
			color var(--transition-fast, 0.15s ease);
	}

	.preferences-settings-callout .callout-btn:hover {
		background: var(--color-primary, #3b82f6);
		border-color: var(--color-primary, #3b82f6);
		color: #ffffff;
	}

	/* Discord Tip Banner */
	.discord-tip {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
		padding: 0.85rem 1.15rem;
		background: rgba(88, 101, 242, 0.1);
		border: 1px solid rgba(88, 101, 242, 0.25);
		border-radius: 10px;
		text-align: left;
	}

	.discord-tip-icon-wrap {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: #5865f2;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.discord-tip-text {
		font-size: 0.85rem;
		color: var(--color-text-secondary, #94a3b8);
		line-height: 1.45;
	}

	.discord-tip-text strong {
		color: var(--color-text-primary, #f1f5f9);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Responsive Stack */
	@media (max-width: 768px) {
		.empty-seeking-container {
			padding: 2rem 1rem;
			margin: 1rem auto;
		}

		.hero-title {
			font-size: 1.4rem;
		}

		.hero-subtitle {
			font-size: 0.9rem;
			margin-bottom: 1.5rem;
		}

		.action-cards-grid {
			grid-template-columns: 1fr;
			gap: 0.85rem;
			margin-bottom: 1.75rem;
		}

		.action-card {
			padding: 1.1rem;
		}

		.steps-grid {
			grid-template-columns: 1fr;
			gap: 0.85rem;
		}

		.step-divider {
			display: none;
		}

		.preferences-settings-callout {
			flex-direction: column;
			text-align: center;
			gap: 0.75rem;
			padding: 1rem;
		}

		.preferences-settings-callout .callout-btn {
			width: 100%;
			justify-content: center;
		}

		.discord-tip {
			flex-direction: column;
			text-align: center;
			gap: 0.5rem;
			padding: 1rem;
		}
	}
</style>
