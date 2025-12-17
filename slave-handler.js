import { getAverage } from "./average.js";
import { getLogs } from "./console.js";
import { formatUptime } from "./functions.js";
import { closeInfluxDB } from "./influx.js";
import { getServerByName } from "./server.js";

const startup = new Date();

export class SlaveHandler {
	constructor() {
		process.on("message", message => {
			this.handle(message);
		});
	}

	async handle(message) {
		// Special handling for termination message
		if (message === "terminate") {
			console.info(info("Received terminate message, terminating..."));

			await closeInfluxDB();

			process.exit(0);
		}

		const { id, server, func, options } = message;

		const srv = getServerByName(server);

		if (!srv) {
			this.respond(id, "Server not found");

			return;
		}

		switch (func) {
			case "players":
				this.get_players(id, srv);

				return;
			case "online":
				this.get_online(id, srv, options);

				return;
			case "spectators":
				this.get_spectators(id, srv);

				return;
			case "health":
				this.get_health(id, srv);

				return;
		}

		this.respond(id, {
			status: false,
			error: "Invalid function",
		});
	}

	respond(id, data) {
		process.send({
			id: id,
			type: "request",
			data: data,
		});
	}

	static routes() {
		return {
			// Data routes require authentication
			data: ["/players", "/online", "/spectators"],

			// Static routes require no authentication
			static: ["/health"],
		};
	}

	// Get all players (cached)
	get_players(id, srv) {
		const players = srv.players.map(player => {
			const character = player.character;

			return {
				source: player.source,
				name: player.name,
				license: player.licenseIdentifier,
				flags: player.flags,
				character: character
					? {
							id: character.id,
							name: character.fullName,
							flags: character.flags,
						}
					: false,
			};
		});

		this.respond(id, {
			status: true,
			data: players,
		});
	}

	// Get online status of 1 or more players (cached)
	get_online(id, srv, options) {
		const players = options?.split(",")?.filter(license => license?.startsWith("license:"));

		if (!players || !players.length) {
			this.respond(id, {
				status: false,
				error: "No players specified",
			});

			return;
		}

		if (players.length > 50) {
			this.respond(id, {
				status: false,
				error: "Too many players specified (max 50)",
			});
		}

		const online = {};

		for (const license of players) {
			const player = srv.players.find(player => player.licenseIdentifier === license);

			online[license] = player
				? {
						source: player.source,
						character: player.character ? player.character.id : false,
					}
				: false;
		}

		this.respond(id, {
			status: true,
			data: online,
		});
	}

	// Get current spectators
	get_spectators(id, srv) {
		this.respond(id, {
			status: true,
			data: srv.spectators || [],
		});
	}

	// Get slave health
	async get_health(id, srv) {
		const avgWorld = getAverage("world"),
			avgStaff = getAverage("staff");

		const logs = [];

		logs.push(srv ? "+ server object found" : "- server object not found");

		logs.push(srv && !srv.failed ? "+ server object startup successful" : "- server object startup failed");
		logs.push(srv?.token ? "+ server.token is set" : "- server.token is not set");
		logs.push(srv && !srv.down ? "+ server is up" : `- server is down (${srv?.downError || "Unknown error"})`);
		logs.push(srv?.info ? "+ server.info is set" : "- server.info is not set");
		logs.push(`+ worker pid is ${process.pid}`);
		logs.push(avgWorld ? `+ world.json API average is ${avgWorld}ms` : "- world.json API average is not set");
		logs.push(avgStaff ? `+ staff.json API average is ${avgStaff}ms` : "- staff.json API average is not set");

		logs.push(`+ startup was ${startup.toUTCString()}`);
		logs.push(`+ uptime is ${formatUptime(startup)}`);

		logs.push("");
		logs.push((srv?.info ? "+ server.info = " : "- server.info = ") + JSON.stringify(srv?.info));

		this.respond(id, {
			status: true,
			data: {
				info: logs.join("\n"),
				logs: getLogs().join("\n"),
			},
		});
	}
}
