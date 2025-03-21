import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
    // Don't check auth for login-related paths
    if (url.pathname === '/login' || url.pathname === '/auth/callback') {
        return {};
    }

    const user = await locals.getUser();
    if (!user) {
        throw redirect(302, `/login?redirectTo=${url.pathname}`);
    }
    return {
        user
    };
};