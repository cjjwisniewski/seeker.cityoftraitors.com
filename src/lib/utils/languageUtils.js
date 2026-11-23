export const languageNames = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	it: 'Italian',
	pt: 'Portuguese',
	ja: 'Japanese',
	ko: 'Korean',
	ru: 'Russian',
	zhs: 'Simplified Chinese',
	zht: 'Traditional Chinese',
	he: 'Hebrew',
	la: 'Latin',
	ar: 'Arabic',
	sa: 'Sanskrit',
	ph: 'Phyrexian'
};

export function getLanguageName(code) {
	return languageNames[code] || code.toUpperCase();
}

// Fetches all available languages for a specific printing via a single Scryfall search.
// Uses include_multilingual=true to get all language versions without individual pings.
export async function getAvailableLanguages(setCode, collectorNumber) {
	try {
		const url = `https://api.scryfall.com/cards/search?q=cn%3A${encodeURIComponent(collectorNumber)}+set%3A${encodeURIComponent(setCode)}&include_multilingual=true&unique=prints`;
		const response = await fetch(url);
		if (!response.ok) return ['en'];
		const data = await response.json();
		const langs = [...new Set(data.data.map((p) => p.lang).filter(Boolean))];
		return langs.length > 0 ? langs : ['en'];
	} catch {
		return ['en'];
	}
}
