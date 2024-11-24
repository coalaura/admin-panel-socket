import { getServerByName } from "./server.js";
import { getLogs } from "./logging.js";
import { isValidLicense } from "./auth.js";
import { bufferCount } from "./buffer.js";
import { getAverage } from "./average.js";
import { historyStatistics } from "./clickhouse.js";

export class SlaveHandler {
    constructor() {
        process.on("message", message => {
            this.handle(message);
        });
    }

    handle(message) {
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
            case "server":
                this.get_server(id, srv);

                return;
            case "count":
                this.get_count(id, srv);

                return;
            case "health":
                this.get_health(id, srv);

                return;
        }

        this.respond(id, {
            status: false,
            error: "Invalid function"
        });
    }

    respond(id, data) {
        process.send({
            id: id,
            type: "request",
            data: data
        });
    }

    static routes() {
        return {
            // Data routes require authentication
            data: [
                "/players",
                "/online"
            ],

            // Static routes require no authentication
            static: [
                "/server",
                "/count",
                "/health"
            ]
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
                character: character ? {
                    id: character.id,
                    name: character.fullName,
                    flags: character.flags
                } : false
            };
        });

        this.respond(id, {
            status: true,
            data: players
        });
    }

    // Get online status of 1 or more players (cached)
    get_online(id, srv, options) {
        const players = options?.split(",")?.filter(player => isValidLicense(player));

        if (!players || !players.length) {
            this.respond(id, {
                status: false,
                error: "No players specified"
            });

            return;
        }

        if (players.length > 50) {
            this.respond(id, {
                status: false,
                error: "Too many players specified (max 50)"
            });
        }

        let online = {};

        for (const license of players) {
            const player = srv.players.find(player => player.licenseIdentifier === license);

            online[license] = player ? {
                source: player.source,
                character: player.character ? player.character.id : false
            } : false;
        }

        this.respond(id, {
            status: true,
            data: online
        });
    }

    // Get server info
    get_server(id, srv) {
        const data = {
            baseTime: srv.world?.baseTime || 0,
            uptime: srv.info?.uptime || 0,
            name: srv.info?.name || "",
            logo: srv.info?.logo || ""
        };

        this.respond(id, {
            status: true,
            data: data
        });
    }

    // Get server player count
    get_count(id, srv) {
        const count = srv.players?.length || 0;

        this.respond(id, {
            status: true,
            data: count
        });
    }

    // Get slave health
    async get_health(id, srv) {
        const avgWorld = getAverage("world"),
            avgStaff = getAverage("staff");

        let logs = [];

        logs.push(srv ? "+ server object found" : "- server object not found");

        logs.push(srv && !srv.failed ? "+ server object startup successful" : "- server object startup failed");
        logs.push(srv && srv.token ? "+ server.token is set" : "- server.token is not set");
        logs.push(srv && !srv.down ? "+ server is up" : `- server is down (${srv?.downError || "Unknown error"})`);
        logs.push(srv && srv.info ? "+ server.info is set" : "- server.info is not set");
        logs.push(`+ ${bufferCount()} open buffered writers`);
        logs.push(`+ worker pid is ${process.pid}`);
        logs.push(avgWorld ? `+ world.json API average is ${avgWorld}ms` : "- world.json API average is not set");
        logs.push(avgStaff ? `+ staff.json API average is ${avgStaff}ms` : "- staff.json API average is not set");

        const history = await historyStatistics(srv.cluster);

        logs.push(...history);

        logs.push("");
        logs.push((srv && srv.info ? "+ server.info = " : "- server.info = ") + JSON.stringify(srv?.info));

        this.respond(id, {
            status: true,
            data: {
                info: logs.join("\n"),
                logs: getLogs().join("\n")
            }
        });
    }
}
