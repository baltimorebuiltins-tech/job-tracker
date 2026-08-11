import { useMemo, useState } from "react";
import type { Job } from "../supabaseClient";

function daysUntil(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function RemindersBanner({
  jobs,
  onOpenJob,
}: {
  jobs: Job[];
  onOpenJob: (job: Job) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { overdue, dueSoon } = useMemo(() => {
    const overdue: Job[] = [];
    const dueSoon: Job[] = [];
    for (const job of jobs) {
      if (!job.due_date || job.status === "Complete" || job.status === "Invoiced") continue;
      const diff = daysUntil(job.due_date);
      if (diff < 0) overdue.push(job);
      else if (diff <= 3) dueSoon.push(job);
    }
    return { overdue, dueSoon };
  }, [jobs]);

  const total = overdue.length + dueSoon.length;
  if (total === 0) return null;

  return (
    <div className="reminders-banner">
      <button className="reminders-summary" onClick={() => setExpanded((e) => !e)}>
        <span>
          {overdue.length > 0 && (
            <strong className="reminders-overdue">{overdue.length} overdue</strong>
          )}
          {overdue.length > 0 && dueSoon.length > 0 && " · "}
          {dueSoon.length > 0 && (
            <strong className="reminders-soon">{dueSoon.length} due within 3 days</strong>
          )}
        </span>
        <span className="muted">{expanded ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {expanded && (
        <div className="reminders-list">
          {[...overdue, ...dueSoon].map((job) => {
            const diff = daysUntil(job.due_date!);
            return (
              <button key={job.id} className="reminders-item" onClick={() => onOpenJob(job)}>
                <span>{job.name}</span>
                <span className={diff < 0 ? "reminders-overdue" : "reminders-soon"}>
                  {diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? "Due today" : `Due in ${diff}d`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
