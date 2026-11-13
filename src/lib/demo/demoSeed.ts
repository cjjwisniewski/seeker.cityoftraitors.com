import { buildDemoVendorIdentifiers, simulateVendorOffersForCard } from './demoPricing';
import type {
	DemoAlertPreview,
	DemoCardRecord,
	DemoHistoricalPricing,
	DemoUserSettings,
	FinishType,
	SampleDeckPreset
} from './demoTypes';

export const DEMO_USER_ID = 'demo-user-0000';
export const DEMO_MAX_CARDS = 150;

export const DEMO_STORAGE_KEYS = {
	ACTIVE: 'seeker_demo_active',
	CARDS: 'seeker_demo_seeking_list_v2',
	SETTINGS: 'seeker_demo_user_settings_v1',
	ALERTS: 'seeker_demo_alerts_v2'
} as const;

export const DEFAULT_DEMO_SETTINGS: DemoUserSettings = {
	stockAlertEnabled: true,
	stockDigestEnabled: true,
	stockDigestHourUtc: 14,
	priceDropAlertEnabled: true,
	priceDropThreshold: 10,
	preferredLanguage: 'en',
	preferredFinish: 'nonfoil',
	minCondition: 'ANY',
	marketplaceCardtraderEnabled: true,
	marketplaceTcgplayerEnabled: true,
	marketplaceEbayEnabled: true,
	marketplaceManapoolEnabled: true,
	marketplaceCardkingdomEnabled: true,
	marketplaceHimarketEnabled: true,
	marketplaceHareruyaEnabled: true,
	marketplaceRutenEnabled: true,
	marketplaceCardmarketEnabled: false
};

export interface DemoSyntheticUser {
	id: string;
	discordId: string;
	username: string;
	globalName: string;
	discriminator: string;
	avatar: string | null;
	roles: string[];
	isAdmin: false;
	membershipTier: 'Premium';
	scanningPaused: false;
	settings: DemoUserSettings;
}

export function createDemoUser(settings: DemoUserSettings): DemoSyntheticUser {
	return {
		id: DEMO_USER_ID,
		discordId: '000000000000000000',
		username: 'Demo Seeker',
		globalName: 'Demo Sandbox',
		discriminator: '0',
		avatar: null,
		roles: [],
		isAdmin: false,
		membershipTier: 'Premium',
		scanningPaused: false,
		settings
	};
}

function scryfallNormalImage(uuid: string): string {
	return `https://cards.scryfall.io/normal/front/${uuid[0]}/${uuid[1]}/${uuid}.jpg`;
}

interface SeedCardSpec {
	scryfallId: string;
	name: string;
	set_code: string;
	set_name: string;
	collector_number: string;
	language: string;
	finish: FinishType;
	tcgplayer_id: string | number;
	cardmarket_id: string | number;
	baselineCents: number;
	max_price_cap: number | null;
	min_condition: string | null;
	ageHours: number;
	forceOutOfStock?: boolean;
}

