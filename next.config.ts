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
    // Internal trigger sub-routes: each isolated function needs its own ML assets.
    // video: generate.ts → song-analyzer → effnet-discogs (dynamic import)
    "/api/internal/trigger/video": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
    // lyric: pipeline.ts → song-analyzer → effnet-discogs (static import)
    "/api/internal/trigger/lyric": [
      "./models/effnet-discogs/**",
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
  },
  // Explicit exclusions to keep individual function bundles under 250 MB.
  outputFileTracingExcludes: {
    // Stripe webhook must never bundle heavy ML/media deps.
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
    // lyric trigger sits at ~250 MB because node-web-audio-api ships binaries for
    // 7 platforms (~40 MB total). Vercel runs linux-x64-gnu only — exclude the
    // other 6 platform binaries to save ~34 MB and stay under the limit.
    "/api/internal/trigger/lyric": [
      "./node_modules/node-web-audio-api/node-web-audio-api.win32-x64-msvc.node",
      "./node_modules/node-web-audio-api/node-web-audio-api.darwin-x64.node",
      "./node_modules/node-web-audio-api/node-web-audio-api.win32-arm64-msvc.node",
      "./node_modules/node-web-audio-api/node-web-audio-api.linux-arm64-gnu.node",
      "./node_modules/node-web-audio-api/node-web-audio-api.linux-arm-gnueabihf.node",
      "./node_modules/node-web-audio-api/node-web-audio-api.darwin-arm64.node",
    ],
  },
};

export default nextConfig;
