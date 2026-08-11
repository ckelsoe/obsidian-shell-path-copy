// Scan-only Node ambient shim. Consumed ONLY by tsconfig.scan.json (the
// marketplace-scan reproduction), never by the normal build.
//
// The scan reproduction strips @types/node (via `types: []`) so a lib-version
// gap is exposed instead of masked. That also removes the Node `require` this
// plugin uses behind a Platform.isDesktop guard to load the desktop-only `path`
// module. The hosted developer-dashboard scan resolves `require` from its
// Node/Electron runtime, so it is NOT what the guard exists to catch; this
// minimal shim reproduces that so the guard does not false-fail on it while
// still surfacing any lib gap (the shim declares no String/Array members, so a
// missing ES2019/2020 method is still reported). The normal `tsc` build
// excludes this file (see tsconfig.json `exclude`) and uses @types/node, so
// there is no clash. This file is in eslint's globalIgnores, so its `any` shim
// is not linted.
declare function require(id: string): any;
