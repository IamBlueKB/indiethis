# BNAM DSP Engine

Python FastAPI server that handles all audio processing for the AI Mix & Master Studio.

## Stack

- **FastAPI** — HTTP server
- **Pedalboard** — per-stem DSP (EQ, compression, reverb, delay, saturation, limiting)
- **Matchering** — reference track matching
- **librosa** — audio analysis (BPM, key, section detection, spectral features)
- **pyloudnorm** — LUFS measurement and normalization
- **scipy / numpy** — multiband compression, mid/side processing, mono bass
- **soundfile** — audio I/O
- **Replicate** — Demucs stem separation (Master Only mode)

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| POST | /analyze | BPM, key, LUFS, sections, frequency balance |
| POST | /separate | Demucs stem separation (stereo → vocals/bass/drums/other) |
| POST | /classify-stems | Classify + analyze uploaded stems |
| POST | /mix | Per-stem processing chain → stereo mixdown |
| POST | /master | Mastering chain → 4 versions + platform exports |
| POST | /preview | 30-second preview of mix or master (always free) |

## Running locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Environment variables

```
REPLICATE_API_TOKEN=   # for Demucs stem separation
AWS_ACCESS_KEY_ID=     # for S3 file storage
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET=
```

## Deployment

Target: AWS EC2 t3.medium (~$30/month) or AWS Lambda with a Pedalboard layer.
The Next.js app calls this engine via `MASTERING_ENGINE_URL` env var.
Set `MASTERING_ENGINE_SECRET` on both sides for request auth.
