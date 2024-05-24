import chalk from "chalk";

import { updateWorldJSON, checkIfServerIsUp } from "./data.js";
import { updateStaffJSON } from "./staff.js";
import { getServers } from "./server.js";

let lastErrors = {};

export function getLastServerError(server) {
	return lastErrors[server];
}

async function worldJSON(server) {
    let timeout = 1000;

    if (!server.down && !server.failed) {
        try {
            const start = Date.now(),
                clientData = await updateWorldJSON(server);

            lastErrors[server.server] = null;

            process.send({
                type: "world",
                server: server.server,
                data: {
                    p: clientData.players,
                    i: clientData.instance || false
                }
            })

            timeout = Math.max(1000 - (Date.now() - start), 1);
        } catch (e) {
            server.down = true;
            server.downError = e.message;

            console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(server.server + "/world.json")}: ${chalk.gray(e)}`);

            server.log(`Failed loading /world.json: ${e.message}`);

            lastErrors[server.server] = e;
        }
    }

    setTimeout(worldJSON, timeout, server);
}

async function staffJSON(server) {
    if (!server.down && !server.failed) {
        try {
            const clientData = await updateStaffJSON(server);

            process.send({
                type: "staff",
                server: server.server,
                data: clientData
            });
        } catch (e) {
            server.down = true;
            server.downError = e.message;

            console.error(`${chalk.yellowBright("Failed to load")} ${chalk.cyanBright(server.server + "/staffChat.json")}: ${chalk.gray(e)}`);

            server.log(`Failed loading /staffChat.json: ${e.message}`);

            lastErrors[server.server] = e;
        }
    }

    setTimeout(staffJSON, 3000, server);
}

async function downChecker(server) {
    const isUp = await checkIfServerIsUp(server);

    if (server.down && isUp) {
        console.error(`${chalk.greenBright("Server back up")} ${chalk.cyanBright(server.server)}`);

        server.down = false;
        server.downError = null;
    }

    setTimeout(downChecker, 10000, server);
}

export function initDataLoop() {
    const servers = getServers();

    for (const serverName in servers) {
        const server = servers[serverName];

        setTimeout(worldJSON, 1000, server);
        setTimeout(staffJSON, 1000, server);

        downChecker(server);
    }
}

export function isValidType(type) {
    return type && ["world", "staff"].includes(type);
}
