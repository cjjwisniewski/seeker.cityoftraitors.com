import { writable, get } from 'svelte/store'; // Import get
import { browser } from '$app/environment'; // Import browser check
import { fetchWithAuth } from '$lib/utils/api'; // Import fetchWithAuth

// Define the shape of the user object (adjust as needed based on your Azure Function response)
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
    isLoading: boolean; // To track initial auth check
    intendedPath: string | null; // To store the path user was trying to access before login redirect
}

// Use environment variables for Azure Function URLs - Fallbacks removed to enforce env var usage
const LOGIN_URL = import.meta.env.VITE_LOGIN_URL;
const LOGOUT_URL = import.meta.env.VITE_LOGOUT_URL;
const USER_INFO_URL = import.meta.env.VITE_USER_INFO_URL;


const createAuthStore = () => {
    const initialToken = browser ? localStorage.getItem('authToken') : null;

    const { subscribe, set, update } = writable<AuthState>({
        isAuthenticated: !!initialToken,
        token: initialToken,
        user: null, // User info will be fetched if token exists
        isLoading: true, // Start in loading state
        intendedPath: null, // Initialize intendedPath
    });

    // Function to fetch user info using the token
    async function fetchUserInfo(token: string) {
        console.debug('AuthStore: fetchUserInfo called.'); // Log entry
        if (!token) {
            console.error('AuthStore: fetchUserInfo called with no token.');
            return null;
        }
        if (!USER_INFO_URL) {
             console.error('AuthStore: fetchUserInfo cannot proceed, USER_INFO_URL is not defined.');
             return null;
        }
        console.debug(`AuthStore: Attempting to fetch user info from ${USER_INFO_URL} with token using fetchWithAuth.`);
        try {
            // Use fetchWithAuth to automatically handle token, APIM key, and 401 redirects
            const response = await fetchWithAuth(USER_INFO_URL, {
                 headers: {
                     // fetchWithAuth adds Authorization and Ocp-Apim-Subscription-Key
                     // Add other headers if needed by userinfo specifically
                 }
             });

            // fetchWithAuth returns undefined if it triggered a login redirect (e.g., on 401)
            if (!response) {
                 console.warn("AuthStore: fetchUserInfo aborted because fetchWithAuth triggered a redirect.");
                 return null; // Indicate failure/redirect
            }

            if (response.ok) {
                const userData: User = await response.json();
                return userData;
            } else {
                console.error('Failed to fetch user info:', response.status);
                // If token is invalid, clear it
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
        // Reset intendedPath on clear as well
        set({ isAuthenticated: false, token: null, user: null, isLoading: false, intendedPath: null });
    }

    // Function to set auth state and localStorage
    function setAuthData(token: string, user: User | null) {
        if (browser) {
            localStorage.setItem('authToken', token);
        }
        // Keep existing intendedPath when setting auth data
        update(state => ({ ...state, isAuthenticated: true, token: token, user: user, isLoading: false }));
    }

    // Initialize store on load (only in browser)
    async function initialize() {
        if (browser) {
            // Check if essential URLs are configured
            if (!LOGIN_URL || !USER_INFO_URL) {
                console.error('AuthStore FATAL: VITE_LOGIN_URL and/or VITE_USER_INFO_URL environment variables are not set. Authentication cannot proceed.');
                // Set loading to false but keep unauthenticated state
                update(state => ({ ...state, isAuthenticated: false, token: null, user: null, isLoading: false }));
                return; // Stop initialization
            }

            const token = localStorage.getItem('authToken');
            if (token) {
                console.debug('AuthStore: Found token in localStorage, fetching user info...');
                const user = await fetchUserInfo(token);
                if (user) {
                    setAuthData(token, user);
                } else {
                    // Token might be invalid/expired
                    console.debug('AuthStore: Token invalid or user fetch failed, clearing auth data.');
                    clearAuthData();
                }
            } else {
                console.debug('AuthStore: No token found in localStorage.');
                update(state => ({ ...state, isAuthenticated: false, token: null, user: null, isLoading: false }));
            }
        }
    }

    return {
        subscribe,
        initialize, // Expose initialize to be called from layout load
        // Function to store the path the user was trying to access
        setIntendedPath: (path: string) => {
            update(state => ({ ...state, intendedPath: path }));
        },
        login: () => {
            // Redirect to your Azure Function endpoint that starts the Discord OAuth flow
            // Use the stored intendedPath as state, default to '/'
            const stateToUse = get(auth).intendedPath || '/';
            console.debug(`AuthStore: Initiating login, state=${stateToUse}`);
            window.location.href = `${LOGIN_URL}?state=${encodeURIComponent(stateToUse)}`;
        },
        logout: async () => {
            const currentToken = localStorage.getItem('authToken');
            clearAuthData(); // Clear client-side state immediately

            // Optional: Call a backend logout endpoint if necessary (e.g., to invalidate server-side session)
            if (currentToken && LOGOUT_URL) {
                try {
                    await fetch(LOGOUT_URL, {
                        method: 'POST', // or GET, depending on your function
                        headers: { 'Authorization': `Bearer ${currentToken}` }
                    });
                } catch (error) {
                    console.error('Error calling logout endpoint:', error);
                }
            }
            // Redirect to login page after clearing data
             window.location.href = '/login'; // Or wherever you want to redirect after logout
        },
        // Call this from the callback page (+page.js)
        handleCallback: async (token: string) => {
            console.debug('AuthStore: handleCallback called.'); // Log entry
            if (!token) {
                console.error('AuthStore: handleCallback called with no token.');
                return false;
            }
            console.debug('AuthStore: Calling fetchUserInfo from handleCallback...');
            const user = await fetchUserInfo(token);
            if (user) {
                setAuthData(token, user);
                return true; // Indicate success
            } else {
                console.error('AuthStore: Failed to fetch user info after callback.');
                clearAuthData();
                return false; // Indicate failure
            }
        }
        // Removed checkAuth as initialization handles this now
    };
};

export const auth = createAuthStore();
