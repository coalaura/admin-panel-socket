import { isValidSteam, isValidToken } from "./data-loop.js";
import { resolveHistoricData, resolveTimestamp } from "./resolve.js";
import { getServer } from "./server.js";

import chalk from "chalk";

export function initRoutes(pApp) {
    pApp.get("/historic/:server/:steam/:from/:till", async (req, resp) => {
        const params = req.params,
            query = req.query;

        const token = 'token' in query ? query.token : false;

        const server = 'server' in params ? params.server : false,
            steam = 'steam' in params ? params.steam : false,
            from = 'from' in params ? parseInt(params.from) : false,
            till = 'till' in params ? parseInt(params.till) : false;

        if (!isValidToken(server, token) || !steam || !isValidSteam(steam, true) || !from || from < 0 || !till || till < 0) {
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

        console.log(chalk.blueBright("GET") + " " + chalk.gray(`/historic/${srv.server}/${steam}/${from}/${till}`));

        try {
            const data = await resolveHistoricData(srv.server, steam, from, till);

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
}
