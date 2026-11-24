export const MANUAL_CHECK_COOLDOWN_MS = 15 * 60 * 1000;
export const ADMIN_COOLDOWN_MS = 30 * 1000;

export const languageMap = {
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

export const BASIC_LAND_NAMES = new Set([
	'plains',
	'island',
	'swamp',
	'mountain',
	'forest',
	'wastes',
	'snow-covered plains',
	'snow-covered island',
	'snow-covered swamp',
	'snow-covered mountain',
	'snow-covered forest',
	'snow-covered wastes'
]);

export function getCardKey(card) {
	return `${card.set_code}-${card.collector_number}-${card.language}-${card.finish}`;
}

export function formatMinConditionLabel(cond) {
	const normalized = String(cond || 'ANY').toUpperCase();
	switch (normalized) {
		case 'NM':
			return 'NM Only';
		case 'SP':
			return 'SP+';
		case 'MP':
			return 'MP+';
		case 'HP':
			return 'HP+';
		default:
			return 'Any Condition';
	}
}

export function formatVendorDisplayName(vendor) {
	if (!vendor) return 'Unknown';
	const map = {
		cardtrader: 'CardTrader',
		tcgplayer: 'TCGPlayer',
		manapool: 'Mana Pool',
		cardkingdom: 'Card Kingdom',
		cardmarket: 'CardMarket',
		himarket: 'HiMarket',
		hareruya: 'Hareruya',
		ebay: 'eBay',
		ruten: 'Ruten'
	};
	return map[String(vendor).toLowerCase()] || vendor;
}

export function formatRelativeTime(isoStr, currentNow = Date.now()) {
	if (!isoStr) return null;
	const parsed = Date.parse(isoStr);
	if (isNaN(parsed)) return null;
	const diffSec = Math.max(0, Math.floor((currentNow - parsed) / 1000));
	if (diffSec < 60) return 'Just now';
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	return `${diffDays}d ago`;
}

export function formatExactTimestamp(isoStr) {
	if (!isoStr) return 'No scheduled check recorded yet';
	const parsed = Date.parse(isoStr);
	if (isNaN(parsed)) return 'No scheduled check recorded yet';
	return new Date(parsed).toLocaleString();
}

export function getCardCooldownRemainingSec(card, isAdmin = false, currentNow = Date.now()) {
	if (!card?.last_manual_check) return 0;
	const parsed = Date.parse(card.last_manual_check);
	if (isNaN(parsed)) return 0;
	const cooldownMs = isAdmin ? ADMIN_COOLDOWN_MS : MANUAL_CHECK_COOLDOWN_MS;
	const remainingMs = cooldownMs - (currentNow - parsed);
	return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export function formatCooldownRemaining(seconds) {
	if (!seconds || seconds <= 0) return '';
	if (seconds < 60) return `${seconds}s`;
	return `${Math.ceil(seconds / 60)}m`;
}

export function getStockIcon(status) {
	switch (status) {
		case 'available':
			return 'fa-solid fa-circle-check';
		case 'unavailable':
			return 'fa-solid fa-circle-xmark';
		default:
			return 'fa-solid fa-circle-question';
	}
}

export function getStockColor(status) {
	switch (status) {
		case 'available':
			return 'text-success';
		case 'unavailable':
			return 'text-error';
		default:
			return 'text-muted';
	}
}

export function getStockStatus(stockValue) {
	if (stockValue === true) {
		return 'available';
	} else if (stockValue === false) {
		return 'unavailable';
	} else {
		return 'unknown';
	}
}

export function getWebpImageUri(uri) {
	if (!uri || typeof uri !== 'string') return '';
	const safe = sanitizeExternalUrl(uri, '');
	if (!safe) return '';
	if (safe.includes('cards.scryfall.io/normal/')) {
		return safe
			.replace('cards.scryfall.io/normal/', 'cards.scryfall.io/grid/')
			.replace(/\.jpg(\?.*)?$/, '.webp$1');
	}
	return safe;
}

export function getSetIconCode(originalCode) {
	const codeMap = {
		'4bb': '4ed',
		fbb: '3ed',
		sld: 'pmei',
		tsb: 'tsp'
	};
	return codeMap[String(originalCode || '').toLowerCase()] || originalCode;
}

export function formatPrice(cents) {
	if (cents === null || cents === undefined) {
		return '';
	}
	const dollars = cents / 100;
	return `$${dollars.toFixed(2)}`;
}

function normalizeLower(val) {
	if (!val) return '';
	const s = String(val).trim();
	return s.toLowerCase();
}

export function getTCGPlayerUrl(card) {
	if (!card?.tcgplayer_id) return null;
	let url = `https://www.tcgplayer.com/product/${encodeURIComponent(String(card.tcgplayer_id))}`;
	const params = [];
	const langCode = normalizeLower(card.language);

	if (langCode && languageMap[langCode]) {
		params.push(`Language=${encodeURIComponent(languageMap[langCode])}`);
	}

	if (card.finish) {
		const fin = normalizeLower(card.finish);
		const printing = fin === 'foil' || fin === 'etched' ? 'Foil' : 'Normal';
		params.push(`Printing=${printing}`);
	}

	if (params.length > 0) {
		url += `?${params.join('&')}`;
	}

	return url;
}

export function getEbayUrl(card, map) {
	if (card.ebay_id && getStockStatus(card.ebay_stock) === 'available') {
		const rawId = String(card.ebay_id);
		const cleanId = rawId.includes('|') ? rawId.split('|')[1] : rawId;
		if (/^\d+$/.test(cleanId)) {
			return `https://www.ebay.com/itm/${cleanId}`;
		}
	}
	const langCode = normalizeLower(card.language);
	let lang = langCode && langCode !== 'en' && languageMap[langCode] ? languageMap[langCode] : '';
	if (langCode === 'zhs') lang = 'Simplified Chinese';
	if (langCode === 'zht') lang = 'Traditional Chinese';
	const fin = normalizeLower(card.finish);
	const finish = fin === 'etched' ? 'foil etched' : fin === 'foil' ? 'foil' : '';
	const setCodeLower = normalizeLower(card.set_code);
	const set = card.set_name || (map && setCodeLower && map[setCodeLower]) || card.set_code || '';
	const keywords = `${card.name || ''} ${set} ${lang} ${finish}`.replace(/\s+/g, ' ').trim();
	return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keywords)}&_sop=15`;
}

/**
 * @param {string | null | undefined} url
 * @param {string | null} [fallback]
 * @returns {string | null}
 */
export function sanitizeExternalUrl(url, fallback = null) {
	if (!url || typeof url !== 'string') return fallback;
	const trimmed = url.trim();
	if (!trimmed) return fallback;
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
			return parsed.toString();
		}
	} catch {
		return fallback;
	}
	return fallback;
}

export function getCardmarketUrl(card) {
	if (card.cardmarket_url)
		return sanitizeExternalUrl(card.cardmarket_url, 'https://www.cardmarket.com');
	if (!card.cardmarket_id) return 'https://www.cardmarket.com';
	let url = `https://www.cardmarket.com/en/Magic/Products?idProduct=${card.cardmarket_id}`;
	const params = [];
	const langMap = {
		en: 1,
		fr: 2,
		de: 3,
		es: 4,
		it: 5,
		zhs: 6,
		ja: 7,
		jp: 7,
		pt: 8,
		ru: 9,
		ko: 10,
		kr: 10,
		zht: 11
	};
	if (card.language && langMap[card.language.toLowerCase()]) {
		params.push(`language=${langMap[card.language.toLowerCase()]}`);
	}
	if (card.finish) {
		params.push(`isFoil=${['foil', 'etched'].includes(card.finish.toLowerCase()) ? 'Y' : 'N'}`);
	}
	if (params.length > 0) {
		url += (url.includes('?') ? '&' : '?') + params.join('&');
	}
	return url;
}

