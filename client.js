import { v4 } from "uuid";
import pako from "pako";
import chalk from "chalk";
import { pack } from "msgpackr";

import { getLastServerError } from "./data-loop.js";

let connections = {};

export function handleConnection(client, server, type, license) {
    const self = {
        id: v4(),
        client: client,
        server: server,
        type: type,
        license: license,

        paused: false
    };

    connections[self.id] = self;

    console.log(`${chalk.greenBright("Connected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`);

    self.client.on("disconnect", () => {
        delete connections[self.id];

        console.log(`${chalk.redBright("Disconnected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`);
    });

    const error = getLastServerError(server);

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

function getActiveViewers(server, type) {
    let viewers = [];

    for (const id in connections) {
        if (Object.prototype.hasOwnProperty.call(connections, id)) continue;

        const client = connections[id],
            license = client.license;

        if (client.type === type && client.server === server && !viewers.includes(license)) {
            viewers.push(license);
        }
    }

    return viewers;
}

export function handleDataUpdate(type, server, data) {
    // We have to add the viewer count here, since the slaves don't know about it
    if (type === "world") {
        data.v = getActiveViewers(server, "world");
    }

    data = _prepareData(data);

    for (const id in connections) {
        if (Object.prototype.hasOwnProperty.call(connections, id)) continue;

        const client = connections[id];

        if (!client.paused && client.type === type && client.server === server) {
            client.client.emit("message", Uint8Array.from(data).buffer);
        }
    }
}

export function countConnections(server, type) {
    let total = 0;

    for (const id in connections) {
        if (Object.prototype.hasOwnProperty.call(connections, id)) continue;

        const client = connections[id];

        if (client.type === type && client.server === server) {
            total++;
        }
    }

    return total;
}

function _prepareData(pData) {
    const serialized = pack(pData);

    return pako.gzip(serialized);
}
