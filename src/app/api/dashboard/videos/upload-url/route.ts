import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, contentType, size } = await req.json();

  const MAX_SIZE = 500 * 1024 * 1024; // 500MB
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 500MB." }, { status: 400 });
  }

  // Use Cloudflare R2 presigned URL if configured, else fall back to UploadThing approach
  const r2AccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2PublicUrl = process.env.R2_PUBLIC_URL;

  if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) {
    return NextResponse.json({ error: "Storage not configured. Please add R2 credentials to environment variables." }, { status: 500 });
  }

  // Generate a unique key
  const key = `videos/${session.user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Create presigned URL using AWS SDK v3 compatible approach
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey },
  });

  const command = new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const videoUrl = `${r2PublicUrl}/${key}`;

  return NextResponse.json({ uploadUrl, videoUrl, key });
}
