<script>
    import { createEventDispatcher } from 'svelte';
  
    const dispatch = createEventDispatcher();
  
    let searchTerm = '';
  
    const search = async () => {
      // In a real app, you'd fetch data from an API here.
      // For this example, we'll simulate a search.
      const fakeResults = [
        { name: 'Lightning Bolt', type: 'Instant', manaCost: '{R}' },
        { name: 'Counterspell', type: 'Instant', manaCost: '{U}{U}' },
        { name: 'Forest', type: 'Land', manaCost: '' },
      ];
  
      // Filter the fake results based on the search term
      const filteredResults = fakeResults.filter(card =>
        card.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  
      dispatch('search', filteredResults);
    };
  
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        search();
      }
    };
  </script>
  
  <div class="search-form">
    <input type="text" bind:value={searchTerm} placeholder="Search for cards..." on:keypress={handleKeyPress} />
    <button on:click={search}>Search</button>
  </div>
  
  <style>
    .search-form {
      margin-bottom: 20px;
    }
  
    input {
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-right: 10px;
    }
  
    button {
      padding: 8px 16px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>
  