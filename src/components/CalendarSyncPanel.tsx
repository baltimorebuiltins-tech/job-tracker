import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function CalendarSyncPanel() {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase.from("calendar_tokens").select("token").limit(1).single();
    if (data?.token) {
      setFeedUrl(`${window.location.origin}/api/calendar.ics?token=${data.token}`);
    }
  }

  async function copy() {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="calendar-sync">
      <button className="secondary" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Sync to Google Calendar"}
      </button>
      {open && feedUrl && (
        <div className="calendar-sync-panel">
          <p className="muted">
            In Google Calendar: <strong>Other calendars +</strong> → <strong>From URL</strong> →
            paste this link. Jobs with a due date will show up automatically (Google refreshes it
            every few hours).
          </p>
          <div className="calendar-sync-row">
            <input readOnly value={feedUrl} onFocus={(e) => e.target.select()} />
            <button onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
