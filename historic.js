import {formatNumber, readLastHistoricEntry} from "./helper.js";

import moment from "moment";
import {join, dirname} from "path";
import {existsSync, mkdirSync, writeFileSync, appendFileSync} from "fs";

const LastEntries = {};

export async function trackHistoricData(pServer, pPlayer) {
    const character = 'character' in pPlayer ? pPlayer.character : false;
    if (!character) {
        return;
    }

    const coords = pPlayer.coords,
        prefix = `${moment().unix()}`,
        entry = `${character.id},${formatNumber(coords.x, 1)},${formatNumber(coords.y, 1)},${formatNumber(coords.z, 1)},${formatNumber(pPlayer.heading, 1)},${character.flags},${pPlayer.flags}`;

    await _ensureHistoricEntry(pServer, pPlayer, prefix, entry);
}

async function _ensureHistoricEntry(pServer, pPlayer, pPrefix, pEntry) {
    const date = moment().utc().format("DD-MM-YYYY"),
        steam = pPlayer.steamIdentifier.replace("steam:", "");

    const path = join("historic", pServer.server, date, steam + ".csv"),
        dir = dirname(path);

    if (!existsSync(dir)) {
        mkdirSync(dir, {
            recursive: true
        });
    }

    if (!existsSync(path)) {
        writeFileSync(path, `Timestamp,Character ID,X,Y,Z,Heading,Flags\n${pPrefix},${pEntry}`);
    } else {
        const key = `${pServer.server}_${steam}`,
            lastEntry = key in LastEntries ? LastEntries[key] : await readLastHistoricEntry(path);

        if (lastEntry) {
            LastEntries[key] = pEntry;

            if (lastEntry === pEntry) {
                pEntry = "*";
            }
        }

        appendFileSync(path, `\n${pPrefix},${pEntry}`);
    }
}
