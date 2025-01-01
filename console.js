import { existsSync, statSync, createWriteStream } from "node:fs";

const logs = [];

const reset = "\x1b[0m",
	muted = "\x1b[38;5;243m";

const levels = {
	note: "\x1b[38;5;216m",
	debug: "\x1b[38;5;188m",
	info: "\x1b[38;5;117m",
	warn: "\x1b[38;5;202m",
	error: "\x1b[38;5;124m",
	fatal: "\x1b[38;5;196m",
};

function strip(str) {
	return str.replace(/\x1b\[[\d;]+m/g, "");
}

function write(target, message) {
	const stripped = strip(message);

	if (logs.unshift(stripped) > 2000) {
		logs.pop();
	}

	try {
        // No colors if target is not stdout
        if (target !== process.stdout) {
            message = stripped;
        }

		target.write(`${message}\n`);
	} catch (err) {
		process.stdout.write(`Unable to write log: ${err}\n`);
	}
}

function print(target, level, message) {
    const color = levels[level] || reset;

	write(target || process.stdout, `${muted}[${new Date().toISOString()}] [${color}${level.padEnd(5, " ")}${muted}] ${reset}${message}`);
}

function log(target, ...args) {
	print(target, "note", args.join(" "));
}

function debug(target, ...args) {
	print(target, "debug", args.join(" "));
}

function info(target, ...args) {
	print(target, "info", args.join(" "));
}

function warn(target, ...args) {
	print(target, "warn", args.join(" "));
}

function error(target, ...args) {
	print(target, "error", args.join(" "));
}

function fatal(...args) {
	print(process.stdout, "fatal", args.join(" "));
}

function resolveLogFile(name) {
    if (!name || typeof name !== "string") {
        return process.stdout;
    }

	if (!existsSync("./logs")) {
		mkdirSync("./logs");
	}

	const path = `./logs/${name}.log`;

	if (existsSync(path)) {
		const stat = statSync(path);

		if (stat.size > 10 * 1024 * 1024) {
			unlinkSync(path);

			info(false, `Rotated ${path}`);
		}
	}

	return createWriteStream(path, {
		flags: "a",
	});
}

export function getLogs() {
	return logs;
}

export function registerErrorHandlers() {
	function unhandled(err) {
		fatal(err instanceof Error ? err.stack : String(err));
	}

	process.on("uncaughtException", unhandled);
	process.on("unhandledRejection", unhandled);
}

export function registerConsole(name) {
	const target = resolveLogFile(name);

	console.log = (...args) => {
		log(target, args.join(" "));
	};

	console.debug = (...args) => {
		debug(target, args.join(" "));
	};

	console.info = (...args) => {
		info(target, args.join(" "));
	};

	console.warn = (...args) => {
		warn(target, args.join(" "));
	};

	console.error = (...args) => {
		error(target, args.join(" "));
	};
}
