import { BufferedWriter } from "./buffer.js";
import { HistoryStorage } from "./storage.js";

export class HistoryBin {
	static #instance;

	#server;
	#closed = false;
	#writers = {};

	constructor(server) {
		this.#server = server;
	}

	static getInstance(server) {
		if (!HistoryBin.#instance) {
			HistoryBin.#instance = new HistoryBin(server);
		}

		return HistoryBin.#instance;
	}

	#writer(timestamp, license) {
		const writer = this.#writers[license];

		if (writer) {
			writer.setTimestamp(timestamp);

			return writer;
		}

		this.#writers[license] = new BufferedWriter(this.#server, timestamp, license);

		return this.#writers[license];
	}

	#write(storage, timestamp, player) {
		const coords = player.coords,
			character = player.character;

		if (!character || !(character.flags & 64)) {
			return false;
		}

		/**
		 * | Timestamp (ui32) | character_id (ui32) | x (f32) | y (f32) | z (f32) | heading (f32) | speed (f32) | character_flags (ui32) | user_flags (ui32) |
		 */
		const license = player.licenseIdentifier.replace(/^license:/m, ""),
			writer = this.#writer(timestamp, license);

		writer.writeUint32(timestamp);
		writer.writeUint32(character.id);
		writer.writeFloat32(coords.x);
		writer.writeFloat32(coords.y);
		writer.writeFloat32(coords.z);
		writer.writeFloat32(coords.w);
		writer.writeFloat32(player.speed);
		writer.writeUint32(character.flags);
		writer.writeUint32(player.flags);

		writer.persist(storage);

		return license;
	}

	async writeAll(players) {
		if (this.#closed || !players?.length) return;

		const storage = await HistoryStorage.getInstance(),
			timestamp = Math.floor(Date.now() / 1000),
			active = {};

		for (const player of players) {
			const license = this.#write(storage, timestamp, player);

			if (license) {
				active[license] = true;
			}
		}

		for (const license in this.#writers) {
			if (!active[license]) {
				const writer = this.#writers[license];

				writer.close(storage);

				delete this.#writers[license];
			}
		}
	}

	async close() {
		if (this.#closed) return;

		this.#closed = true;

		const storage = await HistoryStorage.getInstance(),
			promises = [];

		for (const license in this.#writers) {
			const writer = this.#writers[license];

			promises.push(writer.close(storage));
		}

		await Promise.all(promises);
	}
}
