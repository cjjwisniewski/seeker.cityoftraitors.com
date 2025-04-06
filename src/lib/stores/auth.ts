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

    // Function to fetch user info using the token
    async function fetchUserInfo(token: string) {
        if (!token) {
            console.error('AuthStore: fetchUserInfo called with no token.');
            return null;
        }
        if (!USER_INFO_URL) {
             console.error('AuthStore: fetchUserInfo cannot proceed, USER_INFO_URL is not defined.');
             return null;
        }
        try {
            const response = await fetch(USER_INFO_URL, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData: User = await response.json();
                return userData;
            } else {
                console.error('Failed to fetch user info:', response.status);
                // Clear token if invalid (Unauthorized or Forbidden)
                if (response.status === 401 || response.status === 403) {
                    clearAuthData();
                }
                return null;
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
            return null;
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
            // Skip if already initializing or if already authenticated with user data loaded
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
            if (!LOGIN_URL || !USER_INFO_URL) {
                console.error('AuthStore FATAL: VITE_LOGIN_URL and/or VITE_USER_INFO_URL environment variables are not set. Authentication cannot proceed.');
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
                return false;
            }
            const user = await fetchUserInfo(token);
            if (user) {
                setAuthData(token, user);
                return { success: true };
            } else {
                // Failure likely means token was invalid or user info fetch failed (e.g., 403 due to missing role)
                console.error('AuthStore: Failed to fetch user info after callback.');
                clearAuthData();
                return { success: false, error: 'callback_failed' };
            }
        }
    };
};

export const auth = createAuthStore();
