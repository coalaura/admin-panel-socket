import chalk from "chalk";

import { updateWorldJSON, checkIfServerIsUp } from "./data.js";
import { updateStaffJSON } from "./staff.js";
import { getServers, getServerByName } from "./server.js";

let lastErrors = {};

export function getLastServerError(server) {
	return lastErrors[server];
}

async function worldJSON(serverName) {
    const server = getServerByName(serverName);

    if (!server.down && !server.failed) {
        try {
            const clientData = await updateWorldJSON(server);

            lastErrors[server.server] = null;

            process.send({
                type: "world",
                data: {
                    p: clientData.players,
                    i: clientData.instance || false
                }
            });
        } catch (e) {
            server.down = true;
            server.downError = e.message;

            console.error(`${chalk.yellowBright("Failed to load world.json")} ${chalk.cyanBright(String(server.url))}: ${chalk.gray(e)}`);

            lastErrors[server.server] = e;
        }
    }
}

async function staffJSON(serverName) {
    const server = getServerByName(serverName);

    if (!server.down && !server.failed) {
        try {
            const clientData = await updateStaffJSON(server);

            process.send({
                type: "staff",
                data: clientData
            });
        } catch (e) {
            server.down = true;
            server.downError = e.message;

            console.error(`${chalk.yellowBright("Failed to load staffChat.json")} ${chalk.cyanBright(String(server.url))}: ${chalk.gray(e)}`);

            lastErrors[server.server] = e;
        }
    }
}

async function downChecker(serverName) {
    const server = getServerByName(serverName),
        info = await checkIfServerIsUp(server);

    if (info) {
        server.info = info;

        if (server.down) {
            console.error(`${chalk.greenBright("Server back up")} ${chalk.cyanBright(server.server)}`);

            server.down = false;
            server.downError = null;
        }
    }
}

export function initDataLoop() {
    const servers = getServers();

    for (const serverName in servers) {
        // Stagger
        runIntervalDelayed(() => {
            downChecker(serverName);
        }, 1000, 10000);

        runIntervalDelayed(() => {
            worldJSON(serverName);
        }, 2000, 1000);

        runIntervalDelayed(() => {
            staffJSON(serverName);
        }, 3000, 3000);
    }
}

export function isValidType(type) {
    return type && ["world", "staff"].includes(type);
}

function runIntervalDelayed(fn, delay, interval) {
    setTimeout(() => {
        fn();

        setInterval(fn, interval);
    }, delay);
}
