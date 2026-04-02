/**
 * src/lib/printful-catalog.ts
 * Curated Printful product catalog for IndieThis merch.
 *
 * Only these Printful catalog products are offered to artists.
 * Fetched from Printful once and cached in-memory for 24h.
 *
 * Each entry maps to a Printful catalog product ID.
 * The label/category are our own display metadata.
 */

import { getCatalogProducts, getCatalogVariants } from "@/lib/printful";
import type { PrintfulProduct, PrintfulVariant } from "@/lib/printful";

// ─── Curated allowlist ────────────────────────────────────────────────────────

export type CatalogCategory =
  | "T-Shirts"
  | "Hoodies & Sweatshirts"
  | "Hats"
  | "Posters & Art Prints"
  | "Mugs"
  | "Phone Cases"
  | "Stickers & Accessories";

export type CuratedProduct = {
  printfulProductId: number;
  label:             string;
  category:          CatalogCategory;
  description:       string;
};

/**
 * Curated list of Printful catalog product IDs we support.
 * These IDs correspond to Printful's catalog (GET /products).
 *
 * Artists see only these options when adding merch — keeps the
 * catalog focused and quality-controlled.
 */
export const CURATED_PRODUCTS: CuratedProduct[] = [
  // ── T-Shirts ───────────────────────────────────────────────────────────────
  { printfulProductId: 71,  label: "Unisex Staple Tee (Bella+Canvas 3001)", category: "T-Shirts",               description: "The go-to unisex tee. Soft, pre-shrunk, retail fit." },
  { printfulProductId: 200, label: "Men's Classic Tee (Gildan 64000)",       category: "T-Shirts",               description: "Classic cut, lightweight cotton, great for designs." },
  { printfulProductId: 381, label: "Women's Relaxed Tee (Bella+Canvas 6400D)",category: "T-Shirts",              description: "Relaxed fit women's tee with a flowy drape." },

  // ── Hoodies & Sweatshirts ──────────────────────────────────────────────────
  { printfulProductId: 146, label: "Unisex Heavy Blend Hoodie (Gildan 18500)", category: "Hoodies & Sweatshirts", description: "Thick, warm hoodie — a fan favorite for cold shows." },
  { printfulProductId: 380, label: "Unisex Lightweight Zip Hoodie",            category: "Hoodies & Sweatshirts", description: "Zip-up lightweight fleece, great for layering." },

  // ── Hats ───────────────────────────────────────────────────────────────────
  { printfulProductId: 162, label: "Classic Dad Hat (Yupoong 6245CM)",         category: "Hats",                  description: "Unstructured, low-profile cotton twill cap." },
  { printfulProductId: 77,  label: "Snapback Cap (Otto 125-978)",              category: "Hats",                  description: "Flat-brim snapback with 6-panel structured crown." },

  // ── Posters & Art Prints ───────────────────────────────────────────────────
  { printfulProductId: 1,   label: "Poster (Matte, Multiple Sizes)",           category: "Posters & Art Prints",  description: "High-quality matte poster in 12×18, 18×24, 24×36." },
  { printfulProductId: 255, label: "Fine Art Print",                            category: "Posters & Art Prints",  description: "Museum-quality paper with vibrant archival inks." },

  // ── Mugs ───────────────────────────────────────────────────────────────────
  { printfulProductId: 19,  label: "White Ceramic Mug (11oz)",                 category: "Mugs",                  description: "Dishwasher-safe ceramic mug with full wraparound print." },
  { printfulProductId: 300, label: "White Ceramic Mug (15oz)",                 category: "Mugs",                  description: "Extra-large version of the classic ceramic mug." },

  // ── Phone Cases ────────────────────────────────────────────────────────────
  { printfulProductId: 92,  label: "Tough Phone Case",                         category: "Phone Cases",            description: "Dual-layer protection for iPhone & Samsung Galaxy." },
  { printfulProductId: 173, label: "Snap Phone Case",                          category: "Phone Cases",            description: "Slim snap-on case, lightweight and precise fit." },

  // ── Stickers & Accessories ─────────────────────────────────────────────────
  { printfulProductId: 358, label: "Kiss-Cut Sticker Sheet",                   category: "Stickers & Accessories", description: "Custom sticker sheets — great for merch bundles." },
  { printfulProductId: 352, label: "Die-Cut Sticker",                          category: "Stickers & Accessories", description: "Waterproof die-cut stickers, any shape." },
];

export const CURATED_PRODUCT_IDS = new Set(CURATED_PRODUCTS.map((p) => p.printfulProductId));

export const CURATED_BY_ID = new Map(CURATED_PRODUCTS.map((p) => [p.printfulProductId, p]));

// ─── Cache ────────────────────────────────────────────────────────────────────

export type CatalogEntry = {
  printfulProductId: number;
  label:             string;
  category:          CatalogCategory;
  description:       string;
  image:             string;  // from Printful
  variantCount:      number;
  variants:          PrintfulVariant[];
};

let _cache: CatalogEntry[] | null = null;
let _cacheAt  = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/**
 * Returns the full curated catalog with Printful metadata + variants.
 * Results are cached in-memory for 24h.
 */
export async function getCuratedCatalog(): Promise<CatalogEntry[]> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  // Fetch all Printful catalog products, then filter to our allowlist
  let allProducts: PrintfulProduct[] = [];
  try {
    allProducts = await getCatalogProducts();
  } catch {
    // If Printful is unavailable and we have a stale cache, return it
    if (_cache) return _cache;
    return [];
  }

  const allowed = allProducts.filter((p) => CURATED_PRODUCT_IDS.has(p.id));

  // Fetch variants for each allowed product in parallel
  const entries = await Promise.all(
    allowed.map(async (p): Promise<CatalogEntry> => {
      const meta = CURATED_BY_ID.get(p.id)!;
      let variants: PrintfulVariant[] = [];
      try {
        variants = await getCatalogVariants(p.id);
      } catch {
        // Variants unavailable — still include the product
      }
      return {
        printfulProductId: p.id,
        label:             meta.label,
        category:          meta.category,
        description:       meta.description,
        image:             p.image,
        variantCount:      variants.length,
        variants,
      };
    })
  );

  // Sort by our curated order
  const order = CURATED_PRODUCTS.map((p) => p.printfulProductId);
  entries.sort((a, b) => order.indexOf(a.printfulProductId) - order.indexOf(b.printfulProductId));

  _cache   = entries;
  _cacheAt = Date.now();
  return entries;
}

/**
 * Get a single catalog entry by Printful product ID.
 * Uses the same 24h cache.
 */
export async function getCatalogEntry(printfulProductId: number): Promise<CatalogEntry | null> {
  const catalog = await getCuratedCatalog();
  return catalog.find((e) => e.printfulProductId === printfulProductId) ?? null;
}

/**
 * Group catalog entries by category, preserving order within each group.
 */
export function groupByCategory(entries: CatalogEntry[]): Record<CatalogCategory, CatalogEntry[]> {
  const groups = {} as Record<CatalogCategory, CatalogEntry[]>;
  for (const entry of entries) {
    if (!groups[entry.category]) groups[entry.category] = [];
    groups[entry.category].push(entry);
  }
  return groups;
}
