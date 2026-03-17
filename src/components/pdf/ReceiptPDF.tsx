import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    padding: 48,
    backgroundColor: "#ffffff",
    color: "#111111",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 36,
    borderBottom: "2px solid #111111",
    paddingBottom: 20,
  },
  brand: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#7B61FF",
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 10,
    color: "#888888",
    marginTop: 3,
  },
  receiptLabel: {
    textAlign: "right",
  },
  receiptTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  receiptId: {
    fontSize: 10,
    color: "#888888",
    marginTop: 3,
  },
  receiptDate: {
    fontSize: 10,
    color: "#888888",
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#666666",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 140,
    color: "#555555",
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  divider: {
    borderTop: "1px solid #eeeeee",
    marginVertical: 16,
  },
  lineItemsTable: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: "6 8",
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottom: "1px solid #f0f0f0",
  },
  col_desc: { flex: 3 },
  col_num: { flex: 1, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 8,
  },
  totalLabel: {
    fontSize: 13,
    color: "#555555",
  },
  totalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    minWidth: 80,
    textAlign: "right",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    padding: "4 10",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 48,
    right: 48,
    borderTop: "1px solid #eeeeee",
    paddingTop: 12,
    fontSize: 9,
    color: "#aaaaaa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

type ReceiptPDFProps = {
  receipt: {
    id: string;
    type: string;
    description: string;
    amount: number;
    paymentMethod: string | null;
    stripePaymentId: string | null;
    createdAt: Date | string;
    user: { name: string; email: string };
  };
  studioName?: string;
  studioLogo?: string;
};

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION: "Subscription",
  AI_TOOL: "AI Tool Credits",
  MERCH_SALE: "Merchandise Sale",
  BEAT_PURCHASE: "Beat Purchase",
  SESSION_PAYMENT: "Studio Session",
};

export default function ReceiptPDF({ receipt, studioName }: ReceiptPDFProps) {
  const date = new Date(receipt.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const brandName = studioName ?? "IndieThis";
  const shortId = receipt.id.slice(-10).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{brandName}</Text>
            <Text style={styles.brandSub}>
              {studioName ? "Studio Receipt" : "IndieThis Platform Receipt"}
            </Text>
          </View>
          <View style={styles.receiptLabel}>
            <Text style={styles.receiptTitle}>RECEIPT</Text>
            <Text style={styles.receiptId}>#{shortId}</Text>
            <Text style={styles.receiptDate}>{date}</Text>
          </View>
        </View>

        {/* Billed To */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billed To</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
            {receipt.user.name}
          </Text>
          <Text style={{ color: "#555555" }}>{receipt.user.email}</Text>
        </View>

        <View style={styles.divider} />

        {/* Line Items */}
        <View style={styles.lineItemsTable}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col_desc]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.col_num]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.col_desc}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {TYPE_LABELS[receipt.type] ?? receipt.type}
              </Text>
              <Text style={{ fontSize: 10, color: "#666666", marginTop: 2 }}>
                {receipt.description}
              </Text>
            </View>
            <Text style={[styles.col_num, { fontFamily: "Helvetica-Bold" }]}>
              ${receipt.amount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Total */}
        <View style={{ borderTop: "2px solid #111111", paddingTop: 10 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>${receipt.amount.toFixed(2)} USD</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={{ marginTop: 20 }}>
          <Text style={styles.badge}>PAID</Text>
          {receipt.paymentMethod && (
            <View style={[styles.row, { marginTop: 12 }]}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>{receipt.paymentMethod}</Text>
            </View>
          )}
          {receipt.stripePaymentId && (
            <View style={styles.row}>
              <Text style={styles.label}>Transaction ID</Text>
              <Text style={[styles.value, { fontSize: 10 }]}>{receipt.stripePaymentId}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your payment.</Text>
          <Text>{brandName} · indiethis.com</Text>
        </View>
      </Page>
    </Document>
  );
}
