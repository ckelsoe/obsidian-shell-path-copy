/**
 * Checked access for tests. Returns the value with `undefined` removed from
 * its type, and fails the test with a clear message when the value is
 * missing. Used instead of non-null assertions (`x!`), which only silence the
 * type checker. Copied from the shared helper; add `defined` from there if a
 * test needs it.
 */

/** The element at `index`, or a failure naming the index and length. */
export function at<T>(items: readonly T[] | undefined, index: number): T {
	if (items === undefined) {
		throw new Error(
			`expected an array to read index ${index}, got undefined`,
		);
	}
	const item = items[index];
	if (item === undefined) {
		throw new Error(
			`expected an element at index ${index}, array length is ${items.length}`,
		);
	}
	return item;
}
