/**
 * POST /api/admin/reference-library/presign
 *
 * Body: { filename: string, contentType?: string, kind?: "reference" | "stem" }
 *
 * Returns:
 *   { uploadUrl, accessUrl, key }
 *   - uploadUrl: short-lived (15 min) presigned PUT URL — browser uploads directly
 *   - accessUrl: signed GET URL valid for 4 hours — passed to /process for Cog
 *   - key:       S3 object key for reference
 *
 * Bypasses Vercel's 4.5MB function body limit by sending bytes browser→S3 directly.
 *
 * PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = (() => {
  const url = process.env.REMOTION_SERVE_URL ?? "";
  const match = url.match(/^https?:\/\/([^.]+)\.s3\./);
  return match?.[1] ?? "";
})();

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!BUCKET) {
    return NextResponse.json({ error: "S3 bucket not configured" }, { status: 503 });
  }

  try {
    const { filename, contentType, kind } = (await req.json()) as {
      filename?:    string;
      contentType?: string;
      kind?:        string;
    };

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const folder   = kind === "stem" ? "reference-library/stems" : "reference-library";
    const key      = `uploads/${folder}/${randomUUID()}-${safeName}`;
    const ct       = contentType || "application/octet-stream";

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: ct }),
      { expiresIn: 900 },   // 15 min to upload
    );

    const accessUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 14400 }, // 4 h for Cog/Replicate
    );

    return NextResponse.json({ uploadUrl, accessUrl, key });
  } catch (err) {
    console.error("[admin/reference-library/presign]", err);
    return NextResponse.json({ error: "Presign failed" }, { status: 500 });
  }
}
