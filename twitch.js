import config from "./config.js";
import { success } from "./colors.js";

import axios from "axios";

let streamerData = {};

export function getStreamerData() {
	return streamerData;
}

export function startTwitchUpdateLoop() {
	const api = config.twitch?.api,
		streamers = config.twitch?.streamers;

	if (!api || !streamers || !streamers.length) return;

	updateTwitchData(api, streamers);

	console.log(`${success("Started Twitch update loop")}`);
}

async function updateTwitchData(api, streamers) {
	try {
		const response = await axios.get(api.replace("%s", streamers.join(","))),
			data = response.data;

		if (data && Array.isArray(data)) {
			streamerData = data.filter(streamer => streamer?.live);
		}
	} catch {}

	setTimeout(updateTwitchData, 60 * 1000, api, streamers);
}