const CURATED_SEED_SPECS: SeedCardSpec[] = [
	{
		scryfallId: 'a7a8b6b8-b95f-4014-b17a-a6d44d965995',
		name: 'City of Traitors',
		set_code: 'exo',
		set_name: 'Exodus',
		collector_number: '143',
		language: 'en',
		finish: 'nonfoil',
		tcgplayer_id: 4303,
		cardmarket_id: 9371,
		baselineCents: 55314,
		max_price_cap: 57500,
		min_condition: 'SP',
		ageHours: 72
	},
	{
		scryfallId: 'ac650f46-003a-4d8c-8aeb-2daddba318f6',
		name: 'City of Traitors',
		set_code: 'exo',
		set_name: 'Exodus',
		collector_number: '143',
		language: 'zht',
		finish: 'nonfoil',
		tcgplayer_id: 4303,
		cardmarket_id: 9371,
		baselineCents: 55314,
		max_price_cap: 60000,
		min_condition: 'MP',
		ageHours: 64
	},
	{
		scryfallId: '6c877da3-68fa-41d0-8a24-8c79fcd8ecc1',
		name: 'Lotus Petal',
		set_code: 'tmp',
		set_name: 'Tempest',
		collector_number: '294',
		language: 'en',
		finish: 'nonfoil',
		tcgplayer_id: 5615,
		cardmarket_id: 9019,
		baselineCents: 3787,
		max_price_cap: 4000,
		min_condition: null,
		ageHours: 52
	},
	{
		scryfallId: '99b6e466-784b-48a6-8e72-beff72f39231',
		name: 'Demonic Tutor',
		set_code: 'sta',
		set_name: 'Strixhaven Mystical Archive',
		collector_number: '90',
		language: 'ja',
		finish: 'etched',
		tcgplayer_id: 233496,
		cardmarket_id: 540556,
		baselineCents: 26305,
		max_price_cap: 28000,
		min_condition: 'NM',
		ageHours: 48
	},
	{
		scryfallId: '17c6ba55-2470-4dde-a7fa-137a60716c96',
		name: 'Scalding Tarn',
		set_code: 'mh2',
		set_name: 'Modern Horizons 2',
		collector_number: '439',
		language: 'en',
		finish: 'etched',
		tcgplayer_id: 239431,
		cardmarket_id: 564655,
		baselineCents: 3841,
		max_price_cap: 4200,
		min_condition: 'SP',
		ageHours: 42
	},
	{
		scryfallId: '1a02ca71-5e39-4a5f-aaba-a1e3e10a6a3e',
		name: 'Chalice of the Void',
		set_code: 'mrd',
		set_name: 'Mirrodin',
		collector_number: '150',
		language: 'en',
		finish: 'foil',
		tcgplayer_id: 11465,
		cardmarket_id: 150,
		baselineCents: 8377,
		max_price_cap: 9000,
		min_condition: 'SP',
		ageHours: 36,
		forceOutOfStock: true
	},
	{
		scryfallId: '85df5a18-f21f-442f-aa22-88215cea6643',
		name: 'Boseiju, Who Endures',
		set_code: 'neo',
		set_name: 'Kamigawa: Neon Dynasty',
		collector_number: '266',
		language: 'ja',
		finish: 'foil',
		tcgplayer_id: 262050,
		cardmarket_id: '',
		baselineCents: 5312,
		max_price_cap: 5800,
		min_condition: null,
		ageHours: 30
	},
	{
		scryfallId: '3394cefd-a3c6-4917-8f46-234e441ecfb6',
		name: 'Rhystic Study',
		set_code: 'pcy',
		set_name: 'Prophecy',
		collector_number: '45',
		language: 'en',
		finish: 'foil',
		tcgplayer_id: 7357,
		cardmarket_id: 3939,
		baselineCents: 45691,
		max_price_cap: null,
		min_condition: 'SP',
		ageHours: 24
	},
	{
		scryfallId: '9a879b60-4381-447d-8a5a-8e0b6a1d49ca',
		name: 'Force of Will',
		set_code: 'all',
		set_name: 'Alliances',
		collector_number: '28',
		language: 'en',
		finish: 'nonfoil',
		tcgplayer_id: 4146,
		cardmarket_id: 7894,
		baselineCents: 6740,
		max_price_cap: 7000,
		min_condition: 'MP',
		ageHours: 18
	},
	{
		scryfallId: 'a2528377-7918-4f32-b23d-4214b69807b2',
		name: 'Flooded Strand',
		set_code: 'ktk',
		set_name: 'Khans of Tarkir',
		collector_number: '233',
		language: 'zht',
		finish: 'foil',
		tcgplayer_id: 92828,
		cardmarket_id: '',
		baselineCents: 2643,
		max_price_cap: 3000,
		min_condition: null,
		ageHours: 12
	},
	{
		scryfallId: 'a9738cda-adb1-47fb-9f4c-ecd930228c4d',
		name: 'Ragavan, Nimble Pilferer',
		set_code: 'mh2',
		set_name: 'Modern Horizons 2',
		collector_number: '138',
		language: 'en',
		finish: 'nonfoil',
		tcgplayer_id: 239857,
		cardmarket_id: 566480,
		baselineCents: 3951,
		max_price_cap: 4200,
		min_condition: null,
		ageHours: 6
	},
	{
		scryfallId: '25b0b816-0583-44aa-9dc5-f3ff48993a51',
		name: "Gaea's Cradle",
		set_code: 'usg',
		set_name: "Urza's Saga",
		collector_number: '321',
		language: 'en',
		finish: 'nonfoil',
		tcgplayer_id: 6883,
		cardmarket_id: 10528,
		baselineCents: 165309,
		max_price_cap: null,
		min_condition: 'HP',
		ageHours: 2
	}
];

