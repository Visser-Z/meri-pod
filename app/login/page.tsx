"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Get role and redirect
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "driver") {
      router.push("/driver");
    } else {
      router.push("/operator");
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 20 }}>M</div>
          <div>
            <strong style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Meri AI</strong>
            <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>POD Intelligence</span>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="field" style={{ gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="field" style={{ gap: 6 }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div style={{ fontSize: 12, color: "var(--text-danger)", padding: "8px 12px", background: "var(--bg-exception)", border: "1px solid rgba(248,81,73,0.3)", borderRadius: "var(--radius)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            style={{ height: 40, marginTop: 4, fontSize: 14 }}
            disabled={loading}
          >
            {loading ? <><Loader2 size={14} className="spin" /> Signing in…</> : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
