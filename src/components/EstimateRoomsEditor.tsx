import { useEffect, useState } from "react";
import { supabase, Job, EstimateRoom } from "../supabaseClient";
import { generateEstimatePdfBase64 } from "../lib/estimate";

export default function EstimateRoomsEditor({
  job,
  userId,
  version,
  onTotalChanged,
}: {
  job: Job;
  userId: string;
  version: number;
  onTotalChanged: () => void;
}) {
  const [rooms, setRooms] = useState<EstimateRoom[]>([]);
  const [delivery, setDelivery] = useState<string>(job.estimate_delivery?.toString() ?? "0");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateMsg, setRegenerateMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, version]);

  async function loadRooms() {
    const [{ data: roomData }, { data: jobData }] = await Promise.all([
      supabase
        .from("estimate_rooms")
        .select("*")
        .eq("job_id", job.id)
        .order("position", { ascending: true }),
      supabase.from("jobs").select("estimate_delivery").eq("id", job.id).single(),
    ]);
    setRooms(roomData ?? []);
    setDelivery(jobData?.estimate_delivery?.toString() ?? "0");
  }

  async function recalcAndSaveTotal(nextRooms: EstimateRoom[], deliveryValue: number) {
    const total = nextRooms.reduce((sum, r) => sum + (r.price ?? 0), 0) + deliveryValue;
    await supabase
      .from("jobs")
      .update({ estimate_total: total, estimate_delivery: deliveryValue })
      .eq("id", job.id);
    onTotalChanged();
  }

  function updateLocalField(id: string, field: "room_name" | "detail", value: string) {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function updateLocalPrice(id: string, value: string) {
    const price = value === "" ? 0 : Number(value);
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, price } : r)));
  }

  async function saveRoom(room: EstimateRoom) {
    await supabase
      .from("estimate_rooms")
      .update({ room_name: room.room_name, detail: room.detail, price: room.price })
      .eq("id", room.id);
    await recalcAndSaveTotal(rooms, Number(delivery) || 0);
  }

  async function addRoom() {
    const { data, error: insertErr } = await supabase
      .from("estimate_rooms")
      .insert({ job_id: job.id, room_name: "New room", detail: "", price: 0, position: rooms.length })
      .select()
      .single();
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setRooms((prev) => [...prev, data as EstimateRoom]);
  }

  async function deleteRoom(room: EstimateRoom) {
    await supabase.from("estimate_rooms").delete().eq("id", room.id);
    const nextRooms = rooms.filter((r) => r.id !== room.id);
    setRooms(nextRooms);
    await recalcAndSaveTotal(nextRooms, Number(delivery) || 0);
  }

  async function saveDelivery() {
    const deliveryValue = Number(delivery) || 0;
    await recalcAndSaveTotal(rooms, deliveryValue);
  }

  async function regeneratePdf() {
    setRegenerating(true);
    setRegenerateMsg(null);
    setError(null);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();
      const preparedBy = profile?.full_name || profile?.email || "";

      const deliveryValue = Number(delivery) || 0;
      const { base64 } = await generateEstimatePdfBase64({
        customerName: job.client ?? "",
        estimateNumber: job.job_number ?? job.id.slice(0, 6),
        date: new Date().toLocaleDateString(),
        rooms: rooms.map((r) => ({ roomName: r.room_name, detail: r.detail ?? "", price: r.price })),
        delivery: deliveryValue,
        preparedBy,
      });

      const pdfFileName = `Estimate #${job.job_number ?? ""}.pdf`.replace(/\s+/g, " ");
      const basePath = job.dropbox_folder_path || `/${job.name}`;

      const res = await fetch("/api/dropbox-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `${basePath}/Estimates`,
          fileName: pdfFileName,
          fileBase64: base64,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      const result = await res.json();

      await supabase.from("job_files").insert({
        job_id: job.id,
        file_name: pdfFileName,
        dropbox_path: result.dropboxPath,
        dropbox_shared_link: result.sharedLink,
        size_bytes: result.sizeBytes,
        category: "estimate",
        uploaded_by: userId,
      });

      setRegenerateMsg("Estimate PDF regenerated and synced to Dropbox.");
      onTotalChanged();
    } catch (err: any) {
      setError(err.message ?? "Couldn't regenerate the PDF.");
    } finally {
      setRegenerating(false);
    }
  }

  const roomsTotal = rooms.reduce((sum, r) => sum + (r.price ?? 0), 0);
  const total = roomsTotal + (Number(delivery) || 0);

  if (rooms.length === 0) return null;

  return (
    <div className="estimate-rooms">
      <div className="estimate-rooms-header">
        <span>Room</span>
        <span>Color / Finish</span>
        <span>Price</span>
        <span />
      </div>
      {rooms.map((room) => (
        <div key={room.id} className="estimate-rooms-row">
          <input
            type="text"
            value={room.room_name}
            onChange={(e) => updateLocalField(room.id, "room_name", e.target.value)}
            onBlur={() => saveRoom(rooms.find((r) => r.id === room.id)!)}
          />
          <input
            type="text"
            value={room.detail ?? ""}
            onChange={(e) => updateLocalField(room.id, "detail", e.target.value)}
            onBlur={() => saveRoom(rooms.find((r) => r.id === room.id)!)}
          />
          <div className="estimate-price-input">
            <span className="payment-currency">$</span>
            <input
              type="number"
              className="payment-amount-input"
              value={room.price}
              onChange={(e) => updateLocalPrice(room.id, e.target.value)}
              onBlur={() => saveRoom(rooms.find((r) => r.id === room.id)!)}
            />
          </div>
          <button type="button" className="link-button" onClick={() => deleteRoom(room)}>
            Remove
          </button>
        </div>
      ))}

      <div className="estimate-rooms-row estimate-delivery-row">
        <span className="estimate-delivery-label">Delivery</span>
        <span />
        <div className="estimate-price-input">
          <span className="payment-currency">$</span>
          <input
            type="number"
            className="payment-amount-input"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            onBlur={saveDelivery}
          />
        </div>
        <span />
      </div>

      <div className="estimate-rooms-actions">
        <button type="button" onClick={addRoom}>
          + Add room
        </button>
        <p className="estimate-grand-total">
          Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="estimate-rooms-actions">
        <button type="button" onClick={regeneratePdf} disabled={regenerating}>
          {regenerating ? "Regenerating…" : "Regenerate estimate PDF"}
        </button>
      </div>
      {regenerateMsg && <p className="notice-text">{regenerateMsg}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
