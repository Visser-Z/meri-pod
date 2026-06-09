"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Package, Inbox, User, ChevronRight, Bell,
  MapPin, Clock, CheckCircle2, Loader2, LogOut
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
  delivered_at: string;
  amount: string;
  issues: string[];
}

interface Profile {
  full_name: string;
  company_id: string;
}

type Screen = "home" | "tasks" | "profile";

const seedDeliveries: Delivery[] = [
  {
    id: "POD-9001", customer: "Cape Fresh Distribution", reference: "CFD-55201",
    destination: "Unit 7, Montague Gardens, Cape Town, 7441",
    status: "Pending", delivered_at: "10:00", amount: "R6,400", issues: [],
  },
  {
    id: "POD-9002", customer: "Winelands Cold Chain", reference: "WCC-10298",
    destination: "14 Dorp Street, Stellenbosch, 7600",
    status: "Pending", delivered_at: "13:30", amount: "R3,200", issues: [],
  },
];

const S = {
  app: { display: "flex", flexDirection: "column" as const, height: "100dvh", maxWidth: 430, margin: "0 auto", background: "#0d1117", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased", position: "relative" as const, overflow: "hidden" },
  screen: { flex: 1, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, paddingBottom: 80 },
  header: { padding: "52px 20px 16px", background: "#010409" },
  greeting: { fontSize: 13, color: "#8b949e", marginBottom: 2 },
  name: { fontSize: 24, fontWeight: 700, color: "#e6edf3", letterSpacing: "-0.02em" },
  statsRow: { display: "flex", margin: "0 20px 24px", background: "#161b22", border: "1px solid #30363d", borderRadius: 14, overflow: "hidden" },
  stat: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "14px 8px", gap: 3 },
  statVal: { fontSize: 26, fontWeight: 700, color: "#e6edf3", letterSpacing: "-0.03em", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#8b949e", fontWeight: 500 },
  statDivider: { width: 1, background: "#30363d", alignSelf: "stretch", margin: "10px 0" },
  sectionLabel: { display: "flex", alignItems: "center", gap: 6, padding: "0 20px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#8b949e" },
  list: { display: "flex", flexDirection: "column" as const, gap: 10, padding: "0 20px" },
  card: { display: "flex", alignItems: "flex-start", gap: 14, padding: 16, background: "#161b22", border: "1px solid #30363d", borderRadius: 16, textAlign: "left" as const, width: "100%", cursor: "pointer" },
  cardNum: { width: 32, height: 32, borderRadius: "50%", background: "#1a2600", color: "#c8ff00", fontSize: 14, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 },
  cardBody: { flex: 1, display: "flex", flexDirection: "column" as const, gap: 4 },
  cardName: { fontSize: 15, fontWeight: 600, color: "#e6edf3" },
  cardRef: { fontSize: 12, color: "#8b949e" },
  cardAddr: { display: "flex", alignItems: "flex-start", gap: 4, fontSize: 12, color: "#8b949e" },
  cardTime: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#484f58" },
  pill: (tone: string) => ({
    display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px",
    borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const,
    background: tone === "success" ? "#0d2818" : tone === "warning" ? "#2d1a0e" : "#1c2129",
    color: tone === "success" ? "#3fb950" : tone === "warning" ? "#f0883e" : "#8b949e",
  }),
  bottomNav: { position: "fixed" as const, bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, display: "flex", background: "#010409", borderTop: "1px solid #30363d", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 20 },
  navBtn: (active: boolean) => ({ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3, padding: "10px 4px", background: "none", border: "none", color: active ? "#c8ff00" : "#484f58", fontSize: 10, fontWeight: 500, cursor: "pointer" }),
  taskCard: { display: "flex", alignItems: "center", gap: 12, padding: 16, background: "#161b22", border: "1px solid #30363d", borderRadius: 16, textAlign: "left" as const, width: "100%", cursor: "pointer" },
  profileCard: { margin: "0 20px 12px", padding: 16, background: "#161b22", border: "1px solid #30363d", borderRadius: 16, display: "flex", alignItems: "center", gap: 14 },
  statsCard: { margin: "0 20px 12px", background: "#161b22", border: "1px solid #30363d", borderRadius: 16, overflow: "hidden" },
  statsRow2: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #30363d", fontSize: 14 },
  logoutBtn: { margin: "0 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 14, background: "#1a0e0e", border: "1px solid rgba(248,81,73,0.3)", color: "#f85149", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  avatar: (size: number, fontSize: number) => ({ width: size, height: size, borderRadius: "50%", background: "#c8ff00", color: "#000", fontSize, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }),
};

export default function DriverPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>(seedDeliveries);
  const [screen, setScreen] = useState<Screen>("home");
  const [userId, setUserId] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);
    const { data: prof } = await supabase.from("profiles").select("full_name, company_id").eq("id", user.id).single();
    setProfile(prof);
    const { data: taskData } = await supabase.from("tasks").select("*").eq("driver_id", user.id).order("created_at", { ascending: false });
    setTasks(taskData || []);
    const { data: deliveryData } = await supabase.from("deliveries").select("id, customer, reference, destination, status, delivered_at, amount, issues").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (deliveryData && deliveryData.length > 0) setDeliveries(deliveryData);
    setLoading(false);
  }

  async function markTaskSeen(task: Task) {
    if (task.status === "pending") {
      await supabase.from("tasks").update({ status: "seen" }).eq("id", task.id);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "seen" as const } : t));
    }
    setSelectedTask(task);
  }

  async function markTaskDone(taskId: string) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "done" as const } : t));
    setSelectedTask(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const completedToday = deliveries.filter(d => d.status === "Archived" || d.status === "Invoice ready").length;
  const firstName = profile?.full_name?.split(" ")[0] || "Driver";

  if (loading) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
      <div style={S.avatar(56, 24)}>M</div>
      <Loader2 size={20} style={{ marginTop: 16, color: "#c8ff00", animation: "spin 600ms linear infinite" }} />
    </div>
  );

  return (
    <div style={S.app}>
      {/* Home */}
      {screen === "home" && (
        <div style={S.screen}>
          <div style={{ ...S.header, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={S.greeting}>Good day,</p>
              <h1 style={S.name}>{firstName}</h1>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              {pendingTasks > 0 && (
                <button onClick={() => setScreen("tasks")} style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: "#161b22", border: "1px solid #30363d", display: "grid", placeItems: "center", cursor: "pointer", color: "#8b949e" }}>
                  <Bell size={16} />
                  <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999, background: "#f0883e", color: "#000", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px" }}>{pendingTasks}</span>
                </button>
              )}
              <div style={S.avatar(36, 16)}>{firstName.charAt(0).toUpperCase()}</div>
            </div>
          </div>

          {/* Stats */}
          <div style={S.statsRow}>
            <div style={S.stat}>
              <span style={S.statVal}>{deliveries.length}</span>
              <span style={S.statLabel}>Today</span>
            </div>
            <div style={S.statDivider} />
            <div style={S.stat}>
              <span style={S.statVal}>{completedToday}</span>
              <span style={S.statLabel}>Done</span>
            </div>
            <div style={S.statDivider} />
            <div style={S.stat}>
              <span style={{ ...S.statVal, color: deliveries.length - completedToday > 0 ? "#f0883e" : "#3fb950" }}>{deliveries.length - completedToday}</span>
              <span style={S.statLabel}>Left</span>
            </div>
          </div>

          <div style={S.sectionLabel}><Package size={13} /> Today&apos;s deliveries</div>

          <div style={S.list}>
            {deliveries.map((d, i) => (
              <button key={d.id} style={S.card}
                onClick={() => router.push(`/driver/delivery/${d.id}?customer=${encodeURIComponent(d.customer)}&destination=${encodeURIComponent(d.destination)}&reference=${encodeURIComponent(d.reference)}&amount=${encodeURIComponent(d.amount)}&status=${encodeURIComponent(d.status)}`)}>
                <div style={S.cardNum}>{i + 1}</div>
                <div style={S.cardBody}>
                  <span style={S.cardName}>{d.customer}</span>
                  <span style={S.cardRef}>{d.reference} · {d.amount}</span>
                  <span style={S.cardAddr}><MapPin size={11} style={{ flexShrink: 0, marginTop: 1 }} />{d.destination}</span>
                  <span style={S.cardTime}><Clock size={11} />{d.delivered_at}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                  <span style={S.pill(d.status === "Invoice ready" || d.status === "Archived" ? "success" : d.status === "Needs review" ? "warning" : "neutral")}>
                    {d.status === "Pending" ? "To do" : d.status === "Needs review" ? "Review" : "Done"}
                  </span>
                  <ChevronRight size={16} color="#484f58" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tasks list */}
      {screen === "tasks" && !selectedTask && (
        <div style={S.screen}>
          <div style={{ ...S.header, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e6edf3" }}>Tasks</h1>
            {pendingTasks > 0 && <span style={S.pill("warning")}>{pendingTasks} new</span>}
          </div>
          <div style={S.list}>
            {tasks.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", gap: 10, color: "#8b949e", textAlign: "center" }}>
                <Inbox size={36} color="#30363d" />
                <strong style={{ color: "#e6edf3", fontSize: 16 }}>No tasks yet</strong>
                <span style={{ fontSize: 13 }}>Your operator will send tasks here.</span>
              </div>
            )}
            {tasks.map(t => (
              <button key={t.id} style={S.taskCard} onClick={() => markTaskSeen(t)}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.status === "done" ? "#3fb950" : t.status === "seen" ? "#484f58" : "#f0883e", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: 14, fontWeight: t.status === "pending" ? 700 : 500, color: "#e6edf3" }}>{t.title}</strong>
                  <span style={{ fontSize: 12, color: "#8b949e", marginTop: 2, display: "block" }}>{new Date(t.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={S.pill(t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning")}>{t.status}</span>
                  <ChevronRight size={14} color="#484f58" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task detail */}
      {screen === "tasks" && selectedTask && (
        <div style={S.screen}>
          <div style={{ ...S.header }}>
            <button onClick={() => setSelectedTask(null)} style={{ background: "none", border: "none", color: "#8b949e", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Back</button>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e6edf3" }}>{selectedTask.title}</h2>
          </div>
          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 16, background: "#161b22", border: "1px solid #30363d", borderRadius: 16 }}>
              <p style={{ fontSize: 14, color: "#8b949e", lineHeight: 1.7 }}>{selectedTask.body}</p>
              {selectedTask.file_url && (
                <a href={selectedTask.file_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, padding: "8px 14px", background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, fontSize: 13, color: "#58a6ff", textDecoration: "none" }}>
                  📎 {selectedTask.file_name || "View attachment"}
                </a>
              )}
            </div>
            {selectedTask.status !== "done" ? (
              <button onClick={() => markTaskDone(selectedTask.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 14, background: "#c8ff00", color: "#000", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", width: "100%" }}>
                <CheckCircle2 size={18} /> Mark as done
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", color: "#3fb950", fontSize: 14 }}>
                <CheckCircle2 size={16} /> Completed
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile */}
      {screen === "profile" && (
        <div style={S.screen}>
          <div style={S.header}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e6edf3" }}>Profile</h1>
          </div>
          <div style={S.profileCard}>
            <div style={S.avatar(52, 22)}>{firstName.charAt(0).toUpperCase()}</div>
            <div>
              <strong style={{ fontSize: 16, fontWeight: 700, color: "#e6edf3", display: "block" }}>{profile?.full_name}</strong>
              <span style={{ fontSize: 13, color: "#8b949e" }}>Driver</span>
            </div>
          </div>
          <div style={S.statsCard}>
            <div style={S.statsRow2}>
              <span style={{ color: "#8b949e" }}>Deliveries today</span>
              <strong style={{ color: "#e6edf3" }}>{deliveries.length}</strong>
            </div>
            <div style={S.statsRow2}>
              <span style={{ color: "#8b949e" }}>Completed</span>
              <strong style={{ color: "#3fb950" }}>{completedToday}</strong>
            </div>
            <div style={{ ...S.statsRow2, borderBottom: "none" }}>
              <span style={{ color: "#8b949e" }}>Pending tasks</span>
              <strong style={{ color: pendingTasks > 0 ? "#f0883e" : "#3fb950" }}>{pendingTasks}</strong>
            </div>
          </div>
          <button style={S.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <nav style={S.bottomNav}>
        {([
          { id: "home", label: "Deliveries", icon: Package },
          { id: "tasks", label: "Tasks", icon: Inbox, badge: pendingTasks },
          { id: "profile", label: "Profile", icon: User },
        ] as { id: Screen; label: string; icon: React.ElementType; badge?: number }[]).map(({ id, label, icon: Icon, badge }) => (
          <button key={id} style={S.navBtn(screen === id)} onClick={() => { setScreen(id); setSelectedTask(null); }}>
            <div style={{ position: "relative" }}>
              <Icon size={22} />
              {badge ? <span style={{ position: "absolute", top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 999, background: "#f0883e", color: "#000", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px" }}>{badge}</span> : null}
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