function createOutOfStockHistoricalBaseline(nowMs: number): DemoHistoricalPricing {
	const past5d = new Date(nowMs - 5 * 24 * 60 * 60 * 1000).toISOString();
	const past2d = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();
	return {
		is_calibrated: true,
		first_observed_at: past5d,
		observation_count: 14,
		nm_low_cents: 8150,
		nm_low_condition: 'NM',
		nm_low_vendor: 'cardtrader',
		nm_low_at: past5d,
		nm_last_seen_cents: 8490,
		nm_last_seen_condition: 'SP',
		nm_last_seen_vendor: 'tcgplayer',
		nm_last_seen_at: past2d,
		played_low_cents: 6895,
		played_low_condition: 'MP',
		played_low_vendor: 'cardtrader',
		played_low_at: past5d,
		played_last_seen_cents: 7150,
		played_last_seen_condition: 'MP',
		played_last_seen_vendor: 'cardtrader',
		played_last_seen_at: past2d,
		last_seen_cents: 7150,
		last_seen_condition: 'MP',
		last_seen_vendor: 'cardtrader',
		last_seen_at: past2d,
		vendor_lows: {
			cardtrader: { low_cents: 6895, low_cond: 'MP', last_cents: 7150, last_at: past2d },
			tcgplayer: { low_cents: 8195, low_cond: 'SP', last_cents: 8490, last_at: past2d }
		}
	};
}

export function createInitialDemoCards(nowMs = Date.now()): DemoCardRecord[] {
	return CURATED_SEED_SPECS.map((spec) => {
		const rowId = `${spec.collector_number}_${spec.language}_${spec.finish}`;
		const timestamp = new Date(nowMs - spec.ageHours * 3600 * 1000).toISOString();
		const baseRecord: DemoCardRecord = {
			id: rowId,
			name: spec.name,
			set_code: spec.set_code,
			set_name: spec.set_name,
			collector_number: spec.collector_number,
			language: spec.language,
			finish: spec.finish,
			image_uri: scryfallNormalImage(spec.scryfallId),
			timestamp,
			max_price_cap: spec.max_price_cap,
			min_condition: spec.min_condition,
			cardtrader_id: '',
			cardtrader_stock: false,
			cardtrader_low_price: null,
			cardtrader_condition: null,
			tcgplayer_id: spec.tcgplayer_id,
			tcgplayer_stock: false,
			tcgplayer_low_price: null,
			tcgplayer_condition: null,
			cardmarket_id: spec.cardmarket_id,
			cardmarket_stock: false,
			cardmarket_low_price: null,
			ebay_id: '',
			ebay_stock: false,
			ebay_low_price: null,
			ebay_condition: null,
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
			ruten_url: '',
			demo_baseline_cents: spec.baselineCents,
			historical_pricing: null
		};

		if (spec.forceOutOfStock) {
			return {
				...baseRecord,
				...buildDemoVendorIdentifiers(baseRecord),
				historical_pricing: createOutOfStockHistoricalBaseline(nowMs)
			};
		}

		const simPatch = simulateVendorOffersForCard(baseRecord, spec.baselineCents, 1, null, nowMs);
		return {
			...baseRecord,
			...simPatch
		};
	});
}

