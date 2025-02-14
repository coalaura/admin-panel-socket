import { initDataLoop, isValidType } from "./data-loop.js";
import { handleConnection } from "./client.js";
import { initSlaves, initMasterRoutes } from "./master.js";
import { startTwitchUpdateLoop } from "./twitch.js";
import { checkAuth, parseServer, isValidLicense } from "./auth.js";
import { getSlaveData } from "./slave.js";
import { initServer } from "./server.js";
import { rejectClient } from "./functions.js";
import { registerErrorHandlers, registerConsole } from "./console.js";
import { initDatabases } from "./database.js";
import { SlaveHandler } from "./slave-handler.js";
import { success, warning } from "./colors.js";
import { parseArguments } from "./arguments.js";
import { initializePanelChat } from "./chat.js";
import { startSpectatorLoop } from "./spectators.js";

import { createServer } from "node:http";
import cluster from "node:cluster";
import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import { semver } from "bun";

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
	const io = new Server(xp, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
		path: "/io",
	});

	io.on("connection", async client => {
		const query = client.handshake.query,
			server = parseServer(query.server),
			token = query.token,
			type = query.type,
			license = query.license;

		if (!isValidType(type) || !isValidLicense(license) || !token || !server) {
			return rejectClient(client, "Invalid request");
		}

		if (!(await checkAuth(server.cluster, token, client.handshake.address))) {
			return rejectClient(client, "Unauthorized");
		}

		handleConnection(client, server.server, type, license);
	});

	// Initialize panel chat
	initializePanelChat(xp);

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
