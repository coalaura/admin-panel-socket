import { authenticate } from "./auth.js";
import { isValidLicense } from "./data-loop.js";

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

    pApp.get("/data/:server/online/:players", authenticate, async (req, resp) => {
        const players = req.params.players.split(",")
            .filter(pPlayer => isValidLicense(pPlayer));

        if (!players.length) {
            return resp.json({
                status: false,
                error: "No players specified"
            });
        }

        if (players.length > 20) {
            return resp.json({
                status: false,
                error: "Too many players specified (max 20)"
            });
        }

        const server = req.server;

        let online = {};

        for (const license of players) {
            online[license] = false;
        }

        for (const player of server.players) {
            const license = player.licenseIdentifier;

            if (players.includes(license)) {
                online[license] = {
                    source: player.source,
                    character: player.character ? player.character.id : false
                };
            }
        }

        resp.json({
            status: true,
            data: online
        });
    });

    pApp.get("/data/:server/players/count", authenticate, async (req, resp) => {
        const server = req.server;

        resp.json({
            status: true,
            data: server.players.length
        });
    });

    pApp.get("/data/:server/info", authenticate, async (req, resp) => {
        const server = req.server,
            uptime = server.uptime || false,
            name = server.name || false;

        resp.json({
            status: true,
            data: {
                name: name,
                uptime: uptime
            }
        });
    });

    pApp.get("/data/:server/hash/:hash", authenticate, async (req, resp) => {
        const server = req.server,
            models = server.models || {},
            hash = parseInt(req.params.hash);

        if (!Number.isInteger(hash)) {
            return resp.json({
                status: false,
                error: "Invalid hash"
            });
        }

        if (!models[hash]) {
            const signedHash = _unsignedToSigned(hash);

            if (models[signedHash]) {
                hash = signedHash;
            }
        }

        resp.json({
            status: true,
            data: {
                name: models[hash] || false,
                hash: hash
            }
        });
    });

    pApp.get("/data/:server/world", authenticate, async (req, resp) => {
        const server = req.server;

        resp.json({
            status: true,
            data: server.world
        });
    });
}

function _unsignedToSigned(pNumber) {
    if (pNumber >= 2 ^ 31) {
        return pNumber - 2 ^ 32;
    }

    return pNumber;
}
