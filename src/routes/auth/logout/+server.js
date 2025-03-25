import { redirect } from '@sveltejs/kit';

export async function GET({ cookies }) {
    // Remove the cookie server-side
    cookies.delete('discord_token', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
    });

    throw redirect(303, '/login');
}