export function getCardmarketConditionClass(cond) {
	if (!cond) return 'nm';
	const c = cond.toUpperCase();
	if (c === 'MT' || c === 'NM') return 'nm';
	if (c === 'EX') return 'sp';
	if (c === 'GD') return 'mp';
	if (c === 'LP') return 'hp';
	if (c === 'PL' || c === 'PO') return 'po';
	return 'sp';
}

/**
 * Returns true if the card reports available stock on at least one enabled marketplace
 * (respecting Ruten's Traditional Chinese / English language scope).
 */
export function hasEnabledStock(
	card,
	ctEnabled,
	tcgEnabled,
	ebayEnabled,
	mpEnabled,
	hmEnabled,
	hrEnabled,
	rtEnabled,
	cmEnabled,
	ckEnabled = false
) {
	if (!card) return false;
	const lang = (card.language || '').toLowerCase();
	return Boolean(
		(ctEnabled && card.cardtrader_stock === true) ||
			(tcgEnabled && card.tcgplayer_stock === true) ||
			(ebayEnabled && card.ebay_stock === true) ||
			(mpEnabled && card.manapool_stock === true) ||
			(ckEnabled && card.cardkingdom_stock === true) ||
			(hmEnabled && card.himarket_stock === true) ||
			(hrEnabled && card.hareruya_stock === true) ||
			(rtEnabled && ['zht', 'en'].includes(lang) && card.ruten_stock === true) ||
			(cmEnabled && card.cardmarket_stock === true)
	);
}

