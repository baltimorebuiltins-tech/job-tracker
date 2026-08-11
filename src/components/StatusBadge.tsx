import type { JobStatus } from "../supabaseClient";

export default function StatusBadge({
  status,
  statuses,
}: {
  status: string;
  statuses: JobStatus[];
}) {
  const match = statuses.find((s) => s.name === status);
  const color = match?.color ?? "#6b7280";
  return (
    <span className="status-badge" style={{ backgroundColor: color }}>
      {status}
    </span>
  );
}
