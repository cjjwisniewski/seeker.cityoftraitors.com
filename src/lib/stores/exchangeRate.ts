import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const CACHE_KEY = 'seeker_fx_usd_hkd';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_HKD_PER_USD = 7.80; // Linked exchange rate peg

export const hkdRate = writable<number>(DEFAULT_HKD_PER_USD);

export async function initExchangeRates(): Promise<number> {
	if (!browser) return DEFAULT_HKD_PER_USD;

	try {
		const cachedStr = localStorage.getItem(CACHE_KEY);
		if (cachedStr) {
			const cached = JSON.parse(cachedStr);
			if (cached && cached.rate && Date.now() - cached.timestamp < CACHE_TTL_MS) {
				hkdRate.set(cached.rate);
				return cached.rate;
			}
		}
	} catch (e) {
		// Ignore local storage error
	}

	try {
		const res = await fetch('https://open.er-api.com/v6/latest/USD');
		if (res.ok) {
			const data = await res.json();
			const rate = data?.rates?.HKD;
			if (typeof rate === 'number' && rate > 7.0 && rate < 9.0) {
				hkdRate.set(rate);
				try {
					localStorage.setItem(
						CACHE_KEY,
						JSON.stringify({
							rate,
							timestamp: Date.now()
						})
					);
				} catch (e) {
					// Ignore
				}
				return rate;
			}
		}
	} catch (e) {
		console.warn('Failed to fetch live USD/HKD exchange rate, using peg fallback:', e);
	}

	return DEFAULT_HKD_PER_USD;
}

export function formatHkdPrice(hkd: number | null | undefined): string {
	if (hkd === null || hkd === undefined || isNaN(hkd)) return '';
	return `HK$ ${Number(hkd).toFixed(2)}`;
}
