function _encodeIntegerAlphabetically(pCurrent) {
	let newKey = pCurrent + 1;

	if (newKey === 0) {
		return "a";
	}

	let keyString = "";

	while (newKey > 0) {
		let quotient = Math.floor(newKey / 26);
		let remainder = newKey % 26;

		keyString = String.fromCharCode(remainder + 97) + keyString;

		newKey = quotient;
	}

	return keyString;
}

function _reconstructValue(pValue) {
	const valueType = typeof pValue;

	if (valueType === "string" && pValue.match(/^-?\d+(\.\d+)?(:-?\d+(\.\d+)?)+$/m)) {
		const values = pValue.split(":").map(pNumber => parseFloat(pNumber));

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
	let duplicateMap = {};

	let current = -1;
	let duplicatePairs = pDuplicateMap.split(";");

	for (const duplicate of duplicatePairs) {
		let replacement = _encodeIntegerAlphabetically(current);

		duplicateMap[replacement] = duplicate;

		current++;
	}

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
				original = duplicateMap[key];

			if (original) {
				return original;
			}
		}

		return pValue;
	};

	return resolve(pData);
}

function _resolveKeys(pKeyMap, pData) {
	let keyMap = {};

	let current = -1;
	let keyPairs = pKeyMap.split(";");

	for (const key of keyPairs) {
		const replacement = _encodeIntegerAlphabetically(current);

		keyMap[replacement] = key;

		current++;
	}

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

	decompressed.players = decompressed.players ? decompressed.players.map(pPlayer => {
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
	}) : [];

	return decompressed;
}
