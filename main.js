import {init, isValidSteam, isValidToken, isValidType} from "./data-loop.js";
import {handleConnection, handleDataUpdate, isAlreadyConnected} from "./client.js";
import {initRoutes} from "./routes.js";

import express from "express";
import {createServer} from "http";
import {Server} from "socket.io";
import chalk from 'chalk';
import cors from "cors";

init(handleDataUpdate);

const app = express(),
    server = createServer(app);

app.use(cors({
    origin: '*'
}));

initRoutes(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", client => {
    const query = client.handshake.query;

    if (!('server' in query) || !('token' in query) || !('type' in query) || !('steam' in query) || !isValidToken(query.server, query.token) || !isValidType(query.type) || !isValidSteam(query.steam)) {
        client.disconnect(true);

        console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + client.handshake.address)}`);

        return;
    } else if (isAlreadyConnected(query.server, query.type, query.steam)) {
        client.disconnect(true);

        console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + client.handshake.address + " (already connected)")}`);

        return;
    }

    handleConnection(client, query.server, query.type, query.steam);
});

server.listen(9999, () => {
    console.log(chalk.blueBright("Listening for sockets..."));
});
