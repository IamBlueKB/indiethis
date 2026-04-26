/**
 * POST /api/admin/reference-library/upload
 *
 * Admin-only direct file upload for the Reference Library admin panel.
 * Accepts multipart/form-data with `file` (and optional `kind`) and proxies
 * the bytes to S3 (Remotion bucket) under uploads/reference-library/...
 *
 * Returns { url, accessUrl } where:
 *   - url       = signed GET URL valid for 4 hours (use for Replicate)
 *   - accessUrl = same as url (kept for parity with presign route)
 *
 * PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") ?? "reference");

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const folder   = kind === "stem" ? "reference-library/stems" : "reference-library";
    const key      = `uploads/${folder}/${randomUUID()}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: file.type || "application/octet-stream",
    }));

    const accessUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 14400 },
    );

    return NextResponse.json({ url: accessUrl, accessUrl, key });
  } catch (err) {
    console.error("[admin/reference-library/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
