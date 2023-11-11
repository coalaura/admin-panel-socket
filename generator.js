import { mkdir, writeFile, rmdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export async function regenerateWorld(pServer) {
    const name = pServer.server,
        dir = join("generated", name);

    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }

    // count.json
    await writeFile(join(dir, "count.json"), JSON.stringify({
        players: pServer.players.length
    }));

    // info.json
    await writeFile(join(dir, "info.json"), JSON.stringify(pServer.info));

    // world.json
    await writeFile(join(dir, "world.json"), JSON.stringify(pServer.world));
}

export async function clearGenerated(pServer) {
    const name = pServer.server,
        dir = join("generated", name);

    if (!existsSync(dir)) return;

    await rmdir(dir, { recursive: true });
}