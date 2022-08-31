import https from "https";
import axios from 'axios';

export async function requestOpFwApi(pUrl, pToken) {
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
    });

    const response = await axios.get(pUrl, {
        httpsAgent,
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