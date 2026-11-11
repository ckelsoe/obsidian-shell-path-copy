// Mutation testing. Not a commit/CI gate (a full run takes minutes); run on
// demand with `npm run test:mutation` to find tests that pass without actually
// asserting behaviour. A high mutation score means the tests would catch a
// regression, not merely that they are green.
// Read by vitest.config.mts in the test workers, which inherit this environment.
process.env.PLUGIN_MUTATION_RUN = "1";

export default {
	packageManager: "npm",
	testRunner: "vitest",
	vitest: {
		configFile: "vitest.config.mts",
	},
	mutate: ["*.ts", "!*.test.ts", "!types.d.ts"],
	reporters: ["clear-text", "progress"],
	coverageAnalysis: "perTest",
	ignorePatterns: ["main.js", "dist"],
};
