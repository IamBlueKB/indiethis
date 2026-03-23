import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD  = "#D4A843";
const BG    = "#0A0A0A";
const CARD  = "#141414";
const BORDER = "#2a2a2a";
const TEXT  = "#F5F5F5";
const MUTED = "#888888";
const GREEN = "#34C759";

const styles = StyleSheet.create({
  page: {
    fontFamily:      "Helvetica",
    fontSize:        10,
    backgroundColor: BG,
    color:           TEXT,
    paddingTop:      48,
    paddingBottom:   48,
    paddingLeft:     52,
    paddingRight:    52,
  },

  // ── Header ──
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    marginBottom:    28,
    paddingBottom:   20,
    borderBottom:    `2px solid ${GOLD}`,
  },
  brand: {
    fontSize:    20,
    fontFamily:  "Helvetica-Bold",
    color:       GOLD,
    letterSpacing: 3,
  },
  brandSub: {
    fontSize:  8,
    color:     MUTED,
    marginTop: 2,
    letterSpacing: 1,
  },
  docTitle: {
    fontSize:    14,
    fontFamily:  "Helvetica-Bold",
    color:       TEXT,
    textAlign:   "right",
  },
  docRef: {
    fontSize:  9,
    color:     MUTED,
    marginTop: 3,
    textAlign: "right",
  },

  // ── Status banner ──
  statusBanner: {
    backgroundColor: "#1a2a1a",
    borderRadius:    4,
    padding:         10,
    marginBottom:    20,
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    border:          `1px solid #2a4a2a`,
  },
  statusDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: GREEN,
  },
  statusText: {
    fontSize:  9,
    color:     GREEN,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  statusSub: {
    fontSize: 9,
    color:    MUTED,
    marginLeft: "auto",
  },

  // ── Section ──
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize:      8,
    fontFamily:    "Helvetica-Bold",
    color:         GOLD,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom:  10,
  },

  // ── Track info row ──
  infoRow: {
    flexDirection: "row",
    marginBottom:  5,
  },
  infoLabel: {
    width:      110,
    fontSize:   9,
    color:      MUTED,
    fontFamily: "Helvetica-Bold",
  },
  infoValue: {
    flex:     1,
    fontSize: 9,
    color:    TEXT,
  },

  // ── Contributor card ──
  contributorCard: {
    backgroundColor: CARD,
    borderRadius:    4,
    padding:         12,
    marginBottom:    8,
    border:          `1px solid ${BORDER}`,
  },
  contributorHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   8,
    paddingBottom:  8,
    borderBottom:   `1px solid ${BORDER}`,
  },
  contributorName: {
    fontSize:   11,
    fontFamily: "Helvetica-Bold",
    color:      TEXT,
  },
  contributorEmail: {
    fontSize:  8,
    color:     MUTED,
    marginTop: 1,
  },
  percentageBadge: {
    fontSize:        14,
    fontFamily:      "Helvetica-Bold",
    color:           GOLD,
  },
  roleTag: {
    fontSize:        7,
    fontFamily:      "Helvetica-Bold",
    color:           GOLD,
    textTransform:   "uppercase",
    letterSpacing:   0.8,
    marginTop:       2,
    textAlign:       "right",
  },
  signatureRow: {
    flexDirection: "row",
    gap:           12,
    marginTop:     2,
  },
  sigField: {
    flex:       1,
    backgroundColor: "#0f0f0f",
    borderRadius: 3,
    padding:    7,
    border:     `1px solid ${BORDER}`,
  },
  sigLabel: {
    fontSize:  7,
    color:     MUTED,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  sigValue: {
    fontSize: 8,
    color:    TEXT,
  },
  sigMono: {
    fontSize:   7,
    color:      MUTED,
    fontFamily: "Helvetica",
    marginTop:  2,
  },
  agreedBadge: {
    backgroundColor: "#1a2a1a",
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   2,
    alignSelf:       "flex-start",
    marginTop:       6,
  },
  agreedText: {
    fontSize:   7,
    color:      GREEN,
    fontFamily: "Helvetica-Bold",
  },

  // ── Footer ──
  footer: {
    marginTop:   28,
    paddingTop:  14,
    borderTop:   `1px solid ${BORDER}`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems:  "flex-end",
  },
  footerLeft: {
    flex: 1,
  },
  footerText: {
    fontSize:    8,
    color:       MUTED,
    lineHeight:  1.5,
    maxWidth:    380,
  },
  footerBrand: {
    fontSize:    8,
    color:       GOLD,
    fontFamily:  "Helvetica-Bold",
    textAlign:   "right",
  },
  footerUrl: {
    fontSize:    7,
    color:       MUTED,
    textAlign:   "right",
    marginTop:   2,
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type SplitSheetPDFProps = {
  sheet: {
    id:        string;
    createdAt: Date | string;
    track: { title: string };
    createdBy: { name: string | null; email: string; artistName?: string | null };
    splits: Array<{
      name:           string;
      email:          string;
      role:           string;
      percentage:     number;
      agreedAt:       Date | string | null;
      ipHash:         string | null;
    }>;
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }) + " UTC";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SplitSheetPDF({ sheet }: SplitSheetPDFProps) {
  const refNum = sheet.id.slice(-10).toUpperCase();
  const allAgreed = sheet.splits.every((s) => !!s.agreedAt);
  const activatedAt = allAgreed
    ? sheet.splits.reduce<Date | null>((latest, s) => {
        if (!s.agreedAt) return latest;
        const d = new Date(s.agreedAt);
        return !latest || d > latest ? d : latest;
      }, null)
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>INDIETHIS</Text>
            <Text style={styles.brandSub}>MUSIC PLATFORM</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Split Sheet Agreement</Text>
            <Text style={styles.docRef}>Ref #{refNum} · {fmtDate(sheet.createdAt)}</Text>
          </View>
        </View>

        {/* ── Status banner ── */}
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>ACTIVE — ALL PARTIES AGREED</Text>
          {activatedAt && (
            <Text style={styles.statusSub}>Activated {fmtDateTime(activatedAt)}</Text>
          )}
        </View>

        {/* ── Track info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Track Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Track Title</Text>
            <Text style={styles.infoValue}>{sheet.track.title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created By</Text>
            <Text style={styles.infoValue}>
              {sheet.createdBy.artistName ?? sheet.createdBy.name ?? "—"} ({sheet.createdBy.email})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Agreement Date</Text>
            <Text style={styles.infoValue}>{fmtDate(sheet.createdAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contributors</Text>
            <Text style={styles.infoValue}>{sheet.splits.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Allocation</Text>
            <Text style={[styles.infoValue, { color: GOLD, fontFamily: "Helvetica-Bold" }]}>
              {sheet.splits.reduce((s, c) => s + c.percentage, 0).toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* ── Contributors ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contributors &amp; Digital Signatures</Text>
          {sheet.splits.map((s, i) => (
            <View key={i} style={styles.contributorCard}>
              {/* Name + percentage */}
              <View style={styles.contributorHeader}>
                <View>
                  <Text style={styles.contributorName}>{s.name}</Text>
                  <Text style={styles.contributorEmail}>{s.email}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.percentageBadge}>{s.percentage.toFixed(1)}%</Text>
                  <Text style={styles.roleTag}>{s.role.replace(/_/g, " ")}</Text>
                </View>
              </View>

              {/* Signature fields */}
              <View style={styles.signatureRow}>
                <View style={styles.sigField}>
                  <Text style={styles.sigLabel}>Digital Signature</Text>
                  <Text style={styles.sigValue}>{s.name}</Text>
                  <Text style={styles.sigMono}>Agreed via IndieThis platform</Text>
                </View>
                <View style={styles.sigField}>
                  <Text style={styles.sigLabel}>Timestamp</Text>
                  <Text style={styles.sigValue}>{fmtDateTime(s.agreedAt)}</Text>
                </View>
                {s.ipHash && (
                  <View style={styles.sigField}>
                    <Text style={styles.sigLabel}>IP Hash</Text>
                    <Text style={styles.sigMono}>{s.ipHash}</Text>
                  </View>
                )}
              </View>

              {s.agreedAt && (
                <View style={styles.agreedBadge}>
                  <Text style={styles.agreedText}>✓ AGREED</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerText}>
              This document was automatically generated by the IndieThis platform upon unanimous agreement
              by all listed contributors. Each party&apos;s digital signature — consisting of their name,
              agreement timestamp, and hashed IP address — constitutes their binding acceptance of the
              royalty split terms described herein. This agreement is legally binding under applicable
              copyright and contract law.
            </Text>
          </View>
          <View>
            <Text style={styles.footerBrand}>INDIETHIS</Text>
            <Text style={styles.footerUrl}>indiethis.com</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
