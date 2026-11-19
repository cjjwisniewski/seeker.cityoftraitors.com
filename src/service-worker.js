/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `seeker-shell-${version}`;
const PRECACHE_ASSETS = [...build, ...files];
const PRECACHE_SET = new Set(PRECACHE_ASSETS);

// Auth callbacks and live API origins must never be served from or written to cache.
const BYPASS_PATH_PREFIXES = ['/callback', '/auth/'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Never intercept cross-origin requests (Azure APIM, Scryfall, FX rates, CDNs).
	if (url.origin !== self.location.origin) return;

	// Never cache or intercept OAuth callback / auth routes.
	if (BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

	// Cache-first for immutable versioned build assets and precached static files.
	if (PRECACHE_SET.has(url.pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => cached || fetch(request))
		);
		return;
	}

	// Network-first for SPA navigations, falling back to cached app shell when offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const contentType = response.headers.get('content-type') || '';
					if (response.ok && contentType.includes('text/html')) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
					}
					return response;
				})
				.catch(async () => {
					const cachedShell =
						(await caches.match('/index.html')) || (await caches.match('/'));
					return (
						cachedShell ||
						new Response('Offline — please reconnect to load Seeker.', {
							status: 503,
							headers: { 'Content-Type': 'text/plain; charset=utf-8' }
						})
					);
				})
		);
	}
});
