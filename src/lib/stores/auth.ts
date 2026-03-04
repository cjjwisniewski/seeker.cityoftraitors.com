import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Define the shape of the user object
interface User {
    id: string;
    username: string;
    avatar?: string;
    roles?: string[]; // Add roles if your user info endpoint returns them
    // Add other relevant user properties
}

interface AuthState {
    isAuthenticated: boolean;
    token: string | null;
    user: User | null;
    isLoading: boolean;
    intendedPath: string | null;
}

// Use environment variables for Azure Function URLs
const LOGIN_URL = import.meta.env.VITE_LOGIN_URL;
const LOGOUT_URL = import.meta.env.VITE_LOGOUT_URL;
const USER_INFO_URL = import.meta.env.VITE_USER_INFO_URL;


const createAuthStore = () => {
    const initialToken = browser ? localStorage.getItem('authToken') : null;

    const { subscribe, set, update } = writable<AuthState>({
        isAuthenticated: !!initialToken,
        token: initialToken,
        user: null,
        isLoading: true,
        intendedPath: null,
    });

    let isInitializing = false; // Prevent concurrent initializations

    // Function to parse user info from JWT payload
    function parseJwt(token: string): User | null {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));

            const payload = JSON.parse(jsonPayload);

            // Check expiration
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                console.warn('JWT has expired.');
                return null;
            }

            return {
                id: payload.id,
                username: payload.username,
                avatar: payload.avatar,
                roles: payload.roles
            };
        } catch (e) {
            console.error('Invalid token format:', e);
            return null;
        }
    }

    // Function to fetch the full user profile including settings from the API
    async function fetchUserInfo(token: string): Promise<User | null> {
        if (!USER_INFO_URL) {
            console.warn('AuthStore: VITE_USER_INFO_URL not set, falling back to JWT payload.');
            return parseJwt(token);
        }

        try {
            const response = await fetch(USER_INFO_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            } else if (response.status === 401) {
                console.warn('AuthStore: Token invalid according to API.');
                return null;
            } else {
                console.error(`AuthStore: API error fetching user info (Status: ${response.status}). Falling back to JWT.`);
                return parseJwt(token);
            }
        } catch (error) {
            console.error('AuthStore: Network error fetching user info. Falling back to JWT:', error);
            return parseJwt(token);
        }
    }

    // Function to clear auth state and localStorage
    function clearAuthData() {
        if (browser) {
            localStorage.removeItem('authToken');
        }
        set({ isAuthenticated: false, token: null, user: null, isLoading: false, intendedPath: null });
    }

    function setAuthData(token: string, user: User | null) {
        if (browser) {
            localStorage.setItem('authToken', token);
        }
        // Keep existing intendedPath when setting auth data
        update(state => ({ ...state, isAuthenticated: true, token: token, user: user, isLoading: false }));
    }

    async function initialize() {
        if (browser) {
            const currentState = get(auth);
            // Skip if already initializing
            if (isInitializing || (currentState.isAuthenticated && currentState.user)) {
                // Ensure loading is false if we skip while it was true
                if (currentState.isLoading) {
                    update(state => ({ ...state, isLoading: false }));
                }
                return;
            }

            isInitializing = true;
            update(state => ({ ...state, isLoading: true }));

            // Check if essential URLs are configured
            if (!LOGIN_URL) {
                console.error('AuthStore FATAL: VITE_LOGIN_URL environment variable is not set. Authentication cannot proceed.');
                update(state => ({ ...state, isAuthenticated: false, token: null, user: null, isLoading: false }));
                return; // Stop initialization
            }

            const token = localStorage.getItem('authToken');
            if (token) {
                const user = await fetchUserInfo(token);
                if (user) {
                    setAuthData(token, user);
                } else {
                    clearAuthData(); // Token might be invalid/expired
                }
            } else {
                update(state => ({ ...state, isAuthenticated: false, token: null, user: null, isLoading: false }));
            }

            isInitializing = false;
        }
    }

    return {
        subscribe,
        initialize,
        setIntendedPath: (path: string) => {
            update(state => ({ ...state, intendedPath: path }));
        },
        login: () => {
            // Use the stored intendedPath as state for the OAuth flow, default to '/'
            const stateToUse = get(auth).intendedPath || '/';
            window.location.href = `${LOGIN_URL}?state=${encodeURIComponent(stateToUse)}`;
        },
        logout: async () => {
            const currentToken = localStorage.getItem('authToken');
            clearAuthData(); // Clear client-side state immediately

            // Optional: Call backend logout endpoint
            if (currentToken && LOGOUT_URL) {
                try {
                    await fetch(LOGOUT_URL, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${currentToken}` }
                    });
                } catch (error) {
                    console.error('Error calling logout endpoint:', error);
                }
            }
            window.location.href = '/login'; // Redirect after logout
        },
        handleCallback: async (token: string) => {
            if (!token) {
                console.error('AuthStore: handleCallback called with no token.');
                return { success: false, error: 'no_token' };
            }

            const user = await fetchUserInfo(token);
            if (user) {
                setAuthData(token, user);
                // The URL hash is cleared gracefully by SvelteKit layout logic (or parent)
                return { success: true };
            } else {
                console.error('AuthStore: Failed to fetch user info after callback.');
                clearAuthData();
                return { success: false, error: 'invalid_token' };
            }
        }
    };
};

export const auth = createAuthStore();
