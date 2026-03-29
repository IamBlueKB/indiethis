import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "node-web-audio-api",
    "essentia.js",
    "pdf-parse",
    "pdfjs-dist",
  ],
};

export default nextConfig;
