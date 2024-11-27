import cluster from "cluster";

import { abort } from "./functions.js";
import { getActiveViewers, handleDataUpdate } from "./client.js";
import { SlaveHandler } from "./slave-handler.js";
import { danger, success, warning } from "./colors.js";

const routes = SlaveHandler.routes();

export class Slave {
    #id;
    #cluster;
    #server;

    #data = {};

    #requestId = 0;
    #requests = {};

    #terminating = false;
    #online = false;

    #callbacks = {
        up: [],
        down: []
    };

    constructor(id, server) {
        this.#id = id;
        this.#server = server;

        this.#fork();

        this.on("down", () => {
            this.#fork();
        });
    }

    on(event, callback) {
        if (!["up", "down"].includes(event)) return;

        if (event === "up" && this.#online) {
            callback();
        } else if (event === "down" && !this.#online) {
            callback();
        }

        this.#callbacks[event].push(callback);
    }

    #trigger(event) {
        if (event === "up") {
            if (this.#online) return;

            this.#online = true;

            console.log(`${success(`Cluster ${this.#server} is up`)}`);
        } else if (event === "down") {
            if (!this.#online) return;

            this.#online = false;

            console.log(`${danger(`Cluster ${this.#server} is down`)}`);
        }

        const callbacks = this.#callbacks[event];

        for (const callback of callbacks) {
            callback();
        }
    }

    terminate() {
        return new Promise(resolve => {
            if (this.#terminating || !this.#cluster) {
                resolve();

                return;
            }

            this.#terminating = true;

            this.#cluster.send("terminate");

            const timeout = setTimeout(() => {
                this.#kill();

                resolve();

                console.log(`${danger(`Cluster ${this.#server} terminated forcefully after 5 seconds`)}`);
            }, 5000);

            this.on("down", () => {
                clearTimeout(timeout);

                resolve();

                console.log(`${success(`Cluster ${this.#server} terminated successfully`)}`);
            });
        });
    }

    #kill() {
        if (!this.#cluster) return;

        this.#cluster.kill();

        this.#cluster = null;
    }

    #fork() {
        if (this.#terminating || this.#cluster) return;

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
                this.#trigger("up");

                return;
            } else if (type === "request") {
                const request = this.#requests[id];

                request?.resolve(data);

                return;
            }

            // We have to add the viewer count here, since the slaves don't know about it
            if (type === "world") {
                data.viewers = getActiveViewers(this.#server, "world");
            }

            handleDataUpdate(type, this.#server, this.#diff(type, data));

            this.#data[type] = data;
        });

        this.#cluster.on("disconnect", () => {
            this.#kill();

            this.#trigger("down");
        });

        this.#cluster.on("exit", (code, signal) => {
            this.#kill();

            this.#trigger("down");
        });
    }

    #diff(type, data) {
        const compare = (df, a, b) => {
            if (Array.isArray(a)) {
                if (equals(a, b)) {
                    return [];
                }

                return a;
            } else if (typeof a === "object") {
                df = {};

                const bValid = typeof b === "object" && b !== null;

                for (const key in a) {
                    const newValue = a[key],
                        oldValue = bValid ? b[key] : null;

                    const newType = typeof newValue,
                        oldType = typeof oldValue;

                    if (newType !== oldType) {
                        if (newType === "undefined" || newValue === null) {
                            df[key] = null;
                        } else {
                            df[key] = newValue;
                        }
                    } else if (newType === "object") {
                        const newDiff = compare(df[key], newValue, oldValue);

                        if (Object.keys(newDiff).length) {
                            df[key] = newDiff;
                        }
                    } else if (newValue !== oldValue) {
                        df[key] = newValue;
                    }
                }

                return df;
            }

            return a;
        };

        if (!this.#data[type]) {
            this.#data[type] = {};
        }

        return compare({}, data, this.#data[type]);
    }

    #ipc(resolve, func, options) {
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
            }, 5000)
        };

        this.#cluster && this.#cluster.send({
            id: id,
            server: this.#server,
            func: func,
            options: options
        });
    }

    data(type) {
        return this.#data[type];
    }

    get(type, route, options, resp) {
        if (!this.#online) {
            return abort(resp, "Cluster not up yet");
        }

        if (!routes[type].includes("/" + route)) {
            return abort(resp, "Invalid route");
        }

        this.#ipc(data => {
            resp.send(data);
        }, route, options);
    }
};

function equals(a, b) {
    const typeA = typeof a,
        typeB = typeof b;

    if (typeA !== typeB) {
        return false;
    } else if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) {
            return false;
        }

        for (let x = 0; x < a.length; x++) {
            if (!equals(a[x], b[x])) {
                return false;
            }
        }

        return true;
    } else if (typeA === "object") {
        if (a === null && b === null) {
            return true;
        } else if (a === null || b === null) {
            return false;
        }

        if (Object.keys(a).length !== Object.keys(b).length) {
            return false;
        }

        for (const key in a) {
            if (!equals(a[key], b[key])) {
                return false;
            }
        }

        return true;
    }

    return a === b;
}

export function getSlaveData() {
    if (cluster.isPrimary) return false;

    return {
        id: process.env.ID,
        port: process.env.PORT,
        server: process.env.SERVER
    };
};