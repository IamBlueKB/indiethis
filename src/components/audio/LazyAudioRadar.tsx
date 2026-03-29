"use client";

import { useEffect, useState } from "react";
import AudioFeaturesRadar from "./AudioFeaturesRadar";
import type { AudioFeatureScores } from "@/lib/audio-features";
import type { AudioFeaturesRadarProps } from "./AudioFeaturesRadar";

interface LazyAudioRadarProps extends Omit<AudioFeaturesRadarProps, "features"> {
  trackId: string;
}

/**
 * Lazily fetches audio features for a single track and renders the radar.
 * Renders nothing if the track has no features yet.
 */
export default function LazyAudioRadar({ trackId, ...radarProps }: LazyAudioRadarProps) {
  const [features, setFeatures] = useState<AudioFeatureScores | null>(null);

  useEffect(() => {
    fetch(`/api/audio-features/${trackId}`)
      .then(r => r.json())
      .then(d => { if (d.features) setFeatures(d.features); })
      .catch(() => {});
  }, [trackId]);

  if (!features) return null;
  return <AudioFeaturesRadar features={features} {...radarProps} />;
}
