/**
 * src/lib/generate-split-sheet-pdf.ts
 * Generates a professional, white-background split sheet PDF using @react-pdf/renderer.
 * This is a STANDALONE generator (no SplitSheet DB record required).
 * Used by POST /api/ai-tools/split-sheet.
 */

import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReactElement, JSXElementConstructor } from "react";

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface SplitContributor {
  name:               string;
  role:               string;
  publishingPercent:  number;
  masterPercent:      number;
  pro:                string;
  ipi:                string;
  email:              string;
}

export interface SplitSheetInput {
  trackTitle:     string;
  recordingDate:  string;
  contributors:   SplitContributor[];
  sampleUsed:     boolean;
  sampleDetails:  string;
  notes:          string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily:    "Helvetica",
    fontSize:      10,
    color:         "#111111",
    backgroundColor: "#FFFFFF",
    paddingTop:    48,
    paddingBottom: 48,
    paddingLeft:   52,
    paddingRight:  52,
  },

  // Header
  header: {
    borderBottom:  "2px solid #111111",
    marginBottom:  20,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems:    "flex-end",
  },
  headerLeft: { flexDirection: "column" },
  title: {
    fontSize:    18,
    fontFamily:  "Helvetica-Bold",
    letterSpacing: 2,
    color:       "#111111",
  },
  subtitle: {
    fontSize:  9,
    color:     "#666666",
    marginTop: 3,
    letterSpacing: 0.5,
  },
  docId: {
    fontSize: 8,
    color:    "#999999",
    textAlign: "right",
  },

  // Section heading
  sectionHeading: {
    fontSize:    8,
    fontFamily:  "Helvetica-Bold",
    letterSpacing: 1.5,
    color:       "#555555",
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop:   18,
  },

  // Track info block
  infoGrid: {
    flexDirection: "row",
    gap: 24,
    backgroundColor: "#F7F7F7",
    borderRadius: 4,
    padding: 10,
  },
  infoCell: { flex: 1 },
  infoLabel: { fontSize: 7, color: "#888888", letterSpacing: 0.8, marginBottom: 3 },
  infoValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111111" },

  // Table
  table: { width: "100%", marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#111111",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottom: "1px solid #EEEEEE",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottom: "1px solid #EEEEEE",
    backgroundColor: "#FAFAFA",
  },
  colName:     { width: "22%", fontSize: 9 },
  colRole:     { width: "16%", fontSize: 9 },
  colPub:      { width: "14%", fontSize: 9, textAlign: "center" },
  colMaster:   { width: "14%", fontSize: 9, textAlign: "center" },
  colPro:      { width: "12%", fontSize: 9 },
  colIpi:      { width: "12%", fontSize: 9 },
  colEmail:    { width: "10%", fontSize: 9 },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#FFFFFF", letterSpacing: 0.5 },
  tdText: { color: "#111111" },
  tdMuted: { color: "#888888" },

  // Totals row
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "#F0F0F0",
    borderTop: "1px solid #CCCCCC",
  },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#333333" },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "center" },

  // Legal block
  legalBox: {
    backgroundColor: "#F7F7F7",
    border: "1px solid #DDDDDD",
    borderRadius: 4,
    padding: 12,
    marginTop: 4,
  },
  legalText: {
    fontSize: 8.5,
    color: "#333333",
    lineHeight: 1.6,
    marginBottom: 5,
  },

  // Sample declaration
  sampleBox: {
    backgroundColor: "#FFFBF0",
    border: "1px solid #E8D5A0",
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
  },
  sampleLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#8B6914", marginBottom: 4 },
  sampleText:  { fontSize: 8.5, color: "#5C4A1A", lineHeight: 1.5 },

  // Signature block
  sigGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 6,
  },
  sigCard: {
    width: "47%",
    border: "1px solid #CCCCCC",
    borderRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  sigName:  { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#111111", marginBottom: 2 },
  sigRole:  { fontSize: 8, color: "#666666", marginBottom: 8 },
  sigLine:  { borderBottom: "1px solid #BBBBBB", marginBottom: 3 },
  sigMeta:  { fontSize: 7, color: "#999999" },

  // Footer
  footer: {
    position:   "absolute",
    bottom:     28,
    left:       52,
    right:      52,
    borderTop:  "1px solid #DDDDDD",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, color: "#999999" },
});

