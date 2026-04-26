import { readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));

const audioDir = join(__dirname, "..", "public", "audio");
console.log("Audio dir:", audioDir);

const files = readdirSync(audioDir);
console.log("Files found:");
for (const f of files) {
  const codes = [...f].map(c => `${c}(U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4,"0")})`).join(" ");
  console.log(`  "${f}" | chars: ${codes}`);
  const full = join(audioDir, f);
  console.log(`  size: ${statSync(full).size} bytes`);
}
