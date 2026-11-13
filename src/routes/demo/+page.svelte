<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';

	onMount(() => {
		auth.enterDemoMode(true);
		goto('/seeking', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Seeker Demo Sandbox</title>
</svelte:head>

<div class="demo-entry">
	<div class="demo-entry-card">
		<div class="spinner" aria-hidden="true"></div>
		<h1>Launching Seeker Demo Sandbox</h1>
		<p>Initializing sample multi-marketplace tracking data in your browser...</p>
		<a href="/seeking" class="fallback-link">Continue to Demo Watchlist</a>
	</div>
</div>

<style>
	.demo-entry {
		min-height: calc(100vh - 10rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.demo-entry-card {
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 2rem 2.25rem;
		text-align: center;
		max-width: 440px;
		width: 100%;
		box-shadow: var(--shadow-lg);
	}

	.demo-entry-card h1 {
		margin: 1rem 0 0.5rem;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}

	.demo-entry-card p {
		margin: 0 0 1.25rem;
		color: var(--color-text-secondary);
		font-size: 0.925rem;
	}

	.spinner {
		width: 2.25rem;
		height: 2.25rem;
		margin: 0 auto;
		border-radius: 50%;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.fallback-link {
		display: inline-block;
		padding: 0.6rem 1.15rem;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
	}
</style>
