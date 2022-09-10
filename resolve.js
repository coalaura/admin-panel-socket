import moment from "moment";
import {join} from "path";
import {existsSync, readdirSync} from "fs";

import {readLines} from "./helper.js";

export async function resolveHistoricData(pServer, pSteam, pFrom, pTill) {
    const fromDate = moment.unix(pFrom).utc().format("DD-MM-YYYY"),
        tillDate = moment.unix(pTill).utc().format("DD-MM-YYYY");

    const path = join("historic", pServer, fromDate, pSteam + ".csv");

    let data = {};

    await _readHistoricFile(path, parsed => {
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
    });

    if (fromDate !== tillDate) {
        const tillPath = join("historic", pServer, tillDate, pSteam + ".csv");

        await _readHistoricFile(tillPath, parsed => {
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
        throw Error("No data for this day");
    }

    let data = {};

    const files = readdirSync(path);

    for (let x = 0; x < files.length; x++) {
        const file = files[x];

        if (file && file.endsWith(".csv")) {
            let previousLine = false;

            await readLines(join(path, file), (line) => {
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

                    if (parsed) {
                        if (parsed.timestamp === pTimestamp) {
                            data[file.replace(".csv", "")] = {
                                x: parsed.x,
                                y: parsed.y,
                                i: _isInvisible(parsed.flags)
                            };

                            return false;
                        } else if (parsed.timestamp > pTimestamp) {
                            return false;
                        }
                    }
                }
            });
        }
    }

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