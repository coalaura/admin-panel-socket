import config from "./config.js";
import { abort } from "./functions.js";

import chalk from "chalk";
import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function checkAuth(cluster, token) {
    if (!cluster || !token) {
        return false;
    }

    const session = await isValidToken(cluster, token);

    if (!session) {
        return false;
    }

    if (!config.servers.includes(cluster)) {
        return false;
    }

    return session;
}

export function parseServer(server) {
    if (server && server.match(/^c\d+$/m)) {
        // We got only the cluster :(

        return {
            cluster: server
        };
    }

    if (!server || !server.match(/^c\d+s\d+$/m)) {
        return false;
    }

    const match = server.match(/^(c\d+)s(\d+)$/m),
        cluster = match[1],
        shard = parseInt(match[2]);

    return {
        cluster: cluster,
        server: cluster + (shard > 1 ? `s${shard}` : "")
    };
}

export async function authenticate(req, resp, next) {
    const server = parseServer(req.params.server);

    if (!server) {
        return abort(resp, "Invalid server");
    }

    const session = await checkAuth(server.cluster, req.query.token);

    if (!session) {
        return abort(resp, "Unauthorized");
    }

    // Validation of additional params (if sent)
    const license = req.params.license;

    if (license && !isValidLicense(license)) {
        return abort(resp, "Invalid license");
    }

    console.log(chalk.bgGreen(" " + req.method + " ") + " " + chalk.cyanBright(session.name) + " - " + chalk.gray(req.path));

    req.cluster = server.cluster;
    req.server = server.server;
    req.session = session;
    req.license = license;

    next();
}

export async function isValidToken(cluster, token) {
    if (!config.servers.includes(cluster)) {
        return false;
    }

    if (!token || !token.match(/^[a-z0-9]{30}$/m)) {
        return false;
    }

    try {
        const sessionFile = join(config.panel, "storage", "sessions", cluster + ".json");

        if (!existsSync(sessionFile)) {
            return false;
        }

        const sessions = JSON.parse(await readFile(sessionFile, "utf8"));

        return token in sessions ? sessions[token] : false;
    } catch (e) {
        console.error(`${chalk.yellowBright("Failed to validate session")} ${chalk.cyanBright(cluster)}: ${chalk.gray(e)}`);
    }

    return false;
}

export function isValidLicense(license) {
    if (!license) {
        return false;
    }

    if (license.startsWith("license:")) {
        license = license.replace("license:", "");
    }

    return license.match(/^[a-z0-9]{40}$/gm);
}
