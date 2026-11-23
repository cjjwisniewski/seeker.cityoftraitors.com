import { browser } from '$app/environment';
import * as staticPublicEnvModule from '$env/static/public';
import { writable } from 'svelte/store';
import {
	buildDemoVendorIdentifiers,
	extractScryfallBaselineCents,
	simulateVendorOffersForCard
} from './demoPricing';
import {
	createInitialDemoAlerts,
	createInitialDemoCards,
	DEFAULT_DEMO_SETTINGS,
	DEMO_MAX_CARDS,
	DEMO_STORAGE_KEYS
} from './demoSeed';
import type {
	DemoAlertPreview,
	DemoCardRecord,
	DemoUserSettings,
	FinishType,
	ScryfallPrices
} from './demoTypes';

const MANUAL_COOLDOWN_MS = 120_000;
const NEW_CARD_SIM_DELAY_MS = 2_200;
const MAX_STORED_ALERTS = 25;

const ALLOWED_FINISHES = new Set<FinishType>(['nonfoil', 'foil', 'etched']);
const ALLOWED_CONDITIONS = new Set(['ANY', 'NM', 'SP', 'MP', 'HP', 'DMG']);
const ALLOWED_LANGUAGES = new Set([
	'en',
	'ja',
	'zht',
	'zhs',
	'de',
	'fr',
	'it',
	'es',
	'pt',
	'ko',
	'ru',
	'he',
	'la',
	'ar',
	'sa',
	'ph'
]);

const ALLOWED_DEMO_SETTING_KEYS = new Set<keyof DemoUserSettings>([
	'stockAlertEnabled',
	'stockDigestEnabled',
	'stockDigestHourUtc',
	'priceDropAlertEnabled',
	'priceDropThreshold',
	'preferredLanguage',
	'preferredFinish',
	'minCondition',
	'marketplaceCardtraderEnabled',
	'marketplaceTcgplayerEnabled',
	'marketplaceEbayEnabled',
	'marketplaceManapoolEnabled',
	'marketplaceCardkingdomEnabled',
	'marketplaceHimarketEnabled',
	'marketplaceHareruyaEnabled',
	'marketplaceRutenEnabled'
]);

const CONDITION_RANK: Record<string, number> = {
	NM: 5,
	M: 5,
	SP: 4,
	LP: 4,
	MP: 3,
	HP: 2,
	DMG: 1,
	D: 1
};

export const demoAlertsStore = writable<DemoAlertPreview[]>([]);
export const demoAlertModalOpen = writable<boolean>(false);
export const demoSelectedAlertId = writable<string | null>(null);
export const demoResetNonce = writable<number>(0);

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function openDemoAlertPreviews(alertId: string | null = null): void {
	demoSelectedAlertId.set(alertId);
	demoAlertModalOpen.set(true);
}

export function closeDemoAlertPreviews(): void {
	demoAlertModalOpen.set(false);
}

function safeJsonParse<T>(raw: string | null): T | null {
	if (!raw || typeof raw !== 'string') return null;
	try {
		return JSON.parse(raw, (key, value) => {
			if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
				return undefined;
			}
			return value;
		}) as T;
	} catch {
		return null;
	}
}

function readStorageItem(key: string): string | null {
	if (!browser) return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorageItem(key: string, value: string): void {
	if (!browser) return;
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Ignore quota errors cleanly inside sandbox
	}
}

function sanitizeSafeUrl(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	const trimmed = raw.trim().slice(0, 500);
	if (!trimmed) return '';
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
			return parsed.href;
		}
	} catch {
		return '';
	}
	return '';
}

function clampBoundedInt(value: unknown, min: number, max: number): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	if (rounded < min || rounded > max) return null;
	return rounded;
}

function sanitizeFinish(raw: unknown, fallback: FinishType = 'nonfoil'): FinishType {
	if (typeof raw === 'string') {
		const lower = raw.trim().toLowerCase() as FinishType;
		if (ALLOWED_FINISHES.has(lower)) return lower;
	}
	return fallback;
}

function sanitizeLanguage(raw: unknown, fallback = 'en'): string {
	if (typeof raw === 'string') {
		const lower = raw.trim().toLowerCase();
		if (ALLOWED_LANGUAGES.has(lower) || /^[a-z]{2,4}$/.test(lower)) {
			return lower;
		}
	}
	return fallback;
}

function sanitizeDemoSettings(input: unknown): DemoUserSettings {
	const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
	const hour = clampBoundedInt(src.stockDigestHourUtc, 0, 23);
	const threshold = clampBoundedInt(src.priceDropThreshold, 1, 99);
	const minCond =
		typeof src.minCondition === 'string' && ALLOWED_CONDITIONS.has(src.minCondition.toUpperCase())
			? src.minCondition.toUpperCase()
			: DEFAULT_DEMO_SETTINGS.minCondition;

	return {
		stockAlertEnabled:
			typeof src.stockAlertEnabled === 'boolean'
				? src.stockAlertEnabled
				: DEFAULT_DEMO_SETTINGS.stockAlertEnabled,
		stockDigestEnabled:
			typeof src.stockDigestEnabled === 'boolean'
				? src.stockDigestEnabled
				: DEFAULT_DEMO_SETTINGS.stockDigestEnabled,
		stockDigestHourUtc: hour ?? DEFAULT_DEMO_SETTINGS.stockDigestHourUtc,
		priceDropAlertEnabled:
			typeof src.priceDropAlertEnabled === 'boolean'
				? src.priceDropAlertEnabled
				: DEFAULT_DEMO_SETTINGS.priceDropAlertEnabled,
		priceDropThreshold: threshold ?? DEFAULT_DEMO_SETTINGS.priceDropThreshold,
		preferredLanguage: sanitizeLanguage(src.preferredLanguage, DEFAULT_DEMO_SETTINGS.preferredLanguage),
		preferredFinish: sanitizeFinish(src.preferredFinish, DEFAULT_DEMO_SETTINGS.preferredFinish),
		minCondition: minCond,
		marketplaceCardtraderEnabled:
			typeof src.marketplaceCardtraderEnabled === 'boolean'
				? src.marketplaceCardtraderEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceCardtraderEnabled,
		marketplaceTcgplayerEnabled:
			typeof src.marketplaceTcgplayerEnabled === 'boolean'
				? src.marketplaceTcgplayerEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceTcgplayerEnabled,
		marketplaceEbayEnabled:
			typeof src.marketplaceEbayEnabled === 'boolean'
				? src.marketplaceEbayEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceEbayEnabled,
		marketplaceManapoolEnabled:
			typeof src.marketplaceManapoolEnabled === 'boolean'
				? src.marketplaceManapoolEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceManapoolEnabled,
		marketplaceCardkingdomEnabled:
			typeof src.marketplaceCardkingdomEnabled === 'boolean'
				? src.marketplaceCardkingdomEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceCardkingdomEnabled,
		marketplaceHimarketEnabled:
			typeof src.marketplaceHimarketEnabled === 'boolean'
				? src.marketplaceHimarketEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceHimarketEnabled,
		marketplaceHareruyaEnabled:
			typeof src.marketplaceHareruyaEnabled === 'boolean'
				? src.marketplaceHareruyaEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceHareruyaEnabled,
		marketplaceRutenEnabled:
			typeof src.marketplaceRutenEnabled === 'boolean'
				? src.marketplaceRutenEnabled
				: DEFAULT_DEMO_SETTINGS.marketplaceRutenEnabled,
		// CardMarket is strictly tier-gated and disabled in public demo
		marketplaceCardmarketEnabled: false
	};
}

