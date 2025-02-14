import { trackAverage } from "./average.js";
import { updateSpectatorsJSON } from "./data.js";
import { getServerByName, getServers } from "./server.js";

function getPlayerInfo(server, source) {
	if (!source || !server.players?.length) {
		return false;
	}

	const player = server.players.find(player => player.source === source);

	if (!player) {
		return false;
	}

	return {
		source: player.source,
		name: player.name,
		license: player.licenseIdentifier,
	};
}

async function spectatorsJSON(serverName, clients) {
	const server = getServerByName(serverName);

	let timeout = 2000;

	if (!server.down && !server.failed) {
		const start = Date.now();

		try {
			const spectators = await updateSpectatorsJSON(server);

			server.spectators = clients.map(client => {
				const spectator = spectators.find(spectator => spectator.licenseIdentifier === client.license);

				return {
					license: client.license,
					identifier: client.identifier,
					spectating: getPlayerInfo(server, spectator?.spectating),
				};
			});
		} catch (e) {
			server.down = true;
			server.downError = e.message;

			console.error(`${warning("Failed to load spectators.json")} ${_info(String(server.url))}: ${muted(e)}`);
		}

		const took = Date.now() - start;

		trackAverage("spectators", took);

		timeout = Math.max(0, 1000 - took);
	} else {
		timeout = 5000;
	}

	setTimeout(() => {
		spectatorsJSON(serverName, clients);
	}, timeout);
}

export function startSpectatorLoop(streams) {
	const clients = parseStreams(streams);

	if (!clients.length) return;

	const servers = getServers();

	for (const serverName in servers) {
		spectatorsJSON(serverName, clients);
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
