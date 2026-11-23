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
		}),
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'font-src': ['self', 'data:'],
				'img-src': [
					'self',
					'https://cards.scryfall.io',
					'https://svgs.scryfall.io',
					'https://cdn.discordapp.com',
					'data:'
				],
				'connect-src': [
					'self',
					'https://seeker.azure-api.net',
					'https://api.scryfall.com',
					'https://open.er-api.com'
				],
				'base-uri': ['self'],
				'object-src': ['none']
			}
		}
	},
	preprocess: vitePreprocess()
};

export default config;
