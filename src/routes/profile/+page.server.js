import { redirect } from '@sveltejs/kit';
import { getRolesFromCache, setRolesInCache } from '$lib/server/roleCache';

const REQUIRED_GUILD_ID = '1352378110733062265';
const REQUIRED_ROLE_ID = '1352632428342280212';
const ADMIN_ROLE_ID = '1352632325640294411';

export const load = async ({ locals, cookies }) => {
    if (!locals.user) {
        throw redirect(302, '/login?error=auth_required&message=Please log in to view your profile');
    }

    let guildMember = false;
    let hasRole = false;
    let isAdmin = false;

    // Check cache first
    const cachedRoles = getRolesFromCache(locals.user.id);
    if (cachedRoles) {
        guildMember = true;
        hasRole = cachedRoles.includes(REQUIRED_ROLE_ID);
        isAdmin = cachedRoles.includes(ADMIN_ROLE_ID);
    } else {
        try {
            const token = cookies.get('discord_token');
            const guildResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${REQUIRED_GUILD_ID}/member`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (guildResponse.ok) {
                const memberData = await guildResponse.json();
                guildMember = true;
                hasRole = memberData.roles.includes(REQUIRED_ROLE_ID);
                isAdmin = memberData.roles.includes(ADMIN_ROLE_ID);
                // Cache the roles
                setRolesInCache(locals.user.id, memberData.roles);
            } else {
                console.error('Failed to fetch guild member data:', await guildResponse.text());
            }
        } catch (error) {
            console.error('Error fetching guild data:', error);
        }
    }

    return {
        user: locals.user,
        guildMember,
        hasRole,
        isAdmin
    };
};