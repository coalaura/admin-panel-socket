import { BufferedWriter } from "./buffer.js";

import { readdirSync, rmdirSync, existsSync, mkdirSync } from "fs";

let bin;

class HistoryBin {
    #server;
    #closed = false;
    #writers = {};

    constructor(server) {
        this.#server = server;
    }

    #writer(timestamp, license) {
        const path = getHistoryPath(this.#server, timestamp, license),
            writer = this.#writers[license];

        if (writer) {
            writer.setPath(path);

            return writer;
        }

        return this.#writers[license] = new BufferedWriter(path);
    }

    #write(timestamp, player) {
        const coords = player.coords,
			character = player.character;

		if (!character || !(character.flags & 64)) {
            return false;
        }

        /**
         * | Timestamp (ui32) | character_id (ui32) | x (f32) | y (f32) | z (f32) | heading (f32) | speed (f32) | character_flags (ui32) | user_flags (ui32) |
         */
        const license = player.licenseIdentifier.replace(/^license:/m, ""),
            writer = this.#writer(timestamp, license);

        writer.writeUint32(timestamp);
        writer.writeUint32(character.id);
        writer.writeFloat32(coords.x);
        writer.writeFloat32(coords.y);
        writer.writeFloat32(coords.z);
        writer.writeFloat32(coords.w);
        writer.writeFloat32(player.speed);
        writer.writeUint32(character.flags);
        writer.writeUint32(player.flags);

        return license;
    }

    writeAll(players) {
        if (this.#closed) return;

        const timestamp = Math.floor(Date.now() / 1000),
            active = {};

        for (const player of players) {
            const license = this.#write(timestamp, player);

            if (license) {
                active[license] = true;
            }
        }

        for (const license in this.#writers) {
            if (!active[license]) {
                const writer = this.#writers[license];

                writer.close();

                delete this.#writers[license];
            }
        }
    }

    close() {
        if (this.#closed) return;

        this.#closed = true;

        for (const license in this.#writers) {
            const writer = this.#writers[license];

            writer.close();
        }
    }
};

export function getHistoryPath(server, timestamp, license = null) {
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    return `./history/${server}/${date}` + (license ? `/${license}` : "");
}

export function writeHistory(server, players) {
    if (!bin) {
        bin = new HistoryBin(server);
    }

    bin.writeAll(players);
}

export function closeHistory() {
    if (!bin) return;

    bin.close();

    bin = null;
}

export function initializeHistory() {
    if (existsSync("./history")) return;

    mkdirSync("./history");
}

export function cleanupHistory(server) {
    const path = `./history/${server}`;

    if (!existsSync(path)) return;

    const min = new Date(Date.now() - 30 * 86400 * 1000), // 30 days
        days = readdirSync(path);

    for (const day of days) {
        const date = new Date(day);

        if (date >= min) continue;

        rmdirSync(`${path}/${day}`, {
            recursive: true
        });
    }

    setTimeout(() => {
        cleanup(server);
    }, 12 * 60 * 60 * 1000); // 12 hours
}
