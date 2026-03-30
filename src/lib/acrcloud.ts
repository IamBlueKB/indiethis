/**
 * ACRCloud audio fingerprinting — identifies tracks within a mix audio file.
 * Uses the File Scanning API (full-file scan mode).
 */

const ACRCLOUD_BASE = "https://eu-api-v2.acrcloud.com";

export interface ACRCloudResult {
  title: string;
  artist: string;
  album?: string;
  startTimeSeconds: number;
  durationSeconds?: number;
  confidence: number; // 0-100
}

export async function identifyTracksInMix(
  audioUrl: string,
): Promise<ACRCloudResult[]> {
  const token = process.env.ACRCLOUD_TOKEN;
  if (!token) throw new Error("ACRCLOUD_TOKEN is not configured");

  // Step 1: Submit audio URL for scanning
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

  console.log(`[acrcloud] task created: ${taskId}`);

  // Step 2: Poll for results (max 10 min, every 10 s)
  const MAX_WAIT = 10 * 60 * 1000;
  const POLL_INTERVAL = 10_000;
  const started = Date.now();

  while (Date.now() - started < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const pollRes = await fetch(`${ACRCLOUD_BASE}/api/fs-tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollRes.ok) {
      console.warn(`[acrcloud] poll ${taskId} returned ${pollRes.status}`);
      continue;
    }

    const pollData = (await pollRes.json()) as {
      data?: {
        state?: string;
        results?: Array<{
          title?: string;
          artists?: Array<{ name?: string }>;
          album?: { name?: string };
          played_duration?: number;
          sample_begin_time?: number;
          score?: number;
        }>;
      };
    };

    const state = pollData?.data?.state;
    console.log(`[acrcloud] task ${taskId} state: ${state}`);

    if (state === "processing" || state === "waiting") continue;
    if (state !== "success")
      throw new Error(`ACRCloud task ended with state: ${state}`);

    const results = pollData?.data?.results ?? [];
    return results
      .map((r) => ({
        title: r.title ?? "Unknown Title",
        artist: r.artists?.[0]?.name ?? "Unknown Artist",
        album: r.album?.name,
        startTimeSeconds: r.sample_begin_time ?? 0,
        durationSeconds: r.played_duration,
        confidence: r.score ?? 0,
      }))
      .filter((r) => r.confidence >= 50);
  }

  throw new Error("ACRCloud timed out after 10 minutes");
}
