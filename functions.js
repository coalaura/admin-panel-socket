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