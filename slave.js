import cluster from "cluster";
import { Agent } from "http";
import axios from "axios";

import { abort } from "./functions.js";
import { getSlaveRoutes } from "./slave-routes.js";

const routes = getSlaveRoutes();

export class Slave {
    #id;
    #agent;
    #cluster;
    #server;

    constructor(id, server) {
        this.#id = id;
        this.#server = server;

        this.#init();
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
            abort(resp, e.message);
        }
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