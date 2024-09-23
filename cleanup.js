import moment from "moment";

import { readdirSync, lstatSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

function _cleanupServer(server) {
	const now = moment();

	const path = join("historic", server),
		files = readdirSync(path);

	let removed = 0;

	for (const file of files) {
		const filePath = join(path, file),
			isDirectory = lstatSync(filePath).isDirectory();

		if (isDirectory) {
			const timestamp = moment(file, "DD-MM-YYYY"),
				days = now.diff(timestamp, "days");

			if (days > 10) {
				execSync(`rm -rf ${filePath}`);

				console.log(`  Cleaned up ${filePath} (${days} days)`);

				removed++;
			}
		}
	}

	return removed;
}

export function cleanupHistoricData() {
	console.log("Cleaning up historic data...");

	let removed = 0;

	if (existsSync("historic")) {
		const servers = readdirSync("historic");

		for (const server of servers) {
			removed += _cleanupServer(server);
		}
	}

	console.log(`Cleanup complete (${removed} files removed)`);

	setTimeout(cleanupHistoricData, 2 * 60 * 60 * 1000);
}
