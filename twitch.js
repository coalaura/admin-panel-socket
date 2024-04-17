import config from "./_config.json" assert {type: "json"};

import axios from "axios";
import chalk from "chalk";

import { regenerateStreamers } from "./generator.js";

export function startTwitchUpdateLoop() {
    const api = config.twitch?.api,
        streamers = config.twitch?.streamers;

    if (!api || !streamers || !streamers.length) return;

    updateTwitchData(api, streamers);

    console.log(`${chalk.greenBright("Started Twitch update loop")}`);
}

async function updateTwitchData(pApi, pStreamers) {
    const data = (await Promise.all(pStreamers.map(async streamer => {
        try {
            const avatar = await getTwitchStreamer(pApi, streamer);

            return {
                name: streamer,
                live: !!avatar,
                avatar: avatar
            };
        } catch (e) {
            console.log(chalk.redBright(`Failed to resolve streamer ${streamer}!`));
		    console.log(chalk.red(e.message));
        }

        return null;
    }))).filter(pStreamer => pStreamer && pStreamer.live);

    await regenerateStreamers(data);

    setTimeout(updateTwitchData, 60 * 1000, pApi, pStreamers);
}

async function getTwitchStreamer(pApi, pStreamer) {
    const url = pApi.replace("%s", pStreamer);

    const response = await axios.get(url),
        json = response.data;

    if (!json || !json.live) return false;

    return json.avatar;
}