const averages = {};

export function trackAverage(name, value) {
	const average = averages[name] || {
		values: [],
	};

	const now = Date.now();

	average.values.push({
		value: value,
		time: now,
	});

	average.values = average.values.filter(value => now - value.time < 60 * 1000);

	averages[name] = average;
}

export function getAverage(name) {
	const average = averages[name];

	if (!average) {
		return 0;
	}

	return Math.round(average.values.reduce((acc, value) => acc + value.value, 0) / average.values.length);
}
