import { randomBytes } from "node:crypto";

import { authenticate } from "./auth.js";
import { danger, info, muted, success } from "./colors.js";
import { abort } from "./functions.js";
import { Client } from "./io.js";

const chats = {},
	leaving = {};

let started;

function clearLeaveTimeout(discord) {
	const timeout = leaving[discord];

	if (!timeout) {
		return false;
	}

	clearTimeout(timeout);

	return true;
}

export async function initializePanelChat(app) {
	await loadChat();

	started = Date.now();

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

export function handleChatConnection(ws, server, session, group) {
	const id = randomBytes(4).readUint32LE(),
		name = group ? `${server}_${group}` : server;

	session = {
		id: id,
		client: new Client(ws),
		name: session.name,
		discord: session.discord,

		room: false,
		active: false,
	};

	console.log(`${success("Connected")} ${muted(`{${session.discord}}`)} ${info(`chat/${group || "-"}`)}`);

	function set(key, value) {
		value = value || false;

		if (session[key] === value) {
			return;
		}

		console.debug(`Client ${id} ("${session.name}") changed ${key} to "${value}".`);

		session[key] = value;

		broadcast(name, "user", {
			id: session.id,
			key: key,
			value: value,
		});
	}

	registerClient(session, name);

	session.client.on("chat", text => {
		if (!text || text.length > 256) {
			return;
		}

		addMessage(name, session, text);
	});

	session.client.on("room", room => {
		if (typeof room !== "string" || room.length > 32) {
			return;
		}

		set("room", room);
	});

	session.client.on("active", active => {
		if (typeof active !== "boolean") {
			return;
		}

		set("active", active);
	});

	session.client.on("disconnect", () => {
		console.log(`${danger("Disconnected")} ${muted(`{${session.discord}}`)} ${info(`chat/${session.group}`)}`);

		unregisterClient(id, name);
	});

	const chat = chats[name],
		messages = chats[name].messages;

	if (chat.clients.length) {
		session.client.emit("users", users(chat));
	}

	if (messages.length) {
		session.client.emit("history", messages);
	}
}

function addMessage(name, session, text, system = false) {
	const chat = chats[name];

	if (!chat) {
		return;
	}

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

	broadcast(name, "chat", message);

	persistChat();
}

function registerClient(client, name) {
	if (!chats[name]) {
		chats[name] = {
			id: 0,
			clients: [],
			messages: [],
		};
	}

	const chat = chats[name];

	if (!doesUserExist(chat, client.discord) && !clearLeaveTimeout(client.discord)) {
		const reconnect = !started || Date.now() - started < 5000;

		addMessage(name, client, `${client.name} ${reconnect ? "reconnected" : "joined"}`, true);
	}

	chat.clients.push(client);

	broadcast(name, "users", users(chat));
}

function unregisterClient(id, name) {
	const chat = chats[name];

	if (!chat) {
		return;
	}

	const client = chat.clients.find(client => client.id === id);

	if (!client) {
		return;
	}

	chat.clients = chat.clients.filter(client => client.id !== id);

	if (!doesUserExist(chat, client.discord)) {
		clearLeaveTimeout(client.discord);

		leaving[client.discord] = setTimeout(() => {
			addMessage(name, client, `${client.name} left`, true);

			delete leaving[client.discord];
		}, 5 * 1000);
	}

	broadcast(name, "users", users(chat));
}

function broadcast(name, channel, data) {
	const chat = chats[name];

	if (!chat) {
		return;
	}

	for (const client of chat.clients) {
		client.client.emit(channel, data);
	}
}

function users(chat) {
	return chat.clients.map(client => ({
		id: client.id,
		name: client.name,
		discord: client.discord,

		room: client.room,
		active: client.active,
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