function getDemoCardKey(card: Pick<DemoCardRecord, 'set_code' | 'collector_number' | 'language' | 'finish'>): string {
	return `${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`;
}

function sanitizeCardRecord(
	raw: unknown
): (DemoCardRecord & { demo_pending_until?: number; demo_generation?: number }) | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const name = typeof r.name === 'string' ? r.name.trim().slice(0, 200) : '';
	const setCode = typeof r.set_code === 'string' ? r.set_code.trim().toLowerCase().slice(0, 20) : '';
	const collectorNumber =
		typeof r.collector_number === 'string' ? r.collector_number.trim().slice(0, 32) : '';
	if (!name || !setCode || !collectorNumber) return null;

	const finish = sanitizeFinish(r.finish, 'nonfoil');
	const language = sanitizeLanguage(r.language, 'en');
	const maxPriceCap = clampBoundedInt(r.max_price_cap, 1, 10_000_000);
	const minCondition =
		typeof r.min_condition === 'string' && ALLOWED_CONDITIONS.has(r.min_condition.toUpperCase())
			? r.min_condition.toUpperCase()
			: null;

	const sanitizePrice = (v: unknown): number | null => clampBoundedInt(v, 1, 10_000_000);
	const sanitizeFx = (v: unknown): number | null =>
		typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 500_000_000 ? v : null;
	const sanitizeCond = (v: unknown): string | null =>
		typeof v === 'string' && v.trim() ? v.trim().toUpperCase().slice(0, 8) : null;

	const record: DemoCardRecord & { demo_pending_until?: number; demo_generation?: number } = {
		id:
			typeof r.id === 'string' && r.id.trim()
				? r.id.trim().slice(0, 100)
				: `${collectorNumber}_${language}_${finish}`,
		name,
		set_code: setCode,
		set_name: typeof r.set_name === 'string' ? r.set_name.trim().slice(0, 150) : setCode.toUpperCase(),
		collector_number: collectorNumber,
		language,
		finish,
		image_uri: sanitizeSafeUrl(r.image_uri),
		timestamp: typeof r.timestamp === 'string' ? r.timestamp : new Date().toISOString(),
		...(typeof r.last_manual_check === 'string' ? { last_manual_check: r.last_manual_check } : {}),
		max_price_cap: maxPriceCap,
		min_condition: minCondition,
		cardtrader_id:
			typeof r.cardtrader_id === 'string' || typeof r.cardtrader_id === 'number'
				? r.cardtrader_id
				: '',
		cardtrader_stock: Boolean(r.cardtrader_stock),
		cardtrader_low_price: sanitizePrice(r.cardtrader_low_price),
		cardtrader_condition: sanitizeCond(r.cardtrader_condition),
		tcgplayer_id:
			typeof r.tcgplayer_id === 'string' || typeof r.tcgplayer_id === 'number' ? r.tcgplayer_id : '',
		tcgplayer_stock: Boolean(r.tcgplayer_stock),
		tcgplayer_low_price: sanitizePrice(r.tcgplayer_low_price),
		tcgplayer_condition: sanitizeCond(r.tcgplayer_condition),
		cardmarket_id:
			typeof r.cardmarket_id === 'string' || typeof r.cardmarket_id === 'number'
				? r.cardmarket_id
				: '',
		cardmarket_stock: false,
		cardmarket_low_price: null,
		ebay_id: typeof r.ebay_id === 'string' ? r.ebay_id.slice(0, 64) : '',
		ebay_stock: Boolean(r.ebay_stock),
		ebay_low_price: sanitizePrice(r.ebay_low_price),
		ebay_condition: sanitizeCond(r.ebay_condition),
		manapool_stock: Boolean(r.manapool_stock),
		manapool_low_price: sanitizePrice(r.manapool_low_price),
		manapool_condition: sanitizeCond(r.manapool_condition),
		manapool_id: typeof r.manapool_id === 'string' ? r.manapool_id.slice(0, 64) : '',
		manapool_url: sanitizeSafeUrl(r.manapool_url),
		himarket_stock: Boolean(r.himarket_stock),
		himarket_low_price: sanitizePrice(r.himarket_low_price),
		himarket_price_hkd: sanitizeFx(r.himarket_price_hkd),
		himarket_condition: sanitizeCond(r.himarket_condition),
		himarket_url: sanitizeSafeUrl(r.himarket_url),
		cardkingdom_stock: Boolean(r.cardkingdom_stock),
		cardkingdom_low_price: sanitizePrice(r.cardkingdom_low_price),
		cardkingdom_condition: sanitizeCond(r.cardkingdom_condition),
		cardkingdom_url: sanitizeSafeUrl(r.cardkingdom_url),
		hareruya_stock: Boolean(r.hareruya_stock),
		hareruya_low_price: sanitizePrice(r.hareruya_low_price),
		hareruya_price_jpy: sanitizeFx(r.hareruya_price_jpy),
		hareruya_condition: sanitizeCond(r.hareruya_condition),
		hareruya_url: sanitizeSafeUrl(r.hareruya_url),
		ruten_stock: Boolean(r.ruten_stock),
		ruten_low_price: sanitizePrice(r.ruten_low_price),
		ruten_price_twd: sanitizeFx(r.ruten_price_twd),
		ruten_condition: sanitizeCond(r.ruten_condition),
		ruten_url: sanitizeSafeUrl(r.ruten_url),
		historical_pricing:
			r.historical_pricing && typeof r.historical_pricing === 'object'
				? (r.historical_pricing as DemoCardRecord['historical_pricing'])
				: null,
		demo_baseline_cents: clampBoundedInt(r.demo_baseline_cents, 1, 10_000_000) ?? undefined
	};

	if (typeof r.demo_pending_until === 'number' && Number.isFinite(r.demo_pending_until)) {
		record.demo_pending_until = r.demo_pending_until;
	}
	if (typeof r.demo_generation === 'number' && Number.isFinite(r.demo_generation)) {
		record.demo_generation = Math.max(0, Math.round(r.demo_generation));
	}

	const defaultIds = buildDemoVendorIdentifiers(record);
	if (!record.cardtrader_id) record.cardtrader_id = defaultIds.cardtrader_id;
	if (!record.tcgplayer_id) record.tcgplayer_id = defaultIds.tcgplayer_id;
	if (!record.manapool_id) record.manapool_id = defaultIds.manapool_id;
	if (!record.manapool_url) record.manapool_url = defaultIds.manapool_url;
	if (!record.cardkingdom_url) record.cardkingdom_url = defaultIds.cardkingdom_url;
	if (!record.himarket_url) record.himarket_url = defaultIds.himarket_url;
	if (!record.hareruya_url) record.hareruya_url = defaultIds.hareruya_url;
	if (!record.ruten_url && defaultIds.ruten_url) record.ruten_url = defaultIds.ruten_url;

	return record;
}

