import { requestOpFwApi } from "./http.js";
import { loadOnDutyData } from "./duty.js";
import { trackHistoricData } from "./history-store.js";
import { decompressPlayers } from "./decompressor.js";
import { compressPlayer } from "./compression.js";

import { lookup, getServers } from "node:dns/promises";
import chalk from "chalk";

export async function updateWorldJSON(server) {
    const dutyMap = await loadOnDutyData(server);

    const data = decompressPlayers(await requestOpFwApi(`${server.url}/op-framework/world.json?compress=1`, server.token));

    let clientData = [];

    for (let x = 0; x < data.players.length; x++) {
        const player = data.players[x];

        try {
            trackHistoricData(server.server, player);
        } catch (e) {
            console.error(`${chalk.yellowBright("Failed to track historic data")}: ${chalk.gray(e)}`);
        }

        clientData.push(compressPlayer(player, dutyMap));
    }

    server.players = data.players;
    server.world = data.world;

    return {
        players: clientData,
        instance: data.world?.instance
    };
}

export async function checkIfServerIsUp(server) {
    let uptime = false,
        name = false,
        logo = false,
        success = false;

    try {
        if (server.down) {
            // To test if we can do authorized requests
            await requestOpFwApi(`${server.url}/op-framework/auth.json`, server.token);
        }

        const data = await requestOpFwApi(`${server.url}/op-framework/variables.json`, server.token);

        if (typeof data.serverUptimeMilliseconds === "number") {
            uptime = data.serverUptimeMilliseconds;
        }

        if (typeof data.communityName === "string") {
            name = data.communityName;
        }

        if (typeof data.communityLogo === "string") {
            logo = data.communityLogo;
        }

        success = data.serverReady === true;
    } catch (e) {
        console.warn(`Failed to check if server is up (${String(server.url)}): ${e.message}`);

        await canResolveServerDNS(server.url);

        if (!server.url) {
            console.error("Server URL not found, waiting for restart...");

            process.exit(1);
        }
    }

    if (success && server.down) {
        console.log(`Server ${server.url} is up again! (uptime=${uptime}, name=${name})`);
    }

    if (!success) {
        return false;
    }

    return {
        uptime: uptime,
        name: name,
        logo: logo
    };
}

async function canResolveServerDNS(url) {
    if (!url || url.match(/\d+\.\d+\.\d+\.\d+/)) {
        return;
    }

    const uri = new URL(url),
        host = uri.host,
        servers = getServers();

    try {
        const result = await lookup(host);

        if (!result || !result.address) {
            throw new Error("no address found");
        }

        console.log(`Resolved ${host} to: ${result.address}`);
    } catch(e) {
        console.info(`Active DNS servers: ${servers.join(", ")}`);
        console.warn(`Failed to resolve ${host}: ${e.message}`);
    }
}
