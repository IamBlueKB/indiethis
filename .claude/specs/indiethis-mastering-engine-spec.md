# IndieThis — Mastering Engine (Replicate Cog Deployment)
_For Sonnet — Follow the existing audio analysis Replicate pattern_

---

## CONTEXT

The mastering frontend is fully built. The Python DSP engine that powers it does not exist. This spec builds it as a Replicate Cog endpoint — same deployment pattern as the existing audio analysis model at `r8.im/indiethis/indiethis-audio-analysis`.

---

## WHAT NOT TO DO

- Do NOT use async/await in the Cog Predictor — Replicate Cog does not support async predict methods
- Do NOT use `httpx.AsyncClient` — use `requests` (synchronous)
- Do NOT import Demucs as `from demucs import separate` — use subprocess `python -m demucs`
- Do NOT set `gpu: true` unless testing confirms CPU is too slow — GPU instances cost significantly more per second on Replicate
- Do NOT use the simplified gain-only mastering — use Matchering for real reference-based mastering

---

## PROJECT STRUCTURE

```
replicate/mastering/
├── cog.yaml
├── predict.py
└── requirements.txt
```

---

## cog.yaml

```yaml
build:
  gpu: false
  system_packages:
    - ffmpeg
    - libsndfile1
  python_version: "3.10"
  python_packages:
    - -r requirements.txt
predict: "predict.py:Predictor"
```

Note: Start with `gpu: false` (CPU). Demucs runs slower on CPU but costs ~$0.0001/sec vs ~$0.0014/sec for GPU. Test with a real track — if stem separation takes more than 5 minutes on CPU, switch to `gpu: true`.

---

## requirements.txt

```
librosa==0.10.1
pyloudnorm==0.1.1
pedalboard==0.9.0
demucs==4.0.1
matchering==2.1.1
requests==2.31.0
numpy==1.24.3
soundfile==0.12.1
supabase==1.2.0
```

---

## predict.py

