<script>
    import { invalidate, goto } from '$app/navigation';
    import Footer from '$lib/components/Footer.svelte';
    export let data;

    let showDropdown = false;

    const logout = async () => {
        // Delete token cookie with proper path
        document.cookie = 'discord_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
        
        // Force page reload to clear any cached data
        await invalidate('/');
        
        // Redirect to login
        goto('/login');
    };

    const goToProfile = () => {
        showDropdown = false; // Close dropdown
        goto('/profile');
    };
</script>

<link rel="stylesheet" href="/global.css">
<link rel="stylesheet" href="/styles/theme.css">
<link rel="stylesheet" href="/styles/components.css">

<div class="layout">
    <nav>
        <div class="nav-content">
            <div class="nav-left">
                <h3>Seeker</h3>
            </div>
            <div class="nav-right">
                <a href="/seeking" class="seeking-link" title="Seeking">
                    <i class="fa-solid fa-sd-card"></i>
                </a>
                <a href="/about" class="about-link" title="About">
                    <i class="fa-solid fa-circle-info"></i>
                </a>
                <a href="/" class="home-link" title="Home">
                    <i class="fa-solid fa-house"></i>
                </a>
                {#if data.user}
                    <div class="user-dropdown">
                        <button 
                            class="user-button" 
                            on:click={() => showDropdown = !showDropdown}
                            aria-expanded={showDropdown}
                            aria-haspopup="menu"
                        >
                            <img 
                                src="https://cdn.discordapp.com/avatars/{data.user.id}/{data.user.avatar}.png" 
                                alt="{data.user.username}'s avatar"
                                class="user-avatar"
                            />
                            <span class="username">{data.user.username}</span>
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
                                {#if data.user?.roles?.includes('1352632325640294411')}
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
                {/if}
            </div>
        </div>
    </nav>
    <main>
        <slot/>
    </main>
    <Footer />
</div>

<style>
    nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 0.5rem;
        background: var(--color-bg-elevated);
        z-index: 1000;
        border-bottom: 1px solid var(--color-border);
        box-shadow: var(--shadow-sm);
    }

    .nav-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .nav-left {
        flex: 1;
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

    .home-link {
        color: var(--color-text-secondary);
        text-decoration: none;
        padding: 0.35rem;
        transition: color 0.2s ease;
    }

    .home-link:hover {
        color: var(--color-text-primary);
    }

    .about-link {
        color: var(--color-text-secondary);
        text-decoration: none;
        padding: 0.35rem;
        transition: color 0.2s ease;
    }

    .about-link:hover {
        color: var(--color-text-primary);
    }

    .seeking-link {
        color: var(--color-text-secondary);
        text-decoration: none;
        padding: 0.35rem;
        transition: color 0.2s ease;
    }

    .seeking-link:hover {
        color: var(--color-text-primary);
    }

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
    }

    .user-button:hover {
        background: var(--color-bg-hover);
    }

    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
    }

    .username {
        color: var(--color-text-primary);
        font-size: 0.9rem;
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
        gap: 0.5rem;
        width: 100%;
        padding: 0.5rem 1rem;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        text-align: left;
        text-decoration: none;
        font-size: inherit;
    }

    .dropdown-item:hover {
        background: var(--color-bg-hover);
        color: var(--color-text-primary);
    }

    .layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    main {
        padding-top: var(--nav-height);
        background: var(--color-bg-primary);
        flex: 1;
    }
</style>
