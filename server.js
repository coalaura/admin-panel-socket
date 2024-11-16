import { readDotEnv } from "./env.js";
import { danger, error, success, warning } from "./colors.js";

let servers = {};

export function getServerByName(name) {
	return servers[name];
}

export function getServers() {
	return servers;
}

export function initServer(cluster, tries = 0) {
	const cfg = readDotEnv(cluster);

	if (!cfg || cfg.INACTIVE) {
		console.log(`${danger(`Cluster ${cluster} has no config or is inactive.`)}`);

		return;
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
			console.log(danger(`Failed establish database connection with ${serverName}!`));
			console.log(error(e.message));

			servers[serverName] = {
				failed: true
			};

			if (tries < 3) {
				console.log(warning(`Retrying in 10 seconds...`));

				setTimeout(initServer, 10000, cluster, tries + 1);
			} else {
				console.log(danger(`Failed to reconnect 3 times! Waiting for restart...`));

				process.exit(1);
			}
		}
	}
}

function getServerUrl(ip) {
	if (ip.match(/^[0-9.]+(:[0-9]+)?$/gm) || ip.startsWith("localhost")) {
		return "http://" + ip;
	}

	return "https://" + ip;
}
