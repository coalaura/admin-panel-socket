import https from "https";
import http from "http";
import axios from "axios";

let agents = {};

export async function requestOpFwApi(url, token) {
    const agent = getInstance(url);

    const response = await axios.get(url, {
        httpAgent: agent,
        timeout: 3000,
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    if (response.status !== 200) {
        throw Error("http status code not 200");
    }

    const json = response.data;

    if (!json || !('data' in json) || !('statusCode' in json)) {
        throw Error("invalid json returned");
    }

    if (json.statusCode !== 200) {
        throw Error("json status code not 200");
    }

    return json.data;
}

function getInstance(uri) {
    const url = new URL(uri),
        origin = url.origin;

    if (!(origin in agents)) {
        const agent = url.scheme === "https" ? new https.Agent({
            keepAlive: true,
            rejectUnauthorized: false,
        }) : new http.Agent({
            keepAlive: true,
        });

        agents[origin] = agent;
    }

    return agents[origin];
}
