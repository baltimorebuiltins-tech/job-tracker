import { FormEvent, useEffect, useState } from "react";
import { supabase, Customer, Job, JobFile, JobStatus } from "../supabaseClient";
import StatusBadge from "./StatusBadge";
import FileThumb from "./FileThumb";

export default function CustomerDetailModal({
  customer,
  jobs,
  statuses,
  onClose,
  onOpenJob,
  onChanged,
}: {
  customer: Customer;
  jobs: Job[];
  statuses: JobStatus[];
  onClose: () => void;
  onOpenJob: (job: Job) => void;
  onChanged: () => void;
}) {
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [customerNotes, setCustomerNotes] = useState(customer.customer_notes ?? "");
  const [drawings, setDrawings] = useState<(JobFile & { jobName: string })[]>([]);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/share/${customer.share_token}`;

  useEffect(() => {
    void loadDrawings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, jobs.length]);

  async function loadDrawings() {
    const jobIds = jobs.map((j) => j.id);
    if (jobIds.length === 0) {
      setDrawings([]);
      return;
    }
    const { data } = await supabase
      .from("job_files")
      .select("*")
      .in("job_id", jobIds)
      .order("uploaded_at", { ascending: false });
    const withJobName = (data ?? []).map((f) => ({
      ...f,
      jobName: jobs.find((j) => j.id === f.job_id)?.name ?? "",
    }));
    setDrawings(withJobName);
  }

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    await supabase
      .from("customers")
      .update({ phone: phone || null, email: email || null, address: address || null })
      .eq("id", customer.id);
    onChanged();
  }

  async function saveCustomerNotes() {
    await supabase
      .from("customers")
      .update({ customer_notes: customerNotes || null })
      .eq("id", customer.id);
    onChanged();
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{customer.name}</h2>
        </div>

        <form onSubmit={saveContact} className="job-detail-grid">
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={saveContact} />
          </label>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={saveContact} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} onBlur={saveContact} />
          </label>
        </form>

        <div className="job-section">
          <label>Customer-facing notes</label>
          <p className="muted">
            Only what you write here shows up on their view-only page — nothing else from your
            internal notes.
          </p>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            onBlur={saveCustomerNotes}
            rows={3}
            placeholder="Notes visible to this customer…"
          />
        </div>

        <div className="job-section">
          <label>Their view-only page</label>
          <p className="muted">
            Send this link so they can see their info, drawings, and the notes above — no login
            needed, and they can't edit anything.
          </p>
          <div className="calendar-sync-row">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            <button onClick={copyShareLink}>{copied ? "Copied!" : "Copy link"}</button>
          </div>
        </div>

        <div className="job-section">
          <label>Jobs ({jobs.length})</label>
          <ul className="customer-job-list">
            {jobs.map((job) => (
              <li key={job.id}>
                <button className="customer-job-row" onClick={() => onOpenJob(job)}>
                  <span>
                    {job.job_number ? `#${job.job_number} — ` : ""}
                    {job.name}
                  </span>
                  <StatusBadge status={job.status} statuses={statuses} />
                </button>
              </li>
            ))}
            {jobs.length === 0 && <li className="muted">No jobs yet.</li>}
          </ul>
        </div>

        <div className="job-section">
          <label>Drawings &amp; files across all jobs</label>
          <div className="file-thumb-grid">
            {drawings.map((f) => (
              <FileThumb key={f.id} file={f} editable onDeleted={loadDrawings} onNoteChanged={loadDrawings} />
            ))}
          </div>
          {drawings.length === 0 && <p className="muted">No files yet.</p>}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
