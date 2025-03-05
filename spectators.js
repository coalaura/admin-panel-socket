import { trackAverage } from "./average.js";
import { info, muted, warning } from "./colors.js";
import { updateSpectatorsJSON } from "./data.js";
import { getDatabase, initDatabase } from "./database.js";
import { equals } from "./functions.js";
import { getServerByName, getServers } from "./server.js";

const characters = {};

function loadCharacters(cluster, characterIds) {
	const loadIds = characterIds.filter(id => !(id in characters));

	if (!loadIds.length) {
		return;
	}

	const database = getDatabase(cluster);

	if (!database) {
		return;
	}

	for (const id of loadIds) {
		characters[id] = false;
	}

	database.query("SELECT character_id as id, CONCAT(first_name, ' ', last_name) as name, backstory, mugshot_url as mugshot FROM characters WHERE character_id IN (?)", [loadIds]).then(results => {
		for (const character of results) {
			const id = character.id;

			delete character.id;

			characters[id] = character;
		}
	});
}

function getServerPlayer(server, source) {
	if (!source || !server.players?.length) {
		return false;
	}

	return server.players.find(player => player.source === source);
}

function getPlayerInfo(server, source) {
	if (!source || !server.players?.length) {
		return false;
	}

	const player = server.players.find(player => player.source === source);

	if (!player) {
		return false;
	}

	const id = player.character?.id,
		character = id ? characters[id] : false;

	return {
		source: player.source,
		name: player.name,
		license: player.licenseIdentifier,
		character: character
	};
}

async function spectatorsJSON(serverName, url, clients) {
	const server = getServerByName(serverName);

	let timeout = 2000;

	if (!server.down && !server.failed) {
		const start = Date.now();

		try {
			const characterIds = [];

			const spectators = await updateSpectatorsJSON(server),
				current = clients.map(client => {
					const spectator = spectators.find(spectator => spectator.licenseIdentifier === client.license),
						player = getServerPlayer(server, spectator?.spectating);

					if (player.character) {
						characterIds.push(player.character.id);
					}

					return {
						key: client.identifier,
						license: client.license,
						stream: url.replace("%s", client.identifier),
						spectating: getPlayerInfo(player),
						data: spectator?.data || {},
					};
				});

			loadCharacters(server.cluster, characterIds);

			if (!equals(server.spectators, current)) {
				process.send({
					type: "spectators",
					data: current,
				});

				server.spectators = current;
			}
		} catch (e) {
			server.down = true;
			server.downError = e.message;

			console.error(`${warning("Failed to load spectators.json")} ${info(String(server.url))}: ${muted(e)}`);
		}

		const took = Date.now() - start;

		trackAverage("spectators", took);

		timeout = Math.max(0, 1000 - took);
	} else {
		timeout = 3000;
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
