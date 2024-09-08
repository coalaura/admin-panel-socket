import chalk from "chalk";
import { parseServer } from "./auth.js";
import { readDotEnv } from "./env.js";

let servers = {};

export function getServer(server, req) {
	const data = req && req.cluster ? req : parseServer(server);

	if (!data) {
		return false;
	}

	if (data.server && data.server in servers) {
		return servers[data.server];
	}

	return servers[data.cluster];
}

export function getServerByName(name) {
	return servers[name];
}

export function getServers() {
	return servers;
}

export async function initServer(cluster, tries = 0) {
	const cfg = readDotEnv(cluster);

	if (!cfg) {
		return;
	}

	const ips = cfg.OP_FW_SERVERS.split(",");

	for (let i = 0; i < ips.length; i++) {
		const fullName = cluster + 's' + (i + 1),
			serverName = i === 0 ? cluster : fullName;

		try {
			const srv = {
				server: serverName,
				cluster: cluster,
				fullName: fullName,
				url: getServerUrl(ips[i]),
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

			console.log(chalk.greenBright(`Successfully initialized server ${serverName}...`));
		} catch (e) {
			console.log(chalk.redBright(`Failed establish database connection with ${serverName}!`));
			console.log(chalk.red(e.message));

			servers[serverName] = {
				failed: true
			};

			if (tries < 3) {
				console.log(chalk.redBright(`Retrying in 10 seconds...`));

				setTimeout(initServer, 10000, cluster, tries + 1);
			} else {
				console.log(chalk.redBright(`Failed to reconnect 3 times! Waiting for restart...`));

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
