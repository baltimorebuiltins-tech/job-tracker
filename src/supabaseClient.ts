import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY environment variables."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Job = {
  id: string;
  job_number: string | null;
  name: string;
  client: string | null;
  customer_id: string | null;
  address: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  notes: string | null;
  dropbox_folder_path: string | null;
  estimate_total: number | null;
  estimate_delivery: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  customer_notes: string | null;
  share_token: string;
  created_at: string;
};

export type PaymentMilestone = "deposit" | "materials" | "install" | "paid_in_full";

export const PAYMENT_MILESTONES: { value: PaymentMilestone; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "materials", label: "Materials / Production" },
  { value: "install", label: "Install" },
  { value: "paid_in_full", label: "Paid in Full" },
];

export type JobPayment = {
  id: string;
  job_id: string;
  milestone: PaymentMilestone;
  amount: number | null;
  is_paid: boolean;
  paid_date: string | null;
};

export type JobStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type ChecklistItem = {
  id: string;
  job_id: string;
  text: string;
  is_done: boolean;
  position: number;
  created_at: string;
};

export type FileCategory = "drawing" | "invoice" | "receipt" | "estimate" | "other";

export const FILE_CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: "estimate", label: "Estimate" },
  { value: "drawing", label: "Drawing" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];

export type JobFile = {
  id: string;
  job_id: string;
  file_name: string;
  dropbox_path: string;
  dropbox_shared_link: string | null;
  size_bytes: number | null;
  category: FileCategory;
  note: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type EstimateRoom = {
  id: string;
  job_id: string;
  room_name: string;
  detail: string | null;
  price: number;
  position: number;
  created_at: string;
};

export type Invoice = {
  id: string;
  job_id: string;
  invoice_number: string;
  delivery: number;
  total: number;
  created_by: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  item_name: string;
  detail: string | null;
  price: number;
  position: number;
  created_at: string;
};

export type Role = "admin" | "member";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export type QuickNote = {
  id: string;
  text: string;
  created_by: string | null;
  created_at: string;
};
