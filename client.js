import {v4} from "uuid";
import pako from "pako";
import chalk from "chalk";

let connections = {};

export function handleConnection(pClient, pServer, pType) {
    const self = {
        id: v4(),
        client: pClient,
        server: pServer,
        type: pType
    };

    connections[self.id] = self;

    console.log(`${chalk.greenBright("Connected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`);

    self.client.on("disconnect", () => {
        delete connections[self.id];

        console.log(`${chalk.redBright("Disconnected")} ${chalk.gray("{" + self.id + "}")} ${chalk.cyanBright(self.server + "/" + self.type)} - ${chalk.black(chalk.bgYellow(countConnections(self.server, self.type)))}`);
    });
}

export function handleDataUpdate(pType, pServer, pData) {
    pData = _prepareData(pData);

    for (const id in connections) {
        if (Object.hasOwnProperty(id)) continue;

        const client = connections[id];

        if (client.type === pType && client.server === pServer) {
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

function _prepareData(pData) {
    const json = JSON.stringify(pData);

    return pako.gzip(json);
}