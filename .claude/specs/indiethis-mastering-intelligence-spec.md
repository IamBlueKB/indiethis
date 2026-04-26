# IndieThis — Mastering Intelligence & Access Spec
_For Sonnet — Add to existing mastering pipeline. Do not rebuild anything._

---

## 1. SELECTION LOGGING

Every completed mastering job must store additional data for the intelligence layer. Add these fields to `MasteringJob` if not present:

| Field | Type | Source |
|-------|------|--------|
| `selectedVersion` | String | Artist picks clean/warm/punch/loud on compare screen |
| `inputLufs` | Float | From analyze step output |
| `inputBpm` | Float | From analyze step output |
| `inputKey` | String | From analyze step output |
| `inputBalance` | Json | From analyze step — { sub, low, mid, high } |
| `effnetGenre` | String | From track's EffNet classification (if available) |
| `directionUsed` | String | What direction text was applied (if any) |
| `referenceUsed` | Boolean | Whether a reference track was uploaded |

When the artist selects a version on the compare screen (`POST /api/mastering/job/[id]/select-version`), write `selectedVersion` to the job record. All input analysis fields should be stored when the analyze step completes.

This data costs nothing to collect and becomes the foundation for every intelligence feature below.

---

## 2. GENRE-AWARE PROCESSING CHAINS

The mastering engine currently applies the same EQ/compression chains regardless of what genre the track is. Update the `_master` method in predict.py to adjust processing based on genre.

**How it works:**
- The `analyze` step already returns frequency balance (sub/low/mid/high)
- EffNet genre classification is already on the Track record
- Pass `genre` and `balance` as additional inputs to the `master` action
- Adjust the Warm/Punch/Loud chains based on genre + input balance

**Example adjustments:**

| Genre | Warm Adjustment | Punch Adjustment | Loud Adjustment |
|-------|----------------|-------------------|-----------------|
| HIP_HOP | More sub boost (+3dB at 60Hz) | Harder compression (ratio 5) | More limiting, push LUFS to -10 |
| ACOUSTIC | Gentler low shelf (+1.5dB) | Less compression (ratio 2) | Softer limiting, keep dynamics |
| ELECTRONIC | Wider stereo, high shelf boost | Fast attack compression | Hard brickwall, push LUFS to -8 |
| RNB | Warm mid presence | Smooth compression | Moderate loudness |
| ROCK | Low-mid cut, high presence | Aggressive compression | Loud but not crushed |

**Input balance adjustments:**
- If input is already bass-heavy (sub > mid * 1.5), reduce the sub boost in Warm
- If input has weak highs (high < mid * 0.5), add high shelf boost across all versions
- If input is already loud (LUFS > -10), reduce gain staging to prevent over-compression

This requires updating predict.py and doing a `cog push`. Add `genre` and `input_balance` as optional Input parameters to the predict method.

---

## 3. REFERENCE TRACK LIBRARY

**Seed the library:**
- Blue will provide audio files across genres
- Run each through the Replicate `analyze` action
- Store the analysis profile (LUFS, frequency balance, BPM, key) in a new `ReferenceProfile` model:

```
model ReferenceProfile {
  id          String   @id @default(cuid())
  genre       String   // HIP_HOP, POP, RNB, etc.
  lufs        Float
  balance     Json     // { sub, low, mid, high }
  bpm         Float
  key         String
  sourceHash  String   // hash of the file, no need to store the actual audio
  createdAt   DateTime @default(now())
}
```

**Auto-match when no reference provided:**
- After analyze runs, query `ReferenceProfile` for the closest match by genre + frequency balance
- Use that profile's characteristics to inform the Matchering reference or EQ target
- Artist doesn't need to upload a reference — the engine finds the best match automatically

**Grows over time:**
- Every time a Premium/Pro artist uploads a reference track, analyze it and add the profile to the library (anonymized — no audio stored, just the analysis data)

---

## 4. VERSION REORDERING

Once enough selection data exists (1000+ jobs), analyze patterns:
- Query: for tracks with genre X and input balance Y, which version gets selected most?
- Reorder the 4 versions on the compare screen with the most likely preferred version first
- Artist still picks — this just puts the best guess on top

**Do not build this now.** Just collect the data (item 1). The reordering logic comes later when there's enough data to be meaningful.

---

## 5. PERSISTENT FILE STORAGE & RE-DOWNLOAD

**Problem:** Mastered files are in Supabase `processed` bucket but signed URLs expire in 1 hour. Artist can't re-download after that.

**Fix:**
- Store the Supabase file paths (not signed URLs) on the `MasteringJob` record:

| Field | Example Value |
|-------|---------------|
| `cleanFilePath` | `mastering/{jobId}/master_clean.wav` |
| `warmFilePath` | `mastering/{jobId}/master_warm.wav` |
| `punchFilePath` | `mastering/{jobId}/master_punch.wav` |
| `loudFilePath` | `mastering/{jobId}/master_loud.wav` |

- The download route (`GET /api/mastering/job/[id]/download`) generates a fresh signed URL on demand from the stored file path
- Artist can come back to their dashboard anytime and re-download their mastered files
- Files remain in Supabase indefinitely (or until a retention policy is set)

---

## 6. GUEST ACCESS TOKEN

**Problem:** Non-subscriber pays for mastering, email says "download will be emailed," email directs to login, but guest has no account. They paid and can't get their files.

