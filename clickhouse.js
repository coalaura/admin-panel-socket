import { createClient } from "@clickhouse/client";
import { error, info, muted, warning } from "./colors";
import { formatBytes, formatInteger } from "./functions.js";
import configData from "./config.js";

let client,
	schemas = {},
	closing = false;

const stored = {
	failed: 0,
	success: 0
};

async function close() {
	if (!client || closing) return;

	closing = true;

	console.log(info("Closing database..."));

	await client.close();

	client = null;
	closing = false;

	process.exit(0);
}

export async function historyStatistics(server) {
    try {
        const result = await client.query({
            query: `
                SELECT sum(bytes_on_disk) AS total_size, sum(rows) AS total_rows, sumIf(bytes_on_disk, table = 'history.${server}') AS server_size, sumIf(rows, table = 'history.${server}') AS server_rows
                FROM system.parts
                WHERE database = 'history'
            `,
            format: "JSONEachRow",
        });

        const { total_size, total_rows, server_size, server_rows } = (await result.json())[0];

        return [
            `+ History Size (all): ${formatBytes(total_size)}`,
			`+ History Rows (all): ${formatInteger(total_rows)}`,

            `+ History Size (${server}): ${formatBytes(server_size)}`,
            `+ History Rows (${server}): ${formatInteger(server_rows)}`,

			`+ History failed inserts: ${formatInteger(stored.failed)}`,
			`+ History successful inserts: ${formatInteger(stored.success)}`
        ];
    } catch (err) {
        console.error(`${error("Error fetching history statistics:")} ${muted(err.message)}`);

        return [
			`- History Error: ${err.message}`
		];
    }
}

async function ensureSchema(server) {
	if (schemas[server]) {
		return;
	}

	try {
		const result = await client.query({
			query: "SHOW TABLES FROM history",
			format: "JSONEachRow"
		});

        const tables = await result.json();

		const exists = tables.some(table => table.name === server);

		if (exists) return;

		console.log(info(`Ensuring table ${server}`));

		await client.query({
			query: `
                CREATE TABLE history.${server} (
                    timestamp UInt32,
                    license String,
                    character_id Int32,
                    x Float32,
                    y Float32,
                    z Float32,
                    heading Float32,
                    speed Float32,
                    character_flags Int32,
                    user_flags Int32
                )
                ENGINE = MergeTree()
                PARTITION BY toDate(timestamp)
                ORDER BY (timestamp, license)
                TTL toDateTime(timestamp) + INTERVAL 30 DAY DELETE
                SETTINGS index_granularity = 8192;
            `
		});

		console.log(info(`Table ${server} ensured`));

		schemas[server] = true;
	} catch (err) {
		console.error(`${error("Error connecting to ClickHouse:")} ${muted(err.message)}`);
	}
}

async function initHistoryDatabase() {
	if (client) return;

    client = createClient({
        url: "http://localhost:8123",
        username: "default",
        password: configData.clickhouse
    });

    try {
        const result = await client.query({
            query: "SHOW DATABASES",
            format: "JSONEachRow"
        });

        const databases = await result.json();

        const exists = databases.some(db => db.name === "history");

        if (exists) return;

        console.log(info(`Creating database`));

        await client.query({
            query: "CREATE DATABASE history"
        });
    } catch (err) {
        console.error(`${error("Error connecting to ClickHouse:")} ${muted(err.message)}`);
    }
}

export async function store(server, players) {
	await initHistoryDatabase();
    await ensureSchema(server);

	const timestamp = Math.floor(Date.now() / 1000),
		rows = [];

	for (const player of players) {
		const coords = player.coords,
			character = player.character;

		if (!character || !(character.flags & 64)) continue;

		rows.push({
			timestamp: timestamp,
			license: player.licenseIdentifier.replace(/^license:/m, ""),
			character_id: character.id,
			x: coords.x,
			y: coords.y,
			z: coords.z,
			heading: coords.w,
			speed: player.speed,
			character_flags: character.flags,
			user_flags: player.flags
		});
	}

	if (rows.length === 0) return;

	try {
		// Insert rows into the ClickHouse table
		await client.insert({
			table: `history.${server}`,
			values: rows,
			format: "JSONEachRow"
		});

		stored.success += rows.length;
	} catch (err) {
		console.log(`${warning("History Store error:")} ${muted(err.message)}`);

		stored.failed += rows.length;
	}
}

export async function range(server, license, start, end) {
    await initHistoryDatabase();
    await ensureSchema(server);

	try {
		const result = await client.query({
			query: `
                SELECT timestamp, character_id AS characterId, x, y, z, heading, speed, character_flags AS characterFlags, user_flags AS userFlags
                FROM history.${server}
                WHERE license = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            `,
			query_params: [license, start, end],
			format: "JSON"
		});

		return await result.json();
	} catch (err) {
        console.log(`${warning("History Range error:")} ${muted(err.message)}`);

		return [];
	}
}

export async function single(server, timestamp) {
    await initHistoryDatabase();
    await ensureSchema(server);

    try {
        const result = await client.query({
            query: `
                SELECT timestamp, license, character_id AS characterId, x, y, z, heading, speed, character_flags AS characterFlags, user_flags AS userFlags
                FROM history.${server}
                WHERE timestamp = ?
            `,
			query_params: [timestamp],
            format: "JSON",
        });

        return await result.json();
    } catch (err) {
        console.log(`${warning("History Single error:")} ${muted(err.message)}`);

        return [];
    }
}


process.on("exit", close);
process.on("SIGINT", close);
process.on("SIGTERM", close);
