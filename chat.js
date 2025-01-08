import { checkAuth, parseServer, isValidLicense } from "./auth.js";
import { rejectClient } from "./functions.js";
import { pack, unpack } from "./msgpack.js";

import { Server } from "socket.io";

const chats = {};

export function initializePanelChat(app) {
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
