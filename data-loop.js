import config from "./_config.json" assert {type: "json"};
import {updateWorldJSON} from "./world.js";
import {updateStaffJSON} from "./staff.js";
import {countConnections, getActiveViewers} from "./client.js";

import {join as pathJoin} from "path";
import {existsSync, readFileSync} from "fs";
import chalk from "chalk";

async function worldJSON(pServer, pDataCallback) {
    try {
        const clientData = await updateWorldJSON(pServer);

        pDataCallback("world", pServer.server, {
            p: clientData,
            v: getActiveViewers(pServer.server, "world")
        });

        setTimeout(worldJSON, 1000, pServer, pDataCallback);
    } catch (e) {
        console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/world.json")}: ${chalk.gray(e)}`);

        setTimeout(worldJSON, 10000, pServer, pDataCallback);
    }
}

async function staffJSON(pServer, pDataCallback) {
    try {
        if (countConnections(pServer.server, "staff") > 0) {
            const clientData = await updateStaffJSON(pServer);

            pDataCallback("staff", pServer.server, clientData);
        }

        setTimeout(staffJSON, 3000, pServer, pDataCallback);
    } catch (e) {
        console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/staffChat.json")}: ${chalk.gray(e)}`);

        setTimeout(staffJSON, 10000, pServer, pDataCallback);
    }
}

export function init(pDataCallback) {
    for (let x = 0; x < config.servers.length; x++) {
        setTimeout(worldJSON, 1000, config.servers[x], pDataCallback);

        setTimeout(staffJSON, 1000, config.servers[x], pDataCallback);
    }
}

function getClusterFromServer(pServer) {
    return pServer.replace("s1", "");
}

export function isValidToken(pServer, pToken) {
    if (!_isValidServer(pServer)) {
        return false;
    }

    if (!pToken || !pToken.match(/^[a-z0-9]{30}$/m)) {
        return false;
    }

    const sessionFile = pathJoin(config.panel, "storage", "framework", "session_storage", getClusterFromServer(pServer) + pToken + ".session");

    if (!existsSync(sessionFile)) {
        return false;
    }

    try {
        const contents = readFileSync(sessionFile);

        if (contents) {
            const data = JSON.parse(contents.toString());

            return data && 'user' in data && data.user;
        }
    } catch (e) {
    }

    return false;
}

export function isValidSteam(pSteam, pNoSteamColon) {
    if (!pNoSteamColon) {
        pSteam = pSteam.replace("steam:", "");
    }

    return pSteam.match(/^[a-z0-9]{15}$/gm);
}

export function isValidType(pType) {
    return ["world", "staff"].includes(pType);
}

function _isValidServer(pServer) {
    for (let x = 0; x < config.servers.length; x++) {
        const server = config.servers[x];

        if (server.server === pServer) {
            return true;
        }
    }

    return false;
}