type StoredDemoCard = DemoCardRecord & { demo_pending_until?: number; demo_generation?: number };

export function loadDemoSettings(): DemoUserSettings {
	const raw = readStorageItem(DEMO_STORAGE_KEYS.SETTINGS);
	const parsed = safeJsonParse<unknown>(raw);
	const sanitized = sanitizeDemoSettings(parsed);
	if (!raw) {
		writeStorageItem(DEMO_STORAGE_KEYS.SETTINGS, JSON.stringify(sanitized));
	}
	return sanitized;
}

export function saveDemoSettings(settings: DemoUserSettings): DemoUserSettings {
	const sanitized = sanitizeDemoSettings(settings);
	writeStorageItem(DEMO_STORAGE_KEYS.SETTINGS, JSON.stringify(sanitized));
	return sanitized;
}

function loadRawDemoAlerts(seedCards: DemoCardRecord[]): DemoAlertPreview[] {
	const raw = readStorageItem(DEMO_STORAGE_KEYS.ALERTS);
	const parsed = safeJsonParse<unknown>(raw);
	if (Array.isArray(parsed)) {
		const valid = parsed
			.filter((a): a is DemoAlertPreview => Boolean(a && typeof a === 'object' && typeof (a as DemoAlertPreview).cardName === 'string'))
			.slice(0, MAX_STORED_ALERTS);
		return valid;
	}
	const seeded = createInitialDemoAlerts(seedCards);
	writeStorageItem(DEMO_STORAGE_KEYS.ALERTS, JSON.stringify(seeded));
	return seeded;
}

function saveDemoAlerts(alerts: DemoAlertPreview[]): void {
	const capped = alerts.slice(0, MAX_STORED_ALERTS);
	writeStorageItem(DEMO_STORAGE_KEYS.ALERTS, JSON.stringify(capped));
	demoAlertsStore.set(capped);
}

interface BestOfferSummary {
	vendor: string;
	vendorDisplayName: string;
	priceCents: number;
	nativePriceText: string | null;
	condition: string;
	buyUrl: string;
}

