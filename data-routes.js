import { resolve } from "path";
import { existsSync } from "fs";
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

    pApp.get("/data/:server/hash/:hash", authenticate, async (req, resp) => {
        const server = req.server,
            models = server.models || {};

        const result = {},
            hashes = req.params.hash.split(",");

        if (!hashes.length) {
            return resp.json({
                status: false,
                error: "No hashes specified"
            });
        }

        for (let hash of hashes) {
            hash = parseInt(hash);

            if (!Number.isInteger(hash)) continue;

            let search = hash;

            if (!models[search]) {
                const signedHash = _unsignedToSigned(search);

                if (models[signedHash]) {
                    search = signedHash;
                }
            }

            const name = models[search] || false;

            result[hash] = name ? {
                name: name,
                hash: search
            } : false;
        }

        resp.json({
            status: true,
            data: result
        });
    });

    // Fallback for non-nginx setups
    // Serve generated files in /generated
    pApp.get("/generated/:server/:file", async (req, resp) => {
        const server = req.params.server?.replace(/[^a-z0-9]/gi, ""),
            file = req.params.file?.replace(/[^a-z0-9.]/gi, "");

        if (!server || !file) {
            return resp.status(404).send("Not found");
        }

        const path = resolve(`generated/${server}/${file}`);

        if (!existsSync(path)) {
            return resp.status(404).send("Not found");
        }

        resp.sendFile(path);
    });

    pApp.get("/generated/:file", async (req, resp) => {
        const file = req.params.file?.replace(/[^a-z0-9.]/gi, "");

        if (!file || !file.endsWith(".json")) {
            return resp.status(404).send("Not found");
        }

        const path = resolve(`generated/${file}`);

        if (!existsSync(path)) {
            return resp.status(404).send("Not found");
        }

        resp.sendFile(path);
    });
}

function _unsignedToSigned(pNumber) {
    if (pNumber >= 2 ^ 31) {
        return pNumber - 2 ^ 32;
    }

    return pNumber;
}
