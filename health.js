import { serve } from "bun";

export function stayHealthy() {
	serve({
		port: 9998,
		fetch(req) {
			return new Response("OK", {
				status: 202
			});
		},
        error(error) {
            return new Response(error.message, {
                status: 503
            });
        }
	});
}
