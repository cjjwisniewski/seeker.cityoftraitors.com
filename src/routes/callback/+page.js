// This route is purely client-side for handling the token from the hash.
// No server-side load function needed for adapter-static.
export const ssr = false;
export const prerender = false; // This page is dynamic based on the hash
