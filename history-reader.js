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
                    path: line[0],
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
        outStream = new Writable(),
        rl = createInterface(inStream, outStream);

    const close = () => {
        rl.close();

        inStream.close();
        outStream.end();
    };

    return new Promise((resolve, reject) => {
        rl.on("line", line => {
            if (callback(line ? line.trim() : line) === false) {
                close();
            }
        });

        rl.on("error", err => {
            reject(err);

            close();
        });

        rl.on("close", () => {
            resolve();

            close();
        });
    });
}