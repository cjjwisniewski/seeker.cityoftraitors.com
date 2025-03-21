<script>
    import { createEventDispatcher } from 'svelte';
    import { getLanguageName, getAvailableLanguages } from '$lib/utils/languageUtils';
    
    const dispatch = createEventDispatcher();
    
    export let cards = [];
    export let hasSearched = false;

    async function handleSetChange(card, newPrint) {
        if (!card || !newPrint) return;
        
        // Update all card information for the selected printing
        card.set = newPrint.set_code;
        card.image_uris = { 
            normal: newPrint.image_uri 
        };
        
        // Fetch available languages for this specific printing
        card.available_languages = await getAvailableLanguages(
            card.oracle_id, 
            newPrint.set_code, 
            newPrint.collector_number
        );
        card.selected_language = 'en';
        
        // Update other card information
        card.flavor_text = newPrint.flavor_text;
        card.oracle_text = newPrint.oracle_text;
        card.type_line = newPrint.type_line;
        card.mana_cost = newPrint.mana_cost;
        card.collector_number = newPrint.collector_number;
        
        // Force a UI update
        sortedCards = sortedCards.map(c => 
            c.id === card.id ? {...c} : c
        );
    }

    async function handleLanguageChange(card, language) {
        if (!card || !language) return;

        // Keep track of current print
        const currentPrint = card.all_prints.find(p => p.set_code === card.set);
        if (!currentPrint) return;

        // Construct the API URI for the language-specific card data
        const cardUri = `https://api.scryfall.com/cards/${currentPrint.set_code}/${currentPrint.collector_number}/${language}`;
        
        try {
            // Fetch the language-specific card data
            const response = await fetch(cardUri);
            if (!response.ok) throw new Error('Failed to fetch card data');
            const cardData = await response.json();
            
            // Get the correct image URI from the response
            const imageUri = cardData.image_uris?.normal || cardData.card_faces?.[0]?.image_uris?.normal;
            if (!imageUri) throw new Error('No image URI found');

            // Update card image and language while maintaining other print information
            sortedCards = sortedCards.map(c => {
                if (c.id === card.id) {
                    return {
                        ...c,
                        image_uris: { normal: imageUri },
                        selected_language: language,
                        set: currentPrint.set_code,
                        flavor_text: cardData.flavor_text || currentPrint.flavor_text,
                        oracle_text: cardData.oracle_text || currentPrint.oracle_text,
                        type_line: cardData.type_line || currentPrint.type_line,
                        mana_cost: currentPrint.mana_cost,
                        collector_number: currentPrint.collector_number
                    };
                }
                return c;
            });
        } catch (error) {
            console.error('Error fetching language-specific card data:', error);
        }
    }

    async function handleLanguageDropdownOpen(card, print) {
        if (!print.languages) {
            const languages = await getAvailableLanguages(
                card.oracle_id,
                print.set_code,
                print.collector_number
            );
            
            // Update the print's languages
            print.languages = languages;
            
            // Update available languages for the current card state
            card.available_languages = languages;
            
            // Update language URIs
            print.language_uris = languages.reduce((acc, lang) => {
                acc[lang] = `https://api.scryfall.com/cards/${print.set_code}/${print.collector_number}/${lang}`;
                return acc;
            }, {});
        } else {
            // Use cached languages
            card.available_languages = print.languages;
        }
    }

    async function handleAddToSeeking(card) {  // renamed function
        // Prepare the card data for storage
        const cardData = {
            id: crypto.randomUUID(), // Generate unique ID for the entry
            name: card.name,
            set_code: card.set,
            collector_number: card.collector_number,
            language: card.selected_language || 'en',
            oracle_id: card.oracle_id,
            image_uri: card.image_uris.normal,
            timestamp: new Date().toISOString()
        };
        
        dispatch('addToSeeking', cardData);  // renamed event
    }

    // Only sort if cards have prints
    $: sortedCards = cards.map(card => {
        if (!card.all_prints) return card;
        return {
            ...card,
            all_prints: [...card.all_prints].sort((a, b) => 
                (a.set || '').localeCompare(b.set || ''))
        };
    });

    function getManaCost(card) {
        return card.mana_cost || '';
    }

    function getTypeLine(card) {
        return [card.type_line, card.oracle_text].filter(Boolean).join('\n');
    }
</script>

