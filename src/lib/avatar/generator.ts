/**
 * src/lib/avatar/generator.ts
 *
 * AI avatar generation for the Artist Avatar Studio.
 *
 * Generates 4 stylized portrait variations from a reference photo.
 * Uses FLUX Kontext Pro to preserve exact facial features while applying
 * the chosen aesthetic style.
 *
 * No third-party model names are ever exposed in the UI.
 * Free for all subscribers — cost absorbed by the platform.
 */

import { fal }    from "@fal-ai/client";
import { UTApi }  from "uploadthing/server";
import sharp      from "sharp";

// Client-safe styles are in a separate file — re-export for API routes
export { AVATAR_STYLES } from "./styles";
import { AVATAR_STYLES } from "./styles";

const utapi = new UTApi();

const MODEL = "fal-ai/flux-pro/kontext";
const VARIATIONS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateAvatarInput {
  sourcePhotoUrl: string;
  style:          string;
  artistName?:    string | null;
}

export interface AvatarVariation {
  url:        string;
  seed:       number;
  falUrl:     string; // original fal.ai URL before upload
}

// ─── Generate 4 variations in parallel ───────────────────────────────────────

export async function generateAvatarVariations(
  input: GenerateAvatarInput,
): Promise<AvatarVariation[]> {
  const styleConfig = AVATAR_STYLES[input.style];
  if (!styleConfig) throw new Error(`Unknown avatar style: ${input.style}`);

  fal.config({ credentials: process.env.FAL_KEY });

  const basePrompt = [
    styleConfig.promptBase,
    "Professional portrait of the person in the reference image,",
    "maintaining their exact facial features, bone structure, skin tone, and identifying characteristics.",
    "Album cover quality, centered composition, clean background,",
    "facing the camera, upper body framing.",
  ].join(" ");

  // Generate 4 variations in parallel using different seeds
  const seeds = Array.from({ length: VARIATIONS }, (_, i) => Math.floor(Math.random() * 999999) + i * 111111);

  const results = await Promise.allSettled(
    seeds.map(async (seed) => {
      const result = await fal.subscribe(MODEL, {
        input: {
          prompt:    basePrompt,
          image_url: input.sourcePhotoUrl,
          seed,
          guidance_scale:       3.5,
        },
      });
      const images = (result.data as { images?: { url: string }[] }).images;
      const falUrl = images?.[0]?.url;
      if (!falUrl) throw new Error("No image returned from generation model");
      return { falUrl, seed };
    }),
  );

  // Upload successful variations to permanent storage
  const variations: AvatarVariation[] = [];
  await Promise.allSettled(
    results.map(async (r, i) => {
      if (r.status === "rejected") return;
      const { falUrl, seed } = r.value;
      const permanentUrl = await uploadAvatarToStorage(falUrl, `avatar-${seed}-${i}.png`);
      variations.push({ url: permanentUrl, seed, falUrl });
    }),
  );

  if (variations.length === 0) throw new Error("All avatar generation attempts failed");

  return variations;
}

// ─── Upload generated avatar to permanent storage ─────────────────────────────

async function uploadAvatarToStorage(falUrl: string, filename: string): Promise<string> {
  try {
    const res = await fetch(falUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const file   = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
    const upload = await utapi.uploadFiles(file);
    return upload.data?.ufsUrl ?? upload.data?.url ?? falUrl;
  } catch {
    return falUrl; // fall back to fal.ai URL
  }
}

// ─── Extract dominant colors from avatar using sharp ─────────────────────────

export interface DominantColors {
  primary:   string; // hex
  secondary: string; // hex
  accent:    string; // hex
}

export async function extractAvatarColors(imageUrl: string): Promise<DominantColors> {
  try {
    const res    = await fetch(imageUrl);
    const buffer = Buffer.from(await res.arrayBuffer());

    // Resize to 32×32 and get raw RGB pixels
    const { data } = await sharp(buffer)
      .resize(32, 32, { fit: "cover" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = data;
    const total  = pixels.length / 3;

    // Sample top-third, middle-third, and bottom-third for 3 distinct colors
    const zones = [
      { start: 0,                       end: Math.floor(total / 3) },
      { start: Math.floor(total / 3),   end: Math.floor((total * 2) / 3) },
      { start: Math.floor((total * 2) / 3), end: total },
    ];

    const colors = zones.map(({ start, end }) => {
      let r = 0, g = 0, b = 0;
      let count = 0;
      for (let i = start; i < end; i++) {
        r += pixels[i * 3];
        g += pixels[i * 3 + 1];
        b += pixels[i * 3 + 2];
        count++;
      }
      const avg = (v: number) => Math.round(v / count);
      return `#${avg(r).toString(16).padStart(2, "0")}${avg(g).toString(16).padStart(2, "0")}${avg(b).toString(16).padStart(2, "0")}`;
    });

    return {
      primary:   colors[0],
      secondary: colors[1],
      accent:    colors[2],
    };
  } catch {
    return { primary: "#D4A843", secondary: "#1A1A1A", accent: "#F0F0F0" };
  }
}
