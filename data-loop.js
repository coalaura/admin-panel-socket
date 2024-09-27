import chalk from "chalk";

import { updateWorldJSON, checkIfServerIsUp } from "./data.js";
import { updateStaffJSON } from "./staff.js";
import { getServers, getServerByName } from "./server.js";
import { trackAverage } from "./average.js";

let lastErrors = {};

export function getLastServerError(server) {
	return lastErrors[server];
}

async function worldJSON(serverName) {
    const server = getServerByName(serverName);

    let timeout = 1000;

    if (!server.down && !server.failed) {
        const start = Date.now();

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

        const took = Date.now() - start;

        trackAverage("world", took);

        timeout = Math.max(0, 1000 - took);
    } else {
        timeout = 5000;
    }

    setTimeout(() => {
        worldJSON(serverName);
    }, timeout);
}

async function staffJSON(serverName) {
    const server = getServerByName(serverName);

    let timeout = 3000;

    if (!server.down && !server.failed) {
        const start = Date.now();

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

        const took = Date.now() - start;

        trackAverage("staff", took);

        timeout = Math.max(0, 3000 - took);
    } else {
        timeout = 5000;
    }

    setTimeout(() => {
        staffJSON(serverName);
    }, timeout);
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

        setTimeout(() => {
            worldJSON(serverName);
        }, 2000);

        setTimeout(() => {
            staffJSON(serverName);
        }, 3000);
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
