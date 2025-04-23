<script>
    import theme from '$lib/stores/theme'; // Import the theme store

    // Define the available theme options
    const themes = [
        { value: 'light', label: 'Light', icon: 'fa-solid fa-sun' },
        { value: 'dark', label: 'Dark', icon: 'fa-solid fa-moon' },
        { value: 'system', label: 'System', icon: 'fa-solid fa-desktop' }
    ];
</script>

<div class="theme-toggle" role="radiogroup" aria-label="Color theme selector">
    {#each themes as { value, label, icon } (value)}
        <button
            class="theme-option"
            class:active={$theme === value}
            on:click={() => $theme = value}
            aria-pressed={$theme === value}
            aria-label="Set theme to {label}"
            title="Set theme to {label}"
        >
            <i class="{icon}"></i>
            <!-- <span class="theme-label">{label}</span> -->
        </button>
    {/each}
</div>

<style>
    .theme-toggle {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.25rem; /* Small gap between buttons */
        background-color: var(--color-bg-secondary, #f0f0f0); /* Use theme variable */
        border-radius: 6px;
        padding: 0.2rem;
         border: 1px solid var(--color-border, #ccc); /* Optional border */
    }

    .theme-option {
        flex: 1; /* Distribute space equally */
        padding: 0.35rem 0.5rem;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 4px;
        color: var(--color-text-secondary, #555);
        font-size: 0.8rem; /* Slightly smaller icon */
        text-align: center;
        transition: background-color 0.2s ease, color 0.2s ease;
        display: flex;
        justify-content: center;
        align-items: center;
    }

     .theme-option i {
        width: 1em;
        text-align: center;
     }

    /* Hide label by default, can be shown if needed */
    .theme-label {
        display: none;
        margin-left: 0.5rem;
    }

    .theme-option:hover:not(.active) {
        background-color: var(--color-bg-hover, #e0e0e0);
        color: var(--color-text-primary, #111);
    }

    .theme-option.active {
        background-color: var(--color-primary, #007bff);
        color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
</style> 