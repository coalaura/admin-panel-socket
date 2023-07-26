import { authenticate } from "./auth.js";

export function initDataRoutes(pApp) {
    pApp.get("/data/:server/players", authenticate, async (req, resp) => {
        const server = req.server;

        const players = server.players.map(pPlayer => {
            const character = pPlayer.character;

            return {
                source: pPlayer.source,
                name: pPlayer.name,
                license: pPlayer.licenseIdentifier,
                flags: pPlayer.flags,
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

    pApp.get("/data/:server/players/count", authenticate, async (req, resp) => {
        const server = req.server;

        resp.json({
            status: true,
            data: server.players.length
        });
    });

    pApp.get("/data/:server/uptime", authenticate, async (req, resp) => {
        const server = req.server,
        uptime = !server.down && server.uptime ? server.uptime : false;

        resp.json({
            status: true,
            data: uptime
        });
    });
}