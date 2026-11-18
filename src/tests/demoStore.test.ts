import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createInitialDemoCards } from '$lib/demo/demoSeed';
import { handleDemoApiRequest, initializeDemoStorage, resetDemoSandbox } from '$lib/demo/demoStore';

describe('Virtual Demo Sandbox store, seed parity, and CRUD contracts', () => {
	beforeEach(() => {
		globalThis.localStorage.clear();
		initializeDemoStorage();
	});

	it('seeds 12 curated EN/JA/ZHT nonfoil/foil/etched cards with integer-cent prices and Cardmarket disabled', () => {
		const cards = createInitialDemoCards();
		assert.equal(cards.length, 12);

		const languages = new Set(cards.map((c) => c.language));
		const finishes = new Set(cards.map((c) => c.finish));
		assert.equal(languages.has('en'), true);
		assert.equal(languages.has('ja'), true);
		assert.equal(languages.has('zht'), true);
		assert.equal(finishes.has('nonfoil'), true);
		assert.equal(finishes.has('foil'), true);
		assert.equal(finishes.has('etched'), true);

		for (const card of cards) {
			assert.equal(card.cardmarket_stock, false);
			assert.equal(card.cardmarket_low_price, null);
			if (card.tcgplayer_low_price !== null) {
				assert.equal(Number.isInteger(card.tcgplayer_low_price), true);
				assert.equal(card.tcgplayer_low_price >= 100, true);
			}
		}
	});

	it('supports adding, duplicate checking, rekeying, deleting, and resetting demo cards', async () => {
		// 1. Add a new card printing
		const addPayload = {
			name: 'Mox Diamond',
			set_code: 'sth',
			set_name: 'Stronghold',
			collector_number: '138',
			language: 'en',
			finish: 'nonfoil',
			image_uri: 'https://cards.scryfall.io/normal/front/1/1/11111111-2222-3333-4444-555555555555.jpg'
		};

		const addRes = await handleDemoApiRequest(
			'https://seeker.azure-api.net/seeker/addToSeeking',
			{
				method: 'POST',
				body: JSON.stringify(addPayload)
			}
		);
		assert.equal(addRes.status, 201);

		// 2. Adding the exact same printing again returns 409 Conflict
		const dupRes = await handleDemoApiRequest(
			'https://seeker.azure-api.net/seeker/addToSeeking',
			{
				method: 'POST',
				body: JSON.stringify(addPayload)
			}
		);
		assert.equal(dupRes.status, 409);

		// 3. Update price cap and rekey finish to foil
		const updRes = await handleDemoApiRequest(
			'https://seeker.azure-api.net/seeker/updateSeekingCard',
			{
				method: 'POST',
				body: JSON.stringify({
					partitionKey: 'sth',
					rowKey: '138_en_nonfoil',
					new_finish: 'foil',
					max_price_cap: 55000,
					min_condition: 'NM'
				})
			}
		);
		assert.equal(updRes.status, 200);
		const updBody = await updRes.json();
		assert.equal(updBody.rekeyed, true);
		assert.equal(updBody.new_row_key, '138_en_foil');

		// 4. Delete the rekeyed card
		const delRes = await handleDemoApiRequest(
			'https://seeker.azure-api.net/seeker/deleteFromSeeking',
			{
				method: 'POST',
				body: JSON.stringify({
					partitionKey: 'sth',
					rowKey: '138_en_foil'
				})
			}
		);
		assert.equal(delRes.status, 200);

		// 5. Block marketplaceCardmarketEnabled in updateUserSetting with 403
		const cmSetRes = await handleDemoApiRequest(
			'https://seeker.azure-api.net/seeker/updateUserSetting',
			{
				method: 'POST',
				body: JSON.stringify({
					settingName: 'marketplaceCardmarketEnabled',
					settingValue: true
				})
			}
		);
		assert.equal(cmSetRes.status, 403);

		// 6. Reset demo sandbox restores the 12 default cards
		resetDemoSandbox();
		const listRes = await handleDemoApiRequest(
			'https://seeker.azure-api.net/seeker/getSeekingList'
		);
		const listData = await listRes.json();
		assert.equal(listData.cards.length, 12);
	});
});
