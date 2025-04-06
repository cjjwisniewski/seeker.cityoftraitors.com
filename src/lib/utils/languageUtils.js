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
    // Create an array of promises for all language checks
    const languageChecks = Object.keys(languageNames).map(async lang => {
        const url = `https://api.scryfall.com/cards/${setCode}/${collectorNumber}/${lang}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log(`Found ${languageNames[lang]} version`);
                return lang;
            }
        } catch (error) {
            console.debug(`No ${languageNames[lang]} version available`);
        }
        return null;
    });

    // Execute all checks in parallel
    const results = await Promise.all(languageChecks);
    
    // Filter out null results and get available languages
    const availableLanguages = results.filter(lang => lang !== null);
    
    console.log('Available languages:', availableLanguages);
    console.groupEnd();
    
    return availableLanguages.length > 0 ? availableLanguages : ['en'];
}
