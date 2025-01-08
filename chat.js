import { checkAuth, parseServer, isValidLicense } from "./auth.js";
import { rejectClient } from "./functions.js";
import { pack, unpack } from "./msgpack.js";

import { Server } from "socket.io";

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
    registerClient(client, server);

    client.on("chat", compressed => {
        const text = unpack(compressed)?.trim();

        if (!text || text.length > 256) return;

        addMessage(server, session, text);
    });

    client.on("disconnect", () => {
        unregisterClient(client, server);
    });

    const current = chats[server].messages;

    if (current.length) {
        client.emit("history", pack(current));
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
    }

    chat.messages.push(message);

    if (chat.messages.length > 100) {
        chat.messages.shift();
    }

    const packed = pack(message);

    for (const client of chat.clients) {
        client.emit("chat", packed);
    }

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
}

function unregisterClient(client, server) {
    if (!chats[server]) return;

    const index = chats[server].clients.indexOf(client);

    if (index > -1) {
        chats[server].clients.splice(index, 1);
    }
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

    if (!await file.exists()) {
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
