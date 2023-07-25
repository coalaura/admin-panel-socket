import moment from "moment";

import { readdirSync, lstatSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

function _cleanupServer(pServer) {
	const now = moment();

	const path = join("historic", pServer),
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

	const servers = readdirSync("historic");

	let removed = 0;

	for (const server of servers) {
		removed += _cleanupServer(server);
	}

	console.log(`Cleanup complete (${removed} files removed)`);

	setTimeout(cleanupHistoricData, 2 * 60 * 60 * 1000);
}
