import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lines = readFileSync(path.join(__dirname, "../.env.local"), "utf8").split("\n");
for (const line of lines) {
  const m = line.match(/^([^#=]+)=(.*)/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const require = createRequire(import.meta.url);
const { getRenderProgress } = require("@remotion/lambda/client");

const url    = process.env.REMOTION_SERVE_URL ?? "";
const bucket = url.match(/^https?:\/\/([^.]+)\.s3\./)?.[1] ?? "";

const p = await getRenderProgress({
  renderId:     "pespg7ztph",
  bucketName:   bucket,
  region:       process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1",
  functionName: process.env.REMOTION_FUNCTION_NAME,
});

console.log("done:", p.done);
console.log("overallProgress:", p.overallProgress);
console.log("outputFile:", p.outputFile);
console.log("fatalErrorEncountered:", p.fatalErrorEncountered);
if (p.errors?.length) console.log("errors:", JSON.stringify(p.errors));
