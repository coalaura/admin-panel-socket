import { readFileSync } from "fs";

const configData = JSON.parse(readFileSync("./_config.json", "utf8"));

export default configData;