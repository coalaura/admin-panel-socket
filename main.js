import { init, isValidLicense, isValidToken, isValidType } from "./data-loop.js";
import { handleConnection, handleDataUpdate } from "./client.js";
import { initRoutes } from "./routes.js";
import { initServers, getServer } from "./server.js";
import { cleanupHistoricData } from "./cleanup.js";

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import chalk from "chalk";
import cors from "cors";

await initServers();

init(handleDataUpdate);

cleanupHistoricData();

setInterval(cleanupHistoricData, 2 * 60 * 60 * 1000);

const app = express(),
	server = createServer(app);

app.use(cors({
	origin: '*'
}));

app.use(express.json());

initRoutes(app);

const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});

io.on("connection", client => {
	const query = client.handshake.query;

	if (!('server' in query) || !('token' in query) || !('type' in query) || !('license' in query) || !isValidType(query.type) || !isValidLicense(query.license)) {
		client.emit("message", "Invalid request");

		client.disconnect(true);

		console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + client.handshake.address)}`);

		return;
	}

	const server = getServer(query.server);

	if (!server) {
		client.emit("message", "Invalid server");

		client.disconnect(true);

		console.log(`${chalk.redBright("Invalid server")} ${chalk.gray("from " + client.handshake.address)}`);
	}

	isValidToken(query.server, query.token).then(valid => {
		if (!valid) {
			client.emit("message", "Invalid session");

			client.disconnect(true);

			console.log(`${chalk.redBright("Invalid token")} ${chalk.gray("from " + client.handshake.address)}`);

			return;
		}

		handleConnection(client, server.server, query.type, query.license);
	});
});

server.listen(9999, () => {
	console.log(chalk.blueBright("Listening for sockets..."));
});
