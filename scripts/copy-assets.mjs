import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const icons = [
  "nodes/FetchworksYoutubeTranscripts/fetchworks.svg",
  "credentials/fetchworks.svg",
];

for (const icon of icons) {
  const target = join(root, "dist", icon);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, icon), target);
}
