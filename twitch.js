import { success } from "./colors.js";
import config from "./config.js";
import { sendFullUpdate } from "./updates.js";

export function startTwitchUpdateLoop() {
	const api = config.twitch?.api,
		streamers = config.twitch?.streamers;

	if (!api || !streamers || !streamers.length) {
		return;
	}

	updateTwitchData(api, streamers);

	console.info(`${success("Started Twitch update loop")}`);
}

async function updateTwitchData(api, streamers) {
	try {
		const response = await fetch(api.replace("%s", streamers.join(","))),
			data = await response.json();

		if (data && Array.isArray(data)) {
			sendFullUpdate(
				"twitch",
				data.filter(streamer => streamer?.live)
			);
		}
	} catch {}

	setTimeout(updateTwitchData, 60 * 1000, api, streamers);
}
