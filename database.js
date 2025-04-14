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

		characters: {},
		users: {},
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

	database.queryOne = (query, values = []) => database.query(query, values).then(results => (results.length > 0 ? results[0] : null));

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

export function fetchCharacter(cluster, characterId) {
	const database = cluster in databases ? databases[cluster] : false;

	if (!database || !characterId) {
		return false;
	}

	if (characterId in database.characters) {
		return database.characters[characterId];
	}

	database.characters[characterId] = false;

	database
		.queryOne("SELECT character_id as id, CONCAT(first_name, ' ', last_name) as name, backstory, date_of_birth FROM characters WHERE character_id = ?", characterId)
		.then(character => {
			if (!character) {
				return;
			}

			character.loaded = Math.floor(Date.now() / 1000);

			database.characters[characterId] = character;

			setTimeout(() => {
				delete database.characters[characterId];
			}, 20 * 60 * 1000);
		});

	return false;
}

export function fetchUser(cluster, licenseIdentifier) {
	const database = cluster in databases ? databases[cluster] : false;

	if (!database || !licenseIdentifier) {
		return false;
	}

	if (licenseIdentifier in database.users) {
		return database.users[licenseIdentifier];
	}

	database.users[licenseIdentifier] = false;

	database
		.queryOne("SELECT playtime, last_connection FROM users WHERE license_identifier = ?", licenseIdentifier)
		.then(user => {
			if (!user) {

				return;
			}

			user.loaded = Math.floor(Date.now() / 1000);

			database.users[licenseIdentifier] = user;

			setTimeout(() => {
				delete database.users[licenseIdentifier];
			}, 20 * 60 * 1000);
		});

	return false;
}
