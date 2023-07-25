import { resolveHistoricData, resolveTimestamp } from "./resolve.js";
import { getServerHealths } from "./server.js";
import { getCommitVersion } from "./helper.js";
import { authenticate } from "./auth.js";

export function initRoutes(pApp) {
    pApp.get("/historic/:server/:license/:from/:till", authenticate, async (req, resp) => {
        const params = req.params;

        const license = req.license,
            from = 'from' in params ? parseInt(params.from) : false,
            till = 'till' in params ? parseInt(params.till) : false;

        if (!license || !from || from < 0 || !till || till < 0) {
            resp.json({
                status: false,
                error: "Invalid request"
            });

            return;
        }

        const server = req.server;

        try {
            const data = await resolveHistoricData(server.server, license, from, till);

            resp.json({
                status: true,
                data: data
            });
        } catch (e) {
            resp.json({
                status: false,
                error: e + ""
            });
        }
    });

    pApp.get("/timestamp/:server/:timestamp", authenticate, async (req, resp) => {
        const params = req.params;

        const timestamp = 'timestamp' in params ? parseInt(params.timestamp) : false;

        if (!Number.isInteger(timestamp) || timestamp < 0) {
            resp.json({
                status: false,
                error: "Invalid request"
            });

            return;
        }

        const server = req.server;

        try {
            const data = await resolveTimestamp(server.server, timestamp);

            resp.json({
                status: true,
                data: data
            });
        } catch (e) {
            resp.json({
                status: false,
                error: e + ""
            });
        }
    });

    pApp.get("/socket-health", async (req, resp) => {
        const health = getServerHealths();

        resp.json(health);
    });

    pApp.get("/socket-version", async (req, resp) => {
        const version = getCommitVersion();

        resp.type("text/plain");

        if (!version) {
            resp.send("Failed to get version");

            return;
        }

        resp.send(`v1-${version}`);
    });
}
