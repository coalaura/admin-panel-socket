import globals from 'globals';
import pluginJs from '@eslint/js';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import eslintPluginNode from 'eslint-plugin-node';

export default [
	{
		files: ['**/*.js', '**/*.mjs'], // Target both JavaScript and module files
		languageOptions: {
			globals: globals.node, // Use Node.js environment globals
			ecmaVersion: 'latest', // Support the latest ECMAScript version
			sourceType: 'module', // ECMAScript modules (since you're using import/export)
		},
		plugins: {
			'unused-imports': eslintPluginUnusedImports,
			'node': eslintPluginNode,
		},
		rules: {
			// Detect unused imports and variables, including unused exports
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'error',
				{ vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
			],

			// Warn on unused function declarations and variables
			'no-unused-vars': ['warn', { vars: 'all', args: 'after-used', argsIgnorePattern: '^_' }],
			'no-unused-private-class-members': 'warn',
			'no-unused-labels': 'warn',
			'no-unused-expressions': 'warn',

			// Node.js-specific linting rules
			'node/no-extraneous-import': 'error',
			'node/no-unsupported-features/es-syntax': 'off', // Turn off if using ESM

			// Best practices
			'eqeqeq': 'error', // Require strict equality (===)
			'no-console': 'off', // Console is fine in Node.js projects
			'no-debugger': 'error', // Disallow debugger statements
			'no-var': 'error', // Always use let/const instead of var
			'no-duplicate-imports': 'error', // Disallow duplicate imports
			'no-empty': ['error', { allowEmptyCatch: true }], // Allow empty catch blocks
			'require-await': 'error', // Disallow async functions which have no await expression

			// Catch common pitfalls in promises/async code
			'no-async-promise-executor': 'error',
		},
	},
	pluginJs.configs.recommended,
];
