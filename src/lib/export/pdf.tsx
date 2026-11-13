import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { escapeCell, type ExportColumn, type ExportRow } from "./escape";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1f2933" },
  title: { fontSize: 15, color: "#167c50", marginBottom: 2 },
  sub: { fontSize: 9, color: "#5b6770", marginBottom: 10 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dfe4e1" },
  head: { flexDirection: "row", backgroundColor: "#e6f3ec", borderBottomWidth: 1, borderBottomColor: "#167c50" },
  cell: { flex: 1, padding: 3 },
  foot: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 8, color: "#5b6770" },
});

const MAX_PDF_ROWS = 2000;

export async function toPdf(
  title: string,
  columns: readonly ExportColumn[],
  rows: readonly ExportRow[],
  opts: { subtitle?: string } = {},
): Promise<Buffer> {
  const shown = rows.slice(0, MAX_PDF_ROWS);
  const doc = (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {opts.subtitle ? `${opts.subtitle} · ` : ""}
          {rows.length} row{rows.length === 1 ? "" : "s"}
          {rows.length > shown.length ? ` (first ${shown.length} shown; use CSV or XLSX for the full set)` : ""}
        </Text>
        <View style={styles.head} fixed>
          {columns.map((c) => (
            <Text key={c.key} style={styles.cell}>
              {c.label}
            </Text>
          ))}
        </View>
        {shown.map((r, i) => (
          <View key={i} style={styles.row} wrap={false}>
            {columns.map((c) => (
              <Text key={c.key} style={styles.cell}>
                {escapeCell(r[c.key])}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.foot} fixed render={({ pageNumber, totalPages }) => `Automora · page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
