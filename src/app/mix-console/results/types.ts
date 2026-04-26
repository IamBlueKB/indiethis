/**
 * Shared types for the Mix Results page (guest + subscriber routes).
 * Server components serialize MixJob → MixResultsData and pass to client.
 */

export interface OutputAnalysis {
  lufs:          number;
  truePeak:      number;
  loudnessRange: number;
  stereoWidth:   number;
}

export interface StemProcessingItem {
  role:        string;          // "main_vocal" | "ad_libs" | "doubles" | "harmonies" | "ins_outs" | "beat"
  description: string;          // Plain English summary
}

export interface MixResultsData {
  id:        string;
  mode:      string;            // VOCAL_BEAT | TRACKED_STEMS
  tier:      "STANDARD" | "PREMIUM" | "PRO" | string;
  status:    string;
  genre:     string | null;
  beatPolish: boolean;
  trackName: string | null;
  createdAt: string;            // ISO

  // Audio file paths (raw — sign on demand client-side via /preview-url)
  originalPreviewPath:   string | null;
  cleanPreviewPath:      string | null;
  polishedPreviewPath:   string | null;
  aggressivePreviewPath: string | null;
  mixPreviewPath:        string | null;
  cleanFilePath:         string | null;
  polishedFilePath:      string | null;
  aggressiveFilePath:    string | null;
  mixFilePath:           string | null;

  // Output analysis (Claude/QA) — used by stats bar + A/B volume matching
  outputAnalysis: OutputAnalysis | null;

  /** Input (raw) LUFS measured during analyze step. Drives A/B volume match. */
  inputLufs: number | null;

  // Stem breakdown rows
  stemProcessingSummary: StemProcessingItem[];

  // Reference + Claude reasoning
  referenceFileName: string | null;
  referenceNotes:    string | null;

  // Claude-recommended version (Premium/Pro picker copy + AI pick badge)
  recommendedVersion: string | null;

  // Revision tracking
  revisionCount: number;
  maxRevisions:  number;

  // Waveform fallback (non-Web-Audio)
  previewWaveformOriginal: number[];
  previewWaveformMixed:    number[];
}

// Convenience for keeping legacy fields existing client uses unchanged
export interface MixResultsLegacyShape {
  previewFilePaths:   Record<string, string> | null;
}
