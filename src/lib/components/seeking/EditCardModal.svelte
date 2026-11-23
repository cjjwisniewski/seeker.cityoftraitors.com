<script>
	import { focusTrap } from '$lib/actions/focusTrap';
	import { fetchWithAuth } from '$lib/utils/api';
	import { getLanguageName } from '$lib/utils/languageUtils';
	import { PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL } from '$env/static/public';
	import {
		getCardKey,
		getWebpImageUri,
		extractScryfallImage,
		formatMinConditionLabel,
		getCardCooldownRemainingSec,
		formatRelativeTime,
		formatCooldownRemaining
	} from '$lib/utils/seekingUtils';

	export let show = false;
	export let card = null;
	export let cards = [];
	export let accountMinCondition = 'ANY';
	export let canManualCheckStock = false;
	export let isAdmin = false;
	export let checkingStockCardKeys = new Set();
	export let nowTick = Date.now();
	export let onClose = () => {};
	export let onCardUpdated = () => {};
	export let onManualStockCheck = () => {};

	let maxPriceInput = '';
	let minConditionInput = '';
	let isSavingSettings = false;
	let editLanguageInput = 'en';
	let editFinishInput = 'nonfoil';
	let editPreviewImageUri = '';
	let editAvailableLanguages = ['en'];
	let editLanguageImageMap = {};
	let editAvailableFinishes = ['nonfoil', 'foil'];
	let isLoadingCardPrintInfo = false;
	let settingsModalError = null;
	let lastInitializedKey = '';
	let printVariantsRequestId = 0;

	$: if (show && card) {
		const key = getCardKey(card);
		if (key !== lastInitializedKey) {
			lastInitializedKey = key;
			initModalFromCard(card);
		}
	} else if (!show) {
		lastInitializedKey = '';
		printVariantsRequestId++;
	}

	function initModalFromCard(targetCard) {
		const currentLang = String(targetCard.language || 'en').toLowerCase();
		const currentFinish = String(targetCard.finish || 'nonfoil').toLowerCase();
		editLanguageInput = currentLang;
		editFinishInput = currentFinish;
		editPreviewImageUri = targetCard.image_uri || '';
		editAvailableLanguages = [currentLang];
		editLanguageImageMap = { [currentLang]: targetCard.image_uri || '' };
		editAvailableFinishes = ['nonfoil', 'foil'];
		settingsModalError = null;
		maxPriceInput =
			targetCard.max_price_cap !== null && targetCard.max_price_cap !== undefined
				? (targetCard.max_price_cap / 100).toFixed(2)
				: '';
		minConditionInput = targetCard.min_condition ? String(targetCard.min_condition).toUpperCase() : '';
		loadCardPrintVariants(targetCard);
	}

	$: isEditVariantChanged =
		card !== null &&
		(editLanguageInput.toLowerCase() !== String(card.language || 'en').toLowerCase() ||
			editFinishInput.toLowerCase() !== String(card.finish || 'nonfoil').toLowerCase());

	$: isEditVariantDuplicate =
		isEditVariantChanged &&
		card !== null &&
		cards.some(
			(c) =>
				c.set_code.toLowerCase() === card.set_code.toLowerCase() &&
				String(c.collector_number) === String(card.collector_number) &&
				String(c.language || 'en').toLowerCase() === editLanguageInput.toLowerCase() &&
				String(c.finish || 'nonfoil').toLowerCase() === editFinishInput.toLowerCase()
		);

	async function loadCardPrintVariants(targetCard) {
		const reqId = ++printVariantsRequestId;
		if (!targetCard || !targetCard.set_code || !targetCard.collector_number || targetCard.collector_number === 'N/A') {
			isLoadingCardPrintInfo = false;
			return;
		}
		isLoadingCardPrintInfo = true;
		try {
			const url = `https://api.scryfall.com/cards/search?q=cn%3A${encodeURIComponent(targetCard.collector_number)}+set%3A${encodeURIComponent(targetCard.set_code)}&include_multilingual=true&unique=prints`;
			const res = await fetch(url);
			if (reqId !== printVariantsRequestId) return;
			if (!res.ok) return;
			const data = await res.json();
			if (reqId !== printVariantsRequestId) return;
			const prints = data.data || [];
			if (prints.length === 0) return;

			const langs = [];
			const imgMap = { ...editLanguageImageMap };
			const finishesSet = new Set();

			for (const p of prints) {
				if (p.lang) {
					const code = p.lang.toLowerCase();
					if (!langs.includes(code)) {
						langs.push(code);
					}
					const img = extractScryfallImage(p);
					if (img) {
						imgMap[code] = img;
					}
				}
				if (Array.isArray(p.finishes)) {
					if (p.finishes.includes('nonfoil')) finishesSet.add('nonfoil');
					if (p.finishes.includes('foil')) finishesSet.add('foil');
					if (p.finishes.includes('etched')) finishesSet.add('etched');
				}
			}

			const currentLang = String(targetCard.language || 'en').toLowerCase();
			if (!langs.includes(currentLang)) {
				langs.unshift(currentLang);
			}
			const currentFinish = String(targetCard.finish || 'nonfoil').toLowerCase();
			finishesSet.add(currentFinish);

			editAvailableLanguages = langs;
			editLanguageImageMap = imgMap;
			editAvailableFinishes = Array.from(finishesSet);
			if (imgMap[editLanguageInput]) {
				editPreviewImageUri = imgMap[editLanguageInput];
			}
		} catch (e) {
			if (reqId !== printVariantsRequestId) return;
			console.warn('Could not load multilingual print variants from Scryfall:', e);
		} finally {
			if (reqId === printVariantsRequestId) {
				isLoadingCardPrintInfo = false;
			}
		}
	}

	function handleEditLanguageChange() {
		if (editLanguageImageMap[editLanguageInput]) {
			editPreviewImageUri = editLanguageImageMap[editLanguageInput];
		}
	}

	async function handleUpdateSettings() {
		if (!card || isEditVariantDuplicate) return;
		isSavingSettings = true;
		settingsModalError = null;

		try {
			let max_price_cap = null;
			if (maxPriceInput !== null && maxPriceInput !== undefined && String(maxPriceInput).trim() !== '') {
				max_price_cap = Math.round(parseFloat(maxPriceInput) * 100);
				if (isNaN(max_price_cap) || max_price_cap < 0) throw new Error('Invalid price cap format.');
			}

			const min_condition = minConditionInput ? minConditionInput : null;

			const requestBody = {
				partitionKey: card.set_code,
				rowKey: `${card.collector_number}_${card.language}_${card.finish}`,
				max_price_cap: max_price_cap,
				min_condition: min_condition,
				new_language: editLanguageInput,
				new_finish: editFinishInput,
				new_image_uri: editPreviewImageUri || card.image_uri
			};

			const response = await fetchWithAuth(PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response) {
				settingsModalError = 'Authentication failed while updating card settings.';
				return;
			}

			let result = null;
			try {
				result = await response.json();
			} catch (e) {
				result = null;
			}

			if (!response.ok) {
				throw new Error(result?.message || `Failed to update card (Status ${response.status})`);
			}

			const oldKey = getCardKey(card);
			const updatedCards = cards.map((c) => {
				if (getCardKey(c) === oldKey) {
					if (result?.rekeyed) {
						return {
							...c,
							id: result.new_row_key || `${c.collector_number}_${editLanguageInput}_${editFinishInput}`,
							language: editLanguageInput,
							finish: editFinishInput,
							image_uri: result.image_uri || editPreviewImageUri || c.image_uri,
							max_price_cap: max_price_cap,
							min_condition: min_condition,
							cardtrader_stock: false,
							cardtrader_low_price: null,
							cardtrader_condition: null,
							cardtrader_id: '',
							tcgplayer_stock: false,
							tcgplayer_low_price: null,
							tcgplayer_condition: null,
							cardmarket_stock: false,
							cardmarket_low_price: null,
							cardmarket_price_eur: null,
							cardmarket_condition: null,
							cardmarket_url: '',
							historical_pricing: null,
							last_manual_check: null,
							ebay_stock: false,
							ebay_low_price: null,
							ebay_condition: null,
							ebay_id: '',
							manapool_stock: false,
							manapool_low_price: null,
							manapool_condition: null,
							manapool_id: '',
							manapool_url: '',
							himarket_stock: false,
							himarket_low_price: null,
							himarket_price_hkd: null,
							himarket_condition: null,
							himarket_url: '',
							cardkingdom_stock: false,
							cardkingdom_low_price: null,
							cardkingdom_condition: null,
							cardkingdom_url: '',
							hareruya_stock: false,
							hareruya_low_price: null,
							hareruya_price_jpy: null,
							hareruya_condition: null,
							hareruya_url: '',
							ruten_stock: false,
							ruten_low_price: null,
							ruten_price_twd: null,
							ruten_condition: null,
							ruten_url: ''
						};
					}
					return { ...c, max_price_cap: max_price_cap, min_condition: min_condition };
				}
				return c;
			});

			onCardUpdated(updatedCards, Boolean(result?.rekeyed));
			onClose();
		} catch (e) {
			settingsModalError = e.message;
			console.error('Error updating card settings:', e);
		} finally {
			isSavingSettings = false;
		}
	}
