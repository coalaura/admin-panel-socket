import { requestOpFwApi } from "./http.js";

export async function loadOnDutyData(server) {
    const data = await requestOpFwApi(`${server.url}/op-framework/duty.json`, server.token);

    let map = {};

    if ("Law Enforcement" in data) {
        const police = data["Law Enforcement"];

        for (let x = 0; x < police.length; x++) {
            let entry = police[x];

            entry.type = "police";

            map[entry.licenseIdentifier] = entry;
        }
    }

    if ("Medical" in data) {
        const ems = data["Medical"];

        for (let x = 0; x < ems.length; x++) {
            let entry = ems[x];

            entry.type = "medical";

            map[entry.licenseIdentifier] = entry;
        }
    }

    return map;
}
