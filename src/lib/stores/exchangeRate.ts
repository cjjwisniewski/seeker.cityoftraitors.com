import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const CACHE_KEY = 'seeker_fx_usd_rates_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_HKD_PER_USD = 7.80; // Linked exchange rate peg
const DEFAULT_JPY_PER_USD = 152.0;
const DEFAULT_TWD_PER_USD = 32.2;

export const hkdRate = writable<number>(DEFAULT_HKD_PER_USD);
export const jpyRate = writable<number>(DEFAULT_JPY_PER_USD);
export const twdRate = writable<number>(DEFAULT_TWD_PER_USD);

export async function initExchangeRates(): Promise<number> {
	if (!browser) return DEFAULT_HKD_PER_USD;

	try {
		const cachedStr = localStorage.getItem(CACHE_KEY);
		if (cachedStr) {
			const cached = JSON.parse(cachedStr);
			if (cached && cached.hkd && Date.now() - cached.timestamp < CACHE_TTL_MS) {
				hkdRate.set(cached.hkd);
				if (cached.jpy) jpyRate.set(cached.jpy);
				if (cached.twd) twdRate.set(cached.twd);
				return cached.hkd;
			}
		}
	} catch (e) {
		// Ignore local storage error
	}

	try {
		const res = await fetch('https://open.er-api.com/v6/latest/USD');
		if (res.ok) {
			const data = await res.json();
			const hkd = data?.rates?.HKD;
			const jpy = data?.rates?.JPY;
			const twd = data?.rates?.TWD;
			const validHkd = typeof hkd === 'number' && hkd > 7.0 && hkd < 9.0 ? hkd : DEFAULT_HKD_PER_USD;
			const validJpy = typeof jpy === 'number' && jpy > 80.0 && jpy < 300.0 ? jpy : DEFAULT_JPY_PER_USD;
			const validTwd = typeof twd === 'number' && twd > 20.0 && twd < 50.0 ? twd : DEFAULT_TWD_PER_USD;
			hkdRate.set(validHkd);
			jpyRate.set(validJpy);
			twdRate.set(validTwd);
			try {
				localStorage.setItem(
					CACHE_KEY,
					JSON.stringify({
						hkd: validHkd,
						jpy: validJpy,
						twd: validTwd,
						timestamp: Date.now()
					})
				);
			} catch (e) {
				// Ignore
			}
			return validHkd;
		}
	} catch (e) {
		console.warn('Failed to fetch live USD exchange rates, using fallback:', e);
	}

	return DEFAULT_HKD_PER_USD;
}

export function formatHkdPrice(hkd: number | null | undefined): string {
	if (hkd === null || hkd === undefined || isNaN(hkd)) return '';
	return `HK$ ${Number(hkd).toFixed(2)}`;
}

export function formatJpyPrice(jpy: number | null | undefined): string {
	if (jpy === null || jpy === undefined || isNaN(jpy)) return '';
	return `¥${Math.round(Number(jpy)).toLocaleString()}`;
}

export function formatTwdPrice(twd: number | null | undefined): string {
	if (twd === null || twd === undefined || isNaN(twd)) return '';
	return `NT$ ${Math.round(Number(twd)).toLocaleString()}`;
}
