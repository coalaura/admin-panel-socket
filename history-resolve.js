import moment from "moment";
import { join, basename } from "path";
import { existsSync } from "fs";

import { findFiles, readLines } from "./history-reader.js";

export async function resolveHistoricData(server, license, from, till) {
    if (till < from) {
        throw Error("From must be before till");
    }

    const fromDate = moment.unix(from).utc().format("DD-MM-YYYY"),
        tillDate = moment.unix(till).utc().format("DD-MM-YYYY");

    const path = join("historic", server, fromDate, license + ".csv");

    let data = {};

    await _readHistoricFile(path, parsed => {
        if (parsed && parsed.timestamp >= from) {
            if (parsed.timestamp > till) {
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
        const tillPath = join("historic", server, tillDate, license + ".csv");

        await _readHistoricFile(tillPath, parsed => {
            if (parsed && parsed.timestamp >= from) {
                if (parsed.timestamp > till) {
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

async function _readHistoricFile(path, callback) {
    if (!existsSync(path)) {
        return;
    }

    let previousLine = false;

    await readLines(path, line => {
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

            return callback(parsed);
        }
    });
}

export async function resolveTimestamp(server, timestamp) {
    const date = moment.unix(timestamp).utc().format("DD-MM-YYYY");

    const path = join("historic", server, date);

    if (!existsSync(path)) {
        throw Error("No data for this timestamp");
    }

    let data = {};

    const addParsedEntry = (file, parsed) => {
        if (parsed) {
            if (parsed.timestamp === timestamp) {
                file = basename(file);

                const flags = _parseCharacterFlags(parsed.flags);

                if (flags.spawned) {
                    data[file.replace(".csv", "")] = {
                        _: parsed.cid,
                        x: parsed.x,
                        y: parsed.y,
                        z: parsed.z,

                        h: parsed.heading,
                        s: parsed.speed,

                        cf: parsed.flags,
                        uf: parsed.userFlags
                    };
                }

                return false;
            } else if (parsed.timestamp > timestamp) {
                return false;
            }
        }
    };

    const files = findFiles(path, timestamp);

    for (let x = 0; x < files.length; x++) {
        const file = files[x];

        if (file.content.endsWith("*")) {
            let previousLine = false;

            await readLines(file.file, line => {
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

function _parseCharacterFlags(flags) {
    flags = flags ? flags : 0;

    return {
        spawned: !!(flags & 64),
        frozen: !!(flags & 32),
        invincible: !!(flags & 16),
        invisible: !!(flags & 8),
        shell: !!(flags & 4),
        trunk: !!(flags & 2),
        dead: !!(flags & 1)
    }
}

function _parseHistoricEntry(line) {
    const regex = /^(\d+),(\d+),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(\d+),(\d+),(\d+(\.\d+)?)$/gm,
        match = line.matchAll(regex).next(),
        value = match && match.value ? match.value : false;

    if (value) {
        return {
            timestamp: parseInt(value[1]),
            cid: parseInt(value[2]),
            x: parseFloat(value[3]),
            y: parseFloat(value[5]),
            z: parseFloat(value[7]),
            heading: parseFloat(value[9]),
            speed: parseFloat(value[13]),
            flags: parseInt(value[11]),
            userFlags: parseInt(value[12])
        };
    } else {
        console.log("Failed to parse line `" + line + "`");
    }

    return false;
}
