import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";
import { getToken } from "next-auth/jwt";

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
      return { url: file.ufsUrl ?? file.url };
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
      return { url: file.ufsUrl ?? file.url };
    }),

  // License & receipt vault documents (PDF, PNG, JPG, max 10MB)
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
