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

    pApp.get("/data/:server/status", authenticate, async (req, resp) => {
        const server = req.server,
            version = !server.down && server.version ? server.version : false;

        resp.json({
            status: true,
            data: version
        });
    });
}