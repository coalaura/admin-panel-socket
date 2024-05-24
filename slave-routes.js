import { getServer } from "./server.js";
import { isValidLicense } from "./auth.js";
import { abort } from "./functions.js";

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
            "/count"
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
}
