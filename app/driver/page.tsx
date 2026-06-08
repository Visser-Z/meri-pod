"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  MapPin, Package, CheckCircle2, Clock, AlertTriangle,
  LogOut, Inbox, ChevronRight, Loader2, Bell, User,
  Navigation, FileText, Pen
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
  destination: string;
  status: string;
  confidence: number;
  delivered_at: string;
  amount: string;
  driver: string;
  issues: string[];
}

interface Profile {
  full_name: string;
  company_id: string;
}

type Screen = "home" | "tasks" | "profile";

// Seed deliveries for demo
const seedDeliveries: Delivery[] = [
  {
    id: "POD-9001",
    customer: "Cape Fresh Distribution",
    reference: "CFD-55201",
    destination: "Unit 7, Montague Gardens, Cape Town, 7441",
    status: "Pending",
    confidence: 0,
    delivered_at: "2026-06-08 10:00",
    amount: "R6,400",
    driver: "Sipho Mokoena",
    issues: [],
  },
  {
    id: "POD-9002",
    customer: "Winelands Cold Chain",
    reference: "WCC-10298",
    destination: "14 Dorp Street, Stellenbosch, 7600",
    status: "Pending",
    confidence: 0,
    delivered_at: "2026-06-08 13:30",
    amount: "R3,200",
    driver: "Sipho Mokoena",
    issues: [],
  },
];

