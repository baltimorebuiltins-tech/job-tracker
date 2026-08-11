import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import Board from "./pages/Board";
import CustomerSharePage from "./pages/CustomerSharePage";

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="center-screen">Loading…</div>;
  }

  return session ? <Board session={session} /> : <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/share/:token" element={<CustomerSharePage />} />
      <Route path="*" element={<AuthGate />} />
    </Routes>
  );
}
