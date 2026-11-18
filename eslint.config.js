import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
	js.configs.recommended,
	prettier,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				Buffer: 'readonly',
				Headers: 'readonly',
				Response: 'readonly',
				URL: 'readonly',
				clearTimeout: 'readonly',
				console: 'readonly',
				document: 'readonly',
				fetch: 'readonly',
				globalThis: 'readonly',
				localStorage: 'readonly',
				process: 'readonly',
				setTimeout: 'readonly',
				window: 'readonly'
			}
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-useless-escape': 'off'
		}
	}
];
