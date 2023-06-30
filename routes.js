import { isValidLicense, isValidToken } from "./data-loop.js";
import { resolveHistoricData, resolveTimestamp } from "./resolve.js";
import { collectBans } from "./experimental.js";
import { getServer, getServerHealths } from "./server.js";
import { getCommitVersion } from "./helper.js";

import chalk from "chalk";

export function initRoutes(pApp) {
    pApp.get("/historic/:server/:license/:from/:till", async (req, resp) => {
        const params = req.params,
            query = req.query;

        const token = 'token' in query ? query.token : false;

        const server = 'server' in params ? params.server : false,
            license = 'license' in params ? params.license : false,
            from = 'from' in params ? parseInt(params.from) : false,
            till = 'till' in params ? parseInt(params.till) : false;

        if (!isValidToken(server, token) || !license || !isValidLicense(license, true) || !from || from < 0 || !till || till < 0) {
            resp.json({
                status: false,
                error: "Invalid request"
            });

            return;
        }

        const srv = getServer(server);

        if (!srv) {
            resp.json({
                status: false,
                error: "Invalid server"
            });
        }

        console.log(chalk.blueBright("GET") + " " + chalk.gray(`/historic/${srv.server}/${license}/${from}/${till}`));

        try {
            const data = await resolveHistoricData(srv.server, license, from, till);

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

    pApp.get("/timestamp/:server/:timestamp", async (req, resp) => {
        const params = req.params,
            query = req.query;

        const token = 'token' in query ? query.token : false;

        const server = 'server' in params ? params.server : false,
            timestamp = 'timestamp' in params ? parseInt(params.timestamp) : false;

        if (!isValidToken(server, token) || !Number.isInteger(timestamp) || timestamp < 0) {
            resp.json({
                status: false,
                error: "Invalid request"
            });

            return;
        }

        const srv = getServer(server);

        if (!srv) {
            resp.json({
                status: false,
                error: "Invalid server"
            });
        }

        console.log(chalk.blueBright("GET") + " " + chalk.gray(`/timestamp/${srv.server}/${timestamp}`));

        try {
            const data = await resolveTimestamp(srv.server, timestamp);

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

    pApp.post("/experimental/bans/:server", async (req, resp) => {
        const params = req.params,
            query = req.query;

        const token = 'token' in query ? query.token : false,
			server = 'server' in params ? params.server : false,
			bans = req.body.bans;

        if (!isValidToken(server, token) || !Array.isArray(bans)) {
            resp.json({
                status: false,
                error: "Invalid request"
            });

            return;
        }

        const srv = getServer(server);

        if (!srv) {
            resp.json({
                status: false,
                error: "Invalid server"
            });
        }

        console.log(chalk.blueBright("GET") + " " + chalk.gray(`/experimental/bans/${srv.server}`));

        try {
            const data = await collectBans(srv.server, bans);

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
