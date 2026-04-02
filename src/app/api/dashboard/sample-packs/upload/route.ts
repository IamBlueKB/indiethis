import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import JSZip from "jszip";
import crypto from "crypto";

// Audio extensions allowed inside sample pack zips
const ALLOWED_AUDIO_EXTS = new Set([
  ".wav", ".mp3", ".flac", ".aiff", ".aif", ".ogg",
]);

// Extensions that are never allowed
const BLOCKED_EXTS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".py", ".rb", ".pl",
  ".js", ".ts", ".mjs", ".cjs", ".vbs", ".scr", ".dll", ".so", ".dylib",
  ".php", ".asp", ".aspx", ".jsp", ".jar", ".class", ".pif", ".com",
  ".dmg", ".pkg", ".msi", ".deb", ".rpm", ".apk", ".ipa",
]);

function getExt(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

// ─── VirusTotal hash check (best-effort) ──────────────────────────────────────
async function checkVirusTotal(
  buffer: Buffer
): Promise<{ clean: boolean; known: boolean; error?: string }> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return { clean: true, known: false, error: "VT key not configured" };

  // SHA-256 hash of the file
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: { "x-apikey": apiKey },
    });

    if (res.status === 404) {
      // File not in VT database — unknown, not malicious
      // Submit for analysis in background (fire-and-forget)
      void submitToVT(buffer, apiKey);
      return { clean: true, known: false };
    }

    if (!res.ok) {
      console.error("[VT] Unexpected status:", res.status);
      return { clean: true, known: false, error: `VT returned ${res.status}` };
    }

    const data = (await res.json()) as {
      data: { attributes: { last_analysis_stats: { malicious: number; suspicious: number } } };
    };
    const stats = data.data.attributes.last_analysis_stats;
    const isMalicious = stats.malicious > 0 || stats.suspicious > 3;

    return { clean: !isMalicious, known: true };
  } catch (err) {
    console.error("[VT] Check failed:", err);
    return { clean: true, known: false, error: String(err) };
  }
}

async function submitToVT(buffer: Buffer, apiKey: string): Promise<void> {
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/zip" }), "pack.zip");
    await fetch("https://www.virustotal.com/api/v3/files", {
      method: "POST",
      headers: { "x-apikey": apiKey },
      body: form,
    });
  } catch (err) {
    console.error("[VT] Background submission failed:", err);
  }
}

// ─── POST /api/dashboard/sample-packs/upload ─────────────────────────────────
// Body: { fileUrl: string, fileSize: number, digitalProductId?: string }
// Validates zip: content-only audio files, VT scan, returns file list.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as {
    fileUrl?: string;
    fileSize?: number;
    digitalProductId?: string;
  };

  if (!body.fileUrl) {
    return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
  }
  const fileSize = body.fileSize ?? 0;

  // ── 1. Download the zip buffer ─────────────────────────────────────────────
  let buffer: Buffer;
  try {
    const res = await fetch(body.fileUrl);
    if (!res.ok) throw new Error(`CDN returned ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[sample-pack/upload] fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to download the uploaded file. Try again." },
      { status: 502 }
    );
  }

  // ── 2. VirusTotal hash check ───────────────────────────────────────────────
  const vtResult = await checkVirusTotal(buffer);
  if (!vtResult.clean) {
    return NextResponse.json(
      {
        error:
          "Your file was flagged as potentially harmful and cannot be published. " +
          "If you believe this is a mistake, contact support@indiethis.com.",
      },
      { status: 422 }
    );
  }

  // ── 3. Unzip + extension validation ───────────────────────────────────────
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return NextResponse.json(
      { error: "The uploaded file is not a valid ZIP archive." },
      { status: 422 }
    );
  }

  const audioFiles: string[] = [];
  const rejectedFiles: string[] = [];

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    // Skip macOS metadata
    if (relativePath.startsWith("__MACOSX/") || relativePath.includes("/.")) return;
    const ext = getExt(relativePath);
    if (ALLOWED_AUDIO_EXTS.has(ext)) {
      audioFiles.push(relativePath);
    } else {
      rejectedFiles.push(relativePath);
    }
  });

  if (rejectedFiles.length > 0) {
    const sample = rejectedFiles.slice(0, 3).map((f) => `"${f.split("/").pop()}"`).join(", ");
    return NextResponse.json(
      {
        error:
          `Sample packs can only contain audio files (.wav, .mp3, .flac, .aiff, .ogg). ` +
          `Remove non-audio files and try again. Found: ${sample}${rejectedFiles.length > 3 ? ` and ${rejectedFiles.length - 3} more` : ""}.`,
      },
      { status: 422 }
    );
  }

  if (audioFiles.length === 0) {
    return NextResponse.json(
      { error: "No audio files found in the ZIP. Add .wav, .mp3, or other audio files and try again." },
      { status: 422 }
    );
  }

  const sampleCount = audioFiles.length;

  // ── 4. If a digitalProductId is provided, update the record ───────────────
  if (body.digitalProductId) {
    const product = await prisma.digitalProduct.findFirst({
      where: { id: body.digitalProductId, userId },
      select: { id: true },
    });
    if (product) {
      await prisma.digitalProduct.update({
        where: { id: body.digitalProductId },
        data: {
          samplePackFileUrl:  body.fileUrl,
          samplePackFileSize: fileSize || buffer.length,
          sampleCount,
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    sampleCount,
    fileSize: fileSize || buffer.length,
    files: audioFiles.sort(), // sorted list for UI display
    vtKnown: vtResult.known,
  });
}
