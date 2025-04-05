<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { auth } from '$lib/stores/auth'; // Import the auth store
    
    // Remove redirectTo logic - it's handled by auth store now
    let errorMessage = '';
    
    onMount(() => {
        // Token check
        const token = document.cookie.includes('discord_token');
        if (token) {
            console.log('Token found, redirecting to home');
            goto('/');
            return;
        }

        // Error handling (keep this part)
        const error = $page.url.searchParams.get('error');
        const message = decodeURIComponent($page.url.searchParams.get('message') || '');
        const error = $page.url.searchParams.get('error');
        const message = decodeURIComponent($page.url.searchParams.get('message') || '');

        if (error) {
            console.log('Login error detected:', { error, message });
            switch (error) {
                case 'server_required':
                    errorMessage = 'Login failed: You must be a member of the required Discord server.';
                    break;
                case 'role_required':
                    errorMessage = 'Login failed: You do not have the required "Seeker" role in the Discord server.';
                    break;
                case 'callback_failed':
                    // This might now include role failures if fetchUserInfo returned 403
                    errorMessage = message || 'Authentication failed after callback. This might be due to missing roles or an issue fetching user details. Please ensure you have the "Seeker" role.';
                    break;
                case 'discord_api_error':
                    errorMessage = message || 'Communication error with Discord. Please try again later.';
                    break;
                case 'config_error':
                    errorMessage = message || 'Server configuration error prevents login.';
                    break;
                case 'no_code':
                    errorMessage = message || 'Authorization code missing from Discord callback.';
                    break;
                default:
                    errorMessage = message || 'An unknown authentication error occurred.';
            }
        }
    });

</script>

<div class="login-container">
    <div class="login-box">
        <h2>Welcome to Seeker</h2>
        <p class="subtitle">Track down your missing pieces.</p>
        
        {#if errorMessage}
            <div class="error">
                {errorMessage}
            </div>
        {/if}
        
        <button on:click={() => auth.login()} class="login-button">
            <i class="fa-brands fa-discord"></i>
            Login with Discord
        </button>
    </div>
</div>

<style>
    .login-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 4rem); /* Adjust for footer height */
        padding: 2rem;
        background: linear-gradient(to bottom, #f3f4f6 0%, #e5e7eb 100%);
    }
    
    .login-box {
        background-color: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        text-align: center;
        max-width: 400px;
        width: 100%;
        margin-bottom: 2rem; /* Add space above footer */
    }

    h2 {
        margin: 0;
        color: #1f2937;
        font-size: 1.875rem;
        font-weight: 600;
    }

    .subtitle {
        color: #6b7280;
        margin: 0.5rem 0 1.5rem 0;
    }
    
    .login-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.875rem 2rem;
        background-color: #7289DA;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        transition: all 0.2s ease;
        width: 100%;
        max-width: 250px;
    }

    .login-button:hover {
        background-color: #5b6eae;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .login-button i {
        font-size: 1.25rem;
    }

    .error {
        background-color: #fee2e2;
        border: 1px solid #ef4444;
        color: #991b1b;
        padding: 1rem;
        border-radius: 0.375rem;
        margin: 1rem 0;
        text-align: center;
    }
</style>
