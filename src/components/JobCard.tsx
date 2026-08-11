import type { Job } from "../supabaseClient";

export type JobCounts = {
  checklistTotal: number;
  checklistDone: number;
  fileCount: number;
};

function dueDatePillClass(dueDate: string | null, status: string) {
  if (!dueDate || status === "Complete" || status === "Invoiced") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "due-soon";
  return null;
}

export default function JobCard({
  job,
  counts,
  onOpen,
  onDragStart,
  dragging,
}: {
  job: Job;
  counts?: JobCounts;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  dragging: boolean;
}) {
  const duePillClass = dueDatePillClass(job.due_date, job.status);

  return (
    <button
      className={`job-card${dragging ? " dragging" : ""}`}
      onClick={onOpen}
      draggable
      onDragStart={onDragStart}
    >
      <div className="job-card-title">
        {job.job_number ? `#${job.job_number} — ` : ""}
        {job.name}
      </div>
      {job.client && <div className="muted">{job.client}</div>}
      {job.address && <div className="muted">{job.address}</div>}

      <div className="job-card-meta-row">
        <div className="job-card-pills">
          {counts && counts.checklistTotal > 0 && (
            <span
              className={`pill${
                counts.checklistDone === counts.checklistTotal ? " progress-done" : ""
              }`}
            >
              ✓ {counts.checklistDone}/{counts.checklistTotal}
            </span>
          )}
          {counts && counts.fileCount > 0 && <span className="pill">📎 {counts.fileCount}</span>}
          {job.due_date && (
            <span className={`pill${duePillClass ? ` ${duePillClass}` : ""}`}>
              Due {job.due_date}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
