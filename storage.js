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

	constructor(socket, key, onDeath) {
		this.#socket = socket;
		this.#key = key;

		this.#socket.on("close", () => {
			this.#socket.emit("error", new Error("Connection closed"));
			this.#socket.destroy();

			this.#socket = null;

            onDeath();
		});
	}

	static async connect(host, port, onDeath) {
		const socket = await establishTCPConnection(host, port),
			local = EncryptionKey.create();

		// Perform the key exchange
		const key = await SecureConnection.performKeyExchange(socket, local);

		return new SecureConnection(socket, key, onDeath);
	}

	static async performKeyExchange(socket, local) {
		// Send our public key
		const packet = createPacket(local.publicKey());

		socket.write(packet);

		// Read the shared session key
		const encrypted = await readFromSocket(socket);

		// Decrypt the shared session key
		return local.decrypt(encrypted);
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

	close() {
		if (!this.#socket) {
			return;
		}

		this.#socket.destroy();
	}

	async send(data) {
		if (!this.#socket) {
			throw new Error("Connection closed");
		}

		// Encrypt the data
		const encrypted = this.#encrypt(data);

		// Create the packet
		const packet = createPacket(encrypted);

		this.#socket.write(packet);
	}

	async read() {
		if (!this.#socket) {
			throw new Error("Connection closed");
		}

        // Read the packet
		const encrypted = await readFromSocket(this.#socket);

        // Decrypt the packet
		const data = this.#decrypt(encrypted);

        if (data.toString("utf8") === "ERR") {
            throw new Error("Something went wrong");
        }

        return data;
	}
}

export class HistoryStorage {
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
		if (this.#connection) {
			return;
		}

		const host = configData.storage?.host || "127.0.0.1",
			port = configData.storage?.port || 4994;

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

	close() {
		if (!this.#connection) {
			return;
		}

		this.#connection.close();
	}

	async store(server, timestamp, license, data) {
		await this.#connect();

		// Send the request
		await this.#connection.send(
			this.#request(
				1, // Store = 1
				server,
				timestamp,
				timestamp,
				license,
				asBuffer(data)
			)
		);

		// Wait for the acknowledgement
		const ack = await this.#connection.read();

		if (ack.toString("utf8") !== "ACK") {
			throw new Error("Invalid or missing ACK");
		}
	}

	async readOne(server, start, end, license) {
		await this.#connect();

		// Send the request
		await this.#connection.send(
			this.#request(
				2, // ReadOne = 2
				server,
				start,
				end,
				license,
                null
			)
		);

		// Wait for the data
		return await this.#connection.read();
	}

    async readAll(server, timestamp) {
        await this.#connect();

        // Send the request
        await this.#connection.send(
            this.#request(
                3, // ReadAll = 3
                server,
                timestamp,
                timestamp,
                null,
                null
            )
        );

        // Wait for the data
        return await this.#connection.read();
    }
}

function asBuffer(data) {
	if (Buffer.isBuffer(data)) {
		return data;
	}

	return Buffer.from(data, "utf8");
}

function readFromSocket(socket) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("Timeout"));
		}, 5000);

		socket.once("data", data => {
			clearTimeout(timeout);

			// Read the length
			const length = data.readUInt32LE(0);

			// Validate packet length
			if (length !== data.length - 4) {
				reject(new Error(`Expected ${length} bytes, got ${data.length - 4}`));

				return;
			}

			// Read the message
			resolve(data.slice(4, 4 + length));
		});

		socket.once("error", err => {
			clearTimeout(timeout);

			reject(err);
		});
	});
}

function createPacket(data) {
	data = asBuffer(data);

	const packet = Buffer.alloc(4 + data.length);

	// Write the length
	packet.writeUInt32LE(data.length, 0);

	// Write the data
	data.copy(packet, 4);

	return packet;
}

function establishTCPConnection(host, port) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host, port }, () => {
			resolve(socket);
		});

		socket.on("error", err => {
			reject(err);
		});
	});
}
