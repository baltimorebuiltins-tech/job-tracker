import { FormEvent, useEffect, useState } from "react";
import { supabase, Customer, Job, JobFile, JobStatus } from "../supabaseClient";
import StatusBadge from "./StatusBadge";

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
  const [drawings, setDrawings] = useState<(JobFile & { jobName: string })[]>([]);

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
          <ul className="file-list">
            {drawings.map((f) => (
              <li key={f.id}>
                {f.dropbox_shared_link ? (
                  <a href={f.dropbox_shared_link} target="_blank" rel="noreferrer">
                    {f.file_name}
                  </a>
                ) : (
                  <span>{f.file_name}</span>
                )}
                <span className="muted"> · {f.jobName}</span>
              </li>
            ))}
            {drawings.length === 0 && <li className="muted">No files yet.</li>}
          </ul>
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