export function createInitialDemoAlerts(
	cards: DemoCardRecord[],
	nowMs = Date.now()
): DemoAlertPreview[] {
	const cityEn = cards.find((c) => c.name === 'City of Traitors' && c.language === 'en');
	const demonicJa = cards.find((c) => c.name === 'Demonic Tutor' && c.language === 'ja');
	const forceEn = cards.find((c) => c.name === 'Force of Will');

	const alerts: DemoAlertPreview[] = [];

	if (cityEn) {
		const priceCents = cityEn.cardtrader_low_price ?? 52995;
		const floorCents = cityEn.historical_pricing?.nm_low_cents ?? Math.round(priceCents * 0.94);
		alerts.push({
			id: 'demo-alert-restock-city',
			kind: 'restock',
			createdAt: new Date(nowMs - 14 * 60 * 1000).toISOString(),
			cardName: cityEn.name,
			setCode: cityEn.set_code,
			collectorNumber: cityEn.collector_number,
			language: cityEn.language,
			finish: cityEn.finish,
			imageUri: cityEn.image_uri,
			vendor: 'cardtrader',
			vendorDisplayName: 'CardTrader',
			priceCents,
			condition: cityEn.cardtrader_condition || 'SP',
			priceCapCents: cityEn.max_price_cap,
			historicalContext: {
				tierLabel: 'NM/LP',
				isLowBreakthrough: false,
				activeLowCents: floorCents,
				activeLowVendor: cityEn.historical_pricing?.nm_low_vendor || 'cardtrader',
				prevLastSeenCents: Math.round(priceCents * 1.03),
				prevLastSeenCondition: 'SP',
				prevLastSeenVendor: 'tcgplayer',
				prevLastSeenAt: new Date(nowMs - 4 * 24 * 60 * 60 * 1000).toISOString()
			},
			buyUrl: `https://www.cardtrader.com/cards/${cityEn.cardtrader_id || '200001'}`
		});
	}

	if (demonicJa) {
		const priceCents = demonicJa.hareruya_low_price ?? 24200;
		const jpyVal = demonicJa.hareruya_price_jpy ?? Math.round((priceCents / 100) * 152);
		const oldPriceCents = Math.round(priceCents * 1.15);
		const floorCents = demonicJa.historical_pricing?.nm_low_cents ?? Math.round(priceCents * 0.96);
		alerts.push({
			id: 'demo-alert-drop-demonic',
			kind: 'price_drop',
			createdAt: new Date(nowMs - 48 * 60 * 1000).toISOString(),
			cardName: demonicJa.name,
			setCode: demonicJa.set_code,
			collectorNumber: demonicJa.collector_number,
			language: demonicJa.language,
			finish: demonicJa.finish,
			imageUri: demonicJa.image_uri,
			vendor: 'hareruya',
			vendorDisplayName: 'Hareruya',
			priceCents,
			nativePriceText: `(¥${Math.round(jpyVal).toLocaleString('en-US')})`,
			oldPriceCents,
			percentageDrop: 13,
			condition: demonicJa.hareruya_condition || 'NM',
			priceCapCents: demonicJa.max_price_cap,
			historicalContext: {
				tierLabel: 'NM/LP',
				isLowBreakthrough: false,
				activeLowCents: floorCents,
				activeLowVendor: demonicJa.historical_pricing?.nm_low_vendor || 'hareruya'
			},
			buyUrl:
				demonicJa.hareruya_url ||
				`https://www.hareruyamtg.com/en/products/search?product=${encodeURIComponent(demonicJa.name)}`
		});
	}

	if (forceEn) {
		const priceCents = forceEn.manapool_low_price ?? forceEn.cardtrader_low_price ?? 6290;
		const priorLow = Math.round(priceCents * 1.06);
		const isMp = forceEn.manapool_stock;
		alerts.push({
			id: 'demo-alert-atl-force',
			kind: 'historical_low',
			createdAt: new Date(nowMs - 110 * 60 * 1000).toISOString(),
			cardName: forceEn.name,
			setCode: forceEn.set_code,
			collectorNumber: forceEn.collector_number,
			language: forceEn.language,
			finish: forceEn.finish,
			imageUri: forceEn.image_uri,
			vendor: isMp ? 'manapool' : 'cardtrader',
			vendorDisplayName: isMp ? 'Mana Pool' : 'CardTrader',
			priceCents,
			historicalLowCents: priorLow,
			historicalContext: {
				tierLabel: 'NM/LP',
				isLowBreakthrough: true,
				previousLowCents: priorLow,
				previousLowVendor: 'tcgplayer',
				activeLowCents: priceCents,
				activeLowVendor: isMp ? 'manapool' : 'cardtrader'
			},
			condition: forceEn.manapool_condition || forceEn.cardtrader_condition || 'SP',
			priceCapCents: forceEn.max_price_cap,
			buyUrl: isMp
				? forceEn.manapool_url || `https://manapool.com/cards?q=${encodeURIComponent(forceEn.name)}`
				: `https://www.cardtrader.com/cards/${forceEn.cardtrader_id || '200002'}`
		});
	}

	return alerts;
}

