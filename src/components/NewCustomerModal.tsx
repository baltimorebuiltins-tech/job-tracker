import { FormEvent, useState } from "react";
import { supabase } from "../supabaseClient";

export default function NewCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("customers").insert({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New customer</h2>
        <form onSubmit={handleSubmit} className="job-form">
          <label>
            Name *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
