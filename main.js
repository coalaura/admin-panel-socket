import { initDataLoop, isValidType } from "./data-loop.js";
import { isValidLicense } from "./auth.js";
import { handleConnection, handleDataUpdate } from "./client.js";
import { initSlaveRoutes } from "./slave-routes.js";
import { initSlaves, initMasterRoutes, getSlave } from "./master.js";
import { startTwitchUpdateLoop } from "./twitch.js";
import { cleanupHistoricData } from "./cleanup.js";
import { checkAuth, parseServer } from "./auth.js";
import { getSlaveData } from "./slave.js";
import { initServer } from "./server.js";
import { rejectClient } from "./functions.js";
import { registerConsole } from "./logging.js";

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import chalk from "chalk";
import cors from "cors";
import cluster from "cluster";

// Master handles all connections
if (cluster.isPrimary) {
	// This is only needed once so its on the master too
	startTwitchUpdateLoop();
	cleanupHistoricData();

	// Initialize express server
	const app = express(),
		xp = createServer(app);

	app.use(cors({
		origin: '*'
	}));

	app.use(express.json());

	// Wake up the slaves
	initSlaves();

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

		const session = await checkAuth(server.cluster, token);

		if (!session) {
			return rejectClient(client, "Unauthorized");
		}

		if (!isValidType(type) || !isValidLicense(license)) {
			return rejectClient(client, "Invalid request");
		}

		handleConnection(client, server.server, type, license);
	});

	// Listen for data from the slaves
	cluster.on("message", (worker, message) => {
		const { server, type, data } = message;

		if (type === "slave") {
			const slave = getSlave(server);

			if (!slave) {
				console.log(`Slave ${server} sent message but was not found.`);

				return;
			}

			slave.isUp();

			return
		}

		handleDataUpdate(type, server, data);
	});

	// Start the server
	xp.listen(9999, () => {
		console.log(chalk.blueBright("Listening on port 9999."));
	});
} else {
	// Get slave data first
	const slave = getSlaveData();

	registerConsole(slave.server);

	// Initialize the server (async deferred, no await)
	initServer(slave.server);

	// Initialize express server
	const app = express();

	app.use(express.json());

	// Initialize routes
	initSlaveRoutes(slave.server, app);

	// Initialize data-loop
	initDataLoop();

	// Start the server
	app.listen(slave.port, () => {
		process.send({
			server: slave.server,
			type: "slave"
		});
	});
}
