import {init, isValidToken, isValidType} from "./data-loop.js";
import {handleConnection, handleDataUpdate} from "./client.js";

import {createServer} from "http";
import {Server} from "socket.io";

init(handleDataUpdate);

const io = new Server(createServer(), {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", client => {
    const query = client.handshake.query;

    if (!('server' in query) || !('token' in query) || !('type' in query) || !isValidToken(query.server, query.token) || !isValidType(query.type)) {
        client.disconnect(true);

        console.log(`Rejected connection from [${client.handshake.address}]`);

        return;
    }

    handleConnection(client, query.server, query.type);
});

io.listen(9999);

console.log("Listening for sockets...");