export default function DriverPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>(seedDeliveries);
  const [screen, setScreen] = useState<Screen>("home");
  const [userId, setUserId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    const { data: prof } = await supabase
      .from("profiles").select("full_name, company_id").eq("id", user.id).single();
    setProfile(prof);

    const { data: taskData } = await supabase
      .from("tasks").select("*").eq("driver_id", user.id).order("created_at", { ascending: false });
    setTasks(taskData || []);

    const { data: deliveryData } = await supabase
      .from("deliveries")
      .select("id, customer, reference, destination, status, confidence, delivered_at, amount, driver, issues")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (deliveryData && deliveryData.length > 0) setDeliveries(deliveryData);
    setLoading(false);
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
  const completedToday = deliveries.filter((d) => d.status === "Archived" || d.status === "Invoice ready").length;

  if (loading) {
    return (
      <div className="driver-app">
        <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 24 }}>M</div>
            <Loader2 size={20} style={{ animation: "spin 600ms linear infinite", color: "var(--accent)" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-app">
      {/* ── Home screen ── */}
      {screen === "home" && (
        <div className="driver-screen">
          {/* Header */}
          <div className="driver-app-header">
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>Good morning,</p>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{profile?.full_name || "Driver"}</h1>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {pendingTasks > 0 && (
                <button className="driver-notif-btn" onClick={() => setScreen("tasks")}>
                  <Bell size={18} />
                  <span className="driver-notif-badge">{pendingTasks}</span>
                </button>
              )}
              <div className="driver-avatar">{(profile?.full_name || "D").charAt(0).toUpperCase()}</div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="driver-stats-strip">
            <div className="driver-stat">
              <span className="driver-stat-value">{deliveries.length}</span>
              <span className="driver-stat-label">Today</span>
            </div>
            <div className="driver-stat-divider" />
            <div className="driver-stat">
              <span className="driver-stat-value">{completedToday}</span>
              <span className="driver-stat-label">Done</span>
            </div>
            <div className="driver-stat-divider" />
            <div className="driver-stat">
              <span className="driver-stat-value" style={{ color: deliveries.length - completedToday > 0 ? "var(--text-warning)" : "var(--text-success)" }}>
                {deliveries.length - completedToday}
              </span>
              <span className="driver-stat-label">Remaining</span>
            </div>
          </div>

          {/* Deliveries list */}
          <div className="driver-section-header">
            <Package size={14} />
            <span>Today&apos;s deliveries</span>
          </div>

          <div className="driver-list">
            {deliveries.map((d, i) => (
              <button
                key={d.id}
                className="driver-delivery-card"
                onClick={() => router.push(`/driver/delivery/${d.id}?customer=${encodeURIComponent(d.customer)}&destination=${encodeURIComponent(d.destination)}&reference=${encodeURIComponent(d.reference)}&amount=${encodeURIComponent(d.amount)}&status=${encodeURIComponent(d.status)}`)}
              >
                <div className="driver-card-number">{i + 1}</div>
                <div className="driver-card-body">
                  <strong>{d.customer}</strong>
                  <span className="driver-card-ref">{d.reference} · {d.amount}</span>
                  <span className="driver-card-dest">
                    <MapPin size={11} />
                    {d.destination}
                  </span>
                  {d.delivered_at && (
                    <span className="driver-card-time">
                      <Clock size={11} />
                      {d.delivered_at}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span className={`pill ${d.status === "Invoice ready" || d.status === "Archived" ? "success" : d.status === "Needs review" ? "warning" : "neutral"}`} style={{ fontSize: 10 }}>
                    {d.status === "Pending" ? "To do" : d.status === "Needs review" ? "Review" : d.status === "Invoice ready" ? "Done" : d.status}
                  </span>
                  <ChevronRight size={16} color="var(--text-subtle)" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tasks screen ── */}
      {screen === "tasks" && !selectedTask && (
        <div className="driver-screen">
          <div className="driver-app-header">
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Tasks</h1>
            <span className="pill warning">{pendingTasks} new</span>
          </div>
          <div className="driver-list">
            {tasks.length === 0 && (
              <div className="driver-empty">
                <Inbox size={32} color="var(--text-subtle)" />
                <strong>No tasks yet</strong>
                <span>Your operator will send tasks here.</span>
              </div>
            )}
            {tasks.map((t) => (
              <button key={t.id} className="driver-task-card" onClick={() => markTaskSeen(t)}>
                <div className={`status-dot ${t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning"}`} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ fontSize: 14, fontWeight: t.status === "pending" ? 700 : 500, display: "block" }}>{t.title}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "block" }}>
                    {new Date(t.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`pill ${t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning"}`} style={{ fontSize: 10 }}>{t.status}</span>
                  <ChevronRight size={14} color="var(--text-subtle)" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task detail */}
      {screen === "tasks" && selectedTask && (
        <div className="driver-screen">
          <div className="driver-app-header">
            <button className="driver-back-btn" onClick={() => setSelectedTask(null)}>← Back</button>
          </div>
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="driver-task-detail-card">
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{selectedTask.title}</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{selectedTask.body}</p>
              {selectedTask.file_url && (
                <a href={selectedTask.file_url} target="_blank" rel="noopener noreferrer" className="driver-attachment-btn">
                  <FileText size={14} /> {selectedTask.file_name || "View attachment"}
                </a>
              )}
            </div>
            {selectedTask.status !== "done" ? (
              <button className="driver-cta-btn" onClick={() => markTaskDone(selectedTask.id)}>
                <CheckCircle2 size={18} /> Mark as done
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", color: "var(--text-success)", fontSize: 14 }}>
                <CheckCircle2 size={16} /> Completed
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Profile screen ── */}
      {screen === "profile" && (
        <div className="driver-screen">
          <div className="driver-app-header">
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Profile</h1>
          </div>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="driver-profile-card">
              <div className="driver-avatar-lg">{(profile?.full_name || "D").charAt(0).toUpperCase()}</div>
              <div>
                <strong style={{ fontSize: 16, fontWeight: 700 }}>{profile?.full_name}</strong>
                <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Driver</span>
              </div>
            </div>
            <div className="driver-stats-card">
              <div className="driver-stats-row">
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Deliveries today</span>
                <strong>{deliveries.length}</strong>
              </div>
              <div className="driver-stats-row">
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Completed</span>
                <strong style={{ color: "var(--text-success)" }}>{completedToday}</strong>
              </div>
              <div className="driver-stats-row">
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Pending tasks</span>
                <strong style={{ color: pendingTasks > 0 ? "var(--text-warning)" : "var(--text-success)" }}>{pendingTasks}</strong>
              </div>
            </div>
            <button className="driver-logout-btn" onClick={handleLogout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <nav className="driver-bottom-nav">
        <button className={`driver-nav-btn ${screen === "home" ? "active" : ""}`} onClick={() => { setScreen("home"); setSelectedTask(null); }}>
          <Package size={20} />
          <span>Deliveries</span>
        </button>
        <button className={`driver-nav-btn ${screen === "tasks" ? "active" : ""}`} onClick={() => { setScreen("tasks"); setSelectedTask(null); }}>
          <div style={{ position: "relative" }}>
            <Inbox size={20} />
            {pendingTasks > 0 && <span className="driver-nav-badge">{pendingTasks}</span>}
          </div>
          <span>Tasks</span>
        </button>
        <button className={`driver-nav-btn ${screen === "profile" ? "active" : ""}`} onClick={() => setScreen("profile")}>
          <User size={20} />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
