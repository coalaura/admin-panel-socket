import config from "./config.js";
import { Slave } from "./slave.js";
import { authenticate, parseServer } from "./auth.js";
import { abort } from "./functions.js";
import { getStreamerData } from "./twitch.js";
import { resolveHistoricData, resolveTimestamp } from "./history-resolve.js";

let slaves = {};

export function initSlaves() {
    for (let i = 0; i < config.servers.length; i++) {
        const server = config.servers[i];

        // Staggered slave startup to spread out resource usage
        setTimeout(() => {
            let slave = new Slave(i + 1, server);

            slaves[server] = slave;
        }, i * 500);
    }
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
            const data = await resolveTimestamp(server, timestamp);

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