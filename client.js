import {v4} from "uuid";
import pako from "pako";

let connections = {};

export function handleConnection(pClient, pServer, pType) {
    const self = {
        id: v4(),
        client: pClient,
        server: pServer,
        type: pType
    };

    console.log(`Connected {${self.id}} ${self.server}/${self.type}`);

    self.client.on("disconnect", () => {
        delete connections[self.id];

        console.log(`Connected {${self.id}} ${self.server}/${self.type}`);
    });

    connections[self.id] = self;
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

function _prepareData(pData) {
    const json = JSON.stringify(pData);

    return pako.gzip(json);
}