**Fix:**

Create a `MasteringAccessToken` model:

```
model MasteringAccessToken {
  id            String       @id @default(cuid())
  jobId         String       @unique
  job           MasteringJob @relation(fields: [jobId], references: [id])
  token         String       @unique @default(cuid())
  email         String
  expiresAt     DateTime     // 7 days from creation
  createdAt     DateTime     @default(now())
}
```

**Flow:**
1. Guest pays for mastering → job created with their email
2. Job completes → generate `MasteringAccessToken` with 7-day expiry
3. Email sent with link: `https://indiethis.com/master/results?token={token}`
4. Link takes them directly to the compare screen — no login required
5. Guest listens to A/B comparison (original vs 4 versions), picks their version, downloads
6. Token expires after 7 days
7. After download, show conversion CTA: "Want unlimited re-downloads and more tools? Create your account."

**The compare screen via token must:**
- Load the job data using the token (not session auth)
- Show original audio A/B toggle with all 4 mastered versions
- Allow version selection and download
- Not require login at any point
- Show a non-intrusive signup prompt after download

**Email template update:**
- Replace "log in to download" with "Click here to listen and download your mastered track"
- Link goes to the token URL, not the login page

---

## 7. DIRECTION FIELD FIX

**Problem:** The Direction placeholder shows stem-level mixing instructions ("More reverb on the chorus. Punchier kick. Wide stereo on the pad.") but the stereo 2-track mode can't apply those — you'd need separated stems.

**Fix:**
- For **stereo 2-track uploads**, change the Direction placeholder to mastering-appropriate language:
  - `"Warmer tone. Brighter highs. More low end. Radio-ready loudness."`
- For **stems uploads**, keep the current mixing-level placeholder:
  - `"More reverb on the chorus. Punchier kick. Wide stereo on the pad."`
- Detect based on the upload mode (stereo vs stems) and swap the placeholder accordingly

---

## 8. AI DIRECTION ASSISTANT

**Problem:** The Direction field is a blank textarea. Most artists don't know what to type. The engine already analyzes the track — use that intelligence to help.

**Flow (happens after payment, not before):**
1. Artist uploads stereo file
2. Artist hits Pay & Master
3. Payment processes
4. Analyze runs (~10-15 seconds)
5. Claude receives the analysis data and generates a plain-language recommendation
6. Recommendation appears on screen: "Your track has heavy sub bass and quiet highs. I'd recommend brightening the top end and tightening the low end for a cleaner master. Apply this direction?"
7. Artist sees three options: **Accept** / **Modify** (opens Direction textarea pre-filled with the suggestion) / **Skip** (master with no direction)
8. Master runs with the accepted or modified direction

**Claude prompt for recommendation:**
```
You are a mastering engineer. Based on this track analysis, give a brief, plain-language recommendation for mastering direction. Keep it to 1-2 sentences. Be specific about what you'd adjust.

Analysis:
- BPM: {bpm}
- Key: {key}
- LUFS: {lufs}
- Frequency balance: sub={sub}, low={low}, mid={mid}, high={high}
- Genre: {genre}

Respond with just the recommendation, no preamble.
```

**Cost:** ~$0.01-0.02 per Claude call. Total job cost with AI assistant: ~$0.05 max. Still 99%+ margin on all tiers.

**Important:** The AI recommendation happens AFTER payment. Do not analyze or provide suggestions before the artist pays.

---

## 9. PLATFORM INFO TIPS DURING PROCESSING

**Problem:** Processing takes a few minutes. Dead screen time is wasted attention.

**Fix:** Add rotating info tips alongside the existing progress bar and stage indicators Sonnet already built. Do not replace the progress bar — add tips below or beside it.

**Tips rotate every 5-8 seconds:**
- "Did you know? You can create a music video from this track in Video Studio."
- "Add cover art to complete your release — try the Cover Art generator."
- "Set up your merch store and sell directly from your artist page."
- "Your mastered track can be added to a release with cover art and lyric video."
- "Upload your studio bounce sessions to your artist page — fans love behind-the-scenes content."
- "Try Director Mode for a cinematic music video with AI-generated scenes."
- "Your track analysis powers smarter mastering — the more you use it, the better it gets."

Store tips in a simple array. Rotate with `setInterval`. Non-intrusive — small text below the progress bar, subtle fade transitions.

---

## COST SUMMARY

| Component | Cost Per Job |
|-----------|-------------|
| Replicate analyze | ~$0.002 |
| Replicate master (4 versions) | ~$0.01-0.03 |
| Replicate preview | ~$0.001 |
| Claude AI direction | ~$0.01-0.02 |
| fal.ai Demucs (stems mode only) | ~$0.01-0.02 |
| **Total per stereo job** | **~$0.03-0.05** |
| **Total per stems job** | **~$0.04-0.07** |

All tiers remain at 99%+ margin.

---

## IMPLEMENTATION ORDER

1. Selection logging (fields + write on version select) — do first, costs nothing
2. Direction placeholder fix — quick copy change
3. Persistent file storage + re-download — essential fix
4. Guest access token — essential fix for non-subscribers
5. AI direction assistant — after webhook pipeline is wired
6. Platform info tips during processing — low effort addition
7. Genre-aware chains — requires predict.py update + cog push
8. Reference track library — seed with Blue's tracks after genre-aware chains work
9. Version reordering — only after 1000+ jobs with selection data
