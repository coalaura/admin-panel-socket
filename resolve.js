import moment from "moment";
import {join, basename} from "path";
import {existsSync} from "fs";

import {findFiles, readLines} from "./helper.js";

export async function resolveHistoricData(pServer, pLicense, pFrom, pTill) {
    if (pTill < pFrom) {
        throw Error("From must be before till");
    }

    const fromDate = moment.unix(pFrom).utc().format("DD-MM-YYYY"),
        tillDate = moment.unix(pTill).utc().format("DD-MM-YYYY");

    const path = join("historic", pServer, fromDate, pLicense + ".csv");

    let data = {};

    await _readHistoricFile(path, parsed => {
        if (parsed && parsed.timestamp >= pFrom) {
            if (parsed.timestamp > pTill) {
                return false;
            }

            const flags = _parseCharacterFlags(parsed.flags);

            if (!flags.spawned) {
                return;
            }

            data[parsed.timestamp] = {
                x: parsed.x,
                y: parsed.y,
                z: parsed.z,
                s: parsed.speed || 0,
                i: flags.invisible,
                c: flags.invincible,
                f: flags.frozen,
                d: flags.dead
            };
        }
    });

    if (fromDate !== tillDate) {
        const tillPath = join("historic", pServer, tillDate, pLicense + ".csv");

        await _readHistoricFile(tillPath, parsed => {
            if (parsed && parsed.timestamp >= pFrom) {
                if (parsed.timestamp > pTill) {
                    return false;
                }

                const flags = _parseCharacterFlags(parsed.flags);

                if (!flags.spawned) {
                    return;
                }

                data[parsed.timestamp] = {
                    x: parsed.x,
                    y: parsed.y,
                    z: parsed.z,
                    i: flags.invisible,
                    c: flags.invincible,
                    f: flags.frozen,
                    d: flags.dead
                };
            }
        });
    }

    if (Object.values(data).length === 0) {
        throw Error("No data for the selected period");
    }

    return data;
}

async function _readHistoricFile(pPath, pCallback) {
    if (!existsSync(pPath)) {
        return;
    }

    let previousLine = false;

    await readLines(pPath, (line) => {
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

            return pCallback(parsed);
        }
    });
}

export async function resolveTimestamp(pServer, pTimestamp) {
    const date = moment.unix(pTimestamp).utc().format("DD-MM-YYYY");

    const path = join("historic", pServer, date);

    if (!existsSync(path)) {
        throw Error("No data for this timestamp");
    }

    let data = {};

    const addParsedEntry = (pFile, pParsed) => {
        if (pParsed) {
            if (pParsed.timestamp === pTimestamp) {
                pFile = basename(pFile);

                const flags = _parseCharacterFlags(pParsed.flags);

                if (flags.spawned) {
                    data[pFile.replace(".csv", "")] = {
                        x: pParsed.x,
                        y: pParsed.y,
                        z: pParsed.z,
                        s: pParsed.speed || 0,
                        i: flags.invisible,
                        c: flags.invincible,
                        f: flags.frozen,
                        d: flags.dead
                    };
                }

                return false;
            } else if (pParsed.timestamp > pTimestamp) {
                return false;
            }
        }
    };

    const files = findFiles(path, pTimestamp);

    for (let x = 0; x < files.length; x++) {
        const file = files[x];

        if (file.content.endsWith("*")) {
            let previousLine = false;

            await readLines(file.file, (line) => {
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

                    return addParsedEntry(file.file, parsed);
                }
            });
        } else {
            const parsed = _parseHistoricEntry(file.content);

            addParsedEntry(file.file, parsed);
        }
    }

    if (Object.values(data).length === 0) {
        throw Error("No data for this timestamp");
    }

    return data;
}

function _parseCharacterFlags(pFlags) {
    pFlags = pFlags ? pFlags : 0;

    return {
        spawned: !!(pFlags & 64),
        frozen: !!(pFlags & 32),
        invincible: !!(pFlags & 16),
        invisible: !!(pFlags & 8),
        shell: !!(pFlags & 4),
        trunk: !!(pFlags & 2),
        dead: !!(pFlags & 1)
    }
}

function _parseHistoricEntry(pLine) {
    const regex = /^(\d+),(\d+),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(\d+),(\d+)(,\d+)?$/gm,
        match = pLine.matchAll(regex).next(),
        value = match && match.value ? match.value : false;

    if (value) {
        const speed = match[13]?.substr(1) || "0";

        return {
            timestamp: parseInt(value[1]),
            cid: parseInt(value[2]),
            x: parseFloat(value[3]),
            y: parseFloat(value[5]),
            z: parseFloat(value[7]),
            heading: parseFloat(value[9]),
            speed: parseInt(speed),
            flags: parseInt(value[11]),
            userFlags: parseInt(value[12])
        };
    } else {
        console.log("Failed to parse line `" + pLine + "`");
    }

    return false;
}
