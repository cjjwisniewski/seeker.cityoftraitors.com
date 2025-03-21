import { redirect } from '@sveltejs/kit';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from '$env/static/private';

const REQUIRED_GUILD_ID = '1352378110733062265';

export const load = async ({ url, locals, cookies }) => {
    const code = url.searchParams.get('code');
    const state = decodeURIComponent(url.searchParams.get('state') || '/');
    
    console.log('Starting OAuth callback with:', {
        hasCode: !!code,
        state,
        fullUrl: url.toString()
    });

    if (!code) {
        console.log('No code parameter found, redirecting to login');
        throw redirect(302, '/login?error=no_code');
    }

    try {
        // Modified token request parameters
        console.log('Requesting token with code:', code);
        console.log('Token request details:', {
            code,
            redirectUri: DISCORD_REDIRECT_URI,
            hasClientId: !!DISCORD_CLIENT_ID,
            hasClientSecret: !!DISCORD_CLIENT_SECRET
        });
        const tokenResponse = await locals.oauth.tokenRequest({
            clientId: DISCORD_CLIENT_ID,
            clientSecret: DISCORD_CLIENT_SECRET,
            code,
            redirectUri: DISCORD_REDIRECT_URI,
            grantType: 'authorization_code',
            scope: 'identify guilds'
        });

        // Verify token response
        if (!tokenResponse?.access_token) {
            console.error('Invalid token response:', tokenResponse);
            throw new Error('Invalid token response');
        }

        // Get user's guilds
        const guilds = await locals.oauth.getUserGuilds(tokenResponse.access_token);
        
        // Check if user is in required server
        const isInServer = guilds.some(guild => guild.id === REQUIRED_GUILD_ID);
        
        if (!isInServer) {
            console.log('User not in required server');
            throw redirect(302, '/login?error=server_required');
        } else {
            console.log('User is in required server');
        }

        // Get user info and set cookie
        const user = await locals.oauth.getUser(tokenResponse.access_token);
        
        console.log('Authentication successful:', {
            userId: user.id,
            guildsCount: guilds.length,
            state
        });

        // Set the cookie
        cookies.set('discord_token', tokenResponse.access_token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        // Instead of returning a redirect, return data
        return {
            redirect: state && state !== '/login' ? state : '/',
            success: true
        };

    } catch (error) {
        console.error('OAuth error:', error);
        return {
            redirect: '/login?error=auth_failed',
            success: false
        };
    }
};