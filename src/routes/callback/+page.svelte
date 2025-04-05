<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { auth } from '$lib/stores/auth';
    import { browser } from '$app/environment';

    let message = 'Processing login...';
    let error = null;

    onMount(async () => {
        if (!browser) return; // Should not run server-side, but safeguard

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const token = hashParams.get('token');
        const state = hashParams.get('state'); // Original path user intended to visit
        const errorCode = hashParams.get('error'); // Check for potential errors passed from backend

        // Clear the hash from the URL for cleanliness and security
        // Use replaceState to avoid adding a new entry to browser history
        history.replaceState(null, '', window.location.pathname + window.location.search);

        if (errorCode) {
            console.error('Callback received error code:', errorCode);
            // Handle specific errors if needed
            if (errorCode === 'access_denied') {
                 message = 'Login cancelled or failed. Redirecting...';
                 error = 'Access was denied. You might be missing required roles.';
            } else {
                 message = 'Login failed. Redirecting...';
                 error = `An error occurred during login (${errorCode}).`;
            }
             // Redirect to login page after a delay, showing the error
            setTimeout(() => {
                goto('/login?error=' + encodeURIComponent(errorCode), { replaceState: true });
            }, 3000); // Show error for 3 seconds
            return;
        }


        if (token) {
            console.log('Callback: Token found in hash, calling auth.handleCallback...');
            const result = await auth.handleCallback(token);

            if (result?.success) {
                message = 'Login successful! Redirecting...';
                const redirectTo = state || '/'; // Default to home if no state
                console.log('Callback: Redirecting to:', redirectTo);
                // Use replaceState: true if you don't want the callback page in history
                goto(redirectTo, { replaceState: true });
            } else {
                message = 'Login failed. Could not validate token. Redirecting...';
                error = result?.error || 'Failed to process token.';
                console.error('Callback: auth.handleCallback failed.', error);
                 // Redirect to login page after a delay, showing the error
                setTimeout(() => {
                    goto('/login?error=' + encodeURIComponent(error), { replaceState: true });
                }, 3000); // Show error for 3 seconds
            }
        } else {
            message = 'No token found in callback. Redirecting to login...';
            error = 'Invalid callback parameters.';
            console.error('Callback: No token found in URL hash.');
             // Redirect immediately if no token
            goto('/login?error=invalid_callback', { replaceState: true });
        }
    });
</script>

<div class="callback-container">
    <h2>{message}</h2>
    {#if error}
        <p class="error-message">Error: {error}</p>
    {/if}
    <!-- Optional: Add a spinner -->
    <div class="spinner"></div>
</div>

<style>
    .callback-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 80vh;
        text-align: center;
    }
    .error-message {
        color: var(--color-error, red);
        margin-top: 1rem;
        padding: 0.5rem;
        border: 1px solid var(--color-error, red);
        border-radius: 4px;
        background-color: var(--color-bg-error-light, #fdd);
    }
    .spinner {
      border: 4px solid rgba(0, 0, 0, 0.1);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: var(--color-primary, blue);
      margin-top: 1rem;
      animation: spin 1s ease infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
</style>
