import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth';
import { redirect } from '@sveltejs/kit';
import { page } from '$app/stores'; // Import page store to prevent redirect loops
import { get } from 'svelte/store'; // Import get to read store value non-reactively

export const load = async ({ url }) => {
    if (browser) {
        console.log('Client layout load: Initializing auth store...');
        await auth.initialize(); // Initialize and wait for it to potentially load user info

        // After initialization, check authentication status
        const authState = get(auth); // Get the latest state after initialization
        const currentPath = url.pathname;

        console.log('Client layout load: Auth state after init:', { isAuthenticated: authState.isAuthenticated, isLoading: authState.isLoading, currentPath });

        // If still loading (should be false after await), or not authenticated,
        // and we are NOT on the login or callback page, redirect to login.
        if (!authState.isAuthenticated && !authState.isLoading && currentPath !== '/login' && currentPath !== '/auth/callback') {
            console.log('Client layout load: Not authenticated, redirecting to login from:', currentPath);
            throw redirect(302, `/login?redirectTo=${encodeURIComponent(currentPath + url.search)}`);
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
