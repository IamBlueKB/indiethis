/**
 * upload-validator.ts
 *
 * Shared file upload validation utility.
 * Every upload endpoint on the platform calls validateUpload() before
 * passing files to any AI service, storage, or processing pipeline.
 *
 * Validates: MIME type, file extension, file size, and file integrity.
 */

import { exec }      from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type FileType = "audio" | "image" | "video" | "zip";

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const RULES: Record<FileType, {
  mimeTypes:     string[];
  extensions:    string[];
  maxSizeMB:     number;
  maxDimensions?: { width: number; height: number }; // images only
}> = {
  audio: {
    mimeTypes: [
      "audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav",
      "audio/flac", "audio/aac", "audio/ogg", "audio/mp4",
      "audio/x-m4a", "audio/x-aiff", "audio/aiff",
    ],
    extensions: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".aiff", ".aif"],
    maxSizeMB:  100,
  },
  image: {
    mimeTypes: [
      "image/jpeg", "image/png", "image/webp", "image/gif",
    ],
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    maxSizeMB:  10,
    maxDimensions: { width: 8000, height: 8000 },
  },
  video: {
    mimeTypes: [
      "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
    ],
    extensions: [".mp4", ".webm", ".mov", ".m4v"],
    maxSizeMB:  500,
  },
  zip: {
    mimeTypes: [
      "application/zip", "application/x-zip-compressed",
      "application/octet-stream",
    ],
    extensions: [".zip"],
    maxSizeMB:  200,
  },
};

export async function validateUpload(
  filePath:      string,
  fileName:      string,
  fileSizeBytes: number,
  mimeType:      string,
  type:          FileType
): Promise<ValidationResult> {
  const rules = RULES[type];

  // 1. Check MIME type
  if (!rules.mimeTypes.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid file type. Expected ${type} file. Received: ${mimeType}`,
    };
  }

  // 2. Check file extension
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (!rules.extensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Accepted: ${rules.extensions.join(", ")}`,
    };
  }

  // 3. Check file size
  const maxBytes = rules.maxSizeMB * 1024 * 1024;
  if (fileSizeBytes > maxBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${rules.maxSizeMB}MB`,
    };
  }

  // 4. File integrity check — verify the file is actually what it claims to be
  try {
    if (type === "audio") {
      await validateAudioIntegrity(filePath);
    } else if (type === "image") {
      await validateImageIntegrity(filePath, rules.maxDimensions!);
    } else if (type === "video") {
      await validateVideoIntegrity(filePath);
    } else if (type === "zip") {
      await validateZipIntegrity(filePath);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : undefined;
    return {
      valid: false,
      error: message || `File failed integrity check. Please upload a valid ${type} file.`,
    };
  }

  return { valid: true };
}

// ─── Integrity checks ─────────────────────────────────────────────────────────

async function validateAudioIntegrity(filePath: string): Promise<void> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=format_name,duration -of csv=p=0 "${filePath}"`
    );
    if (!stdout.trim()) {
      throw new Error("File could not be read as audio.");
    }
    // Check duration is reasonable (at least 1 second, max 30 minutes)
    const parts    = stdout.trim().split(",");
    const duration = parseFloat(parts[parts.length - 1]);
    if (isNaN(duration) || duration < 1) {
      throw new Error("Audio file is too short or unreadable.");
    }
    if (duration > 1800) {
      throw new Error("Audio file exceeds maximum duration of 30 minutes.");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Audio file")) throw err;
    throw new Error("File is not a valid audio file. Please upload MP3, WAV, FLAC, AAC, or OGG.");
  }
}

async function validateImageIntegrity(
  filePath:      string,
  maxDimensions: { width: number; height: number }
): Promise<void> {
  try {
    // Use sharp to read image metadata — if it fails, the file is not a valid image
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp    = require("sharp");
    const metadata = await sharp(filePath).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not read image dimensions.");
    }
    if (metadata.width > maxDimensions.width || metadata.height > maxDimensions.height) {
      throw new Error(
        `Image dimensions too large. Maximum: ${maxDimensions.width}x${maxDimensions.height}px`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("dimensions") || message.includes("large")) throw err;
    throw new Error("File is not a valid image. Please upload JPG, PNG, WEBP, or GIF.");
  }
}

async function validateVideoIntegrity(filePath: string): Promise<void> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=format_name,duration -of csv=p=0 "${filePath}"`
    );
    if (!stdout.trim()) {
      throw new Error("File could not be read as video.");
    }
    const parts    = stdout.trim().split(",");
    const duration = parseFloat(parts[parts.length - 1]);
    if (isNaN(duration) || duration < 1) {
      throw new Error("Video file is too short or unreadable.");
    }
    if (duration > 600) {
      throw new Error("Video file exceeds maximum duration of 10 minutes.");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Video file")) throw err;
    throw new Error("File is not a valid video. Please upload MP4, WEBM, or MOV.");
  }
}

async function validateZipIntegrity(filePath: string): Promise<void> {
  try {
    // Use unzip -t to test zip integrity without extracting
    await execAsync(`unzip -t "${filePath}"`);
  } catch {
    throw new Error("File is not a valid ZIP archive or is corrupted.");
  }
}
