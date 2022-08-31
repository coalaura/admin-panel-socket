import {requestOpFwApi} from "./http.js";
import {formatNumber} from "./helper.js";
import {loadOnDutyData} from "./duty.js";

export async function updateWorldJSON(pServer) {
    const dutyMap = await loadOnDutyData(pServer);

    const data = await requestOpFwApi(`https://${"url" in pServer ? pServer.url : pServer.server + ".op-framework.com"}/op-framework/world.json`, pServer.token);

    let clientData = [];
    for (let x = 0; x < data.players.length; x++) {
        clientData.push(_compressPlayer(data.players[x], dutyMap));
    }

    return clientData;
}

function _compressPlayer(pPlayer, pDutyMap) {
    const character = pPlayer.character,
        vehicle = pPlayer.vehicle;

    const steam = pPlayer.steamIdentifier,
        duty = steam in pDutyMap ? pDutyMap[steam] : false;

    return _cleanup({
        a: pPlayer.afkSince,
        b: character ? _cleanup({
            a: character.flags,
            b: character.fullName,
            c: character.id
        }) : false,
        c: _movementData(pPlayer),
        d: pPlayer.flags,
        e: duty ? _cleanup({
            a: duty.type,
            b: duty.department
        }) : false,
        f: pPlayer.name,
        g: pPlayer.source,
        h: steam,
        i: vehicle ? _cleanup({
            a: vehicle.driving,
            b: vehicle.id,
            c: vehicle.model
        }) : false,
        j: pPlayer.instanceId
    });
}

function _movementData(pPlayer) {
    const coords = pPlayer.coords;

    if (!coords) {
        return false;
    }

    const x = formatNumber(coords.x, 1),
        y = formatNumber(coords.y, 1),
        z = formatNumber(coords.z, 1),
        h = formatNumber(pPlayer.heading, 1);

    let data = `${x},${y},${z},${h}`;

    if (pPlayer.speed > 0) {
        data += "," + formatNumber(pPlayer.speed, 1);
    }

    return data;
}

function _cleanup(pObject) {
    for (const key in pObject) {
        if (Object.hasOwnProperty(key)) continue;

        const value = pObject[key];

        if (value === false || value === 0 || value === "" || value === undefined) {
            delete pObject[key];
        }
    }

    return pObject;
}