```python
import os
import json
import tempfile
import subprocess
import shutil
import requests
import numpy as np
import librosa
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import (
    Pedalboard, Compressor, Limiter, Gain,
    LowShelfFilter, HighShelfFilter, PeakFilter
)
import matchering as mg
from supabase import create_client
from cog import BasePredictor, Input


# ---------- Supabase setup ----------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def get_supabase():
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return None


# ---------- Helper: download audio ----------
def download_audio(url: str, suffix: str = ".wav") -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    resp = requests.get(url, timeout=300)
    resp.raise_for_status()
    tmp.write(resp.content)
    tmp.close()
    return tmp.name


# ---------- Helper: upload to Supabase ----------
def upload_to_supabase(local_path: str, bucket: str, remote_path: str) -> str:
    client = get_supabase()
    if not client:
        raise RuntimeError("Supabase not configured")
    with open(local_path, "rb") as f:
        client.storage.from_(bucket).upload(
            remote_path, f,
            file_options={"content-type": "audio/wav"}
        )
    res = client.storage.from_(bucket).create_signed_url(remote_path, 3600)
    return res["signedURL"]


# ---------- Helper: key estimation ----------
def estimate_key(chroma: np.ndarray) -> str:
    avg_chroma = chroma.mean(axis=1)
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    best_corr = -1
    best_key = "C major"

    for i in range(12):
        rotated = np.roll(avg_chroma, -i)
        major_corr = np.corrcoef(rotated, major_profile)[0, 1]
        minor_corr = np.corrcoef(rotated, minor_profile)[0, 1]

        if major_corr > best_corr:
            best_corr = major_corr
            best_key = f"{keys[i]} major"
        if minor_corr > best_corr:
            best_corr = minor_corr
            best_key = f"{keys[i]} minor"

    return best_key


# ---------- Main Predictor ----------
class Predictor(BasePredictor):

    def setup(self):
        """Called once when the model starts. Pre-download Demucs weights."""
        # Trigger Demucs model download by running a dry separation
        print("Pre-loading Demucs model...")
        try:
            subprocess.run(
                ["python", "-m", "demucs", "--help"],
                capture_output=True, timeout=30
            )
        except Exception:
            pass
        print("Setup complete")

    def predict(
        self,
        action: str = Input(description="One of: analyze, separate, classify-stems, mix, master, preview, health"),
        audio_url: str = Input(description="Signed URL to input audio file", default=""),
        reference_url: str = Input(description="Signed URL to reference track (for mastering)", default=""),
        stems_urls: str = Input(description="JSON string of stem name → URL mapping", default="{}"),
        job_id: str = Input(description="Unique job ID for organizing outputs", default=""),
    ) -> str:
        """Route to the appropriate method. Returns JSON string."""

        if action == "health":
            return json.dumps({"status": "ok"})

        if action == "analyze":
            result = self._analyze(audio_url)
        elif action == "separate":
            result = self._separate(audio_url, job_id)
        elif action == "classify-stems":
            stems = json.loads(stems_urls)
            result = self._classify_stems(stems)
        elif action == "mix":
            stems = json.loads(stems_urls)
            result = self._mix(stems, job_id)
        elif action == "master":
            result = self._master(audio_url, reference_url, job_id)
        elif action == "preview":
            result = self._preview(audio_url, job_id)
        else:
            raise ValueError(f"Unknown action: {action}")

        return json.dumps(result)

    # ---------- ANALYZE ----------
    def _analyze(self, audio_url: str) -> dict:
        audio_path = download_audio(audio_url)
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo) if not hasattr(tempo, '__len__') else float(tempo[0])

        # Key
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key = estimate_key(chroma)

        # LUFS
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(y)

        # Frequency balance
        spec = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)
        balance = {
            "sub": float(spec[freqs < 60].mean()),
            "low": float(spec[(freqs >= 60) & (freqs < 250)].mean()),
            "mid": float(spec[(freqs >= 250) & (freqs < 2000)].mean()),
            "high": float(spec[freqs >= 2000].mean()),
        }

        # Sections (simplified — onset-based segmentation)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo_val, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)

        os.unlink(audio_path)

        return {
            "bpm": bpm,
            "key": key,
            "lufs": float(loudness),
            "balance": balance,
            "beat_count": len(beat_times),
            "duration": float(len(y) / sr)
        }

    # ---------- SEPARATE ----------
    def _separate(self, audio_url: str, job_id: str) -> dict:
        audio_path = download_audio(audio_url)
        out_dir = tempfile.mkdtemp()

        # Run Demucs via subprocess (reliable across versions)
        subprocess.run(
            ["python", "-m", "demucs", "-o", out_dir, "--two-stems=vocals", audio_path],
            check=True, timeout=600
        )

        # Demucs outputs to out_dir/htdemucs/<filename>/
        # Find the output directory
        demucs_out = None
        for root, dirs, files in os.walk(out_dir):
            if "vocals.wav" in files:
                demucs_out = root
                break

        if not demucs_out:
            # Try full 4-stem separation
            subprocess.run(
                ["python", "-m", "demucs", "-o", out_dir, audio_path],
                check=True, timeout=600
            )
            for root, dirs, files in os.walk(out_dir):
                if "vocals.wav" in files:
                    demucs_out = root
                    break

        if not demucs_out:
            raise RuntimeError("Demucs produced no output")

        # Upload each stem
        stems = {}
        for stem_name in ["vocals", "drums", "bass", "other", "no_vocals"]:
            stem_path = os.path.join(demucs_out, f"{stem_name}.wav")
            if os.path.exists(stem_path):
                remote_path = f"mastering/{job_id}/{stem_name}.wav"
                signed_url = upload_to_supabase(stem_path, "processed", remote_path)
                stems[stem_name] = signed_url

        # Cleanup
        os.unlink(audio_path)
        shutil.rmtree(out_dir, ignore_errors=True)

        return {"stems": stems}

    # ---------- CLASSIFY STEMS ----------
    def _classify_stems(self, stems_urls: dict) -> dict:
        """Classify uploaded stems by analyzing frequency content."""
        classifications = {}
        for name, url in stems_urls.items():
            audio_path = download_audio(url)
            y, sr = librosa.load(audio_path, sr=None, mono=True)

            spec = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)

            energy_sub = float(spec[freqs < 80].mean())
            energy_low = float(spec[(freqs >= 80) & (freqs < 300)].mean())
            energy_mid = float(spec[(freqs >= 300) & (freqs < 4000)].mean())
            energy_high = float(spec[freqs >= 4000].mean())

            # Simple heuristic classification
            if energy_sub > energy_mid and energy_sub > energy_high:
                stem_type = "bass"
            elif energy_high > energy_mid and energy_high > energy_low:
                stem_type = "hi-hat/cymbal"
            elif energy_sub > energy_low * 1.5:
                stem_type = "kick"
            elif energy_mid > energy_high:
                stem_type = "vocals/synth"
            else:
                stem_type = "other"

            classifications[name] = {
                "type": stem_type,
                "energy": {
                    "sub": energy_sub,
                    "low": energy_low,
                    "mid": energy_mid,
                    "high": energy_high
                }
            }

            os.unlink(audio_path)

        return {"classifications": classifications}

    # ---------- MIX ----------
    def _mix(self, stems_urls: dict, job_id: str) -> dict:
        """Apply per-stem processing chains and mix to stereo."""
        mixed = None
        sr_out = None

        # Define processing chains per stem type
        chains = {
            "vocals": Pedalboard([
                PeakFilter(cutoff_frequency_hz=3000, gain_db=2, q=1.0),
                Compressor(threshold_db=-18, ratio=3, attack_ms=10, release_ms=100),
                Limiter(threshold_db=-1)
            ]),
            "bass": Pedalboard([
                LowShelfFilter(cutoff_frequency_hz=80, gain_db=3),
                Compressor(threshold_db=-15, ratio=4, attack_ms=5, release_ms=50),
                Limiter(threshold_db=-1)
            ]),
            "drums": Pedalboard([
                PeakFilter(cutoff_frequency_hz=100, gain_db=2, q=1.5),
                PeakFilter(cutoff_frequency_hz=5000, gain_db=1.5, q=1.0),
                Compressor(threshold_db=-12, ratio=4, attack_ms=2, release_ms=30),
                Limiter(threshold_db=-1)
            ]),
            "other": Pedalboard([
                Compressor(threshold_db=-20, ratio=2, attack_ms=15, release_ms=150),
                Limiter(threshold_db=-1)
            ])
        }

        for name, url in stems_urls.items():
            audio_path = download_audio(url)
            y, sr = librosa.load(audio_path, sr=None, mono=False)
            sr_out = sr

            # Make stereo if mono
            if y.ndim == 1:
                y = np.stack([y, y])

            # Apply chain
            chain = chains.get(name, chains["other"])
            processed = chain(y, sr)

            if mixed is None:
                mixed = processed
            else:
                # Match lengths
                min_len = min(mixed.shape[1], processed.shape[1])
                mixed = mixed[:, :min_len] + processed[:, :min_len]

            os.unlink(audio_path)

        # Normalize to prevent clipping
        peak = np.max(np.abs(mixed))
        if peak > 0:
            mixed = mixed / peak * 0.95

        # Save and upload
        out_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        sf.write(out_path, mixed.T, sr_out)

        remote_path = f"mastering/{job_id}/mixed.wav"
        signed_url = upload_to_supabase(out_path, "processed", remote_path)

        os.unlink(out_path)

        return {"mixed_url": signed_url}

    # ---------- MASTER ----------
    def _master(self, audio_url: str, reference_url: str, job_id: str) -> dict:
        """Produce 4 mastered versions using Matchering + Pedalboard."""
        input_path = download_audio(audio_url)
        out_dir = tempfile.mkdtemp()
        versions = {}

        if reference_url:
            # Reference-based mastering with Matchering
            ref_path = download_audio(reference_url)

            # Matchering produces a mastered version matching the reference's sonic profile
            clean_path = os.path.join(out_dir, "clean.wav")
            mg.process(
                target=input_path,
                reference=ref_path,
                results=[mg.pcm16(clean_path)]
            )

            os.unlink(ref_path)
        else:
            # No reference — use loudness normalization as baseline
            y, sr = librosa.load(input_path, sr=None, mono=False)
            if y.ndim == 1:
                y = np.stack([y, y])
            meter = pyln.Meter(sr)
            loudness = meter.integrated_loudness(y[0])
            target_lufs = -14.0
            gain_db = target_lufs - loudness
            y_norm = y * (10 ** (gain_db / 20))
            y_norm = np.clip(y_norm, -1, 1)
            clean_path = os.path.join(out_dir, "clean.wav")
            sf.write(clean_path, y_norm.T, sr)

        # Load the clean master as baseline for variations
        y_clean, sr = librosa.load(clean_path, sr=None, mono=False)
        if y_clean.ndim == 1:
            y_clean = np.stack([y_clean, y_clean])

        # Clean — upload as-is
        remote_clean = f"mastering/{job_id}/master_clean.wav"
        versions["clean"] = upload_to_supabase(clean_path, "processed", remote_clean)

        # Warm — low shelf boost, gentle saturation, slight high roll-off
        warm_board = Pedalboard([
            LowShelfFilter(cutoff_frequency_hz=200, gain_db=2.5),
            HighShelfFilter(cutoff_frequency_hz=8000, gain_db=-1.5),
            Compressor(threshold_db=-16, ratio=2, attack_ms=20, release_ms=200),
            Limiter(threshold_db=-0.5)
        ])
        y_warm = warm_board(y_clean, sr)
        warm_path = os.path.join(out_dir, "warm.wav")
        sf.write(warm_path, y_warm.T, sr)
        remote_warm = f"mastering/{job_id}/master_warm.wav"
        versions["warm"] = upload_to_supabase(warm_path, "processed", remote_warm)

        # Punch — mid presence boost, aggressive compression, tight limiter
        punch_board = Pedalboard([
            PeakFilter(cutoff_frequency_hz=2500, gain_db=3, q=1.2),
            LowShelfFilter(cutoff_frequency_hz=60, gain_db=2),
            Compressor(threshold_db=-12, ratio=4, attack_ms=5, release_ms=60),
            Limiter(threshold_db=-0.3)
        ])
        y_punch = punch_board(y_clean, sr)
        punch_path = os.path.join(out_dir, "punch.wav")
        sf.write(punch_path, y_punch.T, sr)
        remote_punch = f"mastering/{job_id}/master_punch.wav"
        versions["punch"] = upload_to_supabase(punch_path, "processed", remote_punch)

        # Loud — hard compression, maximizer style, pushed LUFS
        loud_board = Pedalboard([
            Compressor(threshold_db=-8, ratio=6, attack_ms=2, release_ms=30),
            Gain(gain_db=4),
            Limiter(threshold_db=-0.1)
        ])
        y_loud = loud_board(y_clean, sr)
        loud_path = os.path.join(out_dir, "loud.wav")
        sf.write(loud_path, y_loud.T, sr)
        remote_loud = f"mastering/{job_id}/master_loud.wav"
        versions["loud"] = upload_to_supabase(loud_path, "processed", remote_loud)

        # Cleanup
        os.unlink(input_path)
        shutil.rmtree(out_dir, ignore_errors=True)

        return {"versions": versions}

    # ---------- PREVIEW ----------
    def _preview(self, audio_url: str, job_id: str) -> dict:
        """Extract 30s of highest energy section."""
        audio_path = download_audio(audio_url)
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        # Compute RMS in 1-second windows
        hop = sr
        rms = librosa.feature.rms(y=y, hop_length=hop)[0]

        # Find 30-second window with max average RMS
        window_frames = 30
        if len(rms) <= window_frames:
            # Track is shorter than 30s — use whole thing
            preview = y
        else:
            best_start = 0
            best_rms = 0
            for i in range(len(rms) - window_frames):
                avg = np.mean(rms[i:i + window_frames])
                if avg > best_rms:
                    best_rms = avg
                    best_start = i

            start_sample = best_start * hop
            end_sample = start_sample + (30 * sr)
            preview = y[start_sample:end_sample]

        # Fade in/out (0.5s each)
        fade_samples = int(0.5 * sr)
        if len(preview) > fade_samples * 2:
            fade_in = np.linspace(0, 1, fade_samples)
            fade_out = np.linspace(1, 0, fade_samples)
            preview[:fade_samples] *= fade_in
            preview[-fade_samples:] *= fade_out

        out_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        sf.write(out_path, preview, sr)

        remote_path = f"mastering/{job_id}/preview.wav"
        signed_url = upload_to_supabase(out_path, "processed", remote_path)

        os.unlink(audio_path)
        os.unlink(out_path)

        return {"preview_url": signed_url}
```

