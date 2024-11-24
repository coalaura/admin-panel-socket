import { initDataLoop, isValidType } from "./data-loop.js";
import { handleConnection } from "./client.js";
import { initSlaves, initMasterRoutes } from "./master.js";
import { startTwitchUpdateLoop } from "./twitch.js";
import { checkAuth, parseServer, isValidLicense } from "./auth.js";
import { getSlaveData } from "./slave.js";
import { initServer } from "./server.js";
import { rejectClient } from "./functions.js";
import { registerConsole } from "./logging.js";
import { initDatabases } from "./database.js";
import { SlaveHandler } from "./slave-handler.js";
import { success, warning } from "./colors.js";
import { parseArguments } from "./arguments.js";
import { cleanHistoricBins, closeHistoryBin } from "./history-bin.js";

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cluster from "cluster";
import { semver } from "bun";

if (!semver.satisfies(Bun.version, "^1.1.34")) {
	console.error("Please use bun v1.1.34 or higher.");

	process.exit(1);
}

// Master handles all connections
if (cluster.isPrimary) {
	const { only } = parseArguments();

	if (only) {
		console.log(warning(`Only initializing cluster ${only}!`));
	}

	// This is only needed once so its on the master too
	startTwitchUpdateLoop();

	// Initialize express server
	const app = express(),
		xp = createServer(app);

	app.use(cors({
		origin: '*'
	}));

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
			methods: ["GET", "POST"]
		}
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

		if (!await checkAuth(server.cluster, token, client.handshake.address)) {
			return rejectClient(client, "Unauthorized");
		}

		if (!isValidType(type) || !isValidLicense(license)) {
			return rejectClient(client, "Invalid request");
		}

		handleConnection(client, server.server, type, license);
	});

	// Start the server
	xp.listen(9999, () => {
		console.log(success("Listening on port 9999."));
	});
} else {
	// Get slave data first
	const slave = getSlaveData();

	// Register console logging
	registerConsole(slave.server);

	// Listen for termination
	process.on("message", message => {
		if (message !== "terminate") return;

		closeHistoryBin();

		process.exit(0);
	});

	// Initialize the server (async deferred, no await)
	console.log("Initializing server...");
	initServer(slave.server);

	// Initialize handler
	console.log("Initializing handler...");
	new SlaveHandler();

	// Initialize data-loop
	console.log("Initializing data-loop...");
	initDataLoop();

	// Start cleanup loop
	console.log("Starting cleanup loop...");
	cleanHistoricBins(slave.cluster);

	// Start the server
	process.send({
		type: "hello"
	});

	console.log("Startup complete");
}
