import { redirect } from '@sveltejs/kit';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } from '$env/static/private';
import { PUBLIC_USER_TABLE_FUNCTION_URL } from '$env/static/public';

// Using the IDs from your original code snippet
const REQUIRED_GUILD_ID = '1352378110733062265';
const REQUIRED_ROLE_ID = '1352632428342280212';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ url, locals, cookies }) => {
    try {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        console.log('Full callback URL:', url.toString());
        console.log('Parsed parameters:', {
            code: code ? `${code.substring(0, 6)}...` : 'none',
            state,
            searchParams: Object.fromEntries(url.searchParams)
        });

        if (!code) {
            console.log('No code parameter found, redirecting to login');
            throw redirect(302, '/login?error=no_code');
        }

        // Add debug logging for OAuth config
        console.log('OAuth Configuration:', {
            redirectUri: DISCORD_REDIRECT_URI,
            currentUrl: url.toString(),
            codeProvided: !!code
        });

        // Request token from Discord
        console.log('Requesting token with code:', code ? `${code.substring(0, 6)}...` : 'none');
        console.log('Token request details:', {
            codeProvided: !!code,
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
            scope: 'identify guilds guilds.members.read' // Ensure correct scopes
        });

        // Verify token response
        if (!tokenResponse?.access_token) {
            console.error('Invalid or missing access_token in token response:', tokenResponse);
            throw new Error('Invalid token response from Discord');
        }
        console.log('Token received successfully.');

        // Get user's guilds from Discord
        const guilds = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${tokenResponse.access_token}`
            }
        }).then(res => res.json());

        if (!Array.isArray(guilds)) {
             console.error('Failed to fetch or parse guilds:', guilds);
             throw redirect(302, '/login?error=auth_failed&message=' + encodeURIComponent('Could not verify server membership.'));
        }

        // Check if user is in required server
        const isInServer = guilds.some(guild => guild.id === REQUIRED_GUILD_ID);
        if (!isInServer) {
            console.log(`User not in required server (ID: ${REQUIRED_GUILD_ID})`);
            throw redirect(302, '/login?error=server_required&message=' + encodeURIComponent('You must be a member of the required Discord server.'));
        }
        console.log('User is in required server.');

        // Get user's member details (including roles) for the required server from Discord
        const guildMemberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${REQUIRED_GUILD_ID}/member`, {
            headers: {
                'Authorization': `Bearer ${tokenResponse.access_token}`
            }
        });

        if (!guildMemberResponse.ok) {
            const errorText = await guildMemberResponse.text();
            console.error(`Failed to fetch guild member data (Status: ${guildMemberResponse.status}):`, errorText);
            throw redirect(302, '/login?error=auth_failed&message=' + encodeURIComponent('Failed to fetch user role data from Discord.'));
        }

        const guildMember = await guildMemberResponse.json();

        if (!guildMember || !Array.isArray(guildMember.roles)) {
            console.error('Invalid guild member response format:', guildMember);
            throw redirect(302, '/login?error=auth_failed&message=' + encodeURIComponent('Invalid role data received from Discord.'));
        }

        // Check if user has the required role
        if (!guildMember.roles.includes(REQUIRED_ROLE_ID)) {
            console.log(`User does not have required role (ID: ${REQUIRED_ROLE_ID})`);
            const errorMessage = 'You must have the required role in the Discord server to access this application.';
            throw redirect(302, `/login?error=role_required&message=${encodeURIComponent(errorMessage)}`);
        }
        console.log('User has required role.');

        // Get user info (ID, username etc.) using the token
        const user = await locals.oauth.getUser(tokenResponse.access_token);
         if (!user || !user.id) {
            console.error('Failed to get user info from token:', user);
            throw new Error('Failed to retrieve user information after authentication.');
        }

        console.log('Authentication checks passed:', {
            userId: user.id,
            username: user.username,
            state
        });

        // Initialize user's table using Authorization header towards *your* backend
        try {
            console.log(`Initializing/Checking user table for user ID: ${user.id}`);

            // *** THIS IS THE UPDATED FETCH CALL ***
            const tableResponse = await fetch(PUBLIC_USER_TABLE_FUNCTION_URL, {
                method: 'POST', // Or 'GET' if more appropriate for your backend function logic
                headers: {
                    // 'Content-Type': 'application/json', // Only if sending a JSON body
                    // No longer sending 'x-ms-client-principal-id'
                    'Authorization': `Bearer ${tokenResponse.access_token}` // Send the Discord token
                }
                // body: JSON.stringify({ userId: user.id }) // Optional: Send body if needed by your function
            });

            if (!tableResponse.ok) {
                const errorText = await tableResponse.text();
                // Log error but maybe don't block login unless table init is critical
                console.error('Backend: Failed to initialize user table:', {
                    status: tableResponse.status,
                    statusText: tableResponse.statusText,
                    error: errorText,
                    userId: user.id
                });
            } else {
                // Process successful response if needed
                const resultText = await tableResponse.text();
                try {
                    const result = resultText ? JSON.parse(resultText) : { message: 'Success (No Content)' };
                     console.log('Backend: User table initialization successful:', result);
                } catch (parseError) {
                     console.log('Backend: User table initialization returned non-JSON response (might be OK):', resultText);
                }
            }
        } catch (error) {
            // Log error but maybe don't block login unless table init is critical
            console.error('Backend: Error during table initialization fetch:', error);
        }

        // Set the cookies
        console.log('Setting discord_token cookie');
        cookies.set('discord_token', tokenResponse.access_token, {
            path: '/',
            httpOnly: false, // <<< SECURITY WARNING: Allows JS access. Consider httpOnly: true if possible.
            secure: process.env.NODE_ENV === 'production' || url.protocol === 'https:', // Use secure in prod or https
            maxAge: 60 * 60 * 24 * 1, // 1 day
            sameSite: 'lax' // Recommended
        });

        /* // Example: If you store separate user info
        cookies.set('user_info', JSON.stringify({ id: user.id, username: user.username }), {
            path: '/',
            httpOnly: true, // More secure
            secure: process.env.NODE_ENV === 'production' || url.protocol === 'https:',
            maxAge: 60 * 60 * 24 * 1,
            sameSite: 'lax'
        });
        */

        // Prepare data for the +page.svelte component associated with this route
        // It can use this data to perform the client-side redirect
        const redirectTarget = state && state !== '/login' ? state : '/';
        console.log('Callback successful, returning redirect target for page:', redirectTarget);
        return {
            redirect: redirectTarget,
            success: true
        };

    } catch (error) {
        // Log detailed error information
        console.error('Auth callback error details:', {
            message: error.message,
            status: error.status, // Specific to HTTP errors
            // response: error.response ? await error.response.text() : 'N/A', // If using node-fetch or similar
            stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace length
        });

        // Check if it's a redirect we threw intentionally
        if (error.status >= 300 && error.status < 400 && error.location) {
            console.log('Re-throwing intentional redirect:', error.location);
            throw error; // Re-throw the redirect object
        }

        // For unexpected errors, redirect to login with a generic message
        const genericMessage = 'Authentication failed due to an unexpected error. Please try again.';
        throw redirect(302, `/login?error=auth_failed&message=${encodeURIComponent(genericMessage)}`);
    }
};