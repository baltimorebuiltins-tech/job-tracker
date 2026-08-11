import { FormEvent, useState } from "react";
import { supabase, JobStatus } from "../supabaseClient";

function slugFolder(jobNumber: string | null, name: string) {
  const base = `${jobNumber ? jobNumber + " " : ""}${name}`;
  const cleaned = base.replace(/[\\/:*?"<>|]/g, "").trim();
  return `/${cleaned || "Untitled Job"}`;
}

export default function NewJobModal({
  statuses,
  userId,
  onClose,
  onCreated,
}: {
  statuses: JobStatus[];
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [jobNumber, setJobNumber] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState(statuses[0]?.name ?? "Bid");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const dropboxFolderPath = slugFolder(jobNumber || null, name);
    const { error: err } = await supabase.from("jobs").insert({
      job_number: jobNumber || null,
      name,
      client: client || null,
      address: address || null,
      status,
      due_date: dueDate || null,
      notes: notes || null,
      dropbox_folder_path: dropboxFolderPath,
      created_by: userId,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New job</h2>
        <form onSubmit={handleSubmit} className="job-form">
          <label>
            Job #
            <input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
          </label>
          <label>
            Job name *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Client
            <input value={client} onChange={(e) => setClient(e.target.value)} />
          </label>
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
