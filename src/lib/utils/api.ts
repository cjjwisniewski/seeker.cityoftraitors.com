import { auth } from '$lib/stores/auth';
import { get } from 'svelte/store';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const authState = get(auth);
    
    if (!authState.isAuthenticated) {
        auth.login();
        return;
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-ZUMO-AUTH': authState.token || '',
        }
    });

    if (response.status === 401) {
        auth.login();
        return;
    }

    return response;
}