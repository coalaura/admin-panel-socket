import { readFileSync } from "node:fs";

const configData = JSON.parse(readFileSync("./_config.json", "utf8"));

if (process.env.DOCKER_MODE) {
	const cluster = process.env.DOCKER_CLUSTER,
		influxToken = process.env.DOCKER_INFLUX_TOKEN;

	if (!cluster) {
		throw new Error("missing cluster");
	}

	configData.docker = true;
	configData.panel = "/etc/opfw-config";
	configData.servers = [cluster];

	configData.influx = influxToken
		? {
				url: "http://influxdb:8086",
				token: influxToken,
			}
		: null;

	console.log(`Docker mode enabled with cluster ${cluster}!`);
}

export default configData;
