import { getHistoryPath } from "./history-bin.js";
import { formatBytes } from "./functions.js";

import { existsSync, readFileSync, readdirSync } from "fs";
import { $ } from "bun";

function read(path, min, max) {
	if (!existsSync(path)) return [];

	const data = readFileSync(path),
		view = new DataView(data.buffer),
		entries = [];

	if (view.byteLength % 36 !== 0) {
		console.log(danger(`Corrupt history file: ${path}`));

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

	return entries;
}

function paths(server, license, from, till) {
	const files = [];

	for (let i = from; i <= till; i += 86400) {
		files.push(getHistoryPath(server, i, license));
	}

	return files;
}

export function range(server, license, start, end) {
	const files = paths(server, license, start, end),
		entries = [];

	for (const path of files) {
		entries.push(...read(path, start, end));
	}

	return entries;
}

export function single(server, timestamp) {
	const path = getHistoryPath(server, timestamp, null);

	if (!existsSync(path)) return {};

	const licenses = readdirSync(path),
		entries = {};

	for (const license of licenses) {
		const entry = read(`${path}/${license}`, timestamp, timestamp);

		if (!entry.length) continue;

		entries[license] = entry[0];
	}

	return entries;
}

async function size(path) {
	if (!existsSync(path)) return 0;

	try {
		const output = await $`du -sb "${path}"`.text(),
			size = output.split(" ").shift();

		return parseInt(size) || 0;
	} catch (err) {
		return 0;
	}
}

export async function historyStatistics(server) {
	const [ total, local ] = await Promise.all([
		size("./history"),
		size(`./history/${server}`)
	])

	return [
		`+ History Size (all): ${formatBytes(total)}`,
		`+ History Size (${server}): ${formatBytes(local)}`
	];
}
