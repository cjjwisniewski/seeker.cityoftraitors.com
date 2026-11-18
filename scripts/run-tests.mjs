import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

if (process.env.GITHUB_ACTIONS !== 'true') {
	console.error(
		'ABORTED: Local test execution is strictly disabled per AGENTS.md. ' +
			'Tests execute exclusively in GitHub Actions CI (GITHUB_ACTIONS=true).'
	);
	process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT_DIR, 'src', 'tests');

function resolveWithExtensions(basePath) {
	for (const ext of ['', '.ts', '.js', '.mjs']) {
		const candidate = basePath + ext;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return candidate;
		}
	}
	return basePath;
}

const svelteKitMocksPlugin = {
	name: 'sveltekit-virtual-mocks',
	setup(buildInstance) {
		buildInstance.onResolve({ filter: /^\$lib\// }, (args) => {
			const rel = args.path.slice('$lib/'.length);
			return {
				path: resolveWithExtensions(path.join(ROOT_DIR, 'src', 'lib', rel))
			};
		});

		buildInstance.onResolve(
			{ filter: /^\$(?:app\/environment|env\/dynamic\/public|env\/static\/public)$/ },
			(args) => ({
				path: args.path,
				namespace: 'sveltekit-virtual'
			})
		);

		buildInstance.onLoad({ filter: /.*/, namespace: 'sveltekit-virtual' }, (args) => {
			if (args.path === '$app/environment') {
				return {
					contents: 'export const browser = true; export const dev = false; export const building = false;',
					loader: 'js'
				};
			}
			if (args.path === '$env/dynamic/public') {
				return {
					contents:
						'export const env = { PUBLIC_LOGOUT_ENDPOINT: "https://seeker.azure-api.net/auth/logout" };',
					loader: 'js'
				};
			}
			if (args.path === '$env/static/public') {
				return {
					contents: [
						'export const PUBLIC_GET_SEEKING_LIST_FUNCTION_URL = "https://seeker.azure-api.net/seeker/getSeekingList";',
						'export const PUBLIC_ADD_TO_SEEKING_FUNCTION_URL = "https://seeker.azure-api.net/seeker/addToSeeking";',
						'export const PUBLIC_UPDATE_SEEKING_CARD_FUNCTION_URL = "https://seeker.azure-api.net/seeker/updateSeekingCard";',
						'export const PUBLIC_DELETE_FROM_SEEKING_FUNCTION_URL = "https://seeker.azure-api.net/seeker/deleteFromSeeking";',
						'export const PUBLIC_UPDATE_USER_SETTING_FUNCTION_URL = "https://seeker.azure-api.net/seeker/updateUserSetting";',
						'export const PUBLIC_TRIGGER_STOCK_CHECK_FUNCTION_URL = "https://seeker.azure-api.net/seeker/triggerStockCheck";',
						'export const PUBLIC_FETCH_MOXFIELD_DECK_FUNCTION_URL = "https://seeker.azure-api.net/seeker/fetchMoxfieldDeck";'
					].join('\n'),
					loader: 'js'
				};
			}
			return null;
		});
	}
};

const browserShimBanner = `
const __memStore = new Map();
const __localStorage = {
	getItem: (k) => (__memStore.has(String(k)) ? __memStore.get(String(k)) : null),
	setItem: (k, v) => { __memStore.set(String(k), String(v)); },
	removeItem: (k) => { __memStore.delete(String(k)); },
	clear: () => { __memStore.clear(); }
};
globalThis.localStorage = __localStorage;
globalThis.window = {
	localStorage: __localStorage,
	location: { href: 'https://seeker.cityoftraitors.com/seeking', pathname: '/seeking', search: '' },
	atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
	btoa: (bin) => Buffer.from(bin, 'binary').toString('base64'),
	addEventListener: () => {},
	removeEventListener: () => {}
};
`;

async function main() {
	const entries = fs
		.readdirSync(TESTS_DIR)
		.filter((f) => f.endsWith('.test.js') || f.endsWith('.test.ts'))
		.sort();

	if (entries.length === 0) {
		console.error('No test files found in src/tests/');
		process.exit(1);
	}

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seeker-ui-ci-'));
	const compiledFiles = [];

	try {
		for (const entry of entries) {
			const inFile = path.join(TESTS_DIR, entry);
			const outFile = path.join(tmpDir, entry.replace(/\.(ts|js)$/, '.mjs'));
			await build({
				entryPoints: [inFile],
				outfile: outFile,
				bundle: true,
				platform: 'node',
				format: 'esm',
				target: 'node20',
				banner: { js: browserShimBanner },
				plugins: [svelteKitMocksPlugin],
				external: ['node:*']
			});
			compiledFiles.push(outFile);
		}

		const res = spawnSync(process.execPath, ['--test', ...compiledFiles], {
			stdio: 'inherit',
			env: process.env
		});
		process.exit(res.status ?? 1);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
