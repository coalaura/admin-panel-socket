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

    #isUp = false;
    #isRestarting = false;
    #upCallbacks = [];
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
            console.log(`${chalk.greenBright(`Cluster ${this.#server} online`)}`);
        });

        this.#cluster.on("disconnect", (code, signal) => {
            this.death(code, signal);
        });

        this.#cluster.on("exit", (code, signal) => {
            this.death(code, signal);
        });
    }

    death(code, signal) {
        if (this.#isRestarting) return;

        this.#isUp = false;
        this.#upCallbacks = [];

        if (signal) {
            console.log(`${chalk.redBright(`Cluster ${this.#server} killed`)} ${chalk.gray("by signal:")} ${chalk.cyanBright(signal)}`);
        } else {
            console.log(`${chalk.redBright(`Cluster ${this.#server} exited`)} ${chalk.gray("with exit code:")} ${chalk.cyanBright(code)}`);
        }

        this.#restart();
    }

    async #restart() {
        if (this.#isRestarting) return;

        this.#isRestarting = true;
        this.#isUp = false;
        this.#upCallbacks = [];

        let timeout = setTimeout(() => {
            console.log(`${chalk.redBright(`Cluster ${this.#server} restart failed`)} ${chalk.gray("on port:")} ${chalk.cyanBright(this.port)}`);

            this.#isRestarting = false;

            this.#isUp = false;
            this.#upCallbacks = [];

            this.#restart();
        }, 60 * 1000);

        try {
            if (this.#cluster && this.#cluster.isRunning) {
                this.#cluster.kill();
            }

            if (this.#restarts >= 3) {
                console.log(`${chalk.redBright(`Cluster ${this.#server} restart limit reached`)} ${chalk.gray("on port:")} ${chalk.cyanBright(this.port)}`);
                console.log(`${chalk.redBright(`Waiting 15 minutes before restarting cluster ${this.#server}...`)}`);

                await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
            }

            this.#init();

            this.onUp(() => {
                clearTimeout(timeout);

                this.#isRestarting = false;

                console.log(`${chalk.greenBright(`Cluster ${this.#server} startup succeeded`)} ${chalk.gray("on port:")} ${chalk.cyanBright(this.port)}`);
            });
        } catch(e) {}
    }

    get port() {
        // Master port is 9999, cluster port is 9900 + id
        return 9900 + this.#id;
    }

    async get(type, route, options, resp) {
        if (!this.#isUp) {
            return abort(resp, "Cluster not up yet");
        }

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

    onUp(callback) {
        if (this.#isUp) {
            callback();

            return;
        }

        this.#upCallbacks.push(callback);
    }

    isUp() {
        this.#isUp = true;

        for (const callback of this.#upCallbacks) {
            callback();
        }

        this.#upCallbacks = [];
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