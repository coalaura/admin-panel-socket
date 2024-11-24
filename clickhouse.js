import { createClient } from "@clickhouse/client";
import { error, info, muted, warning } from "./colors";
import { formatBytes, formatInteger } from "./functions.js";
import configData from "./config.js";

let client,
	schemas = {},
	closing = false,
	batch = [];

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
        const total = await client.query({
            query: `
                SELECT sum(bytes_on_disk) AS total_size, sum(rows) AS total_rows
                FROM system.parts
                WHERE database = 'history'
            `,
            format: "JSONEachRow",
        });

        const { total_size, total_rows } = (await total.json())[0];

		const local = await client.query({
			query: `
				SELECT sum(bytes_on_disk) AS server_size, sum(rows) AS server_rows
				FROM system.parts
				WHERE database = 'history' AND table = '${server}'
			`,
			format: "JSONEachRow",
		});

		const { server_size, server_rows } = (await local.json())[0];

        return [
            `+ History Size (all): ${formatBytes(total_size)}`,
			`+ History Rows (all): ${formatInteger(total_rows)}`,

            `+ History Size (${server}): ${formatBytes(server_size)}`,
            `+ History Rows (${server}): ${formatInteger(server_rows)}`,
            `+ History Batch (${server}): ${formatInteger(batch.length)}`,

			`${stored.success > 0 ? "+" : "-"} History successful inserts: ${formatInteger(stored.success)}`,
			`${stored.failed > 0 ? "-" : "+"} History failed inserts: ${formatInteger(stored.failed)}`
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
                    timestamp DateTime,
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
        password: configData.clickhouse,
		clickhouse_settings: {
			async_insert: 1,
			wait_for_async_insert: 0,
			async_insert_max_data_size: 10485760, // 10 MB
			async_insert_busy_timeout_ms: 1000,
			async_insert_threads: 4,
		}
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

	const timestamp = Math.floor(Date.now() / 1000);

	for (const player of players) {
		const coords = player.coords,
			character = player.character;

		if (!character || !(character.flags & 64)) continue;

		batch.push({
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

	if (batch.length < 8000) return;

	try {
		// Insert rows into the ClickHouse table
		await client.insert({
			table: `history.${server}`,
			values: batch,
			format: "JSONEachRow"
		});

		stored.success += batch.length;
	} catch (err) {
		console.log(`${warning("History Store error:")} ${muted(err.message)}`);

		stored.failed += batch.length;
	}

	batch = [];
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