<div class="card-list">
    {#if sortedCards?.length > 0}
        <div class="cards-list">
            {#each sortedCards as card (card.id)}
                <div class="card-item">
                    <div class="card-image-section">
                        <div class="card-image-container">
                            {#if card.image_uris?.normal}
                                <img 
                                    src={card.image_uris.normal}
                                    alt={card.name}
                                    class="card-image"
                                />
                            {/if}
                        </div>
                        {#if card.all_prints}
                            <div class="set-selector">
                                <select 
                                    value={card.set}
                                    on:change={(e) => {
                                        const newPrint = card.all_prints.find(p => p.set_code === e.target.value);
                                        if (newPrint) handleSetChange(card, newPrint);
                                    }}
                                    aria-label="Select card set"
                                >
                                    <option value="">Select a set...</option>
                                    {#each card.all_prints as print}
                                        {#if print?.set_code && print?.set}
                                            <option value={print.set_code}>
                                                {print.set} ({print.collector_number || '#???'})
                                            </option>
                                        {/if}
                                    {/each}
                                </select>
                            </div>
                        {/if}
                    </div>
                    <div class="card-details">
                        <div class="card-header">
                            <div class="name-line">
                                <h3>{card.name}</h3>
                                <span class="mana-cost">{getManaCost(card)}</span>
                            </div>
                        </div>
                        <div class="card-text">
                            <p class="type-line">{card.type_line}</p>
                            <p class="oracle-text">{card.oracle_text}</p>
                            {#if card.flavor_text}
                                <p class="flavor-text">"{card.flavor_text}"</p>
                            {/if}
                        </div>
                        {#if card.available_languages?.length > 0}
                            <div class="language-selector">
                                <label for="language-{card.id}">Language:</label>
                                <select 
                                    id="language-{card.id}"
                                    value={card.selected_language || 'en'}
                                    on:focus={() => handleLanguageDropdownOpen(card, card.all_prints.find(p => p.set_code === card.set))}
                                    on:change={(e) => handleLanguageChange(card, e.target.value)}
                                >
                                    {#each card.available_languages as lang}
                                        <option value={lang}>
                                            {getLanguageName(lang)}
                                        </option>
                                    {/each}
                                </select>
                            </div>
                        {/if}
                        <div class="card-actions">
                            <button 
                                class="add-to-seeking-btn"
                                on:click={() => handleAddToSeeking(card)}
                                disabled={!card.set}
                            >
                                Add to Seeking
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else if hasSearched}
        <p class="no-results">No cards found.</p>
    {/if}
</div>

<style>
    .card-list {
        width: 100%;
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    .cards-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .card-item {
        display: flex;
        gap: 2rem;
        padding: 1.5rem;
        background: var(--color-bg-elevated);
        border-radius: 8px;
        box-shadow: var(--shadow-sm);
    }

    .card-image-section {
        flex-shrink: 0;
        width: 250px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .card-image-container {
        width: 100%;
    }

    .card-image {
        width: 100%;
        height: auto;
        border-radius: 4.75%;
        box-shadow: var(--shadow-sm);
    }

    .card-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .name-line {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    h3 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--color-text-primary);
    }

    .mana-cost {
        font-family: monospace;
        color: var(--color-text-secondary);
    }

    .type-line {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        margin: 0;
    }

    .oracle-text {
        white-space: pre-wrap;
        margin: 0.5rem 0;
    }

    .flavor-text {
        color: var(--color-text-secondary);
        font-style: italic;
        margin: 0.5rem 0;
    }

    .set-selector {
        width: 100%;
    }

    .set-selector select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-bg-elevated);
        color: var(--color-text-primary);
        font-size: 0.9rem;
    }

    select:hover {
        border-color: var(--color-border-hover);
    }

    select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-alpha);
    }

    .language-selector {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .language-selector label {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .language-selector select {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-bg-elevated);
        color: var(--color-text-primary);
        font-size: 0.9rem;
    }
    .card-actions {
        margin-top: auto; /* This pushes the button to the bottom */
        padding-top: 0.5rem;
    }

    .add-to-seeking-btn {  /* renamed selector */
        width: 100%; /* Make button full width */
        padding: 0.75rem 1rem;
        background-color: var(--color-primary);
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .add-to-seeking-btn:hover:not(:disabled) {  /* renamed selector */
        background-color: var(--color-primary-dark);
    }

    .add-to-seeking-btn:disabled {  /* renamed selector */
        background-color: var(--color-disabled);
        cursor: not-allowed;
        opacity: 0.7;
    }

    @media (max-width: 768px) {
        .card-item {
            flex-direction: column;
            gap: 1rem;
        }

        .card-image-section {
            width: 100%;
            max-width: 300px;
            margin: 0 auto;
        }
    }
</style>