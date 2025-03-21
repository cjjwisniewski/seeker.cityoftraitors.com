import { redirect } from '@sveltejs/kit';
import { getRolesFromCache, setRolesInCache } from '$lib/server/roleCache';

export const load = async ({ locals, url, cookies }) => {
    // Don't check auth for login-related paths
    if (url.pathname === '/login' || url.pathname === '/auth/callback') {
        return {};
    }

    const user = await locals.getUser();
    if (!user) {
        throw redirect(302, `/login?redirectTo=${url.pathname}`);
    }

    let userWithRoles = { ...user };

    // Check cache first
    const cachedRoles = getRolesFromCache(user.id);
    if (cachedRoles) {
        userWithRoles.roles = cachedRoles;
    } else {
        try {
            const token = cookies.get('discord_token');
            const guildResponse = await fetch(
                'https://discord.com/api/v10/users/@me/guilds/1352378110733062265/member',
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (guildResponse.ok) {
                const memberData = await guildResponse.json();
                userWithRoles.roles = memberData.roles;
                // Cache the roles
                setRolesInCache(user.id, memberData.roles);
            }
        } catch (error) {
            console.error('Error fetching user roles:', error);
        }
    }

    return {
        user: userWithRoles
    };
};