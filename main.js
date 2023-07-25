import { init, isValidLicense, isValidType } from "./data-loop.js";
import { handleConnection, handleDataUpdate } from "./client.js";
import { initRoutes } from "./routes.js";
import { initDataRoutes } from "./data-routes.js";
import { initServers } from "./server.js";
import { cleanupHistoricData } from "./cleanup.js";
import { checkAuth } from "./auth.js";

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import chalk from "chalk";
import cors from "cors";

await initServers();

init(handleDataUpdate);

cleanupHistoricData();

const app = express(),
	server = createServer(app);

app.use(cors({
	origin: '*'
}));

app.use(express.json());

initRoutes(app);
initDataRoutes(app);

const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});

io.on("connection", async client => {
	const query = client.handshake.query;

	const session = await checkAuth(query, {}),
		server = session?.server;

	if (!server) {
		return _reject(client, "Unauthorized");
	}

	if (!query.type || !query.license || !isValidType(query.type) || !isValidLicense(query.license)) {
		return _reject(client, "Invalid request");
	}

	handleConnection(client, server.server, query.type, query.license);
});

function _reject(pClient, pMessage) {
	pClient.emit("message", pMessage);

	pClient.disconnect(true);

	console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + pClient.handshake.address)}`);
}

server.listen(9999, () => {
	console.log(chalk.blueBright("Listening for sockets..."));
});