function getBestQualifiedOffer(
	card: DemoCardRecord,
	settings: DemoUserSettings
): BestOfferSummary | null {
	const effectiveMinCond = (card.min_condition || settings.minCondition || 'ANY').toUpperCase();
	const minRank = CONDITION_RANK[effectiveMinCond] ?? 0;

	const tcgLangMap: Record<string, string> = {
		en: 'English',
		ja: 'Japanese',
		jp: 'Japanese',
		de: 'German',
		fr: 'French',
		it: 'Italian',
		es: 'Spanish',
		pt: 'Portuguese',
		ru: 'Russian',
		ko: 'Korean',
		kr: 'Korean',
		zht: 'Chinese (T)',
		zhs: 'Chinese (S)'
	};
	const tcgLang = encodeURIComponent(tcgLangMap[card.language.toLowerCase()] || 'English');
	const tcgPrint = encodeURIComponent(card.finish === 'foil' || card.finish === 'etched' ? 'Foil' : 'Normal');

	const candidates: Array<{
		vendor: string;
		label: string;
		enabled: boolean;
		stock: boolean;
		price: number | null;
		nativeText: string | null;
		cond: string | null;
		url: string;
	}> = [
		{
			vendor: 'cardtrader',
			label: 'CardTrader',
			enabled: settings.marketplaceCardtraderEnabled,
			stock: card.cardtrader_stock,
			price: card.cardtrader_low_price,
			nativeText: null,
			cond: card.cardtrader_condition,
			url: card.cardtrader_id
				? `https://www.cardtrader.com/cards/${encodeURIComponent(String(card.cardtrader_id))}`
				: `https://www.cardtrader.com/cards?search=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'tcgplayer',
			label: 'TCGPlayer',
			enabled: settings.marketplaceTcgplayerEnabled,
			stock: card.tcgplayer_stock,
			price: card.tcgplayer_low_price,
			nativeText: null,
			cond: card.tcgplayer_condition,
			url: card.tcgplayer_id
				? `https://www.tcgplayer.com/product/${encodeURIComponent(String(card.tcgplayer_id))}?Language=${tcgLang}&Printing=${tcgPrint}`
				: `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'manapool',
			label: 'Mana Pool',
			enabled: settings.marketplaceManapoolEnabled,
			stock: card.manapool_stock,
			price: card.manapool_low_price,
			nativeText: null,
			cond: card.manapool_condition,
			url: card.manapool_url || `https://manapool.com/cards?q=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'cardkingdom',
			label: 'Card Kingdom',
			enabled: settings.marketplaceCardkingdomEnabled,
			stock: card.cardkingdom_stock,
			price: card.cardkingdom_low_price,
			nativeText: null,
			cond: card.cardkingdom_condition,
			url:
				card.cardkingdom_url ||
				`https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'himarket',
			label: 'HiMarket',
			enabled: settings.marketplaceHimarketEnabled,
			stock: card.himarket_stock,
			price: card.himarket_low_price,
			nativeText: card.himarket_price_hkd ? `(HK$${card.himarket_price_hkd.toFixed(2)})` : null,
			cond: card.himarket_condition,
			url: card.himarket_url || `https://www.himarket.hk/search?q=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'hareruya',
			label: 'Hareruya',
			enabled: settings.marketplaceHareruyaEnabled,
			stock: card.hareruya_stock,
			price: card.hareruya_low_price,
			nativeText: card.hareruya_price_jpy
				? `(¥${Math.round(card.hareruya_price_jpy).toLocaleString('en-US')})`
				: null,
			cond: card.hareruya_condition,
			url:
				card.hareruya_url ||
				`https://www.hareruyamtg.com/en/products/search?product=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'ruten',
			label: 'Ruten',
			enabled: settings.marketplaceRutenEnabled && ['zht', 'en'].includes(card.language.toLowerCase()),
			stock: card.ruten_stock,
			price: card.ruten_low_price,
			nativeText: card.ruten_price_twd
				? `(NT$${Math.round(card.ruten_price_twd).toLocaleString('en-US')})`
				: null,
			cond: card.ruten_condition,
			url: card.ruten_url || `https://www.ruten.com.tw/find/?q=${encodeURIComponent(card.name)}`
		},
		{
			vendor: 'ebay',
			label: 'eBay',
			enabled: settings.marketplaceEbayEnabled,
			stock: card.ebay_stock,
			price: card.ebay_low_price,
			nativeText: null,
			cond: card.ebay_condition,
			url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.name)}&_sop=15`
		}
	];

	const qualified = candidates.filter((c) => {
		if (!c.enabled || !c.stock || c.price === null || c.price <= 0) return false;
		if (card.max_price_cap !== null && c.price > card.max_price_cap) return false;
		if (minRank > 0) {
			const condRank = CONDITION_RANK[(c.cond || 'NM').toUpperCase()] ?? 3;
			if (condRank < minRank) return false;
		}
		return true;
	});

	if (qualified.length === 0) return null;
	qualified.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
	const best = qualified[0];
	return {
		vendor: best.vendor,
		vendorDisplayName: best.label,
		priceCents: best.price!,
		nativePriceText: best.nativeText,
		condition: best.cond || 'NM',
		buyUrl: sanitizeSafeUrl(best.url) || 'https://www.cardtrader.com'
	};
}

function recordAlertIfQualified(
	prevCard: DemoCardRecord | null,
	nextCard: DemoCardRecord,
	settings: DemoUserSettings,
	forceAlert = false
): void {
	const bestNext = getBestQualifiedOffer(nextCard, settings);
	if (!bestNext) return;
	if (!settings.stockAlertEnabled && !forceAlert) return;

	const bestPrev = prevCard ? getBestQualifiedOffer(prevCard, settings) : null;
	let kind: DemoAlertPreview['kind'] | null = null;
	let oldPriceCents: number | null = null;
	let percentageDrop: number | null = null;
	let historicalLowCents: number | null = null;

	const isPlayed = ['MP', 'HP', 'DMG', 'D'].includes(bestNext.condition.toUpperCase());
	const tierLabel = isPlayed ? 'Played' : 'NM/LP';
	const hp = nextCard.historical_pricing;
	const tierFloorCents = isPlayed ? hp?.played_low_cents ?? null : hp?.nm_low_cents ?? null;
	const tierFloorVendor = isPlayed ? hp?.played_low_vendor ?? null : hp?.nm_low_vendor ?? null;

	if (!bestPrev) {
		kind = 'restock';
	} else if (
		settings.priceDropAlertEnabled &&
		bestNext.priceCents < bestPrev.priceCents &&
		Math.round(((bestPrev.priceCents - bestNext.priceCents) / bestPrev.priceCents) * 100) >=
			settings.priceDropThreshold
	) {
		kind = 'price_drop';
		oldPriceCents = bestPrev.priceCents;
		percentageDrop = Math.round(((bestPrev.priceCents - bestNext.priceCents) / bestPrev.priceCents) * 100);
	} else if (tierFloorCents !== null && bestNext.priceCents <= tierFloorCents) {
		kind = 'historical_low';
		historicalLowCents = tierFloorCents;
	} else if (forceAlert) {
		kind = 'restock';
	}

	if (!kind) return;

	const historicalContext = hp
		? {
				tierLabel,
				isLowBreakthrough: kind === 'historical_low',
				previousLowCents: kind === 'historical_low' ? historicalLowCents : tierFloorCents,
				previousLowVendor: tierFloorVendor,
				activeLowCents: tierFloorCents,
				activeLowVendor: tierFloorVendor,
				prevLastSeenCents: hp.last_seen_cents,
				prevLastSeenCondition: hp.last_seen_condition,
				prevLastSeenVendor: hp.last_seen_vendor,
				prevLastSeenAt: hp.last_seen_at
			}
		: null;

	const alert: DemoAlertPreview = {
		id: `demo-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		kind,
		createdAt: new Date().toISOString(),
		cardName: nextCard.name,
		setCode: nextCard.set_code,
		collectorNumber: nextCard.collector_number,
		language: nextCard.language,
		finish: nextCard.finish,
		imageUri: nextCard.image_uri,
		vendor: bestNext.vendor,
		vendorDisplayName: bestNext.vendorDisplayName,
		priceCents: bestNext.priceCents,
		nativePriceText: bestNext.nativePriceText,
		oldPriceCents,
		percentageDrop,
		historicalLowCents,
		historicalContext,
		condition: bestNext.condition,
		priceCapCents: nextCard.max_price_cap,
		buyUrl: bestNext.buyUrl
	};

	const cards = loadRawDemoCardsWithoutMaterialize();
	const currentAlerts = loadRawDemoAlerts(cards);
	const isDupRecent = currentAlerts.some(
		(a) =>
			a.kind === alert.kind &&
			a.cardName === alert.cardName &&
			a.setCode === alert.setCode &&
			a.collectorNumber === alert.collectorNumber &&
			a.vendor === alert.vendor &&
			a.priceCents === alert.priceCents
	);
	if (!isDupRecent) {
		saveDemoAlerts([alert, ...currentAlerts]);
	}
}

