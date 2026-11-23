<script>
	import { focusTrap } from '$lib/actions/focusTrap';
	import { formatPrice } from '$lib/utils/seekingUtils';

	export let selectedCount = 0;
	export let totalFilteredCount = 0;
	export let selectedCostSummary = { inStockCount: 0, totalLowestCents: 0 };
	export let showBulkPriceCapModal = false;
	export let showBulkConditionModal = false;
	export let showBulkDeleteModal = false;
	export let bulkPriceCapInput = '';
	export let bulkConditionInput = '';
	export let canManualCheckStock = false;
	export let isProcessingBulkAction = false;
	export let bulkActionProgress = { current: 0, total: 0 };
	export let onCopySelected = () => {};
	export let onExportCsvSelected = () => {};
	export let onSelectAllFiltered = () => {};
	export let onClearSelection = () => {};
	export let onConfirmBulkPriceCap = () => {};
	export let onConfirmBulkCondition = () => {};
	export let onBulkStockCheck = () => {};
	export let onConfirmBulkDelete = () => {};
</script>

{#if selectedCount > 0}
	<aside class="floating-bulk-bar" aria-label="Bulk actions toolbar">
		<div class="bulk-info">
			<span class="bulk-count"
				><strong>{selectedCount}</strong> card{selectedCount === 1 ? '' : 's'} selected</span
			>
			{#if selectedCostSummary.inStockCount > 0}
				<span
					class="bulk-cost-pill"
					title="Estimated lowest total for {selectedCostSummary.inStockCount} in-stock selected card(s)"
				>
					<i class="fa-solid fa-sack-dollar"></i>
					Est. {formatPrice(selectedCostSummary.totalLowestCents)} ({selectedCostSummary.inStockCount}
					in stock)
				</span>
			{/if}
		</div>
		<div class="bulk-actions">
			<button
				class="bulk-btn secondary"
				on:click={onCopySelected}
				title="Copy selected cards as Decklist (Moxfield / Text format)"
			>
				<i class="fa-solid fa-copy"></i> Copy ({selectedCount})
			</button>
			<button
				class="bulk-btn secondary"
				on:click={onExportCsvSelected}
				title="Export selected cards as CSV"
			>
				<i class="fa-solid fa-file-csv"></i> CSV ({selectedCount})
			</button>
			<button class="bulk-btn" on:click={() => (showBulkPriceCapModal = true)}>
				<i class="fa-solid fa-tag"></i> Price Cap
			</button>
			<button class="bulk-btn" on:click={() => (showBulkConditionModal = true)}>
				<i class="fa-solid fa-shield-halved"></i> Min Cond
			</button>
			{#if canManualCheckStock}
				<button
					class="bulk-btn"
					on:click={onBulkStockCheck}
					disabled={isProcessingBulkAction}
					title="Queue on-demand stock checks for selected cards not on cooldown"
				>
					<i class="fa-solid fa-arrows-rotate"></i> Check Stock
				</button>
			{/if}
			<button class="bulk-btn danger" on:click={() => (showBulkDeleteModal = true)}>
				<i class="fa-solid fa-trash"></i> Delete
			</button>
			<button class="bulk-btn secondary" on:click={onSelectAllFiltered}>
				Select All ({totalFilteredCount})
			</button>
			<button
				class="bulk-btn secondary"
				on:click={onClearSelection}
				title="Clear selection (Esc)"
				aria-label="Clear selection"
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	</aside>
{/if}

{#if showBulkPriceCapModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="overlay-backdrop"
		on:click={() => !isProcessingBulkAction && (showBulkPriceCapModal = false)}
	>
		<div
			class="modal-content"
			use:focusTrap
			role="dialog"
			aria-modal="true"
			aria-label="Set Price Cap"
			on:click|stopPropagation
		>
			<div class="modal-header">
				<h2>Set Price Cap ({selectedCount} Cards)</h2>
				<button
					class="close-modal-btn"
					aria-label="Close modal"
					on:click={() => !isProcessingBulkAction && (showBulkPriceCapModal = false)}
				>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				<p class="setting-description">
					Apply a maximum price cap to all <strong>{selectedCount}</strong> selected cards. Leave empty
					to remove the cap on selected cards.
				</p>
				<div class="settings-group">
					<label for="bulk-price-cap">Max Price Cap ($)</label>
					<div class="input-with-prefix">
						<span>$</span>
						<input
							id="bulk-price-cap"
							type="number"
							step="0.01"
							min="0"
							bind:value={bulkPriceCapInput}
							placeholder="e.g. 25.00"
							class="modal-input"
							disabled={isProcessingBulkAction}
						/>
					</div>
				</div>
				{#if isProcessingBulkAction}
					<div class="bulk-progress-text">
						Updating {bulkActionProgress.current} of {bulkActionProgress.total}...
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={() => (showBulkPriceCapModal = false)}
					disabled={isProcessingBulkAction}
				>
					Cancel
				</button>
				<button
					class="modal-btn primary"
					on:click={onConfirmBulkPriceCap}
					disabled={isProcessingBulkAction}
				>
					{isProcessingBulkAction ? 'Applying...' : 'Apply Price Cap'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showBulkConditionModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="overlay-backdrop"
		on:click={() => !isProcessingBulkAction && (showBulkConditionModal = false)}
	>
		<div
			class="modal-content"
			use:focusTrap
			role="dialog"
			aria-modal="true"
			aria-label="Set Minimum Condition"
			on:click|stopPropagation
		>
			<div class="modal-header">
				<h2>Set Min Condition ({selectedCount} Cards)</h2>
				<button
					class="close-modal-btn"
					aria-label="Close modal"
					on:click={() => !isProcessingBulkAction && (showBulkConditionModal = false)}
				>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				<p class="setting-description">
					Apply a minimum condition override to all <strong>{selectedCount}</strong> selected cards,
					or choose Account Default to clear overrides.
				</p>
				<div class="settings-group">
					<label for="bulk-min-condition">Minimum Condition</label>
					<select
						id="bulk-min-condition"
						bind:value={bulkConditionInput}
						class="modal-input"
						disabled={isProcessingBulkAction}
					>
						<option value="">Account Default (Clear Override)</option>
						<option value="NM">NM (Near Mint)</option>
						<option value="SP">SP / LP (Slightly Played)</option>
						<option value="MP">MP (Moderately Played)</option>
						<option value="HP">HP (Heavily Played)</option>
						<option value="ANY">Any Condition</option>
					</select>
				</div>
				{#if isProcessingBulkAction}
					<div class="bulk-progress-text">
						Updating {bulkActionProgress.current} of {bulkActionProgress.total}...
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={() => (showBulkConditionModal = false)}
					disabled={isProcessingBulkAction}
				>
					Cancel
				</button>
				<button
					class="modal-btn primary"
					on:click={onConfirmBulkCondition}
					disabled={isProcessingBulkAction}
				>
					{isProcessingBulkAction ? 'Applying...' : 'Apply Condition'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showBulkDeleteModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="overlay-backdrop"
		on:click={() => !isProcessingBulkAction && (showBulkDeleteModal = false)}
	>
		<div
			class="modal-content"
			use:focusTrap
			role="dialog"
			aria-modal="true"
			aria-label="Delete Selected Cards"
			on:click|stopPropagation
		>
			<div class="modal-header">
				<h2>Delete {selectedCount} Cards?</h2>
				<button
					class="close-modal-btn"
					aria-label="Close modal"
					on:click={() => !isProcessingBulkAction && (showBulkDeleteModal = false)}
				>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				<p class="setting-description text-error-desc">
					Are you sure you want to remove <strong>{selectedCount}</strong> selected cards from your Seeking
					list? This action cannot be undone.
				</p>
				{#if isProcessingBulkAction}
					<div class="bulk-progress-text">
						Deleting {bulkActionProgress.current} of {bulkActionProgress.total}...
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={() => (showBulkDeleteModal = false)}
					disabled={isProcessingBulkAction}
				>
					Cancel
				</button>
				<button
					class="modal-btn danger"
					on:click={onConfirmBulkDelete}
					disabled={isProcessingBulkAction}
				>
					{isProcessingBulkAction ? 'Deleting...' : `Delete ${selectedCount} Cards`}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.floating-bulk-bar {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		width: max-content;
		max-width: calc(100vw - 2rem);
		box-sizing: border-box;
		background: var(--color-bg-elevated, #1e1e2d);
		border: 1px solid var(--color-border);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		border-radius: 12px;
		padding: 0.65rem 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		z-index: 900;
		animation: slideUp 0.25s ease-out;
	}

	.bulk-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
		color: var(--color-text-primary);
		font-size: 0.9rem;
	}

	.bulk-cost-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: #10b981;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: nowrap;
	}

	.bulk-btn {
		background: var(--color-primary);
		color: white;
		border: none;
		padding: 0.4rem 0.85rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		transition:
			opacity var(--transition-fast),
			transform var(--transition-fast);
		white-space: nowrap;
	}

	.bulk-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.bulk-btn.danger,
	.modal-btn.danger {
		background: var(--color-error, #ef4444);
		color: white;
		border: none;
	}

	.bulk-btn.secondary {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
	}

	.bulk-btn.secondary:hover {
		background: var(--color-bg-hover);
	}

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
		max-width: 500px;
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

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}

	.close-modal-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0.5rem;
	}

	.settings-group {
		margin-bottom: 1.5rem;
	}

	.settings-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--color-text-primary);
	}

	.setting-description {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin-bottom: 1rem;
		line-height: 1.4;
	}

	.text-error-desc {
		color: var(--color-error) !important;
	}

	.input-with-prefix {
		display: flex;
		align-items: center;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0 0.75rem;
		transition: border-color 0.2s;
	}

	.input-with-prefix:focus-within {
		border-color: var(--color-primary);
	}

	.input-with-prefix span {
		color: var(--color-text-muted);
		margin-right: 0.5rem;
	}

	.modal-input {
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		padding: 0.75rem 0;
		font-size: 1rem;
		width: 100%;
		outline: none;
	}

	.bulk-progress-text {
		font-size: 0.85rem;
		color: var(--color-primary);
		font-weight: 500;
		margin-top: 0.5rem;
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

	.modal-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@keyframes slideUp {
		from {
			transform: translate(-50%, 20px);
			opacity: 0;
		}
		to {
			transform: translate(-50%, 0);
			opacity: 1;
		}
	}

	@media (max-width: 768px) {
		.floating-bulk-bar {
			left: 0.75rem;
			right: 0.75rem;
			bottom: 0.75rem;
			transform: none;
			max-width: none;
			width: auto;
			box-sizing: border-box;
			flex-direction: column;
			align-items: stretch;
			gap: 0.6rem;
			padding: 0.75rem 0.85rem;
		}

		.bulk-info {
			flex-wrap: wrap;
			justify-content: space-between;
			white-space: normal;
			font-size: 0.82rem;
		}

		.bulk-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.4rem;
			width: 100%;
		}

		.bulk-btn {
			flex: 1 1 auto;
			justify-content: center;
			padding: 0.42rem 0.6rem;
			font-size: 0.78rem;
		}
	}

	@media (max-width: 580px) {
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
