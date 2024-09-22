import cluster from "cluster";
import chalk from "chalk";

import { abort } from "./functions.js";
import { handleDataUpdate } from "./client.js";
import { SlaveHandler } from "./slave-handler.js";

const routes = SlaveHandler.routes();

export class Slave {
    #id;
    #cluster;
    #server;

    #requestId = 0;
    #requests = {};

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
        this.#cluster = cluster.fork({
            stdio: [0, 1, 2, "ipc"],

            ID: this.#id,
            SERVER: this.#server
        });

        this.#cluster.on("online", () => {
            console.log(`${chalk.greenBright(`Cluster ${this.#server} online`)}`);
        });

        this.#cluster.on("message", message => {
            const { id, type, data } = message;

            if (type === "hello") {
                this.isUp();

                return;
            } else if (type === "request") {
                const request = this.#requests[id];

                request?.resolve(data);

                return;
            }

            handleDataUpdate(type, this.#server, data);
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
        this.#restarts++;

        const failed = () => {
            console.log(`${chalk.redBright(`Cluster ${this.#server} restart failed`)}`);

            this.#isRestarting = false;

            this.#isUp = false;
            this.#upCallbacks = [];

            this.#restart();
        };

        // Restart should not take longer than 1 minute
        const timeout = setTimeout(failed, 60 * 1000);

        try {
            if (this.#cluster && this.#cluster.isRunning) {
                this.#cluster.kill();
            }

            // Delay extra long if we have too many restarts
            if (this.#restarts >= 3) {
                console.log(`${chalk.redBright(`Cluster ${this.#server} restart limit reached`)}`);
                console.log(`${chalk.redBright(`Waiting 15 minutes before restarting cluster ${this.#server}...`)}`);

                await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
            }

            this.#init();

            this.onUp(() => {
                clearTimeout(timeout);

                this.#isRestarting = false;
                this.#restarts = 0;

                console.log(`${chalk.greenBright(`Cluster ${this.#server} startup succeeded`)}`);
            });
        } catch (e) {
            console.log(`${chalk.redBright(`Cluster ${this.#server} restart failed`)}: ${e.message}`);

            failed();
        }
    }

    ipc(resolve, func, options) {
        const id = ++this.#requestId;

        const finish = data => {
            clearTimeout(this.#requests[id].timeout);

            delete this.#requests[id];

            resolve(data || {
                status: false,
                error: "Request timed out"
            });
        };

        this.#requests[id] = {
            resolve: finish,
            timeout: setTimeout(() => {
                finish(false);

                console.log(`${chalk.redBright(`Cluster ${this.#server} timeout`)}`);

                this.#restart();
            }, 5000)
        };

        this.#cluster.send({
            id: id,
            server: this.#server,
            func: func,
            options: options
        });
    }

    get(type, route, options, resp) {
        if (!this.#isUp) {
            return abort(resp, "Cluster not up yet");
        }

        if (!routes[type].includes("/" + route)) {
            return abort(resp, "Invalid route");
        }

        this.ipc(data => {
            resp.send(data);
        }, route, options);
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