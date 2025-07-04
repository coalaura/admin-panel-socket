import config from "./config.js";

import { join } from "node:path";
import * as dotenv from "dotenv";
import { danger } from "./colors.js";

export function readDotEnv(cluster) {
	const path = config.docker ? join(config.panel, ".env") : join(config.panel, "envs", cluster, ".env");

	const env = dotenv.config({
		path: path,
		override: true,
	});

	if (env.error) {
		throw env.error;
	}

	const cfg = env.parsed;

	if (cfg.INACTIVE) {
		console.log(`${danger(`Cluster ${cluster} is inactive.`)}`);

		return false;
	}

	return cfg;
}
