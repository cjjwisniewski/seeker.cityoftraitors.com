import DiscordOauth2 from 'discord-oauth2';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from '$env/static/private';

const oauth = new DiscordOauth2({
    clientId: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    redirectUri: DISCORD_REDIRECT_URI,
    version: '9'
});

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export const handle = async ({ event, resolve }) => {
    // Set up OAuth instance
    event.locals.oauth = oauth;
    
    // Set up user getter function
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
            console.error('Error getting user:', error);
            event.cookies.delete('discord_token', { path: '/' });
            return null;
        }
    };

    // Get and set user data in locals
    const token = event.cookies.get('discord_token');
    if (token) {
        try {
            const user = await oauth.getUser(token);
            event.locals.user = user;
        } catch (error) {
            console.error('Error setting user in locals:', error);
            event.cookies.delete('discord_token', { path: '/' });
        }
    }
    
    const response = await resolve(event);
    return response;
};
