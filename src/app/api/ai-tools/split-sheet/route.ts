/**
 * POST /api/ai-tools/split-sheet
 * Generates a professional split sheet PDF and saves it to the user's Vault.
 * Free for all tiers. Uses @react-pdf/renderer via generateSplitSheetPDF.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UTApi } from "uploadthing/server";
import { generateSplitSheetPDF, type SplitSheetInput } from "@/lib/generate-split-sheet-pdf";

export const maxDuration = 30;

const utapi = new UTApi();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Studios don't need split sheets
  if (session.user.role === "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Split sheets are for artists and producers." }, { status: 403 });
  }

  const userId = session.user.id;
  const body   = await req.json() as SplitSheetInput;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!body.trackTitle?.trim()) {
    return NextResponse.json({ error: "Track title is required." }, { status: 400 });
  }
  if (!body.contributors || body.contributors.length < 2) {
    return NextResponse.json({ error: "At least 2 contributors are required." }, { status: 400 });
  }
  if (body.contributors.length > 10) {
    return NextResponse.json({ error: "Maximum 10 contributors allowed." }, { status: 400 });
  }

  const pubTotal    = body.contributors.reduce((s, c) => s + (Number(c.publishingPercent) || 0), 0);
  const masterTotal = body.contributors.reduce((s, c) => s + (Number(c.masterPercent)    || 0), 0);

  if (Math.abs(pubTotal - 100) > 0.01) {
    return NextResponse.json({
      error: `Publishing percentages must total 100% (currently ${pubTotal}%).`,
    }, { status: 400 });
  }
  if (Math.abs(masterTotal - 100) > 0.01) {
    return NextResponse.json({
      error: `Master percentages must total 100% (currently ${masterTotal}%).`,
    }, { status: 400 });
  }

  // ── Generate PDF ──────────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateSplitSheetPDF(body);
  } catch (err) {
    return NextResponse.json(
      { error: "PDF generation failed.", detail: String(err) },
      { status: 500 }
    );
  }

  // ── Upload to UploadThing ─────────────────────────────────────────────────
  const safeTitle = body.trackTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 60);
  const dateStr   = new Date().toISOString().slice(0, 10);
  const fileName  = `Split Sheet - ${safeTitle} - ${dateStr}.pdf`;

  const file   = new File([pdfBuffer], fileName, { type: "application/pdf" });
  const upload = await utapi.uploadFiles(file);

  if (upload.error || !upload.data?.url) {
    return NextResponse.json(
      { error: "PDF upload failed.", detail: String(upload.error) },
      { status: 500 }
    );
  }

  const fileUrl = upload.data.url;

  // ── Save to Vault (LicenseDocument) ──────────────────────────────────────
  const vaultEntry = await db.licenseDocument.create({
    data: {
      userId,
      title:    fileName,
      fileUrl,
      fileType: "pdf",
      source:   "OTHER",
      notes:    `Split sheet for "${body.trackTitle}" — ${body.contributors.length} contributors`,
    },
  });

  return NextResponse.json({
    fileUrl,
    fileName,
    vaultId: vaultEntry.id,
    message: `Split sheet generated and saved to your Vault.`,
  });
}
