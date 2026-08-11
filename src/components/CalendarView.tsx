import { useEffect, useMemo, useState } from "react";
import type { Job, JobStatus } from "../supabaseClient";
import StatusBadge from "./StatusBadge";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 720px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function CalendarView({
  jobs,
  statuses,
  onOpenJob,
}: {
  jobs: Job[];
  statuses: JobStatus[];
  onOpenJob: (job: Job) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const isMobile = useIsMobile();

  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (!job.due_date) continue;
      (map[job.due_date] ??= []).push(job);
    }
    return map;
  }, [jobs]);

  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color ?? "#6b7280";

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = ymd(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const header = (
    <div className="calendar-header">
      <button className="secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}>
        ‹ Prev
      </button>
      <h3>
        {MONTH_NAMES[month]} {year}
      </h3>
      <button className="secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}>
        Next ›
      </button>
    </div>
  );

  if (isMobile) {
    const daysWithJobs = cells
      .filter((d): d is Date => d !== null)
      .map((date) => ({ date, jobs: jobsByDate[ymd(date)] ?? [] }))
      .filter((d) => d.jobs.length > 0);

    return (
      <div className="calendar calendar-agenda">
        {header}
        {daysWithJobs.length === 0 && <p className="muted">No jobs due this month.</p>}
        {daysWithJobs.map(({ date, jobs: dayJobs }) => (
          <div key={ymd(date)} className={`agenda-day${ymd(date) === today ? " is-today" : ""}`}>
            <div className="agenda-day-label">
              {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </div>
            <div className="agenda-day-jobs">
              {dayJobs.map((job) => (
                <button key={job.id} className="agenda-job-row" onClick={() => onOpenJob(job)}>
                  <span
                    className="agenda-job-dot"
                    style={{ backgroundColor: statusColor(job.status) }}
                  />
                  <span className="agenda-job-name">{job.name}</span>
                  <StatusBadge status={job.status} statuses={statuses} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="calendar">
      {header}
      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="calendar-cell calendar-cell-empty" />;
          const key = ymd(date);
          const dayJobs = jobsByDate[key] ?? [];
          return (
            <div key={i} className={`calendar-cell${key === today ? " is-today" : ""}`}>
              <div className="calendar-date">{date.getDate()}</div>
              <div className="calendar-jobs">
                {dayJobs.map((job) => (
                  <button
                    key={job.id}
                    className="calendar-job-chip"
                    style={{ backgroundColor: statusColor(job.status) }}
                    onClick={() => onOpenJob(job)}
                    title={job.name}
                  >
                    {job.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
