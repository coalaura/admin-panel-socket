import { InfluxDB, Point } from "@influxdata/influxdb-client";

import config from "./config.js";

let influx, write, query;

function connectToInfluxDB() {
	if (influx || !config.influx) return;

	if (!config.influx.url || !config.influx.token) {
		console.warn("Missing influx.url or influx.token!");

		return;
	}

	influx = new InfluxDB({
		url: config.influx.url,
		token: config.influx.token,
	});

	write = influx.getWriteApi("op-fw", "history", "s", {
		batchSize: 500,
		flushInterval: 5_1000,
		maxBufferLines: 20_000,
	});

	query = influx.getQueryApi("op-fw");

	console.info("Connected to InfluxDB.");
}

export async function closeInfluxDB() {
	if (!write) return;

	await write.flush();
	await write.close();
}

export function storePlayerPositions(server, players) {
	connectToInfluxDB();

	if (!write) return;

	const timestamp = Math.floor(Date.now() / 1000);

	for (const player of players) {
		const coords = player.coords,
			character = player.character;

		if (!character || !(character.flags & 64)) {
			continue;
		}

		const point = new Point("data");

		point.timestamp(timestamp);
		point.tag("server", server);
		point.tag("player", cleanLicense(player.licenseIdentifier));

		point.intField("player_flags", player.flags);
		point.intField("character_flags", character.flags);
		point.intField("character", character.id);

		point.floatField("x", coords.x);
		point.floatField("y", coords.y);
		point.floatField("z", coords.z);
		point.floatField("w", coords.w);
		point.floatField("speed", player.speed);

		write.writePoint(point);
	}
}

export async function loadTimestampData(server, timestamp) {
	connectToInfluxDB();

	if (!query) {
		throw new Error("No database connection");
	}

	server = cleanServer(server, true);

	const fromISO = new Date(timestamp * 1000).toISOString(),
		tillISO = new Date((timestamp + 5) * 1000).toISOString();

	const flux = `
		data = from(bucket: "history")
			|> range(start: time(v: "${fromISO}"), stop: time(v: "${tillISO}"))
			|> filter(fn: (r) =>
				r._measurement == "data" and
				r.server == "${server}"
			)

		t = (data |> first() |> findRecord(fn:(key)=>true, idx:0))._time

		data
			|> filter(fn: (r) => r._time == t)
			|> pivot(rowKey:["player"], columnKey:["_field"], valueColumn:"_value")
			|> keep(columns:[
				"player","server","_time",
				"x","y","z","w","speed",
				"character","character_flags","player_flags"
				])
			|> sort(columns:["player"])
	`;

	const rows = await query.collectRows(flux);

	if (!rows || rows.length === 0) {
		throw Error("No data for the selected period");
	}

	const result = {};

	for (const row of rows) {
		const license = row.player;

		result[license] = {
			_: row.character,

			x: row.x,
			y: row.y,
			z: row.z,
			w: row.w,
			s: row.speed,

			cf: row.character_flags,
			uf: row.player_flags,
		};
	}

	return rows.map(cleanRow);
}

export async function loadHistoryData(server, license, from, till) {
	connectToInfluxDB();

	if (!query) {
		throw new Error("No database connection");
	}

	server = cleanServer(server, true);
	license = cleanLicense(license, true);

	if (from >= till) {
		throw new Error("From must be before till");
	}

	const fromISO = new Date(from * 1000).toISOString(),
		tillISO = new Date(till * 1000).toISOString();

	const flux = `
		from(bucket: "history")
			|> range(start: time(v:"${fromISO}"), stop: time(v:"${tillISO}"))
			|> filter(fn:(r)=>
				r._measurement == "data" and
				r.server == "${server}" and
				r.player == "${license}"
			)
			|> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
			|> sort(columns: ["_time"])
	`;

	const rows = await query.collectRows(flux);

	if (!rows || rows.length === 0) {
		throw Error("No data for the selected period");
	}

	const result = {};

	for (const row of rows) {
		const ts = cleanTimestamp(row._time),
			cFlags = row.character_flags;

		result[ts] = {
			x: row.x,
			y: row.y,
			z: row.z,
			s: row.speed,

			i: !!(cFlags & 8), // invisible
			c: !!(cFlags & 16), // invincible
			f: !!(cFlags & 32), // frozen
			d: !!(cFlags & 1), // dead
		};
	}

	return result;
}

function cleanLicense(license, validate = false) {
	license = license.replace(/^license:/m, "").toLowerCase();

	if (validate) {
		if (!license || !license.match(/^[a-z0-9]{40}$/i)) {
			throw new Error("Invalid license identifier");
		}
	}

	return license;
}

function cleanServer(server, validate = false) {
	server = server.replace(/s\d+$/im, "").toLowerCase();

	if (validate) {
		if (!server || !server.match(/^c\d+$/i)) {
			throw new Error("Invalid server");
		}
	}

	return server;
}

function cleanTimestamp(time) {
	const date = new Date(time);

	return Math.floor(date.getTime() / 1000);
}

function cleanRow(row) {
	const date = new Date(row._time);

	return {
		timestamp: Math.floor(date.getTime() / 1000),
		license: row.player,
		character: row.character,

		x: row.x,
		y: row.y,
		z: row.z,
		w: row.w,
		speed: row.speed,

		character_flags: row.character_flags,
		player_flags: row.player_flags,
	};
}
