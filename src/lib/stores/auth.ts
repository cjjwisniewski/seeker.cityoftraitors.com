import { writable } from 'svelte/store';
import { browser } from '$app/environment'; // Import browser check

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
}

// Placeholder URLs - Replace with your actual Azure Function URLs (use import.meta.env.VITE_...)
const LOGIN_URL = '/api/login'; // Your Azure Function that initiates Discord OAuth
const LOGOUT_URL = '/api/logout'; // Your Azure Function that handles logout (optional)
const USER_INFO_URL = '/api/userinfo'; // Your Azure Function that returns user details based on token

const createAuthStore = () => {
    const initialToken = browser ? localStorage.getItem('authToken') : null;

    const { subscribe, set, update } = writable<AuthState>({
        isAuthenticated: !!initialToken,
        token: initialToken,
        user: null, // User info will be fetched if token exists
        isLoading: true, // Start in loading state
    });

    // Function to fetch user info using the token
    async function fetchUserInfo(token: string) {
        if (!token) return null;
        try {
            // Assume your user info endpoint expects the token in the Authorization header
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
        set({ isAuthenticated: false, token: null, user: null, isLoading: false });
    }

    // Function to set auth state and localStorage
    function setAuthData(token: string, user: User | null) {
        if (browser) {
            localStorage.setItem('authToken', token);
        }
        set({ isAuthenticated: true, token: token, user: user, isLoading: false });
    }

    // Initialize store on load (only in browser)
    async function initialize() {
        if (browser) {
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
                set({ isAuthenticated: false, token: null, user: null, isLoading: false });
            }
        }
    }

    return {
        subscribe,
        initialize, // Expose initialize to be called from layout load
        login: () => {
            // Redirect to your Azure Function endpoint that starts the Discord OAuth flow
            // Pass the current path to be redirected back after successful login
            const redirectState = window.location.pathname + window.location.search;
            // Append state to the login URL (adjust query param name if needed)
            window.location.href = `${LOGIN_URL}?state=${encodeURIComponent(redirectState)}`;
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
            console.debug('AuthStore: Handling callback with token...');
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
