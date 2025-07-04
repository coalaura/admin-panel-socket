import { readFileSync } from "node:fs";

const configData = JSON.parse(readFileSync("./_config.json", "utf8"));

if (process.env.DOCKER_MODE) {
	const cluster = process.env.CLUSTER;

	if (!cluster) throw new Error("missing cluster");

	configData.docker = true;
	configData.panel = "/etc/opfw-config";
	configData.servers = [cluster];

	console.log(`Docker mode enabled with cluster ${cluster}!`);
}

export default configData;
