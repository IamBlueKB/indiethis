/**
 * qr-generator.ts
 *
 * Generates QR codes for artist page URLs.
 * - PNG: 1024×1024 via `qrcode` + `sharp` with the IndieThis icon composited in center
 * - SVG: inline SVG string with icon injected in center
 *
 * Uses errorCorrectionLevel "H" (30% damage tolerance) so the center logo
 * doesn't break scannability.
 */

import QRCode from "qrcode";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const ICON_SVG_PATH = path.join(process.cwd(), "public/images/brand/indiethis-icon.svg");

// ─── PNG ──────────────────────────────────────────────────────────────────────

/**
 * Generate a QR code PNG buffer with the IndieThis icon composited in the center.
 * @param url  The URL to encode
 * @param size Output size in pixels (default 1024)
 */
/** Append ?ref=qr so scans are tracked as QR-source page views */
function qrUrl(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ref=qr`;
}

export async function generateQrPng(url: string, size = 1024): Promise<Buffer> {
  // 1. Render QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(qrUrl(url), {
    width:                size,
    margin:               2,
    errorCorrectionLevel: "H",
    color:                { dark: "#0A0A0A", light: "#FFFFFF" },
  });

  // 2. Rasterize the icon SVG to a small PNG
  const iconSize  = Math.round(size * 0.18); // 18% of QR → leaves QR scannable
  const padding   = Math.round(iconSize * 0.12);
  const bgSize    = iconSize + padding * 2;  // white background to mask QR modules behind icon

  const iconSvg   = fs.readFileSync(ICON_SVG_PATH, "utf8");
  const iconPng   = await sharp(Buffer.from(iconSvg))
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  // White square background (so QR modules under the icon are hidden cleanly)
  const bgPng = await sharp({
    create: {
      width:      bgSize,
      height:     bgSize,
      channels:   4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: iconPng, top: padding, left: padding }])
    .png()
    .toBuffer();

  // 3. Composite icon+bg centered on QR
  const offset = Math.round((size - bgSize) / 2);
  const result = await sharp(qrBuffer)
    .composite([{ input: bgPng, top: offset, left: offset }])
    .png()
    .toBuffer();

  return result;
}

// ─── SVG ──────────────────────────────────────────────────────────────────────

/**
 * Generate a QR code SVG string with the IndieThis icon injected in the center.
 * Returns a complete, self-contained SVG document.
 * @param url The URL to encode
 */
export async function generateQrSvg(url: string): Promise<string> {
  const svgString = await QRCode.toString(qrUrl(url), {
    type:                 "svg",
    margin:               2,
    errorCorrectionLevel: "H",
    color:                { dark: "#0A0A0A", light: "#FFFFFF" },
  });

  // Parse viewBox dimensions from the generated SVG
  const sizeMatch = svgString.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!sizeMatch) return svgString;

  const svgW = parseFloat(sizeMatch[1]);
  const svgH = parseFloat(sizeMatch[2]);

  // Icon takes up 18% of the QR width; white background slightly larger
  const iconSize = svgW * 0.18;
  const padding  = iconSize * 0.12;
  const bgSize   = iconSize + padding * 2;
  const bgX      = (svgW - bgSize) / 2;
  const bgY      = (svgH - bgSize) / 2;
  const iconX    = bgX + padding;
  const iconY    = bgY + padding;

  // Scale the icon's internal coordinates from its 48×48 viewBox to iconSize
  const s = iconSize / 48;

  // Icon group — white rect background then icon shapes
  const iconGroup = `
  <g>
    <!-- white mask background -->
    <rect x="${bgX}" y="${bgY}" width="${bgSize}" height="${bgSize}" fill="white"/>
    <!-- icon: gold rounded square -->
    <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${12 * s}" fill="#D4A843"/>
    <!-- icon: black bar -->
    <rect x="${iconX + 20 * s}" y="${iconY + 18 * s}" width="${6 * s}" height="${22 * s}" rx="${3 * s}" fill="#0A0A0A"/>
    <!-- icon: coral play triangle -->
    <polygon points="${iconX + 18 * s},${iconY + 5 * s} ${iconX + 18 * s},${iconY + 16 * s} ${iconX + 28 * s},${iconY + 10.5 * s}" fill="#E85D4A"/>
  </g>`;

  return svgString.replace("</svg>", `${iconGroup}\n</svg>`);
}
