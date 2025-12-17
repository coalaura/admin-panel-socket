import { trackAverage } from "./average.js";
import { info as _info, muted, success, warning } from "./colors.js";
import { checkIfServerIsUp, updateStaffJSON, updateWorldJSON } from "./data.js";
import { round } from "./functions.js";
import { getServerByName, getServers } from "./server.js";

function bubbleStatusUpdate(server) {
	process.send({
		type: "status",
		data: {
			baseTime: round(server.world?.baseTime || 0, 60),
			uptime: server.info?.uptime || 0,
			name: server.info?.name || "",
			logo: server.info?.logo || "",
			players: Array.isArray(server.players) ? server.players.length : 0,
		},
	});
}

async function worldJSON(serverName) {
	const server = getServerByName(serverName);

	let timeout = 1000;

	if (!server.down && !server.failed) {
		const start = Date.now();

		try {
			const clientData = await updateWorldJSON(server);

			process.send({
				type: "world",
				data: clientData,
			});
		} catch (e) {
			server.down = true;
			server.downError = e.message;

			console.error(`${warning("Failed to load world.json")} ${_info(String(server.url))}: ${muted(e)}`);
		}

		bubbleStatusUpdate(server);

		const took = Date.now() - start;

		trackAverage("world", took);

		timeout = Math.max(0, 1000 - took);
	} else {
		timeout = 5000;
	}

	setTimeout(() => {
		worldJSON(serverName);
	}, timeout);
}

async function staffJSON(serverName) {
	const server = getServerByName(serverName);

	let timeout = 3000;

	if (!server.down && !server.failed) {
		const start = Date.now();

		try {
			const clientData = await updateStaffJSON(server);

			process.send({
				type: "staff",
				data: clientData,
			});
		} catch (e) {
			server.down = true;
			server.downError = e.message;

			bubbleStatusUpdate(server);

			console.error(`${warning("Failed to load staffChat.json")} ${_info(String(server.url))}: ${muted(e)}`);
		}

		const took = Date.now() - start;

		trackAverage("staff", took);

		timeout = Math.max(0, 3000 - took);
	} else {
		timeout = 5000;
	}

	setTimeout(() => {
		staffJSON(serverName);
	}, timeout);
}

async function downChecker(serverName) {
	const server = getServerByName(serverName),
		info = await checkIfServerIsUp(server);

	if (info) {
		server.info = info;

		if (server.down) {
			console.error(`${success("Server back up")} ${_info(server.server)}`);

			server.down = false;
			server.downError = null;

			bubbleStatusUpdate(server);
		}
	}
}

export function initDataLoop() {
	const servers = getServers();

	for (const serverName in servers) {
		// Stagger
		runIntervalDelayed(
			() => {
				downChecker(serverName);
			},
			1000,
			10000
		);

		setTimeout(() => {
			worldJSON(serverName);
		}, 2000);

		setTimeout(() => {
			staffJSON(serverName);
		}, 3000);
	}
}

export function isValidType(type) {
	return type && ["world", "staff", "spectators", "updates"].includes(type);
}

function runIntervalDelayed(fn, delay, interval) {
	setTimeout(() => {
		fn();

		setInterval(fn, interval);
	}, delay);
}
