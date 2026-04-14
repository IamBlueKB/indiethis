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
  // Include EffNet-Discogs model files and onnxruntime-web WASM only in the
  // specific routes that actually run ML inference. Using "/api/**" was adding
  // ~105MB (79MB WASM + 26MB models) to EVERY API route including stripe/webhook.
  outputFileTracingIncludes: {
    // tracks route: fires EffNet analysis on upload (dynamic import chain)
    "/api/dashboard/tracks": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
    // video-studio routes: song-analyzer → effnet-discogs (via dynamic imports)
    "/api/video-studio/**": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
    "/video-studio/**": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
  },
  // Explicit exclusions so nft never bundles heavy ML/media deps into the
  // Stripe webhook even if a future import chain accidentally reaches them.
  outputFileTracingExcludes: {
    "/api/stripe/webhook": [
      "./node_modules/onnxruntime-web/**",
      "./node_modules/onnxruntime-node/**",
      "./node_modules/sharp/**",
      "./node_modules/@ffmpeg-installer/**",
      "./node_modules/fluent-ffmpeg/**",
      "./node_modules/node-web-audio-api/**",
      "./node_modules/essentia.js/**",
      "./models/**",
    ],
  },
};

export default nextConfig;
