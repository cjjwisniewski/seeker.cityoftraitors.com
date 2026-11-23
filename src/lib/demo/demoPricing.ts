import type {
	DemoCardRecord,
	DemoHistoricalPricing,
	DemoVendorLow,
	FinishType,
	ScryfallPrices
} from './demoTypes';

const MIN_BASELINE_CENTS = 25;
const MAX_BASELINE_CENTS = 10_000_000;

const FX_HKD_PER_USD = 7.8;
const FX_JPY_PER_USD = 152.0;
const FX_TWD_PER_USD = 32.2;

export function hashSeed(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function parseUsdStringToCents(raw: string | null | undefined): number | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (!Number.isFinite(num) || num <= 0) return null;
	const cents = Math.round(num * 100);
	if (cents < MIN_BASELINE_CENTS || cents > MAX_BASELINE_CENTS) {
		return Math.max(MIN_BASELINE_CENTS, Math.min(MAX_BASELINE_CENTS, cents));
	}
	return cents;
}

export function extractScryfallBaselineCents(
	prices: ScryfallPrices | null | undefined,
	finish: FinishType,
	seedKey: string
): number {
	if (prices && typeof prices === 'object') {
		let candidateCents: number | null = null;
		if (finish === 'etched') {
			candidateCents =
				parseUsdStringToCents(prices.usd_etched) ??
				parseUsdStringToCents(prices.usd_foil) ??
				parseUsdStringToCents(prices.usd);
		} else if (finish === 'foil') {
			candidateCents = parseUsdStringToCents(prices.usd_foil) ?? parseUsdStringToCents(prices.usd);
		} else {
			candidateCents = parseUsdStringToCents(prices.usd);
		}

		if (candidateCents === null) {
			const eurStr = finish === 'foil' ? (prices.eur_foil ?? prices.eur) : prices.eur;
			const eurCents = parseUsdStringToCents(eurStr);
			if (eurCents !== null) {
				candidateCents = Math.max(MIN_BASELINE_CENTS, Math.round(eurCents * 1.08));
			}
		}

		if (candidateCents !== null) {
			return candidateCents;
		}
	}

	// Deterministic realistic fallback if Scryfall has null USD/EUR for niche foreign promos
	const hash = hashSeed(seedKey);
	const tier = hash % 3;
	const cents =
		tier === 0 ? 350 + (hash % 1200) : tier === 1 ? 1800 + (hash % 4500) : 6500 + (hash % 12000);
	return Math.round(cents / 5) * 5;
}

function clampCents(value: number): number {
	return Math.max(MIN_BASELINE_CENTS, Math.min(MAX_BASELINE_CENTS, Math.round(value)));
}

function buildSearchSlug(cardName: string): string {
	return encodeURIComponent(cardName);
}

/**
 * Populates canonical non-empty marketplace IDs and URLs so Demo cards
 * show normal "Out of stock" rather than error "Card not found / Not searched" states.
 */
export function buildDemoVendorIdentifiers(
	card: Pick<
		DemoCardRecord,
		| 'name'
		| 'set_code'
		| 'collector_number'
		| 'language'
		| 'finish'
		| 'tcgplayer_id'
		| 'cardtrader_id'
		| 'manapool_id'
	>
): Pick<
	DemoCardRecord,
	| 'cardtrader_id'
	| 'tcgplayer_id'
	| 'manapool_id'
	| 'manapool_url'
	| 'cardkingdom_url'
	| 'himarket_url'
	| 'hareruya_url'
	| 'ruten_url'
