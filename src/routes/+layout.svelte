<script>
    import { onMount } from 'svelte'; // Import onMount
    import { goto, replaceState } from '$app/navigation'; // Import replaceState
    import Footer from '$lib/components/Footer.svelte';
    import { page } from '$app/stores'; // Import the page store
    import { auth } from '$lib/stores/auth'; // Import the auth store
    import { browser } from '$app/environment'; // Import browser check

    // Remove export let data; - Data now comes from the auth store

    let showDropdown = false;

    // Logout function now calls the auth store's logout method
    const logout = () => {
        showDropdown = false; // Close dropdown
        auth.logout();
    };

    const goToProfile = () => {
        showDropdown = false; // Close dropdown
        goto('/profile');
    };

    // Handle token from URL fragment after component mounts
    onMount(async () => {
        if (browser) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const token = hashParams.get('token');
            const state = hashParams.get('state') || '/'; // Default redirect target

            if (token) {
                console.log('Layout onMount: Found token in URL fragment. Handling callback...');
                // Clear the hash fragment using SvelteKit's replaceState
                replaceState(window.location.pathname + window.location.search, history.state);

                const success = await auth.handleCallback(token);

                if (success) {
                    console.log('Layout onMount: Callback successful, navigating to state:', state);
                    // Use goto for client-side navigation after successful callback
                    await goto(state, { replaceState: true, invalidateAll: true });
                } else {
                    console.error('Layout onMount: Callback token handling failed, redirecting to login with error.');
                    // Redirect to login page with error
                    await goto('/login?error=callback_failed', { replaceState: true });
                }
            }
        }
    });
</script>

<link rel="stylesheet" href="/global.css">
<link rel="stylesheet" href="/styles/theme.css">
<link rel="stylesheet" href="/styles/components.css">

