import config from "./config.js";

import { join } from "path";
import * as dotenv from "dotenv";
import { danger } from "./colors.js";

export function readDotEnv(cluster) {
    const envPath = join(config.panel, "envs", cluster, ".env"),
		env = dotenv.config({
			path: envPath,
			override: true
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