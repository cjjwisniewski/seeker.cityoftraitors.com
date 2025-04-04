import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// default options are generally suitable for static hosting
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // or 404.html, or null if your host handles it
			precompress: false,
			strict: true
		})
	},
	preprocess: vitePreprocess()
};

export default config;
