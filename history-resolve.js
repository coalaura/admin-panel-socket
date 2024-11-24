import { range, single } from "./clickhouse.js";

export async function resolveHistoricData(server, license, from, till) {
    if (till < from) {
        throw Error("From must be before till");
    }

    const data = await range(server, license, from, till);

    if (data.length === 0) {
        throw Error("No data for the selected period");
    }

    let result = {};

    for (const entry of data) {
        result[entry.timestamp] = minifyHistoricEntry(entry);
    }

    return result;
}

export async function resolveTimestampData(server, timestamp) {
    const data = await single(server, timestamp);

    if (data.length === 0) {
        throw Error("No data for this timestamp");
    }

    let result = {};

    for (const entry of data) {
        result[entry.license] = minifyTimestampEntry(entry);
    }

    return result;
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
