import { createReadStream } from "fs";
import { createInterface } from "readline";
import { Writable } from "stream";
import { execSync } from "child_process";

export function findHistoryFilesWithTimestamp(path, startWith) {
    try {
        const out = execSync(`grep -rnw "${path}" -e "^${startWith}"`).toString(),
            lines = out.trim().split("\n");

        let result = [];

        for (let x = 0; x < lines.length; x++) {
            const line = lines[x].split(":");

            if (line.length === 3) {
                result.push({
                    file: line[0],
                    line: line[1],
                    entry: line[2]
                });
            }
        }

        return result;
    } catch (e) {
        if (!e.stderr) {
            return [];
        }

        throw Error(e.stderr.toString().trim());
    }
}

export function readFileLineByLine(path, callback) {
    let inStream = createReadStream(path),
        outStream = new Writable();

    return new Promise((resolve, reject) => {
        const rl = createInterface(inStream, outStream);

        rl.on("line", line => {
            if (callback(line ? line.trim() : line) === false) {
                rl.close();
            }
        });

        rl.on("error", reject);

        rl.on("close", () => {
            resolve();
        });
    });
}