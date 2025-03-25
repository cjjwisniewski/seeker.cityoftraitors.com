import { writable } from 'svelte/store';

interface AuthState {
    isAuthenticated: boolean;
    token: string | null;
    user: any | null;
}

const createAuthStore = () => {
    const { subscribe, set, update } = writable<AuthState>({
        isAuthenticated: false,
        token: null,
        user: null
    });

    return {
        subscribe,
        login: async () => {
            window.location.href = import.meta.env.PUBLIC_LOGIN_ENDPOINT;
        },
        logout: async () => {
            window.location.href = import.meta.env.PUBLIC_LOGOUT_ENDPOINT;
            set({ isAuthenticated: false, token: null, user: null });
        },
        checkAuth: async () => {
            try {
                const response = await fetch(import.meta.env.PUBLIC_AUTH_ENDPOINT);
                if (response.ok) {
                    const authData = await response.json();
                    update(state => ({
                        ...state,
                        isAuthenticated: true,
                        user: authData,
                        token: authData.access_token
                    }));
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Auth check failed:', error);
                return false;
            }
        }
    };
};

export const auth = createAuthStore();