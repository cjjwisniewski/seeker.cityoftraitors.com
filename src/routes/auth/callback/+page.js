import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth';

export async function load({ url }) {
    if (!browser) {
        // This load function should only run on the client
        return {};
    }

    console.log('Callback page load triggered on client.');

    // Extract token and state from URL fragment (#)
    const hashParams = new URLSearchParams(url.hash.substring(1)); // Remove leading '#'
    const token = hashParams.get('token');
    const state = hashParams.get('state') || '/'; // Default redirect target

    console.log('Callback URL Fragment Params:', { token: token ? 'present' : 'missing', state });

    if (token) {
        // Attempt to handle the token using the auth store
        const success = await auth.handleCallback(token);

        if (success) {
            console.log('Callback successful, redirecting to:', state);
            // Use replaceState to clean the URL, then redirect
            history.replaceState(null, '', url.pathname); // Remove the hash
            throw redirect(302, state); // Redirect to the original target page
        } else {
            console.error('Callback token handling failed, redirecting to login with error.');
            // Use replaceState to clean the URL, then redirect
            history.replaceState(null, '', url.pathname); // Remove the hash
            throw redirect(302, '/login?error=callback_failed');
        }
    } else {
        console.error('No token found in URL fragment, redirecting to login.');
        // Use replaceState to clean the URL, then redirect
        history.replaceState(null, '', url.pathname); // Remove the hash
        throw redirect(302, '/login?error=no_token_in_callback');
    }

    // Should not be reached due to redirects, but return empty object as fallback
    return {};
}
