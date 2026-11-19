import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';
import { createDemoUser, DEMO_STORAGE_KEYS } from '$lib/demo/demoSeed';
import { initializeDemoStorage, saveDemoSettings } from '$lib/demo/demoStore';
import type { DemoUserSettings } from '$lib/demo/demoTypes';

// Define the shape of the user object
interface User {
    id: string;
    discordId?: string;
    username: string;
    globalName?: string;
    discriminator?: string;
    avatar?: string | null;
    roles?: string[]; // Add roles if your user info endpoint returns them
    isAdmin?: boolean;
    membershipTier?: string;
    scanningPaused?: boolean;
    settings?: {
        stockAlertEnabled?: boolean;
        stockDigestEnabled?: boolean;
        stockDigestHourUtc?: number;
        priceDropAlertEnabled?: boolean;
        priceDropThreshold?: number;
        preferredLanguage?: string;
        preferredFinish?: string;
        minCondition?: string;
        membershipTier?: string;
        marketplaceCardtraderEnabled?: boolean;
        marketplaceTcgplayerEnabled?: boolean;
        marketplaceEbayEnabled?: boolean;
        marketplaceManapoolEnabled?: boolean;
        marketplaceCardkingdomEnabled?: boolean;
        marketplaceHimarketEnabled?: boolean;
        marketplaceHareruyaEnabled?: boolean;
        marketplaceRutenEnabled?: boolean;
        marketplaceCardmarketEnabled?: boolean;
    };
}

interface AuthState {
    isAuthenticated: boolean;
    token: string | null;
    user: User | null;
    isLoading: boolean;
    intendedPath: string | null;
    isDemo: boolean;
}

// Use environment variables for Azure Function URLs
const LOGIN_URL = import.meta.env.VITE_LOGIN_URL;
const LOGOUT_URL = import.meta.env.VITE_LOGOUT_URL || publicEnv.PUBLIC_LOGOUT_ENDPOINT || 'https://api.cityoftraitors.com/auth/logout';
const USER_INFO_URL = import.meta.env.VITE_USER_INFO_URL;
const ADMIN_ROLE_ID = '1352632325640294411';

function normalizeUser(user: User | null, isDemo = false): User | null {
    if (!user) return null;
    return {
        ...user,
        isAdmin: !isDemo && (Boolean(user.isAdmin) || (Array.isArray(user.roles) && user.roles.includes(ADMIN_ROLE_ID)))
    };
}


