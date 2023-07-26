import {requestOpFwApi} from "./http.js";
import {formatNumber} from "./helper.js";
import {loadOnDutyData} from "./duty.js";
import {trackHistoricData} from "./historic.js";
import {decompressPlayers} from "./decompressor.js";
import chalk from "chalk";

export async function updateWorldJSON(pServer) {
    const dutyMap = await loadOnDutyData(pServer);

    const data = decompressPlayers(await requestOpFwApi(`${pServer.url}/op-framework/world.json?compress=1`, pServer.token));

    let clientData = [];
    for (let x = 0; x < data.players.length; x++) {
        const player = data.players[x];

        try {
            trackHistoricData(pServer, player);
        } catch (e) {
            console.error(`${chalk.yellowBright("Failed to track historic data")}: ${chalk.gray(e)}`);
        }

        clientData.push(_compressPlayer(player, dutyMap));
    }

    pServer.players = data.players;

    return {
        players: clientData,
        instance: data.world?.instance
    };
}

export async function checkIfServerIsUp(pServer) {
    try {
        const data = await requestOpFwApi(`${pServer.url}/op-framework/uptime.json`, pServer.token);

        if (typeof data.uptime !== "number") {
            return false;
        }

        pServer.uptime = data.uptime;
    } catch (e) {
        return false;
    }
}

function _compressPlayer(pPlayer, pDutyMap) {
    const character = pPlayer.character,
        vehicle = pPlayer.vehicle;

    const license = pPlayer.licenseIdentifier,
        duty = license in pDutyMap ? pDutyMap[license] : false;

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
        h: license,
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
        h = formatNumber(coords.w, 1);

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
