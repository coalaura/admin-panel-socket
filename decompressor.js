function _encodeIntegerAlphabetically(current) {
	let newKey = current + 1;

	if (newKey === 0) {
		return "a";
	}

	const characters = [];

	while (newKey > 0) {
		const remainder = newKey % 26;

		characters.push(String.fromCharCode(remainder + 97));

		newKey = Math.floor(newKey / 26);
	}

	return characters.reverse().join("");
}

function _reconstructValue(value) {
	const valueType = typeof value;

	if (valueType === "string" && value.match(/^-?\d+(\.\d+)?(:-?\d+(\.\d+)?)+$/m)) {
		const values = value.split(":").map(num => parseFloat(num));

		const result = {
			x: values[0],
			y: values[1],
		};

		if (values.length > 2) {
			result.z = values[2];

			if (values.length > 3) {
				result.w = values[3];
			}
		}

		return result;
	}

	return value;
}

function _resolveDuplicates(rawDuplicateMap, data) {
	const duplicateMap = {};

	let current = -1;
	const duplicatePairs = rawDuplicateMap.split(";");

	for (const duplicate of duplicatePairs) {
		const replacement = _encodeIntegerAlphabetically(current);

		duplicateMap[replacement] = duplicate;

		current++;
	}

	const resolve = value => {
		const valueType = typeof value;

		if (valueType === "object") {
			if (Array.isArray(value)) {
				return value.map(value => resolve(value));
			} else {
				for (const key in value) {
					value[key] = resolve(value[key]);
				}
			}
		} else if (valueType === "string" && value.startsWith("_")) {
			const key = value.substring(1),
				original = duplicateMap[key];

			if (original) {
				return original;
			}
		}

		return value;
	};

	return resolve(data);
}

function _resolveKeys(pKeyMap, data) {
	const keyMap = {};

	let current = -1;
	const keyPairs = pKeyMap.split(";");

	for (const key of keyPairs) {
		const replacement = _encodeIntegerAlphabetically(current);

		keyMap[replacement] = key;

		current++;
	}

	const resolve = value => {
		const valueType = typeof value;

		if (valueType === "object") {
			if (Array.isArray(value)) {
				return value.map(value => resolve(value));
			}

			const decompressed = {};

			for (const key in value) {
				const newKey = keyMap[key] || key;

				decompressed[newKey] = resolve(value[key]);
			}

			return decompressed;
		}

		return _reconstructValue(value);
	};

	return resolve(data);
}

function _decompressData(data) {
	if (!data || !data.d) {
		return data;
	}

	const duplicateMap = data.m;

	let rawData = data.d;

	if (duplicateMap) {
		rawData = _resolveDuplicates(duplicateMap, rawData);
	}

	const keyMap = data.k || "";

	rawData = _resolveKeys(keyMap, rawData);

	return rawData;
}

export function decompressPlayers(data) {
	const decompressed = _decompressData(data);

	decompressed.world.baseTime = decompressed.world.baseTime || 0;
	decompressed.world.weather = decompressed.world.weather || "";
	decompressed.world.instance = decompressed.world.instance || 0;

	decompressed.players = decompressed.players
		? decompressed.players.map(pPlayer => {
				const character = pPlayer.character,
					vehicle = pPlayer.vehicle;

				return {
					source: pPlayer.source || 0,
					licenseIdentifier: pPlayer.licenseIdentifier || "",
					name: pPlayer.name || "",
					countryName: pPlayer.countryName || "",
					character: character
						? {
								id: character.id || 0,
								fullName: character.fullName || "",
								flags: character.flags || 0,
							}
						: false,
					coords: pPlayer.coords || {
						x: 0,
						y: 0,
						z: 0,
						w: 0,
					},
					vehicle: vehicle
						? {
								id: vehicle.id || 0,
								model: vehicle.model || "",
								driving: vehicle.driving || false,
								plate: vehicle.plate || "",
							}
						: false,
					speed: pPlayer.speed || 0,
					flags: pPlayer.flags || 0,
					instanceId: pPlayer.instanceId || 0,
					afkSince: pPlayer.afkSince || false,
				};
			})
		: [];

	return decompressed;
}
