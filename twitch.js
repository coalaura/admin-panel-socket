import config from "./_config.json" assert {type: "json"};

import axios from "axios";
import chalk from "chalk";

let streamerData = {};

export function getStreamerData() {
    return streamerData;
}

export function startTwitchUpdateLoop() {
    const api = config.twitch?.api,
        streamers = config.twitch?.streamers;

    if (!api || !streamers || !streamers.length) return;

    updateTwitchData(api, streamers);

    console.log(`${chalk.greenBright("Started Twitch update loop")}`);
}

async function updateTwitchData(api, streamers) {
    const data = (await Promise.all(streamers.map(async streamer => {
        try {
            const avatar = await getTwitchStreamer(api, streamer);

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
    }))).filter(streamer => streamer && streamer.live);

    streamerData = data;

    setTimeout(updateTwitchData, 60 * 1000, api, streamers);
}

async function getTwitchStreamer(api, streamer) {
    const url = api.replace("%s", streamer);

    const response = await axios.get(url),
        json = response.data;

    if (!json || !json.live) return false;

    return json.avatar;
}