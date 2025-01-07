import config from "./config.js";

import { decode, ExtensionCodec } from "@msgpack/msgpack";

const codec = new ExtensionCodec();

// vector2
codec.register({
	type: 20,
	decode: data => {
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

		return {
			x: view.getFloat32(0, true),
			y: view.getFloat32(4, true),
		};
	},
});

// vector3
codec.register({
	type: 21,
	decode: data => {
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

		return {
			x: view.getFloat32(0, true),
			y: view.getFloat32(4, true),
			z: view.getFloat32(8, true),
		};
	},
});

// vector4
codec.register({
	type: 22,
	decode: data => {
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

		return {
			x: view.getFloat32(0, true),
			y: view.getFloat32(4, true),
			z: view.getFloat32(8, true),
			w: view.getFloat32(12, true),
		};
	},
});

export async function requestOpFwApi(url, token) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(config.timeout || 1500),
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (response.status !== 200) {
		throw Error("http status code not 200");
	}

	const contentType = response.headers.get("content-type");

	switch (contentType) {
		case "text/plain":
			return await response.text();

		case "application/msgpack": {
			const buffer = await response.arrayBuffer();

			return decode(buffer, {
				extensionCodec: codec,
			});
		}
	}

	// Default is JSON
	const json = await response.json();

	if (!json || typeof json !== "object" || !("data" in json) || !("statusCode" in json)) {
		throw Error("invalid json returned");
	}

	if (json.statusCode !== 200) {
		throw Error("json status code not 200");
	}

	return json.data;
}