function loadRawDemoCardsWithoutMaterialize(): StoredDemoCard[] {
	const raw = readStorageItem(DEMO_STORAGE_KEYS.CARDS);
	const parsed = safeJsonParse<unknown>(raw);
	if (Array.isArray(parsed)) {
		const cleaned: StoredDemoCard[] = [];
		const seen = new Set<string>();
		for (const item of parsed) {
			const c = sanitizeCardRecord(item);
			if (!c) continue;
			const key = getDemoCardKey(c);
			if (seen.has(key)) continue;
			seen.add(key);
			cleaned.push(c);
			if (cleaned.length >= DEMO_MAX_CARDS) break;
		}
		return cleaned;
	}

	const initial = createInitialDemoCards();
	writeStorageItem(DEMO_STORAGE_KEYS.CARDS, JSON.stringify(initial));
	return initial;
}

function materializePendingCards(cards: StoredDemoCard[], settings: DemoUserSettings): StoredDemoCard[] {
	const nowMs = Date.now();
	let mutated = false;
	const updated = cards.map((card) => {
		if (card.demo_pending_until && nowMs >= card.demo_pending_until) {
			mutated = true;
			const baseline = card.demo_baseline_cents || extractScryfallBaselineCents(null, card.finish, getDemoCardKey(card));
			const nextGen = (card.demo_generation ?? 0) + 1;
			const patch = simulateVendorOffersForCard(
				card,
				baseline,
				nextGen,
				card.historical_pricing ?? null,
				nowMs
			);
			const nextCard: StoredDemoCard = {
				...card,
				...patch,
				demo_generation: nextGen
			};
			delete nextCard.demo_pending_until;
			recordAlertIfQualified(null, nextCard, settings);
			return nextCard;
		}
		return card;
	});

	if (mutated) {
		writeStorageItem(DEMO_STORAGE_KEYS.CARDS, JSON.stringify(updated));
	}
	return updated;
}

function scheduleCardMaterialization(cardKey: string, delayMs: number): void {
	if (!browser) return;
	const existing = pendingTimers.get(cardKey);
	if (existing) clearTimeout(existing);
	const handle = setTimeout(() => {
		pendingTimers.delete(cardKey);
		const settings = loadDemoSettings();
		const cards = loadRawDemoCardsWithoutMaterialize();
		materializePendingCards(cards, settings);
	}, delayMs);
	pendingTimers.set(cardKey, handle);
}

export function loadDemoCards(): DemoCardRecord[] {
	const settings = loadDemoSettings();
	const rawCards = loadRawDemoCardsWithoutMaterialize();
	const materialized = materializePendingCards(rawCards, settings);
	// Schedule timers for any cards still within their ~2.2s simulation window
	const nowMs = Date.now();
	for (const card of materialized) {
		if (card.demo_pending_until && card.demo_pending_until > nowMs) {
			scheduleCardMaterialization(getDemoCardKey(card), card.demo_pending_until - nowMs + 50);
		}
	}
	return materialized;
}

function saveDemoCards(cards: StoredDemoCard[]): void {
	writeStorageItem(DEMO_STORAGE_KEYS.CARDS, JSON.stringify(cards.slice(0, DEMO_MAX_CARDS)));
}

export function initializeDemoStorage(): DemoUserSettings {
	const settings = loadDemoSettings();
	const cards = loadDemoCards();
	const alerts = loadRawDemoAlerts(cards);
	demoAlertsStore.set(alerts);
	return settings;
}

let demoSnapshotHydrated = false;

/**
 * Best-effort, non-blocking refresh of seeded Demo Mode historical pricing from
 * the daily static `/demo-snapshot.json` blob (if deployed to `$web`).
 * Falls back silently to built-in `demoSeed.ts` data when absent or offline.
 */
export async function hydrateDemoFromLiveSnapshot(): Promise<boolean> {
	if (!browser || typeof fetch !== 'function' || demoSnapshotHydrated) return false;
	demoSnapshotHydrated = true;
	try {
		const res = await fetch('/demo-snapshot.json', { cache: 'default' });
		if (!res.ok) return false;
		const contentType = res.headers.get('content-type') || '';
		if (!contentType.includes('application/json')) return false;
		const snapshot = await res.json();
		const cardMap = snapshot?.cards;
		if (!cardMap || typeof cardMap !== 'object') return false;

		const existing = loadDemoCards();
		let updated = false;
		const next = existing.map((card) => {
			const key = `${String(card.set_code || '').toLowerCase()}|${card.collector_number}_${String(card.language || 'en').toLowerCase()}_${String(card.finish || 'nonfoil').toLowerCase()}`;
			const live = cardMap[key];
			if (live && live.historical_pricing && typeof live.historical_pricing === 'object') {
				updated = true;
				return {
					...card,
					historical_pricing: {
						...(card.historical_pricing || {}),
						...live.historical_pricing
					}
				};
			}
			return card;
		});
		if (updated) {
			writeStorageItem(DEMO_STORAGE_KEYS.CARDS, JSON.stringify(next));
		}
		return updated;
	} catch {
		return false;
	}
}

export function resetDemoWorkspace(): DemoUserSettings {
	for (const timer of pendingTimers.values()) {
		clearTimeout(timer);
	}
	pendingTimers.clear();

	const freshSettings = { ...DEFAULT_DEMO_SETTINGS };
	const freshCards = createInitialDemoCards();
	const freshAlerts = createInitialDemoAlerts(freshCards);

	writeStorageItem(DEMO_STORAGE_KEYS.SETTINGS, JSON.stringify(freshSettings));
	writeStorageItem(DEMO_STORAGE_KEYS.CARDS, JSON.stringify(freshCards));
	saveDemoAlerts(freshAlerts);
	demoResetNonce.update((n) => n + 1);
	return freshSettings;
}

