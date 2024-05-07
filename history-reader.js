import { createReadStream } from "fs";
import { createInterface } from "readline";
import { Writable } from "stream";
import { execSync } from "child_process";

export function findFiles(path, startWith) {
    try {
        const out = execSync(`grep -rnw '${path}' -e '^${startWith}'`).toString(),
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

export function readLines(path, callback) {
    let inStream = createReadStream(path),
        outStream = new Writable();

    return new Promise((resolve, reject) => {
        const rl = createInterface(inStream, outStream);

        rl.on('line', line => {
            if (callback(line ? line.trim() : line) === false) {
                rl.close();
            }
        });

        rl.on('error', reject);

        rl.on('close', () => {
            resolve();
        });
    });
}

export function readLastHistoricEntry(path) {
    return new Promise((resolve, reject) => {
        let lastLine = false;

        readLines(path, line => {
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