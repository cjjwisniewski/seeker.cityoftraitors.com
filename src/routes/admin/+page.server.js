import { redirect } from '@sveltejs/kit';
import { getRolesFromCache } from '$lib/server/roleCache';

const REQUIRED_GUILD_ID = '1352378110733062265';
const ADMIN_ROLE_ID = '1352632325640294411';

export const load = async ({ locals, cookies }) => {
    if (!locals.user) {
        throw redirect(302, '/login?error=auth_required&message=Please log in to access the admin panel');
    }

    // Check cache first
    const cachedRoles = getRolesFromCache(locals.user.id);
    if (cachedRoles) {
        if (!cachedRoles.includes(ADMIN_ROLE_ID)) {
            throw redirect(302, '/?error=unauthorized&message=You do not have permission to access this page');
        }
        return {
            user: locals.user,
            roles: cachedRoles
        };
    }

    // If no cache, check Discord API
    const token = cookies.get('discord_token');
    try {
        const guildResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${REQUIRED_GUILD_ID}/member`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!guildResponse.ok) {
            throw redirect(302, '/?error=unauthorized&message=You must be a server member to access this page');
        }

        const memberData = await guildResponse.json();
        
        if (!memberData.roles.includes(ADMIN_ROLE_ID)) {
            throw redirect(302, '/?error=unauthorized&message=You do not have permission to access this page');
        }

        return {
            user: locals.user,
            roles: memberData.roles
        };
    } catch (error) {
        console.error('Error checking admin access:', error);
        throw redirect(302, '/?error=server_error&message=Failed to verify permissions');
    }
};