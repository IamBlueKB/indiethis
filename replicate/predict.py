"""
Replicate Cog predictor for full audio analysis:
  - BPM, musical key, energy  (via essentia Python)
  - Genre, mood, instruments, danceability, voice, tonal  (via EffNet ONNX models)

Input:  audio_url (str) — publicly accessible audio file URL
Output: JSON dict with all analysis results
"""

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from cog import BasePredictor, Input
import essentia.standard as es
import numpy as np
import onnxruntime as ort
import requests

MODELS_DIR = Path("models/effnet-discogs")

# Mel-spectrogram parameters matching essentia.js EssentiaTFInputExtractor musicnn config
FRAME_SIZE   = 512
HOP_SIZE     = 256
MEL_BANDS    = 96
PATCH_FRAMES = 128
MAX_PATCHES  = 200
SAMPLE_RATE  = 16000


class Predictor(BasePredictor):
    def setup(self) -> None:
        """Load models once at startup — cached for all predictions."""
        print("[setup] Loading EffNet ONNX models...")

        # Class labels
        with open(MODELS_DIR / "discogs-effnet-bs64-1.json") as f:
            self.genre_labels = json.load(f)["classes"]
        with open(MODELS_DIR / "mtg_jamendo_moodtheme-discogs-effnet-1.json") as f:
            self.mood_theme_labels = json.load(f)["classes"]
        with open(MODELS_DIR / "mtg_jamendo_instrument-discogs-effnet-1.json") as f:
            self.instrument_labels = json.load(f)["classes"]

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1

        # Base EffNet model: mel-spectrogram → style activations + embeddings
        self.base_session = ort.InferenceSession(
            str(MODELS_DIR / "effnet-style.onnx"), sess_options=opts
        )

        # Classifier heads
        classifier_names = [
            "moodtheme", "instrument", "danceability", "voice",
            "mood_aggressive", "mood_happy", "mood_sad", "mood_relaxed", "tonal_atonal",
        ]
        self.classifiers: dict[str, ort.InferenceSession] = {
            name: ort.InferenceSession(str(MODELS_DIR / f"{name}.onnx"), sess_options=opts)
            for name in classifier_names
        }

        print(f"[setup] Loaded {len(self.classifiers) + 1} models. "
              f"Genres: {len(self.genre_labels)}, Moods: {len(self.mood_theme_labels)}, "
              f"Instruments: {len(self.instrument_labels)}")

    def predict(self, audio_url: str = Input(description="Publicly accessible audio file URL")) -> Any:
        print(f"[predict] Downloading: {audio_url[:80]}")

        # ── 1. Download audio to temp file ────────────────────────────────────
        response = requests.get(audio_url, timeout=60)
        response.raise_for_status()
        print(f"[predict] Downloaded {len(response.content) / 1024 / 1024:.1f} MB")

        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        try:
            # ── 2. Load audio at 16kHz mono (essentia handles all formats) ────
            loader = es.MonoLoader(filename=tmp_path, sampleRate=SAMPLE_RATE)
            audio = loader()  # Float32 numpy array at 16kHz mono
            print(f"[predict] Loaded {len(audio) / SAMPLE_RATE:.1f}s at {SAMPLE_RATE}Hz mono")

            # ── 3. BPM detection ──────────────────────────────────────────────
            rhythm_extractor = es.RhythmExtractor2013()
            bpm_raw, _, _, _, _ = rhythm_extractor(audio)
            bpm = int(round(float(bpm_raw)))
            print(f"[predict] BPM: {bpm}")

            # ── 4. Key detection ──────────────────────────────────────────────
            key_extractor = es.KeyExtractor()
            key, scale, _ = key_extractor(audio)
            musical_key = f"{key} {scale}"
            print(f"[predict] Key: {musical_key}")

            # ── 5. Energy (RMS) ───────────────────────────────────────────────
            rms = float(np.sqrt(np.mean(audio ** 2)))
            energy = float(min(rms / 0.25, 1.0))
            print(f"[predict] Energy: {energy:.3f}")

            # ── 6. Mel-spectrogram patches for EffNet ─────────────────────────
            # Compute mel-spectrogram matching musicnn input format using librosa
            # (TensorflowInputMusicCnn not available in pip essentia builds)
            import librosa
            mel = librosa.feature.melspectrogram(
                y=audio.astype(np.float32),
                sr=SAMPLE_RATE,
                n_fft=FRAME_SIZE,
                hop_length=HOP_SIZE,
                n_mels=MEL_BANDS,
                fmin=0.0,
                fmax=8000.0,
                power=1.0,
            )
            # Convert to log scale and normalize to [0, 1]
            mel_db = librosa.amplitude_to_db(mel, ref=np.max)  # shape (96, T)
            mel_norm = np.clip((mel_db + 80.0) / 80.0, 0.0, 1.0).T  # shape (T, 96)
            # Slice into PATCH_FRAMES patches with 50% hop
            hop = PATCH_FRAMES // 2
            patches_list = [
                mel_norm[i : i + PATCH_FRAMES]
                for i in range(0, len(mel_norm) - PATCH_FRAMES + 1, hop)
            ]
            if not patches_list:
                return _result(bpm, musical_key, energy)
            patches = np.array(patches_list[:MAX_PATCHES], dtype=np.float32)
            num_patches = patches.shape[0]
            print(f"[predict] Extracted {num_patches} mel patches")

            if num_patches == 0:
                return _result(bpm, musical_key, energy)

            # ── 7. EffNet base model ──────────────────────────────────────────
            base_out = self.base_session.run(None, {"melspectrogram": patches})
            activations = base_out[0]   # [N, 400]
            embeddings  = base_out[1]   # [N, 1280]

            mean_activations = np.mean(activations, axis=0)         # [400]
            mean_embedding   = np.mean(embeddings,  axis=0, keepdims=True)  # [1, 1280]

            # ── 8. Genres ─────────────────────────────────────────────────────
            genres = sorted(
                [{"label": self.genre_labels[i], "score": float(mean_activations[i])}
                 for i in range(len(self.genre_labels)) if mean_activations[i] > 0.05],
                key=lambda x: -x["score"],
            )[:10]

            # ── 9. Classifier heads ───────────────────────────────────────────
            def run_cls(name: str) -> np.ndarray:
                out = self.classifiers[name].run(None, {"embeddings": mean_embedding})
                return out[0][0]

            # Mood themes (56 classes)
            moods: list[dict] = []
            mood_theme_acts = run_cls("moodtheme")
            moods.extend(sorted(
                [{"label": self.mood_theme_labels[i], "score": float(mood_theme_acts[i])}
                 for i in range(len(self.mood_theme_labels)) if mood_theme_acts[i] > 0.1],
                key=lambda x: -x["score"],
            )[:5])

            # Binary mood classifiers
            agg = run_cls("mood_aggressive")
            if agg[0] > 0.3:
                moods.append({"label": "aggressive", "score": float(agg[0])})
            hap = run_cls("mood_happy")
            if hap[0] > 0.3:
                moods.append({"label": "happy", "score": float(hap[0])})
            sad = run_cls("mood_sad")
            if sad[1] > 0.3:
                moods.append({"label": "sad", "score": float(sad[1])})
            rel = run_cls("mood_relaxed")
            if rel[1] > 0.3:
                moods.append({"label": "relaxed", "score": float(rel[1])})

            # Deduplicate
            seen: set[str] = set()
            deduped: list[dict] = []
            for m in sorted(moods, key=lambda x: -x["score"]):
                if m["label"] not in seen:
                    seen.add(m["label"])
                    deduped.append(m)
            moods = deduped[:6]

            # Instruments
            inst_acts = run_cls("instrument")
            instruments = sorted(
                [{"label": self.instrument_labels[i], "score": float(inst_acts[i])}
                 for i in range(len(self.instrument_labels)) if inst_acts[i] > 0.1],
                key=lambda x: -x["score"],
            )[:10]

            # Danceability [danceable, not_danceable]
            dance = run_cls("danceability")
            danceability = float(dance[0])

            # Voice [instrumental, voice]
            voice = run_cls("voice")
            is_vocal = bool(voice[1] > voice[0])

            # Tonal [atonal, tonal]
            tonal = run_cls("tonal_atonal")
            is_tonal = bool(tonal[1] > tonal[0])

            result = {
                "bpm":          bpm,
                "musicalKey":   musical_key,
                "energy":       energy,
                "genres":       genres,
                "moods":        moods,
                "instruments":  instruments,
                "danceability": danceability,
                "isVocal":      is_vocal,
                "isTonal":      is_tonal,
            }
            print(f"[predict] Done — BPM={bpm} key={musical_key} energy={energy:.2f} "
                  f"genre={genres[0]['label'] if genres else '?'} "
                  f"mood={moods[0]['label'] if moods else '?'}")
            return result

        finally:
            os.unlink(tmp_path)


def _result(bpm: int, musical_key: str, energy: float) -> dict:
    """Minimal result when audio is too short for EffNet patches."""
    return {
        "bpm":          bpm,
        "musicalKey":   musical_key,
        "energy":       energy,
        "genres":       [],
        "moods":        [],
        "instruments":  [],
        "danceability": 0.5,
        "isVocal":      True,
        "isTonal":      True,
    }
