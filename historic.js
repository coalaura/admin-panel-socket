import {formatNumber, readLastHistoricEntry, readLines} from "./helper.js";

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

export async function resolveHistoricData(pServer, pSteam, pFrom, pTill) {
    const fromDate = moment.unix(pFrom).utc().format("DD-MM-YYYY"),
        tillDate = moment.unix(pTill).utc().format("DD-MM-YYYY");

    if (fromDate !== tillDate) {
        throw Error("From and till have to be on the same day");
    }

    const path = join("historic", pServer, fromDate, pSteam + ".csv");

    if (!existsSync(path)) {
        throw Error("No data for this day");
    }

    let data = {},
        previousLine = false;

    await readLines(path, (line) => {
        if (line && !line.startsWith("Timestamp")) {
            if (line.endsWith("*")) {
                const split = line.split(",");

                line = previousLine;

                line[0] = split[0];

                line = line.join(",");
            } else {
                previousLine = line.split(",");
            }

            const parsed = _parseHistoricEntry(line);

            if (parsed && parsed.timestamp >= pFrom) {
                if (parsed.timestamp > pTill) {
                    return false;
                }

                data[parsed.timestamp] = {
                    x: parsed.x,
                    y: parsed.y,
                    i: _isInvisible(parsed.flags)
                };
            }
        }
    });

    if (Object.values(data).length === 0) {
        throw Error("No data for this day");
    }

    return data;
}

function _isInvisible(pFlags) {
    pFlags = pFlags ? pFlags : 0;

    const invisible = pFlags / 8 >= 1
    if (invisible) {
        pFlags -= 8
    }

    const shell = pFlags / 4 >= 1
    if (shell) {
        pFlags -= 4
    }

    const trunk = pFlags / 2 >= 1

    return invisible && !trunk && !shell;
}

function _parseHistoricEntry(pLine) {
    const regex = /^(\d+),(\d+),(-?\d+\.?\d+),(-?\d+\.?\d+),(-?\d+\.?\d+),(-?\d+\.?\d+),(\d+),(\d+)$/gm,
        match = pLine.matchAll(regex).next(),
        value = match && match.value ? match.value : false;

    if (value) {
        return {
            timestamp: parseInt(value[1]),
            cid: parseInt(value[2]),
            x: parseFloat(value[3]),
            y: parseFloat(value[4]),
            z: parseFloat(value[5]),
            heading: parseFloat(value[6]),
            flags: parseInt(value[7]),
            userFlags: parseInt(value[8])
        };
    }

    return false;
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
