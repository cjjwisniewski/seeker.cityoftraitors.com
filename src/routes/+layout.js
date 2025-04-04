import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth';
import { redirect } from '@sveltejs/kit';
import { page } from '$app/stores'; // Import page store to prevent redirect loops
import { get } from 'svelte/store'; // Import get to read store value non-reactively
import { goto, replaceState } from '$app/navigation'; // Import goto AND replaceState

export const load = async ({ url }) => {
    // Initialize auth store on every load, client-side only.
    // auth.initialize() handles preventing multiple initializations.
    // Await it here to ensure localStorage token is checked before proceeding.
    if (browser) {
        console.log('Client layout load: Ensuring auth store is initialized...');
        await auth.initialize();

        // --- Check for callback token BEFORE running auth checks ---
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const tokenInHash = hashParams.get('token');

        if (tokenInHash) {
            console.log('Client layout load: Token found in hash, deferring auth checks to onMount.');
            // Skip auth checks for this load execution, let onMount handle the token
            return {};
        }
        // --- End token check ---
    }

    // Get the latest auth state AFTER potential initialization
    const authState = get(auth);
    const currentPath = url.pathname;

    // Log state AFTER initialization attempt
    if (browser) {
        console.log('Client layout load: Auth state after init/check:', { isAuthenticated: authState.isAuthenticated, isLoading: authState.isLoading, currentPath });
    }

    // Authentication checks (run only if no token was found in hash during this execution)
    const isAuthPath = currentPath === '/login' || currentPath === '/auth/callback' || currentPath === '/auth/logout';

    // If NOT authenticated AND NOT loading AND NOT on an auth path -> redirect to login
    if (!authState.isAuthenticated && !authState.isLoading && !isAuthPath) {
        const intendedPath = currentPath + url.search;
        console.log('Client layout load: Not authenticated, storing intended path and redirecting to login from:', intendedPath);
        if (browser) { // Only store intended path on client
            auth.setIntendedPath(intendedPath);
        }
        throw redirect(302, `/login`); // Redirect without the redirectTo param
    }

    // If authenticated AND on the login page -> redirect to home
    if (authState.isAuthenticated && currentPath === '/login') {
         console.log('Client layout load: Authenticated, redirecting from login to /');
         throw redirect(302, '/');
    }

    // Return empty object - component uses the store directly
    return {};
};

// Ensure load runs only on the client for static sites
export const ssr = false;
export const prerender = false; // Usually false for dynamic auth pages
