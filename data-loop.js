import config from "./_config.json" assert {type: "json"};
import { updateWorldJSON } from "./world.js";
import { updateStaffJSON } from "./staff.js";
import { countConnections, getActiveViewers } from "./client.js";
import { getServer, validateSession } from "./server.js";

import chalk from "chalk";

const lastError = {};

export function getLastServerError(pServer) {
	return lastError[pServer];
}

async function worldJSON(pServer, pDataCallback) {
    try {
        const start = Date.now(),
            clientData = await updateWorldJSON(pServer);

        const timeout = Math.max(1000 - (Date.now() - start), 500);

		lastError[pServer.server] = null;

        pDataCallback("world", pServer.server, {
            p: clientData,
            v: getActiveViewers(pServer.server, "world")
        });

        setTimeout(worldJSON, timeout, pServer, pDataCallback);
    } catch (e) {
        console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/world.json")}: ${chalk.gray(e)}`);

		lastError[pServer.server] = e;

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
        const server = getServer(config.servers[x]);

        setTimeout(worldJSON, 1000, server, pDataCallback);

        setTimeout(staffJSON, 1000, server, pDataCallback);
    }
}

export async function isValidToken(pServer, pToken) {
    if (!getServer(pServer)) {
        console.log("Invalid server: " + pServer);
        return false;
    }

    if (!pToken || !pToken.match(/^[a-z0-9]{30}$/m)) {
        console.log("no token");
        return false;
    }

    try {
        return await validateSession(pServer, pToken);
    } catch (e) {
        console.error(`${chalk.yellowBright("Failed to validate session")} ${chalk.cyanBright(pServer.server)}: ${chalk.gray(e)}`);
    }

    return false;
}

export function isValidLicense(pLicense, pNoLicenseColon) {
    if (!pNoLicenseColon) {
        pLicense = pLicense.replace("license:", "");
    }

    return pLicense.match(/^[a-z0-9]{40}$/gm);
}

export function isValidType(pType) {
    return ["world", "staff"].includes(pType);
}
