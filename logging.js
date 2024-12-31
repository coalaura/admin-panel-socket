import { existsSync, mkdirSync, createWriteStream, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";

import { reverse } from "./functions.js";

let logs = [],
	file;

export function getLogs() {
	return reverse(logs);
}

const _consoleLog = console.log,
	isDev = process.argv.includes("--dev");

function log(server, level, msg) {
	msg = `[${new Date().toISOString()}] ${level.toUpperCase()} - ${msg}`;

	logs.push(msg);

	if (logs.length > 2500) {
		logs.shift();
	}

	if (file) {
		file.write(`${msg}\n`);

		cycleFile(server);

		if (isDev) {
			_consoleLog(msg);
		}
	} else {
		_consoleLog(msg);
	}
}

function cycleFile(server) {
	const path = join("logs", `${server}.log`);

	if (existsSync(path)) {
		const size = statSync(path).size;

		// 10 MB
		if (size > 10 * 1024 * 1024) {
			if (file) {
				file.end();

				file = null;
			}

			unlinkSync(path);

			console.log(`Rotated ${path}`);
		}
	}

	if (!file) {
		file = createWriteStream(path, {
			flags: "a",
		});
	}
}

export function initializeLogs() {
	if (existsSync("logs")) return;

	mkdirSync("logs");
}

export function registerConsole(server) {
	if (process.platform === "win32") return;

	cycleFile(server);

	console.log = (...args) => {
		log(server, "log", args.join(" "));
	};

	console.info = (...args) => {
		log(server, "info", args.join(" "));
	};

	console.warn = (...args) => {
		log(server, "warn", args.join(" "));
	};

	console.error = (...args) => {
		log(server, "error", args.join(" "));
	};

	console.debug = (...args) => {
		log(server, "debug", args.join(" "));
	};
}