export function getLowestOffer(
	card,
	ctEnabled,
	tcgEnabled,
	ebayEnabled,
	mpEnabled,
	hmEnabled,
	hrEnabled,
	rtEnabled,
	cmEnabled,
	ckEnabled = false
) {
	const offers = [];
	if (
		ctEnabled &&
		getStockStatus(card.cardtrader_stock) === 'available' &&
		card.cardtrader_low_price > 0
	) {
		offers.push({ vendor: 'cardtrader', cents: Math.round(card.cardtrader_low_price) });
	}
	if (
		tcgEnabled &&
		getStockStatus(card.tcgplayer_stock) === 'available' &&
		card.tcgplayer_low_price > 0
	) {
		offers.push({ vendor: 'tcgplayer', cents: Math.round(Number(card.tcgplayer_low_price)) });
	}
	if (ebayEnabled && getStockStatus(card.ebay_stock) === 'available' && card.ebay_low_price > 0) {
		offers.push({ vendor: 'ebay', cents: Math.round(card.ebay_low_price) });
	}
	if (
		mpEnabled &&
		getStockStatus(card.manapool_stock) === 'available' &&
		card.manapool_low_price > 0
	) {
		offers.push({ vendor: 'manapool', cents: Math.round(card.manapool_low_price) });
	}
	if (
		ckEnabled &&
		getStockStatus(card.cardkingdom_stock) === 'available' &&
		card.cardkingdom_low_price > 0
	) {
		offers.push({ vendor: 'cardkingdom', cents: Math.round(card.cardkingdom_low_price) });
	}
	if (
		hmEnabled &&
		getStockStatus(card.himarket_stock) === 'available' &&
		card.himarket_low_price > 0
	) {
		offers.push({ vendor: 'himarket', cents: Math.round(card.himarket_low_price) });
	}
	if (
		hrEnabled &&
		getStockStatus(card.hareruya_stock) === 'available' &&
		card.hareruya_low_price > 0
	) {
		offers.push({ vendor: 'hareruya', cents: Math.round(card.hareruya_low_price) });
	}
	if (
		rtEnabled &&
		['zht', 'en'].includes((card.language || '').toLowerCase()) &&
		getStockStatus(card.ruten_stock) === 'available' &&
		card.ruten_low_price > 0
	) {
		offers.push({ vendor: 'ruten', cents: Math.round(card.ruten_low_price) });
	}
	if (
		cmEnabled &&
		getStockStatus(card.cardmarket_stock) === 'available' &&
		card.cardmarket_low_price > 0
	) {
		offers.push({ vendor: 'cardmarket', cents: Math.round(card.cardmarket_low_price) });
	}

	if (offers.length === 0) {
		return { minPriceCents: null, bestVendors: new Set(), offerCount: 0 };
	}

	const minPriceCents = Math.min(...offers.map((o) => o.cents));
	const bestVendors = new Set(offers.filter((o) => o.cents === minPriceCents).map((o) => o.vendor));
	return { minPriceCents, bestVendors, offerCount: offers.length };
}

export function isBestVendorPrice(
	card,
	vendor,
	ctEnabled,
	tcgEnabled,
	ebayEnabled,
	mpEnabled,
	hmEnabled,
	hrEnabled,
	rtEnabled,
	cmEnabled,
	ckEnabled = false
) {
	const info = getLowestOffer(
		card,
		ctEnabled,
		tcgEnabled,
		ebayEnabled,
		mpEnabled,
		hmEnabled,
		hrEnabled,
		rtEnabled,
		cmEnabled,
		ckEnabled
	);
	return info.offerCount >= 2 && info.bestVendors.has(vendor);
}

