/**
 * validateUpload.ts — Universal file upload validator
 *
 * All uploads across the platform go through this utility before
 * any processing or storage. Throws with a user-facing message on failure.
 */

export interface UploadFile {
  url:       string;
  filename:  string;
  mimeType:  string;
  sizeBytes: number;
}

export interface ValidateUploadOptions {
  maxSizeMB:    number;
  allowedTypes: string[];
  label:        string;  // e.g. "audio file", "image", "PDF"
}

export async function validateUpload(
  file:    UploadFile,
  options: ValidateUploadOptions,
): Promise<void> {
  const { maxSizeMB, allowedTypes, label } = options;

  // Size check
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.sizeBytes > maxBytes) {
    throw new Error(
      `${label} exceeds the maximum size of ${maxSizeMB} MB. ` +
      `Your file is ${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB.`
    );
  }

  // Type check
  if (!allowedTypes.includes(file.mimeType)) {
    throw new Error(
      `${label} type "${file.mimeType}" is not supported. ` +
      `Accepted: ${allowedTypes.map((t) => t.split("/")[1].toUpperCase()).join(", ")}.`
    );
  }

  // URL must be an S3/CDN URL (not a local blob)
  if (!file.url.startsWith("https://")) {
    throw new Error(`${label} URL is invalid. Please upload the file to storage first.`);
  }
}