> {
	const seedKey = `${card.set_code}:${card.collector_number}:${card.language}:${card.finish}`;
	const baseHash = hashSeed(seedKey);
	const slug = buildSearchSlug(card.name);
	const langLower = String(card.language || 'en').toLowerCase();

	const cardtraderId =
		card.cardtrader_id !== undefined &&
		card.cardtrader_id !== null &&
		String(card.cardtrader_id).trim() !== ''
			? String(card.cardtrader_id)
			: String(200000 + (baseHash % 80000));

	const tcgplayerId =
		card.tcgplayer_id !== undefined &&
		card.tcgplayer_id !== null &&
		String(card.tcgplayer_id).trim() !== ''
			? card.tcgplayer_id
			: String(300000 + (baseHash % 150000));

	return {
		cardtrader_id: cardtraderId,
		tcgplayer_id: tcgplayerId,
		manapool_id: card.manapool_id || `mp-${card.set_code}-${card.collector_number}`,
		manapool_url: `https://manapool.com/cards?q=${slug}`,
		cardkingdom_url: `https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${slug}`,
		himarket_url: `https://www.himarket.hk/search?q=${slug}`,
		hareruya_url: `https://www.hareruyamtg.com/en/products/search?product=${slug}`,
		ruten_url: ['zht', 'en'].includes(langLower) ? `https://www.ruten.com.tw/find/?q=${slug}` : ''
	};
}