export function getNormalizedConditionClass(cond) {
	if (!cond) return 'nm';
	const c = cond.toUpperCase();
	if (c === 'NM' || c === 'MT' || c === 'MINT' || c === 'NEAR MINT') return 'nm';
	if (c === 'SP' || c === 'EX' || c === 'EXCELLENT') return 'sp';
	if (c === 'LP' || c === 'LIGHT PLAY') return 'lp';
	if (c === 'MP' || c === 'GD' || c === 'MODERATE PLAY' || c === 'GOOD') return 'mp';
	if (c === 'HP' || c === 'HEAVY PLAY') return 'hp';
	if (c === 'PO' || c === 'PL' || c === 'DMG' || c === 'DAMAGED' || c === 'POOR') return 'dmg';
	return 'sp';
}

export function getBestOfferDetails(
	card,
	ctEnabled,
	tcgEnabled,
	ebayEnabled,
	mpEnabled,
	hmEnabled,
	hrEnabled,
	rtEnabled,
	cmEnabled,
	setCodeToNameMap = {},
	ckEnabled = false
) {
	const offers = [];

	if (
		ctEnabled &&
		getStockStatus(card.cardtrader_stock) === 'available' &&
		card.cardtrader_low_price > 0
	) {
		offers.push({
			vendor: 'cardtrader',
			displayName: 'CardTrader',
			cents: Math.round(card.cardtrader_low_price),
			condition: card.cardtrader_condition || '',
			url: card.cardtrader_id ? `https://www.cardtrader.com/cards/${card.cardtrader_id}` : null
		});
	}
	if (
		tcgEnabled &&
		getStockStatus(card.tcgplayer_stock) === 'available' &&
		card.tcgplayer_low_price > 0
	) {
		offers.push({
			vendor: 'tcgplayer',
			displayName: 'TCGPlayer',
			cents: Math.round(Number(card.tcgplayer_low_price)),
			condition: card.tcgplayer_condition || '',
			url: card.tcgplayer_id ? getTCGPlayerUrl(card) : null
		});
	}
	if (
		mpEnabled &&
		getStockStatus(card.manapool_stock) === 'available' &&
		card.manapool_low_price > 0
	) {
		offers.push({
			vendor: 'manapool',
			displayName: 'Mana Pool',
			cents: Math.round(card.manapool_low_price),
			condition: card.manapool_condition || '',
			url: sanitizeExternalUrl(card.manapool_url, 'https://manapool.com')
		});
	}
	if (
		ckEnabled &&
		getStockStatus(card.cardkingdom_stock) === 'available' &&
		card.cardkingdom_low_price > 0
	) {
		offers.push({
			vendor: 'cardkingdom',
			displayName: 'Card Kingdom',
			cents: Math.round(card.cardkingdom_low_price),
			condition: card.cardkingdom_condition || '',
			url: sanitizeExternalUrl(card.cardkingdom_url, 'https://www.cardkingdom.com')
		});
	}
	if (
		cmEnabled &&
		getStockStatus(card.cardmarket_stock) === 'available' &&
		card.cardmarket_low_price > 0
	) {
		offers.push({
			vendor: 'cardmarket',
			displayName: 'Cardmarket',
			cents: Math.round(card.cardmarket_low_price),
			condition: card.cardmarket_condition || '',
			url: getCardmarketUrl(card)
		});
	}
	if (ebayEnabled && getStockStatus(card.ebay_stock) === 'available' && card.ebay_low_price > 0) {
		offers.push({
			vendor: 'ebay',
			displayName: 'eBay',
			cents: Math.round(card.ebay_low_price),
			condition: card.ebay_condition || '',
			url: getEbayUrl(card, setCodeToNameMap)
		});
	}
	if (
		hmEnabled &&
		getStockStatus(card.himarket_stock) === 'available' &&
		card.himarket_low_price > 0
	) {
		offers.push({
			vendor: 'himarket',
			displayName: 'HiMarket',
			cents: Math.round(card.himarket_low_price),
			condition: card.himarket_condition || '',
			url: sanitizeExternalUrl(card.himarket_url, 'https://himarket.com.hk')
		});
	}
	if (
		hrEnabled &&
		getStockStatus(card.hareruya_stock) === 'available' &&
		card.hareruya_low_price > 0
	) {
		offers.push({
			vendor: 'hareruya',
			displayName: 'Hareruya',
			cents: Math.round(card.hareruya_low_price),
			condition: card.hareruya_condition || '',
			url: sanitizeExternalUrl(card.hareruya_url, 'https://www.hareruyamtg.com')
		});
	}
	if (
		rtEnabled &&
		['zht', 'en'].includes((card.language || '').toLowerCase()) &&
		getStockStatus(card.ruten_stock) === 'available' &&
		card.ruten_low_price > 0
	) {
		offers.push({
			vendor: 'ruten',
			displayName: 'Ruten',
			cents: Math.round(card.ruten_low_price),
			condition: card.ruten_condition || '',
			url: sanitizeExternalUrl(card.ruten_url, 'https://www.ruten.com.tw')
		});
	}

	if (offers.length === 0) {
		return {
			inStock: false,
			cents: null,
			priceFormatted: '',
			vendor: null,
			vendorDisplayName: '',
			condition: '',
			conditionClass: '',
			url: null,
			offerCount: 0,
			otherOffersCount: 0,
			otherOffers: []
		};
	}

	offers.sort((a, b) => a.cents - b.cents);
	const best = offers[0];
	const otherOffers = offers.slice(1).map((o) => ({
		vendor: o.vendor,
		displayName: o.displayName,
		cents: o.cents,
		condition: o.condition,
		conditionClass: getNormalizedConditionClass(o.condition),
		url: o.url
	}));

	return {
		inStock: true,
		cents: best.cents,
		priceFormatted: `$${(best.cents / 100).toFixed(2)}`,
		vendor: best.vendor,
		vendorDisplayName: best.displayName,
		condition: best.condition,
		conditionClass: getNormalizedConditionClass(best.condition),
		url: best.url,
		offerCount: offers.length,
		otherOffersCount: otherOffers.length,
		otherOffers
	};
}

