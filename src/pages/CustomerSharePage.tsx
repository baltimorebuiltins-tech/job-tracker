import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

type ShareInfo = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  customer_notes: string | null;
};

type ShareDrawing = {
  job_name: string;
  file_name: string;
  dropbox_shared_link: string | null;
  uploaded_at: string;
};

export default function CustomerSharePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [drawings, setDrawings] = useState<ShareDrawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    void load(token);
  }, [token]);

  async function load(t: string) {
    setLoading(true);
    const [{ data: infoData }, { data: drawingData }] = await Promise.all([
      supabase.rpc("get_customer_share_info", { p_token: t }),
      supabase.rpc("get_customer_share_drawings", { p_token: t }),
    ]);
    const first = infoData?.[0] ?? null;
    if (!first) {
      setNotFound(true);
    } else {
      setInfo(first);
      setDrawings(drawingData ?? []);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="center-screen">Loading…</div>;
  }

  if (notFound || !info) {
    return (
      <div className="center-screen">
        <p className="muted">This link isn't valid. Please check with Baltimore Built-Ins.</p>
      </div>
    );
  }

  const drawingsByJob = drawings.reduce<Record<string, ShareDrawing[]>>((acc, d) => {
    (acc[d.job_name] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="share-page">
      <header className="share-header">
        <img src="/logo.png" alt="Baltimore Built-Ins" className="share-logo" />
      </header>

      <div className="share-content">
        <h1>{info.name}</h1>
        <div className="share-contact">
          {info.address && <p>{info.address}</p>}
          {info.phone && <p>{info.phone}</p>}
          {info.email && <p>{info.email}</p>}
        </div>

        {info.customer_notes && (
          <div className="share-section">
            <h2>Notes</h2>
            <p className="share-notes">{info.customer_notes}</p>
          </div>
        )}

        <div className="share-section">
          <h2>Drawings</h2>
          {Object.keys(drawingsByJob).length === 0 && (
            <p className="muted">No drawings have been shared yet.</p>
          )}
          {Object.entries(drawingsByJob).map(([jobName, files]) => (
            <div key={jobName} className="share-job-group">
              <h3>{jobName}</h3>
              <ul className="file-list">
                {files.map((f, i) => (
                  <li key={i}>
                    {f.dropbox_shared_link ? (
                      <a href={f.dropbox_shared_link} target="_blank" rel="noreferrer">
                        {f.file_name}
                      </a>
                    ) : (
                      <span>{f.file_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
