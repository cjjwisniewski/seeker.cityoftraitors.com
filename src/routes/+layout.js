import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';

export const load = async ({ url }) => {
    // Initialize auth store on client-side load
    if (browser) {
        await auth.initialize();

        // Check if the URL hash contains a token from the callback
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const tokenInHash = hashParams.get('token');

        if (tokenInHash) {
            // If token found in hash, stop load function here.
            // The callback page's onMount will handle the token.
            return {};
        }
    }

    const authState = get(auth);
    const currentPath = url.pathname;

    // Define paths that don't require authentication
    const isAuthPath =
        currentPath === '/login' ||
        currentPath === '/callback' ||
        currentPath === '/auth/callback' ||
        currentPath === '/auth/logout';

    const isPublicPath =
        isAuthPath ||
        currentPath === '/' ||
        currentPath === '/about' ||
        currentPath === '/demo';

    if (browser) {
        const wantsDemoParam = url.searchParams.get('demo') === '1';
        if (currentPath === '/demo') {
            auth.enterDemoMode(true);
        } else if (wantsDemoParam && !authState.isAuthenticated) {
            auth.enterDemoMode(false);
        }
    }

    const effectiveAuthState = browser ? get(auth) : authState;

    // Strictly block demo users and non-admins from admin routes
    if (currentPath.startsWith('/admin') && !effectiveAuthState.isLoading) {
        if (!effectiveAuthState.isAuthenticated) {
            if (browser) {
                auth.setIntendedPath(currentPath + url.search);
            }
            throw redirect(302, '/login');
        }
        if (effectiveAuthState.isDemo || !effectiveAuthState.user?.isAdmin) {
            throw redirect(302, effectiveAuthState.isDemo ? '/seeking' : '/');
        }
    }

    // Redirect to login if not authenticated, not loading, and not on a public/auth path
    if (!effectiveAuthState.isAuthenticated && !effectiveAuthState.isLoading && !isPublicPath) {
        const intendedPath = currentPath + url.search;
        if (browser) {
            auth.setIntendedPath(intendedPath); // Store intended path for redirect after login
        }
        throw redirect(302, `/login`);
    }

    // Redirect authenticated users away from the login page
    if (effectiveAuthState.isAuthenticated && currentPath === '/login') {
        throw redirect(302, effectiveAuthState.isDemo ? '/seeking' : '/');
    }

    // Make user data available to pages
    return {
        user: effectiveAuthState.user
    };
};

export const ssr = false; // Ensure load runs client-side for browser APIs (localStorage, window.location)
export const prerender = false; // Pages with dynamic auth logic usually cannot be prerendered
