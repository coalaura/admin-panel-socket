import { createWriteStream, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

let buffers = {};

export class BufferedWriter {
    static BufferSize = 8 * 1024; // 8 KB

    #path;
    #stream;
    #buffer;
    #size;

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

        this.#stream = createWriteStream(path, {
            flags: "a",
            highWaterMark: BufferedWriter.BufferSize
        });

        this.#stream.on("drain", () => {
            this.flush();
        });

        this.#stream.on("error", () => {
            console.warn(`Failed to write to ${path}`);

            this.close();
        });

        this.#buffer = [];
        this.#size = 0;

        const random = Math.floor(Math.random() * 5000);

        setTimeout(() => {
            this.#interval = setInterval(() => {
                this.flush();
            }, 20 * 1000);
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

        // Close after 5 minutes of inactivity
        clearTimeout(this.#timeout);
        setTimeout(() => {
            this.close();
        }, 5 * 60 * 1000);
    }

    flush() {
        if (this.#size === 0) {
            return;
        }

        const data = this.#buffer.join("");

        this.#buffer = [];
        this.#size = 0;

        this.#stream.write(data, "utf8");
    }

    close() {
        delete buffers[this.#path];

        clearInterval(this.#interval);

        this.flush();

        this.#stream.end();
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