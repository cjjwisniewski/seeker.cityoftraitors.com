import { redirect } from '@sveltejs/kit';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from '$env/static/private';

const REQUIRED_GUILD_ID = '1352378110733062265';
const REQUIRED_ROLE_ID = '1352632428342280212';

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
            scope: 'identify guilds guilds.members.read'  // Added guilds.members.read scope
        });

        // Verify token response
        if (!tokenResponse?.access_token) {
            console.error('Invalid token response:', tokenResponse);
            throw new Error('Invalid token response');
        }

        // Get user's guilds
        const guilds = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`
            }
        }).then(res => res.json());
        
        // Check if user is in required server
        const isInServer = guilds.some(guild => guild.id === REQUIRED_GUILD_ID);
        
        if (!isInServer) {
            console.log('User not in required server');
            throw redirect(302, '/login?error=server_required&message=You must be a member of the City of Traitors Discord server.');
        } else {
            console.log('User is in required server');
        }

        // Get user's roles in the required server
        const guildMemberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${REQUIRED_GUILD_ID}/member`, {
            headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`
            }
        });

        if (!guildMemberResponse.ok) {
            const errorText = await guildMemberResponse.text();
            console.error('Failed to fetch guild member:', errorText);
            throw redirect(302, '/login?error=auth_failed&message=' + encodeURIComponent('Failed to fetch guild member data'));
        }

        const guildMember = await guildMemberResponse.json();

        if (!guildMember || !Array.isArray(guildMember.roles)) {
            console.error('Invalid guild member response:', guildMember);
            throw redirect(302, '/login?error=auth_failed&message=' + encodeURIComponent('Invalid guild member data'));
        }

        if (!guildMember.roles.includes(REQUIRED_ROLE_ID)) {
            console.log('User does not have required role');
            const errorMessage = 'You must have the Seeker role in the City of Traitors Discord to access this application.';
            console.log('Redirecting with error:', {
                error: 'role_required',
                message: errorMessage
            });
            throw redirect(302, `/login?error=role_required&message=${encodeURIComponent(errorMessage)}`);
        } else {
            console.log('User has required role');
        }

        // Get user info and set cookie
        const user = await locals.oauth.getUser(tokenResponse.access_token);
        
        console.log('Authentication successful:', {
            userId: user.id,
            guildsCount: guilds.length,
            state
        });

        // Set the cookies
        cookies.set('discord_token', tokenResponse.access_token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        cookies.set('token_timestamp', Date.now().toString(), {
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
        console.error('Auth error:', error);
        
        // Check if error is already a redirect
        if (error instanceof redirect) {
            console.log('Re-throwing redirect with params:', new URL(error.location).searchParams.toString());
            throw error;
        }
        
        // For unexpected errors, throw a generic auth failed redirect
        throw redirect(302, '/login?error=auth_failed&message=' + encodeURIComponent('Authentication failed. Please try again.'));
    }
};