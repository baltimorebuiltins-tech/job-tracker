import type { Config } from "@netlify/functions";

function icsEscape(text: string) {
  return text.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

function toIcsDate(dateStr: string) {
  return dateStr.replace(/-/g, "");
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const anonKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return new Response("Server not configured", { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_calendar_feed`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token }),
  });

  if (!res.ok) {
    return new Response("Failed to load jobs", { status: 502 });
  }

  const jobs: {
    job_number: string | null;
    name: string;
    status: string;
    client: string | null;
    address: string | null;
    due_date: string;
  }[] = await res.json();

  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";

  const events = jobs
    .map((job) => {
      const summary = icsEscape(
        `${job.job_number ? `#${job.job_number} ` : ""}${job.name} — ${job.status}`
      );
      const descriptionParts = [job.client, job.address].filter(Boolean);
      const description = icsEscape(descriptionParts.join(" · "));
      const dueDate = toIcsDate(job.due_date);
      return [
        "BEGIN:VEVENT",
        `UID:${job.job_number ?? job.name}-${job.due_date}@baltimore-builtins-job-tracker`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dueDate}`,
        `DTEND;VALUE=DATE:${dueDate}`,
        `SUMMARY:${summary}`,
        description ? `DESCRIPTION:${description}` : "",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    })
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Baltimore Built-Ins//Job Tracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Baltimore Built-Ins Job Tracker",
    events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="job-tracker.ics"',
    },
  });
};

export const config: Config = {
  path: "/api/calendar.ics",
};
