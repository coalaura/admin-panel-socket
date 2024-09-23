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

    static fromFile(path, lifetime) {
        if (path in buffers) {
            return buffers[path];
        }

        const writer = new BufferedWriter(path);
        buffers[path] = writer;

        setTimeout(() => {
            writer.close();
        }, (lifetime - Date.now()) + 4000)

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

        this.#stream.close();
    }
}

["SIGINT", "SIGTERM", "SIGQUIT", "SIGHUP", "exit"].forEach(signal => {
    process.on(signal, () => {
        for (const path in buffers) {
            buffers[path].close();
        }

        process.exit(0);
    });
});