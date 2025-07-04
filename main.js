import { initDataLoop, isValidType } from "./data-loop.js";
import { handleConnection } from "./client.js";
import { initSlaves, initMasterRoutes } from "./master.js";
import { startTwitchUpdateLoop } from "./twitch.js";
import { checkAuth, parseServer } from "./auth.js";
import { getSlaveData } from "./slave.js";
import { initServer } from "./server.js";
import { registerErrorHandlers, registerConsole } from "./console.js";
import { initDatabases } from "./database.js";
import { SlaveHandler } from "./slave-handler.js";
import { success, warning, muted } from "./colors.js";
import { parseArguments } from "./arguments.js";
import { handleChatConnection, initializePanelChat } from "./chat.js";
import { startSpectatorLoop } from "./spectators.js";

import { createServer } from "node:http";
import cluster from "node:cluster";
import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { semver } from "bun";
import { rejectClient } from "./functions.js";

if (!semver.satisfies(Bun.version, "^1.1.34")) {
	console.error("Please use bun v1.1.34 or higher.");

	process.exit(1);
}

registerErrorHandlers();

// Master handles all connections
if (cluster.isPrimary) {
	registerConsole(false);

	const { only } = parseArguments();

	if (only) {
		console.warn(warning(`Only initializing cluster ${only}!`));
	}

	// This is only needed once so its on the master too
	startTwitchUpdateLoop();

	// Initialize express server
	const app = express(),
		xp = createServer(app);

	app.use(
		cors({
			origin: "*",
		})
	);

	app.use(express.json());

	// Connect to databases
	await initDatabases(only);

	// Wake up the slaves
	initSlaves(only);

	// Initialize routes
	initMasterRoutes(app);

	// Initialize socket.io server
	const wss = new WebSocketServer({
		noServer: true,
	});

	xp.on("upgrade", async (request, socket, head) => {
		const url = new URL(request.url, `http://${request.headers.host}`),
			query = Object.fromEntries(url.searchParams.entries());

		const server = parseServer(query.server),
			token = query.token,
			type = query.type;

		if (!token || !server) {
			rejectClient(socket, 401, "unauthorized");

			return;
		}

		let handler;

		switch (url.pathname) {
			case "/io":
				if (!isValidType(type)) {
					rejectClient(socket, 400, "invalid request");
				}

				handler = handleConnection;

				break;
			case "/panel_chat":
				handler = handleChatConnection;

				break;
			default:
				rejectClient(socket, 404, "unknown path");

				return;
		}

		const session = await checkAuth(server.cluster, token, socket.remoteAddress);

		if (!session) {
			rejectClient(socket, 401, "unauthorized");

			return;
		}

		wss.handleUpgrade(request, socket, head, ws => {
			handler(ws, server.server, session, type);
		});
	});

	// Initialize panel chat
	initializePanelChat(app);

	// Start the server
	xp.listen(9999, () => {
		console.info(success("Listening on port 9999."));
	});
} else {
	// Get slave data first
	const slave = getSlaveData();

	// Register console overrides
	registerConsole(slave.server);

	// Initialize the server (async deferred, no await)
	console.info("Initializing server...");
	const env = initServer(slave.server);

	// Initialize handler
	console.info("Initializing handler...");
	new SlaveHandler();

	// Initialize data-loop
	console.info("Initializing data-loop...");
	initDataLoop();

	// Initialize spectator-loop (if enabled)
	startSpectatorLoop(env);

	// Start the server
	process.send({
		type: "hello",
	});

	console.info("Startup complete");
}
