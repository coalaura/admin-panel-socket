import {createReadStream} from "fs";
import {createInterface} from "readline";
import {Writable} from "stream";

export function formatNumber(pNumber, pDecimals) {
    const str = pNumber.toFixed(pDecimals);

    return str.replace(/\.?0+$/gm, "");
}

export function readLastHistoricEntry(pPath) {
    let inStream = createReadStream(pPath),
        outStream = new Writable();

    return new Promise((resolve, reject) => {
        const rl = createInterface(inStream, outStream);

        let lastLine = false;

        rl.on('line', (line) => {
            if (line) {
                line = line.trim().replace(/^\d+,/gm, "");

                if (!line.endsWith("*")) {
                    lastLine = line;
                }
            }
        });

        rl.on('error', reject);

        rl.on('close', () => {
            resolve(lastLine);
        });
    })
}