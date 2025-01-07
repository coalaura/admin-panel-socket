import config from "./config.js";

import { unpack } from "msgpackr";

export async function requestOpFwApi(url, token) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(config.timeout || 1500),
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (response.status !== 200) {
        throw Error("http status code not 200");
    }

    const contentType = response.headers.get("content-type");

    switch (contentType) {
        case "text/plain":
            return await response.text();

        case "application/msgpack": {
            const buffer = await response.arrayBuffer();

            return unpack(buffer);
        }
    }

    // Default is JSON
    const json = await response.json();

    if (!json || typeof json !== "object" || !("data" in json) || !("statusCode" in json)) {
        throw Error("invalid json returned");
    }

    if (json.statusCode !== 200) {
        throw Error("json status code not 200");
    }

    return json.data;
}
