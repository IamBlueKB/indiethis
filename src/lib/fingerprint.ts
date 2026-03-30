import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID, createHash } from "crypto";
import { db } from "@/lib/db";

const execFileAsync = promisify(execFile);

async function downloadToTemp(url: string): Promise<string> {
  const tmpPath = join(tmpdir(), `${randomUUID()}.audio`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(tmpPath, buffer);
  return tmpPath;
}

async function getFpcalcResult(filePath: string): Promise<{ fingerprint: string; duration: number } | null> {
  try {
    const { stdout } = await execFileAsync("fpcalc", ["-raw", filePath], { timeout: 30000 });
    const fpMatch = stdout.match(/FINGERPRINT=(.+)/);
    const durMatch = stdout.match(/DURATION=([0-9.]+)/);
    if (!fpMatch || !durMatch) return null;
    return { fingerprint: fpMatch[1].trim(), duration: parseFloat(durMatch[1]) };
  } catch {
    return null; // fpcalc not available
  }
}

async function getSha256Fingerprint(filePath: string): Promise<{ fingerprint: string; duration: number }> {
  const buffer = await readFile(filePath);
  const hash = createHash("sha256").update(buffer).digest("hex");

  // Try to get duration from music-metadata
  let duration = 0;
  try {
    const { parseFile } = await import("music-metadata");
    const meta = await parseFile(filePath);
    duration = meta.format.duration ?? 0;
  } catch { /* best effort */ }

  return { fingerprint: `sha256:${hash}`, duration };
}

export async function fingerprintTrack(trackId: string, audioUrl: string): Promise<void> {
  let tmpPath: string | null = null;
  const isRemote = audioUrl.startsWith("http://") || audioUrl.startsWith("https://");
  try {
    // Download remote file or use local path directly
    if (isRemote) {
      tmpPath = await downloadToTemp(audioUrl);
    } else {
      tmpPath = audioUrl;
    }

    // Try fpcalc first (local dev), fall back to SHA-256 (Vercel)
    const result = (await getFpcalcResult(tmpPath)) ?? (await getSha256Fingerprint(tmpPath));

    await db.audioFingerprint.upsert({
      where: { trackId },
      update: { fingerprint: result.fingerprint, duration: result.duration },
      create: { trackId, fingerprint: result.fingerprint, duration: result.duration },
    });
  } catch (err) {
    console.error(`[fingerprint] Failed for track ${trackId}:`, err);
  } finally {
    // Clean up temp file only if we created it
    if (tmpPath && isRemote) {
      await unlink(tmpPath).catch(() => {});
    }
  }
}
