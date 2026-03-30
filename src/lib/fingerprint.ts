import { exec } from "child_process";
import { promisify } from "util";
import { db } from "@/lib/db";

const execAsync = promisify(exec);

export async function generateFingerprint(audioFilePath: string): Promise<{ fingerprint: string; duration: number } | null> {
  try {
    const { stdout } = await execAsync(`fpcalc -raw "${audioFilePath}"`);
    const fpMatch = stdout.match(/FINGERPRINT=(.+)/);
    const durMatch = stdout.match(/DURATION=(\d+)/);
    if (!fpMatch || !durMatch) return null;
    return { fingerprint: fpMatch[1].trim(), duration: parseInt(durMatch[1]) };
  } catch {
    // fpcalc not installed or failed — skip silently
    return null;
  }
}

export async function fingerprintTrack(trackId: string, audioFilePath: string): Promise<void> {
  const result = await generateFingerprint(audioFilePath);
  if (!result) return;
  await db.audioFingerprint.upsert({
    where: { trackId },
    update: { fingerprint: result.fingerprint, duration: result.duration },
    create: { trackId, fingerprint: result.fingerprint, duration: result.duration },
  });
}
