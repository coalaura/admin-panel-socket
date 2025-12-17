export function diff(before, after) {
	const compare = (df, a, b) => {
		if (Array.isArray(a)) {
			if (equals(a, b)) {
				return [];
			}

			return a;
		}

		if (typeof a === "object") {
			df = {};

			const bValid = typeof b === "object" && b !== null;

			for (const key in a) {
				const newValue = a[key],
					oldValue = bValid ? b[key] : null;

				const newType = typeof newValue,
					oldType = typeof oldValue;

				if (newType !== oldType) {
					if (newType === "undefined" || newValue === null) {
						df[key] = null;
					} else {
						df[key] = newValue;
					}
				} else if (newType === "object") {
					const newDiff = compare(df[key], newValue, oldValue);

					if (Object.keys(newDiff).length) {
						df[key] = newDiff;
					}
				} else if (newValue !== oldValue) {
					df[key] = newValue;
				}
			}

			return df;
		}

		return a;
	};

	return compare({}, after, before);
}

export function equals(a, b) {
	const typeA = typeof a,
		typeB = typeof b;

	if (typeA !== typeB) {
		return false;
	}
	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) {
			return false;
		}

		for (let x = 0; x < a.length; x++) {
			if (!equals(a[x], b[x])) {
				return false;
			}
		}

		return true;
	}
	if (typeA === "object") {
		if (a === null && b === null) {
			return true;
		}
		if (a === null || b === null) {
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
