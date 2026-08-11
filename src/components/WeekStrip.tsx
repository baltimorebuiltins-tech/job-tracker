import { useMemo, useState } from "react";
import type { Job, JobStatus } from "../supabaseClient";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export default function WeekStrip({
  jobs,
  statuses,
  onOpenJob,
}: {
  jobs: Job[];
  statuses: JobStatus[];
  onOpenJob: (job: Job) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const today = ymd(new Date());

  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (!job.due_date) continue;
      (map[job.due_date] ??= []).push(job);
    }
    return map;
  }, [jobs]);

  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color ?? "#6b7280";

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const isCurrentWeek = ymd(weekStart) === ymd(startOfWeek(new Date()));
  const weekEnd = days[6];
  const rangeLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.getDate()}`
      : `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="week-strip">
      <div className="week-strip-header">
        <div className="week-strip-title">
          <h3>{isCurrentWeek ? "This Week" : rangeLabel}</h3>
          {!isCurrentWeek && <span className="muted">{rangeLabel}</span>}
        </div>
        <div className="week-strip-nav">
          <button
            className="secondary"
            onClick={() => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7))}
          >
            ‹
          </button>
          {!isCurrentWeek && (
            <button className="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Today
            </button>
          )}
          <button
            className="secondary"
            onClick={() => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7))}
          >
            ›
          </button>
        </div>
      </div>
      <div className="week-strip-days">
        {days.map((date) => {
          const key = ymd(date);
          const dayJobs = jobsByDate[key] ?? [];
          return (
            <div key={key} className={`week-strip-day${key === today ? " is-today" : ""}`}>
              <div className="week-strip-day-label">
                {DAY_LABELS[date.getDay()]} <span>{date.getDate()}</span>
              </div>
              <div className="week-strip-jobs">
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
