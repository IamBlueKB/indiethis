/**
 * wav.ts — encode an AudioBuffer as a 16-bit PCM WAV blob.
 *
 * Standalone, no deps. Used by stem export (step 24) so the artist
 * can download individual processed stems straight from the studio.
 *
 * Output format: WAVE / RIFF, PCM little-endian, 16-bit, 1 or 2 channels,
 * sample rate from the source AudioBuffer. Chunks: "RIFF" + "fmt " + "data".
 */

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr    = buffer.sampleRate;
  const len   = buffer.length;

  // Interleave channels into a single Float32 buffer.
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  const bytesPerSample = 2;
  const dataBytes      = len * numCh * bytesPerSample;
  const headerBytes    = 44;
  const total          = headerBytes + dataBytes;
  const out            = new ArrayBuffer(total);
  const view           = new DataView(out);

  // RIFF header
  writeStr(view,   0, "RIFF");
  view.setUint32 ( 4, total - 8, true);
  writeStr(view,   8, "WAVE");

  // fmt chunk
  writeStr(view,  12, "fmt ");
  view.setUint32 (16, 16,        true);  // PCM chunk size
  view.setUint16 (20, 1,         true);  // PCM format
  view.setUint16 (22, numCh,     true);
  view.setUint32 (24, sr,        true);
  view.setUint32 (28, sr * numCh * bytesPerSample, true);  // byte rate
  view.setUint16 (32, numCh * bytesPerSample, true);       // block align
  view.setUint16 (34, 16,        true);                    // bits per sample

  // data chunk
  writeStr(view,  36, "data");
  view.setUint32 (40, dataBytes, true);

  // Sample data: interleaved, clipped, scaled to int16.
  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = channels[c][i];
      if (!Number.isFinite(s)) s = 0;
      if (s > 1)  s = 1;
      if (s < -1) s = -1;
      const v = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, v | 0, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}

function writeStr(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