export function getCardHistoricalBadgeInfo(
	card,
	ctEnabled,
	tcgEnabled,
	ebayEnabled,
	mpEnabled,
	hmEnabled,
	hrEnabled,
	rtEnabled,
	cmEnabled,
	acctMinCond = 'ANY',
	tick = Date.now(),
	ckEnabled = false
) {
	const hp = card?.historical_pricing;
	if (!hp) return null;

	const effCond = String(card.min_condition || acctMinCond || 'ANY').toUpperCase();
	const preferCleanOnly = effCond === 'NM' || effCond === 'SP' || effCond === 'LP';

	let relevantLowCents = null;
	let relevantVendor = null;
	let relevantCond = null;
	let relevantTierShort = 'NM/LP';

	if (preferCleanOnly) {
		if (hp.nm_low_cents > 0) {
			relevantLowCents = hp.nm_low_cents;
			relevantVendor = hp.nm_low_vendor;
			relevantCond = hp.nm_low_condition || 'NM';
			relevantTierShort = 'NM/LP';
		} else if (hp.played_low_cents > 0) {
			relevantLowCents = hp.played_low_cents;
			relevantVendor = hp.played_low_vendor;
			relevantCond = hp.played_low_condition || 'MP';
			relevantTierShort = 'Played';
		}
	} else {
		if (hp.nm_low_cents > 0 && hp.played_low_cents > 0) {
			if (hp.played_low_cents <= hp.nm_low_cents) {
				relevantLowCents = hp.played_low_cents;
				relevantVendor = hp.played_low_vendor;
				relevantCond = hp.played_low_condition || 'MP';
				relevantTierShort = 'Played';
			} else {
				relevantLowCents = hp.nm_low_cents;
				relevantVendor = hp.nm_low_vendor;
				relevantCond = hp.nm_low_condition || 'NM';
				relevantTierShort = 'NM/LP';
			}
		} else if (hp.nm_low_cents > 0) {
			relevantLowCents = hp.nm_low_cents;
			relevantVendor = hp.nm_low_vendor;
			relevantCond = hp.nm_low_condition || 'NM';
			relevantTierShort = 'NM/LP';
		} else if (hp.played_low_cents > 0) {
			relevantLowCents = hp.played_low_cents;
			relevantVendor = hp.played_low_vendor;
			relevantCond = hp.played_low_condition || 'MP';
			relevantTierShort = 'Played';
		}
	}

	const lowestOffer = getLowestOffer(
		card,
		ctEnabled,
		tcgEnabled,
		ebayEnabled,
		mpEnabled,
		hmEnabled,
		hrEnabled,
		rtEnabled,
		cmEnabled,
		ckEnabled
	);

	if (lowestOffer.minPriceCents !== null && relevantLowCents !== null) {
		const isAtOrBelowFloor = lowestOffer.minPriceCents <= Math.round(relevantLowCents * 1.02);
		if (isAtOrBelowFloor && hp.is_calibrated) {
			const isBreakthrough = lowestOffer.minPriceCents < relevantLowCents;
			const isExactMatch = lowestOffer.minPriceCents === relevantLowCents;

			let titleMsg = '';
			if (isBreakthrough) {
				titleMsg = `New all-time low breakthrough! Active in-stock offer (${formatPrice(lowestOffer.minPriceCents)}) is below previous ${relevantTierShort} historical floor (${formatPrice(relevantLowCents)} [${relevantCond}] on ${formatVendorDisplayName(relevantVendor)}) — Click for price history`;
			} else if (isExactMatch) {
				titleMsg = `Active in-stock offer (${formatPrice(lowestOffer.minPriceCents)}) matches ${relevantTierShort} historical floor (${formatPrice(relevantLowCents)} [${relevantCond}] on ${formatVendorDisplayName(relevantVendor)}) — Click for price history`;
			} else {
				titleMsg = `Active in-stock offer (${formatPrice(lowestOffer.minPriceCents)}) is within 2% of ${relevantTierShort} historical floor (${formatPrice(relevantLowCents)} [${relevantCond}] on ${formatVendorDisplayName(relevantVendor)}) — Click for price history`;
			}

			return {
				type: isBreakthrough ? 'breakthrough' : 'at-floor',
				isAtLow: true,
				label: `🔥 Low ${formatPrice(lowestOffer.minPriceCents)}`,
				title: titleMsg
			};
		}
		return {
			type: 'floor',
			isAtLow: isAtOrBelowFloor,
			label: `Low ${formatPrice(relevantLowCents)} (${relevantCond})`,
			title: `Historical ${relevantTierShort} Floor: ${formatPrice(relevantLowCents)} [${relevantCond}] on ${formatVendorDisplayName(relevantVendor)} — Click for price history`
		};
	}

	if (lowestOffer.minPriceCents === null && hp.last_seen_cents > 0) {
		const relAge = formatRelativeTime(hp.last_seen_at, tick) || 'Previously';
		const condTag = hp.last_seen_condition || 'NM';
		return {
			type: 'last-seen',
			isAtLow: false,
			label: `Last ${formatPrice(hp.last_seen_cents)} (${condTag} · ${relAge})`,
			title: `Out of stock now. Last seen at ${formatPrice(hp.last_seen_cents)} [${condTag}] on ${formatVendorDisplayName(hp.last_seen_vendor)} (${relAge}) — Click for price history`
		};
	}

	if (relevantLowCents !== null) {
		return {
			type: 'floor',
			isAtLow: false,
			label: `Low ${formatPrice(relevantLowCents)} (${relevantCond})`,
			title: `Historical ${relevantTierShort} Floor: ${formatPrice(relevantLowCents)} — Click for price history`
		};
	}

	return null;
}

