import { serve, unlinkSync } from "bun";
import os from "os";

export function stayHealthy() {
    if (os.platform() === "win32") return;

	serve({
		unix: "/tmp/op-fw.sock",
		fetch(req) {
            return new Response(":)");
		}
	});

    process.on("exit", () => {
        unlinkSync("/tmp/op-fw.sock");
    });
}
