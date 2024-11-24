import config from "./config.js";
import { Slave } from "./slave.js";
import { authenticate, parseServer } from "./auth.js";
import { abort } from "./functions.js";
import { getStreamerData } from "./twitch.js";
import { resolveHistoricData, resolveTimestampData } from "./history-resolve.js";
import { warning } from "./colors.js";

let slaves = {};

async function terminateAll() {
    let promises = [];

    for (const server in slaves) {
        const slave = slaves[server];

        promises.push(slave.terminate());
    }

    await Promise.all(promises);

    process.exit(0);
}

export function initSlaves(only = null) {
    for (let i = 0; i < config.servers.length; i++) {
        const server = config.servers[i];

        if (only && server !== only) continue;

        slaves[server] = new Slave(i + 1, server);
    }

    process.on("SIGTERM", async () => {
        console.log(warning("Terminating (SIGTERM)..."));
        await terminateAll();
    });

    process.on("SIGINT", async () => {
        console.log(warning("Terminating (SIGINT)..."));

        await terminateAll();
    });
}

export function getSlaveData(server, type) {
    const slave = slaves[server];

    if (!slave) return false;

    return slave.data(type);
}

export function initMasterRoutes(app) {
    // Data route requires authentication
    app.get("/socket/:server/data/:route/:options?", authenticate, async (req, resp) => {
        const cluster = req.cluster,
            slave = slaves[cluster];

        if (!slave) return abort(resp, "Cluster not found");

        await slave.get("data", req.params.route, req.params.options, resp);
    });

    // Static route does not require authentication
    app.get("/socket/:server/static/:route", async (req, resp) => {
        const server = parseServer(req.params.server),
            slave = server ? slaves[server.cluster] : false;

        if (!slave) return abort(resp, "Cluster not found");

        await slave.get("static", req.params.route, "", resp);
    });

    // History route
    app.get("/socket/:server/history/:license/:from/:till", authenticate, async (req, resp) => {
        const params = req.params,
            license = req.license,
            server = req.server;

        const from = 'from' in params ? parseInt(params.from) : false,
            till = 'till' in params ? parseInt(params.till) : false;

        if (!license || !from || from < 0 || !till || till < 0) {
            return abort(resp, "Invalid request");
        }

        try {
            const data = await resolveHistoricData(server, license, from, till);

            resp.json({
                status: true,
                data: data
            });
        } catch (e) {
            abort(resp, e.message);
        }
    });

    // Timestamp route
    app.get("/socket/:server/timestamp/:timestamp", authenticate, async (req, resp) => {
        const params = req.params,
            server = req.server;

        const timestamp = 'timestamp' in params ? parseInt(params.timestamp) : false;

        if (!timestamp) return abort(resp, "Invalid request");

        try {
            const data = await resolveTimestampData(server, timestamp);

            resp.json({
                status: true,
                data: data
            });
        } catch (e) {
            abort(resp, e.message);
        }
    });

    // Misc data routes (no authentication)
    app.get("/socket/:server/misc/twitch", (req, resp) => {
        resp.json({
            status: true,
            data: getStreamerData()
        });
    });
}