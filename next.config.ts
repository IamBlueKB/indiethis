import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "node-web-audio-api",  // 40MB platform binaries — exclude from webpack bundle
    "essentia.js",
    "pdf-parse",
    "pdfjs-dist",
    "onnxruntime-web",     // WASM package — load from node_modules at runtime
  ],
  // Include EffNet-Discogs model files and onnxruntime-web WASM in the Vercel
  // serverless function bundle. Without this, Next.js file tracing won't include
  // static assets since they're not imported via require()/import.
  outputFileTracingIncludes: {
    "/api/**": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
    "/video-studio/**": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
  },
};

export default nextConfig;
