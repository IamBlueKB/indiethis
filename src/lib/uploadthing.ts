import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { validateUpload } from "@/lib/upload-validator";

const f      = createUploadthing();
const utapi  = new UTApi();

// ─── UploadThing validation helper ───────────────────────────────────────────
//
// Called inside every onUploadComplete callback.
// - Audio/video: passes the UploadThing CDN URL directly to ffprobe (no download)
// - Image/ZIP:   downloads to a temp file for sharp / unzip -t inspection
// - PDF, octet-stream, and other unsupported types: skipped (UploadThing enforces
//   size and type limits at upload time)
// If validation fails: deletes the file from UploadThing storage and throws,
// which causes the client-side onUploadError handler to fire.

type ValidatableType = "audio" | "image" | "video" | "zip";

function resolveFileType(mimeType: string): ValidatableType | null {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("audio/"))                                        return "audio";
  if (mime.startsWith("image/"))                                        return "image";
  if (mime.startsWith("video/"))                                        return "video";
  if (mime === "application/zip" || mime === "application/x-zip-compressed") return "zip";
  return null; // PDF, octet-stream, etc. — skip integrity check
}

async function validateUT(file: {
  url:  string;
  key:  string;
  name: string;
  size: number;
  type: string;
}): Promise<void> {
  const fileType = resolveFileType(file.type);
  if (!fileType) return; // unsupported MIME — skip; UploadThing enforces allowed types

  // Audio and video: ffprobe understands HTTP(S) URLs natively — no download needed.
  // Image and ZIP: require a local path for sharp / unzip -t.
  const needsLocal = fileType === "image" || fileType === "zip";
  let   filePath   = file.url;
  let   tmpPath: string | null = null;

  if (needsLocal) {
    tmpPath = join(tmpdir(), `ut-${randomUUID()}${extname(file.name) || ""}`);
    try {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error(`CDN fetch failed (${res.status})`);
      await writeFile(tmpPath, Buffer.from(await res.arrayBuffer()));
      filePath = tmpPath;
    } catch (err) {
      await unlink(tmpPath).catch(() => {});
      tmpPath = null;
      // Can't download for inspection — delete from storage and reject
      await utapi.deleteFiles([file.key]).catch(() => {});
      throw new Error(
        err instanceof Error ? err.message : "Could not download file for validation. Please try again."
      );
    }
  }

  try {
    const result = await validateUpload(filePath, file.name, file.size, file.type, fileType);
    if (!result.valid) {
      await utapi.deleteFiles([file.key]).catch(() => {});
      throw new Error(result.error ?? `Invalid ${fileType} file.`);
    }
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
  }
}

