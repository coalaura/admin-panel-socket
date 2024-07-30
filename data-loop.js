import chalk from "chalk";

import { updateWorldJSON, checkIfServerIsUp } from "./data.js";
import { updateStaffJSON } from "./staff.js";
import { getServers } from "./server.js";

let lastErrors = {};

export function getLastServerError(server) {
	return lastErrors[server];
}

async function worldJSON(server) {
    if (!server.down && !server.failed) {
        try {
            const clientData = await updateWorldJSON(server);

            lastErrors[server.server] = null;

            process.send({
                type: "world",
                server: server.server,
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

            console.error(`${chalk.yellowBright("Failed to load staffChat.json")} ${chalk.cyanBright(String(server.url))}: ${chalk.gray(e)}`);

            lastErrors[server.server] = e;
        }
    }
}

async function downChecker(server) {
    const isUp = await checkIfServerIsUp(server);

    if (server.down && isUp) {
        console.error(`${chalk.greenBright("Server back up")} ${chalk.cyanBright(server.server)}`);

        server.down = false;
        server.downError = null;
    }
}

export function initDataLoop() {
    const servers = getServers();

    for (const serverName in servers) {
        const server = servers[serverName];

        // Stagger
        runIntervalDelayed(() => {
            downChecker(server);
        }, 1000, 10000);

        runIntervalDelayed(() => {
            worldJSON(server);
        }, 2000, 1000);

        runIntervalDelayed(() => {
            staffJSON(server);
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
