import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// GET — return all pricing rows
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.platformPricing.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ pricing: rows });
}

// PATCH — update one or many price items
// Body: { updates: Array<{ key: string; value: number; display: string }> }
export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    updates: Array<{ key: string; value: number; display?: string }>;
  };

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const results = await Promise.all(
    body.updates.map(async ({ key, value, display }) => {
      // Auto-format display if not provided
      const autoDisplay = display ?? formatDisplay(key, value);
      return db.platformPricing.update({
        where: { key },
        data: {
          value,
          display: autoDisplay,
          updatedBy: admin.email ?? "admin",
        },
      });
    })
  );

  // Bust the cache so changes propagate immediately
  revalidatePath("/", "layout");

  return NextResponse.json({ updated: results.length, pricing: results });
}

function formatDisplay(key: string, value: number): string {
  if (key.startsWith("CUT_")) return `${value}%`;
  if (key.startsWith("PLAN_") || key.startsWith("STUDIO_")) return `$${value}/mo`;
  return `$${value % 1 === 0 ? value : value.toFixed(2)}`;
}
