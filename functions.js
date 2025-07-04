import { muted, warning } from "./colors.js";

export function abort(resp, err) {
	resp.json({
		status: false,
		error: err,
	});
}

export function rejectClient(socket, code, err) {
	socket.write(`HTTP/1.1 ${code} ${err}\r\n\r\n`);
	socket.destroy();

	console.log(`${warning("Rejected connection")} ${muted(`from ${socket.remoteAddress} for: ${err}`)}`);
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

export function round(num, by) {
	if (num === 0) {
		return num;
	}

	return Math.floor(Math.round(num * by) / by);
}

export function formatDuration(amount, unit = "s", min = false) {
	const units = [
			["yr", 31536000],
			["mo", 2592000],
			["d", 86400],
			["h", 3600],
			["m", 60],
			["s", 1],
			["ms", 0.001],
		],
		convert = units.find(ut => ut[0] === unit);

	if (!convert) {
		throw new Error(`invalid unit "${unit}"`);
	}

	const neg = amount < 0;

	amount = neg ? -amount : amount;

	let seconds = amount * convert[1];

	const time = [];

	for (const unit of units) {
		const [name, multi] = unit;

		if (seconds >= multi) {
			const sub = Math.floor(seconds / multi);

			time.push(`${sub}${name}`);

			seconds -= sub * multi;
		}

		if (min && name === min) break;
	}

	if (time.length === 0) {
		return min ? `~0${min}` : "-";
	}

	return (neg ? "-" : "") + time.join("");
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
		`${seconds} second${seconds > 1 ? "s" : ""}`,
	]
		.filter(Boolean)
		.join(" ");
}
