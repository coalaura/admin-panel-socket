function _reconstructValue(pValue) {
	const valueType = typeof pValue;

	if (valueType === "string" && pValue.match(/^-?\d+(\.\d+)?(;-?\d+(\.\d+)?)+$/m)) {
		const values = pValue.split(";").map(pNumber => parseFloat(pNumber));

		let result = {
			x: values[0],
			y: values[1]
		};

		if (values.length > 2) {
			result.z = values[2];

			if (values.length > 3) {
				result.w = values[3];
			}
		}

		return result;
	}

	return pValue;
}

function _resolveDuplicates(pDuplicateMap, pData) {
	let resolve = pValue => {
		const valueType = typeof pValue;

		if (valueType === "object") {
			if (Array.isArray(pValue)) {
				return pValue.map(pValue => resolve(pValue));
			} else {
				for (const key in pValue) {
					pValue[key] = resolve(pValue[key]);
				}
			}
		} else if (valueType === "string" && pValue.startsWith("_")) {
			const key = pValue.substring(1),
				original = pDuplicateMap[key];

			if (original) {
				return original;
			}
		}

		return pValue;
	};

	return resolve(pData)
}

function _resolveKeys(pKeyMap, pData) {
	let keyMap = {};

	pKeyMap.split(";").forEach(pPair => {
		const pair = pPair.split(":");

		keyMap[pair[1]] = pair[0];
	});

	let resolve = pValue => {
		const valueType = typeof pValue;

		if (valueType === "object") {
			if (Array.isArray(pValue)) {
				return pValue.map(pValue => resolve(pValue));
			}

			let decompressed = {};

			for (const key in pValue) {
				const newKey = keyMap[key] || key;

				decompressed[newKey] = resolve(pValue[key]);
			}

			return decompressed;
		}

		return _reconstructValue(pValue)
	};

	return resolve(pData);
}

function _decompressData(pData) {
	if (!pData || !pData.d) {
		return pData;
	}

	const duplicateMap = pData.m;

	let rawData = pData.d;

	if (duplicateMap) {
		rawData = _resolveDuplicates(duplicateMap, rawData);
	}

	const keyMap = pData.k || "";

	rawData = _resolveKeys(keyMap, rawData);

	return rawData;
}

export function decompressPlayers(pData) {
	const decompressed = _decompressData(pData);

	decompressed.world.baseTime = decompressed.world.baseTime || 0;
	decompressed.world.weather = decompressed.world.weather || "";

	decompressed.players = decompressed.players.map(pPlayer => {
		const character = pPlayer.character,
			vehicle = pPlayer.vehicle;

		return {
			source: pPlayer.source || 0,
			licenseIdentifier: pPlayer.licenseIdentifier || "",
			name: pPlayer.name || "",
			countryName: pPlayer.countryName || "",
			character: character ? {
				id: character.id || 0,
				fullName: character.fullName || "",
				flags: character.flags || 0
			} : false,
			coords: pPlayer.coords || {
				x: 0,
				y: 0,
				z: 0,
				w: 0
			},
			vehicle: vehicle ? {
				id: vehicle.id || 0,
				model: vehicle.model || "",
				driving: vehicle.driving || false,
				plate: vehicle.plate || ""
			} : false,
			speed: pPlayer.speed || 0,
			flags: pPlayer.flags || 0,
			instanceId: pPlayer.instanceId || 0,
			afkSince: pPlayer.afkSince || false
		};
	});

	return decompressed;
}
