import { updateWorldJSON } from "./world.js";
import { updateStaffJSON } from "./staff.js";
import { countConnections, getActiveViewers } from "./client.js";
import { getServer, validateSession, getServers } from "./server.js";

import chalk from "chalk";

const lastError = {},
	lastWait = {};

export function getLastServerError(pServer) {
	return lastError[pServer];
}

function _getDelay(pServer) {
	let delay = 10000;

	if (pServer.server in lastWait) {
		delay = Math.min(lastWait[pServer.server] * 3, 30 * 60 * 1000);
	}

	lastWait[pServer.server] = delay;

	return delay;
}

async function worldJSON(pServer, pDataCallback) {
    try {
        const start = Date.now(),
            clientData = await updateWorldJSON(pServer);

        const timeout = Math.max(1000 - (Date.now() - start), 500);

		lastError[pServer.server] = null;
		lastWait[pServer.server] = null;

        pDataCallback("world", pServer.server, {
            p: clientData,
            v: getActiveViewers(pServer.server, "world")
        });

        setTimeout(worldJSON, timeout, pServer, pDataCallback);
    } catch (e) {
		const delay = _getDelay(pServer.server);

        console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/world.json")} (${chalk.gray(Math.floor(delay / 1000))}s): ${chalk.gray(e)}`);

		lastError[pServer.server] = e;

        setTimeout(worldJSON, delay, pServer, pDataCallback);
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
		const delay = _getDelay(pServer.server);

        console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/staffChat.json")} (${chalk.gray(Math.floor(delay / 1000))}s): ${chalk.gray(e)}`);

        setTimeout(staffJSON, delay, pServer, pDataCallback);
    }
}

export function init(pDataCallback) {
	const servers = getServers();

    for (const name in servers) {
        const server = servers[name];

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
