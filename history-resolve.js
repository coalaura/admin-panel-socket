import { range, single } from "./history-reader.js";

export async function resolveHistoricData(server, license, from, till) {
	if (till < from) {
		throw Error("From must be before till");
	}

	let data;

	try {
		data = await range(server, license, from, till);
	} catch (err) {
		console.warn(err.stack);
	}

	if (!data || data.length === 0) {
		throw Error("No data for the selected period");
	}

	const result = {};

	for (const entry of data) {
		result[entry.timestamp] = minifyHistoricEntry(entry);
	}

	return result;
}

export async function resolveTimestampData(server, timestamp) {
	let data;

	try {
		data = await single(server, timestamp);
	} catch (err) {
		console.warn(err.stack);
	}

	if (!data || Object.keys(data).length === 0) {
		throw Error("No data for this timestamp");
	}

	const result = {};

	for (const license in data) {
		const entry = data[license];

		result[license] = minifyTimestampEntry(entry);
	}

	return result;
}

function minifyHistoricEntry(parsed) {
	const characterFlags = parsed.character_flags;

	return {
		x: parsed.x,
		y: parsed.y,
		z: parsed.z,
		i: !!(characterFlags & 8),
		c: !!(characterFlags & 16),
		f: !!(characterFlags & 32),
		d: !!(characterFlags & 1),
		s: parsed.speed,
	};
}

function minifyTimestampEntry(parsed) {
	return {
		_: parsed.character_id,
		x: parsed.x,
		y: parsed.y,
		z: parsed.z,

		h: parsed.heading,
		s: parsed.speed,

		cf: parsed.character_flags,
		uf: parsed.user_flags,
	};
}