---

## DEPLOYMENT

From Blue's Windows machine:

```
cd C:\Users\brian\Documents\indiethis\replicate\mastering
C:\cog.exe login --token <REPLICATE_TOKEN>
C:\cog.exe push r8.im/indiethis/indiethis-mastering
```

Push takes ~10-15 minutes (Demucs model download). After push, copy the version hash and set in Vercel:

```
REPLICATE_MASTERING_MODEL_VERSION=<version hash from push output>
```

---

## ENGINE.TS UPDATE

Replace all `fetch(MASTERING_ENGINE_URL + "/analyze")` style calls with Replicate calls:

```typescript
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const MASTERING_VERSION = process.env.REPLICATE_MASTERING_MODEL_VERSION;

async function callMasteringEngine(action: string, inputs: Record<string, string>) {
  const prediction = await replicate.predictions.create({
    version: MASTERING_VERSION,
    input: { action, ...inputs },
  });
  const result = await replicate.wait(prediction);
  if (result.status === "failed") {
    throw new Error(`Mastering engine failed: ${result.error}`);
  }
  return JSON.parse(result.output);
}

export async function analyze(audioUrl: string) {
  return callMasteringEngine('analyze', { audio_url: audioUrl });
}

export async function separateStems(audioUrl: string, jobId: string) {
  return callMasteringEngine('separate', { audio_url: audioUrl, job_id: jobId });
}

export async function classifyStems(stemsUrls: Record<string, string>) {
  return callMasteringEngine('classify-stems', { stems_urls: JSON.stringify(stemsUrls) });
}

export async function mixStems(stemsUrls: Record<string, string>, jobId: string) {
  return callMasteringEngine('mix', { stems_urls: JSON.stringify(stemsUrls), job_id: jobId });
}

export async function master(audioUrl: string, jobId: string, referenceUrl?: string) {
  return callMasteringEngine('master', {
    audio_url: audioUrl,
    reference_url: referenceUrl || "",
    job_id: jobId
  });
}

export async function preview(audioUrl: string, jobId: string) {
  return callMasteringEngine('preview', { audio_url: audioUrl, job_id: jobId });
}
```

