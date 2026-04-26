/**
 * One-shot: re-ingest the 48 afrobeats reference tracks with full Demucs
 * separation + per-stem analysis.
 *
 * Steps per file:
 *   1. Upload mp3 to S3 reference-library bucket → 4h signed GET URL
 *   2. fal.ai/demucs separates vocals/drums/bass/other → 4 signed URLs
 *   3. Replicate Cog "analyze-reference" runs full mix + per-stem +
 *      relationships + sections + chromaprint fingerprint
 *   4. Insert into ReferenceProfile (unique fingerprintHash skips real dupes)
 *
 * After all files: recompute AFROBEATS GenreTarget aggregate.
 *
 * Idempotent: re-running just skips dupes by fingerprint.
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Replicate from "replicate";
import { fal } from "@fal-ai/client";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const FOLDER     = "C:/Users/brian/Documents/indiethis/public/reference analysis engine audio/afrobeats";
const GENRE      = "AFROBEATS";
const SOURCE_Q   = "spotify";
const SQ_WEIGHT  = 0.9;

const prisma = new PrismaClient();
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
fal.config({ credentials: process.env.FAL_KEY });

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = (() => {
  const m = (process.env.REMOTION_SERVE_URL ?? "").match(/^https?:\/\/([^.]+)\.s3\./);
  return m?.[1] ?? "";
})();
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const MIX_VERSION = process.env.REPLICATE_MIX_MODEL_VERSION;
if (!MIX_VERSION) throw new Error("REPLICATE_MIX_MODEL_VERSION not set");
if (!BUCKET)      throw new Error("Could not parse S3 bucket from REMOTION_SERVE_URL");

function shaHex(s) { return createHash("sha256").update(s).digest("hex"); }

function parseTitle(filename) {
  const stem = filename.replace(/\.(mp3|wav|flac|m4a|aiff)$/i, "");
  const m = stem.match(/^(.+?)\s*-\s*(.+)$/);
  if (m) return { artistName: m[1].trim(), trackName: m[2].trim() };
  return { artistName: null, trackName: stem };
}

async function uploadToS3(filePath) {
  const buf = readFileSync(filePath);
  const safeName = basename(filePath).replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/reference-library/${randomUUID()}-${safeName}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buf, ContentType: "audio/mpeg",
  }));
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 14400 });
  return url;
}

async function separateStems(audioUrl) {
  // Mirror src/lib/mix-console/engine.ts separateBeatStems exactly — must
  // pass the explicit stems list and unwrap result.stems (or top-level) with
  // both string-and-{url} shapes from fal.
  const result = await fal.subscribe("fal-ai/demucs", {
    input: {
      audio_url: audioUrl,
      stems:     ["vocals", "drums", "bass", "other"],
    },
  });
  // fal v2 client always returns { data, requestId }. Stem URLs live at
  // data.{vocals,drums,bass,other}.url — there is NO `stems` wrapper.
  const data = result?.data ?? {};
  const toUrl = (v) => typeof v === "string" ? v : (v?.url ?? "");
  return {
    vocals: toUrl(data.vocals),
    drums:  toUrl(data.drums),
    bass:   toUrl(data.bass),
    other:  toUrl(data.other),
  };
}

async function analyzeReference(audioUrl, stems) {
  const input = {
    action:               "analyze-reference",
    audio_url:            audioUrl,
    stems_json:           JSON.stringify(stems),
    genre:                GENRE,
    input_balance:        JSON.stringify({ source_quality: SOURCE_Q }),
    supabase_url:         process.env.SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_KEY,
  };
  const prediction = await replicate.predictions.create({ version: MIX_VERSION, input });
  const TIMEOUT_MS = 5 * 60 * 1000;
  const result = await Promise.race([
    replicate.wait(prediction),
    new Promise((res) => setTimeout(() => res(null), TIMEOUT_MS)),
  ]);
  if (result === null) {
    try { await replicate.predictions.cancel(prediction.id); } catch {}
    throw new Error(`analyze-reference timed out (${prediction.id})`);
  }
  if (result.status !== "succeeded") {
    throw new Error(`analyze-reference ${result.status}: ${result.error ?? "unknown"}`);
  }
  return JSON.parse(result.output);
}

// Recompute GenreTarget — port of aggregate.ts
const PARAM_PATHS = [
  ["mix_lufs",["mix","lufs"]],["mix_true_peak",["mix","true_peak"]],
  ["mix_loudness_range",["mix","loudness_range"]],["mix_dynamic_range",["mix","dynamic_range"]],
  ["mix_stereo_width",["mix","stereo_width"]],["mix_rt60",["mix","rt60_estimate"]],
  ["fb_sub",["mix","frequency_balance","sub"]],["fb_low",["mix","frequency_balance","low"]],
  ["fb_low_mid",["mix","frequency_balance","low_mid"]],["fb_mid",["mix","frequency_balance","mid"]],
  ["fb_high_mid",["mix","frequency_balance","high_mid"]],["fb_air",["mix","frequency_balance","air"]],
  ["vocal_lufs",["stems","vocals","lufs"]],["vocal_centroid",["stems","vocals","spectral_centroid"]],
  ["vocal_crest_factor",["stems","vocals","crest_factor"]],["vocal_stereo_width",["stems","vocals","stereo_width"]],
  ["vocal_to_drums_db",["relationships","vocal_to_drums_db"]],["vocal_to_bass_db",["relationships","vocal_to_bass_db"]],
  ["vocal_to_other_db",["relationships","vocal_to_other_db"]],
  ["vocal_drum_freq_overlap",["relationships","vocal_drum_freq_overlap"]],
  ["vocal_other_freq_overlap",["relationships","vocal_other_freq_overlap"]],
  ["bass_kick_separation",["relationships","bass_kick_separation"]],
];
function pluck(o, path) { let c=o; for (const k of path) { if (c==null) return null; c=c[k]; } return typeof c==="number" && Number.isFinite(c) ? c : null; }
function tierWeight(s, c) { return s==="commercial"?1.0:s==="user_reference"?(c<100?0.5:c<500?0.7:0.8):s==="user_mix_outcome"?(c<100?0.2:c<500?0.4:0.5):0.5; }
function wstats(vals, wts) {
  const tw = wts.reduce((a,b)=>a+b,0)||1;
  const mean = vals.reduce((a,v,i)=>a+v*wts[i],0)/tw;
  const v = vals.reduce((a,vv,i)=>a+wts[i]*(vv-mean)**2,0)/tw;
  const idxs = vals.map((_,i)=>i).sort((a,b)=>vals[a]-vals[b]);
  const cum=[]; let acc=0; for (const i of idxs) { acc+=wts[i]; cum.push(acc); }
  const findP = pp => { const t=pp*tw; for (let k=0;k<idxs.length;k++) if (cum[k]>=t) return vals[idxs[k]]; return vals[idxs[idxs.length-1]]; };
  return { mean, std: Math.sqrt(Math.max(0,v)), p25: findP(0.25), p75: findP(0.75), n: vals.length };
}
async function recomputeGenreTarget(genre) {
  const profiles = await prisma.referenceProfile.findMany({ where:{genre,qualityGatePassed:true}, select:{source:true,sourceQualityWeight:true,separationWeight:true,weight:true,profileData:true} });
  const uo = profiles.filter(x=>x.source==="user_mix_outcome").length;
  const targets = {};
  for (const [key, path] of PARAM_PATHS) {
    const vals=[], wts=[];
    for (const pr of profiles) {
      const v = pluck(pr.profileData, path);
      if (v==null) continue;
      const w = (pr.sourceQualityWeight||1)*(pr.separationWeight||1)*(pr.weight||1)*tierWeight(pr.source, uo);
      if (w<=0) continue;
      vals.push(v); wts.push(w);
    }
    if (vals.length>=3) {
      const s = wstats(vals, wts);
      if (key==="mix_true_peak") {
        const cap = -0.5;
        if (s.mean>cap) s.mean=cap;
        if (s.p75>cap)  s.p75=cap;
        if (s.p25>cap)  s.p25=cap;
      }
      targets[key] = s;
    }
  }
  const cc = profiles.filter(x=>x.source==="commercial").length;
  const ur = profiles.filter(x=>x.source==="user_reference").length;
  await prisma.genreTarget.upsert({
    where:{genre},
    create:{genre,trackCount:profiles.length,commercialCount:cc,userRefCount:ur,userOutcomeCount:uo,targetData:targets},
    update:{trackCount:profiles.length,commercialCount:cc,userRefCount:ur,userOutcomeCount:uo,pendingCount:0,targetData:targets,lastComputed:new Date()},
  });
}

(async () => {
  // Step 0: wipe existing AFROBEATS profiles so re-analyzed re-uploads aren't
  // skipped by the unique fingerprint constraint.
  const wiped = await prisma.referenceProfile.deleteMany({ where: { genre: GENRE } });
  console.log(`[wipe] deleted ${wiped.count} existing ${GENRE} profiles`);

  const files = readdirSync(FOLDER)
    .filter(f => /\.(mp3|wav|flac|m4a|aiff)$/i.test(f))
    .sort();
  console.log(`[start] processing ${files.length} files from ${FOLDER}`);

  let ok = 0, fail = 0, skipped = 0;
  for (let i = 0; i < files.length; i++) {
    const fname = files[i];
    const fpath = join(FOLDER, fname);
    const sizeMB = (statSync(fpath).size / 1024 / 1024).toFixed(1);
    const { artistName, trackName } = parseTitle(fname);
    const tag = `[${i+1}/${files.length}]`;
    console.log(`${tag} ${artistName ?? "?"} - ${trackName} (${sizeMB} MB)`);

    try {
      console.log(`${tag}   ↑ S3 upload...`);
      const audioUrl = await uploadToS3(fpath);
      console.log(`${tag}   ✂ Demucs separation...`);
      const stems = await separateStems(audioUrl);
      const stemsOk = ["vocals","drums","bass","other"].every(k => stems[k]);
      if (!stemsOk) throw new Error("demucs returned incomplete stems: " + JSON.stringify(stems));
      console.log(`${tag}   🧠 Cog analyze-reference...`);
      const profile = await analyzeReference(audioUrl, stems);

      const fpHash = profile.fingerprint_hash ? shaHex(profile.fingerprint_hash) : null;
      try {
        await prisma.referenceProfile.create({
          data: {
            source:               "commercial",
            sourceQuality:        SOURCE_Q,
            sourceQualityWeight:  SQ_WEIGHT,
            separationConfidence: profile.separation_confidence,
            separationWeight:     profile.separation_weight,
            genre:                GENRE,
            trackName, artistName,
            fingerprintHash:      fpHash,
            profileData:          profile,
            qualityGatePassed:    profile.separation_confidence >= 0.6,
            weight:               1.0,
          },
        });
        ok++;
        const stemsCount = Object.keys(profile.stems || {}).length;
        console.log(`${tag}   ✓ saved (sep=${profile.separation_confidence}, stems=${stemsCount})`);
      } catch (e) {
        if (e?.code === "P2002") {
          skipped++;
          console.log(`${tag}   ⊘ duplicate fingerprint, skipped`);
        } else {
          throw e;
        }
      }
    } catch (e) {
      fail++;
      console.error(`${tag}   ✗ FAILED:`, e.message);
    }
  }

  console.log(`\n[done] ok=${ok} skipped=${skipped} fail=${fail}`);
  console.log(`[aggregate] recomputing ${GENRE} GenreTarget...`);
  await recomputeGenreTarget(GENRE);
  const gt = await prisma.genreTarget.findUnique({ where: { genre: GENRE } });
  const td = gt?.targetData ?? {};
  console.log(`[aggregate] AFROBEATS: ${gt?.trackCount} tracks`);
  for (const k of ["mix_lufs","mix_true_peak","vocal_lufs","vocal_to_drums_db","vocal_to_bass_db","bass_kick_separation","vocal_centroid"]) {
    const s = td[k];
    if (s) console.log(`  ${k}: mean=${s.mean.toFixed(2)} std=${s.std.toFixed(2)} (p25=${s.p25.toFixed(2)}, p75=${s.p75.toFixed(2)}, n=${s.n})`);
    else   console.log(`  ${k}: MISSING`);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("[fatal]", e);
  await prisma.$disconnect();
  process.exit(1);
});
