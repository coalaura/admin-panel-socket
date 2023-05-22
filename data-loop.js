import { updateWorldJSON, checkIfServerIsUp } from "./world.js";
import { updateStaffJSON } from "./staff.js";
import { countConnections, getActiveViewers } from "./client.js";
import { getServer, validateSession, getServers } from "./server.js";

import chalk from "chalk";

const lastError = {};

export function getLastServerError(pServer) {
	return lastError[pServer];
}

async function worldJSON(pServer, pDataCallback) {
    let timeout = 1000;

    if (!pServer.down && !pServer.failed) {
        try {
            const start = Date.now(),
                clientData = await updateWorldJSON(pServer);

            timeout = Math.max(1000 - (Date.now() - start), 250);

            lastError[pServer.server] = null;

            pDataCallback("world", pServer.server, {
                p: clientData.players,
                i: clientData.instance || false,
                v: getActiveViewers(pServer.server, "world")
            });
        } catch (e) {
            pServer.down = true;

            console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/world.json")}: ${chalk.gray(e)}`);

            lastError[pServer.server] = e;
        }
    }

    setTimeout(worldJSON, timeout, pServer, pDataCallback);
}

async function staffJSON(pServer, pDataCallback) {
    if (!pServer.down && !pServer.failed) {
        try {
            if (countConnections(pServer.server, "staff") > 0) {
                const clientData = await updateStaffJSON(pServer);

                pDataCallback("staff", pServer.server, clientData);
            }
        } catch (e) {
            pServer.down = true;

            console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(pServer.server + "/staffChat.json")}: ${chalk.gray(e)}`);

            lastError[pServer.server] = e;
        }
    }

    setTimeout(staffJSON, 3000, pServer, pDataCallback);
}

async function downChecker(pServer) {
    if (pServer.down) {
        const isUp = await checkIfServerIsUp(pServer);

        if (isUp) {
            console.error(`${chalk.greenBright("Server back up")} ${chalk.cyanBright(pServer.server)}`);

            pServer.down = false;
        }
    }

    setTimeout(downChecker, 10000, pServer);
}

export function init(pDataCallback) {
	const servers = getServers();

    for (const name in servers) {
        const server = servers[name];

        setTimeout(worldJSON, 1000, server, pDataCallback);

        setTimeout(staffJSON, 1000, server, pDataCallback);

        setTimeout(downChecker, 10000, server);
    }
}

export async function isValidToken(pServer, pToken) {
    if (!getServer(pServer)) {
        console.log("Invalid server: '" + pServer + "'");
        return false;
    }

    if (!pToken || !pToken.match(/^[a-z0-9]{30}$/m)) {
        console.log("no token");
        return false;
    }

    try {
        return await validateSession(pServer, pToken);
    } catch (e) {
        console.error(`${chalk.yellowBright("Failed to validate session")} ${chalk.cyanBright(pServer)}: ${chalk.gray(e)}`);
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
