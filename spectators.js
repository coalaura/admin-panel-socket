import { trackAverage } from "./average.js";
import { info, muted, warning } from "./colors.js";
import { updateSpectatorsJSON } from "./data.js";
import { getDatabase, initDatabase } from "./database.js";
import { getServerByName, getServers } from "./server.js";

const characters = {};

function loadCharacter(cluster, id) {
	if (!id) {
		return false;
	}

	if (!characters[cluster]) {
		characters[cluster] = {};
	}

	if (id in characters[cluster]) {
		return characters[cluster][id];
	}

	const database = getDatabase(cluster);

	if (!database) {
		return false;
	}

	characters[cluster][id] = false;

	database
		.query("SELECT character_id as id, CONCAT(first_name, ' ', last_name) as name, backstory, date_of_birth as birthday FROM characters WHERE character_id = ?", id)
		.then(results => {
			if (!results.length) {
				return;
			}

			characters[cluster][id] = results[0];
		});

	return false;
}

function getServerPlayer(server, source) {
	if (!source || !server.players?.length) {
		return false;
	}

	return server.players.find(player => player.source === source);
}

function getPlayerInfo(cluster, player) {
	if (!player) {
		return false;
	}

	return {
		source: player.source,
		name: player.name,
		license: player.licenseIdentifier,
		character: loadCharacter(cluster, player.character?.id),
	};
}

async function spectatorsJSON(serverName, url, clients) {
	const server = getServerByName(serverName);

	let timeout = 1000;

	if (!server.down && !server.failed) {
		const start = Date.now();

		try {
			const spectators = await updateSpectatorsJSON(server),
				current = clients.map(client => {
					const spectator = spectators.find(spectator => spectator.licenseIdentifier === client.license),
						player = getServerPlayer(server, spectator?.spectating);

					return {
						key: client.identifier,
						license: client.license,
						stream: url.replace("%s", client.identifier),
						spectating: getPlayerInfo(server.cluster, player),
						data: spectator?.data || {},
					};
				});

			process.send({
				type: "spectators",
				data: current,
			});

			server.spectators = current;
		} catch (e) {
			server.down = true;
			server.downError = e.message;

			console.error(`${warning("Failed to load spectators.json")} ${info(String(server.url))}: ${muted(e)}`);
		}

		const took = Date.now() - start;

		trackAverage("spectators", took);

		timeout = Math.max(0, timeout - took);
	} else {
		timeout = 4000;
	}

	setTimeout(() => {
		spectatorsJSON(serverName, url, clients);
	}, timeout);
}

export async function startSpectatorLoop(env) {
	const url = "OVERWATCH_URL" in env ? env.OVERWATCH_URL : "",
		clients = parseStreams("OVERWATCH_STREAMS" in env ? env.OVERWATCH_STREAMS : "");

	if (!url || !clients.length) return;

	const servers = getServers();

	for (const serverName in servers) {
		const server = servers[serverName];

		await initDatabase(server.cluster);

		spectatorsJSON(serverName, url, clients);
	}
}

function parseStreams(streams) {
	return streams.split(",").map(stream => {
		const [license, identifier] = stream.trim().split(":");

		if (!license || !identifier) {
			return false;
		}

		return {
			license: `license:${license}`,
			identifier: identifier,
		};
	});
}
