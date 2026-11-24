import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildSeekingCsvString,
	formatCardAsDecklistLine,
	formatPrice,
	getCardHistoricalBadgeInfo,
	getCardmarketUrl,
	getLowestOffer,
	parseDecklistText,
	sanitizeExternalUrl
} from '$lib/utils/seekingUtils';

describe('seekingUtils core pricing, badges, decklist parser, and CSV export', () => {
	it('formats integer cents into USD strings and handles null/undefined', () => {
		assert.equal(formatPrice(25000), '$250.00');
		assert.equal(formatPrice(5498), '$54.98');
		assert.equal(formatPrice(0), '$0.00');
		assert.equal(formatPrice(null), '');
		assert.equal(formatPrice(undefined), '');
	});

	it('computes getLowestOffer across enabled vendors and respects Cardmarket & Ruten gates', () => {
		const card = {
			language: 'ja',
			cardtrader_stock: true,
			cardtrader_low_price: 25000,
			tcgplayer_stock: true,
			tcgplayer_low_price: 24500,
			manapool_stock: true,
			manapool_low_price: 24500,
			ruten_stock: true,
			ruten_low_price: 15000,
			cardmarket_stock: true,
			cardmarket_low_price: 12000,
			cardkingdom_stock: true,
			cardkingdom_low_price: 26000
		};

		// Cardmarket disabled (non-admin) and card language is 'ja' (Ruten only applies to 'zht'/'en')
		const res = getLowestOffer(card, true, true, true, true, true, true, true, false, true);
		assert.equal(res.minPriceCents, 24500);
		assert.equal(res.bestVendors.has('tcgplayer'), true);
		assert.equal(res.bestVendors.has('manapool'), true);
		assert.equal(res.bestVendors.has('ruten'), false);
		assert.equal(res.bestVendors.has('cardmarket'), false);

		// When admin enables Cardmarket (cmEnabled=true), Cardmarket's 12000 cents wins
		const adminRes = getLowestOffer(card, true, true, true, true, true, true, true, true, true);
		assert.equal(adminRes.minPriceCents, 12000);
		assert.equal(adminRes.bestVendors.has('cardmarket'), true);
	});

	it('classifies historical floor badges (breakthrough, at-floor within 2%, and above-floor)', () => {
		const baseCard = {
			language: 'en',
			min_condition: 'NM',
			cardtrader_stock: true,
			cardtrader_low_price: 19800,
			historical_pricing: {
				is_calibrated: true,
				nm_low_cents: 20000,
				nm_low_vendor: 'tcgplayer',
				nm_low_condition: 'NM',
				played_low_cents: 16000,
				played_low_vendor: 'cardtrader',
				played_low_condition: 'HP'
			}
		};

		// 1. Active offer ($198.00) < NM floor ($200.00) -> breakthrough
		const bt = getCardHistoricalBadgeInfo(
			baseCard,
			true,
			true,
			false,
			true,
			false,
			false,
			false,
			false,
			'NM',
			Date.now(),
			true
		);
		assert.equal(bt.type, 'breakthrough');
		assert.equal(bt.isAtLow, true);
		assert.equal(bt.label, '🔥 Low $198.00');

		// 2. Active offer ($203.00) within 2% of NM floor ($200.00 * 1.02 = $204.00) -> at-floor
		// Badge label MUST display active in-stock price ($203.00), never the past floor ($200.00)
		const nearCard = { ...baseCard, cardtrader_low_price: 20300 };
		const near = getCardHistoricalBadgeInfo(
			nearCard,
			true,
			true,
			false,
			true,
			false,
			false,
			false,
			false,
			'NM',
			Date.now(),
			true
		);
		assert.equal(near.type, 'at-floor');
		assert.equal(near.isAtLow, true);
		assert.equal(near.label, '🔥 Low $203.00');

		// 3. Active offer ($225.00) > 2% above NM floor -> standard floor reference
		const highCard = { ...baseCard, cardtrader_low_price: 22500 };
		const high = getCardHistoricalBadgeInfo(
			highCard,
			true,
			true,
			false,
			true,
			false,
			false,
			false,
			false,
			'NM',
			Date.now(),
			true
		);
		assert.equal(high.type, 'floor');
		assert.equal(high.isAtLow, false);
		assert.equal(high.label, 'Low $200.00 (NM)');
	});

	it('parses decklist text and preserves nonfoil, foil (*F*), and etched (*E*) finishes', () => {
		const raw = [
			'Commander',
			'1 Morophon, the Boundless (CMM) 3 *E*',
			'2x City of Traitors (EXO) 143',
			'1 Lotus Petal [TMP] 294 *F*',
			'1 Lotus Petal (TMP) 294 (foil)'
		].join('\n');

		const parsed = parseDecklistText(raw, 'nonfoil', 'ja');
		assert.equal(parsed.length, 3);
		assert.deepEqual(parsed[0], {
			name: 'Morophon, the Boundless',
			set_code: 'cmm',
			collector_number: '3',
			language: 'ja',
			finish: 'etched'
		});
		assert.equal(parsed[1].finish, 'nonfoil');
		assert.equal(parsed[2].finish, 'foil');
		assert.equal(formatCardAsDecklistLine(parsed[0]), '1 Morophon, the Boundless (CMM) 3 *E*');
	});

	it('maps Cardmarket etched and foil printings to isFoil=Y and sanitizes external URLs', () => {
		const urlEtched = getCardmarketUrl({
			cardmarket_id: 4242,
			language: 'zht',
			finish: 'etched'
		});
		assert.equal(
			urlEtched,
			'https://www.cardmarket.com/en/Magic/Products?idProduct=4242&language=11&isFoil=Y'
		);
		assert.equal(
			sanitizeExternalUrl('javascript:alert(1)', 'https://safe.example'),
			'https://safe.example'
		);
	});

	it('escapes spreadsheet formula injection prefixes in buildSeekingCsvString', () => {
		const csv = buildSeekingCsvString([
			{
				name: "=CMD|' /C calc'!A0",
				set_code: '+exo',
				collector_number: '-143',
				language: 'en',
				finish: 'etched',
				cardtrader_stock: true,
				cardtrader_low_price: 25000,
				cardtrader_condition: '@NM',
				tcgplayer_stock: false,
				manapool_stock: false,
				cardkingdom_stock: false,
				cardkingdom_url: '=HYPERLINK("http://evil")',
				ebay_stock: false,
				himarket_stock: false,
				hareruya_stock: false,
				ruten_stock: false,
				max_price_cap: 30000,
				min_condition: 'NM'
			}
		]);

		const lines = csv.split('\n');
		assert.equal(lines.length, 2);
		const dataRow = lines[1];
		assert.equal(dataRow.includes('"\'=CMD|'), true);
		assert.equal(dataRow.includes(',"\'+exo",'), true);
		assert.equal(dataRow.includes(',"\'-143",'), true);
		assert.equal(dataRow.includes(",'@NM,"), true);
		assert.equal(dataRow.includes('"\'=HYPERLINK('), true);
	});
});
