import config from "./config.js";
import { info, muted, request, warning } from "./colors.js";
import { abort } from "./functions.js";

import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { decode, verify } from "jsonwebtoken";
import { hasFunctioningDatabase } from "./database.js";

const secrets = {};

function resolveSecret(cluster) {
	if (cluster in secrets) {
		return secrets[cluster];
	}

	let secret;

	const path = join(config.panel, "envs", cluster, ".jwt");

	if (existsSync(path)) {
		secret = Buffer.from(readFileSync(path, "utf8"), "base64");
	} else {
		secret = randomBytes(48);

		writeFileSync(path, secret.toString("base64"));
	}

	secrets[cluster] = secret;

	return secret;
}

export async function checkAuth(cluster, token, ip) {
	if (config.allowLocal && (ip === "127.0.0.1" || ip.endsWith(":127.0.0.1"))) {
		return {
			name: "Local",
			discord: "123456789012345678",
		};
	}

	if (!cluster || !token) {
		console.debug(muted("fail [-]: no token or cluster"));

		return false;
	}

	if (!config.servers.includes(cluster)) {
		console.debug(muted(`fail [${getNameFromJwt(token) || "n/a"}]: unknown cluster`));

		return false;
	}

	if (!hasFunctioningDatabase(cluster)) {
		console.debug(muted(`fail [${getNameFromJwt(token) || "n/a"}]: failed cluster`));

		return false;
	}

	const session = await isValidToken(cluster, token);

	if (!session) {
		return false;
	}

	return session;
}

export function parseServer(server) {
	if (server?.match(/^c\d+$/m)) {
		// We got only the cluster :(

		return {
			cluster: server,
		};
	}

	if (!server || !server.match(/^c\d+s\d+$/m)) {
		return false;
	}

	const match = server.match(/^(c\d+)s(\d+)$/m),
		cluster = match[1],
		shard = parseInt(match[2]);

	return {
		cluster: cluster,
		server: cluster + (shard > 1 ? `s${shard}` : ""),
	};
}

export async function authenticate(req, resp, next) {
	const server = parseServer(req.params.server);

	if (!server) {
		return abort(resp, "invalid server");
	}

	const session = await checkAuth(server.cluster, req.query.token, req.ip);

	if (!session) {
		return abort(resp, "unauthorized");
	}

	console.log(request(req.method, req.url, session.name));

	req.cluster = server.cluster;
	req.server = server.server;
	req.session = session;

	next();
}

async function isValidToken(cluster, token) {
	const secret = resolveSecret(cluster);

	try {
		const verified = verify(token, secret, { algorithms: ["HS384"] });

		if (!verified.dsc || !verified.nme || !verified.lcs) {
			throw new Error("missing discord, name or license in jwt token (how?)");
		}

		return {
			license: verified.lcs,
			discord: verified.dsc,
			name: verified.nme,
		};
	} catch (e) {
		console.debug(muted(`fail [${getNameFromJwt(token) || "n/a"}]: ${e}`));

		return false;
	}
}

function getNameFromJwt(token) {
	try {
		const decoded = decode(token);

		return decoded?.nme;
	} catch {}

	return false;
}
