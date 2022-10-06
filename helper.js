import {readFileSync} from "fs";
import {execSync} from "child_process";

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

export async function readLines(pPath, pCallback) {
    const contents = readFileSync(pPath).toString(),
        lines = contents.split(/\r?\n/g);

    for (const line of lines) {
        if (pCallback(line ? line.trim() : line) === false) {
            break;
        }
    }
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
