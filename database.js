import config from "./config.js";
import { readDotEnv } from "./env.js";
import { danger, error, muted, success } from "./colors.js";

import { createPool } from "mysql2";

const databases = {};

export function getDatabase(cluster) {
	return databases[cluster];
}

export async function initDatabases(only = null) {
	const promises = [];

	for (const cluster of config.servers) {
		if (only && cluster !== only) continue;

		promises.push(initDatabase(cluster));
	}

	await Promise.all(promises);

	console.info(success("All databases initialized successfully!"));
}

export async function initDatabase(cluster) {
	if (cluster in databases) {
		return;
	}

	const cfg = readDotEnv(cluster);

	if (!cfg) {
		return;
	}

	databases[cluster] = false;

	const database = {
		pool: createPool({
			connectionLimit: 5,

			host: cfg.DB_HOST,
			port: cfg.DB_PORT,
			user: cfg.DB_USERNAME,
			password: cfg.DB_PASSWORD,
			database: cfg.DB_DATABASE,
		}),
	};

	database.query = (query, values = []) =>
		new Promise((resolve, reject) => {
			database.pool.getConnection((err, conn) => {
				if (err) {
					reject(err);

					logDatabaseError(cluster, err, query);

					return;
				}

				conn.query(query, values, (err, rows) => {
					conn.release();

					if (err) {
						reject(err);

						logDatabaseError(cluster, err, query);

						return;
					}

					resolve(rows);
				});
			});
		});

	if (!(await testConnection(database))) {
		console.warn(`Failed to connect to database ${cluster}, trying again in 5 minutes...`);

		setTimeout(
			() => {
				initDatabase(cluster);
			},
			5 * 60 * 1000
		);

		return;
	}

	databases[cluster] = database;

	console.log(success(`Successfully connected to database for ${cluster}...`));
}

async function testConnection(database) {
	try {
		await database.query("SELECT 1");

		return true;
	} catch {
		// Don't care
	}

	return false;
}

function logDatabaseError(cluster, err, query) {
	console.error(`${danger(`${cluster} database error`)}\n - ${muted(query)}\n - ${error(err.message)}`);
}
