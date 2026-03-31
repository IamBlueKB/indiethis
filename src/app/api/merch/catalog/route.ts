import { NextResponse }      from "next/server";
import { auth }               from "@/lib/auth";
import { getCuratedCatalog }  from "@/lib/printful-catalog";

/**
 * GET /api/merch/catalog
 * Returns the curated Printful product catalog for the merch picker UI.
 * Artist-only — used by the dashboard "Add Product" flow.
 * Results are sourced from a 24h in-memory cache.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const catalog = await getCuratedCatalog();
    return NextResponse.json(
      { catalog },
      {
        headers: {
          // Tell the browser to treat this as fresh for 1h,
          // but revalidate in background for up to 24h.
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    console.error("[merch/catalog]", err);
    return NextResponse.json({ error: "Failed to load catalog." }, { status: 500 });
  }
}
