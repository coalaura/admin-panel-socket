import { isValidLicense, isValidToken } from "./data-loop.js";
import { getServer } from "./server.js";

import chalk from "chalk";

export async function checkAuth(pQuery, pParams) {
    const token = _find(pParams, pQuery, "token"),
        server = _find(pParams, pQuery, "server");

    if (!server || !token) {
        return false;
    }

    const playerName = await isValidToken(server, token);

    if (!playerName) {
        return false;
    }

    const srv = getServer(server);

    if (!srv) {
        return false;
    }

    return {
        server: srv,
        name: playerName
    };
}

export async function authenticate(pReq, pRes, pNext) {
    const session = await checkAuth(pReq.query, pReq.params);

    if (!session) {
        return _abort(pRes, "Unauthorized");
    }

    // Validation of additional params (if sent)
    const license = _find(pReq.params, pReq.query, "license");

    if (license && !isValidLicense(license)) {
        return _abort(pRes, "Invalid license");
    }

    console.log(chalk.bgGreen(" " + pReq.method + " ") + " " + chalk.cyanBright(session.name) + " - " + chalk.gray(pReq.path));

    pReq.server = session.server;
    pReq.license = license;

    pNext();
}

function _find(pParams, pQuery, pKey) {
    if (pKey in pParams && pParams[pKey]) {
        return pParams[pKey];
    }

    if (pKey in pQuery && pQuery[pKey]) {
        return pQuery[pKey];
    }

    return false;
}

function _abort(pRes, pError) {
    pRes.json({
        status: false,
        error: pError
    });
}