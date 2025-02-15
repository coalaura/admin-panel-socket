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

	console.log(`${warning("Rejected connection")} ${muted(`from ${client.handshake.address} for: ${err}`)}`);
}

export function formatNumber(pNumber, pDecimals) {
	const str = pNumber.toFixed(pDecimals);

	return str.replace(/\.?0+$/gm, "");
}

export function formatInteger(pNumber) {
	return Intl.NumberFormat("en-US").format(pNumber);
}

export function reverse(array) {
	if (array.toReversed !== undefined) return array.toReversed();

	const reversed = [];

	for (let x = array.length - 1; x >= 0; x--) {
		reversed.push(array[x]);
	}

	return reversed;
}

export function equals(a, b) {
	const typeA = typeof a,
		typeB = typeof b;

	if (typeA !== typeB) {
		return false;
	} else if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) {
			return false;
		}

		for (let x = 0; x < a.length; x++) {
			if (!equals(a[x], b[x])) {
				return false;
			}
		}

		return true;
	} else if (typeA === "object") {
		if (a === null && b === null) {
			return true;
		} else if (a === null || b === null) {
			return false;
		}

		if (Object.keys(a).length !== Object.keys(b).length) {
			return false;
		}

		for (const key in a) {
			if (!equals(a[key], b[key])) {
				return false;
			}
		}

		return true;
	}

	return a === b;
}

export function formatUptime(since) {
	let seconds = Math.floor((Date.now() - since) / 1000);

	let minutes = Math.floor(seconds / 60);
	seconds = seconds % 60;

	let hours = Math.floor(minutes / 60);
	minutes = minutes % 60;

	const days = Math.floor(hours / 24);
	hours = hours % 24;

	return [
		days ? `${days} day${days > 1 ? "s" : ""}` : false,
		hours ? `${hours} hour${hours > 1 ? "s" : ""}` : false,
		minutes ? `${minutes} minute${minutes > 1 ? "s" : ""}` : false,
		`${seconds} second${seconds > 1 ? "s" : ""}`
	].filter(Boolean).join(" ")
}
