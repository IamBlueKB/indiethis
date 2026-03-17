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
  invoiceLabel: {
    textAlign: "right",
  },
  invoiceTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  invoiceNumber: {
    fontSize: 10,
    color: "#888888",
    marginTop: 3,
  },
  statusBadge: {
    alignSelf: "flex-end",
    padding: "3 8",
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
  },
  twoCol: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 28,
  },
  col: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#666666",
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 11,
    lineHeight: 1.5,
  },
  mutedText: {
    fontSize: 10,
    color: "#666666",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: "7 8",
    borderRadius: 4,
    marginBottom: 2,
  },
  thText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#555555",
  },
  tableRow: {
    flexDirection: "row",
    padding: "6 8",
    borderBottom: "1px solid #f0f0f0",
  },
  col_desc: { flex: 4 },
  col_qty: { flex: 1, textAlign: "right" },
  col_rate: { flex: 1.5, textAlign: "right" },
  col_total: { flex: 1.5, textAlign: "right" },
  totalsBlock: {
    marginTop: 16,
    marginLeft: "auto",
    minWidth: 200,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: {
    color: "#555555",
  },
  totalsValue: {
    fontFamily: "Helvetica-Bold",
    minWidth: 80,
    textAlign: "right",
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "2px solid #111111",
    paddingTop: 8,
    marginTop: 4,
  },
  grandLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  grandValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    minWidth: 80,
    textAlign: "right",
  },
  notesBox: {
    marginTop: 24,
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 4,
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

type LineItem = {
  description: string;
  quantity: number;
  rate: number;
  total: number;
};

type InvoicePDFProps = {
  invoice: {
    id: string;
    invoiceNumber: number;
    lineItems: LineItem[];
    subtotal: number;
    tax: number;
    taxRate: number;
    total: number;
    dueDate: Date | string;
    status: string;
    notes: string | null;
    createdAt: Date | string;
    studio: { name: string; email: string | null; phone: string | null };
    contact: { name: string; email: string | null; phone: string | null };
  };
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: "#f0f0f0", color: "#555555" },
  SENT:     { bg: "#dbeafe", color: "#1d4ed8" },
  VIEWED:   { bg: "#ede9fe", color: "#6d28d9" },
  PAID:     { bg: "#d1fae5", color: "#065f46" },
  OVERDUE:  { bg: "#fee2e2", color: "#991b1b" },
};

export default function InvoicePDF({ invoice }: InvoicePDFProps) {
  const issueDate = new Date(invoice.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const statusStyle = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.DRAFT;
  const lineItems: LineItem[] = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{invoice.studio.name}</Text>
            <Text style={styles.brandSub}>Studio Invoice · IndieThis</Text>
          </View>
          <View style={styles.invoiceLabel}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>
              #{String(invoice.invoiceNumber).padStart(4, "0")}
            </Text>
            <Text style={[styles.statusBadge, { backgroundColor: statusStyle.bg, color: statusStyle.color }]}>
              {invoice.status}
            </Text>
          </View>
        </View>

        {/* From / To */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>From</Text>
            <Text style={[styles.bodyText, { fontFamily: "Helvetica-Bold" }]}>
              {invoice.studio.name}
            </Text>
            {invoice.studio.email && (
              <Text style={styles.mutedText}>{invoice.studio.email}</Text>
            )}
            {invoice.studio.phone && (
              <Text style={styles.mutedText}>{invoice.studio.phone}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={[styles.bodyText, { fontFamily: "Helvetica-Bold" }]}>
              {invoice.contact.name}
            </Text>
            {invoice.contact.email && (
              <Text style={styles.mutedText}>{invoice.contact.email}</Text>
            )}
            {invoice.contact.phone && (
              <Text style={styles.mutedText}>{invoice.contact.phone}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Dates</Text>
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.mutedText}>Issued</Text>
              <Text style={styles.bodyText}>{issueDate}</Text>
            </View>
            <View>
              <Text style={styles.mutedText}>Due</Text>
              <Text style={[styles.bodyText, { fontFamily: "Helvetica-Bold" }]}>{dueDate}</Text>
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.col_desc]}>Description</Text>
          <Text style={[styles.thText, styles.col_qty]}>Qty</Text>
          <Text style={[styles.thText, styles.col_rate]}>Rate</Text>
          <Text style={[styles.thText, styles.col_total]}>Total</Text>
        </View>

        {lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col_desc}>{item.description}</Text>
            <Text style={styles.col_qty}>{item.quantity}</Text>
            <Text style={styles.col_rate}>${item.rate.toFixed(2)}</Text>
            <Text style={[styles.col_total, { fontFamily: "Helvetica-Bold" }]}>
              ${item.total.toFixed(2)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>${invoice.subtotal.toFixed(2)}</Text>
          </View>
          {invoice.tax > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Tax ({invoice.taxRate}%)
              </Text>
              <Text style={styles.totalsValue}>${invoice.tax.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>Total Due</Text>
            <Text style={styles.grandValue}>${invoice.total.toFixed(2)} USD</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 10, color: "#444444", lineHeight: 1.5 }}>
              {invoice.notes}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Invoice #{String(invoice.invoiceNumber).padStart(4, "0")} · {invoice.studio.name}</Text>
          <Text>IndieThis Platform · indiethis.com</Text>
        </View>
      </Page>
    </Document>
  );
}
