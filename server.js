import { readDotEnv } from "./env.js";
import { danger, error, success } from "./colors.js";

const servers = {};

export function getServerByName(name) {
	return servers[name];
}

export function getServers() {
	return servers;
}

export function initServer(cluster) {
	const cfg = readDotEnv(cluster);

	if (!cfg) {
		return {};
	}

	const ips = cfg.OP_FW_SERVERS.split(";");

	for (let i = 0; i < ips.length; i++) {
		const ip = ips[i];

		let fullName, serverUrl;

		if (ip.includes(",")) {
			const parts = ip.split(",");

			fullName = parts[0];
			serverUrl = getServerUrl(parts[1]);
		} else {
			fullName = `${cluster}s${i + 1}`;
			serverUrl = getServerUrl(ip);
		}

		const serverName = i === 0 ? cluster : fullName;

		try {
			const srv = {
				server: serverName,
				cluster: cluster,
				fullName: fullName,
				url: serverUrl,
				token: cfg.OP_FW_TOKEN,

				down: false,
				downError: null,

				failed: false,

				// Data cache
				info: false,
				players: [],
				world: {},
				models: {}
			};

			servers[serverName] = srv;

			console.log(success(`Successfully initialized server ${serverName}...`));
		} catch (e) {
			console.error(danger(`Failed establish database connection with ${serverName}!`));
			console.error(error(e.message));

			servers[serverName] = {
				failed: true
			};

			console.warn(danger(`Failed to initialize server ${serverName}!`));

			process.exit(1);
		}
	}

	return cfg;
}

function getServerUrl(ip) {
	if (ip.match(/^[0-9.]+(:[0-9]+)?$/gm) || ip.startsWith("localhost") || ip.startsWith("host.docker.internal")) {
		return `http://${ip}`;
	}

	return `https://${ip}`;
}
