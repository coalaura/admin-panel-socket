import config from "./config.js";
import { readDotEnv } from "./env.js";
import { danger, error, muted, success } from "./colors.js";

import { createPool } from "mysql2";

let databases = {};

export function getDatabase(cluster) {
    return databases[cluster];
}

export async function initDatabases() {
    let promises = [];

    for (const cluster of config.servers) {
        promises.push(initDatabase(cluster));
    }

    await Promise.all(promises);

    console.log(success(`All databases initialized successfully!`));
}

async function initDatabase(cluster) {
    const cfg = readDotEnv(cluster);

    if (!cfg) {
        return;
    }

    const database = {
        pool: createPool({
            connectionLimit: 5,

            host: cfg.DB_HOST,
            port: cfg.DB_PORT,
            user: cfg.DB_USERNAME,
            password: cfg.DB_PASSWORD,
            database: cfg.DB_DATABASE
        })
    };

    database.query = function(query, values = []) {
		return new Promise((resolve, reject) => {
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
	};

    if (!await testConnection(database)) {
        console.warn(`Failed to connect to database ${cluster}, trying again in 5 minutes...`);

        setTimeout(() => {
            initDatabase(cluster);
        }, 5 * 60 * 1000);

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
    console.log(`${danger(`${cluster} database error`)}\n - ${muted(query)}\n - ${error(err.message)}`);
}