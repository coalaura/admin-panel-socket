import { v4 } from "uuid";
import chalk from "chalk";
import { pack } from "msgpackr";

import { getLastServerError } from "./data-loop.js";
import { getSlaveData } from "./master.js";

let connections = {},
	total = {};

function increment(server, type) {
	if (!(server in total)) {
		total[server] = {};
	}

	if (!(type in total[server])) {
		total[server][type] = 0;
	}

	total[server][type]++;
}

function decrement(server, type) {
	if (server in total && type in total[server]) {
		total[server][type]--;
	}

	if (total[server][type] <= 0) {
		delete total[server][type];
	}

	if (Object.keys(total[server]).length === 0) {
		delete total[server];
	}
}

function count(server, type) {
	if (server in total && type in total[server]) {
		return total[server][type];
	}

	return 0;
}

export function handleConnection(client, server, type, license) {
	const self = {
		id: v4(),
		client: client,
		server: server,
		type: type,
		license: license,

		paused: false
	};

	increment(self.server, self.type);
	connections[self.id] = self;

	console.log(
		`${chalk.greenBright("Connected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(
			self.server + "/" + self.type
		)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`
	);

	self.client.on("disconnect", () => {
        decrement(self.server, self.type);
		delete connections[self.id];

		console.log(
			`${chalk.redBright("Disconnected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(
				self.server + "/" + self.type
			)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`
		);
	});

	const error = getLastServerError(server);

	if (error) {
		const data = pack({
			error: error
		});

		self.client.emit("message", Uint8Array.from(data).buffer);
	}

	self.client.on("pause", pPause => {
		self.paused = pPause;

		if (self.paused) {
			console.log(
				`${chalk.yellowBright("Paused")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(
					self.server + "/" + self.type
				)}`
			);
		} else {
			console.log(
				`${chalk.greenBright("Resumed")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(
					self.server + "/" + self.type
				)}`
			);
		}
	});

	self.client.emit("welcome", "connected");
	self.client.emit("message", Uint8Array.from(pack(getSlaveData(server, type))).buffer);
}

export function getActiveViewers(server, type) {
	let viewers = [];

	for (const id in connections) {
		if (!connections.hasOwnProperty(id)) continue;

		const client = connections[id],
			license = client.license;

		if (client.type === type && client.server === server && !viewers.includes(license)) {
			viewers.push(license);
		}
	}

	return viewers;
}

export function handleDataUpdate(type, server, data) {
	if (count(server, type) === 0 || Object.keys(data).length === 0) {
		return;
	}

    console.log(data);

	data = pack(data);

	console.log("size", type, data.length);

	for (const id in connections) {
		if (!connections.hasOwnProperty(id)) continue;

		const client = connections[id];

		if (!client.paused && client.type === type && client.server === server) {
			client.client.emit("message", Uint8Array.from(data).buffer);
		}
	}
}

function countConnections(server, type) {
	let total = 0;

	for (const id in connections) {
		if (!connections.hasOwnProperty(id)) continue;

		const client = connections[id];

		if (client.type === type && client.server === server) {
			total++;
		}
	}

	return total;
}
