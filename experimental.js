import { resolveHistoricData } from "./resolve.js";

export async function collectBans(pServer, pBans) {
	const bans = {};

	for (const ban of pBans) {
		const from = ban.timestamp - 30,
			till = ban.timestamp,
			licenseIdentifier = ban.identifier.replace("license:", "");

		try {
			const data = await resolveHistoricData(pServer, licenseIdentifier, from, till);

			bans[licenseIdentifier] = Object.values(data).map(pEntry => {
				return [pEntry.x, pEntry.y, pEntry.z];
			});
		} catch(e) {}
	}

	return bans;
}
