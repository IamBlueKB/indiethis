import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 48,
    backgroundColor: "#FFFFFF",
    color: "#111111",
  },
  header: {
    marginBottom: 32,
    borderBottom: "2 solid #D4A843",
    paddingBottom: 16,
  },
  logo: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#D4A843",
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: "#666666",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    marginBottom: 24,
  },
  table: {
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #EEEEEE",
    paddingVertical: 8,
  },
  label: {
    width: 160,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    flex: 1,
    fontSize: 11,
    color: "#111111",
  },
  divider: {
    borderTop: "1 solid #EEEEEE",
    marginVertical: 24,
  },
  notice: {
    backgroundColor: "#F9F6ED",
    borderLeft: "3 solid #D4A843",
    padding: 14,
    marginBottom: 24,
    borderRadius: 4,
  },
  noticeText: {
    fontSize: 10,
    color: "#444444",
    lineHeight: 1.6,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 16,
    borderTop: "1 solid #EEEEEE",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#999999",
  },
  badge: {
    backgroundColor: "#D4A843",
    color: "#111111",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});

export type AIReceiptData = {
  jobId: string;
  toolName: string;
  dateGenerated: string;   // ISO string
  subscriptionTier: string;
  artistName: string;
};

export default function AIReceiptPDF({ data }: { data: AIReceiptData }) {
  const date = new Date(data.dateGenerated);
  const formatted = date.toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <Document
      title={`IndieThis AI Receipt — ${data.toolName}`}
      author="IndieThis"
      subject="AI Generation Ownership Receipt"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>IndieThis</Text>
          <Text style={styles.subtitle}>AI Generation Ownership Receipt</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{data.toolName}</Text>

        {/* Details table */}
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.label}>Tool Used</Text>
            <Text style={styles.value}>{data.toolName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date Generated</Text>
            <Text style={styles.value}>{formatted}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Artist</Text>
            <Text style={styles.value}>{data.artistName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Subscription Tier</Text>
            <Text style={styles.value}>{data.subscriptionTier}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Job ID</Text>
            <Text style={styles.value}>{data.jobId}</Text>
          </View>
        </View>

        {/* Ownership notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            This content was generated using IndieThis AI tools. The user retains full ownership of this
            AI-generated content per the IndieThis Terms of Service. This receipt serves as proof of
            generation and may be used to demonstrate ownership of the AI-generated material.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>IndieThis · indiethis.com</Text>
            <Text style={styles.footerText}>This document is automatically generated and is binding under IndieThis Terms of Service.</Text>
          </View>
          <Text style={styles.badge}>VERIFIED</Text>
        </View>
      </Page>
    </Document>
  );
}
