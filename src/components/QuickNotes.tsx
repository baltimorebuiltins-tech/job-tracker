import { FormEvent, useEffect, useState } from "react";
import { supabase, QuickNote } from "../supabaseClient";
import type { Session } from "@supabase/supabase-js";

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function QuickNotes({ session }: { session: Session }) {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorEmails, setAuthorEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("quick_notes")
      .select("*")
      .order("created_at", { ascending: false });
    setNotes(data ?? []);

    const ids = Array.from(new Set((data ?? []).map((n) => n.created_by).filter(Boolean))) as string[];
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of profiles ?? []) map[p.id] = p.email;
      setAuthorEmails(map);
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await supabase.from("quick_notes").insert({ text: text.trim(), created_by: session.user.id });
    setText("");
    setBusy(false);
    load();
  }

  async function deleteNote(id: string) {
    await supabase.from("quick_notes").delete().eq("id", id);
    load();
  }

  return (
    <div className="quick-notes">
      <form onSubmit={addNote} className="quick-note-form">
        <textarea
          placeholder="Jot down a quick note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <button type="submit" disabled={busy || !text.trim()}>
          Add note
        </button>
      </form>

      <ul className="quick-note-list">
        {notes.map((note) => (
          <li key={note.id} className="quick-note-item">
            <p>{note.text}</p>
            <div className="quick-note-meta">
              <span className="muted">
                {note.created_by ? authorEmails[note.created_by] ?? "" : ""} · {timeAgo(note.created_at)}
              </span>
              <button className="link-button" onClick={() => deleteNote(note.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {notes.length === 0 && <p className="muted">No notes yet.</p>}
      </ul>
    </div>
  );
}
