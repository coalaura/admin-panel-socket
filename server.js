import config from "./_config.json" assert {type: "json"};

import { join } from "path";
import * as dotenv from "dotenv";
import { createPool } from "mysql";
import chalk from "chalk";

let servers = {};

export async function initServers() {
	for (let x = 0; x < config.servers.length; x++) {
		const server = config.servers[x];

		process.stdout.write(chalk.blueBright(`Database for ${server.padEnd(3, ".")}...`));

		const envPath = join(config.panel, "envs", server, ".env"),
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
			const serverName = server + (i > 0 ? 's' + (i + 1) : '');

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
					})
				};

				await testConnection(srv);

				servers[serverName] = srv;

				console.log(chalk.greenBright(`works!`));
			} catch (e) {
				console.log(chalk.redBright(`failed :(`));

				console.log(chalk.redBright(`Failed establish database connection with ${serverName}!`));
				console.log(chalk.red(e.message));
			}
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
						const data = JSON.parse(result.data);

						if (data && data.user) {
							resolve(true);

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
