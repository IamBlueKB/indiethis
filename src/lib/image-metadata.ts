/**
 * image-metadata.ts
 *
 * Embeds IndieThis branding into image EXIF metadata using sharp.
 * Invisible to the user but readable in image properties / file inspectors.
 */

import sharp from "sharp";

// EXIF fields embedded into every AI-generated image
const INDIETHIS_EXIF = {
  IFD0: {
    Copyright:        "Made with IndieThis — indiethis.com",
    Artist:           "IndieThis AI Cover Art Generator",
    Software:         "IndieThis (indiethis.com)",
    ImageDescription: "AI-generated cover art created with IndieThis",
  },
};

/**
 * Fetch an image from `imageUrl`, embed IndieThis EXIF metadata, and return
 * the processed PNG as a Buffer.
 *
 * The resulting PNG is identical to the source visually but carries metadata
 * fields (Copyright, Artist, Software, ImageDescription) that identify it as
 * created through IndieThis.
 */
export async function embedIndieThisMetadata(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(
      `embedIndieThisMetadata: failed to fetch source image (${res.status}) from ${imageUrl}`,
    );
  }
  const inputBuffer = Buffer.from(await res.arrayBuffer());

  return sharp(inputBuffer)
    .withMetadata({ exif: INDIETHIS_EXIF })
    .png()
    .toBuffer();
}
