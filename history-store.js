import moment from "moment";
import { join } from "path";

import { formatNumber } from "./functions.js";
import { BufferedWriter } from "./buffer.js";

export function trackHistoricData(server, player) {
    const character = player.character || false;

    if (!character) {
        return;
    }

    if (!(character.flags & 64)) {
        return; // Not spawned in
    }

    const coords = player.coords,
        now = moment().utc();

    // Prepare the entry
    const entry = `${now.unix()},${character.id},${formatNumber(coords.x, 1)},${formatNumber(coords.y, 1)},${formatNumber(coords.z, 1)},${formatNumber(coords.w, 1)},${character.flags},${player.flags},${player.speed.toFixed(2)}`;

    // Write the entry
    const date = now.format("DD-MM-YYYY"),
        license = player.licenseIdentifier.replace("license:", "");

    const path = join("historic", server, date, license + ".csv");

    BufferedWriter.fromFile(path).writeLine(entry);
}