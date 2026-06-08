"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Upload, CheckCircle2, Clock, AlertTriangle,
  LogOut, Inbox, FileText, ChevronRight, Loader2
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  body: string;
  status: "pending" | "seen" | "done";
  file_url?: string;
  file_name?: string;
  created_at: string;
}

interface Delivery {
  id: string;
  customer: string;
  reference: string;
  status: string;
  confidence: number;
  delivered_at: string;
  amount: string;
}

interface Profile {
  full_name: string;
  company_id: string;
}

export default function DriverPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tab, setTab] = useState<"upload" | "deliveries" | "tasks">("upload");
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, company_id")
      .eq("id", user.id)
      .single();
    setProfile(prof);

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false });
    setTasks(taskData || []);

    const { data: deliveryData } = await supabase
      .from("deliveries")
      .select("id, customer, reference, status, confidence, delivered_at, amount")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setDeliveries(deliveryData || []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("driver_id", userId);

      const res = await fetch("/api/pod/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");

      const result = await res.json();
      setDeliveries((prev) => [result, ...prev]);
      setTab("deliveries");
    } catch (err) {
      alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function markTaskSeen(task: Task) {
    if (task.status === "pending") {
      await supabase.from("tasks").update({ status: "seen" }).eq("id", task.id);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "seen" } : t));
    }
    setSelectedTask(task);
  }

  async function markTaskDone(taskId: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "done" } : t));
    setSelectedTask(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending").length;

  return (
    <div className="driver-shell">
      {/* Header */}
      <header className="driver-header">
        <div className="brand" style={{ marginBottom: 0 }}>
          <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 14 }}>M</div>
          <div>
            <strong style={{ fontSize: 13 }}>Meri AI</strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{profile?.full_name || "Driver"}</span>
          </div>
        </div>
        <button className="icon-button" onClick={handleLogout}><LogOut size={15} /></button>
      </header>

      {/* Tab bar */}
      <nav className="driver-tabs">
        {[
          { id: "upload", label: "Upload", icon: Upload },
          { id: "deliveries", label: "My PODs", icon: FileText },
          { id: "tasks", label: "Tasks", icon: Inbox, badge: pendingTasks },
        ].map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            className={`driver-tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id as typeof tab)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {badge ? <span className="driver-tab-badge">{badge}</span> : null}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="driver-content">
        {/* Upload tab */}
        {tab === "upload" && (
          <div className="driver-upload-area">
            <div className="driver-upload-card">
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Upload POD</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, textAlign: "center" }}>
                Take a photo or upload a PDF of the signed proof of delivery
              </p>
              <label className="upload-button" style={{ height: 48, fontSize: 15, padding: "0 32px" }}>
                {uploading
                  ? <><Loader2 size={16} className="spin" /> Processing…</>
                  : <><Upload size={16} /> Upload POD</>
                }
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                  onChange={handleUpload}
                  disabled={uploading}
                  capture="environment"
                />
              </label>
              <p style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 12 }}>
                PDF, JPG, PNG, WebP — max 20MB
              </p>
            </div>
          </div>
        )}

        {/* Deliveries tab */}
        {tab === "deliveries" && (
          <div className="col-body" style={{ padding: 16 }}>
            {deliveries.length === 0 && (
              <div className="empty-state">
                <strong>No deliveries yet</strong>
                <span>Upload your first POD to get started.</span>
              </div>
            )}
            {deliveries.map((d) => (
              <div key={d.id} className="driver-delivery-row">
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14, fontWeight: 600 }}>{d.customer}</strong>
                  <small style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {d.id} · {d.reference}
                  </small>
                  <small style={{ display: "block", fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>
                    {d.delivered_at}
                  </small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`pill ${d.status === "Invoice ready" ? "success" : d.status === "Archived" ? "neutral" : "warning"}`}>
                    {d.status === "Needs review" ? "Review" : d.status === "Invoice ready" ? "Invoice" : "Archived"}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{d.amount}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tasks tab */}
        {tab === "tasks" && !selectedTask && (
          <div className="col-body" style={{ padding: 16 }}>
            {tasks.length === 0 && (
              <div className="empty-state">
                <strong>No tasks</strong>
                <span>Your operator will send tasks here.</span>
              </div>
            )}
            {tasks.map((t) => (
              <button key={t.id} className="driver-task-row" onClick={() => markTaskSeen(t)}>
                <div className={`status-dot ${t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning"}`} style={{ marginTop: 6 }} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ fontSize: 14, fontWeight: t.status === "pending" ? 700 : 500 }}>{t.title}</strong>
                  <small style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(t.created_at).toLocaleDateString("en-ZA")}
                  </small>
                </div>
                <span className={`pill ${t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning"}`}>
                  {t.status}
                </span>
                <ChevronRight size={14} color="var(--text-muted)" />
              </button>
            ))}
          </div>
        )}

        {/* Task detail */}
        {tab === "tasks" && selectedTask && (
          <div className="col-body" style={{ padding: 16, gap: 16 }}>
            <button className="secondary-button" style={{ alignSelf: "flex-start" }} onClick={() => setSelectedTask(null)}>
              ← Back
            </button>
            <div style={{ padding: 16, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{selectedTask.title}</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{selectedTask.body}</p>
              {selectedTask.file_url && (
                <a
                  href={selectedTask.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary-button"
                  style={{ display: "inline-flex", marginTop: 12, textDecoration: "none" }}
                >
                  <FileText size={14} /> {selectedTask.file_name || "View attachment"}
                </a>
              )}
            </div>
            {selectedTask.status !== "done" && (
              <button className="primary-button" style={{ height: 44 }} onClick={() => markTaskDone(selectedTask.id)}>
                <CheckCircle2 size={16} /> Mark as done
              </button>
            )}
            {selectedTask.status === "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-success)", fontSize: 13 }}>
                <CheckCircle2 size={16} /> Completed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
