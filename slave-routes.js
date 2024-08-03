import { getServer } from "./server.js";
import { isValidLicense } from "./auth.js";
import { abort } from "./functions.js";
import { getLogs } from "./logging.js";

export function getSlaveRoutes() {
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

export function initSlaveRoutes(server, app) {
    // Get all players (cached)
    app.get("/players", async (req, resp) => {
        const srv = getServer(server, req);

        if (!srv) return abort(resp, "Server not found");

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

        resp.json({
            status: true,
            data: players
        });
    });

    // Get online status of 1 or more players (cached)
    app.get("/online/:players", async (req, resp) => {
        const srv = getServer(server, req);

        if (!srv) return abort(resp, "Server not found");

        const players = req.params.players.split(",")
            .filter(player => isValidLicense(player));

        if (!players.length) return abort(resp, "No players specified");

        if (players.length > 50) return abort(resp, "Too many players specified (max 50)");

        let online = {};

        for (const license of players) {
            const player = srv.players.find(player => player.licenseIdentifier === license);

            online[license] = player ? {
                source: player.source,
                character: player.character ? player.character.id : false
            } : false;
        }

        resp.json({
            status: true,
            data: online
        });
    });

    // Get server info
    app.get("/server", async (req, resp) => {
        const srv = getServer(server, req);

        if (!srv) return abort(resp, "Server not found");

        const data = {
            baseTime: srv.world?.baseTime || 0,
            uptime: srv.info?.uptime || 0,
            name: srv.info?.name || "",
            logo: srv.info?.logo || ""
        };

        resp.json({
            status: true,
            data: data
        });
    });

    // Get server player count
    app.get("/count", async (req, resp) => {
        const srv = getServer(server, req);

        if (!srv) return abort(resp, "Server not found");

        resp.json({
            status: true,
            data: srv.info?.players?.length || 0
        });
    });

    // Get slave health
    app.get("/health", async (req, resp) => {
        const srv = getServer(server, req);

        let logs = [];

        logs.push(srv ? "+ server object found" : "- server object not found");

        logs.push(srv && !srv.failed ? "+ server object startup successful" : "- server object startup failed");
        logs.push(srv && srv.token ? "+ server.token is set" : "- server.token is not set");
        logs.push(srv && srv.database ? "+ server.database is true" : `- server.database is false (${srv?.databaseError || "Unknown error"})`);
        logs.push(srv && !srv.down ? "+ server is up" : `- server is down (${srv?.downError || "Unknown error"})`);
        logs.push(srv && srv.info ? "+ server.info is set" : "- server.info is not set");

        logs.push("");
        logs.push((srv && srv.info ? "+ server.info = " : "- server.info = ") + JSON.stringify(srv?.info));

        resp.json({
            status: true,
            data: {
                info: logs.join("\n"),
                logs: getLogs().join("\n")
            }
        });
    });
}
