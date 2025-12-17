export class BufferedWriter {
	static EntryCount = 120; // 120 seconds for minimal data loss
	static EntrySize = 36; // 4 ui32 + 5 f32

	#offset = 0;
	#buffer;
	#view;

	#server;
	#timestamp;
	#license;
	#timeout;

	constructor(server, timestamp, license) {
		this.#server = server;
		this.#timestamp = timestamp;
		this.#license = license;

		this.#reset();
	}

	setTimestamp(timestamp) {
		this.#timestamp = timestamp;
	}

	#reset() {
		this.#offset = 0;

		if (!this.#buffer) {
			const staggering = Math.floor(Math.random() * 30);

			this.#buffer = new ArrayBuffer((BufferedWriter.EntryCount + staggering) * BufferedWriter.EntrySize);

			this.#view = new DataView(this.#buffer);
		}
	}

	async #flush(storage) {
		if (this.#offset === 0) {
			return;
		}

		const data = this.#buffer.slice(0, this.#offset);

		this.#reset();

		storage.store(this.#server, this.#timestamp, this.#license, data).catch(error => {
			console.error(`Failed to persist buffered data: ${error.message}`);
		});
	}

	writeUint32(ui32) {
		this.#view.setUint32(this.#offset, ui32, true);
		this.#offset += 4;
	}

	writeFloat32(f32) {
		this.#view.setFloat32(this.#offset, f32, true);
		this.#offset += 4;
	}

	async persist(storage) {
		if (this.#offset < this.#buffer.byteLength) {
			return;
		}

		await this.#flush(storage);
	}

	async close(storage) {
		clearTimeout(this.#timeout);

		await this.#flush(storage, true);
	}
}
