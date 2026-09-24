import { useState } from "react";
import { supabase, Job } from "../supabaseClient";
import { parseEstimateWorkbook, generateEstimatePdfBase64 } from "../lib/estimate";

export default function EstimateUpload({
  job,
  userId,
  onDone,
}: {
  job: Job;
  userId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const items = parseEstimateWorkbook(buffer);
      if (items.length === 0) {
        throw new Error(
          "Couldn't find any line items in that file. Make sure it has Qty, Description, and Price columns."
        );
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      const preparedBy = profile?.full_name || profile?.email || "";

      const { base64, total } = await generateEstimatePdfBase64({
        customerName: job.client ?? "",
        estimateNumber: job.job_number ?? job.id.slice(0, 6),
        date: new Date().toLocaleDateString(),
        items,
        preparedBy,
      });

      const pdfFileName = `Estimate #${job.job_number ?? ""}.pdf`.replace(/\s+/g, " ");
      const basePath = job.dropbox_folder_path || `/${job.name}`;

      const res = await fetch("/api/dropbox-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `${basePath}/Estimates`,
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
        category: "estimate",
        uploaded_by: userId,
      });

      await supabase.from("jobs").update({ estimate_total: total }).eq("id", job.id);

      onDone();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="estimate-upload">
      <p className="muted">
        Upload a spreadsheet with <strong>Qty</strong>, <strong>Description</strong>, and{" "}
        <strong>Price</strong> columns — it's converted into a branded PDF estimate and synced to
        this job automatically.{" "}
        <a href="/estimate-template.csv" download>
          Download a template
        </a>
        .
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={busy} />
      {busy && <p className="notice-text">Building estimate…</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
