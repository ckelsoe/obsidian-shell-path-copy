// Pre-submission guard for Obsidian's automated marketplace review.
//
// Checks a small set of review rules that the local eslint plugin
// (eslint-plugin-obsidianmd) does NOT cover and that are not in the prose
// developer docs, but ARE enforced by Obsidian's online developer-dashboard
// preview scan. This is a PRE-FILTER, not the authoritative gate: the preview
// scan is the real gate and must be run on the release commit before publishing.
//
// Exits non-zero on any finding so it can chain into `npm run lint` and CI.

import { readdirSync, readFileSync } from "node:fs";

const findings = [];

// Forbid suppressing any obsidianmd/* lint rule. Obsidian's developer-dashboard
// scan rejects disabling its rules, and local eslint cannot report its own
// suppressions (an `// eslint-disable obsidianmd/...` reads as zero local errors
// but fails the dashboard), so this guard scans source for them and fails the
// build. Comply with the rule (rename, restructure) instead of disabling it.
const CODE_EXT = /\.(ts|mts|cts|tsx|js|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "scripts"]);
// Anchored to a comment opener (// or /*) so prose that merely mentions
// "eslint-disable" is not flagged; eslint only honors directives at a comment's start.
const DISABLE_OBSIDIANMD = /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?[^\n]*\bobsidianmd\//;
// Every eslint directive comment must carry a `-- description` (the dashboard
// enforces eslint-comments/require-description, which local eslint does not). A
// directive line is compliant only if it also contains a `--` separator.
const ESLINT_DIRECTIVE = /(?:\/\/|\/\*)\s*eslint-(?:disable|enable)(?:-next-line|-line)?\b/;

// Regex lookbehind. `(?<=` and `(?<!` are a PARSE error in JavaScriptCore before
// iOS 16.4, not a runtime one: an affected phone fails to load the plugin at all
// rather than mis-handling one note. Plugins that are not desktop-only ship to
// those devices, and esbuild targets es2018, which does not downlevel lookbehind,
// so one written in source ships verbatim. eslint-plugin-obsidianmd has a
// regex-lookbehind rule, but it is not in the `recommended` preset this repo
// uses, so nothing else in the lint chain catches it; this scan does.
//
// Named capture groups are `(?<name>` and are fine, so only the two lookbehind
// forms match.
const LOOKBEHIND = /\(\?<[=!]/;
const LOOKBEHIND_WHY =
	"regex lookbehind is a parse error in JavaScriptCore before iOS 16.4, so the plugin will not load at all on those devices. Rewrite the pattern as a scan.";

// Type-asserting to Window (`as Window` or `as unknown as Window`) silences the
// type system around a global instead of using Obsidian's activeWindow /
// activeDocument or proper typing. A past PR had exactly this assertion approved
// by an AI reviewer even though the repo bans it; the dashboard scan cannot see
// it, so encode it here as a deterministic gate. Comment lines are blanked
// (uses `code`), so the ban documented in a comment is not itself flagged.
const WINDOW_ASSERT = /\bas\s+(?:unknown\s+as\s+)?Window\b/;
const WINDOW_ASSERT_WHY =
	"do not type-assert to Window (`as Window`); use Obsidian's activeWindow / activeDocument or proper typing instead.";

function* walkCode(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) yield* walkCode(path);
		} else if (CODE_EXT.test(entry.name) && entry.name !== "main.js") {
			yield path;
		}
	}
}

// Comments blanked, line numbers preserved, the same trick the styles.css check
// below uses. The two eslint-directive rules above READ comments and so want the
// raw line; the lookbehind and Window-assertion scans must not, or they flag a
// comment that quotes the banned syntax to explain the ban (e.g. this file).
function withoutComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
		.split(/\r?\n/)
		.map((line) => line.replace(/\/\/.*$/, ""));
}

for (const file of walkCode(".")) {
	const source = readFileSync(file, "utf8");
	const lines = source.split(/\r?\n/);
	const code = withoutComments(source);
	lines.forEach((line, index) => {
		const where = `${file.replace(/^\.\//, "")}:${index + 1}`;
		if (DISABLE_OBSIDIANMD.test(line)) {
			findings.push(`${where}: do not eslint-disable an obsidianmd/* rule; comply with it (rename or restructure) instead.`);
		}
		if (ESLINT_DIRECTIVE.test(line) && !line.includes("--")) {
			findings.push(`${where}: eslint directive comment needs a "-- description" explaining why it is necessary.`);
		}
		if (LOOKBEHIND.test(code[index] ?? "")) {
			findings.push(`${where}: ${LOOKBEHIND_WHY}`);
		}
		if (WINDOW_ASSERT.test(code[index] ?? "")) {
			findings.push(`${where}: ${WINDOW_ASSERT_WHY}`);
		}
	});
}

// The manifest description must not contain the word "Obsidian" (the online
// review rejects it as redundant with the plugin-directory context), must be at
// most 250 characters, and must end with sentence punctuation.
try {
	const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
	const description = typeof manifest.description === "string" ? manifest.description : "";
	if (/\bobsidian\b/i.test(description)) {
		findings.push('manifest.json: the description must not contain the word "Obsidian".');
	}
	if (description.length > 250) {
		findings.push(`manifest.json: the description is ${description.length} characters; the maximum is 250.`);
	}
	if (description && !/[.!?]$/.test(description.trim())) {
		findings.push("manifest.json: the description must end with '.', '!' or '?'.");
	}
} catch (error) {
	findings.push(`manifest.json: could not read or parse (${error.message}).`);
}

// The BUILT bundle, when there is one, must also be free of lookbehind.
//
// Opportunistic, and deliberately NOT the primary check: `main.js` is gitignored,
// so it is absent on a fresh checkout. In CI `npm run lint` runs before
// `npm run build`, and the release flow does not run lint at all, so in current
// automation this branch finds nothing; it fires only when lint runs after a
// build (e.g. locally). The source scan above is the guard that actually holds in
// CI; this adds the one thing sources cannot show, a DEPENDENCY that inlines a
// lookbehind into the bundle. Making automation scan the built bundle would mean
// reordering the workflows to run this after the build (a fleet-wide change).
try {
	const bundle = readFileSync("main.js", "utf8");
	bundle.split(/\r?\n/).forEach((line, index) => {
		if (LOOKBEHIND.test(line)) {
			findings.push(`main.js:${index + 1}: ${LOOKBEHIND_WHY}`);
		}
	});
} catch {
	// No bundle on this run. The source scan above already covers our own code.
}

// styles.css must not use !important (raise selector specificity instead). Block
// comments are blanked first so a comment that mentions the token is not flagged,
// while line numbers are preserved.
try {
	const css = readFileSync("styles.css", "utf8");
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
	withoutComments.split(/\r?\n/).forEach((line, index) => {
		if (/!important/i.test(line)) {
			findings.push(`styles.css:${index + 1}: avoid !important; raise selector specificity instead.`);
		}
	});
} catch {
	// styles.css is optional; skip if absent.
}

if (findings.length > 0) {
	console.error("Submission pre-check failed:");
	for (const finding of findings) console.error(`  - ${finding}`);
	console.error("");
	console.error("This is a pre-filter only. Run the Obsidian developer-dashboard preview scan");
	console.error("on the release commit for the authoritative result.");
	process.exit(1);
}

console.log("Submission pre-check passed (pre-filter only; the developer-dashboard preview scan is the authoritative gate).");