const createAuthStore = () => {
    const initialToken = browser ? localStorage.getItem('authToken') : null;

    const { subscribe, set, update } = writable<AuthState>({
        isAuthenticated: !!initialToken,
        token: initialToken,
        user: null,
        isLoading: true,
        intendedPath: null,
        isDemo: false
    });

    let isInitializing = false; // Prevent concurrent initializations
    let storageListenerRegistered = false;

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
                roles: payload.roles,
                isAdmin: Array.isArray(payload.roles) && payload.roles.includes('1352632325640294411')
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
                return normalizeUser(data);
            } else if (response.status === 401 || response.status === 403) {
                console.warn(`AuthStore: Session rejected by API (Status: ${response.status}).`);
                return null;
            } else {
                console.error(`AuthStore: API error fetching user info (Status: ${response.status}). Preserving cached profile if available.`);
                const cached = getCachedUser();
                return cached || parseJwt(token);
            }
        } catch (error) {
            console.error('AuthStore: Network error fetching user info. Preserving cached profile if available:', error);
            const cached = getCachedUser();
            return cached || parseJwt(token);
        }
    }

    // Function to clear auth state and localStorage
    function clearAuthData() {
        if (browser) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('cachedUserInfo');
            localStorage.removeItem(DEMO_STORAGE_KEYS.ACTIVE);
        }
        set({ isAuthenticated: false, token: null, user: null, isLoading: false, intendedPath: null, isDemo: false });
    }

    function setAuthData(token: string, user: User | null) {
        const normalizedUser = normalizeUser(user, false);
        if (browser) {
            localStorage.removeItem(DEMO_STORAGE_KEYS.ACTIVE);
            localStorage.setItem('authToken', token);
            if (normalizedUser) {
                localStorage.setItem('cachedUserInfo', JSON.stringify(normalizedUser));
            }
        }
        // Keep existing intendedPath when setting auth data
        update(state => ({ ...state, isAuthenticated: true, token: token, user: normalizedUser, isLoading: false, isDemo: false }));
    }

    function enterDemoMode(force = false) {
        if (!browser) return;
        const currentState = get(auth);
        if (!force && currentState.isAuthenticated && !currentState.isDemo) {
            return;
        }
        if (force) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('cachedUserInfo');
        }
        const settings = initializeDemoStorage();
        localStorage.setItem(DEMO_STORAGE_KEYS.ACTIVE, '1');
        set({
            isAuthenticated: true,
            token: null,
            user: createDemoUser(settings),
            isLoading: false,
            intendedPath: null,
            isDemo: true
        });
    }

    function exitDemoMode() {
        if (browser) {
            localStorage.removeItem(DEMO_STORAGE_KEYS.ACTIVE);
        }
        set({
            isAuthenticated: false,
            token: null,
            user: null,
            isLoading: false,
            intendedPath: null,
            isDemo: false
        });
    }

    // Function to handle background refresh of user info
    async function refreshUserInfo(token: string) {
        try {
            const user = await fetchUserInfo(token);
            if (user) {
                setAuthData(token, user);
            } else {
                console.warn('AuthStore: Background refresh failed to get user. Token likely expired.');
                clearAuthData(); // Token is invalid, clear state
            }
        } catch (error) {
            console.error('AuthStore: Background refresh error:', error);
        }
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

            if (!storageListenerRegistered) {
                storageListenerRegistered = true;
                window.addEventListener('storage', (event) => {
                    if (event.key === 'authToken') {
                        if (!event.newValue) {
                            if (!get(auth).isDemo) {
                                set({ isAuthenticated: false, token: null, user: null, isLoading: false, intendedPath: null, isDemo: false });
                            }
                        } else {
                            const jwtUser = parseJwt(event.newValue);
                            if (jwtUser) {
                                let syncedUser: User | null = jwtUser;
                                try {
                                    const cached = localStorage.getItem('cachedUserInfo');
                                    if (cached) syncedUser = JSON.parse(cached);
                                } catch {
                                    // ignore malformed cache
                                }
                                update(state => ({ ...state, isAuthenticated: true, token: event.newValue, user: normalizeUser(syncedUser, false), isLoading: false, isDemo: false }));
                            }
                        }
                    }
                });
            }

            const token = localStorage.getItem('authToken');
            const demoActive = localStorage.getItem(DEMO_STORAGE_KEYS.ACTIVE) === '1';

            if (!LOGIN_URL && !demoActive) {
                console.error('AuthStore FATAL: VITE_LOGIN_URL environment variable is not set. Authentication cannot proceed.');
                update(state => ({ ...state, isAuthenticated: false, token: null, user: null, isLoading: false, isDemo: false }));
                isInitializing = false;
                return; // Stop initialization
            }

            if (token && LOGIN_URL) {
                const jwtUser = parseJwt(token);
                if (!jwtUser) {
                    // Token is expired or malformed; clear stale cache immediately
                    clearAuthData();
                    if (demoActive) {
                        enterDemoMode(false);
                    }
                } else {
                    // Try to get cached user info for instant load
                    let initialUser: User | null = null;
                    const cachedUserStr = localStorage.getItem('cachedUserInfo');

                    if (cachedUserStr) {
                        try {
                            initialUser = JSON.parse(cachedUserStr);
                        } catch (e) {
                            console.warn('AuthStore: Error parsing cachedUserInfo:', e);
                        }
                    }

                    if (!initialUser) {
                        initialUser = jwtUser;
                    }

                    setAuthData(token, initialUser);

                    // Trigger a background refresh to get the latest settings/profile
                    refreshUserInfo(token);
                }
            } else if (demoActive) {
                enterDemoMode(false);
            } else {
                update(state => ({ ...state, isAuthenticated: false, token: null, user: null, isLoading: false, isDemo: false }));
            }

            isInitializing = false;
        }
    }

    return {
        subscribe,
        initialize,
        clearAuthData,
        setAuthData,
        enterDemoMode,
        exitDemoMode,
        setIntendedPath: (path: string) => {
            update(state => ({ ...state, intendedPath: path }));
        },
        login: () => {
            if (browser) {
                localStorage.removeItem(DEMO_STORAGE_KEYS.ACTIVE);
            }
            if (!LOGIN_URL) {
                console.error('AuthStore: VITE_LOGIN_URL is not configured.');
                return;
            }
            // Use the stored intendedPath as state for the OAuth flow, default to '/'
            const rawIntended = get(auth).intendedPath || '/';
            const stateToUse = rawIntended.startsWith('/demo') ? '/seeking' : rawIntended;
            window.location.href = `${LOGIN_URL}?state=${encodeURIComponent(stateToUse)}`;
        },
        logout: async () => {
            const currentState = get(auth);
            if (currentState.isDemo) {
                exitDemoMode();
                window.location.href = '/login';
                return;
            }

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
        },
        updateSettings: (newSettings: Partial<NonNullable<User['settings']>>) => {
            update(state => {
                if (state.user) {
                    const merged = {
                        ...state.user.settings,
                        ...newSettings
                    };
                    if (state.isDemo) {
                        const sanitized = saveDemoSettings(merged as DemoUserSettings);
                        state.user.settings = sanitized;
                    } else {
                        state.user.settings = merged;
                        if (browser) {
                            localStorage.setItem('cachedUserInfo', JSON.stringify(state.user));
                        }
                    }
                }
                return state;
            });
        }
    };
};

export const auth = createAuthStore();
