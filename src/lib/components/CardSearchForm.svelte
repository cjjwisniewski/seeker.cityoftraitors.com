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
        await performSearch();
    };

    const performSearch = async () => {
        try {
            const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(searchTerm)}&include_extras=true`);
            const data = await response.json();
            
            // Fetch prints for each card
            const cardsWithPrints = await Promise.all(data.data.map(async (card) => {
                if (!card.prints_search_uri) return card;
                
                try {
                    const printsResponse = await fetch(card.prints_search_uri);
                    const printsData = await printsResponse.json();
                    
                    // Map prints and add debug logging
                    const prints = printsData.data.map(print => ({
                        set: print.set_name,
                        set_code: print.set,
                        collector_number: print.collector_number,
                        image_uri: print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.normal,
                        languages: null, // Will be populated on demand
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
                    return card;
                }
            }));

            dispatch('search', cardsWithPrints);
        } catch (error) {
            console.error('Error performing search:', error);
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
    }

    .search-container {
        position: relative;
        display: inline-block;
    }

    .input-group {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    input {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        width: 300px;
    }

    button {
        padding: 8px 16px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        transition: background-color 0.2s;
        white-space: nowrap;
    }

    button:hover {
        background-color: #f0f0f0;
    }

    .dropdown-container {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ccc;
        border-top: none;
        border-radius: 0 0 4px 4px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 1000;
    }

    .suggestions-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .suggestion-button {
        width: 100%;
        text-align: left;
        padding: 8px;
        border: none;
        background: none;
        cursor: pointer;
    }

    .suggestion-button:hover {
        background-color: #f0f0f0;
    }

    .suggestions-list li {
        padding: 0;
    }
</style>
