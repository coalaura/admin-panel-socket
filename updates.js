import config from "./config.js";
import { diff } from "./diff.js";
import { handleDataUpdate } from "./client.js";

const data = {};

export function getFullUpdateData(server) {
	return data[server] || false;
}

export function sendFullUpdate(key, value) {
	for (const cluster of config.servers) {
		sendSingleUpdate(cluster, key, value);
	}
}

export function sendSingleUpdate(server, key, value) {
	if (!data[server]) {
		data[server] = {};
	}

	const difference = diff(data[server][key], value);

	if (!Object.keys(difference).length) {
		return;
	}

	data[server][key] = value;

	handleDataUpdate("updates", server, {
		[key]: difference,
	});
}
