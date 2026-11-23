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

export function formatEurPrice(eur: number | null | undefined): string {
	if (eur === null || eur === undefined || isNaN(eur)) return '';
	return `€${Number(eur).toFixed(2)}`;
}
