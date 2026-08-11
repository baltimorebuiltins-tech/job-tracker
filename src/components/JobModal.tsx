import { FormEvent, useEffect, useState } from "react";
import {
  supabase,
  Job,
  JobStatus,
  ChecklistItem,
  JobFile,
  FileCategory,
  FILE_CATEGORIES,
} from "../supabaseClient";
import StatusBadge from "./StatusBadge";
import PaymentsSection from "./PaymentsSection";

function categoryFolder(category: FileCategory) {
  switch (category) {
    case "drawing":
      return "Drawings";
    case "invoice":
      return "Invoices";
    case "receipt":
      return "Receipts";
    default:
      return "Other";
  }
}

export default function JobModal({
  job,
  statuses,
  userId,
  isAdmin,
  onClose,
  onChanged,
}: {
  job: Job;
  statuses: JobStatus[];
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<FileCategory>("drawing");
  const [notes, setNotes] = useState(job.notes ?? "");

  useEffect(() => {
    loadChecklist();
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  async function loadChecklist() {
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("job_id", job.id)
      .order("position", { ascending: true });
    setChecklist(data ?? []);
  }

  async function loadFiles() {
    const { data } = await supabase
      .from("job_files")
      .select("*")
      .eq("job_id", job.id)
      .order("uploaded_at", { ascending: false });
    setFiles(data ?? []);
  }

  async function updateStatus(status: string) {
    await supabase.from("jobs").update({ status }).eq("id", job.id);
    onChanged();
  }

  async function saveNotes() {
    await supabase.from("jobs").update({ notes }).eq("id", job.id);
    onChanged();
  }

  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    if (!newItemText.trim()) return;
    await supabase.from("checklist_items").insert({
      job_id: job.id,
      text: newItemText.trim(),
      position: checklist.length,
    });
    setNewItemText("");
    loadChecklist();
  }

  async function toggleItem(item: ChecklistItem) {
    await supabase
      .from("checklist_items")
      .update({ is_done: !item.is_done })
      .eq("id", item.id);
    loadChecklist();
  }

  async function deleteItem(item: ChecklistItem) {
    await supabase.from("checklist_items").delete().eq("id", item.id);
    loadChecklist();
  }

  async function deleteJob() {
    if (!confirm(`Delete "${job.name}"? This cannot be undone.`)) return;
    await supabase.from("jobs").delete().eq("id", job.id);
    onChanged();
    onClose();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await fileToBase64(file);
      const basePath = job.dropbox_folder_path || `/${job.name}`;
      const res = await fetch("/api/dropbox-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `${basePath}/${categoryFolder(uploadCategory)}`,
          fileName: file.name,
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
        file_name: file.name,
        dropbox_path: result.dropboxPath,
        dropbox_shared_link: result.sharedLink,
        size_bytes: result.sizeBytes,
        category: uploadCategory,
        uploaded_by: userId,
      });
      loadFiles();
    } catch (err: any) {
      setUploadError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              {job.job_number ? `#${job.job_number} — ` : ""}
              {job.name}
            </h2>
            {job.client && <p className="subtitle">{job.client}</p>}
          </div>
          <StatusBadge status={job.status} statuses={statuses} />
        </div>

        <div className="job-detail-grid">
          <div>
            <label>Status</label>
            <select value={job.status} onChange={(e) => updateStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Address</label>
            <p>{job.address || "—"}</p>
          </div>
          <div>
            <label>Due date</label>
            <p>{job.due_date || "—"}</p>
          </div>
          <div>
            <label>Dropbox folder</label>
            <p className="mono">{job.dropbox_folder_path}</p>
          </div>
        </div>

        <div className="job-section">
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={3}
          />
        </div>

        {isAdmin && <PaymentsSection jobId={job.id} />}

        <div className="job-section">
          <label>
            Checklist
            {checklist.length > 0 &&
              ` (${checklist.filter((i) => i.is_done).length}/${checklist.length})`}
          </label>
          {checklist.length > 0 && (
            <div className="checklist-progress-bar">
              <div
                className="checklist-progress-fill"
                style={{
                  width: `${
                    (checklist.filter((i) => i.is_done).length / checklist.length) * 100
                  }%`,
                }}
              />
            </div>
          )}
          <ul className="checklist">
            {checklist.map((item) => (
              <li key={item.id}>
                <label className="checklist-row">
                  <input
                    type="checkbox"
                    checked={item.is_done}
                    onChange={() => toggleItem(item)}
                  />
                  <span className={item.is_done ? "done" : ""}>{item.text}</span>
                </label>
                <button className="link-button" onClick={() => deleteItem(item)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addChecklistItem} className="inline-form">
            <input
              placeholder="Add a checklist item…"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </div>

        <div className="job-section">
          <label>Files (synced to Dropbox)</label>

          {FILE_CATEGORIES.map(({ value, label }) => {
            const group = files.filter((f) => f.category === value);
            if (group.length === 0) return null;
            return (
              <div key={value} className="file-group">
                <div className="file-group-label">{label}s</div>
                <ul className="file-list">
                  {group.map((f) => (
                    <li key={f.id}>
                      {f.dropbox_shared_link ? (
                        <a href={f.dropbox_shared_link} target="_blank" rel="noreferrer">
                          {f.file_name}
                        </a>
                      ) : (
                        <span>{f.file_name}</span>
                      )}
                      <span className="muted">
                        {" "}
                        · {new Date(f.uploaded_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {files.length === 0 && <p className="muted">No files yet.</p>}

          <div className="upload-row">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as FileCategory)}
            >
              {FILE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input type="file" onChange={handleFileUpload} disabled={uploading} />
          </div>
          {uploading && <p className="notice-text">Uploading to Dropbox…</p>}
          {uploadError && <p className="error-text">{uploadError}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" className="danger" onClick={deleteJob}>
            Delete job
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
