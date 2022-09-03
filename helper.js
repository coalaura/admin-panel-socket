import {createReadStream} from "fs";
import {createInterface} from "readline";
import {Writable} from "stream";

export function formatNumber(pNumber, pDecimals) {
    const str = pNumber.toFixed(pDecimals);

    return str.replace(/\.?0+$/gm, "");
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