</script>

{#if show && card}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay-backdrop" on:click={() => !isSavingSettings && onClose()}>
		<div class="modal-content" use:focusTrap role="dialog" aria-modal="true" aria-label="Edit Card" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Edit Card</h2>
				<button class="close-modal-btn" aria-label="Close modal" on:click={() => !isSavingSettings && onClose()}>
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="modal-body">
				{#if settingsModalError}
					<div class="import-alert error" style="margin-bottom: 1rem;">
						<i class="fa-solid fa-circle-exclamation"></i>
						<span>{settingsModalError}</span>
					</div>
				{/if}

				<div class="card-details-mini">
					<img src={getWebpImageUri(editPreviewImageUri || card.image_uri)} alt={card.name} />
					<div>
						<h3>{card.name}</h3>
						<p>
							{card.set_code.toUpperCase()} #{card.collector_number}
							• {editLanguageInput.toUpperCase()}
							• {editFinishInput === 'etched' ? '✦ Etched' : editFinishInput === 'foil' ? '✦ Foil' : 'Nonfoil'}
						</p>
					</div>
				</div>

				<div class="edit-variant-grid">
					<div class="settings-group">
						<label for="edit-card-language">
							Language
							{#if isLoadingCardPrintInfo}
								<i class="fa-solid fa-circle-notch fa-spin" style="font-size: 0.75rem; margin-left: 0.35rem;"></i>
							{/if}
						</label>
						<select
							id="edit-card-language"
							bind:value={editLanguageInput}
							on:change={handleEditLanguageChange}
							class="modal-input edit-select-input"
							disabled={isSavingSettings}
						>
							{#each editAvailableLanguages as langCode}
								<option value={langCode}>
									{getLanguageName(langCode)} ({langCode.toUpperCase()})
								</option>
							{/each}
						</select>
					</div>

					<div class="settings-group">
						<span class="edit-field-label">Finish</span>
						<div class="edit-finish-segmented" role="group" aria-label="Card Finish">
							<button
								type="button"
								class="edit-finish-option"
								class:active={editFinishInput === 'nonfoil'}
								disabled={isSavingSettings || !editAvailableFinishes.includes('nonfoil')}
								on:click={() => (editFinishInput = 'nonfoil')}
							>
								Non-Foil
							</button>
							<button
								type="button"
								class="edit-finish-option foil"
								class:active={editFinishInput === 'foil'}
								disabled={isSavingSettings || !editAvailableFinishes.includes('foil')}
								on:click={() => (editFinishInput = 'foil')}
							>
								✦ Foil
							</button>
							{#if editAvailableFinishes.includes('etched')}
								<button
									type="button"
									class="edit-finish-option foil"
									class:active={editFinishInput === 'etched'}
									disabled={isSavingSettings}
									on:click={() => (editFinishInput = 'etched')}
								>
									✦ Etched
								</button>
							{/if}
						</div>
					</div>
				</div>

				{#if isEditVariantDuplicate}
					<div class="import-alert error" style="margin-bottom: 1rem;">
						<i class="fa-solid fa-triangle-exclamation"></i>
						<span>This language and finish combination is already in your Seeking list.</span>
					</div>
				{:else if isEditVariantChanged}
					<div class="edit-rekey-notice">
						<i class="fa-solid fa-arrows-rotate"></i>
						<span>Switching language or finish will reset current stock statuses for this card and trigger a fresh stock check.</span>
					</div>
				{/if}

				<div class="settings-group">
					<label for="max-price-cap">Max Price Cap ($)</label>
					<p class="setting-description">
						Only receive stock alerts and digests if the price is at or below this threshold. Leave
						empty for no limit.
					</p>
					<div class="input-with-prefix">
						<span>$</span>
						<input
							id="max-price-cap"
							type="number"
							step="0.01"
							min="0"
							bind:value={maxPriceInput}
							placeholder="e.g. 50.00"
							class="modal-input"
							disabled={isSavingSettings}
						/>
					</div>
				</div>

				<div class="settings-group">
					<label for="edit-min-condition">Minimum Condition</label>
					<p class="setting-description">
						Ignore listings graded worse than this condition. Defaults to your account-wide setting.
					</p>
					<select
						id="edit-min-condition"
						bind:value={minConditionInput}
						class="modal-input edit-select-input"
						disabled={isSavingSettings}
					>
						<option value="">Account Default ({formatMinConditionLabel(accountMinCondition)})</option>
						<option value="ANY">Any Condition</option>
						<option value="HP">Heavily Played or Better (HP+)</option>
						<option value="MP">Moderately Played or Better (MP+)</option>
						<option value="SP">Slightly / Lightly Played or Better (SP+)</option>
						<option value="NM">Near Mint Only (NM)</option>
					</select>
				</div>

				{#if canManualCheckStock}
					{@const modalCooldownSec = getCardCooldownRemainingSec(card, isAdmin, nowTick)}
					{@const isModalChecking = checkingStockCardKeys.has(getCardKey(card))}
					<div class="manual-check-box">
						<div class="manual-check-info">
							<span class="manual-check-title">
								<i class="fa-solid fa-bolt"></i> On-Demand Stock Check
							</span>
							<span class="manual-check-sub">
								{#if card.last_manual_check}
									Last manual check: {formatRelativeTime(card.last_manual_check, nowTick) || 'Recently'}
								{:else}
									Queue an immediate check across your enabled marketplaces.
								{/if}
							</span>
						</div>
						<button
							type="button"
							class="manual-check-btn"
							disabled={isSavingSettings || isModalChecking || modalCooldownSec > 0 || isEditVariantChanged}
							title={isEditVariantChanged
								? 'Save your language/finish changes to automatically queue a fresh check'
								: modalCooldownSec > 0
									? `Available again in ${formatCooldownRemaining(modalCooldownSec)}`
									: 'Check stock now'}
							on:click={() => onManualStockCheck(card)}
						>
							{#if isModalChecking}
								<i class="fa-solid fa-arrows-rotate fa-spin"></i> Checking...
							{:else if modalCooldownSec > 0}
								<i class="fa-regular fa-clock"></i> Cooldown ({formatCooldownRemaining(modalCooldownSec)})
							{:else}
								<i class="fa-solid fa-arrows-rotate"></i> Check Now
							{/if}
						</button>
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button
					class="modal-btn secondary"
					on:click={onClose}
					disabled={isSavingSettings}
				>
					Cancel
				</button>
				<button
					class="modal-btn primary"
					on:click={handleUpdateSettings}
					disabled={isSavingSettings || isEditVariantDuplicate}
				>
					{isSavingSettings ? 'Saving...' : 'Save Changes'}
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

	.edit-variant-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
		margin-bottom: 0.5rem;
	}

	@media (max-width: 520px) {
		.edit-variant-grid {
			grid-template-columns: 1fr;
		}
	}

	.edit-select-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		font-size: 0.88rem;
		height: 40px;
	}

	.edit-field-label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--color-text-primary);
	}

	.edit-finish-segmented {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
		gap: 0.35rem;
		background: var(--color-bg-secondary);
		padding: 0.25rem;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		height: 40px;
		box-sizing: border-box;
	}

	.edit-finish-option {
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		padding: 0 0.25rem;
		transition: all 0.15s ease;
	}

	.edit-finish-option.active {
		background: var(--color-primary);
		color: #fff;
	}

	.edit-finish-option.foil.active {
		background: #f59e0b;
		color: #111827;
	}

	.edit-finish-option:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.edit-rekey-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		background: rgba(99, 102, 241, 0.1);
		border: 1px solid rgba(99, 102, 241, 0.3);
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		line-height: 1.4;
		margin-bottom: 1rem;
	}

	.edit-rekey-notice i {
		color: var(--color-primary);
		margin-top: 0.15rem;
	}

	.import-alert.error {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.75rem 0.9rem;
		border-radius: 8px;
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #ef4444;
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.manual-check-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		margin-top: 1.1rem;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
	}

	.manual-check-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.manual-check-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-primary);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.manual-check-title i {
		color: var(--color-primary);
	}

	.manual-check-sub {
		font-size: 0.76rem;
		color: var(--color-text-secondary);
	}

	.manual-check-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.48rem 0.85rem;
		border-radius: 8px;
		border: 1px solid rgba(99, 102, 241, 0.45);
		background: rgba(99, 102, 241, 0.14);
		color: var(--color-text-primary);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.manual-check-btn:hover:not(:disabled) {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: #fff;
	}

	.manual-check-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
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

	@media (max-width: 580px) {
		.manual-check-box {
			flex-direction: column;
			align-items: stretch;
			gap: 0.65rem;
		}
		.manual-check-btn {
			justify-content: center;
			width: 100%;
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
