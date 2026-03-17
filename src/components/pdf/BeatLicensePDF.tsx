import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: 48,
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 32,
    borderBottom: "2px solid #111111",
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#555555",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#333333",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 140,
    fontFamily: "Helvetica-Bold",
    color: "#444444",
  },
  value: {
    flex: 1,
  },
  terms: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 4,
    fontSize: 10,
    color: "#333333",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 40,
    borderTop: "1px solid #cccccc",
    paddingTop: 16,
    fontSize: 9,
    color: "#888888",
  },
  signatureBlock: {
    flexDirection: "row",
    gap: 40,
    marginTop: 32,
  },
  signatureLine: {
    flex: 1,
    borderTop: "1px solid #333333",
    paddingTop: 6,
    fontSize: 10,
    color: "#555555",
  },
});

type LicenseProps = {
  license: {
    id: string;
    licenseType: string;
    customTerms: string | null;
    price: number;
    status: string;
    createdAt: Date | string;
    track: { title: string };
    producer: { name: string; artistName: string | null; email: string };
    artist: { name: string; artistName: string | null; email: string };
  };
};

const LICENSE_DESCRIPTIONS: Record<string, string> = {
  EXCLUSIVE:
    "Exclusive license — the artist receives exclusive rights to use this beat. The producer may not license this beat to any other party after execution of this agreement.",
  NON_EXCLUSIVE:
    "Non-exclusive license — the artist receives the right to use this beat non-exclusively. The producer retains the right to license this beat to other artists.",
  LEASE:
    "Lease agreement — the artist receives limited-use rights to this beat for the specified term. Usage is subject to the platform streaming and distribution limitations.",
  CUSTOM: "Custom terms — see the custom terms section below for full details of this agreement.",
};

export default function BeatLicensePDF({ license }: LicenseProps) {
  const date = new Date(license.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Beat License Agreement</Text>
          <Text style={styles.subtitle}>IndieThis Platform · Agreement #{license.id.slice(-8).toUpperCase()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agreement Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{date}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>License Type</Text>
            <Text style={styles.value}>{license.licenseType.replace(/_/g, " ")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Beat / Track</Text>
            <Text style={styles.value}>{license.track.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>License Fee</Text>
            <Text style={styles.value}>${license.price.toFixed(2)} USD</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{license.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parties</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Producer (Licensor)</Text>
            <Text style={styles.value}>
              {license.producer.artistName ?? license.producer.name} ({license.producer.email})
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Artist (Licensee)</Text>
            <Text style={styles.value}>
              {license.artist.artistName ?? license.artist.name} ({license.artist.email})
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>License Terms</Text>
          <Text style={styles.terms}>
            {LICENSE_DESCRIPTIONS[license.licenseType] ?? ""}
            {license.customTerms ? `\n\nCustom Terms:\n${license.customTerms}` : ""}
          </Text>
        </View>

        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text>Producer Signature</Text>
            <Text style={{ marginTop: 8, color: "#333333" }}>
              {license.producer.artistName ?? license.producer.name}
            </Text>
          </View>
          <View style={styles.signatureLine}>
            <Text>Artist Signature</Text>
            <Text style={{ marginTop: 8, color: "#333333" }}>
              {license.artist.artistName ?? license.artist.name}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>
            This agreement was generated via the IndieThis platform. Both parties acknowledge the terms
            above by executing a transaction through the platform. This document serves as a record of
            the agreed license terms.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
