import https from "https";
import http from "http";
import axios from "axios";

const instances = {};

export async function requestOpFwApi(pUrl, pToken) {
    const instance = getInstance(pUrl);

    const response = await instance.get(pUrl, {
        headers: {
            "Authorization": "Bearer " + pToken
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

function getInstance(pUrl) {
    const url = new URL(pUrl),
        origin = url.origin;

    if (!(origin in instances)) {
        const agent = url.scheme === "https" ? new https.Agent({
            keepAlive: true,
            rejectUnauthorized: false,
        }) : new http.Agent({
            keepAlive: true,
        });

        instances[origin] = axios.create({
            timeout: 3000,
            httpAgent: agent,
        });
    }

    return instances[origin];
}
