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

export async function getAvailableLanguages(cardId, setCode, collectorNumber) {
    const languageChecks = Object.keys(languageNames).map(async lang => {
        const url = `https://api.scryfall.com/cards/${setCode}/${collectorNumber}/${lang}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                return lang;
            }
        } catch (error) {
            // Ignore errors (card likely doesn't exist in this language)
        }
        return null;
    });

    const results = await Promise.all(languageChecks);
    
    const availableLanguages = results.filter(lang => lang !== null);
    
    // Default to English if no other languages are found or if the check fails
    return availableLanguages.length > 0 ? availableLanguages : ['en'];
}
