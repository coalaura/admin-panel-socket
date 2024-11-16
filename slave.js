import cluster from "cluster";

import { abort } from "./functions.js";
import { getActiveViewers, handleDataUpdate } from "./client.js";
import { SlaveHandler } from "./slave-handler.js";
import { danger, info, muted, success, warning, error } from "./colors.js";

const routes = SlaveHandler.routes();

export class Slave {
    #id;
    #cluster;
    #server;

    #data = {};

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
            console.log(`${success(`Cluster ${this.#server} online`)}`);
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

            // We have to add the viewer count here, since the slaves don't know about it
            if (type === "world") {
                data.v = getActiveViewers(this.#server, "world");
            }

            handleDataUpdate(type, this.#server, this.diff(type, data));

            this.#data[type] = data;
        });

        this.#cluster.on("disconnect", (code, signal) => {
            this.death(code, signal);
        });

        this.#cluster.on("exit", (code, signal) => {
            this.death(code, signal);
        });
    }

    data(type) {
        return this.#data[type];
    }

    diff(type, data) {
        const compare = (df, a, b) => {
            for (const key in a) {
                const newValue = a[key],
                    oldValue = b[key];

                const newType = typeof newValue,
                    oldType = typeof oldValue;

                if (newType !== oldType) {
                    if (newType === "undefined" || newValue === null) {
                        df[key] = null;
                    } else {
                        df[key] = newValue;
                    }
                } else if (newType === "object") {
                    if (Array.isArray(newValue)) {
                        const newDiff = newValue;

                        if (newDiff.length !== oldValue.length) {
                            df[key] = newDiff;
                        }
                    } else {
                        const newDiff = compare(df[key] || {}, newValue, oldValue);

                        if (Object.keys(newDiff).length) {
                            df[key] = newDiff;
                        }
                    }
                } else if (newValue !== oldValue) {
                    df[key] = newValue;
                }
            }

            return df;
        };

        return compare({}, data, this.#data[type] || {});
    }

    death(code, signal) {
        if (this.#isRestarting) return;

        this.#isUp = false;
        this.#upCallbacks = [];

        if (signal) {
            console.log(`${danger(`Cluster ${this.#server} killed`)} ${muted("by signal:")} ${info(signal)}`);
        } else {
            console.log(`${danger(`Cluster ${this.#server} exited`)} ${muted("with exit code:")} ${info(code)}`);
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
            console.log(`${danger(`Cluster ${this.#server} restart failed`)}`);

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
                console.log(`${danger(`Cluster ${this.#server} restart limit reached`)}`);
                console.log(`${danger(`Waiting 15 minutes before restarting cluster ${this.#server}...`)}`);

                await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
            }

            this.#init();

            this.onUp(() => {
                clearTimeout(timeout);

                this.#isRestarting = false;
                this.#restarts = 0;

                console.log(`${success(`Cluster ${this.#server} startup succeeded`)}`);
            });
        } catch (e) {
            console.log(`${danger(`Cluster ${this.#server} restart failed`)}: ${error(e.message)}`);

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

                console.log(`${warning(`Cluster ${this.#server} timeout`)}`);

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