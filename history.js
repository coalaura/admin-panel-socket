import config from "./config.js";
import { formatBytes, formatInteger } from "./functions.js";
import { info, muted, warning } from "./colors.js";

import { Database } from "bun:sqlite";
import { statSync } from "fs";

let db,
	tables = {};

const stored = {
	failed: 0,
	success: 0
};

function close() {
	if (!db) return;

	console.log(info("Closing database..."));

	db.close();

	db = null;
}

function vacuum() {
	console.log(info("Starting incremental vacuuming..."));

	while (true) {
		const freelist = db.query("PRAGMA freelist_count").get(),
			pages = freelist?.freelist_count || 0;

		if (pages === 0) {
			console.log(info("Finished incremental vacuuming."));

			break;
		}

		const reclaim = Math.min(pages, 10000);

		db.run(`PRAGMA incremental_vacuum(${reclaim})`);

		console.log(muted(`Reclaimed ${reclaim} pages, ${pages - reclaim} pages remaining.`));
	}
}

function ensureIndex(indexName, table, column) {
	const exists = db
		.query("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'index' AND name = ?")
		.get(indexName);

	if (!exists || exists.count === 0) {
		db.run(`CREATE INDEX ${indexName} ON ${table} (${column})`);

		console.log(`${info("New sqlite index created:")} ${muted(indexName)}`);
	}
}

function initHistoryDatabase(server = null) {
	if (!db) {
		db = new Database("history.db", { create: true });

		db.run("PRAGMA journal_mode=DELETE;");
		db.run("PRAGMA synchronous=NORMAL");
		db.run("PRAGMA auto_vacuum=INCREMENTAL");
		db.run("PRAGMA busy_timeout=2000");
	}

	if (server && !tables[server]) {
		tables[server] = true;

		db.run(`
			CREATE TABLE IF NOT EXISTS ${server} (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				timestamp INTEGER NOT NULL,
				license TEXT NOT NULL,
				characterId INTEGER NOT NULL,
				x REAL NOT NULL,
				y REAL NOT NULL,
				z REAL NOT NULL,
				heading REAL NOT NULL,
				speed REAL NOT NULL,
				characterFlags INTEGER NOT NULL,
				userFlags INTEGER NOT NULL
			)
        `);

		ensureIndex(`${server}_timestamp`, server, "timestamp");
		ensureIndex(`${server}_license`, server, "license");
	}
}

export function historySize() {
    try {
        const stats = statSync("history.db"),
			bytes = stats.size;

        return formatBytes(bytes);
    } catch (err) {
		console.log(warning("Failed to get history size: "), muted(err));

        return null;
    }
}

export function historyStoreStats() {
	return `${formatInteger(stored.success)} stored, ${formatInteger(stored.failed)} failed.`;
}

export function store(server, players) {
	initHistoryDatabase(server);

	const timestamp = Math.floor(Date.now() / 1000);

	try {
		const statement = db.prepare(`
			INSERT INTO ${server}
			(timestamp, license, characterId, x, y, z, heading, speed, characterFlags, userFlags)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		db.transaction(() => {
			for (const player of players) {
				const coords = player.coords,
					character = player.character;

				if (!character || !(character.flags & 64)) continue;

				statement.run(
					timestamp,
					player.licenseIdentifier.replace(/^license:/m, ""),
					character.id,
					coords.x,
					coords.y,
					coords.z,
					coords.w,
					player.speed,
					character.flags,
					player.flags
				);
			}
		})();

		stored.success++;
	} catch (err) {
		console.log(warning("SQLite error: "), muted(err));

		stored.failed++;
	}
}

export function range(server, license, start, end) {
	initHistoryDatabase(server);

	try {
		const query = db.prepare(`
        SELECT timestamp, characterId, x, y, z, heading, speed, characterFlags, userFlags
        FROM ${server}
        WHERE license = ? AND timestamp >= ? AND timestamp <= ?
    `);

		return query.all([license, start, end]);
	} catch (err) {
		console.log(warning("SQLite error: "), muted(err));

		return [];
	}
}

export function single(server, timestamp) {
	initHistoryDatabase(server);

	try {
		const query = db.prepare(`
            SELECT timestamp, license, characterId, x, y, z, heading, speed, characterFlags, userFlags
            FROM ${server}
            WHERE timestamp = ?
        `);

		return query.all([timestamp]);
	} catch (err) {
		console.log(warning("SQLite error: "), muted(err));

		return [];
	}
}

export function cleanup() {
	initHistoryDatabase();

	console.log(info("Cleaning up historic data..."));

	const days = config.lifetime || 10,
		timestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * days;

	console.log(muted("Collecting tables..."));

	const tables = db
		.query(`SELECT name FROM sqlite_master WHERE type = 'table'`)
		.all()
		.map(table => table.name)
		.filter(name => name && name.match(/^c\d+/m));

	for (const table of tables) {
		console.log(muted(`Preparing ${table}...`));
		initHistoryDatabase(table);

		console.log(muted(`Cleaning up ${table}...`));
		db.run(`DELETE FROM ${table} WHERE timestamp < ?`, [timestamp]);
	}

	try {
		vacuum();
	} catch (err) {
		console.log(warning("SQLite error: "), muted(err));
	}

	console.log(`${info("Cleanup complete!")} ${muted(`Updated ${tables.length} table(s)`)}`);
}

process.on("exit", close);
process.on("SIGINT", close);
process.on("SIGTERM", close);
