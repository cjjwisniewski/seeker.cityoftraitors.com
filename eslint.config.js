import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const browserAndNodeGlobals = {
	AbortController: 'readonly',
	Blob: 'readonly',
	Buffer: 'readonly',
	CustomEvent: 'readonly',
	Event: 'readonly',
	File: 'readonly',
	FileReader: 'readonly',
	HTMLElement: 'readonly',
	HTMLInputElement: 'readonly',
	Headers: 'readonly',
	IntersectionObserver: 'readonly',
	Intl: 'readonly',
	KeyboardEvent: 'readonly',
	MouseEvent: 'readonly',
	Response: 'readonly',
	URL: 'readonly',
	URLSearchParams: 'readonly',
	atob: 'readonly',
	btoa: 'readonly',
	caches: 'readonly',
	cancelAnimationFrame: 'readonly',
	clearInterval: 'readonly',
	clearTimeout: 'readonly',
	console: 'readonly',
	crypto: 'readonly',
	document: 'readonly',
	fetch: 'readonly',
	globalThis: 'readonly',
	localStorage: 'readonly',
	matchMedia: 'readonly',
	navigator: 'readonly',
	performance: 'readonly',
	process: 'readonly',
	requestAnimationFrame: 'readonly',
	self: 'readonly',
	sessionStorage: 'readonly',
	setInterval: 'readonly',
	setTimeout: 'readonly',
	structuredClone: 'readonly',
	window: 'readonly'
};

export default [
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: browserAndNodeGlobals
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
			'no-useless-escape': 'off'
		}
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
			]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser,
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
			],
			'svelte/no-at-html-tags': 'error',
			'svelte/valid-compile': 'off'
		}
	},
	prettier,
	...svelte.configs['flat/prettier']
];
