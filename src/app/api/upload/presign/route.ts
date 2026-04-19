/**
 * POST /api/upload/presign
 *
 * Returns a presigned S3 PUT URL so the client can upload audio files
 * directly to S3 without routing large files through the Next.js server.
 *
 * Used by the mastering wizards (guest + dashboard) for audio file uploads.
 *
 * Body: { filename: string, contentType: string, folder?: string }
 * Returns: { uploadUrl: string, fileUrl: string }
 *
 * Public — no auth required (guests need to upload too).
 * Files land in the Remotion S3 bucket under uploads/<folder>/<uuid>-<filename>.
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = (() => {
  // Extract bucket name from the Remotion serve URL
  // e.g. https://remotionlambda-useast1-cgsi0sjcmz.s3.us-east-1.amazonaws.com/...
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
  try {
    if (!BUCKET) {
      return NextResponse.json({ error: "S3 bucket not configured" }, { status: 503 });
    }

    const body = await req.json() as {
      filename:    string;
      contentType: string;
      folder?:     string;
    };

    const { filename, contentType, folder = "mastering" } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 });
    }

    // Sanitise filename — strip path traversal, keep extension
    const safeName  = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key       = `uploads/${folder}/${randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      ContentType: contentType,
    });

    // Presigned PUT URL valid for 15 minutes — plenty of time for large files
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Presigned GET URL valid for 4 hours — passed to Replicate/fal so they can
    // download the file even if the S3 bucket blocks public access.
    const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const accessUrl  = await getSignedUrl(s3, getCommand, { expiresIn: 14400 });

    // Plain URL kept for reference (may not be publicly accessible)
    const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    return NextResponse.json({ uploadUrl, fileUrl, accessUrl });
  } catch (err) {
    console.error("[upload/presign]", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
