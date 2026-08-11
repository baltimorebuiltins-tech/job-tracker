import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, Job, JobStatus } from "../supabaseClient";
import StatusBadge from "../components/StatusBadge";
import NewJobModal from "../components/NewJobModal";
import JobModal from "../components/JobModal";

export default function Board({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [search, setSearch] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: jobData }, { data: statusData }] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("job_statuses").select("*").order("sort_order", { ascending: true }),
    ]);
    setJobs(jobData ?? []);
    setStatuses(statusData ?? []);
    setLoading(false);
  }

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        (j.client ?? "").toLowerCase().includes(q) ||
        (j.job_number ?? "").toLowerCase().includes(q) ||
        (j.address ?? "").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const columns = useMemo(() => {
    return statuses.map((s) => ({
      status: s,
      jobs: filteredJobs.filter((j) => j.status === s.name),
    }));
  }, [statuses, filteredJobs]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Baltimore Builtins</h1>
          <p className="subtitle">Job Tracker</p>
        </div>
        <div className="topbar-actions">
          <input
            className="search-input"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => setShowNewJob(true)}>+ New job</button>
          <span className="muted">{session.user.email}</span>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {loading ? (
        <div className="center-screen">Loading jobs…</div>
      ) : (
        <div className="board">
          {columns.map((col) => (
            <div key={col.status.id} className="board-column">
              <div className="board-column-header">
                <StatusBadge status={col.status.name} statuses={statuses} />
                <span className="muted">{col.jobs.length}</span>
              </div>
              {col.jobs.map((job) => (
                <button
                  key={job.id}
                  className="job-card"
                  onClick={() => setSelectedJob(job)}
                >
                  <strong>{job.name}</strong>
                  {job.client && <div className="muted">{job.client}</div>}
                  {job.due_date && <div className="muted">Due {job.due_date}</div>}
                </button>
              ))}
              {col.jobs.length === 0 && <p className="muted empty-col">No jobs</p>}
            </div>
          ))}
        </div>
      )}

      {showNewJob && (
        <NewJobModal
          statuses={statuses}
          userId={session.user.id}
          onClose={() => setShowNewJob(false)}
          onCreated={() => {
            setShowNewJob(false);
            loadAll();
          }}
        />
      )}

      {selectedJob && (
        <JobModal
          job={selectedJob}
          statuses={statuses}
          userId={session.user.id}
          onClose={() => setSelectedJob(null)}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}
