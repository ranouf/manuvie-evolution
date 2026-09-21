import fs from "node:fs";
import path from "node:path";
import yazl from "yazl";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const outputDirectory = "dist";
const outputPath = path.join(outputDirectory, `manuvie-evolution-${manifest.version}.zip`);
const chromeStorePath = path.join(
  outputDirectory,
  `manuvie-evolution-${manifest.version}-chrome-store.zip`,
);
const files = [
  "manifest.json",
  "PRIVACY.md",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "src/analytics.js",
  "src/content.js",
  "src/network-bridge.js",
  "src/styles.css",
];

fs.mkdirSync(outputDirectory, { recursive: true });
await zipFiles(outputPath);
await zipFiles(chromeStorePath);
console.log(outputPath);
console.log(chromeStorePath);

async function zipFiles(destination) {
  const zip = new yazl.ZipFile();
  for (const file of files) zip.addFile(file, file.replaceAll("\\", "/"));
  zip.end();
  await new Promise((resolve, reject) => {
    zip.outputStream
      .pipe(fs.createWriteStream(destination))
      .on("close", resolve)
      .on("error", reject);
  });
}
