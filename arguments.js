import { parseArgs } from "util";

export function parseArguments() {
	const { values, positionals } = parseArgs({
		args: Bun.argv,
		options: {
			only: {
				type: "string"
			}
		},
		strict: true,
		allowPositionals: true
	});

    return values;
}
