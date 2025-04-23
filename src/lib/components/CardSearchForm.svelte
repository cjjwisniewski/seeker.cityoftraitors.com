<script>
    import { createEventDispatcher } from 'svelte';
    import { onMount } from 'svelte';
    import { getAvailableLanguages } from '$lib/utils/languageUtils';
    
    const dispatch = createEventDispatcher();
    
    let searchTerm = '';
    let suggestions = [];
    let showDropdown = false;
    let searchInput;
    let dropdownContainer;
    let debounceTimer;

    const SCRYFALL_API = 'https://api.scryfall.com';
    const AUTOCOMPLETE_URL = `${SCRYFALL_API}/cards/autocomplete`;
    const SEARCH_URL = `${SCRYFALL_API}/cards/search`;
    const NAMED_URL = `${SCRYFALL_API}/cards/named`;

    onMount(() => {
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownContainer?.contains(e.target) && 
                !searchInput?.contains(e.target)) {
                showDropdown = false;
            }
        });
    });

    const handleInput = async () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        if (searchTerm.length < 2) {
            suggestions = [];
            showDropdown = false;
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${AUTOCOMPLETE_URL}?q=${encodeURIComponent(searchTerm)}`);
                const data = await response.json();
                suggestions = data.data;
                showDropdown = suggestions.length > 0;
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        }, 300);
    };

    const selectSuggestion = async (suggestion) => {
        searchTerm = suggestion;
        showDropdown = false;
        await fetchExactCard(suggestion);
    };

    const fetchExactCard = async (name) => {
        try {
            const exactUrl = `${NAMED_URL}?exact=${encodeURIComponent(name)}`;
            const response = await fetch(exactUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`Card not found by exact name: ${name}. Falling back to general search.`);
                    await performSearch();
                    return;
                }
                throw new Error(`Failed to fetch exact card: ${response.statusText}`);
            }

            const card = await response.json();

            let cardWithPrints = card;
            if (card.prints_search_uri) {
                try {
                    const printsResponse = await fetch(card.prints_search_uri);
                    const printsData = await printsResponse.json();
                    const prints = printsData.data.map(print => ({
                        set: print.set_name,
                        set_code: print.set,
                        collector_number: print.collector_number,
                        image_uri: print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.normal,
                        languages: null,
                        language_uris: {},
                        flavor_text: print.flavor_text,
                        oracle_text: print.oracle_text,
                        type_line: print.type_line,
                        mana_cost: print.mana_cost
                    }));
                     cardWithPrints = {
                        ...card,
                        all_prints: prints,
                        available_languages: prints[0]?.languages || ['en'],
                        selected_language: 'en'
                    };
                } catch (error) {
                    console.error(`Error fetching prints for ${card.name}:`, error);
                }
            } else {
                cardWithPrints = {
                    ...card,
                    all_prints: [{
                        set: card.set_name,
                        set_code: card.set,
                        collector_number: card.collector_number,
                        image_uri: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
                        languages: null,
                        language_uris: {},
                        flavor_text: card.flavor_text,
                        oracle_text: card.oracle_text,
                        type_line: card.type_line,
                        mana_cost: card.mana_cost
                    }],
                    available_languages: [card.lang || 'en'],
                    selected_language: card.lang || 'en'
                }
            }

            dispatch('search', [cardWithPrints]);

        } catch (error) {
            console.error(`Error fetching exact card "${name}":`, error);
            dispatch('search', []);
        }
    };

    const performSearch = async () => {
        try {
            const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`No cards found for search term: "${searchTerm}"`);
                    dispatch('search', []);
                    return;
                }
                 throw new Error(`Search failed: ${response.statusText}`);
            }
            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                 console.log(`No cards found for search term: "${searchTerm}"`);
                 dispatch('search', []);
                 return;
            }

            const cardsWithPrints = await Promise.all(data.data.map(async (card) => {
                if (!card.prints_search_uri) {
                    return {
                        ...card,
                        all_prints: [{
                             set: card.set_name,
                             set_code: card.set,
                             collector_number: card.collector_number,
                             image_uri: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
                             languages: null,
                             language_uris: {},
                             flavor_text: card.flavor_text,
                             oracle_text: card.oracle_text,
                             type_line: card.type_line,
                             mana_cost: card.mana_cost
                        }],
                        available_languages: [card.lang || 'en'],
                        selected_language: card.lang || 'en'
                    };
                }

                try {
                    const printsResponse = await fetch(card.prints_search_uri);
                    const printsData = await printsResponse.json();

                    const prints = printsData.data.map(print => ({
                        set: print.set_name,
                        set_code: print.set,
                        collector_number: print.collector_number,
                        image_uri: print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.normal,
                        languages: null,
                        language_uris: {},
                        flavor_text: print.flavor_text,
                        oracle_text: print.oracle_text,
                        type_line: print.type_line,
                        mana_cost: print.mana_cost
                    }));

                    return {
                        ...card,
                        all_prints: prints,
                        available_languages: prints[0]?.languages || ['en'],
                        selected_language: 'en'
                    };
                } catch (error) {
                    console.error(`Error fetching prints for ${card.name}:`, error);
                    return {
                         ...card,
                         all_prints: [],
                         available_languages: [card.lang || 'en'],
                         selected_language: card.lang || 'en'
                     };
                }
            }));

            dispatch('search', cardsWithPrints);
        } catch (error) {
            console.error('Error performing search:', error);
             dispatch('search', []);
        }
    };

    const handleKeyPress = async (event) => {
        if (event.key === 'Enter') {
            showDropdown = false;
            await performSearch();
        }
    };
</script>

<div class="search-form">
    <div class="search-container">
        <div class="input-group">
            <input
                bind:this={searchInput}
                type="text"
                bind:value={searchTerm}
                on:input={handleInput}
                on:keypress={handleKeyPress}
                placeholder="Search for cards..."
            />
            <button on:click={performSearch}>Search</button>
        </div>
        
        {#if showDropdown && suggestions.length > 0}
            <div class="dropdown-container" bind:this={dropdownContainer}>
                <ul class="suggestions-list" role="listbox">
                    {#each suggestions as suggestion}
                        <li 
                            role="option"
                            aria-selected="false"
                        >
                            <button
                                type="button"
                                class="suggestion-button"
                                on:click={() => selectSuggestion(suggestion)}
                            >
                                {suggestion}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}
    </div>
</div>

<style>
    .search-form {
        margin-bottom: 20px;
        /* Allow form to take available width */
        width: 100%; 
        max-width: 500px; /* Optional: Limit max width on larger screens */
        margin-left: auto; /* Center the form */
        margin-right: auto;
    }

    .search-container {
        position: relative;
        /* display: inline-block; Remove this */
        display: block; /* Make it block to use width: 100% */
        width: 100%; /* Take full width of parent (.search-form) */
    }

    .input-group {
        display: flex;
        gap: 0.5rem;
        align-items: stretch; /* Make items same height */
        width: 100%; /* Ensure group takes full width */
    }

    input {
        flex: 1; /* Allow input to grow */
        min-width: 150px; /* Prevent input becoming too small */
        padding: 0.5rem; /* Consistent padding */
        border: 1px solid var(--color-border, #ccc);
        border-radius: 4px;
        /* width: 300px; Remove fixed width */
        background-color: var(--color-bg-secondary, white);
        color: var(--color-text-primary, #111);
        font-size: 1rem;
    }
    input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-alpha);
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 4px;
        background: var(--color-bg-secondary, white);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: background-color 0.2s, border-color 0.2s;
        white-space: nowrap;
    }

    button:hover {
        background-color: var(--color-bg-hover, #f0f0f0);
        border-color: var(--color-border-hover, #bbb);
    }

    .dropdown-container {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--color-bg-elevated, white);
        border: 1px solid var(--color-border, #ccc);
        border-top: none;
        border-radius: 0 0 4px 4px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: var(--shadow-md);
    }

    .suggestions-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .suggestion-button {
        width: 100%;
        text-align: left;
        padding: 0.5rem 1rem;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .suggestion-button:hover {
        background-color: var(--color-bg-hover, #f0f0f0);
        color: var(--color-text-primary);
    }

    .suggestions-list li {
        padding: 0;
        border-bottom: 1px solid var(--color-border-light, #eee);
    }
    .suggestions-list li:last-child {
        border-bottom: none;
    }

    /* Optional: Media query for very small screens if needed */
    /* @media (max-width: 400px) {
        .input-group {
            flex-direction: column;
            align-items: stretch;
        }
        button {
            width: 100%;
        }
    } */
</style>
