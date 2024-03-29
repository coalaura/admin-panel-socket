import { v4 } from "uuid";
import pako from "pako";
import chalk from "chalk";
import { pack } from "msgpackr";

import { getLastServerError } from "./data-loop.js";

let connections = {};

export function handleConnection(pClient, pServer, pType, pLicense) {
    const self = {
        id: v4(),
        client: pClient,
        server: pServer,
        type: pType,
        license: pLicense,

        paused: false
    };

    connections[self.id] = self;

    console.log(`${chalk.greenBright("Connected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`);

    self.client.on("disconnect", () => {
        delete connections[self.id];

        console.log(`${chalk.redBright("Disconnected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`);
    });

    const error = getLastServerError(pServer);

    if (error) {
        const data = _prepareData({
            error: error
        });

        self.client.emit("message", Uint8Array.from(data).buffer);
    }

    self.client.on("pause", pPause => {
        self.paused = pPause;

        if (self.paused) {
            console.log(`${chalk.yellowBright("Paused")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)}`);
        } else {
            console.log(`${chalk.greenBright("Resumed")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)}`);
        }
    });
}

export function getActiveViewers(pServer, pType) {
    let viewers = [];

    for (const id in connections) {
        if (Object.hasOwnProperty(id)) continue;

        const client = connections[id];

        if (client.type === pType && client.server === pServer && !viewers.includes(client.license)) {
            viewers.push(client.license);
        }
    }

    return viewers;
}

export function handleDataUpdate(pType, pServer, pData) {
    pData = _prepareData(pData);

    for (const id in connections) {
        if (Object.hasOwnProperty(id)) continue;

        const client = connections[id];

        if (!client.paused && client.type === pType && client.server === pServer) {
            client.client.emit("message", Uint8Array.from(pData).buffer);
        }
    }
}

export function countConnections(pServer, pType) {
    let total = 0;

    for (const id in connections) {
        if (Object.hasOwnProperty(id)) continue;

        const client = connections[id];

        if (client.type === pType && client.server === pServer) {
            total++;
        }
    }

    return total;
}

export function isAlreadyConnected(pServer, pType, pLicense) {
    for (const id in connections) {
        if (Object.hasOwnProperty(id)) continue;

        const client = connections[id];

        if (client.type === pType && client.server === pServer && client.license === pLicense) {
            return true;
        }
    }

    return false;
}

function _prepareData(pData) {
    const serialized = pack(pData);

    return pako.gzip(serialized);
}
