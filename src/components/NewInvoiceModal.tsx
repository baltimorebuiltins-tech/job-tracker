import { useState } from "react";
import { supabase, Job, Invoice, InvoiceItem } from "../supabaseClient";
import { generateInvoicePdfBase64 } from "../lib/estimate";

export default function NewInvoiceModal({
  jobs,
  userId,
  onClose,
  onCreated,
}: {
  jobs: Job[];
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [delivery, setDelivery] = useState("0");
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateMsg, setRegenerateMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedJobs = [...jobs].sort((a, b) => a.name.localeCompare(b.name));
  const job = jobs.find((j) => j.id === jobId) ?? null;

  async function startInvoice() {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: newInvoice, error: invoiceErr } = await supabase
        .from("invoices")
        .insert({ job_id: jobId, created_by: userId })
        .select()
        .single();
      if (invoiceErr) throw invoiceErr;

      const { data: firstItem, error: itemErr } = await supabase
        .from("invoice_items")
        .insert({ invoice_id: newInvoice.id, item_name: "New item", detail: "", price: 0, position: 0 })
        .select()
        .single();
      if (itemErr) throw itemErr;

      setInvoice(newInvoice as Invoice);
      setItems(firstItem ? [firstItem as InvoiceItem] : []);
    } catch (err: any) {
      setError(err.message ?? "Couldn't start the invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function recalcTotal(nextItems: InvoiceItem[], deliveryValue: number) {
    if (!invoice) return;
    const total = nextItems.reduce((sum, i) => sum + (i.price ?? 0), 0) + deliveryValue;
    await supabase
      .from("invoices")
      .update({ total, delivery: deliveryValue })
      .eq("id", invoice.id);
  }

  function updateLocalField(id: string, field: "item_name" | "detail", value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function updateLocalPrice(id: string, value: string) {
    const price = value === "" ? 0 : Number(value);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, price } : i)));
  }

  async function saveItem(item: InvoiceItem) {
    await supabase
      .from("invoice_items")
      .update({ item_name: item.item_name, detail: item.detail, price: item.price })
      .eq("id", item.id);
    await recalcTotal(items, Number(delivery) || 0);
  }

  async function addItem() {
    if (!invoice) return;
    const { data, error: insertErr } = await supabase
      .from("invoice_items")
      .insert({ invoice_id: invoice.id, item_name: "New item", detail: "", price: 0, position: items.length })
      .select()
      .single();
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setItems((prev) => [...prev, data as InvoiceItem]);
  }

  async function deleteItem(item: InvoiceItem) {
    await supabase.from("invoice_items").delete().eq("id", item.id);
    const nextItems = items.filter((i) => i.id !== item.id);
    setItems(nextItems);
    await recalcTotal(nextItems, Number(delivery) || 0);
  }

  async function saveDelivery() {
    await recalcTotal(items, Number(delivery) || 0);
  }

  async function generatePdf() {
    if (!invoice || !job) return;
    setRegenerating(true);
    setRegenerateMsg(null);
    setError(null);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      const preparedBy = profile?.full_name || profile?.email || "";

      const deliveryValue = Number(delivery) || 0;
      const { base64 } = await generateInvoicePdfBase64({
        customerName: job.client ?? "",
        invoiceNumber: invoice.invoice_number,
        date: new Date().toLocaleDateString(),
        rooms: items.map((i) => ({ roomName: i.item_name, detail: i.detail ?? "", price: i.price })),
        delivery: deliveryValue,
        preparedBy,
      });

      const pdfFileName = `Invoice #${invoice.invoice_number}.pdf`.replace(/\s+/g, " ");
      const basePath = job.dropbox_folder_path || `/${job.name}`;

      const res = await fetch("/api/dropbox-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `${basePath}/Invoices`,
          fileName: pdfFileName,
          fileBase64: base64,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      const result = await res.json();

      await supabase.from("job_files").insert({
        job_id: job.id,
        file_name: pdfFileName,
        dropbox_path: result.dropboxPath,
        dropbox_shared_link: result.sharedLink,
        size_bytes: result.sizeBytes,
        category: "invoice",
        uploaded_by: userId,
      });

      setRegenerateMsg("Invoice PDF generated and synced to Dropbox.");
      onCreated();
    } catch (err: any) {
      setError(err.message ?? "Couldn't generate the invoice PDF.");
    } finally {
      setRegenerating(false);
    }
  }

  const itemsTotal = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const total = itemsTotal + (Number(delivery) || 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>New invoice</h2>

        {!invoice ? (
          <>
            <p className="muted">Choose the job this invoice is for.</p>
            <label>
              Job
              <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">Select a job…</option>
                {sortedJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_number ? `#${j.job_number} — ` : ""}
                    {j.name}
                    {j.client ? ` (${j.client})` : ""}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" onClick={startInvoice} disabled={!jobId || busy}>
                {busy ? "Starting…" : "Start invoice"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Invoice #{invoice.invoice_number} for {job?.name}
              {job?.client ? ` (${job.client})` : ""}
            </p>

            <div className="estimate-rooms">
              <div className="estimate-rooms-header">
                <span>Item</span>
                <span>Detail</span>
                <span>Price</span>
                <span>Running total</span>
                <span />
              </div>
              {(() => {
                let running = 0;
                return items.map((item) => {
                  running += item.price ?? 0;
                  return (
                    <div key={item.id} className="estimate-rooms-row">
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) => updateLocalField(item.id, "item_name", e.target.value)}
                        onBlur={() => saveItem(items.find((i) => i.id === item.id)!)}
                      />
                      <input
                        type="text"
                        value={item.detail ?? ""}
                        onChange={(e) => updateLocalField(item.id, "detail", e.target.value)}
                        onBlur={() => saveItem(items.find((i) => i.id === item.id)!)}
                      />
                      <div className="estimate-price-input">
                        <span className="payment-currency">$</span>
                        <input
                          type="number"
                          className="payment-amount-input"
                          value={item.price}
                          onChange={(e) => updateLocalPrice(item.id, e.target.value)}
                          onBlur={() => saveItem(items.find((i) => i.id === item.id)!)}
                        />
                      </div>
                      <span className="estimate-running-total">
                        ${running.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <button type="button" className="link-button" onClick={() => deleteItem(item)}>
                        Remove
                      </button>
                    </div>
                  );
                });
              })()}

              <div className="estimate-rooms-row estimate-delivery-row">
                <span className="estimate-delivery-label">Delivery</span>
                <span />
                <div className="estimate-price-input">
                  <span className="payment-currency">$</span>
                  <input
                    type="number"
                    className="payment-amount-input"
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                    onBlur={saveDelivery}
                  />
                </div>
                <span className="estimate-running-total">
                  ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span />
              </div>

              <div className="estimate-rooms-actions">
                <button type="button" onClick={addItem}>
                  + Add item
                </button>
                <p className="estimate-grand-total">
                  Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {regenerateMsg && <p className="notice-text">{regenerateMsg}</p>}
            {error && <p className="error-text">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" onClick={generatePdf} disabled={regenerating || items.length === 0}>
                {regenerating ? "Generating…" : "Generate invoice PDF"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
