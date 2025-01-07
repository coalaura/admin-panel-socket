import net from "node:net";
import { generateKeyPairSync, publicEncrypt, privateDecrypt, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

import configData from "./config.js";

class EncryptionKey {
	#public;
	#private;

	constructor(pub, priv) {
		this.#public = pub;
		this.#private = priv;
	}

	static create() {
		const { publicKey, privateKey } = generateKeyPairSync("rsa", {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: "pkcs1",
				format: "pem",
			},
			privateKeyEncoding: {
				type: "pkcs8",
				format: "pem",
			},
		});

		return new EncryptionKey(publicKey, privateKey);
	}

	publicKey() {
		return this.#public;
	}

	encrypt(data) {
		return publicEncrypt(this.#public, asBuffer(data));
	}

	decrypt(encrypted) {
		if (!this.#private) {
			throw new Error("Private key not set");
		}

		return privateDecrypt(
			{
				key: this.#private,
				oaepHash: "sha256",
			},
			encrypted
		);
	}
}

class SecureConnection {
	#socket;
	#key;

	#success = 0;
	#failed = 0;

	#requests = [];

	constructor(socket, key, onDeath) {
		this.#socket = socket;
		this.#key = key;

		this.#socket.on("close", () => {
			this.#socket.destroy();

			this.#socket = null;

			onDeath();
		});

		this.#listen();
	}

	static async connect(host, port, onDeath) {
		const socket = await establishTCPConnection(host, port),
			local = EncryptionKey.create();

		// Perform the key exchange
		const key = await SecureConnection.#performKeyExchange(socket, local);

		return new SecureConnection(socket, key, onDeath);
	}

	static async #performKeyExchange(socket, local) {
		// Send our public key
		const packet = createPacket(0, local.publicKey());

		socket.write(packet);

		// Read the shared session key
		const encrypted = await SecureConnection.#readKey(socket);

		// Decrypt the shared session key
		return local.decrypt(encrypted);
	}

	static #readKey(socket) {
		return new Promise((resolve, reject) => {
			socket.once("data", resolve);
			socket.once("error", reject);

			setTimeout(() => {
				socket.off("data", resolve);
				socket.off("error", reject);

				reject(new Error("Timeout"));
			}, 5000);
		});
	}

	#requestId() {
		return randomBytes(4).readUInt32LE(0, true);
	}

	#listen() {
		let buffer = Buffer.alloc(0);

		this.#socket.on("data", data => {
			buffer = Buffer.concat([buffer, data]);

			while (buffer.length > 8) {
				const requestId = buffer.readUInt32LE(0, true);

				const length = buffer.readUInt32LE(4, true);

				if (length > buffer.length - 8) {
					break;
				}

				const encrypted = buffer.subarray(8, 8 + length);

				buffer = buffer.subarray(8 + length);

				const callback = this.#requests[requestId];

				if (callback) {
					callback(this.#decrypt(encrypted));

					delete this.#requests[requestId];
				}
			}
		});
	}

	#encrypt(data) {
		const nonce = randomBytes(12),
			cipher = createCipheriv("aes-256-gcm", this.#key, nonce);

		return Buffer.concat([nonce, cipher.update(data, "utf8"), cipher.final(), cipher.getAuthTag()]);
	}

	#decrypt(data) {
		const nonce = data.slice(0, 12),
			decipher = createDecipheriv("aes-256-gcm", this.#key, nonce);

		decipher.setAuthTag(data.slice(-16));

		return Buffer.concat([decipher.update(data.slice(12, -16)), decipher.final()]);
	}

	packetLoss() {
		return {
			success: this.#success,
			failed: this.#failed,
			loss: (this.#failed / (this.#success + this.#failed)) * 100,
		};
	}

	close() {
		if (!this.#socket) {
			return;
		}

		this.#socket.destroy();
	}

	send(data) {
		if (!this.#socket) {
			throw new Error("Connection closed");
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => finished(null, new Error("Timeout")), 5000);

			const requestId = this.#requestId();

			const finished = (data, err) => {
				clearTimeout(timeout);

				delete this.#requests[requestId];

				if (err) {
					this.#failed++;

					if (err.message === "Timeout") {
						this.close();
					}

					reject(err);
				} else {
					this.#success++;

					resolve(data);
				}
			};

			this.#requests[requestId] = finished;

			// Encrypt the data
			const encrypted = this.#encrypt(data);

			// Send the packet
			this.#socket.write(createPacket(requestId, encrypted));
		});
	}
}

