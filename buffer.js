import { appendFile, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

let buffers = {};

export function bufferCount() {
    return Object.keys(buffers).length;
}

export class BufferedWriter {
    static BufferSize = 8 * 1024; // 8 KB

    #path;
    #lock = false;
    #buffer = [];
    #size = 0;

    #interval;
    #timeout;

    constructor(path) {
        this.#path = path;

        const dir = dirname(path);

        if (!existsSync(dir)) {
            mkdirSync(dir, {
                recursive: true
            });
        }

        const random = Math.floor(Math.random() * 10000);

        setTimeout(() => {
            this.#interval = setInterval(() => {
                this.flush();
            }, 30 * 1000);
        }, random);
    }

    static fromFile(path) {
        if (path in buffers) {
            return buffers[path];
        }

        const writer = new BufferedWriter(path);

        buffers[path] = writer;

        return writer;
    }

    writeLine(data) {
        data += "\n";

        const len = Buffer.byteLength(data, "utf8");

        if (this.#size + len > BufferedWriter.BufferSize) {
            this.flush();
        }

        this.#buffer.push(data);
        this.#size += len;

        // Close and delete buffer after 10 minutes of inactivity
        clearTimeout(this.#timeout);
        setTimeout(() => {
            this.close();
        }, 10 * 60 * 1000);
    }

    flush() {
        if (this.#size === 0 || this.#lock) {
            return;
        }

        this.#lock = true;

        const data = this.#buffer.join("");

        this.#buffer = [];
        this.#size = 0;

        appendFile(this.#path, data, err => {
            this.#lock = false;

            if (err) {
                console.warn(`Failed to flush ${this.#path}: ${err.message}`);
            }
        });
    }

    close() {
        delete buffers[this.#path];

        clearInterval(this.#interval);

        this.flush();
    }
}

function flushAll() {
    for (const path in buffers) {
        buffers[path].close();
    }
}

["SIGINT", "SIGTERM", "SIGQUIT", "SIGHUP"].forEach(signal => {
    process.on(signal, () => {
        flushAll();

        process.exit(0);
    });
});

process.on("beforeExit", flushAll);