import { v4 } from "uuid";
import { pack } from "msgpackr";

import { getLastServerError } from "./data-loop.js";
import { getSlaveData } from "./master.js";
import { counter, danger, muted, success, warning, info } from "./colors.js";

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

function sendFullData(client, server, type) {
	const data = getSlaveData(server, type);

	if (!data) {
		client.emit("no_data");

		return;
	}

	client.emit("reset");
	client.emit("message", Uint8Array.from(pack()).buffer);
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

	console.log(`${success("Connected")} ${muted("{" + self.id + "}")} ${info(self.server + "/" + self.type)} - ${counter(count(self.server, self.type))}`);

	self.client.on("disconnect", () => {
        decrement(self.server, self.type);
		delete connections[self.id];

		console.log(`${danger("Disconnected")} ${muted("{" + self.id + "}")} ${info(self.server + "/" + self.type)} - ${counter(count(self.server, self.type))}`);
	});

	const error = getLastServerError(self.server);

	if (error) {
		const data = pack({
			error: error
		});

		self.client.emit("message", Uint8Array.from(data).buffer);
	}

	self.client.on("pause", pPause => {
		self.paused = pPause;

		if (self.paused) {
			console.log(`${warning("Paused")} ${muted("{" + self.id + "}")} ${info(self.server + "/" + self.type)}`);
		} else {
			console.log(`${success("Resumed")} ${muted("{" + self.id + "}")} ${info(self.server + "/" + self.type)}`);

			sendFullData(self.client, self.server, self.type);
		}
	});

	sendFullData(self.client, self.server, self.type);
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

	data = pack(data);

	for (const id in connections) {
		if (!connections.hasOwnProperty(id)) continue;

		const client = connections[id];

		if (!client.paused && client.type === type && client.server === server) {
			client.client.emit("message", Uint8Array.from(data).buffer);
		}
	}
}
