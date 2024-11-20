import { muted, warning } from "./colors.js";

export function abort(resp, err) {
	resp.json({
		status: false,
		error: err
	});
}

export function rejectClient(client, err) {
	client.emit("message", err);

	client.disconnect(true);

	console.log(`${warning("Rejected connection")} ${muted("from " + client.handshake.address + " for: " + err)}`);
}

export function formatNumber(pNumber, pDecimals) {
	const str = pNumber.toFixed(pDecimals);

	return str.replace(/\.?0+$/gm, "");
}

export function reverse(array) {
	if (array.toReversed !== undefined) return array.toReversed();

	let reversed = [];

	for (let x = array.length - 1; x >= 0; x--) {
		reversed.push(array[x]);
	}

	return reversed;
}

export function formatBytes(bytes) {
	if (bytes === 0) return "0 B";

	const sizes = ["B", "KB", "MB", "GB", "TB"],
        i = Math.floor(Math.log(bytes) / Math.log(1024));

	return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
