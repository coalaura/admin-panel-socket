import https from "https";
import axios from "axios";
import chalk from "chalk";

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
	console.log(chalk.gray("Checking socket health..."));

	const status = await getStatus();

	for (const serverName in status) {
		const health = status[serverName];

		if (health.failed) {
			console.log(chalk.whiteBright(` - ${serverName}: `) + chalk.redBright("failed"));

			executeServiceRestart = true;
		} else {
			console.log(chalk.whiteBright(` - ${serverName}: `) + chalk.greenBright("ok"));
		}
	}
} catch (e) {
	console.log(chalk.gray("Socket health check failed: ") + chalk.redBright(e.message));

	executeServiceRestart = true;
}

if (!executeServiceRestart) {
	console.log(chalk.greenBright("Service health check passed"));
} else {
	console.log(chalk.redBright("Service health check failed, restarting..."));

	try {
		execSync("service panel_socket restart", {
			stdio: "ignore",
			detached: true
		});

		console.log(chalk.gray("Service restarted"));
	} catch (e) {
		console.log(chalk.gray("Failed to restart service: ") + chalk.redBright(e.message));
	}
}
