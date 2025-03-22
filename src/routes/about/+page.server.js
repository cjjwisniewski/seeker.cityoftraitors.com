export const load = async ({ locals }) => {
    // Add your authentication check here
    if (!locals.user) {
        throw redirect(302, '/login');
    }
    
    return {
        user: locals.user
    };
};