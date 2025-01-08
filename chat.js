import { checkAuth, parseServer, isValidLicense } from "./auth.js";
import { rejectClient } from "./functions.js";
import { pack, unpack } from "./msgpack.js";

import { Server } from "socket.io";
import { randomBytes } from "node:crypto";

const chats = {};

export async function initializePanelChat(app) {
	await loadChat();

	const io = new Server(app, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
		path: "/panel_chat",
	});

	io.on("connection", async client => {
		const query = client.handshake.query,
			server = parseServer(query.server),
			token = query.token,
			license = query.license;

		if (!isValidLicense(license) || !token || !server) {
			return rejectClient(client, "Invalid request");
		}

		const session = await checkAuth(server.cluster, token, client.handshake.address);

		if (!session) {
			return rejectClient(client, "Unauthorized");
		}

		handleConnection(client, server.server, session);
	});
}

function handleConnection(client, server, session) {
	const id = randomBytes(4).readUint32LE();

	registerClient(
		{
			id: id,
			client: client,
			name: session.name,
		},
		server
	);

	client.on("chat", compressed => {
		const text = unpack(compressed)?.trim();

		if (!text || text.length > 256) return;

		addMessage(server, session, text);
	});

	client.on("disconnect", () => {
		unregisterClient(id, server);
	});

	const chat = chats[server],
	    messages = chats[server].messages;

    if (chat.clients.length) {
        client.emit("users", pack(users(chat)));
    }

	if (messages.length) {
		client.emit("history", pack(messages));
	}
}

function addMessage(server, session, text) {
	const chat = chats[server];

	if (!chat) return;

	const message = {
		id: ++chat.id,
		name: session.name,
		text: text,
		time: Math.floor(Date.now() / 1000),
	};

	chat.messages.push(message);

	if (chat.messages.length > 100) {
		chat.messages.shift();
	}

	broadcast(server, "chat", message);

	persistChat();
}

function registerClient(client, server) {
	if (!chats[server]) {
		chats[server] = {
			id: 0,
			clients: [],
			messages: [],
		};
	}

	chats[server].clients.push(client);

	broadcast(server, "joined", {
		id: client.id,
		name: client.name,
	});
}

function unregisterClient(id, server) {
	const chat = chats[server];

	if (!chat) return;

	chat.clients = chat.clients.filter(client => client.id !== id);

	broadcast(server, "left", id);
}

function broadcast(server, channel, data) {
	const chat = chats[server];

	if (!chat) return;

	const packed = pack(data);

	for (const client of chat.clients) {
		client.client.emit(channel, packed);
	}
}

function users(chat) {
	return chat.clients.map(client => ({
		id: client.id,
		name: client.name,
	}));
}

let timeout;

function persistChat() {
	clearTimeout(timeout);

	timeout = setTimeout(() => {
		const save = {};

		for (const server in chats) {
			const chat = chats[server];

			save[server] = {
				id: chat.id,
				messages: chat.messages,
			};
		}

		Bun.write("_chat.json", JSON.stringify(save));
	}, 2000);
}

async function loadChat() {
	const file = Bun.file("_chat.json");

	if (!(await file.exists())) {
		return;
	}

	const data = await file.json();

	if (!data || typeof data !== "object") {
		return;
	}

	for (const server in data) {
		const chat = data[server];

		chats[server] = {
			id: chat.id || 0,
			messages: chat.messages || [],
			clients: [],
		};
	}
}
