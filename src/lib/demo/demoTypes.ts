export type FinishType = 'nonfoil' | 'foil' | 'etched';

export interface ScryfallPrices {
	usd?: string | null;
	usd_foil?: string | null;
	usd_etched?: string | null;
	eur?: string | null;
	eur_foil?: string | null;
}

export interface DemoUserSettings {
	stockAlertEnabled: boolean;
	stockDigestEnabled: boolean;
	stockDigestHourUtc: number;
	priceDropAlertEnabled: boolean;
	priceDropThreshold: number;
	preferredLanguage: string;
	preferredFinish: FinishType;
	minCondition: string;
	marketplaceCardtraderEnabled: boolean;
	marketplaceTcgplayerEnabled: boolean;
	marketplaceEbayEnabled: boolean;
	marketplaceManapoolEnabled: boolean;
	marketplaceCardkingdomEnabled: boolean;
	marketplaceHimarketEnabled: boolean;
	marketplaceHareruyaEnabled: boolean;
	marketplaceRutenEnabled: boolean;
	marketplaceCardmarketEnabled: false;
}

export interface DemoVendorLow {
	low_cents: number;
	low_cond: string;
	last_cents: number;
	last_at: string;
}

export interface DemoHistoricalPricing {
	is_calibrated: boolean;
	first_observed_at: string;
	observation_count: number;
	nm_low_cents: number | null;
	nm_low_condition: string | null;
	nm_low_vendor: string | null;
	nm_low_at: string | null;
	nm_last_seen_cents: number | null;
	nm_last_seen_condition: string | null;
	nm_last_seen_vendor: string | null;
	nm_last_seen_at: string | null;
	played_low_cents: number | null;
	played_low_condition: string | null;
	played_low_vendor: string | null;
	played_low_at: string | null;
	played_last_seen_cents: number | null;
	played_last_seen_condition: string | null;
	played_last_seen_vendor: string | null;
	played_last_seen_at: string | null;
	last_seen_cents: number | null;
	last_seen_condition: string | null;
	last_seen_vendor: string | null;
	last_seen_at: string | null;
	vendor_lows: Record<string, DemoVendorLow>;
	history?: Array<{
		date: string;
		nm_cents: number | null;
		played_cents: number | null;
	}>;
}

export interface DemoCardRecord {
	id: string;
	name: string;
	set_code: string;
	set_name: string;
	collector_number: string;
	language: string;
	finish: FinishType;
	image_uri: string;
	timestamp: string;
	last_manual_check?: string;
	max_price_cap: number | null;
	min_condition: string | null;
	cardtrader_id: string | number;
	cardtrader_stock: boolean;
	cardtrader_low_price: number | null;
	cardtrader_condition: string | null;
	tcgplayer_id: string | number;
	tcgplayer_stock: boolean;
	tcgplayer_low_price: number | null;
	tcgplayer_condition: string | null;
	cardmarket_id: string | number;
	cardmarket_stock: false;
	cardmarket_low_price: null;
	cardmarket_condition?: null;
	ebay_id: string;
	ebay_stock: boolean;
	ebay_low_price: number | null;
	ebay_condition: string | null;
	manapool_stock: boolean;
	manapool_low_price: number | null;
	manapool_condition: string | null;
	manapool_id: string;
	manapool_url: string;
	himarket_stock: boolean;
	himarket_low_price: number | null;
	himarket_price_hkd: number | null;
	himarket_condition: string | null;
	himarket_url: string;
	cardkingdom_stock: boolean;
	cardkingdom_low_price: number | null;
	cardkingdom_condition: string | null;
	cardkingdom_url: string;
	hareruya_stock: boolean;
	hareruya_low_price: number | null;
	hareruya_price_jpy: number | null;
	hareruya_condition: string | null;
	hareruya_url: string;
	ruten_stock: boolean;
	ruten_low_price: number | null;
	ruten_price_twd: number | null;
	ruten_condition: string | null;
	ruten_url: string;
	historical_pricing?: DemoHistoricalPricing | null;
	demo_baseline_cents?: number;
}

export type DemoAlertKind = 'restock' | 'price_drop' | 'historical_low';

export interface DemoAlertHistoricalContext {
	tierLabel: string;
	isLowBreakthrough: boolean;
	previousLowCents?: number | null;
	previousLowVendor?: string | null;
	activeLowCents?: number | null;
	activeLowVendor?: string | null;
	prevLastSeenCents?: number | null;
	prevLastSeenCondition?: string | null;
	prevLastSeenVendor?: string | null;
	prevLastSeenAt?: string | null;
}

export interface DemoAlertPreview {
	id: string;
	kind: DemoAlertKind;
	createdAt: string;
	cardName: string;
	setCode: string;
	collectorNumber: string;
	language: string;
	finish: FinishType;
	imageUri: string;
	vendor: string;
	vendorDisplayName: string;
	priceCents: number;
	nativePriceText?: string | null;
	oldPriceCents?: number | null;
	percentageDrop?: number | null;
	historicalLowCents?: number | null;
	historicalContext?: DemoAlertHistoricalContext | null;
	condition: string;
	priceCapCents?: number | null;
	buyUrl: string;
}

export interface SampleDeckCardItem {
	name: string;
	set_code?: string;
	collector_number?: string;
	finish?: FinishType;
	language?: string;
}

export interface SampleDeckPreset {
	id: string;
	title: string;
	subtitle: string;
	defaultLanguage: string;
	defaultFinish: FinishType;
	cards: SampleDeckCardItem[];
}
