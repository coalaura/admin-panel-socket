import {isValidToken} from "./data-loop.js";
import {resolveHistoricData} from "./historic.js";

export function initRoutes(pApp) {
    pApp.get("/historic/:server/:steam/:from/:till", async (req, resp) => {
        const params = req.params,
            query = req.query;

        const token = 'token' in query ? query.token : false;

        const server = 'server' in params ? params.server : false,
            steam = 'steam' in params ? params.steam : false,
            from = 'from' in params ? parseInt(params.from) : false,
            till = 'till' in params ? parseInt(params.till) : false;

        if (!isValidToken(server, token) || !steam || !steam.match(/^[a-z0-9]{15}$/gm) || !from || from < 0 || !till || till < 0) {
            resp.json({
                status: false,
                error: "Invalid request"
            });

            return;
        }

        try {
            const data = await resolveHistoricData(server, steam, from, till);

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