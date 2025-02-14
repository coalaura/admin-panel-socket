import config from "./config.js";
import { info, muted, request, warning } from "./colors.js";
import { getDatabase } from "./database.js";
import { abort } from "./functions.js";

const sessions = {};

export async function checkAuth(cluster, token, ip) {
	if (config.allowLocal && (ip === "127.0.0.1" || ip.endsWith(":127.0.0.1"))) {
		return {
			local: true,
			name: "Local",
			discord: "123456789012345678",
		};
	}

	if (!cluster || !token) {
		return false;
	}

	const session = await isValidToken(cluster, token);

	if (!session) {
		return false;
	}

	if (!config.servers.includes(cluster)) {
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
		return abort(resp, "Invalid server");
	}

	const session = await checkAuth(server.cluster, req.query.token, req.ip);

	if (!session) {
		return abort(resp, "Unauthorized");
	}

	// Validation of additional params (if sent)
	const license = req.params.license;

	if (license && !isValidLicense(license)) {
		return abort(resp, "Invalid license");
	}

	console.log(request(req.method, req.url, session.name));

	req.cluster = server.cluster;
	req.server = server.server;
	req.session = session;
	req.license = license;

	next();
}

async function isValidToken(cluster, token) {
	if (!config.servers.includes(cluster)) {
		return false;
	}

	if (!token || !token.match(/^[a-z0-9]{30}$/m)) {
		return false;
	}

	if (token in sessions) {
		return sessions[token];
	}

	const database = getDatabase(cluster);

	if (!database) {
		return false;
	}

	try {
		const sessions = await database.query("SELECT `key`, `data` FROM `webpanel_sessions` WHERE `key` = ?", [token]);

		if (!sessions || !sessions.length) {
			return false;
		}

		const session = sessions[0];

		const data = JSON.parse(session.data);

		if (!data || !data.user || !data.discord) {
			return false;
		}

		sessions[token] = {
			name: data.name,
			discord: data.discord.id,
		};

		setTimeout(() => {
			delete sessions[token];
		}, 10 * 1000);

		return sessions[token];
	} catch (e) {
		console.error(`${warning("Failed to validate session")} ${info(cluster)}: ${muted(e)}`);
	}

	return false;
}

export function isValidLicense(license) {
	if (!license) {
		return false;
	}

	if (license.startsWith("license:")) {
		license = license.replace("license:", "");
	}

	return license.match(/^[a-z0-9]{40}$/gm);
}
