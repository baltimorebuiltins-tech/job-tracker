import { useState } from "react";
import { supabase } from "../supabaseClient";

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"];
const PDF_EXT = ["pdf"];

function extOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function rawUrl(sharedLink: string | null) {
  if (!sharedLink) return null;
  if (sharedLink.includes("dl=0")) return sharedLink.replace("dl=0", "raw=1");
  if (sharedLink.includes("raw=1")) return sharedLink;
  return sharedLink + (sharedLink.includes("?") ? "&raw=1" : "?raw=1");
}

export type FileThumbFile = {
  id?: string;
  file_name: string;
  dropbox_path?: string;
  dropbox_shared_link: string | null;
  note?: string | null;
};

export default function FileThumb({
  file,
  editable,
  onDeleted,
  onNoteChanged,
}: {
  file: FileThumbFile;
  editable: boolean;
  onDeleted?: () => void;
  onNoteChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(file.note ?? "");
  const [deleting, setDeleting] = useState(false);

  const ext = extOf(file.file_name);
  const isImage = IMAGE_EXT.includes(ext);
  const isPdf = PDF_EXT.includes(ext);
  const preview = rawUrl(file.dropbox_shared_link);

  async function saveNote() {
    if (!file.id) return;
    await supabase.from("job_files").update({ note: note || null }).eq("id", file.id);
    onNoteChanged?.();
  }

  async function handleDelete() {
    if (!file.id) return;
    if (!confirm(`Delete "${file.file_name}"? This removes it from Dropbox too.`)) return;
    setDeleting(true);
    try {
      if (file.dropbox_path) {
        await fetch("/api/dropbox-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: file.dropbox_path }),
        });
      }
      await supabase.from("job_files").delete().eq("id", file.id);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="file-thumb-card">
        <button
          className="file-thumb"
          onClick={() => (isImage || isPdf ? setOpen(true) : window.open(file.dropbox_shared_link ?? "#", "_blank"))}
        >
          {isImage && preview ? (
            <img src={preview} alt={file.file_name} loading="lazy" />
          ) : (
            <span className="file-thumb-icon">{ext ? ext.toUpperCase() : "FILE"}</span>
          )}
        </button>
        <div className="file-thumb-name" title={file.file_name}>
          {file.file_name}
        </div>
        {editable ? (
          <input
            className="file-thumb-note"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
          />
        ) : (
          file.note && <div className="file-thumb-note-static">{file.note}</div>
        )}
        {editable && (
          <button className="link-button file-thumb-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal modal-wide lightbox-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{file.file_name}</h2>
            </div>
            <div className="lightbox-body">
              {isImage && preview && <img src={preview} alt={file.file_name} />}
              {isPdf && preview && <iframe src={preview} title={file.file_name} />}
            </div>
            <div className="modal-actions">
              {file.dropbox_shared_link && (
                <a
                  className="secondary-link-btn"
                  href={file.dropbox_shared_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Dropbox
                </a>
              )}
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
