import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, Job, JobStatus } from "../supabaseClient";
import StatusBadge from "../components/StatusBadge";
import NewJobModal from "../components/NewJobModal";
import JobModal from "../components/JobModal";
import JobCard, { JobCounts } from "../components/JobCard";
import CalendarView from "../components/CalendarView";
import RemindersBanner from "../components/RemindersBanner";

type Tab = "board" | "calendar" | string;

export default function Board({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [counts, setCounts] = useState<Record<string, JobCounts>>({});
  const [search, setSearch] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("board");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: jobData }, { data: statusData }, { data: checklistData }, { data: fileData }] =
      await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("job_statuses").select("*").order("sort_order", { ascending: true }),
        supabase.from("checklist_items").select("job_id, is_done"),
        supabase.from("job_files").select("job_id"),
      ]);
    setJobs(jobData ?? []);
    setStatuses(statusData ?? []);

    const nextCounts: Record<string, JobCounts> = {};
    for (const item of checklistData ?? []) {
      const c = (nextCounts[item.job_id] ??= { checklistTotal: 0, checklistDone: 0, fileCount: 0 });
      c.checklistTotal += 1;
      if (item.is_done) c.checklistDone += 1;
    }
    for (const f of fileData ?? []) {
      const c = (nextCounts[f.job_id] ??= { checklistTotal: 0, checklistDone: 0, fileCount: 0 });
      c.fileCount += 1;
    }
    setCounts(nextCounts);
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

  async function moveJobToStatus(jobId: string, status: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === status) return;
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
    await supabase.from("jobs").update({ status }).eq("id", jobId);
  }

  const activeStatusTab = statuses.find((s) => s.name === activeTab);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Baltimore Built-Ins" className="brand-mark" />
          <div>
            <h1>Baltimore Built-Ins</h1>
            <p className="subtitle">Job Tracker</p>
          </div>
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

      {!loading && (
        <RemindersBanner jobs={jobs} onOpenJob={(job) => setSelectedJob(job)} />
      )}

      <nav className="tab-bar">
        <button
          className={`tab${activeTab === "board" ? " active" : ""}`}
          onClick={() => setActiveTab("board")}
        >
          Board
        </button>
        {statuses.map((s) => (
          <button
            key={s.id}
            className={`tab${activeTab === s.name ? " active" : ""}`}
            onClick={() => setActiveTab(s.name)}
          >
            {s.name}
            <span className="tab-count">{jobs.filter((j) => j.status === s.name).length}</span>
          </button>
        ))}
        <button
          className={`tab${activeTab === "calendar" ? " active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          Calendar
        </button>
      </nav>

      {loading ? (
        <div className="center-screen">Loading jobs…</div>
      ) : activeTab === "calendar" ? (
        <div className="tab-content">
          <CalendarView jobs={filteredJobs} statuses={statuses} onOpenJob={setSelectedJob} />
        </div>
      ) : activeTab === "board" ? (
        <div className="board">
          {columns.map((col) => (
            <div
              key={col.status.id}
              className={`board-column${dragOverStatus === col.status.name ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(col.status.name);
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === col.status.name ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                if (draggingJobId) void moveJobToStatus(draggingJobId, col.status.name);
                setDraggingJobId(null);
              }}
            >
              <div className="board-column-header">
                <StatusBadge status={col.status.name} statuses={statuses} />
                <span className="board-column-count">{col.jobs.length}</span>
              </div>
              {col.jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  counts={counts[job.id]}
                  dragging={draggingJobId === job.id}
                  onOpen={() => setSelectedJob(job)}
                  onDragStart={(e) => {
                    setDraggingJobId(job.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
              {col.jobs.length === 0 && <p className="muted empty-col">No jobs</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="tab-content">
          <div className="status-tab-header">
            {activeStatusTab && <StatusBadge status={activeStatusTab.name} statuses={statuses} />}
          </div>
          <div className="status-list-grid">
            {filteredJobs
              .filter((j) => j.status === activeTab)
              .map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  counts={counts[job.id]}
                  dragging={false}
                  onOpen={() => setSelectedJob(job)}
                  onDragStart={() => {}}
                />
              ))}
            {filteredJobs.filter((j) => j.status === activeTab).length === 0 && (
              <p className="muted">No jobs in this status.</p>
            )}
          </div>
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
