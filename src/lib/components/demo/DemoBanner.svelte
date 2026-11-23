<script lang="ts">
	import { onDestroy } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import {
		demoAlertsStore,
		openDemoAlertPreviews,
		resetDemoWorkspace
	} from '$lib/demo/demoStore';

	let confirmReset = false;
	let resetSuccess = false;
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		if (resetTimer) {
			clearTimeout(resetTimer);
			resetTimer = null;
		}
	});

	function handleResetClick() {
		if (!confirmReset) {
			confirmReset = true;
			if (resetTimer) clearTimeout(resetTimer);
			resetTimer = setTimeout(() => {
				confirmReset = false;
			}, 4000);
			return;
		}
		confirmReset = false;
		if (resetTimer) clearTimeout(resetTimer);
		const freshSettings = resetDemoWorkspace();
		auth.updateSettings(freshSettings);
		resetSuccess = true;
		resetTimer = setTimeout(() => {
			resetSuccess = false;
		}, 3000);
	}
</script>

{#if $auth.isDemo}
	<div class="demo-banner" role="region" aria-label="Interactive Demo Sandbox Controls">
		<div class="demo-banner-inner">
			<div class="demo-banner-info">
				<span class="demo-pill">
					<i class="fa-solid fa-flask" aria-hidden="true"></i>
					DEMO SANDBOX
				</span>
				<span class="demo-copy">
					Explore Seeker using simulated multi-store stock seeded with live Scryfall prices. Saved locally in your browser &mdash; zero backend or Discord actions triggered.
				</span>
			</div>

			<div class="demo-banner-actions">
				<button
					type="button"
					class="demo-btn demo-btn-discord"
					on:click={() => openDemoAlertPreviews(null)}
				>
					<i class="fa-brands fa-discord" aria-hidden="true"></i>
					<span>Alert Previews</span>
					{#if $demoAlertsStore.length > 0}
						<span class="alert-count">{$demoAlertsStore.length}</span>
					{/if}
				</button>

				<button
					type="button"
					class="demo-btn demo-btn-secondary"
					class:confirm-active={confirmReset}
					on:click={handleResetClick}
				>
					<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
					<span>
						{#if resetSuccess}
							Demo Reset!
						{:else if confirmReset}
							Confirm Reset?
						{:else}
							Reset Demo
						{/if}
					</span>
				</button>

				<button
					type="button"
					class="demo-btn demo-btn-primary"
					on:click={() => auth.login()}
				>
					<i class="fa-brands fa-discord" aria-hidden="true"></i>
					<span>Login</span>
				</button>

				<button
					type="button"
					class="demo-btn demo-btn-exit"
					on:click={() => auth.logout()}
					title="Exit Demo Sandbox"
				>
					<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
					<span>Exit</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.demo-banner {
		background: linear-gradient(90deg, rgba(88, 101, 242, 0.14) 0%, rgba(16, 185, 129, 0.12) 100%);
		border-bottom: 1px solid rgba(88, 101, 242, 0.35);
		padding: 0.55rem 1rem;
		font-size: 0.85rem;
	}

	.demo-banner-inner {
		max-width: 1540px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	.demo-banner-info {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex: 1 1 320px;
		min-width: 0;
	}

	.demo-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.22rem 0.55rem;
		border-radius: 999px;
		background: rgba(88, 101, 242, 0.2);
		border: 1px solid rgba(88, 101, 242, 0.45);
		color: #8ea1ff;
		font-weight: 700;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	:global([data-theme='light']) .demo-pill {
		color: #3b47c4;
		background: rgba(88, 101, 242, 0.14);
	}

	.demo-copy {
		color: var(--color-text-secondary);
		line-height: 1.35;
	}

	.demo-banner-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.demo-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.36rem 0.72rem;
		border-radius: 7px;
		font-size: 0.8rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		cursor: pointer;
		transition: all 0.15s ease;
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
	}

	.demo-btn:hover {
		transform: translateY(-1px);
	}

	.demo-btn-discord {
		background: rgba(88, 101, 242, 0.16);
		border-color: rgba(88, 101, 242, 0.45);
		color: var(--color-text-primary);
	}

	.demo-btn-discord:hover {
		background: rgba(88, 101, 242, 0.26);
	}

	.alert-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.2rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: #5865f2;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.demo-btn-secondary.confirm-active {
		background: rgba(245, 158, 11, 0.18);
		border-color: rgba(245, 158, 11, 0.55);
		color: #f59e0b;
	}

	.demo-btn-primary {
		background: #5865f2;
		border-color: #5865f2;
		color: #fff;
	}

	.demo-btn-primary:hover {
		background: #4752c4;
	}

	.demo-btn-exit:hover {
		border-color: var(--color-danger, #ef4444);
		color: var(--color-danger, #ef4444);
	}
</style>
