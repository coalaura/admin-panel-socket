import moment from "moment";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { appendFile, mkdir, writeFile } from "fs/promises";

import { formatNumber } from "./functions.js";
import { readLastHistoricEntry } from "./history-reader.js";

let lastEntries = {};

export async function trackHistoricData(server, player) {
    const character = 'character' in player ? player.character : false;

    if (!character) {
        return;
    }

    const coords = player.coords,
        prefix = `${moment().unix()}`,
        entry = `${character.id},${formatNumber(coords.x, 1)},${formatNumber(coords.y, 1)},${formatNumber(coords.z, 1)},${formatNumber(coords.w, 1)},${character.flags},${player.flags},${player.speed.toFixed(2)}`;

    await _ensureHistoricEntry(server, player, prefix, entry);
}

async function _ensureHistoricEntry(server, player, pPrefix, pEntry) {
    const date = moment().utc().format("DD-MM-YYYY"),
        license = player.licenseIdentifier.replace("license:", "");

    const path = join("historic", server, date, license + ".csv"),
        dir = dirname(path);

    if (!existsSync(dir)) {
        await mkdir(dir, {
            recursive: true
        });
    }

    if (!existsSync(path)) {
        await writeFile(path, `Timestamp,Character ID,X,Y,Z,Heading,Character Flags,Player Flags,Speed\n${pPrefix},${pEntry}`);
    } else {
        const key = `${server}_${license}`,
            lastEntry = key in lastEntries ? lastEntries[key] : await readLastHistoricEntry(path);

        if (lastEntry) {
            lastEntries[key] = pEntry;

            if (lastEntry === pEntry) {
                pEntry = "*";
            }
        }

        await appendFile(path, `\n${pPrefix},${pEntry}`);
    }
}
