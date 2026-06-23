// Rasterizes the hand-authored SVGs into the PNG app icons the manifest needs.
// Run: `npm run gen:icons` (requires the `sharp` devDependency).
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icons = join(root, "public", "icons");

const main = readFileSync(join(icons, "icon.svg"));
const maskable = readFileSync(join(icons, "icon-maskable.svg"));

const jobs = [
  [main, 192, "icon-192.png"],
  [main, 512, "icon-512.png"],
  [main, 180, "apple-touch-icon.png"],
  [maskable, 512, "icon-maskable-512.png"],
];

for (const [svg, size, name] of jobs) {
  await sharp(svg).resize(size, size).png().toFile(join(icons, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
console.log("All icons generated.");
