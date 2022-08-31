import {init, isValidToken, isValidType} from "./data-loop.js";
import {handleConnection, handleDataUpdate} from "./client.js";

import {createServer} from "http";
import {Server} from "socket.io";
import chalk from 'chalk';

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

        console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + client.handshake.address)}`);

        return;
    }

    handleConnection(client, query.server, query.type);
});

io.listen(9999);

console.log(chalk.blueBright("Listening for sockets..."));