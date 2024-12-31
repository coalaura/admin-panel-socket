import { info, muted } from "./colors.js";

import { appendFile, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class BufferedWriter {
    static EntryCount = 120; // 120 seconds for minimal data loss
    static EntrySize = 36; // 4 ui32 + 5 f32

    #offset = 0;
    #buffer;
    #view;

    #path;
    #directory;
    #timeout;

    constructor(path) {
        this.#path = path;
        this.#directory = dirname(path);

        this.#reset();
    }

    setPath(path) {
        if (this.#path === path) return;

        this.#flush();

        this.#path = path;
        this.#directory = dirname(path);
    }

    #reset() {
        this.#offset = 0;

        if (!this.#buffer) {
            const staggering = Math.floor(Math.random() * 30);

            this.#buffer = new ArrayBuffer((BufferedWriter.EntryCount + staggering) * BufferedWriter.EntrySize);

            this.#view = new DataView(this.#buffer);
        }
    }

    #flush(wait = false) {
        if (this.#offset === 0) return;

        if (!existsSync(this.#directory)) {
            mkdirSync(this.#directory, {
                recursive: true
            });
        }

        const data = this.#buffer.slice(0, this.#offset);

        if (wait) {
            try {
                appendFileSync(this.#path, data);
            } catch (err) {
                console.warn(`${info(`Failed to flush ${this.#path}:`)} ${muted(err.message)}`);
            }
        } else {
            appendFile(this.#path, data, err => {
                if (!err) return;

                console.warn(`${info(`Failed to flush ${this.#path}:`)} ${muted(err.message)}`);
            });
        }

        this.#reset();
    }

    #schedule() {
        clearTimeout(this.#timeout);

        this.#timeout = setTimeout(() => {
            this.#flush();
        }, 30 * 1000); // 30 seconds of inactivity
    }

    writeUint32(ui32) {
        if (this.#offset + 4 > this.#buffer.byteLength) {
            this.#flush();
        }

        this.#view.setUint32(this.#offset, ui32, true);
        this.#offset += 4;

        this.#schedule();
    }

    writeFloat32(f32) {
        if (this.#offset + 4 > this.#buffer.byteLength) {
            this.#flush();
        }

        this.#view.setFloat32(this.#offset, f32, true);
        this.#offset += 4;

        this.#schedule();
    }

    close() {
        clearTimeout(this.#timeout);

        this.#flush(true);
    }
};
