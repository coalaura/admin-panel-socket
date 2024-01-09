import { mkdir, rmdir, chmod, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export async function regenerateWorld(pServer) {
    const name = pServer.fullName,
        dir = join("generated", name);

    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }

    // count.json
    {
        const json = join(dir, "count.json");

        await writeFile(json, JSON.stringify({
            players: pServer.players.length
        }));

        await chmod(json, 0o777);
    }

    // info.json
    {
        const json = join(dir, "info.json");

        await writeFile(json, JSON.stringify(pServer.info));

        await chmod(json, 0o777);
    }

    // world.json
    {
        const json = join(dir, "world.json");

        await writeFile(json, JSON.stringify(pServer.world));

        await chmod(json, 0o777);
    }
}

export async function regenerateStreamers(pStreamers) {
    const path = join("generated", "streamers.json");

    await writeFile(path, JSON.stringify(pStreamers));

    await chmod(path, 0o777);
}

export async function clearGenerated(pServer) {
    const name = pServer.server,
        dir = join("generated", name);

    if (!existsSync(dir)) return;

    await rmdir(dir, { recursive: true });
}