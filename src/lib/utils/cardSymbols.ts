export interface ManaToken {
	type: 'symbol' | 'separator';
	value: string;
	raw?: string;
	svg?: string;
}

export interface TextToken {
	type: 'text' | 'symbol';
	value: string;
	raw?: string;
	svg?: string;
	alt?: string;
}

/**
 * Converts an MTG symbol (e.g. "{T}", "{Q}", "{W}", "{2/W}", "{W/P}", "{½}", "{∞}")
 * to its official Scryfall SVG URL.
 */
export function getCardSymbolSvg(raw: string): string {
	if (!raw) return '';
	const code = raw.replace(/[{}]/g, '').replace(/\//g, '').toUpperCase();
	if (code === '½') return 'https://svgs.scryfall.io/card-symbols/HALF.svg';
	if (code === '∞') return 'https://svgs.scryfall.io/card-symbols/INFINITY.svg';
	return `https://svgs.scryfall.io/card-symbols/${code}.svg`;
}

/**
 * Parses an MTG mana cost string (e.g. "{1}{U}{R}" or "{1}{R} // {1}{U}")
 * into an array of mana tokens with official Scryfall SVG URLs.
 */
export function parseManaCost(manaStr: string | null | undefined): ManaToken[] {
	if (!manaStr) return [];
	const parts = String(manaStr).split(' // ');
	const result: ManaToken[] = [];
	for (let i = 0; i < parts.length; i++) {
		if (i > 0) result.push({ type: 'separator', value: '//' });
		const symbols = parts[i].match(/\{([^}]+)\}/g) || [];
		for (const sym of symbols) {
			const clean = sym.slice(1, -1);
			result.push({
				type: 'symbol',
				value: clean,
				raw: sym,
				svg: getCardSymbolSvg(sym)
			});
		}
	}
	return result;
}

/**
 * Parses MTG oracle/rules text into paragraphs of text and symbol tokens.
 * Supports tap/untap ({T}, {Q}), mana symbols, energy ({E}), loyalty, planeswalker, etc.
 */
export function parseOracleText(text: string | null | undefined): TextToken[][] {
	if (!text) return [];
	const lines = String(text).split('\n');
	const paragraphs: TextToken[][] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const tokens: TextToken[] = [];
		let lastIndex = 0;
		const regex = /\{([^}]+)\}/g;
		let match;
		while ((match = regex.exec(line)) !== null) {
			if (match.index > lastIndex) {
				tokens.push({ type: 'text', value: line.slice(lastIndex, match.index) });
			}
			tokens.push({
				type: 'symbol',
				value: match[1],
				raw: match[0],
				svg: getCardSymbolSvg(match[0]),
				alt: match[0]
			});
			lastIndex = regex.lastIndex;
		}
		if (lastIndex < line.length) {
			tokens.push({ type: 'text', value: line.slice(lastIndex) });
		}
		paragraphs.push(tokens);
	}
	return paragraphs;
}
