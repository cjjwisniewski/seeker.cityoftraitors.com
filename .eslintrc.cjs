module.exports = {
	root: true,
	env: {
		browser: true,
		es2022: true,
		node: true
	},
	extends: ['eslint:recommended', 'prettier'],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module'
	},
	rules: {
		'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		'no-useless-escape': 'off'
	}
};
