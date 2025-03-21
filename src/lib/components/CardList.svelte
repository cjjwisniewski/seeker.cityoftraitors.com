sveltl<script>
    export let cards = [];
  </script>
  
  <div class="card-list">
    {#if cards.length > 0}
      <ul>
        {#each cards as card}
          <li>
            <strong>{card.name}</strong> - {card.type} {card.manaCost ? `(${card.manaCost})` : ''}
          </li>
        {/each}
      </ul>
    {:else}
      <p>No cards found.</p>
    {/if}
  </div>
  
  <style>
    .card-list {
      text-align: left;
    }
  
    ul {
      list-style: none;
      padding: 0;
    }
  
    li {
      margin-bottom: 5px;
    }
  </style>
  