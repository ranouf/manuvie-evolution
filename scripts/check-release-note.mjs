import fs from "node:fs";

const { version } = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const path = `release-notes/v${version}.md`;
if (!fs.existsSync(path)) throw new Error(`Release note manquante: ${path}`);
console.log(path);