<div class="layout">
    {#if $page.url.pathname !== '/login'}
        <nav>
            <div class="nav-content">
                <div class="nav-left">
                    <a href="/">
                        <h3>Seeker</h3>
                    </a>
                </div>
                <div class="nav-right">
                    <a href="/about" class="about-link" title="About">
                        <i class="fa-solid fa-circle-info"></i>
                    </a>
                    <a href="/seeking" class="seeking-link" title="Seeking">
                        <i class="fa-solid fa-sd-card"></i>
                    </a>
                    <a href="/" class="search-link" title="Search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </a>
                    {#if $auth.isAuthenticated && $auth.user}
                        <div class="user-dropdown">
                            <button
                                class="user-button"
                                on:click={() => showDropdown = !showDropdown}
                                aria-expanded={showDropdown}
                                aria-haspopup="menu"
                            >
                                {#if $auth.user.avatar}
                                    <img
                                        src="https://cdn.discordapp.com/avatars/{$auth.user.id}/{$auth.user.avatar}.png"
                                        alt="{$auth.user.username}'s avatar"
                                        class="user-avatar"
                                    />
                                {:else}
                                    <!-- Placeholder or default avatar if none exists -->
                                    <div class="user-avatar default-avatar">{$auth.user.username.charAt(0).toUpperCase()}</div>
                                {/if}
                                <span class="username">{$auth.user.username}</span>
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                            {#if showDropdown}
                                <div
                                    class="dropdown-menu"
                                    role="menu"
                                    tabindex="-1"
                                    on:mouseleave={() => showDropdown = false}
                                >
                                    <button
                                        class="dropdown-item"
                                        role="menuitem"
                                        tabindex="0"
                                        on:click={goToProfile}
                                    >
                                        <i class="fa-solid fa-user"></i>
                                        Profile
                                    </button>
                                    <!-- Check roles from the auth store user object -->
                                    {#if $auth.user?.roles?.includes('1352632325640294411')}
                                        <button
                                            class="dropdown-item"
                                            role="menuitem"
                                            tabindex="0"
                                            on:click={() => goto('/admin')}
                                        >
                                            <i class="fa-solid fa-shield"></i>
                                            Admin
                                        </button>
                                    {/if}
                                    <button
                                        on:click={logout}
                                        class="dropdown-item"
                                        role="menuitem"
                                        tabindex="0"
                                    >
                                        <i class="fa-solid fa-right-from-bracket"></i>
                                        Logout
                                    </button>
                                </div>
                            {/if}
                        </div>
                    {:else if !$auth.isLoading}
                         <!-- Optionally show a Login button if not authenticated and not loading -->
                         <a href="/login" class="login-button">Login</a>
                    {/if}
                </div>
            </div>
        </nav>
    {/if}
    
    <main class={$page.url.pathname === '/login' ? 'no-padding-top' : ''}>
        <slot/>
    </main>
    <Footer />
</div>

<style>
    /* Define nav height as variable (adjust value as needed) */
    :root {
        --nav-height: 57px; /* Example: Adjust based on your actual navbar height */
    }

    nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--nav-height); /* Use the variable */
        padding: 0.5rem; /* Keep original padding */
        background: var(--color-bg-elevated);
        z-index: 1000;
        border-bottom: 1px solid var(--color-border);
        box-shadow: var(--shadow-sm);
        /* Ensure content vertical alignment if needed */
        display: flex;
        align-items: center;
    }

    .nav-content {
        width: 100%; /* Take full width */
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .nav-left {
        flex: 1;
    }

    .nav-left a {
        text-decoration: none;
    }

    h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--color-text-primary);
    }

    .nav-right {
        display: flex;
        gap: 1rem;
        align-items: center;
    }

    /* Links in nav-right */
    .search-link,
    .about-link,
    .seeking-link {
        color: var(--color-text-secondary);
        text-decoration: none;
        padding: 0.35rem;
        transition: color 0.2s ease;
        display: inline-flex; /* Align icon */
        align-items: center;
    }

    .search-link:hover,
    .about-link:hover,
    .seeking-link:hover {
        color: var(--color-text-primary);
    }

    /* User Dropdown */
    .user-dropdown {
        position: relative;
        display: inline-block;
    }

    .user-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.2s; /* Added transition */
    }

    .user-button:hover {
        background: var(--color-bg-hover);
    }

     .user-button i.fa-chevron-down { /* Style chevron */
         font-size: 0.7em;
         margin-left: 0.25rem;
         transition: transform 0.2s ease-in-out;
     }
     .user-button[aria-expanded="true"] i.fa-chevron-down {
         transform: rotate(180deg);
     }


    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover; /* Ensure avatar covers area */
    }

    /* Style for default avatar placeholder */
    .default-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: var(--color-primary); /* Example background */
        color: white;
        font-weight: bold;
        font-size: 1rem;
    }

    .username {
        color: var(--color-text-primary);
        font-size: 0.9rem;
        font-weight: 500; /* Slightly bolder */
    }

    .dropdown-menu {
        position: absolute;
        top: calc(100% + 0.25rem);
        right: 0;
        background: var(--color-bg-elevated);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        box-shadow: var(--shadow-md);
        min-width: 150px;
        padding: 0.25rem 0;
        z-index: 1001; /* Ensure it's above main content */
    }

    /* Invisible area to prevent menu from closing when moving mouse to it */
    .dropdown-menu::before {
        content: '';
        position: absolute;
        top: -0.25rem;
        left: 0;
        right: 0;
        height: 0.25rem;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.75rem; /* Increased gap slightly */
        width: 100%;
        padding: 0.5rem 1rem;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        text-align: left;
        text-decoration: none;
        font-size: 0.9rem; /* Match username size */
        white-space: nowrap; /* Prevent wrapping */
    }

     .dropdown-item i { /* Style icons in dropdown */
         width: 1em; /* Align icons */
         margin-right: 0.25rem;
         text-align: center;
     }


    .dropdown-item:hover {
        background: var(--color-bg-hover);
        color: var(--color-text-primary);
    }

    /* Optional: Style for Login button */
    .login-button {
        padding: 0.4rem 0.8rem;
        background-color: var(--color-primary);
        color: white;
        border-radius: 4px;
        text-decoration: none;
        font-size: 0.9rem;
        transition: background-color 0.2s;
    }
    .login-button:hover {
        background-color: var(--color-primary-dark); /* Define this color in theme.css */
    }


    /* Layout structure */
    .layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    main {
        padding-top: var(--nav-height); /* Use variable for padding */
        background: linear-gradient(to bottom, #f3f4f6 0%, #e5e7eb 100%);
        flex: 1; /* Ensure main takes remaining space */
        /* overflow: auto; /* Handle potential overflow inside main */
    }

    /* Class to remove padding when navbar is hidden */
    main.no-padding-top {
        padding-top: 0;
    }
</style>
