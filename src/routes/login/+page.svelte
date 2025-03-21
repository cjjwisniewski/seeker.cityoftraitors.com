<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { PUBLIC_DISCORD_CLIENT_ID } from '$env/static/public';
    import { page } from '$app/stores';
    
    let redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${PUBLIC_DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent('http://localhost:5173/auth/callback')}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
    let redirectTo = '/';
    let errorMessage = '';
    
    onMount(() => {
        // Token check
        const token = document.cookie.includes('discord_token');
        if (token) {
            console.log('Token found, redirecting to home');
            goto('/');
            return;
        }

        // Handle redirect parameter
        const urlRedirectTo = $page.url.searchParams.get('redirectTo');
        if (urlRedirectTo && urlRedirectTo !== '/login') {
            redirectTo = urlRedirectTo;
        }

        // Error handling
        const error = $page.url.searchParams.get('error');
        const message = decodeURIComponent($page.url.searchParams.get('message') || '');
        
        if (error) {
            console.log('Login error detected:', { error, message });
            errorMessage = message || 'Authentication failed. Please try again.';
        }
    });

    $: finalRedirectUrl = `${redirectUrl}&state=${encodeURIComponent(redirectTo || '/')}`;
</script>

<div class="login-container">
    <h2>Welcome to Seeker</h2>
    {#if errorMessage}
        <div class="error">
            {errorMessage}
        </div>
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
        background-color: #fee2e2;
        border: 1px solid #ef4444;
        color: #991b1b;
        padding: 1rem;
        border-radius: 0.375rem;
        margin: 1rem 0;
        max-width: 400px;
        text-align: center;
    }
</style>