import config from "./config.js";

import { join } from "path";
import * as dotenv from "dotenv";
import { createPool } from "mysql2";
import chalk from "chalk";
import { parseServer } from "./auth.js";

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

export async function initServer(server, tries = 0) {
	const envPath = join(config.panel, "envs", server, ".env"),
		env = dotenv.config({
			path: envPath,
			override: true
		});

	if (env.error) {
		throw env.error;
	}

	const cfg = env.parsed;

	if (cfg.NO_SOCKET) {
		return;
	}

	const ips = cfg.OP_FW_SERVERS.split(",");

	for (let i = 0; i < ips.length; i++) {
		const fullName = server + 's' + (i + 1),
			serverName = i === 0 ? server : fullName;

		try {
			const srv = {
				server: serverName,
				fullName: fullName,
				url: getServerUrl(ips[i]),
				token: cfg.OP_FW_TOKEN,

				pool: createPool({
					connectionLimit: 5,

					host: cfg.DB_HOST,
					port: cfg.DB_PORT,
					user: cfg.DB_USERNAME,
					password: cfg.DB_PASSWORD,
					database: cfg.DB_DATABASE
				}),

				database: true,
				databaseError: null,

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

			// This throws an error if it fails
			await testConnection(srv);

			// This just starts the health-check loop
			await healthCheck(srv);

			if (tries > 0) {
				console.log(chalk.greenBright(`Database reconnected after ${tries} tries...`));
			} else {
				console.log(chalk.greenBright(`Successfully connected to database for ${serverName}...`));
			}
		} catch (e) {
			console.log(chalk.redBright(`Failed establish database connection with ${serverName}!`));
			console.log(chalk.red(e.message));

			servers[serverName] = {
				failed: true
			};

			if (tries < 3) {
				console.log(chalk.redBright(`Retrying in 10 seconds...`));

				setTimeout(initServer, 10000, server, tries + 1);
			} else {
				console.log(chalk.redBright(`Failed to reconnect 3 times! Waiting for restart...`));

				process.exit(1);
			}
		}
	}
}

async function healthCheck(server) {
	try {
		await testConnection(server);

		if (!server.database) {
			console.log(chalk.greenBright(`Database for ${server.server} works again!`));
		}

		server.database = true;
		server.databaseError = null;
	} catch (e) {
		server.database = false;
		server.databaseError = e.message;

		console.log(chalk.redBright(`Failed database health-check for ${server.server}!`));
		console.log(chalk.red(e.message));

		if (e.fatal) {
			console.log(chalk.redBright(`Database error is fatal! Waiting for restart...`));

			process.exit(1);
		}
	}

	setTimeout(healthCheck, 15000, server);
}

function testConnection(server) {
	return new Promise((resolve, reject) => {
		server.pool.getConnection((err, conn) => {
			if (err) {
				reject(err);

				return;
			}

			conn.query("SELECT 1", err => {
				conn.release();

				if (err) {
					reject(err);

					return;
				}

				resolve(true);
			});
		});
	});
}

function getServerUrl(ip) {
	if (ip.match(/^[0-9.]+(:[0-9]+)?$/gm) || ip.startsWith("localhost")) {
		return "http://" + ip;
	}

	return "https://" + ip;
}