export class HistoryStorage {
	#disabled = false;
	#connection;

	static #instance = null;

	static async getInstance() {
		if (!HistoryStorage.#instance) {
			HistoryStorage.#instance = new HistoryStorage();
		}

		await HistoryStorage.#instance.#connect();

		return HistoryStorage.#instance;
	}

	async #connect() {
		if (this.#connection || this.#disabled) {
			return;
		}

		const storage = configData.storage || "",
			match = storage?.match(/^([^:]+):(\d+)$/);

		if (!storage || !match || match.length < 3) {
			this.#disabled = true;

			return;
		}

		const host = match[1],
			port = parseInt(match[2]) || 4994;

		this.#connection = await SecureConnection.connect(host, port, () => {
			console.warn("Storage connection closed");

			this.#connection = null;
		});

		console.info("Storage connection established");
	}

	#request(type, server, timestamp1, timestamp2, license, data = null) {
		const header = Buffer.alloc(1 + 1 + 4 + 4 + 40);

		// Type (uint8)
		header.writeUInt8(type, 0);

		// Server (uint8) "c3" -> 3
		header.writeUInt8(parseInt(server.substr(1)), 1);

		// Timestamp 1 (uint32)
		header.writeUInt32LE(timestamp1, 2);

		// Timestamp 2 (uint32)
		header.writeUInt32LE(timestamp2, 6);

		// License (40 bytes)
		if (license) {
			header.write(Buffer.from(license, "utf8"), 10);
		}

		if (!data) return header;

		return Buffer.concat([header, data]);
	}

	packetLoss() {
		return this.#connection ? this.#connection.packetLoss() : false;
	}

	available() {
		return !this.#disabled;
	}

	close() {
		if (!this.#connection) {
			return;
		}

		this.#connection.close();

		this.#connection = null;
	}

	async store(server, timestamp, license, data) {
		if (this.#disabled) {
			return;
		}

		await this.#connect();

		// Send the request
		const response = await this.#connection.send(
			this.#request(
				1, // Store = 1
				server,
				timestamp,
				timestamp,
				license,
				asBuffer(data)
			)
		);

		// Check for the acknowledgement
		if (response.toString("utf8") !== "ACK") {
			throw new Error("Invalid or missing ACK");
		}
	}

	async readOne(server, start, end, license) {
		if (this.#disabled) {
			throw new Error("Storage disabled");
		}

		await this.#connect();

		// Send the request and wait for the data
		return await this.#connection.send(
			this.#request(
				2, // ReadOne = 2
				server,
				start,
				end,
				license,
				null
			)
		);
	}

	async readAll(server, timestamp) {
		if (this.#disabled) {
			throw new Error("Storage disabled");
		}

		await this.#connect();

		// Send the request and wait for the data
		return await this.#connection.send(
			this.#request(
				3, // ReadAll = 3
				server,
				timestamp,
				timestamp,
				null,
				null
			)
		);
	}
}

function asBuffer(data) {
	if (Buffer.isBuffer(data)) {
		return data;
	}

	return Buffer.from(data, "utf8");
}

function createPacket(requestId, data) {
	data = asBuffer(data);

	const packet = Buffer.alloc(4 + 4 + data.length);

	// Write the request id
	packet.writeUInt32LE(requestId, 0);

	// Write the length
	packet.writeUInt32LE(data.length, 4);

	// Write the data
	data.copy(packet, 8);

	return packet;
}

function establishTCPConnection(host, port) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host, port }, () => {
			socket.off("error", reject);

			resolve(socket);
		});

		socket.once("error", reject);
	});
}