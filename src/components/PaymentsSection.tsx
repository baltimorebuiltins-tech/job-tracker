import { useEffect, useState } from "react";
import { supabase, JobPayment, PAYMENT_MILESTONES } from "../supabaseClient";

export default function PaymentsSection({ jobId }: { jobId: string }) {
  const [payments, setPayments] = useState<JobPayment[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function load() {
    const { data } = await supabase
      .from("job_payments")
      .select("*")
      .eq("job_id", jobId);
    setPayments(data ?? []);
  }

  async function togglePaid(payment: JobPayment) {
    const isPaid = !payment.is_paid;
    await supabase
      .from("job_payments")
      .update({ is_paid: isPaid, paid_date: isPaid ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", payment.id);
    load();
  }

  async function updateAmount(payment: JobPayment, amount: string) {
    const value = amount === "" ? null : Number(amount);
    setPayments((prev) => prev.map((p) => (p.id === payment.id ? { ...p, amount: value } : p)));
    await supabase.from("job_payments").update({ amount: value }).eq("id", payment.id);
  }

  const total = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const paidTotal = payments.filter((p) => p.is_paid).reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return (
    <div className="job-section">
      <label>Payments</label>
      <ul className="payments-list">
        {PAYMENT_MILESTONES.map(({ value, label }) => {
          const payment = payments.find((p) => p.milestone === value);
          if (!payment) return null;
          return (
            <li key={payment.id} className="payment-row">
              <label className="checklist-row">
                <input
                  type="checkbox"
                  checked={payment.is_paid}
                  onChange={() => togglePaid(payment)}
                />
                <span className={payment.is_paid ? "done" : ""}>{label}</span>
              </label>
              <div className="payment-row-right">
                <span className="payment-currency">$</span>
                <input
                  type="number"
                  className="payment-amount-input"
                  placeholder="0.00"
                  value={payment.amount ?? ""}
                  onChange={(e) => updateAmount(payment, e.target.value)}
                />
                {payment.is_paid && payment.paid_date && (
                  <span className="muted payment-date">
                    {new Date(payment.paid_date + "T00:00:00").toLocaleDateString()}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {total > 0 && (
        <p className="muted payment-total">
          ${paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} of $
          {total.toLocaleString(undefined, { minimumFractionDigits: 2 })} collected
        </p>
      )}
    </div>
  );
}
