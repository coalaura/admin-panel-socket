import config from "./_config.json" assert {type: "json"};

import { join } from "path";
import * as dotenv from "dotenv";
import { createPool } from "mysql";
import chalk from "chalk";

let servers = {};

export async function initServers() {
    for (let x = 0; x < config.servers.length; x++) {
        const server = config.servers[x];

        console.log(chalk.blueBright(`Connecting to ${server}...`));

        const envPath = join(config.panel, "envs", server, ".env"),
            env = dotenv.config({
                path: envPath,
                override: true
            });

        if (env.error) {
            throw env.error;
        }

        const cfg = env.parsed;

        const srv = {
            server: server,
            url: getServerUrl(cfg.OP_FW_SERVERS),
            token: cfg.OP_FW_TOKEN,

            pool: createPool({
                connectionLimit: 5,

                host: cfg.DB_HOST,
                port: cfg.DB_PORT,
                user: cfg.DB_USERNAME,
                password: cfg.DB_PASSWORD,
                database: cfg.DB_DATABASE
            })
        };

        await testConnection(srv);

        servers[server] = srv;
    }
}

export function validateSession(pServer, pToken) {
    return new Promise((resolve, reject) => {
        const server = getServer(pServer);

        if (!server) {
            resolve(false);

            return;
        }

        server.pool.getConnection((pError, pConnection) => {
            if (pError) {
                reject(pError);

                return;
            }

            pConnection.query("SELECT `data` FROM webpanel_sessions WHERE `key` = ?", [pToken], (pError, pResults) => {
                pConnection.release();

                if (pError) {
                    reject(pError);

                    return;
                }

                if (pResults.length > 0) {
                    const result = pResults[0];

                    try {
                        const data = JSON.parse(result.data);

                        if (data && data.user) {
                            resolve(true);

                            return;
                        }
                    } catch (e) { }
                }

                console.log("nope");

                resolve(false);
            });
        });
    });
}

export function getServer(pServer) {
    if (typeof pServer !== "string") {
        return null;
    }

    if (pServer.match(/^c\d+s\d+$/)) {
        pServer = pServer.split("s")[0];
    } else if (!pServer.match(/^c\d+$/)) {
        return null;
    }

    return servers[pServer];
}

function testConnection(pServer) {
    return new Promise((resolve, reject) => {
        pServer.pool.getConnection((pError, pConnection) => {
            if (pError) {
                reject(pError);

                return;
            }

            pConnection.query("SELECT 1", (pError, pResults) => {
                pConnection.release();

                if (pError) {
                    reject(pError);

                    return;
                }

                resolve(true);
            });
        });
    });
}

function getServerUrl(pServer) {
    if (pServer.match(/^[0-9.]+(:[0-9]+)?$/gm)) {
        return "http://" + pServer;
    }

    return "https://" + pServer;
}
