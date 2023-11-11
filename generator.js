import { mkdir, writeFile, rmdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export async function regenerateWorld(pServer) {
    const name = pServer.server,
        dir = join("generated", name);

    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }

    // players.json
    const players = pServer.players.map(pPlayer => {
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

    await writeFile(join(dir, "players.json"), JSON.stringify(players));

    // world.json
    await writeFile(join(dir, "world.json"), JSON.stringify(pServer.world));

    // count.json
    await writeFile(join(dir, "count.json"), JSON.stringify({
        players: pServer.players.length
    }));

    // info.json
    await writeFile(join(dir, "info.json"), JSON.stringify(pServer.info));
}

export async function clearGenerated(pServer) {
    const name = pServer.server,
        dir = join("generated", name);

    if (!existsSync(dir)) return;

    await rmdir(dir, { recursive: true });
}