export const ourFileRouter = {
  // Artist track upload (single audio file, up to 256MB)
  artistTrack: f({ audio: { maxFileSize: "256MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Album / release art (pre-save campaigns)
  albumArt: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Track cover art (single image)
  trackCoverArt: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Artist profile photo
  profilePhoto: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Artist site header image
  siteHeaderImage: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Merch product image
  merchImage: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Intake form: audio + images + PDF + video (up to 10 files, 128MB each)
  // PDF and octet-stream are skipped by validateUT; audio/image/video are validated.
  intakeFiles: f({
    audio: { maxFileSize: "128MB", maxFileCount: 10 },
    image: { maxFileSize: "16MB", maxFileCount: 5 },
    "application/pdf": { maxFileSize: "32MB", maxFileCount: 5 },
    video: { maxFileSize: "256MB", maxFileCount: 3 },
  })
    .middleware(async () => {
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Quick send: any file type, up to 10 files, 512MB each
  // Only audio/image/video are validated; PDF and octet-stream are skipped.
  quickSendFiles: f({
    "application/octet-stream": { maxFileSize: "512MB", maxFileCount: 10 },
    audio: { maxFileSize: "512MB", maxFileCount: 10 },
    image: { maxFileSize: "64MB", maxFileCount: 10 },
    video: { maxFileSize: "512MB", maxFileCount: 10 },
    "application/pdf": { maxFileSize: "64MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.url };
    }),

  // Email blast attachments (studio admin — PDF, image, audio, up to 10MB each)
  emailAttachments: f({
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 5 },
    image:             { maxFileSize: "8MB", maxFileCount: 5 },
    audio:             { maxFileSize: "8MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Studio public page images (logo, hero, gallery) — studio admin only
  studioImages: f({ image: { maxFileSize: "16MB", maxFileCount: 10 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Studio portfolio audio tracks — studio admin only
  studioAudio: f({ audio: { maxFileSize: "256MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Stream lease: artist's recorded song using a beat (mp3/wav, up to 256MB)
  streamLeaseAudio: f({ audio: { maxFileSize: "256MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Stream lease: cover art (optional, up to 8MB)
  streamLeaseCover: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Producer beat audio upload (mp3/wav, up to 256MB)
  beatAudio: f({ audio: { maxFileSize: "256MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Producer beat cover art (image, up to 8MB)
  beatCoverArt: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // License & receipt vault documents (PDF, PNG, JPG, max 10MB)
  // PDF is skipped by validateUT; image is validated.
  licenseDocument: f({
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 1 },
    image:             { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Session note attachments (studio admin — any file type up to 64MB, up to 5 files)
  sessionNoteFiles: f({
    "application/octet-stream": { maxFileSize: "64MB", maxFileCount: 5 },
    audio: { maxFileSize: "64MB", maxFileCount: 5 },
    image: { maxFileSize: "16MB", maxFileCount: 5 },
    video: { maxFileSize: "64MB", maxFileCount: 5 },
    "application/pdf": { maxFileSize: "32MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Lyric video background — image or video upload for lyric video tool
  lyricVideoBg: f({
    image: { maxFileSize: "32MB", maxFileCount: 1 },
    video: { maxFileSize: "512MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Track canvas video upload (mp4/mov, max 20MB, 3–8s vertical)
  trackCanvas: f({ video: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Self-fulfilled merch product photos (up to 5 images, 16MB each)
  selfFulfilledProductImages: f({ image: { maxFileSize: "16MB", maxFileCount: 5 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Merch design upload (PNG/JPG, max 64MB — stored permanently for mockup generation)
  merchDesign: f({ image: { maxFileSize: "64MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Studio file delivery
  deliveryFiles: f({
    "application/octet-stream": { maxFileSize: "512MB", maxFileCount: 20 },
    audio: { maxFileSize: "512MB", maxFileCount: 20 },
    image: { maxFileSize: "64MB", maxFileCount: 20 },
    video: { maxFileSize: "512MB", maxFileCount: 20 },
    "application/pdf": { maxFileSize: "64MB", maxFileCount: 20 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Sample pack zip upload (max 200MB — content validated in /api/dashboard/sample-packs/upload)
  samplePackZip: f({ "application/zip": { maxFileSize: "128MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Admin promo popup image (admin panel only — max 8MB)
  promoPopupImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Admin auth is cookie-based — no NextAuth session available here.
      // Actual admin gate is enforced client-side + at the API route level.
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Music Video Studio: guest/subscriber audio upload (mp3/wav/flac/aac, max 64MB)
  videoStudioAudio: f({ audio: { maxFileSize: "64MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Public — guests and subscribers both upload here; no auth check
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Music Video Studio: character reference images for Director Mode (up to 3, 8MB each)
  videoStudioRef: f({ image: { maxFileSize: "8MB", maxFileCount: 3 } })
    .middleware(async () => {
      // Public — allow guests and subscribers
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Lyric Video Studio: guest/subscriber audio upload (mp3/wav/flac/aac, max 64MB)
  lyricVideoAudio: f({ audio: { maxFileSize: "64MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Public — guests and subscribers both upload here; no auth check
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Cover Art Studio: reference image upload (subscribers + guests, max 16MB)
  coverArtRef: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Allow both subscribers and guests — auth checked at job creation
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Avatar Studio: source reference photo (subscriber only, max 8MB, JPG/PNG/WEBP)
  avatarSourcePhoto: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),

  // Sample pack individual preview audio files (after zip extraction, max 50MB each, up to 5)
  samplePackPreview: f({ audio: { maxFileSize: "32MB", maxFileCount: 5 } })
    .middleware(async ({ req }) => {
      const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      });
      if (!token?.sub) throw new Error("Unauthorized");
      return { userId: token.sub };
    })
    .onUploadComplete(async ({ file }) => {
      await validateUT(file);
      return { url: file.ufsUrl ?? file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
