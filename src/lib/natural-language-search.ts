/**
 * src/lib/natural-language-search.ts
 * Client-side NLP parsing for the Explore search bar.
 * Uses Compromise.js — no API calls, runs entirely in the browser.
 */

import nlp from "compromise";
import type { RadarFilterState } from "@/components/explore/InteractiveRadarFilter";

export interface SearchFeatureProfile {
  features: Partial<RadarFilterState>;
  genre: string | null;
  mood: string | null;
  isVocal: boolean | null;
  textQuery: string;
  pills: NLPPill[];
}

export interface NLPPill {
  key: string;   // unique identifier for removal
  label: string; // display text
}

// ── Keyword dictionaries ────────────────────────────────────────────────────

const ENERGY_HIGH  = ["energetic","hype","intense","powerful","hard","aggressive","heavy","loud","banging","turnt"];
const ENERGY_LOW   = ["chill","calm","relaxed","mellow","soft","gentle","quiet","ambient","lo-fi","lofi"];
const DANCE_HIGH   = ["dance","danceable","groovy","bouncy","club","party","upbeat","funky"];
const VALENCE_HIGH = ["happy","uplifting","feel-good","positive","bright","sunny","joyful"];
const VALENCE_LOW  = ["sad","dark","moody","melancholic","emotional","somber","gloomy"];
const ACOUSTIC_HIGH = ["acoustic","organic","unplugged","natural","stripped"];
const ACOUSTIC_LOW  = ["electronic","synthetic","digital","produced","edm"];
const SPEECH_HIGH   = ["rap","spoken","lyrical","wordy","bars","spitting"];
const INSTRUMENTAL  = ["instrumental","beat","beats","production","backing"];
const VOCAL_WORDS   = ["vocals","singing","singer","vocal"];

const STOP_WORDS = new Set([
  "for","with","and","the","a","to","of","in","like","type","style",
  "music","song","songs","track","tracks","something","studying",
  "working","driving","vibes","vibe","some","me","give","find","play",
  "no","without","an","is","are","was","be","at","by","from",
]);

const GENRE_KEYWORDS: Record<string, string> = {
  "hip-hop": "Hip-Hop", "hiphop": "Hip-Hop", "rap": "Hip-Hop", "trap": "Hip-Hop",
  "r&b": "R&B", "rnb": "R&B", "soul": "R&B", "neo-soul": "R&B",
  "pop": "Pop",
  "electronic": "Electronic", "edm": "Electronic", "house": "Electronic",
  "rock": "Rock", "indie": "Rock", "alternative": "Rock",
  "jazz": "Jazz",
  "latin": "Latin", "reggaeton": "Latin",
  "country": "Country",
  "classical": "Classical",
  "afrobeats": "Afrobeats",
};

const MOOD_KEYWORDS: Record<string, string> = {
  "aggressive": "Aggressive", "angry": "Aggressive",
  "relaxed": "Relaxed", "chill": "Relaxed", "calm": "Relaxed",
  "sad": "Melancholic", "melancholic": "Melancholic", "emotional": "Melancholic",
  "happy": "Uplifting", "uplifting": "Uplifting", "joyful": "Uplifting",
  "dark": "Dark", "moody": "Dark", "gloomy": "Dark",
  "bright": "Bright", "sunny": "Bright",
  "romantic": "Romantic", "love": "Romantic",
  "hype": "Hype", "turnt": "Hype", "lit": "Hype",
};