export function buildDemoLastChecked(nowMs = Date.now()): Record<string, string | null> {
	const mk = (minsAgo: number): string => new Date(nowMs - minsAgo * 60_000).toISOString();
	return {
		cardtrader: mk(3),
		tcgplayer: mk(5),
		manapool: mk(4),
		cardkingdom: mk(7),
		himarket: mk(9),
		hareruya: mk(8),
		ruten: mk(11),
		ebay: mk(6),
		cardmarket: null
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function getConfiguredUrl(name: string): string {
	const staticMap = staticPublicEnvModule as unknown as Record<string, string | undefined>;
	return (staticMap[name] || '').trim();
}

function matchesEndpoint(rawUrl: string, envName: string, slugFallback: string): boolean {
	const configured = getConfiguredUrl(envName);
	if (configured) {
		try {
			const parsedReq = new URL(rawUrl, 'https://seeker.cityoftraitors.com');
			const parsedCfg = new URL(configured, 'https://seeker.cityoftraitors.com');
			if (parsedReq.pathname === parsedCfg.pathname && parsedReq.origin === parsedCfg.origin) {
				return true;
			}
		} catch {
			if (rawUrl.split('?')[0] === configured.split('?')[0]) return true;
		}
	}
	try {
		const parsed = new URL(rawUrl, 'https://seeker.cityoftraitors.com');
		const pathLower = parsed.pathname.toLowerCase();
		return pathLower === `/seeker/${slugFallback}` || pathLower === `/api/${slugFallback}` || pathLower.endsWith(`/${slugFallback}`);
	} catch {
		return false;
	}
}

function hasDisallowedQueryParams(rawUrl: string): boolean {
	try {
		const parsed = new URL(rawUrl, 'https://seeker.cityoftraitors.com');
		return parsed.searchParams.has('targetUserId') || parsed.searchParams.has('userId');
	} catch {
		return true;
	}
}

function createPendingCardFromPayload(
	payload: Record<string, unknown>,
	nowMs: number
): StoredDemoCard | null {
	const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 200) : '';
	const setCode = typeof payload.set_code === 'string' ? payload.set_code.trim().toLowerCase().slice(0, 20) : '';
	const collectorNumber =
		typeof payload.collector_number === 'string' ? payload.collector_number.trim().slice(0, 32) : '';
	if (!name || !setCode || !collectorNumber) return null;

	const finish = sanitizeFinish(payload.finish, 'nonfoil');
	const language = sanitizeLanguage(payload.language, 'en');
	const seedKey = `${setCode}-${collectorNumber}-${language}-${finish}`;
	const prices =
		payload.demo_scryfall_prices && typeof payload.demo_scryfall_prices === 'object'
			? (payload.demo_scryfall_prices as ScryfallPrices)
			: null;
	const baselineCents = extractScryfallBaselineCents(prices, finish, seedKey);
	const incomingTcgId =
		typeof payload.tcgplayer_id === 'string' || typeof payload.tcgplayer_id === 'number'
			? payload.tcgplayer_id
			: typeof payload.demo_tcgplayer_id === 'string' || typeof payload.demo_tcgplayer_id === 'number'
				? payload.demo_tcgplayer_id
				: '';

	const skeleton: StoredDemoCard = {
		id: `${collectorNumber}_${language}_${finish}`,
		name,
		set_code: setCode,
		set_name:
			typeof payload.set_name === 'string' && payload.set_name.trim()
				? payload.set_name.trim().slice(0, 150)
				: setCode.toUpperCase(),
		collector_number: collectorNumber,
		language,
		finish,
		image_uri: sanitizeSafeUrl(payload.image_uri),
		timestamp: new Date(nowMs).toISOString(),
		max_price_cap: clampBoundedInt(payload.max_price_cap, 1, 10_000_000),
		min_condition:
			typeof payload.min_condition === 'string' && ALLOWED_CONDITIONS.has(payload.min_condition.toUpperCase())
				? payload.min_condition.toUpperCase()
				: null,
		cardtrader_id: '',
		cardtrader_stock: false,
		cardtrader_low_price: null,
		cardtrader_condition: null,
		tcgplayer_id: incomingTcgId,
		tcgplayer_stock: false,
		tcgplayer_low_price: null,
		tcgplayer_condition: null,
		cardmarket_id: '',
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
		historical_pricing: null,
		demo_baseline_cents: baselineCents,
		demo_pending_until: nowMs + NEW_CARD_SIM_DELAY_MS,
		demo_generation: 0
	};

	return {
		...skeleton,
		...buildDemoVendorIdentifiers(skeleton)
	};
}

function findCardIndexByPartitionAndRow(
	cards: StoredDemoCard[],
	partitionKey: unknown,
	rowKey: unknown
): number {
	const setCode = typeof partitionKey === 'string' ? partitionKey.trim().toLowerCase() : '';
	const rowStr = typeof rowKey === 'string' ? rowKey.trim() : '';
	if (!setCode || !rowStr) return -1;

	return cards.findIndex((c) => {
		if (c.set_code.toLowerCase() !== setCode) return false;
		const canonicalRow = `${c.collector_number}_${c.language}_${c.finish}`;
		return c.id === rowStr || canonicalRow === rowStr;
	});
}

function handleTriggerDemoStockCheck(body: Record<string, unknown>): Response {
	const cards = loadDemoCards() as StoredDemoCard[];
	const settings = loadDemoSettings();
	const idx = findCardIndexByPartitionAndRow(cards, body.partitionKey, body.rowKey);
	if (idx < 0) {
		return jsonResponse({ message: 'Card not found in demo seeking list.' }, 404);
	}

	const card = cards[idx];
	const nowMs = Date.now();
	if (card.last_manual_check) {
		const lastMs = Date.parse(card.last_manual_check);
		if (Number.isFinite(lastMs) && nowMs - lastMs < MANUAL_COOLDOWN_MS) {
			const remainingSec = Math.ceil((MANUAL_COOLDOWN_MS - (nowMs - lastMs)) / 1000);
			return jsonResponse(
				{
					message: `Please wait ${remainingSec}s before running another manual stock check on ${card.name}.`,
					last_manual_check: card.last_manual_check
				},
				429
			);
		}
	}

	const checkedIso = new Date(nowMs).toISOString();
	const nextGen = (card.demo_generation ?? 1) + 1;
	const baseline =
		card.demo_baseline_cents || extractScryfallBaselineCents(null, card.finish, getDemoCardKey(card));
	const simPatch = simulateVendorOffersForCard(
		card,
		baseline,
		nextGen,
		card.historical_pricing ?? null,
		nowMs
	);

	const updatedCard: StoredDemoCard = {
		...card,
		...simPatch,
		last_manual_check: checkedIso,
		demo_generation: nextGen
	};
	delete updatedCard.demo_pending_until;

	cards[idx] = updatedCard;
	saveDemoCards(cards);
	recordAlertIfQualified(card, updatedCard, settings, true);

	return jsonResponse({
		status: 'queued',
		demo_simulated: true,
		last_manual_check: checkedIso
	});
}

function validateSettingUpdate(settingName: unknown, settingValue: unknown): boolean {
	if (typeof settingName !== 'string' || !ALLOWED_DEMO_SETTING_KEYS.has(settingName as keyof DemoUserSettings)) {
		return false;
	}
	switch (settingName) {
		case 'stockAlertEnabled':
		case 'stockDigestEnabled':
		case 'priceDropAlertEnabled':
		case 'marketplaceCardtraderEnabled':
		case 'marketplaceTcgplayerEnabled':
		case 'marketplaceEbayEnabled':
		case 'marketplaceManapoolEnabled':
		case 'marketplaceCardkingdomEnabled':
		case 'marketplaceHimarketEnabled':
		case 'marketplaceHareruyaEnabled':
		case 'marketplaceRutenEnabled':
			return typeof settingValue === 'boolean';
		case 'stockDigestHourUtc':
			return clampBoundedInt(settingValue, 0, 23) !== null;
		case 'priceDropThreshold':
			return clampBoundedInt(settingValue, 1, 99) !== null;
		case 'preferredLanguage':
			return typeof settingValue === 'string' && ALLOWED_LANGUAGES.has(settingValue.toLowerCase());
		case 'preferredFinish':
			return typeof settingValue === 'string' && ALLOWED_FINISHES.has(settingValue.toLowerCase() as FinishType);
		case 'minCondition':
			return typeof settingValue === 'string' && ALLOWED_CONDITIONS.has(settingValue.toUpperCase());
		default:
			return false;
	}
}

/**
 * Strictly client-side fail-closed dispatcher for Demo Mode.
 * Never performs any network requests to Seeker Azure Functions or APIM.
 */
export async function handleDemoApiRequest(
	url: string,
	options: RequestInit = {}
): Promise<Response> {
	if (!browser || typeof url !== 'string' || !url.trim()) {
		return jsonResponse({ error: 'Invalid demo request.' }, 400);
	}

	if (hasDisallowedQueryParams(url)) {
		return jsonResponse({ error: 'Forbidden in Demo Sandbox.' }, 403);
	}

	const lowerUrl = url.toLowerCase();
	if (
		lowerUrl.includes('/admin') ||
		lowerUrl.includes('deleteuseraccount') ||
		lowerUrl.includes('getusertables') ||
		lowerUrl.includes('getsystemstatus') ||
		lowerUrl.includes('updatebanner') ||
		lowerUrl.includes('requeueuserstockchecks')
	) {
		return jsonResponse({ error: 'Admin and account-destructive operations are disabled in Demo Mode.' }, 403);
	}

	// Parse JSON body safely if supplied
	let bodyObj: Record<string, unknown> = {};
	if (typeof options.body === 'string' && options.body.trim()) {
		const parsed = safeJsonParse<unknown>(options.body);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return jsonResponse({ error: 'Invalid request body in Demo Mode.' }, 400);
		}
		bodyObj = parsed as Record<string, unknown>;
		if ('targetUserId' in bodyObj) {
			return jsonResponse({ error: 'Cross-user operations are disabled in Demo Mode.' }, 403);
		}
	}

	// 1. GET seeking list
	if (matchesEndpoint(url, 'PUBLIC_GET_SEEKING_LIST_FUNCTION_URL', 'getseekinglist')) {
		const cards = loadDemoCards();
		return jsonResponse({
			cards,
			lastChecked: buildDemoLastChecked()
		});
	}

	// 2. ADD to seeking (single or batch decklist import)
	if (matchesEndpoint(url, 'PUBLIC_ADD_TO_SEEKING_FUNCTION_URL', 'addtoseeking')) {
		if (bodyObj.action === 'fetch_moxfield') {
			return jsonResponse(
				{
					error:
						'Live Moxfield proxying is disabled in Demo Mode. Choose a built-in Sample Deck below or paste a decklist in Text Input.'
				},
				403
			);
		}

		const currentCards = loadDemoCards() as StoredDemoCard[];
		const nowMs = Date.now();

		if (bodyObj.action === 'add_batch') {
			const incoming = Array.isArray(bodyObj.cards) ? bodyObj.cards : [];
			const existingKeys = new Set(currentCards.map(getDemoCardKey));
			const added: DemoCardRecord[] = [];
			let skippedCount = 0;
			let limitReached = currentCards.length >= DEMO_MAX_CARDS;

			for (let idx = 0; idx < incoming.length; idx++) {
				if (currentCards.length >= DEMO_MAX_CARDS) {
					limitReached = true;
					break;
				}
				const item = incoming[idx];
				if (!item || typeof item !== 'object') {
					skippedCount++;
					continue;
				}
				const newCard = createPendingCardFromPayload(item as Record<string, unknown>, nowMs + idx);
				if (!newCard) {
					skippedCount++;
					continue;
				}
				const key = getDemoCardKey(newCard);
				if (existingKeys.has(key)) {
					skippedCount++;
					continue;
				}
				// Give decklist imports a short staggered simulation window so scheduleAutoPoll shows live progress
				newCard.demo_pending_until = nowMs + NEW_CARD_SIM_DELAY_MS;
				existingKeys.add(key);
				currentCards.unshift(newCard);
				added.push(newCard);
				scheduleCardMaterialization(key, NEW_CARD_SIM_DELAY_MS + 50);
			}

			saveDemoCards(currentCards);
			return jsonResponse({
				added,
				skipped_count: skippedCount,
				limit_reached: limitReached
			});
		}

		if (currentCards.length >= DEMO_MAX_CARDS) {
			return jsonResponse(
				{ message: `Demo Sandbox limit reached (${DEMO_MAX_CARDS} cards max). Reset or delete cards to add more.` },
				400
			);
		}

		const newCard = createPendingCardFromPayload(bodyObj, nowMs);
		if (!newCard) {
			return jsonResponse({ message: 'Missing required card printing fields.' }, 400);
		}

		const key = getDemoCardKey(newCard);
		if (currentCards.some((c) => getDemoCardKey(c) === key)) {
			return jsonResponse({ message: 'This exact printing is already on your seeking list.' }, 409);
		}

		currentCards.unshift(newCard);
		saveDemoCards(currentCards);
		scheduleCardMaterialization(key, NEW_CARD_SIM_DELAY_MS + 50);

		return jsonResponse({ message: 'Card added to demo seeking list.', card: newCard }, 201);
	}

	// 3. Dedicated manual stock check endpoint
	if (matchesEndpoint(url, 'PUBLIC_TRIGGER_STOCK_CHECK_FUNCTION_URL', 'triggerstockcheck')) {
		return handleTriggerDemoStockCheck(bodyObj);
	}

	// 4. UPDATE seeking card (including fallback action: 'check_stock')
	if (matchesEndpoint(url, 'PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL', 'updateseekingcard')) {
		if (bodyObj.action === 'check_stock') {
			return handleTriggerDemoStockCheck(bodyObj);
		}

		const cards = loadDemoCards() as StoredDemoCard[];
		const settings = loadDemoSettings();
		const idx = findCardIndexByPartitionAndRow(cards, bodyObj.partitionKey, bodyObj.rowKey);
		if (idx < 0) {
			return jsonResponse({ message: 'Card not found in demo seeking list.' }, 404);
		}

		const prevCard = cards[idx];
		const nextLanguage =
			typeof bodyObj.new_language === 'string' && bodyObj.new_language.trim()
				? sanitizeLanguage(bodyObj.new_language, prevCard.language)
				: prevCard.language;
		const nextFinish =
			typeof bodyObj.new_finish === 'string' && bodyObj.new_finish.trim()
				? sanitizeFinish(bodyObj.new_finish, prevCard.finish)
				: prevCard.finish;

		const isRekey = nextLanguage !== prevCard.language || nextFinish !== prevCard.finish;
		const nextRowKey = `${prevCard.collector_number}_${nextLanguage}_${nextFinish}`;
		const nextKey = getDemoCardKey({
			set_code: prevCard.set_code,
			collector_number: prevCard.collector_number,
			language: nextLanguage,
			finish: nextFinish
		});

		if (
			isRekey &&
			cards.some((c, i) => i !== idx && getDemoCardKey(c) === nextKey)
		) {
			return jsonResponse({ message: 'That language/finish printing already exists on your seeking list.' }, 409);
		}

		let nextMaxCap = prevCard.max_price_cap;
		if ('max_price_cap' in bodyObj) {
			nextMaxCap =
				bodyObj.max_price_cap === null
					? null
					: clampBoundedInt(bodyObj.max_price_cap, 1, 10_000_000);
		}

		let nextMinCond = prevCard.min_condition;
		if ('min_condition' in bodyObj) {
			nextMinCond =
				typeof bodyObj.min_condition === 'string' &&
				ALLOWED_CONDITIONS.has(bodyObj.min_condition.toUpperCase()) &&
				bodyObj.min_condition.toUpperCase() !== 'ANY'
					? bodyObj.min_condition.toUpperCase()
					: null;
		}

		const nextImage =
			typeof bodyObj.new_image_uri === 'string' && sanitizeSafeUrl(bodyObj.new_image_uri)
				? sanitizeSafeUrl(bodyObj.new_image_uri)
				: prevCard.image_uri;

		let updatedCard: StoredDemoCard = {
			...prevCard,
			id: isRekey ? nextRowKey : prevCard.id,
			language: nextLanguage,
			finish: nextFinish,
			image_uri: nextImage,
			max_price_cap: nextMaxCap,
			min_condition: nextMinCond
		};

		if (isRekey) {
			const finishMultiplier = nextFinish === 'foil' && prevCard.finish === 'nonfoil' ? 1.45 : nextFinish === 'nonfoil' && prevCard.finish !== 'nonfoil' ? 0.72 : 1;
			const adjustedBase = Math.max(
				25,
				Math.round(
					(prevCard.demo_baseline_cents ||
						extractScryfallBaselineCents(null, nextFinish, nextKey)) * finishMultiplier
				)
			);
			const nextGen = (prevCard.demo_generation ?? 1) + 1;
			const simPatch = simulateVendorOffersForCard(
				updatedCard,
				adjustedBase,
				nextGen,
				null,
				Date.now()
			);
			updatedCard = {
				...updatedCard,
				...simPatch,
				demo_generation: nextGen
			};
		}

		cards[idx] = updatedCard;
		saveDemoCards(cards);
		if (nextMaxCap !== null) {
			recordAlertIfQualified(null, updatedCard, settings, false);
		}

		return jsonResponse({
			updated: true,
			rekeyed: isRekey,
			new_row_key: nextRowKey,
			image_uri: updatedCard.image_uri
		});
	}

	// 5. DELETE from seeking
	if (matchesEndpoint(url, 'PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL', 'deletefromseeking')) {
		const cards = loadDemoCards() as StoredDemoCard[];
		const idx = findCardIndexByPartitionAndRow(cards, bodyObj.partitionKey, bodyObj.rowKey);
		if (idx < 0) {
			return jsonResponse({ message: 'Card not found in demo seeking list.' }, 404);
		}
		cards.splice(idx, 1);
		saveDemoCards(cards);
		return jsonResponse({ deleted: true });
	}

	// 6. UPDATE user setting (strictly allowlisted keys, never CardMarket or tier/admin fields)
	if (matchesEndpoint(url, 'PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL', 'updateusersetting')) {
		const { settingName, settingValue } = bodyObj;
		if (!validateSettingUpdate(settingName, settingValue)) {
			return jsonResponse({ error: 'Setting not permitted in Demo Sandbox.' }, 403);
		}
		const current = loadDemoSettings();
		const normalizedValue =
			settingName === 'preferredLanguage' && typeof settingValue === 'string'
				? settingValue.toLowerCase()
				: settingName === 'preferredFinish' && typeof settingValue === 'string'
					? settingValue.toLowerCase()
					: settingName === 'minCondition' && typeof settingValue === 'string'
						? settingValue.toUpperCase()
						: settingValue;

		const updated = saveDemoSettings({
			...current,
			[settingName as keyof DemoUserSettings]: normalizedValue
		} as DemoUserSettings);

		return jsonResponse({ updated: true, settings: updated });
	}

	// 7. Reject live Moxfield proxy cleanly without outbound call
	if (matchesEndpoint(url, 'PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL', 'fetchmoxfielddeck')) {
		return jsonResponse(
			{
				error:
					'Live Moxfield fetching is disabled in Demo Mode. Choose a built-in Sample Deck below or paste a decklist in Text Input.'
			},
			403
		);
	}

	// Default Fail Closed
	return jsonResponse({ error: 'Endpoint not allowed in Demo Sandbox.' }, 403);
}
