import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth';
import { redirect } from '@sveltejs/kit';
import { page } from '$app/stores'; // Import page store to prevent redirect loops
import { get } from 'svelte/store'; // Import get to read store value non-reactively
import { goto } from '$app/navigation'; // Import goto for redirect after callback

export const load = async ({ url }) => {
    if (browser) {
        // --- Handle Callback Token ---
        // Check the URL fragment ONLY when the page initially loads or navigates client-side
        const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Use window.location.hash
        const token = hashParams.get('token');
        const state = hashParams.get('state') || '/'; // Default redirect target

        if (token) {
            console.log('Client layout load: Found token in URL fragment. Handling callback...');
            // Clear the hash fragment from the URL immediately BEFORE processing
            // to prevent reprocessing on errors or fast reloads.
            history.replaceState(null, '', url.pathname + url.search);

            const success = await auth.handleCallback(token);

            if (success) {
                console.log('Client layout load: Callback successful, navigating to state:', state);
                // Use goto for client-side navigation after successful callback
                // This ensures the page re-renders with the new auth state
                await goto(state, { replaceState: true, invalidateAll: true }); // Invalidate to ensure data reloads if needed
                // After goto, the load function will run again for the target 'state' page.
                // We return here to let the new load execution handle the final auth state check.
                return {};
            } else {
                console.error('Client layout load: Callback token handling failed, redirecting to login with error.');
                // Redirect to login page with error
                throw redirect(302, '/login?error=callback_failed');
            }
        }
        // --- End Handle Callback Token ---


        console.log('Client layout load: Initializing auth store (or re-checking after potential navigation)...');
        // Initialize or re-check auth state if not handled by callback above
        // Ensure initialization only runs once effectively if needed, though auth.initialize handles this
        if (get(auth).isLoading) { // Only initialize if still loading
             await auth.initialize();
        }

        // Check authentication status
        const authState = get(auth); // Get the latest state
        const currentPath = url.pathname;

        console.log('Client layout load: Auth state after init:', { isAuthenticated: authState.isAuthenticated, isLoading: authState.isLoading, currentPath });

        // If still loading (should be false after await), or not authenticated,
        // and we are NOT on an auth-related page, redirect to login.
        const isAuthPath = currentPath === '/login' || currentPath === '/auth/callback' || currentPath === '/auth/logout';
        if (!authState.isAuthenticated && !authState.isLoading && !isAuthPath) {
            const intendedPath = currentPath + url.search;
            console.log('Client layout load: Not authenticated, storing intended path and redirecting to login from:', intendedPath);
            auth.setIntendedPath(intendedPath); // Store the path before redirecting
            throw redirect(302, `/login`); // Redirect without the redirectTo param
        }

        // If authenticated and trying to access login page, redirect to home
        if (authState.isAuthenticated && currentPath === '/login') {
             console.log('Client layout load: Authenticated, redirecting from login to /');
             throw redirect(302, '/');
        }
    }

    // Return empty object as we are not passing data from here to the component
    // The component will reactively use the auth store
    return {};
};

// Ensure load runs only on the client for static sites
export const ssr = false;
export const prerender = false; // Usually false for dynamic auth pages
