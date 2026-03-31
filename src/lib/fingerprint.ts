import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";

const execFileAsync = promisify(execFile);

const ACRCLOUD_BASE = "https://eu-api-v2.acrcloud.com";

async function downloadToTemp(url: string): Promise<string> {
  const tmpPath = join(tmpdir(), `${randomUUID()}.audio`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(tmpPath, buffer);
  return tmpPath;
}

async function getFpcalcResult(
  filePath: string,
): Promise<{ fingerprint: string; duration: number } | null> {
  try {
    const { stdout } = await execFileAsync("fpcalc", ["-raw", filePath], {
      timeout: 30000,
    });
    const fpMatch = stdout.match(/FINGERPRINT=(.+)/);
    const durMatch = stdout.match(/DURATION=([0-9.]+)/);
    if (!fpMatch || !durMatch) return null;
    return {
      fingerprint: fpMatch[1].trim(),
      duration: parseFloat(durMatch[1]),
    };
  } catch {
    return null; // fpcalc not available on Vercel
  }
}

async function getAcrCloudFingerprint(
  audioUrl: string,
): Promise<{ fingerprint: string; duration: number }> {
  const token = process.env.ACRCLOUD_TOKEN;
  if (!token) throw new Error("ACRCLOUD_TOKEN is not configured");

  // Submit audio URL for file-scanning
  const createRes = await fetch(`${ACRCLOUD_BASE}/api/fs-tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audio_url: audioUrl }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(
      `ACRCloud task creation failed: ${createRes.status} ${err}`,
    );
  }

  const createData = (await createRes.json()) as {
    data?: { id?: string | number };
  };
  const taskId = createData?.data?.id;
  if (!taskId) throw new Error("ACRCloud did not return a task ID");

  console.log(`[fingerprint/acrcloud] task created: ${taskId}`);

  // Poll up to 5 minutes (single track scans complete much faster than mixes)
  const MAX_WAIT = 5 * 60 * 1000;
  const POLL_INTERVAL = 8_000;
  const started = Date.now();

  while (Date.now() - started < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const pollRes = await fetch(`${ACRCLOUD_BASE}/api/fs-tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollRes.ok) {
      console.warn(
        `[fingerprint/acrcloud] poll ${taskId} returned ${pollRes.status}`,
      );
      continue;
    }

    const pollData = (await pollRes.json()) as {
      data?: {
        state?: string;
        results?: Array<{
          title?: string;
          artists?: Array<{ name?: string }>;
          album?: { name?: string };
          external_ids?: { isrc?: string };
          played_duration?: number;
          score?: number;
        }>;
      };
    };

    const state = pollData?.data?.state;
    console.log(`[fingerprint/acrcloud] task ${taskId} state: ${state}`);

    if (state === "processing" || state === "waiting") continue;

    if (state !== "success") {
      return {
        fingerprint: JSON.stringify({
          provider: "acrcloud",
          taskId: String(taskId),
          status: state ?? "error",
        }),
        duration: 0,
      };
    }

    const results = pollData?.data?.results ?? [];
    const best = results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

    if (!best || (best.score ?? 0) < 50) {
      return {
        fingerprint: JSON.stringify({
          provider: "acrcloud",
          taskId: String(taskId),
          status: "unmatched",
        }),
        duration: Math.round(best?.played_duration ?? 0),
      };
    }

    return {
      fingerprint: JSON.stringify({
        provider: "acrcloud",
        taskId: String(taskId),
        status: "matched",
        title: best.title ?? null,
        artist: best.artists?.[0]?.name ?? null,
        album: best.album?.name ?? null,
        isrc: best.external_ids?.isrc ?? null,
        confidence: best.score ?? 0,
      }),
      duration: Math.round(best.played_duration ?? 0),
    };
  }

  // Timed out — store task ID so it can be checked later
  return {
    fingerprint: JSON.stringify({
      provider: "acrcloud",
      taskId: String(taskId),
      status: "timeout",
    }),
    duration: 0,
  };
}

export async function fingerprintTrack(
  trackId: string,
  audioUrl: string,
): Promise<void> {
  let tmpPath: string | null = null;
  const isRemote =
    audioUrl.startsWith("http://") || audioUrl.startsWith("https://");
  try {
    if (isRemote) {
      tmpPath = await downloadToTemp(audioUrl);
    } else {
      tmpPath = audioUrl;
    }

    // fpcalc works in local dev (Chromaprint binary present).
    // On Vercel it is not available — fall back to ACRCloud acoustic fingerprinting.
    let result: { fingerprint: string; duration: number } | null =
      await getFpcalcResult(tmpPath);

    if (!result) {
      if (isRemote) {
        // ACRCloud needs the public URL, not the local temp path
        result = await getAcrCloudFingerprint(audioUrl);
      } else {
        // Local non-URL path (e.g. test environment) — get duration only
        let duration = 0;
        try {
          const { parseFile } = await import("music-metadata");
          const meta = await parseFile(tmpPath);
          duration = Math.round(meta.format.duration ?? 0);
        } catch {
          /* best effort */
        }
        result = {
          fingerprint: JSON.stringify({
            provider: "acrcloud",
            status: "local-only",
          }),
          duration,
        };
      }
    }

    await db.audioFingerprint.upsert({
      where: { trackId },
      update: { fingerprint: result.fingerprint, duration: result.duration },
      create: {
        trackId,
        fingerprint: result.fingerprint,
        duration: result.duration,
      },
    });
  } catch (err) {
    console.error(`[fingerprint] Failed for track ${trackId}:`, err);
  } finally {
    if (tmpPath && isRemote) {
      await unlink(tmpPath).catch(() => {});
    }
  }
}
