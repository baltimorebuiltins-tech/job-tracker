import { useMemo, useState } from "react";
import type { Job, JobStatus } from "../supabaseClient";

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

  return (
    <div className="calendar">
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
