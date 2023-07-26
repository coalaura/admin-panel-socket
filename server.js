import config from "./_config.json" assert {type: "json"};

import { join } from "path";
import * as dotenv from "dotenv";
import { createPool } from "mysql";
import chalk from "chalk";

let servers = {};

export async function initServers() {
	for (let x = 0; x < config.servers.length; x++) {
		const server = config.servers[x];

		await initServer(server);
	}
}

export function getServerHealths() {
	const healthData = {};

	for (const serverName in servers) {
		const server = servers[serverName];

		const data = {
			database: server.database ? "up" : "down",
			server: server.down ? "down" : "up",

			failed: server.down || !server.database || server.failed
		};

		healthData[serverName] = data;
	}

	return healthData;
}

async function healthCheck(pServerName) {
	const server = servers[pServerName];

	if (!server) {
		return;
	}

	try {
		await testConnection(server);

		if (!server.database) {
			console.log(chalk.greenBright(`Database for ${pServerName} works again!`));
		}

		server.database = true;
	} catch(e) {
		server.database = false;

		console.log(chalk.redBright(`Failed database health-check for ${pServerName}!`));
	}

	setTimeout(healthCheck, 10000, pServerName);
}

async function initServer(pServer) {
	process.stdout.write(chalk.blueBright(`Database for ${pServer.padEnd(3, ".")}...`));

	const envPath = join(config.panel, "envs", pServer, ".env"),
		env = dotenv.config({
			path: envPath,
			override: true
		});

	if (env.error) {
		throw env.error;
	}

	const cfg = env.parsed;

	const ips = cfg.OP_FW_SERVERS.split(",");

	for (let i = 0; i < ips.length; i++) {
		const serverName = pServer + (i > 0 ? 's' + (i + 1) : '');

		try {
			const srv = {
				server: serverName,
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
				failed: false,
				down: false,

				version: "",
				players: []
			};

			servers[serverName] = srv;

			await healthCheck(serverName);

			console.log(chalk.greenBright(`works!`));
		} catch (e) {
			console.log(chalk.redBright(`failed :(`));

			console.log(chalk.redBright(`Failed establish database connection with ${serverName}!`));
			console.log(chalk.red(e.message));

			servers[serverName] = {
				failed: true
			};

			setTimeout(initServer, 15000, pServer);
		}
	}
}

export function getServers() {
	return servers;
}

export function validateSession(pServer, pToken) {
	return new Promise((resolve, reject) => {
		const server = getServer(pServer);

		if (!server) {
			resolve(false);

			return;
		}

		server.pool.getConnection((pError, pConnection) => {
			if (pError) {
				reject(pError);

				return;
			}

			pConnection.query("SELECT `data` FROM webpanel_sessions WHERE `key` = ?", [pToken], (pError, pResults) => {
				pConnection.release();

				if (pError) {
					reject(pError);

					return;
				}

				if (pResults.length > 0) {
					const result = pResults[0];

					try {
						const data = JSON.parse(result.data),
							name = data?.user?.player?.player_name;

						if (name) {
							resolve(name);

							return;
						}
					} catch (e) { }
				}

				resolve(false);
			});
		});
	});
}

export function getServer(pServer) {
	if (typeof pServer !== "string") {
		return null;
	}

	pServer = pServer.toLowerCase().trim();

	if (pServer === "localhost:30120") {
		pServer = "c1s1";
	}

	if (!pServer.match(/^c\d+s\d+$/)) {
		return null;
	}

	if (pServer.endsWith("s1")) {
		pServer = pServer.replace("s1", "");
	}

	return servers[pServer];
}

function testConnection(pServer) {
	return new Promise((resolve, reject) => {
		pServer.pool.getConnection((pError, pConnection) => {
			if (pError) {
				reject(pError);

				return;
			}

			pConnection.query("SELECT 1", (pError, pResults) => {
				pConnection.release();

				if (pError) {
					reject(pError);

					return;
				}

				resolve(true);
			});
		});
	});
}

function getServerUrl(pServer) {
	if (pServer.match(/^[0-9.]+(:[0-9]+)?$/gm) || pServer.startsWith("localhost")) {
		return "http://" + pServer;
	}

	return "https://" + pServer;
}
