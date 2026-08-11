import { FormEvent, useState } from "react";
import { supabase, JobStatus, Customer } from "../supabaseClient";

function slugFolder(jobNumber: string, name: string) {
  const base = `${jobNumber} ${name}`;
  const cleaned = base.replace(/[\\/:*?"<>|]/g, "").trim();
  return `/${cleaned || "Untitled Job"}`;
}

export default function NewJobModal({
  statuses,
  customers,
  userId,
  onClose,
  onCreated,
}: {
  statuses: JobStatus[];
  customers: Customer[];
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState(statuses[0]?.name ?? "Design");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      // Find an existing customer with this name, or create one.
      let customerId: string | null = null;
      const trimmedName = customerName.trim();
      if (trimmedName) {
        const existing = customers.find(
          (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (existing) {
          customerId = existing.id;
        } else {
          const { data: newCustomer, error: customerErr } = await supabase
            .from("customers")
            .insert({ name: trimmedName, address: address || null })
            .select()
            .single();
          if (customerErr) throw customerErr;
          customerId = newCustomer.id;
        }
      }

      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          name,
          customer_id: customerId,
          address: address || null,
          status,
          due_date: dueDate || null,
          notes: notes || null,
          created_by: userId,
        })
        .select()
        .single();
      if (jobErr) throw jobErr;

      // Now that we know the auto-assigned job number, set the Dropbox folder path.
      await supabase
        .from("jobs")
        .update({ dropbox_folder_path: slugFolder(job.job_number, job.name) })
        .eq("id", job.id);

      onCreated();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New job</h2>
        <p className="muted">Job # is assigned automatically.</p>
        <form onSubmit={handleSubmit} className="job-form">
          <label>
            Job name *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Customer
            <input
              list="customer-options"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Start typing an existing customer or add a new one…"
            />
            <datalist id="customer-options">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
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
