<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { PUBLIC_DISCORD_CLIENT_ID } from '$env/static/public';
    import { page } from '$app/stores';
    
    let redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${PUBLIC_DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent('http://localhost:5173/auth/callback')}&response_type=code&scope=identify%20guilds`;
    let redirectTo = '/';
    let errorMessage = '';
    
    onMount(() => {
        // If we have a token, we shouldn't be on the login page
        const token = document.cookie.includes('discord_token');
        if (token) {
            console.log('Token found, redirecting to home');
            goto('/');
            return;
        }

        // Handle redirect parameter
        const urlRedirectTo = $page.url.searchParams.get('redirectTo');
        console.log('Received redirectTo:', urlRedirectTo);
        
        if (urlRedirectTo && urlRedirectTo !== '/login') {
            redirectTo = urlRedirectTo;
            console.log('Setting custom redirect to:', redirectTo);
        } else {
            redirectTo = '/'; // Explicit fallback
            console.log('Using default redirect to:', redirectTo);
        }

        // Enhanced error handling
        const error = $page.url.searchParams.get('error');
        if (error) {
            console.error('Auth error details:', {
                error,
                url: window.location.href,
                redirectTo,
                searchParams: Object.fromEntries($page.url.searchParams)
            });
            errorMessage = error === 'server_required'
                ? 'You must be a member of our Discord server to access this site.'
                : error === 'auth_failed'
                    ? 'Authentication failed. Please try again.'
                    : `Error: ${error}`;
        }
    });

    // Helper function to build the final OAuth URL
    $: finalRedirectUrl = `${redirectUrl}&state=${encodeURIComponent(redirectTo || '/')}`;
</script>

<div class="login-container">
    <h1>Login</h1>
    {#if errorMessage}
        <div class="error">{errorMessage}</div>
    {/if}
    <a href={finalRedirectUrl} class="login-button">
        Login with Discord
    </a>
</div>

<style>
    .login-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 2rem;
    }
    
    .login-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background-color: #7289DA;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .login-button:hover {
        background-color: #5b6eae;
    }

    .error {
        color: #ef4444;
        background-color: #fee2e2;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1.5rem;
        text-align: center;
    }
</style>