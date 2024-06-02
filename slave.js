import cluster from "cluster";
import { Agent } from "http";
import axios from "axios";
import chalk from "chalk";

import { abort } from "./functions.js";
import { getSlaveRoutes } from "./slave-routes.js";

const routes = getSlaveRoutes();

export class Slave {
    #id;
    #agent;
    #cluster;
    #server;

    #restarts = 0;

    constructor(id, server) {
        this.#id = id;
        this.#server = server;

        this.#restart();
    }

    #init() {
        this.#agent = new Agent({
            keepAlive: true
        });

        this.#cluster = cluster.fork({
            stdio: [0, 1, 2, "ipc"],

            ID: this.#id,
            PORT: this.port,
            SERVER: this.#server
        });

        this.#cluster.on("online", () => {
            console.log(`${chalk.greenBright(`Cluster ${this.#server} online`)} ${chalk.gray("on port:")} ${chalk.cyanBright(this.port)}`);
        });

        this.#cluster.on("exit", (code, signal) => {
            if (signal) {
                console.log(`${chalk.redBright(`Cluster ${this.#server} killed`)} ${chalk.gray("by signal:")} ${chalk.cyanBright(signal)}`);
            } else {
                console.log(`${chalk.redBright(`Cluster ${this.#server} exited`)} ${chalk.gray("with exit code:")} ${chalk.cyanBright(code)}`);
            }

            console.log(`${chalk.redBright(`Waiting 5 seconds before restarting cluster ${this.#server}...`)}`);

            setTimeout(() => this.#restart(), 5000);
        });
    }

    async #restart() {
        if (this.#cluster && this.#cluster.isRunning) {
            this.#cluster.kill();
        }

        if (this.#restarts >= 5) {
            console.log(`${chalk.redBright(`Cluster ${this.#server} restart limit reached`)} ${chalk.gray("on port:")} ${chalk.cyanBright(this.port)}`);
            console.log(`${chalk.redBright(`Waiting 15 minutes before restarting cluster ${this.#server}...`)}`);

            await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
        }

        this.#restarts++;

        this.#init();
    }

    get port() {
        // Master port is 9999, cluster port is 9900 + id
        return 9900 + this.#id;
    }

    async get(type, route, options, resp) {
        if (!routes[type].includes("/" + route)) {
            return abort(resp, "Invalid route");
        }

        const port = this.port;

        try {
            options = options ? `/${options}` : "";

            const response = await axios.get(`http://localhost:${port}/${route}${options}`, {
                httpsAgent: this.#agent
            });

            // Forward data, headers and status code
            const { data, headers, status } = response;

            for (const key in headers) {
                resp.setHeader(key, headers[key]);
            }

            resp.status(status);
            resp.send(data);
        } catch (e) {
            if (e.message.includes("ECONNREFUSED")) {
                console.log(`${chalk.redBright(`Cluster ${this.#server} connection refused`)} ${chalk.gray("on port:")} ${chalk.cyanBright(this.port)}`);

                this.#restart();
            }

            abort(resp, e.message);
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

export function getSlaveData() {
    if (cluster.isPrimary) return false;

    return {
        id: process.env.ID,
        port: process.env.PORT,
        server: process.env.SERVER
    };
};