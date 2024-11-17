import { cleanup, range, single } from "./history.js";

export function resolveHistoricData(server, license, from, till) {
    if (till < from) {
        throw Error("From must be before till");
    }

    const data = range(server, license, from, till);

    if (data.length === 0) {
        throw Error("No data for the selected period");
    }

    let result = {};

    for (const entry of data) {
        result[entry.timestamp] = minifyHistoricEntry(entry);
    }

    return result;
}

export function resolveTimestampData(server, timestamp) {
    const data = single(server, timestamp);

    if (data.length === 0) {
        throw Error("No data for this timestamp");
    }

    let result = {};

    for (const entry of data) {
        result[entry.license] = minifyTimestampEntry(entry);
    }

    return result;
}

export function cleanupHistoricData() {
    cleanup();

    setTimeout(cleanupHistoricData, 2 * 60 * 60 * 1000);
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
        d: !!(characterFlags & 1),
        s: parsed.speed
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