// Pill label helpers
function energyLabel(val: number) { return val >= 0.7 ? "High Energy" : "Low Energy"; }

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseNaturalLanguageSearch(query: string): SearchFeatureProfile {
  // Compromise parses the query but we primarily use word-level matching
  nlp(query); // warm the parser (side-effect free here; used for potential future expansion)

  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);

  const features: Partial<RadarFilterState> = {};
  const pills: NLPPill[] = [];
  let genre: string | null = null;
  let mood: string | null = null;
  let isVocal: boolean | null = null;
  const unmatchedWords: string[] = [];

  // Handle "no vocals" as a two-word phrase before single-word loop
  if (query.toLowerCase().includes("no vocals") || query.toLowerCase().includes("no vocal")) {
    isVocal = false;
    features.instrumentalness = 0.8;
    pills.push({ key: "isVocal", label: "Instrumental" });
  }

  words.forEach((word) => {
    let matched = false;

    if (ENERGY_HIGH.includes(word)) {
      features.energy = 0.85;
      if (!pills.find(p => p.key === "energy")) pills.push({ key: "energy", label: energyLabel(0.85) });
      matched = true;
    } else if (ENERGY_LOW.includes(word)) {
      features.energy = 0.2;
      if (!pills.find(p => p.key === "energy")) pills.push({ key: "energy", label: energyLabel(0.2) });
      matched = true;
    }

    if (DANCE_HIGH.includes(word)) {
      features.danceability = 0.85;
      if (!pills.find(p => p.key === "danceability")) pills.push({ key: "danceability", label: "Danceable" });
      matched = true;
    }

    if (VALENCE_HIGH.includes(word)) {
      features.valence = 0.8;
      if (!pills.find(p => p.key === "valence")) pills.push({ key: "valence", label: "Upbeat Mood" });
      matched = true;
    } else if (VALENCE_LOW.includes(word)) {
      features.valence = 0.2;
      if (!pills.find(p => p.key === "valence")) pills.push({ key: "valence", label: "Dark Mood" });
      matched = true;
    }

    if (ACOUSTIC_HIGH.includes(word)) {
      features.acousticness = 0.8;
      if (!pills.find(p => p.key === "acousticness")) pills.push({ key: "acousticness", label: "Acoustic" });
      matched = true;
    } else if (ACOUSTIC_LOW.includes(word)) {
      features.acousticness = 0.15;
      if (!pills.find(p => p.key === "acousticness")) pills.push({ key: "acousticness", label: "Electronic" });
      matched = true;
    }

    if (SPEECH_HIGH.includes(word)) {
      features.speechiness = 0.75;
      if (!pills.find(p => p.key === "speechiness")) pills.push({ key: "speechiness", label: "Lyrical" });
      matched = true;
    }

    if (INSTRUMENTAL.includes(word) && isVocal === null) {
      isVocal = false;
      features.instrumentalness = 0.8;
      if (!pills.find(p => p.key === "isVocal")) pills.push({ key: "isVocal", label: "Instrumental" });
      matched = true;
    }

    if (VOCAL_WORDS.includes(word) && isVocal === null) {
      isVocal = true;
      if (!pills.find(p => p.key === "isVocal")) pills.push({ key: "isVocal", label: "Vocal" });
      matched = true;
    }

    if (GENRE_KEYWORDS[word]) {
      genre = GENRE_KEYWORDS[word];
      if (!pills.find(p => p.key === "genre")) pills.push({ key: "genre", label: genre! });
      matched = true;
    }

    if (MOOD_KEYWORDS[word]) {
      mood = MOOD_KEYWORDS[word];
      if (!pills.find(p => p.key === "mood")) pills.push({ key: "mood", label: mood! });
      matched = true;
    }

    if (STOP_WORDS.has(word)) {
      matched = true;
    }

    if (!matched) unmatchedWords.push(word);
  });

  // Context-aware phrase adjustments
  const lq = query.toLowerCase();

  if ((lq.includes("for studying") || lq.includes("study")) && features.energy === undefined) {
    features.energy = 0.25;
    features.instrumentalness = features.instrumentalness ?? 0.7;
    if (!pills.find(p => p.key === "energy")) pills.push({ key: "energy", label: "Low Energy" });
    if (!pills.find(p => p.key === "isVocal")) pills.push({ key: "isVocal", label: "Instrumental" });
  }

  if ((lq.includes("working out") || lq.includes("gym") || lq.includes("workout")) && features.energy === undefined) {
    features.energy = 0.9;
    features.danceability = features.danceability ?? 0.8;
    features.loudness = features.loudness ?? 0.8;
    if (!pills.find(p => p.key === "energy")) pills.push({ key: "energy", label: "High Energy" });
  }

  if ((lq.includes("late night") || lq.includes("midnight") || lq.includes("3am")) && features.energy === undefined) {
    features.energy = 0.3;
    features.valence = features.valence ?? 0.3;
    mood = mood ?? "Dark";
    if (!pills.find(p => p.key === "energy")) pills.push({ key: "energy", label: "Low Energy" });
    if (!pills.find(p => p.key === "mood")) pills.push({ key: "mood", label: "Dark" });
  }

  if (lq.includes("club banger") || lq.includes("club bangers")) {
    features.energy = features.energy ?? 0.9;
    features.danceability = features.danceability ?? 0.9;
    features.loudness = features.loudness ?? 0.8;
    if (!pills.find(p => p.key === "energy")) pills.push({ key: "energy", label: "High Energy" });
    if (!pills.find(p => p.key === "danceability")) pills.push({ key: "danceability", label: "Danceable" });
  }

  return {
    features,
    genre,
    mood,
    isVocal,
    textQuery: unmatchedWords.join(" ").trim(),
    pills,
  };
}

export function hasNLPSignals(profile: SearchFeatureProfile): boolean {
  return (
    Object.keys(profile.features).length > 0 ||
    profile.genre !== null ||
    profile.mood !== null ||
    profile.isVocal !== null
  );
}
