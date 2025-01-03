import { HistoryStorage } from "./storage.js";
import { danger } from "./colors.js";

function read(view, license) {
	const entries = [];

	if (view.byteLength % 36 !== 0) {
		console.warn(danger(`Corrupt history file for ${license} (${view.byteLength} bytes)`));

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

		entries.push({ timestamp, character_id, x, y, z, heading, speed, character_flags, user_flags });
	}

	return entries;
}

export async function range(server, license, start, end) {
	const storage = await HistoryStorage.getInstance(),
		buffer = await storage.readOne(server, start, end, license);

	return read(new DataView(buffer.buffer), license);
}

export async function single(server, timestamp) {
	const storage = await HistoryStorage.getInstance(),
		buffer = await storage.readAll(server, timestamp),
		view = new DataView(buffer.buffer);

	const amount = view.getUint32(0, true),
		entries = {};

	let offset = 4;

	for (let i = 0; i < amount; i++) {
		const license = buffer.slice(offset, offset + 40).toString("utf8");
		offset += 40;

		const length = view.getUint32(offset, true);
		offset += 4;

		const entry = read(new DataView(buffer.buffer, offset, length), license).shift();

		if (entry) {
			entries[license] = entry;
		}

		offset += length;
	}

	return entries;
}
