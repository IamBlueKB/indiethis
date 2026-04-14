import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "node-web-audio-api",
    "essentia.js",
    "pdf-parse",
    "pdfjs-dist",
    "onnxruntime-node",
  ],
  // Include EffNet-Discogs model files in the Vercel serverless function bundle.
  // Without this, Next.js file tracing won't include static model files
  // since they're not imported via require()/import.
  outputFileTracingIncludes: {
    "/api/**": ["./models/effnet-discogs/**"],
    "/video-studio/**": ["./models/effnet-discogs/**"],
  },
};

export default nextConfig;
