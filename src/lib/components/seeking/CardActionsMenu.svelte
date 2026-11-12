<script>
	import { createEventDispatcher } from 'svelte';
	import { formatExactTimestamp, formatCooldownRemaining } from '$lib/utils/seekingUtils.js';

	const dispatch = createEventDispatcher();

	export let card;
	export let isOpen = false;
	export let isDropUp = false;
	export let isSelected = false;
	export let canManualCheckStock = false;
	export let isCheckingCard = false;
	export let cooldownSec = 0;
	export let isAuthenticated = true;

	function handleToggleMenu(event) {
		event.stopPropagation();
		dispatch('toggleMenu', event);
	}
</script>

<td data-label="Actions" class="actions-column col-actions">
	<div class="kebab-menu-container">
		<button
			type="button"
			class="kebab-button"
			aria-label="Actions menu"
			on:click={handleToggleMenu}
		>
			<i class="fa-solid fa-ellipsis-vertical"></i>
		</button>
		{#if isOpen}
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

<style>
	.actions-column {
		width: 46px;
		min-width: 42px;
		max-width: 48px;
		text-align: center;
		padding: 0.6rem 0.2rem;
		position: relative;
		border-bottom: 1px solid var(--color-border);
		transition: background-color var(--transition-fast);
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

	@media (max-width: 768px) {
		td.actions-column {
			position: absolute;
			top: 0.65rem;
			right: 0.6rem;
			border-top: none;
			border-bottom: none;
			padding: 0;
			margin: 0;
			background: none;
			width: auto !important;
			max-width: none !important;
		}
	}
</style>
