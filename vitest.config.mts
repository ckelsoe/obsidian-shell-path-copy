import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// TypeScript first. The build writes main.js next to main.ts, and with the
		// default order a test importing `../main` would run the last build, not the
		// source.
		extensions: ['.ts', '.mts', '.mjs', '.js', '.json'],
	},
	test: {
		globals: true,
		environment: 'node',
		include: ['__tests__/**/*.test.ts'],
		// Stryker's instrumented code runs some 20 times slower, so a mutation run
		// (stryker.config.mjs sets the flag) gets a far wider limit.
		testTimeout: process.env.PLUGIN_MUTATION_RUN ? 600_000 : 30_000,
	},
});
