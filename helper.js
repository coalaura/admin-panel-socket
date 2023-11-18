import { createReadStream } from "fs";
import { createInterface } from "readline";
import { Writable } from "stream";
import { execSync } from "child_process";

export function findFiles(pPath, pStartWith) {
    try {
        const out = execSync(`grep -rnw '${pPath}' -e '^${pStartWith}'`).toString(),
            lines = out.trim().split("\n");

        let result = [];

        for (let x = 0; x < lines.length; x++) {
            const line = lines[x].split(":");

            if (line.length === 3) {
                result.push({
                    file: line[0],
                    line: line[1],
                    content: line[2]
                });
            }
        }

        return result;
    } catch (e) {
        const error = e.stderr ? e.stderr.toString().trim() : "Something went wrong";
        if (error === "") {
            return [];
        }

        throw Error(error);
    }
}

export function formatNumber(pNumber, pDecimals) {
    const str = pNumber.toFixed(pDecimals);

    return str.replace(/\.?0+$/gm, "");
}

export function formatTime(pMilliseconds) {
    let seconds = Math.floor(pMilliseconds / 1000);

    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;

    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;

    let time = [];

    if (hours > 0) {
        time.push(hours + "h");
    }

    if (minutes > 0) {
        time.push(minutes + "m");
    }

    if (seconds > 0 || time.length === 0) {
        time.push(seconds + "s");
    }

    return time.join("");
}

export function readLines(pPath, pCallback) {
    let inStream = createReadStream(pPath),
        outStream = new Writable();

    return new Promise((resolve, reject) => {
        const rl = createInterface(inStream, outStream);

        rl.on('line', (line) => {
            if (pCallback(line ? line.trim() : line) === false) {
                rl.close();
            }
        });

        rl.on('error', reject);

        rl.on('close', () => {
            resolve();
        });
    });
}

export function readLastHistoricEntry(pPath) {
    return new Promise((resolve, reject) => {
        let lastLine = false;

        readLines(pPath, (line) => {
            if (line) {
                line = line.replace(/^\d+,/gm, "");

                if (!line.endsWith("*")) {
                    lastLine = line;
                }
            }
        }).then(() => {
            resolve(lastLine);
        }).catch(reject);
    });
}

let cachedVersion = false;

export function getCommitVersion() {
    if (!cachedVersion) {
        try {
            let out = execSync("git rev-list --all --count");

            if (out instanceof Buffer) {
                out = out.toString();
            }

            const number = parseInt(out.trim());

            cachedVersion = number || false;
        } catch (e) {
            console.log("Could not get commit version", e);

            cachedVersion = false;
        }
    }

    return cachedVersion;
}
