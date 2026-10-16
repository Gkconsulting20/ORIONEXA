import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, ".cloudflare-assets");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const source of ["public", "views", path.join("data", "newsletters")]) {
  await cp(path.join(projectRoot, source), path.join(outputDir, source), {
    recursive: true
  });
}

console.log("Cloudflare static assets prepared.");
