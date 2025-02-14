import { requestOpFwApi } from "./http.js";
import { loadOnDutyData } from "./duty.js";
import { HistoryBin } from "./history-bin.js";

import { getServers, promises as dns } from "node:dns";

export async function updateWorldJSON(server) {
	const dutyMap = await loadOnDutyData(server);

	const data = await requestOpFwApi(`${server.url}/op-framework/world.json?pack=1`, server.token);

	try {
		const bin = HistoryBin.getInstance(server.server);

		await bin.writeAll(data.players);
	} catch (err) {
		console.warn(`Failed to write to history bin: ${err.message}`);
	}

	const cleaned = data.players.map(player => cleanupPlayer(player, dutyMap));

	server.players = data.players;
	server.world = data.world;

	return {
		players: cleaned,
		instance: data.world?.instance,
	};
}

export async function updateStaffJSON(server) {
	return await requestOpFwApi(`${server.url}/op-framework/staffChat.json?pack=1`, server.token);
}

export async function updateSpectatorsJSON(server) {
	return await requestOpFwApi(`${server.url}/op-framework/spectators.json?pack=1`, server.token);
}

export async function checkIfServerIsUp(server) {
	let uptime = false,
		name = false,
		logo = false,
		success = false;

	try {
		if (server.down) {
			// To test if we can do authorized requests
			await requestOpFwApi(`${server.url}/op-framework/auth.json`, server.token);
		}

		const data = await requestOpFwApi(`${server.url}/op-framework/variables.json?pack=1`, server.token);

		if (typeof data.serverUptimeMilliseconds === "number") {
			uptime = data.serverUptimeMilliseconds;
		}

		if (typeof data.communityName === "string") {
			name = data.communityName;
		}

		if (typeof data.communityLogo === "string") {
			logo = data.communityLogo;
		}

		success = data.serverReady === true;
	} catch (e) {
		console.warn(`Failed to check if server is up (${String(server.url)}): ${e.message}`);

		await canResolveServerDNS(server.url);

		if (!server.url) {
			console.error("Server URL not found, waiting for restart...");

			process.exit(1);
		}
	}

	if (success && server.down) {
		console.info(`Server ${server.url} is up again! (uptime=${uptime}, name=${name})`);
	}

	if (!success) {
		return false;
	}

	return {
		uptime: uptime,
		name: name,
		logo: logo,
	};
}

async function canResolveServerDNS(url) {
	if (!url || url.match(/\d+\.\d+\.\d+\.\d+/)) {
		return;
	}

	const uri = new URL(url),
		host = uri.host,
		servers = getServers();

	try {
		const result = await dns.lookup(host);

		if (!result || !result.address) {
			throw new Error("no address found");
		}

		console.log(`Resolved ${host} to: ${result.address}`);
	} catch (e) {
		console.info(`Active DNS servers: ${servers.join(", ")}`);
		console.warn(`Failed to resolve ${host}: ${e.message}`);
	}
}

function cleanupPlayer(player, dutyMap) {
	const character = player.character,
		vehicle = player.vehicle;

	const license = player.licenseIdentifier,
		duty = license in dutyMap ? dutyMap[license] : false;

	return {
		source: player.source,
		license: license,
		name: player.name,
		coords: player.coords,
		speed: player.speed,
		flags: player.flags,
		instance: player.instanceId,
		character: character
			? {
					id: character.id,
					name: character.fullName,
					flags: character.flags,
				}
			: false,
		vehicle: vehicle
			? {
					id: vehicle.id,
					model: vehicle.model,
					driving: vehicle.driving,
				}
			: false,
		duty: duty
			? {
					type: duty.type,
					department: duty.department,
				}
			: false,
	};
}
