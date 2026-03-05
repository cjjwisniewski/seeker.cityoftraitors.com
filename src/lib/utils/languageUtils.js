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

