/**
 * src/lib/stem-storage.ts
 * Downloads stem files from Replicate's temporary URLs and re-uploads
 * them to UploadThing for permanent storage.
 *
 * Replicate output for cjwbw/demucs is an object with keys:
 *   vocals, drums, bass, other  (each a temporary URL string)
 * or possibly a single zip URL — we handle both cases.
 */

import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export interface StoredStems {
  vocals: string | null;
  drums:  string | null;
  bass:   string | null;
  other:  string | null;
}

/**
 * Takes Replicate prediction output (object or zip URL string),
 * downloads each stem, uploads to UploadThing, returns permanent URLs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function storeStemsFromReplicate(separationId: string, output: any): Promise<StoredStems> {
  const result: StoredStems = { vocals: null, drums: null, bass: null, other: null };

  if (!output) return result;

  // Replicate demucs output is typically an object: { vocals: url, drums: url, bass: url, other: url }
  // It can also be a FileOutput or similar — normalise to plain URLs
  const stemMap: Record<string, string | null> = {
    vocals: extractUrl(output?.vocals ?? output?.vocal),
    drums:  extractUrl(output?.drums  ?? output?.drum),
    bass:   extractUrl(output?.bass),
    other:  extractUrl(output?.other  ?? output?.accompaniment),
  };

  await Promise.all(
    (Object.entries(stemMap) as [keyof StoredStems, string | null][]).map(async ([key, url]) => {
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob    = await res.blob();
        const file    = new File([blob], `${key}-${separationId}.wav`, { type: "audio/wav" });
        const upload  = await utapi.uploadFiles(file);
        result[key]   = upload.data?.ufsUrl ?? upload.data?.url ?? null;
      } catch (err) {
        console.error(`[stem-storage] Failed to store ${key}:`, err);
      }
    })
  );

  return result;
}

function extractUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  // Replicate FileOutput objects have a toString() / url property
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    const str = String(value);
    if (str.startsWith("http")) return str;
  }
  return null;
}