export function isBasicLandCard(name, typeLine = '') {
	const normName = String(name || '')
		.trim()
		.toLowerCase();
	if (BASIC_LAND_NAMES.has(normName)) return true;
	const normType = String(typeLine || '').toLowerCase();
	return normType.includes('basic land') || normType.includes('basic snow land');
}

export function parseDecklistText(
	rawText,
	importDefaultFinish = 'nonfoil',
	importDefaultLanguage = 'en'
) {
	const lines = String(rawText || '').split(/\r?\n/);
	const parsed = [];
	const seen = new Set();

	const sectionHeaders =
		/^(commander|commanders|companion|companions|mainboard|maindeck|deck|sideboard|maybeboard|considering|lands|creatures|spells|artifacts|enchantments|planeswalkers|instants|sorceries)\s*:?\s*$/i;

	for (let rawLine of lines) {
		let line = rawLine.trim();
		if (!line || line.startsWith('//') || line.startsWith('#') || sectionHeaders.test(line)) {
			continue;
		}
		if (/^SB:\s*/i.test(line)) {
			line = line.replace(/^SB:\s*/i, '').trim();
		}
		line = line.replace(/^\d+\s*[xX]?\s+/, '').trim();
		if (!line) continue;

		line = line.replace(/\s*\^[^^]+\^\s*$/g, '').trim();

		let detectedFinish = null;
		const etchedRegex = /\s*(?:\*[eE]\*|\(etched\)|\[etched\])\s*$/i;
		const foilRegex = /\s*(?:\*[fFeE]\*|\((?:foil|etched)\)|\[(?:foil|etched)\])\s*$/i;
		while (foilRegex.test(line)) {
			if (etchedRegex.test(line)) {
				detectedFinish = 'etched';
			} else if (detectedFinish !== 'etched') {
				detectedFinish = 'foil';
			}
			line = line.replace(foilRegex, '').trim();
		}
		if (/\s+\*[eE]\*\b/i.test(line)) {
			detectedFinish = 'etched';
			line = line.replace(/\s+\*[eE]\*\b/gi, '').trim();
		} else if (/\s+\*[fF]\*\b/i.test(line)) {
			if (detectedFinish !== 'etched') detectedFinish = 'foil';
			line = line.replace(/\s+\*[fF]\*\b/gi, '').trim();
		}

		line = line.replace(/\s+#[\w\-]+\s*$/g, '').trim();

		let name = line;
		let set_code = '';
		let collector_number = '';

		const setAndCnMatch = line.match(
			/^(.+?)\s+[\(\[]([A-Za-z0-9]{2,6})[\)\]]\s+([A-Za-z0-9★†\-]+)$/
		);
		if (setAndCnMatch) {
			name = setAndCnMatch[1].trim();
			set_code = setAndCnMatch[2].toLowerCase();
			collector_number = setAndCnMatch[3].trim();
		} else {
			const setOnlyMatch = line.match(/^(.+?)\s+[\(\[]([A-Za-z0-9]{2,6})[\)\]]$/);
			if (setOnlyMatch) {
				name = setOnlyMatch[1].trim();
				set_code = setOnlyMatch[2].toLowerCase();
			}
		}

		const finish = detectedFinish || importDefaultFinish;
		const language = importDefaultLanguage || 'en';
		const key = `${name.toLowerCase()}|${set_code}|${collector_number}|${language}|${finish}`;
		if (seen.has(key)) continue;
		seen.add(key);

		parsed.push({
			name,
			set_code,
			collector_number,
			language,
			finish
		});
	}

	return parsed;
}

export function extractScryfallImage(scryCard) {
	if (!scryCard) return '';
	if (scryCard.image_uris) {
		return (
			scryCard.image_uris.grid || scryCard.image_uris.normal || scryCard.image_uris.large || ''
		);
	}
	if (scryCard.card_faces && scryCard.card_faces[0]?.image_uris) {
		const faceUris = scryCard.card_faces[0].image_uris;
		return faceUris.grid || faceUris.normal || faceUris.large || '';
	}
	return '';
}

export function formatCardAsDecklistLine(card) {
	if (!card || !card.name) return '';
	const setCode = (card.set_code || '').toUpperCase();
	const cn = card.collector_number || '';
	const isFoil = String(card.finish || '').toLowerCase() === 'foil';
	const isEtched = String(card.finish || '').toLowerCase() === 'etched';

	let line = `1 ${card.name}`;
	if (setCode && cn) {
		line += ` (${setCode}) ${cn}`;
	} else if (setCode) {
		line += ` (${setCode})`;
	}

	if (isFoil) {
		line += ' *F*';
	} else if (isEtched) {
		line += ' *E*';
	}

	return line;
}

export function buildSeekingCsvString(targetCards) {
	const headers = [
		'Name',
		'Set Code',
		'Collector Number',
		'Language',
		'Finish',
		'CardTrader Stock',
		'CardTrader Price',
		'CardTrader Condition',
		'TCGPlayer Stock',
		'TCGPlayer Price',
		'TCGPlayer Condition',
		'Mana Pool Stock',
		'Mana Pool Price',
		'Mana Pool Condition',
		'Card Kingdom Stock',
		'Card Kingdom Price (USD)',
		'Card Kingdom Condition',
		'Card Kingdom URL',
		'eBay Stock',
		'eBay Price',
		'eBay Condition',
		'HiMarket Stock',
		'HiMarket Price (USD)',
		'HiMarket Price (HKD)',
		'HiMarket Condition',
		'Hareruya Stock',
		'Hareruya Price (USD)',
		'Hareruya Price (JPY)',
		'Hareruya Condition',
		'Ruten Stock',
		'Ruten Price (USD)',
		'Ruten Price (TWD)',
		'Ruten Condition',
		'Cardmarket Stock',
		'Cardmarket Price (USD)',
		'Cardmarket Price (EUR)',
		'Cardmarket Condition',
		'Historical Low NM/LP (USD)',
		'Historical Low Played (USD)',
		'Last Seen Price (USD)',
		'Max Price Cap',
		'Min Condition'
	];
	const csvRows = [headers.join(',')];

	for (const card of targetCards) {
		const hp = card.historical_pricing;
		const row = [
			card.name || '',
			card.set_code,
			card.collector_number,
			card.language,
			card.finish,
			getStockStatus(card.cardtrader_stock),
			card.cardtrader_low_price !== null && card.cardtrader_low_price !== undefined
				? (card.cardtrader_low_price / 100).toFixed(2)
				: '',
			card.cardtrader_condition || '',
			getStockStatus(card.tcgplayer_stock),
			card.tcgplayer_low_price !== null && card.tcgplayer_low_price !== undefined
				? (Number(card.tcgplayer_low_price) / 100).toFixed(2)
				: '',
			card.tcgplayer_condition || '',
			getStockStatus(card.manapool_stock),
			card.manapool_low_price !== null && card.manapool_low_price !== undefined
				? (card.manapool_low_price / 100).toFixed(2)
				: '',
			card.manapool_condition || '',
			getStockStatus(card.cardkingdom_stock),
			card.cardkingdom_low_price !== null && card.cardkingdom_low_price !== undefined
				? (card.cardkingdom_low_price / 100).toFixed(2)
				: '',
			card.cardkingdom_condition || '',
			card.cardkingdom_url || '',
			getStockStatus(card.ebay_stock),
			card.ebay_low_price !== null && card.ebay_low_price !== undefined
				? (card.ebay_low_price / 100).toFixed(2)
				: '',
			card.ebay_condition || '',
			getStockStatus(card.himarket_stock),
			card.himarket_low_price !== null && card.himarket_low_price !== undefined
				? (card.himarket_low_price / 100).toFixed(2)
				: '',
			card.himarket_price_hkd !== null && card.himarket_price_hkd !== undefined
				? Number(card.himarket_price_hkd).toFixed(2)
				: '',
			card.himarket_condition || '',
			getStockStatus(card.hareruya_stock),
			card.hareruya_low_price !== null && card.hareruya_low_price !== undefined
				? (card.hareruya_low_price / 100).toFixed(2)
				: '',
			card.hareruya_price_jpy !== null && card.hareruya_price_jpy !== undefined
				? Math.round(Number(card.hareruya_price_jpy))
				: '',
			card.hareruya_condition || '',
			['zht', 'en'].includes((card.language || '').toLowerCase())
				? getStockStatus(card.ruten_stock)
				: 'unsupported',
			card.ruten_low_price !== null && card.ruten_low_price !== undefined
				? (card.ruten_low_price / 100).toFixed(2)
				: '',
			card.ruten_price_twd !== null && card.ruten_price_twd !== undefined
				? Math.round(Number(card.ruten_price_twd))
				: '',
			card.ruten_condition || '',
			getStockStatus(card.cardmarket_stock),
			card.cardmarket_low_price !== null && card.cardmarket_low_price !== undefined
				? (card.cardmarket_low_price / 100).toFixed(2)
				: '',
			card.cardmarket_price_eur !== null && card.cardmarket_price_eur !== undefined
				? Number(card.cardmarket_price_eur).toFixed(2)
				: '',
			card.cardmarket_condition || '',
			hp?.nm_low_cents ? (hp.nm_low_cents / 100).toFixed(2) : '',
			hp?.played_low_cents ? (hp.played_low_cents / 100).toFixed(2) : '',
			hp?.last_seen_cents ? (hp.last_seen_cents / 100).toFixed(2) : '',
			card.max_price_cap !== null && card.max_price_cap !== undefined
				? (card.max_price_cap / 100).toFixed(2)
				: '',
			card.min_condition || ''
		];
		const safeRow = row.map((cell) => {
			let str = cell === null || cell === undefined ? '' : String(cell);
			if (/^[=+\-@\t\r]/.test(str)) {
				str = `'${str}`;
			}
			return `"${str.replace(/"/g, '""')}"`;
		});
		csvRows.push(safeRow.join(','));
	}

	return csvRows.join('\n');
}
