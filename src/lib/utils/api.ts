import { auth } from '$lib/stores/auth';
import { get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Wrapper around fetch that automatically adds the Authorization header
 * and handles 401 errors by triggering the login flow.
 *
 * @param url The URL to fetch.
 * @param options Fetch options.
 * @returns The fetch Response object, or undefined if redirecting to login.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response | undefined> {
    if (!browser) {
        // Should not be called server-side in static mode, but good practice
        console.error('fetchWithAuth called server-side');
        return undefined; // Or throw an error
    }

    let authState = get(auth); // Use let as it will be reassigned

    // If the store indicates loading, wait briefly for initialization
    // This is a simple mechanism; more robust solutions might use a promise in the store
    let retries = 0;
    while (authState.isLoading && retries < 5) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        authState = get(auth); // Re-check state
        retries++;
    }

    // If still loading or not authenticated after waiting, trigger login
    if (authState.isLoading || !authState.isAuthenticated || !authState.token) {
        console.warn('fetchWithAuth: Not authenticated or token missing. Redirecting to login.');
        auth.login(); // Trigger the login flow
        return undefined; // Indicate that the fetch did not proceed
    }

    // Add the Authorization header
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${authState.token}`);

    try {
        const response = await fetch(url, {
            ...options,
            headers: headers,
        });

        // If unauthorized, trigger login
        if (response.status === 401) {
            console.warn('fetchWithAuth: Received 401 Unauthorized. Redirecting to login.');
            auth.login(); // Trigger the login flow
            return undefined; // Indicate that the fetch did not proceed
        }

        return response; // Return the response for the caller to handle

    } catch (error) {
        console.error('fetchWithAuth: Network or other error during fetch:', error);
        // You might want to handle network errors differently, e.g., show a message
        throw error; // Re-throw the error for the caller
    }
}
