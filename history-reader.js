import { getHistoryPath } from "./history-bin.js";
import { formatBytes } from "./functions.js";

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { $ } from "bun";

async function read(file, license, min, max) {
	if (!await file.exists())
		return {
			license: license,
			data: [],
		};

	const buffer = await file.arrayBuffer(),
		view = new DataView(buffer),
		entries = [];

	if (view.byteLength % 36 !== 0) {
		console.log(danger(`Corrupt history file: ${file.name}`));

		return [];
	}

	for (let i = 0; i < view.byteLength; i += 36) {
		/**
		 * | Timestamp (ui32) | character_id (ui32) | x (f32) | y (f32) | z (f32) | heading (f32) | speed (f32) | character_flags (ui32) | user_flags (ui32) |
		 */
		const timestamp = view.getUint32(i, true),
			character_id = view.getUint32(i + 4, true),
			x = view.getFloat32(i + 8, true),
			y = view.getFloat32(i + 12, true),
			z = view.getFloat32(i + 16, true),
			heading = view.getFloat32(i + 20, true),
			speed = view.getFloat32(i + 24, true),
			character_flags = view.getUint32(i + 28, true),
			user_flags = view.getUint32(i + 32, true);

		if (timestamp < min) continue;
		else if (timestamp > max) break;

		entries.push({ timestamp, character_id, x, y, z, heading, speed, character_flags, user_flags });
	}

	return {
		license: license,
		data: entries,
	};
}

function bunFiles(server, license, from, till) {
	const files = [];

	for (let i = from; i <= till; i += 86400) {
		const path = getHistoryPath(server, i, license);

		files.push(Bun.file(path));
	}

	return files;
}

export async function range(server, license, start, end) {
	const files = bunFiles(server, license, start, end),
		entries = [];

	for (const file of files) {
		const entry = await read(file, license, start, end);

		entries.push(...entry.data);
	}

	return entries;
}

export async function single(server, timestamp) {
	const path = getHistoryPath(server, timestamp, null);

	if (!existsSync(path)) return {};

	const licenses = await readdir(path),
		promises = [];

	for (const license of licenses) {
		const file = Bun.file(`${path}/${license}`);

		promises.push(read(file, license, timestamp, timestamp));
	}

	const results = await Promise.all(promises),
		entries = {};

	for (const result of results) {
		if (!result.data.length) continue;

		entries[result.license] = result.data[0];
	}

	return entries;
}

async function size(path) {
	if (!existsSync(path)) return 0;

	try {
		const output = await $`du -sbL "${path}"`.text(),
			size = output.split(" ").shift();

		return parseInt(size) || 0;
	} catch (err) {
		console.log(danger(`Failed to get history size: ${err}`));

		return 0;
	}
}

export async function historyStatistics(server) {
	const local = await size(`./history/${server}`);

	return [`+ history size (${server}): ${formatBytes(local)}`];
}
