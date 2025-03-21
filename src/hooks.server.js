import DiscordOauth2 from 'discord-oauth2';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from '$env/static/private';

const oauth = new DiscordOauth2({
    clientId: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    redirectUri: DISCORD_REDIRECT_URI,
    version: '9'  // Add Discord API version
});

export const handle = async ({ event, resolve }) => {
    event.locals.oauth = oauth;
    event.locals.getUser = async () => {
        const token = event.cookies.get('discord_token');
        if (!token) {
            console.debug('No token found in cookies');
            return null;
        }
        try {
            const user = await oauth.getUser(token);
            return user;
        } catch (error) {
            console.error('Error getting user:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            // Remove invalid token
            event.cookies.delete('discord_token', { path: '/' });
            return null;
        }
    };
    
    const response = await resolve(event);
    return response;
};
