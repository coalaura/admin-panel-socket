import { serve } from "bun";
import { getRunningSlaves } from "./master";

const banner = `{slaves}

 \\    /\\
  )  ( ')
 (  /  )
  \\(__)|`;

export function stayHealthy() {
	serve({
		port: 9998,
		fetch(req) {
            const slaves = getRunningSlaves().join(",");

			return new Response(banner.replace("{slaves}", slaves), {
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