export const SAMPLE_DEMO_DECKS: SampleDeckPreset[] = [
	{
		id: 'legacy-lands',
		title: 'Legacy Lands Staples',
		subtitle: '6 Reserved List & Japanese land staples',
		defaultLanguage: 'en',
		defaultFinish: 'nonfoil',
		cards: [
			{ name: 'Mox Diamond', set_code: 'sth', collector_number: '138', finish: 'nonfoil', language: 'en' },
			{ name: 'Ancient Tomb', set_code: 'tmp', collector_number: '315', finish: 'nonfoil', language: 'en' },
			{ name: 'The Tabernacle at Pendrell Vale', set_code: 'leg', collector_number: '307', finish: 'nonfoil', language: 'en' },
			{ name: 'Exploration', set_code: 'usg', collector_number: '250', finish: 'nonfoil', language: 'en' },
			{ name: 'Crop Rotation', set_code: 'ulg', collector_number: '98', finish: 'foil', language: 'en' },
			{ name: 'Wasteland', set_code: 'tmp', collector_number: '330', finish: 'nonfoil', language: 'en' }
		]
	},
	{
		id: 'cedh-blue-farm',
		title: 'cEDH Blue Farm Core',
		subtitle: '6 high-demand artifact & stack staples',
		defaultLanguage: 'en',
		defaultFinish: 'nonfoil',
		cards: [
			{ name: 'Chrome Mox', set_code: 'mrd', collector_number: '152', finish: 'foil', language: 'en' },
			{ name: 'Mystic Remora', set_code: 'ice', collector_number: '87', finish: 'nonfoil', language: 'en' },
			{ name: 'Smothering Tithe', set_code: 'rna', collector_number: '22', finish: 'foil', language: 'en' },
			{ name: 'Underworld Breach', set_code: 'thb', collector_number: '161', finish: 'foil', language: 'en' },
			{ name: 'Intuition', set_code: 'tmp', collector_number: '70', finish: 'nonfoil', language: 'en' },
			{ name: 'Vampiric Tutor', set_code: 'vis', collector_number: '72', finish: 'nonfoil', language: 'en' }
		]
	},
	{
		id: 'collector-japanese-alt',
		title: 'Japanese & Retro Etched Highlights',
		subtitle: '6 iconic alternate-art & etched collector printings',
		defaultLanguage: 'ja',
		defaultFinish: 'etched',
		cards: [
			{ name: 'Time Warp', set_code: 'sta', collector_number: '85', finish: 'etched', language: 'ja' },
			{ name: 'Tainted Pact', set_code: 'sta', collector_number: '96', finish: 'etched', language: 'ja' },
			{ name: 'Dark Ritual', set_code: 'sta', collector_number: '89', finish: 'etched', language: 'ja' },
			{ name: 'Misty Rainforest', set_code: 'mh2', collector_number: '438', finish: 'etched', language: 'en' },
			{ name: 'Arid Mesa', set_code: 'mh2', collector_number: '436', finish: 'etched', language: 'en' },
			{ name: 'Narset, Parter of Veils', set_code: 'war', collector_number: '61', finish: 'foil', language: 'ja' }
		]
	}
];
