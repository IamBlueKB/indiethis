"use client";

import { useEffect, useState } from "react";
import AudioFeaturesRadar from "./AudioFeaturesRadar";
import type { AudioFeatureScores } from "@/lib/audio-features";

/**
 * Self-contained: fetches averaged features for a studio by slug and renders radar.
 * Renders nothing if no features exist yet (minimum 3 tracks from linked artists).
 */
export default function StudioSoundProfileRadar({ studioSlug }: { studioSlug: string }) {
  const [features, setFeatures] = useState<AudioFeatureScores | null>(null);

  useEffect(() => {
    fetch(`/api/audio-features/studio/${studioSlug}`)
      .then(r => r.json())
      .then(d => { if (d.features) setFeatures(d.features); })
      .catch(() => {});
  }, [studioSlug]);

  if (!features) return null;

  return (
    <div className="mt-8">
      <AudioFeaturesRadar
        features={features}
        size="md"
        title="Studio Sound Profile"
        subtitle="Based on tracks recorded here"
        animated
      />
    </div>
  );
}
