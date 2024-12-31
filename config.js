import { readFileSync } from "node:fs";

const configData = JSON.parse(readFileSync("./_config.json", "utf8"));

export default configData;
