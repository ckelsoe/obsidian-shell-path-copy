import { filterIcons, sortIcons } from '../icon-collect';

describe('filterIcons', () => {
	const ids = ['lucide-activity', 'lucide-arrow-up', 'lucide-camera', 'info', 'search'];

	test('returns the list unchanged for an empty query', () => {
		expect(filterIcons(ids, '')).toEqual(ids);
		expect(filterIcons(ids, '   ')).toEqual(ids);
	});

	test('matches a case-insensitive substring', () => {
		expect(filterIcons(ids, 'ARROW')).toEqual(['lucide-arrow-up']);
		expect(filterIcons(ids, 'info')).toEqual(['info']);
	});

	test('matches across the lucide- prefix and the bare name', () => {
		expect(filterIcons(ids, 'lucide-')).toEqual([
			'lucide-activity',
			'lucide-arrow-up',
			'lucide-camera',
		]);
		expect(filterIcons(ids, 'camera')).toEqual(['lucide-camera']);
	});

	test('returns an empty array when nothing matches', () => {
		expect(filterIcons(ids, 'zzz-nope')).toEqual([]);
	});

	test('does not mutate the input array', () => {
		const original = [...ids];
		filterIcons(ids, 'arrow');
		expect(ids).toEqual(original);
	});
});

describe('sortIcons', () => {
	test('sorts alphabetically without mutating the input', () => {
		const input = ['search', 'info', 'lucide-camera', 'lucide-activity'];
		const snapshot = [...input];
		expect(sortIcons(input)).toEqual([
			'info',
			'lucide-activity',
			'lucide-camera',
			'search',
		]);
		expect(input).toEqual(snapshot);
	});
});
