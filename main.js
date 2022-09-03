import {init, isValidToken, isValidType} from "./data-loop.js";
import {handleConnection, handleDataUpdate} from "./client.js";
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

    if (!('server' in query) || !('token' in query) || !('type' in query) || !isValidToken(query.server, query.token) || !isValidType(query.type)) {
        client.disconnect(true);

        console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + client.handshake.address)}`);

        return;
    }

    handleConnection(client, query.server, query.type);
});

server.listen(9999, () => {
    console.log(chalk.blueBright("Listening for sockets..."));
});