---

## ENVIRONMENT VARIABLES

Add to Vercel:

| Variable | Value |
|----------|-------|
| `REPLICATE_MASTERING_MODEL_VERSION` | Version hash from `cog push` output |
| `PAYWALL_ENABLED` | `true` |

Already set (no changes needed):
- `REPLICATE_API_TOKEN` — already in Vercel
- `SUPABASE_URL` — already used by the app (note: must also be set as env var in the Replicate model settings)
- `SUPABASE_SERVICE_KEY` — must be set in Replicate model settings (not Vercel — the Python code reads it)

**Important:** Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as environment variables on the Replicate model page (Settings → Environment Variables). The Python code running on Replicate needs these to upload results to Supabase.

---

## COST ESTIMATE PER MASTERING JOB

| Step | Replicate CPU Time | Cost (~$0.0001/sec) |
|------|-------------------|---------------------|
| Analyze | ~10-15s | ~$0.002 |
| Separate (Demucs) | ~60-120s | ~$0.006-0.012 |
| Mix | ~15-30s | ~$0.002-0.003 |
| Master (4 versions) | ~30-60s | ~$0.003-0.006 |
| Preview | ~5-10s | ~$0.001 |
| **Total per job** | | **~$0.014-0.024** |

At Mix & Master pricing ($7.99-24.99), margin is 99%+.

If CPU is too slow for Demucs, switch `gpu: false` to `gpu: true` in cog.yaml and repush. GPU cost is ~$0.0014/sec — Demucs would drop from 120s to ~15s but total job cost rises to ~$0.05-0.08. Still excellent margin.

---

## TESTING

After deployment, test each action:

1. `analyze` — pass a signed Supabase URL to a test track, verify BPM/key/LUFS return
2. `separate` — verify 4 stems upload to Supabase `processed` bucket
3. `mix` — verify mixed stereo file uploads
4. `master` — verify 4 versions (clean/warm/punch/loud) upload
5. `master` with reference — verify Matchering produces a reference-matched master
6. `preview` — verify 30s clip with fade in/out

Test with Razor's Edge to confirm BPM (~140) and key (F minor) match the existing EffNet analysis.

---

## RE-ENABLE PAYWALL

After testing, set `PAYWALL_ENABLED=true` in Vercel env vars. The mastering job creation route should check this before allowing submissions.
