import { formatNumber } from "./functions.js";

export function compressPlayer(player, dutyMap) {
    const character = player.character,
        vehicle = player.vehicle;

    const license = player.licenseIdentifier,
        duty = license in dutyMap ? dutyMap[license] : false;

    return {
        a: player.afkSince,
        b: character ? {
            a: character.flags,
            b: character.fullName,
            c: character.id
        } : false,
        c: _movementData(player),
        d: player.flags,
        e: duty ? {
            a: duty.type,
            b: duty.department
        } : false,
        f: player.name,
        g: player.source,
        h: license,
        i: vehicle ? {
            a: vehicle.driving,
            b: vehicle.id,
            c: vehicle.model
        } : false,
        j: player.instanceId
    };
}

function _movementData(player) {
    const coords = player.coords;

    if (!coords) {
        return false;
    }

    const x = formatNumber(coords.x, 1),
        y = formatNumber(coords.y, 1),
        z = formatNumber(coords.z, 1),
        h = formatNumber(coords.w, 1);

    let data = `${x},${y},${z},${h}`;

    if (player.speed > 0) {
        data += "," + formatNumber(player.speed, 1);
    }

    return data;
}