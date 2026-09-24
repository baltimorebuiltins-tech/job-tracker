import * as XLSX from "xlsx";
import pdfMake from "./pdfMakeSetup";

export type EstimateLineItem = {
  qty: string;
  descriptionLines: string[];
  price: number;
};

function findKey(row: Record<string, any>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const match = keys.find((k) => k.trim().toLowerCase() === c);
    if (match) return match;
  }
  for (const c of candidates) {
    const match = keys.find((k) => k.trim().toLowerCase().includes(c));
    if (match) return match;
  }
  return null;
}

export function parseEstimateWorkbook(data: ArrayBuffer): EstimateLineItem[] {
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((row) => {
      const qtyKey = findKey(row, ["qty", "quantity"]);
      const descKey = findKey(row, ["description", "desc", "item"]);
      const priceKey = findKey(row, [
        "price",
        "line total",
        "linetotal",
        "amount",
        "total",
        "cost",
      ]);

      const qty = qtyKey ? String(row[qtyKey]).trim() : "";
      const rawDesc = descKey ? String(row[descKey]) : "";
      const descriptionLines = rawDesc
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const priceRaw = priceKey ? row[priceKey] : 0;
      const price =
        typeof priceRaw === "number"
          ? priceRaw
          : parseFloat(String(priceRaw).replace(/[^0-9.-]/g, "")) || 0;

      return { qty: qty || "1", descriptionLines, price };
    })
    .filter((item) => item.descriptionLines.length > 0);
}

async function fetchLogoDataUrl(): Promise<string> {
  const res = await fetch("/logo.png");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const MAROON = "#8a1c1c";

export async function generateEstimatePdfBase64(opts: {
  customerName: string;
  estimateNumber: string;
  date: string;
  items: EstimateLineItem[];
  preparedBy: string;
}): Promise<{ base64: string; total: number }> {
  const total = opts.items.reduce((sum, i) => sum + i.price, 0);
  const logoDataUrl = await fetchLogoDataUrl();

  const tableBody: any[] = [
    [
      { text: "Qty", style: "tableHeader" },
      { text: "Description", style: "tableHeader" },
      { text: "Line total", style: "tableHeader", alignment: "right" },
    ],
    ...opts.items.map((item, i) => {
      const shaded = i % 2 === 0;
      const descStack = item.descriptionLines.map((line, idx) => ({
        text: (idx === 0 ? "" : "• ") + line,
        bold: idx === 0,
        margin: idx === 0 ? [0, 0, 0, 2] : [10, 0, 0, 2],
        fontSize: idx === 0 ? 9.5 : 8.5,
      }));
      return [
        { text: item.qty, fillColor: shaded ? "#fbe3d5" : null, margin: [0, 4, 0, 4] },
        { stack: descStack, fillColor: shaded ? "#fbe3d5" : null, margin: [0, 4, 0, 4] },
        {
          text: formatMoney(item.price),
          alignment: "right",
          fillColor: shaded ? "#fbe3d5" : null,
          margin: [0, 4, 0, 4],
        },
      ];
    }),
    [
      { text: "" },
      { text: "Total", alignment: "right", bold: true },
      { text: formatMoney(total), alignment: "right", bold: true },
    ],
  ];

  const docDefinition: any = {
    pageMargins: [40, 40, 40, 60],
    content: [
      {
        columns: [
          { image: logoDataUrl, width: 110 },
          { text: "Estimate", style: "title", alignment: "right" },
        ],
      },
      { text: " ", margin: [0, 6, 0, 6] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "6602 Amleigh rd. Baltimore MD 21209", fontSize: 9 },
              { text: "443-916-4269", fontSize: 9 },
              { text: "Baltimorebuiltins@gmail.com", fontSize: 9 },
              { text: "To:", bold: true, margin: [0, 6, 0, 0], fontSize: 9 },
              { text: opts.customerName, fontSize: 9 },
            ],
          },
          {
            width: "auto",
            alignment: "right",
            stack: [
              { text: [{ text: "Estimate # ", bold: true }, opts.estimateNumber], fontSize: 9 },
              { text: [{ text: "Date: ", bold: true }, opts.date], fontSize: 9 },
            ],
          },
        ],
      },
      { text: " ", margin: [0, 10, 0, 10] },
      {
        table: { headerRows: 1, widths: [30, "*", 70], body: tableBody },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d9a89a",
          vLineColor: () => "#d9a89a",
        },
      },
      { text: " ", margin: [0, 20, 0, 0] },
      { text: `Estimate prepared by: ${opts.preparedBy}`, fontSize: 9 },
      { text: "Please reach out with any questions.", fontSize: 9 },
      { text: "Thank you for your business!", bold: true, color: MAROON, margin: [0, 6, 0, 0] },
    ],
    styles: {
      title: { fontSize: 26, bold: true, color: MAROON },
      tableHeader: { bold: true, color: "white", fillColor: MAROON, fontSize: 9.5 },
    },
    defaultStyle: { fontSize: 9 },
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  const base64 = await pdfDoc.getBase64();
  return { base64, total };
}
