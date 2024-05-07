import chalk from "chalk";

export function abort(resp, err) {
    resp.json({
        status: false,
        error: err
    });
}

export function rejectClient(client, err) {
    client.emit("message", err);

	client.disconnect(true);

	console.log(`${chalk.redBright("Rejected connection")} ${chalk.gray("from " + client.handshake.address + " for: " + err)}`);
}

export function formatNumber(pNumber, pDecimals) {
    const str = pNumber.toFixed(pDecimals);

    return str.replace(/\.?0+$/gm, "");
}