// ─── PDF Component ────────────────────────────────────────────────────────────

function SplitSheetDocument({ input, docId, generatedDate }: {
  input: SplitSheetInput;
  docId: string;
  generatedDate: string;
}) {
  const pubTotal    = input.contributors.reduce((s, c) => s + c.publishingPercent, 0);
  const masterTotal = input.contributors.reduce((s, c) => s + c.masterPercent,    0);

  return createElement(Document, { title: `Split Sheet — ${input.trackTitle}` },
    createElement(Page, { size: "LETTER", style: s.page },

      // ── Header ──────────────────────────────────────────────────────────
      createElement(View, { style: s.header },
        createElement(View, { style: s.headerLeft },
          createElement(Text, { style: s.title }, "SPLIT SHEET AGREEMENT"),
          createElement(Text, { style: s.subtitle }, "IndieThis — Music Ownership & Rights Document"),
        ),
        createElement(View, null,
          createElement(Text, { style: s.docId }, `Doc ID: ${docId}`),
          createElement(Text, { style: { ...s.docId, marginTop: 2 } }, `Generated: ${generatedDate}`),
        ),
      ),

      // ── Track Info ───────────────────────────────────────────────────────
      createElement(Text, { style: s.sectionHeading }, "Track Information"),
      createElement(View, { style: s.infoGrid },
        createElement(View, { style: s.infoCell },
          createElement(Text, { style: s.infoLabel }, "TRACK TITLE"),
          createElement(Text, { style: s.infoValue }, input.trackTitle),
        ),
        createElement(View, { style: s.infoCell },
          createElement(Text, { style: s.infoLabel }, "RECORDING DATE"),
          createElement(Text, { style: s.infoValue }, input.recordingDate || "—"),
        ),
        createElement(View, { style: s.infoCell },
          createElement(Text, { style: s.infoLabel }, "TOTAL CONTRIBUTORS"),
          createElement(Text, { style: s.infoValue }, String(input.contributors.length)),
        ),
      ),

      // ── Contributors Table ────────────────────────────────────────────────
      createElement(Text, { style: s.sectionHeading }, "Ownership Breakdown"),
      createElement(View, { style: s.table },
        // Header row
        createElement(View, { style: s.tableHeader },
          createElement(Text, { style: { ...s.colName,  ...s.thText } }, "NAME"),
          createElement(Text, { style: { ...s.colRole,  ...s.thText } }, "ROLE"),
          createElement(Text, { style: { ...s.colPub,   ...s.thText } }, "PUB %"),
          createElement(Text, { style: { ...s.colMaster,...s.thText } }, "MASTER %"),
          createElement(Text, { style: { ...s.colPro,   ...s.thText } }, "PRO"),
          createElement(Text, { style: { ...s.colIpi,   ...s.thText } }, "IPI/CAE"),
          createElement(Text, { style: { ...s.colEmail, ...s.thText } }, "EMAIL"),
        ),
        // Data rows
        ...input.contributors.map((c, i) =>
          createElement(View, { key: i, style: i % 2 === 0 ? s.tableRow : s.tableRowAlt },
            createElement(Text, { style: { ...s.colName,   ...s.tdText } }, c.name),
            createElement(Text, { style: { ...s.colRole,   ...s.tdText } }, c.role),
            createElement(Text, { style: { ...s.colPub,    ...s.tdText } }, `${c.publishingPercent}%`),
            createElement(Text, { style: { ...s.colMaster, ...s.tdText } }, `${c.masterPercent}%`),
            createElement(Text, { style: { ...s.colPro,    ...s.tdText } }, c.pro || "—"),
            createElement(Text, { style: { ...s.colIpi,   ...s.tdMuted } }, c.ipi || "—"),
            createElement(Text, { style: { ...s.colEmail, ...s.tdMuted } }, c.email),
          )
        ),
        // Totals row
        createElement(View, { style: s.totalsRow },
          createElement(Text, { style: { ...s.colName, ...s.totalLabel } }, "TOTALS"),
          createElement(Text, { style: { ...s.colRole } }, ""),
          createElement(Text, { style: { ...s.colPub,    ...s.totalValue,
            color: pubTotal === 100 ? "#1a7a1a" : "#cc0000" } },
            `${pubTotal}%`),
          createElement(Text, { style: { ...s.colMaster, ...s.totalValue,
            color: masterTotal === 100 ? "#1a7a1a" : "#cc0000" } },
            `${masterTotal}%`),
          createElement(Text, { style: { ...s.colPro } }, ""),
          createElement(Text, { style: { ...s.colIpi } }, ""),
          createElement(Text, { style: { ...s.colEmail } }, ""),
        ),
      ),

      // ── Sample Declaration ────────────────────────────────────────────────
      createElement(Text, { style: s.sectionHeading }, "Sample Declaration"),
      createElement(View, { style: s.sampleBox },
        createElement(Text, { style: s.sampleLabel },
          input.sampleUsed ? "⚠  SAMPLES USED IN THIS RECORDING" : "✓  NO SAMPLES USED IN THIS RECORDING"
        ),
        createElement(Text, { style: s.sampleText },
          input.sampleUsed
            ? (input.sampleDetails || "Sample details not provided. Each party is responsible for obtaining necessary clearances.")
            : "All parties confirm this recording does not contain any interpolations, direct samples, loops, or other copyrighted material requiring clearance."
        ),
      ),

      // ── Legal Language ────────────────────────────────────────────────────
      createElement(Text, { style: s.sectionHeading }, "Agreement Terms"),
      createElement(View, { style: s.legalBox },
        ...[
          "This Split Sheet Agreement confirms the ownership percentages of the above-referenced recording as agreed upon by all contributing parties.",
          "Each party agrees to register their respective publishing shares with their designated Performing Rights Organization (PRO) and to keep their registration current.",
          "All parties acknowledge that the percentages listed herein are final and binding upon execution of this document by all contributing parties.",
          "This agreement covers both the publishing (composition) rights and master recording rights as indicated by the respective percentage columns.",
          "Any disputes arising from this agreement shall first be attempted to be resolved through mutual discussion and mediation before pursuing legal action.",
          "This agreement may be amended only by written consent of all parties. Any amendment must be documented in a new or revised Split Sheet.",
          "Each party warrants that they have the legal right to enter into this agreement and that their contribution to the recording is original.",
          ...(input.notes ? [`Additional Terms: ${input.notes}`] : []),
        ].map((text, i) =>
          createElement(Text, { key: i, style: s.legalText }, `${i + 1}.  ${text}`)
        ),
      ),

      // ── Signature Lines ───────────────────────────────────────────────────
      createElement(Text, { style: s.sectionHeading }, "Signatures"),
      createElement(View, { style: s.sigGrid },
        ...input.contributors.map((c, i) =>
          createElement(View, { key: i, style: s.sigCard },
            createElement(Text, { style: s.sigName }, c.name),
            createElement(Text, { style: s.sigRole }, `${c.role}  ·  Publishing: ${c.publishingPercent}%  ·  Master: ${c.masterPercent}%`),
            createElement(View, { style: { marginTop: 24 } },
              createElement(View, { style: s.sigLine }),
              createElement(Text, { style: s.sigMeta }, "Signature"),
            ),
            createElement(View, { style: { marginTop: 10 } },
              createElement(View, { style: s.sigLine }),
              createElement(Text, { style: s.sigMeta }, "Date"),
            ),
          )
        ),
      ),

      // ── Footer ────────────────────────────────────────────────────────────
      createElement(View, { style: s.footer, fixed: true },
        createElement(Text, { style: s.footerText },
          `Split Sheet — "${input.trackTitle}"  ·  Document ID: ${docId}`),
        createElement(Text, { style: s.footerText },
          `Generated ${generatedDate} via IndieThis  ·  indiethis.com`),
      ),
    )
  );
}

// ─── Exported function ────────────────────────────────────────────────────────

export async function generateSplitSheetPDF(input: SplitSheetInput): Promise<Buffer> {
  const docId        = `SS-${Date.now().toString(36).toUpperCase()}`;
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  const element = createElement(SplitSheetDocument, { input, docId, generatedDate }) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>;
  const buffer  = await renderToBuffer(element);
  return Buffer.from(buffer);
}
