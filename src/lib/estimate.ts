import * as XLSX from "xlsx";
import pdfMake from "./pdfMakeSetup";

export type ParsedEstimateRoom = {
  roomName: string;
  detail: string;
  price: number;
};

export type ParsedEstimate = {
  rooms: ParsedEstimateRoom[];
  delivery: number;
};

export type EstimateRoomInput = {
  roomName: string;
  detail: string;
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

function toNumber(raw: any): number {
  if (typeof raw === "number") return raw;
  return parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, "")) || 0;
}

export function parseEstimateWorkbook(data: ArrayBuffer): ParsedEstimate {
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const rooms: ParsedEstimateRoom[] = [];
  let delivery = 0;

  for (const row of rows) {
    const nameKey = findKey(row, ["closet name", "closet", "room name", "room"]);
    const detailKey = findKey(row, ["color/finish", "color / finish", "color", "finish", "detail"]);
    // "final price" is checked first so it wins over columns like "Labor total" or
    // "cost total" that also contain the word "total".
    const priceKey = findKey(row, [
      "final price",
      "total",
      "price",
      "line total",
      "linetotal",
      "amount",
      "cost",
    ]);

    const roomName = nameKey ? String(row[nameKey]).trim() : "";
    if (!roomName) continue;

    // Skip a trailing "Totals" / "Total" summary row from the spreadsheet itself.
    if (/^totals?$/i.test(roomName)) continue;

    const detail = detailKey ? String(row[detailKey]).trim() : "";
    const price = priceKey ? toNumber(row[priceKey]) : 0;

    if (/^delivery$/i.test(roomName)) {
      delivery += price;
      continue;
    }

    rooms.push({ roomName, detail, price });
  }

  return { rooms, delivery };
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

async function generateLineItemPdfBase64(opts: {
  documentTitle: string;
  numberLabel: string;
  customerName: string;
  documentNumber: string;
  date: string;
  rooms: EstimateRoomInput[];
  delivery: number;
  preparedBy: string;
}): Promise<{ base64: string; total: number }> {
  const roomsTotal = opts.rooms.reduce((sum, r) => sum + r.price, 0);
  const total = roomsTotal + (opts.delivery || 0);
  const logoDataUrl = await fetchLogoDataUrl();

  let running = 0;
  const tableBody: any[] = [
    [
      { text: "Room / Closet", style: "tableHeader" },
      { text: "Color / Finish", style: "tableHeader" },
      { text: "Price", style: "tableHeader", alignment: "right" },
      { text: "Running Total", style: "tableHeader", alignment: "right" },
    ],
    ...opts.rooms.map((room, i) => {
      const shaded = i % 2 === 0;
      running += room.price;
      return [
        {
          text: room.roomName,
          bold: true,
          fillColor: shaded ? "#fbe3d5" : null,
          margin: [0, 4, 0, 4],
        },
        {
          text: room.detail || "",
          fillColor: shaded ? "#fbe3d5" : null,
          margin: [0, 4, 0, 4],
        },
        {
          text: formatMoney(room.price),
          alignment: "right",
          fillColor: shaded ? "#fbe3d5" : null,
          margin: [0, 4, 0, 4],
        },
        {
          text: formatMoney(running),
          alignment: "right",
          fillColor: shaded ? "#fbe3d5" : null,
          margin: [0, 4, 0, 4],
        },
      ];
    }),
    [
      { text: "Delivery", bold: true, margin: [0, 4, 0, 4] },
      { text: "", margin: [0, 4, 0, 4] },
      { text: formatMoney(opts.delivery || 0), alignment: "right", margin: [0, 4, 0, 4] },
      { text: formatMoney(total), alignment: "right", margin: [0, 4, 0, 4] },
    ],
    [
      { text: "" },
      { text: "Total", alignment: "right", bold: true },
      { text: "", alignment: "right" },
      { text: formatMoney(total), alignment: "right", bold: true },
    ],
  ];

  const docDefinition: any = {
    pageMargins: [40, 40, 40, 60],
    content: [
      {
        columns: [
          { image: logoDataUrl, width: 110 },
          { text: opts.documentTitle, style: "title", alignment: "right" },
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
              { text: [{ text: opts.numberLabel, bold: true }, opts.documentNumber], fontSize: 9 },
              { text: [{ text: "Date: ", bold: true }, opts.date], fontSize: 9 },
            ],
          },
        ],
      },
      { text: " ", margin: [0, 10, 0, 10] },
      {
        table: { headerRows: 1, widths: ["auto", "*", 65, 80], body: tableBody },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d9a89a",
          vLineColor: () => "#d9a89a",
        },
      },
      { text: " ", margin: [0, 20, 0, 0] },
      { text: `${opts.documentTitle} prepared by: ${opts.preparedBy}`, fontSize: 9 },
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

export async function generateEstimatePdfBase64(opts: {
  customerName: string;
  estimateNumber: string;
  date: string;
  rooms: EstimateRoomInput[];
  delivery: number;
  preparedBy: string;
}): Promise<{ base64: string; total: number }> {
  return generateLineItemPdfBase64({
    documentTitle: "Estimate",
    numberLabel: "Estimate # ",
    customerName: opts.customerName,
    documentNumber: opts.estimateNumber,
    date: opts.date,
    rooms: opts.rooms,
    delivery: opts.delivery,
    preparedBy: opts.preparedBy,
  });
}

export async function generateInvoicePdfBase64(opts: {
  customerName: string;
  invoiceNumber: string;
  date: string;
  rooms: EstimateRoomInput[];
  delivery: number;
  preparedBy: string;
}): Promise<{ base64: string; total: number }> {
  return generateLineItemPdfBase64({
    documentTitle: "Invoice",
    numberLabel: "Invoice # ",
    customerName: opts.customerName,
    documentNumber: opts.invoiceNumber,
    date: opts.date,
    rooms: opts.rooms,
    delivery: opts.delivery,
    preparedBy: opts.preparedBy,
  });
}
