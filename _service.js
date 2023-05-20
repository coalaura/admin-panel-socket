import https from "https";
import axios from "axios";

import { execSync } from "child_process";

async function getStatus() {
	const httpsAgent = new https.Agent({
		rejectUnauthorized: false,
	});

	const response = await axios.get("http://localhost:9999/socket-health", {
		httpsAgent
	});

	if (response.status !== 200) {
		throw Error("http status code not 200");
	}

	const json = response.data;

	if (!json) {
		throw Error("invalid json returned");
	}

	return json;
}

let executeServiceRestart = false;

try {
	console.log("Checking socket health...");

	const status = await getStatus();

	for (const serverName in status) {
		const health = status[serverName];

		if (health.failed) {
			console.log(` - ${serverName}: failed`);

			executeServiceRestart = true;
		} else {
			console.log(` - ${serverName}: ok`);
		}
	}
} catch (e) {
	console.log(`Socket health check failed: ${e}`);

	executeServiceRestart = true;
}

if (!executeServiceRestart) {
	console.log("Service health check passed");
} else {
	console.log("Service health check failed, restarting...");

	try {
		execSync("service panel_socket restart", {
			stdio: "ignore",
			detached: true
		});

		console.log("Service restarted");
	} catch (e) {
		console.log(`Failed to restart service: ${e}`);
	}
}
