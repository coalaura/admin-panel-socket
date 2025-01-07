import { encode, decode, ExtensionCodec } from "@msgpack/msgpack";

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

// quaternion
codec.register({
	type: 23,
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

export function unpack(data) {
	return decode(data, {
        extensionCodec: codec,
    });
}

export function pack(data) {
	return encode(data);
}
