import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  // Artist track upload (single audio file, up to 256MB)
  artistTrack: f({ audio: { maxFileSize: "256MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
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
      return { url: file.url };
    }),

  // Intake form: audio + images (up to 10 files, 128MB each)
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
      return { url: file.url };
    }),

  // Quick send: any file type, up to 10 files, 512MB each
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
      return { url: file.ufsUrl ?? file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
