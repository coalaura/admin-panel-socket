import { pack, unpack } from "./msgpack";

export class Client {
	#ws;
	#listeners = {};

	constructor(ws) {
		this.#ws = ws;

		this.#init();
	}

	#init() {
		this.#ws.on("error", console.error);

		this.#ws.on("close", () => {
			this.#trigger("disconnect");
		});

		this.#ws.on("message", packed => {
			const message = unpack(packed),
				type = message?.t,
				data = message?.d;

			if (!type || typeof data === "undefined") {
				console.error("Invalid message received.");

				return;
			}

			this.#trigger(type, data);
		});
	}

	#trigger(type, data) {
		const listeners = this.#listeners[type];

		if (!listeners?.length) {
			return;
		}

		for (const cb of listeners) {
			cb(data);
		}
	}

	close() {
		this.#ws.close();
	}

	on(type, cb) {
		if (type in this.#listeners) {
			this.#listeners[type].push(cb);
		} else {
			this.#listeners[type] = [cb];
		}
	}

	emit(type, data) {
		this.#ws.send(
			pack({
				t: type,
				d: data,
			})
		);
	}
}
