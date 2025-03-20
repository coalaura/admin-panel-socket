import { checkAuth, parseServer, isValidLicense, authenticate } from "./auth.js";
import { abort, rejectClient } from "./functions.js";
import { pack, unpack } from "./msgpack.js";

import { Server } from "socket.io";
import { randomBytes } from "node:crypto";

const chats = {},
	leaving = {};

let started;

function clearLeaveTimeout(discord) {
	const timeout = leaving[discord];

	if (!timeout) return false;

	clearTimeout(timeout);

	return true;
}

export async function initializePanelChat(app, xp) {
	await loadChat();

	started = Date.now();

	const io = new Server(xp, {
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

	app.put("/socket/:server/chat", authenticate, async (req, res) => {
		const message = req.body.message;

		if (!message || typeof message !== "string" || message.length > 256) {
			return abort(res, "Invalid message");
		}

		addMessage(req.server, req.session, message, true);

		res.json({
			status: true,
		});
	});
}

function handleConnection(client, server, session) {
	const id = randomBytes(4).readUint32LE();

	session = {
		id: id,
		client: client,
		room: false,
		name: session.name,
		discord: session.discord,
	};

	registerClient(session, server);

	client.on("chat", compressed => {
		const text = unpack(compressed)?.trim();

		if (!text || text.length > 256) return;

		addMessage(server, session, text);
	});

	client.on("room", compressed => {
		const room = unpack(compressed)?.trim();

		if (room && (typeof room !== "string" || room.length > 32)) return;
		if (room === session.room) return;

		console.log(`Client ${session.name} set their room to "${room}".`)

		session.room = room;

		broadcast(server, "room", {
			id: session.id,
			room: session.room,
		});
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

function addMessage(server, session, text, system = false) {
	const chat = chats[server];

	if (!chat) return;

	const message = {
		id: ++chat.id,
		name: session.name,
		text: text,
		time: Math.floor(Date.now() / 1000),
	};

	if (system) {
		message.system = true;
	} else if (session.room) {
		message.room = session.room;
	}

	chat.messages.push(message);

	if (chat.messages.length > 1024) {
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

	const chat = chats[server];

	if (!doesUserExist(chat, client.discord) && !clearLeaveTimeout(client.discord)) {
		const reconnect = !started || Date.now() - started < 5000;

		addMessage(server, client, `${client.name} ${reconnect ? "reconnected" : "joined"}`, true);
	}

	chat.clients.push(client);

	broadcast(server, "users", users(chat));
}

function unregisterClient(id, server) {
	const chat = chats[server];

	if (!chat) return;

	const client = chat.clients.find(client => client.id === id);

	if (!client) return;

	chat.clients = chat.clients.filter(client => client.id !== id);

	if (!doesUserExist(chat, client.discord)) {
		clearLeaveTimeout(client.discord);

		leaving[client.discord] = setTimeout(() => {
			addMessage(server, client, `${client.name} left`, true);

			delete leaving[client.discord];
		}, 5 * 1000);
	}

	broadcast(server, "users", users(chat));
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
		discord: client.discord,
		room: client.room,
	}));
}

function doesUserExist(chat, discord) {
	return chat.clients.some(client => client.discord === discord);
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
