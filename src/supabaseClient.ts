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
  address: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  notes: string | null;
  dropbox_folder_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export type FileCategory = "drawing" | "invoice" | "receipt" | "other";

export const FILE_CATEGORIES: { value: FileCategory; label: string }[] = [
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
  uploaded_by: string | null;
  uploaded_at: string;
};
