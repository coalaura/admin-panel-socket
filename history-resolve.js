import moment from "moment";
import { join, basename } from "path";
import { existsSync } from "fs";

import { findHistoryFilesWithTimestamp, readFileLineByLine } from "./history-reader.js";

export async function resolveHistoricData(server, license, from, till) {
    if (till < from) {
        throw Error("From must be before till");
    }

    const fromDate = moment.unix(from).utc().format("DD-MM-YYYY"),
        tillDate = moment.unix(till).utc().format("DD-MM-YYYY");

    const fromPath = join("historic", server, fromDate, license + ".csv");

    let data = {};

    await readHistoryFile(fromPath, parsed => {
        if (!parsed || parsed.timestamp < from) {
            return;
        }

        if (parsed.timestamp > till) {
            return false;
        }

        data[parsed.timestamp] = minifyHistoricEntry(parsed);
    });

    if (fromDate !== tillDate) {
        const tillPath = join("historic", server, tillDate, license + ".csv");

        await readHistoryFile(tillPath, parsed => {
            if (!parsed || parsed.timestamp < from) {
                return;
            }

            if (parsed.timestamp > till) {
                return false;
            }

            data[parsed.timestamp] = minifyHistoricEntry(parsed);
        });
    }

    if (Object.values(data).length === 0) {
        throw Error("No data for the selected period");
    }

    return data;
}

export async function resolveTimestamp(server, timestamp) {
    const date = moment.unix(timestamp).utc().format("DD-MM-YYYY"),
        path = join("historic", server, date);

    if (!existsSync(path)) {
        throw Error("No data for this timestamp");
    }

    let data = {};

    const files = findHistoryFilesWithTimestamp(path, timestamp);

    for (let x = 0; x < files.length; x++) {
        const file = files[x],
            parsed = parseHistoricEntry(file.entry);

        if (!parsed) {
            continue;
        }

        const license = basename(file.path).replace(".csv", "");

        data[license] = minifyTimestampEntry(parsed);
    }

    if (Object.values(data).length === 0) {
        throw Error("No data for this timestamp");
    }

    return data;
}

async function readHistoryFile(path, callback) {
    if (!existsSync(path)) {
        return;
    }

    await readFileLineByLine(path, line => {
        return callback(parseHistoricEntry(line));
    });
}

function parseHistoricEntry(line) {
    const regex = /^(\d+),(\d+),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),(\d+),(\d+),(\d+(\.\d+)?)$/gm,
        match = line.matchAll(regex).next(),
        value = match && match.value ? match.value : false;

    if (value) {
        return {
            timestamp: parseInt(value[1]),
            characterId: parseInt(value[2]),
            x: parseFloat(value[3]),
            y: parseFloat(value[5]),
            z: parseFloat(value[7]),
            heading: parseFloat(value[9]),
            speed: parseFloat(value[13]),
            characterFlags: parseInt(value[11]),
            userFlags: parseInt(value[12])
        };
    } else {
        console.log("Failed to parse line `" + line + "`");
    }

    return false;
}

function minifyHistoricEntry(parsed) {
    const characterFlags = parsed.characterFlags;

    return {
        x: parsed.x,
        y: parsed.y,
        z: parsed.z,
        i: !!(characterFlags & 8),
        c: !!(characterFlags & 16),
        f: !!(characterFlags & 32),
        d: !!(characterFlags & 1)
    };
}

function minifyTimestampEntry(parsed) {
    return {
        _: parsed.characterId,
        x: parsed.x,
        y: parsed.y,
        z: parsed.z,

        h: parsed.heading,
        s: parsed.speed,

        cf: parsed.characterFlags,
        uf: parsed.userFlags
    };
}
