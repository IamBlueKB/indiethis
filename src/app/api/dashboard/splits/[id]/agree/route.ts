import { NextRequest, NextResponse } from "next/server";
import { createHash }   from "crypto";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";
import { UTApi }        from "uploadthing/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createNotification }          from "@/lib/notifications";
import {
  sendSplitSheetAgreedEmail,
  sendSplitSheetActiveEmail,
  sendSplitSheetDocumentEmail,
} from "@/lib/brevo/email";
import SplitSheetPDF from "@/components/pdf/SplitSheetPDF";

/**
 * POST /api/dashboard/splits/[id]/agree
 * Authenticated user agrees to their split on this sheet.
 * When the last party agrees:
 *  1. Generate the split sheet PDF
 *  2. Upload to UploadThing
 *  3. Save documentUrl on the SplitSheet
 *  4. Create a LicenseDocument in each IndieThis user's vault
 *  5. Email the PDF to contributors without an IndieThis account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  // Capture + hash the requester's IP for the digital signature record
  const rawIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = createHash("sha256").update(rawIp).digest("hex").slice(0, 16);

  const sheet = await db.splitSheet.findFirst({
    where: { id, status: "PENDING" },
    include: {
      splits: true,
      track: { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true, email: true, artistName: true } },
    },
  });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mySplit = sheet.splits.find((s) => s.userId === userId);
  if (!mySplit)        return NextResponse.json({ error: "You are not a participant" }, { status: 403 });
  if (mySplit.agreedAt) return NextResponse.json({ error: "Already agreed" }, { status: 409 });

  // Record agreement + IP hash
  await db.split.update({
    where: { id: mySplit.id },
    data:  { agreedAt: new Date(), ipHash },
  });

  // Re-fetch all splits to check completion
  const allSplits = await db.split.findMany({ where: { splitSheetId: id } });
  const allAgreed = allSplits.every((s) =>
    s.userId === userId ? true : !!s.agreedAt
  );

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { name: true, email: true },
  });

  if (allAgreed) {
    // ── Mark sheet ACTIVE ──────────────────────────────────────────────────
    await db.splitSheet.update({ where: { id }, data: { status: "ACTIVE" } });

    // ── Notify all participants (in-app + active email) ────────────────────
    for (const split of allSplits) {
      if (split.userId) {
        void createNotification({
          userId:  split.userId,
          type:    "SPLIT_SHEET_ACTIVE",
          title:   `Split sheet for "${sheet.track.title}" is now active`,
          message: "All contributors agreed. Earnings will be distributed automatically.",
          link:    `/dashboard/splits/${id}`,
        }).catch(console.error);
      }
      void sendSplitSheetActiveEmail({
        recipientEmail: split.email,
        recipientName:  split.name,
        trackTitle:     sheet.track.title,
        percentage:     split.percentage,
        role:           split.role,
        dashboardUrl:   `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/dashboard/splits/${id}`,
      }).catch(console.error);
    }

    // ── Generate PDF (fire-and-forget so response isn't blocked) ──────────
    void (async () => {
      try {
        // Re-fetch with fresh ipHash values (the current user's ipHash just saved)
        const freshSplits = await db.split.findMany({ where: { splitSheetId: id } });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(
          createElement(SplitSheetPDF as React.ComponentType<any>, {
            sheet: {
              id:        sheet.id,
              createdAt: sheet.createdAt,
              track:     sheet.track,
              createdBy: sheet.createdBy,
              splits:    freshSplits.map((s) => ({
                name:       s.name,
                email:      s.email,
                role:       s.role,
                percentage: s.percentage,
                agreedAt:   s.userId === userId ? new Date() : s.agreedAt,
                ipHash:     s.userId === userId ? ipHash : s.ipHash,
              })),
            },
          })
        );

        // Upload to UploadThing
        const utapi  = new UTApi();
        const file   = new File([new Uint8Array(pdfBuffer)], `split-sheet-${id}.pdf`, { type: "application/pdf" });
        const upload = await utapi.uploadFiles(file);
        const docUrl = upload.data?.ufsUrl ?? upload.data?.url;

        if (!docUrl) throw new Error("UploadThing upload failed");

        // Save documentUrl on the SplitSheet
        await db.splitSheet.update({
          where: { id },
          data:  { documentUrl: docUrl },
        });

        const pdfB64 = pdfBuffer.toString("base64");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

        // For each contributor: vault entry (IndieThis users) or email (external)
        for (const split of freshSplits) {
          if (split.userId) {
            void db.licenseDocument.create({
              data: {
                userId:   split.userId,
                title:    `Split Sheet — ${sheet.track.title}`,
                fileUrl:  docUrl,
                fileType: "pdf",
                source:   "CUSTOM",
                trackId:  sheet.track.id,
                notes:    `Royalty split agreement. Your share: ${split.percentage.toFixed(1)}% (${split.role}).`,
              },
            }).catch(console.error);
          } else {
            void sendSplitSheetDocumentEmail({
              recipientEmail: split.email,
              recipientName:  split.name,
              trackTitle:     sheet.track.title,
              percentage:     split.percentage,
              role:           split.role,
              pdfBase64:      pdfB64,
              dashboardUrl:   `${appUrl}/dashboard/splits/${id}`,
            }).catch(console.error);
          }
        }
      } catch (err) {
        console.error("[splits/agree] PDF generation failed:", err);
      }
    })();

  } else {
    // ── Notify creator that someone agreed ────────────────────────────────
    void createNotification({
      userId:  sheet.createdById,
      type:    "SPLIT_SHEET_AGREED",
      title:   `${user?.name ?? "A contributor"} agreed to the split`,
      message: `"${sheet.track.title}" — ${allSplits.filter((s) => s.agreedAt).length} of ${allSplits.length} agreed`,
      link:    `/dashboard/splits/${id}`,
    }).catch(console.error);

    if (sheet.createdBy.email) {
      void sendSplitSheetAgreedEmail({
        creatorEmail:    sheet.createdBy.email,
        creatorName:     sheet.createdBy.name ?? "Artist",
        contributorName: user?.name ?? "A contributor",
        trackTitle:      sheet.track.title,
        agreedCount:     allSplits.filter((s) => !!s.agreedAt || s.userId === userId).length,
        totalCount:      allSplits.length,
        dashboardUrl:    `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/dashboard/splits/${id}`,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, allAgreed });
}