export function simulateVendorOffersForCard(
	card: Pick<
		DemoCardRecord,
		| 'name'
		| 'set_code'
		| 'collector_number'
		| 'language'
		| 'finish'
		| 'tcgplayer_id'
		| 'cardtrader_id'
		| 'manapool_id'
	>,
	baselineCents: number,
	generation = 0,
	existingHist: DemoHistoricalPricing | null = null,
	nowMs = Date.now()
): Partial<DemoCardRecord> {
	const safeBase = clampCents(baselineCents);
	const seedBase = `${card.set_code}:${card.collector_number}:${card.language}:${card.finish}`;
	const h = hashSeed(`${seedBase}:${generation}`);
	const langLower = String(card.language || 'en').toLowerCase();
	const nowIso = new Date(nowMs).toISOString();
	const olderIso = new Date(nowMs - 4 * 24 * 60 * 60 * 1000).toISOString();

	const factorFor = (salt: string, minPct: number, maxPct: number): number => {
		const vh = hashSeed(`${seedBase}:${salt}:${generation}`);
		const span = maxPct - minPct;
		return (minPct + ((vh % 1000) / 1000) * span) / 100;
	};

	const conds = ['NM', 'NM', 'SP', 'SP', 'MP'];
	const pickCond = (salt: string): string => {
		const vh = hashSeed(`${seedBase}:cond:${salt}:${generation}`);
		return conds[vh % conds.length];
	};

	// Always stock at least 2 core US/Global marketplaces + localized stores for non-English printings
	const cardtraderInStock = generation % 7 !== 6;
	const tcgInStock = (h >> 1) % 5 !== 0 || langLower === 'en';
	const manapoolInStock = langLower === 'en' && (h >> 2) % 4 !== 0;
	const ckInStock = (langLower === 'en' || card.finish === 'foil') && (h >> 3) % 3 !== 0;
	const ebayInStock = (h >> 4) % 3 === 0;
	const himarketInStock = ['zht', 'zhs', 'ja', 'en'].includes(langLower) && (h >> 5) % 2 === 0;
	const hareruyaInStock =
		['ja', 'en'].includes(langLower) && ((h >> 6) % 2 === 0 || langLower === 'ja');
	// Match Seeker backend rule: Ruten strictly tracks zht and en only
	const rutenInStock =
		['zht', 'en'].includes(langLower) && (langLower === 'zht' || (h >> 7) % 3 === 0);

	const cardtraderPrice = cardtraderInStock
		? clampCents(safeBase * factorFor('ct', 91, 108))
		: null;
	const tcgPrice = tcgInStock ? clampCents(safeBase * factorFor('tcg', 95, 112)) : null;
	const manapoolPrice = manapoolInStock ? clampCents(safeBase * factorFor('mp', 93, 107)) : null;
	const ckPrice = ckInStock ? clampCents(safeBase * factorFor('ck', 102, 122)) : null;
	const ebayPrice = ebayInStock ? clampCents(safeBase * factorFor('ebay', 96, 125)) : null;
	const himarketUsdCents = himarketInStock ? clampCents(safeBase * factorFor('hk', 94, 115)) : null;
	const hareruyaUsdCents = hareruyaInStock
		? clampCents(safeBase * factorFor('har', 90, 114))
		: null;
	const rutenUsdCents = rutenInStock ? clampCents(safeBase * factorFor('rt', 92, 118)) : null;

	const cardtraderCond = cardtraderPrice ? pickCond('ct') : null;
	const tcgCond = tcgPrice ? pickCond('tcg') : null;
	const manapoolCond = manapoolPrice ? pickCond('mp') : null;
	const ckCond = ckPrice ? pickCond('ck') : null;
	const ebayCond = ebayPrice ? pickCond('ebay') : null;
	const himarketCond = himarketUsdCents ? pickCond('hk') : null;
	const hareruyaCond = hareruyaUsdCents ? pickCond('har') : null;
	const rutenCond = rutenUsdCents ? pickCond('rt') : null;

	const vendorObservations: Array<{ key: string; price: number; cond: string }> = [];
	if (cardtraderPrice && cardtraderCond)
		vendorObservations.push({ key: 'cardtrader', price: cardtraderPrice, cond: cardtraderCond });
	if (tcgPrice && tcgCond)
		vendorObservations.push({ key: 'tcgplayer', price: tcgPrice, cond: tcgCond });
	if (manapoolPrice && manapoolCond)
		vendorObservations.push({ key: 'manapool', price: manapoolPrice, cond: manapoolCond });
	if (ckPrice && ckCond)
		vendorObservations.push({ key: 'cardkingdom', price: ckPrice, cond: ckCond });
	if (himarketUsdCents && himarketCond)
		vendorObservations.push({ key: 'himarket', price: himarketUsdCents, cond: himarketCond });
	if (hareruyaUsdCents && hareruyaCond)
		vendorObservations.push({ key: 'hareruya', price: hareruyaUsdCents, cond: hareruyaCond });

	const cleanObs = vendorObservations.filter((v) => v.cond === 'NM' || v.cond === 'SP');
	const playedObs = vendorObservations.filter((v) => v.cond === 'MP' || v.cond === 'HP');
	cleanObs.sort((a, b) => a.price - b.price);
	playedObs.sort((a, b) => a.price - b.price);
	const allObs = [...vendorObservations].sort((a, b) => a.price - b.price);

	const vendorLows: Record<string, DemoVendorLow> = { ...(existingHist?.vendor_lows || {}) };
	for (const obs of vendorObservations) {
		const prev = vendorLows[obs.key];
		const floorCents = prev ? Math.min(prev.low_cents, obs.price) : clampCents(obs.price * 0.94);
		vendorLows[obs.key] = {
			low_cents: floorCents,
			low_cond: prev && prev.low_cents <= obs.price ? prev.low_cond : obs.cond,
			last_cents: obs.price,
			last_at: nowIso
		};
	}

	const bestClean = cleanObs[0] || allObs[0] || null;
	const bestPlayed = playedObs[0] || null;
	const bestAny = allObs[0] || null;

	const prevNmLow = existingHist?.nm_low_cents ?? null;
	const simulatedNmLow = bestClean
		? prevNmLow !== null
			? Math.min(prevNmLow, bestClean.price)
			: clampCents(bestClean.price * 0.96)
		: prevNmLow;

	const prevPlayedLow = existingHist?.played_low_cents ?? null;
	const simulatedPlayedLow = bestPlayed
		? prevPlayedLow !== null
			? Math.min(prevPlayedLow, bestPlayed.price)
			: bestPlayed.price
		: (prevPlayedLow ?? (bestClean ? clampCents(bestClean.price * 0.82) : null));

	const hist: DemoHistoricalPricing | null = bestAny
		? {
				is_calibrated: true,
				first_observed_at: existingHist?.first_observed_at || olderIso,
				observation_count: (existingHist?.observation_count || 6) + 1,
				nm_low_cents: simulatedNmLow,
				nm_low_condition: bestClean?.cond || existingHist?.nm_low_condition || 'NM',
				nm_low_vendor: bestClean?.key || existingHist?.nm_low_vendor || 'cardtrader',
				nm_low_at:
					prevNmLow !== null && simulatedNmLow === prevNmLow
						? existingHist?.nm_low_at || olderIso
						: nowIso,
				nm_last_seen_cents: bestClean?.price ?? existingHist?.nm_last_seen_cents ?? null,
				nm_last_seen_condition: bestClean?.cond ?? existingHist?.nm_last_seen_condition ?? null,
				nm_last_seen_vendor: bestClean?.key ?? existingHist?.nm_last_seen_vendor ?? null,
				nm_last_seen_at: bestClean ? nowIso : (existingHist?.nm_last_seen_at ?? null),
				played_low_cents: simulatedPlayedLow,
				played_low_condition: bestPlayed?.cond || existingHist?.played_low_condition || 'MP',
				played_low_vendor: bestPlayed?.key || existingHist?.played_low_vendor || 'cardtrader',
				played_low_at: olderIso,
				played_last_seen_cents: bestPlayed?.price ?? existingHist?.played_last_seen_cents ?? null,
				played_last_seen_condition:
					bestPlayed?.cond ?? existingHist?.played_last_seen_condition ?? null,
				played_last_seen_vendor: bestPlayed?.key ?? existingHist?.played_last_seen_vendor ?? null,
				played_last_seen_at: bestPlayed ? nowIso : (existingHist?.played_last_seen_at ?? null),
				last_seen_cents: bestAny.price,
				last_seen_condition: bestAny.cond,
				last_seen_vendor: bestAny.key,
				last_seen_at: nowIso,
				vendor_lows: vendorLows
			}
		: existingHist;

	const idsAndUrls = buildDemoVendorIdentifiers(card);

	return {
		...idsAndUrls,
		demo_baseline_cents: safeBase,
		cardtrader_stock: Boolean(cardtraderPrice),
		cardtrader_low_price: cardtraderPrice,
		cardtrader_condition: cardtraderCond,
		tcgplayer_stock: Boolean(tcgPrice),
		tcgplayer_low_price: tcgPrice,
		tcgplayer_condition: tcgCond,
		cardmarket_stock: false,
		cardmarket_low_price: null,
		manapool_stock: Boolean(manapoolPrice),
		manapool_low_price: manapoolPrice,
		manapool_condition: manapoolCond,
		cardkingdom_stock: Boolean(ckPrice),
		cardkingdom_low_price: ckPrice,
		cardkingdom_condition: ckCond,
		ebay_id: '',
		ebay_stock: Boolean(ebayPrice),
		ebay_low_price: ebayPrice,
		ebay_condition: ebayCond,
		himarket_stock: Boolean(himarketUsdCents),
		himarket_low_price: himarketUsdCents,
		himarket_price_hkd: himarketUsdCents
			? Math.round((himarketUsdCents / 100) * FX_HKD_PER_USD * 100) / 100
			: null,
		himarket_condition: himarketCond,
		hareruya_stock: Boolean(hareruyaUsdCents),
		hareruya_low_price: hareruyaUsdCents,
		hareruya_price_jpy: hareruyaUsdCents
			? Math.round((hareruyaUsdCents / 100) * FX_JPY_PER_USD)
			: null,
		hareruya_condition: hareruyaCond,
		ruten_stock: Boolean(rutenUsdCents),
		ruten_low_price: rutenUsdCents,
		ruten_price_twd: rutenUsdCents ? Math.round((rutenUsdCents / 100) * FX_TWD_PER_USD) : null,
		ruten_condition: rutenCond,
		historical_pricing: hist
	};
}
