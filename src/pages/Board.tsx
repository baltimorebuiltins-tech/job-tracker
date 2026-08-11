import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, Job, JobStatus, Customer } from "../supabaseClient";
import StatusBadge from "../components/StatusBadge";
import NewJobModal from "../components/NewJobModal";
import JobModal from "../components/JobModal";
import JobCard, { JobCounts } from "../components/JobCard";
import CalendarView from "../components/CalendarView";
import CalendarSyncPanel from "../components/CalendarSyncPanel";
import RemindersBanner from "../components/RemindersBanner";
import NewCustomerModal from "../components/NewCustomerModal";
import CustomerDetailModal from "../components/CustomerDetailModal";
import WeekStrip from "../components/WeekStrip";
import QuickNotes from "../components/QuickNotes";

type Tab = "board" | "calendar" | "customers" | "notes" | string;

export default function Board({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [counts, setCounts] = useState<Record<string, JobCounts>>({});
  const [search, setSearch] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("board");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [
      { data: jobData },
      { data: statusData },
      { data: checklistData },
      { data: fileData },
      { data: customerData },
    ] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("job_statuses").select("*").order("sort_order", { ascending: true }),
      supabase.from("checklist_items").select("job_id, is_done"),
      supabase.from("job_files").select("job_id"),
      supabase.from("customers").select("*").order("name", { ascending: true }),
    ]);
    setJobs(jobData ?? []);
    setStatuses(statusData ?? []);
    setCustomers(customerData ?? []);

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

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, search]);

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
            placeholder="Search jobs or customers…"
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
        <button
          className={`tab${activeTab === "customers" ? " active" : ""}`}
          onClick={() => setActiveTab("customers")}
        >
          Customers
          <span className="tab-count">{customers.length}</span>
        </button>
        <button
          className={`tab${activeTab === "notes" ? " active" : ""}`}
          onClick={() => setActiveTab("notes")}
        >
          Quick Notes
        </button>
      </nav>

      {loading ? (
        <div className="center-screen">Loading jobs…</div>
      ) : activeTab === "calendar" ? (
        <div className="tab-content">
          <CalendarSyncPanel />
          <CalendarView jobs={filteredJobs} statuses={statuses} onOpenJob={setSelectedJob} />
        </div>
      ) : activeTab === "customers" ? (
        <div className="tab-content">
          <div className="customers-toolbar">
            <button onClick={() => setShowNewCustomer(true)}>+ New customer</button>
          </div>
          <div className="customers-grid">
            {filteredCustomers.map((c) => {
              const customerJobs = jobs.filter((j) => j.customer_id === c.id);
              return (
                <button
                  key={c.id}
                  className="customer-card"
                  onClick={() => setSelectedCustomer(c)}
                >
                  <span className="customer-card-name">{c.name}</span>
                  {c.phone && <span className="muted">{c.phone}</span>}
                  {c.email && <span className="muted">{c.email}</span>}
                  <span className="muted">
                    {customerJobs.length} job{customerJobs.length === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
            {filteredCustomers.length === 0 && <p className="muted">No customers yet.</p>}
          </div>
        </div>
      ) : activeTab === "notes" ? (
        <div className="tab-content">
          <QuickNotes session={session} />
        </div>
      ) : activeTab === "board" ? (
        <div className="board-page">
          <div className="tab-content">
            <WeekStrip jobs={filteredJobs} statuses={statuses} onOpenJob={setSelectedJob} />
          </div>
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
          customers={customers}
          userId={session.user.id}
          onClose={() => setShowNewJob(false)}
          onCreated={() => {
            setShowNewJob(false);
            loadAll();
          }}
        />
      )}

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={() => {
            setShowNewCustomer(false);
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

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          jobs={jobs.filter((j) => j.customer_id === selectedCustomer.id)}
          statuses={statuses}
          onClose={() => setSelectedCustomer(null)}
          onOpenJob={(job) => {
            setSelectedCustomer(null);
            setSelectedJob(job);
          }}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}
