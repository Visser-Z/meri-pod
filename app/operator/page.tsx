"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Archive, Check, ChevronRight, ClipboardCheck,
  Clock3, FileCheck2, FileText, Gauge, History, Inbox, Mail,
  Send, RotateCcw, Search, ShieldCheck, Upload, X, LogOut,
  Users, Plus, Loader2
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  id: string;
  full_name: string;
  deliveries_count?: number;
}

interface Task {
  id: string;
  title: string;
  body: string;
  status: string;
  driver_id: string;
  created_at: string;
  file_url?: string;
  file_name?: string;
}

// ── Seed deliveries for demo ──────────────────────────────────────────────────

const seedDeliveries = [
  {
    id: "POD-8912", customer: "Cape Fresh Distribution", reference: "CFD-44891",
    destination: "Montague Gardens, Cape Town", driver: "Sipho Mokoena",
    deliveredAt: "2026-06-03 09:42", status: "Needs review", confidence: 72,
    amount: "R4,200", signature: false, match: false, quality: "Readable",
    issues: ["Missing signature", "Reference mismatch"],
    audit: [{ id: "a1", at: "2026-06-03 09:44", actor: "Meri", label: "Exceptions detected", detail: "Missing signature and reference mismatch." }],
  },
  {
    id: "POD-8911", customer: "Winelands Cold Chain", reference: "WCC-10234",
    destination: "Stellenbosch", driver: "Ayesha Jacobs",
    deliveredAt: "2026-06-03 08:15", status: "Invoice ready", confidence: 96,
    amount: "R2,875", signature: true, match: true, quality: "Good",
    issues: [],
    audit: [{ id: "a2", at: "2026-06-03 08:17", actor: "Operator", label: "Review confirmed", detail: "POD cleared for invoice queue." }],
  },
  {
    id: "POD-8910", customer: "Atlantic Retail Group", reference: "ARG-77820",
    destination: "Bellville", driver: "Thabo Dlamini",
    deliveredAt: "2026-06-02 16:58", status: "Archived", confidence: 91,
    amount: "R6,140", signature: true, match: true, quality: "Good",
    issues: [],
    audit: [{ id: "a3", at: "2026-06-02 17:04", actor: "Operator", label: "Archived", detail: "POD archived after notification." }],
  },
];

const statusFilters = ["All", "Needs review", "Invoice ready", "Archived"];
const navItems = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "exceptions", label: "Exceptions", icon: AlertTriangle },
  { id: "invoice", label: "Invoice Queue", icon: FileCheck2 },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "drivers", label: "Drivers", icon: Users },
];

function formatNow() { return new Date().toISOString().slice(0, 16).replace("T", " "); }
function createAuditEvent(label: string, detail: string, actor = "Operator") {
  return { id: `a-${Date.now()}`, at: formatNow(), actor, label, detail };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getIssues(d: any) {
  const issues: string[] = [];
  if (!d.signature) issues.push("Missing signature");
  if (!d.match) issues.push("Reference mismatch");
  if (d.confidence < 80) issues.push("Low confidence");
  return issues;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function classifyAction(d: any) {
  if (!d.signature) return "Hold invoice";
  if (!d.match) return "Investigate";
  if (d.confidence < 80) return "Manual review";
  return "Send to invoice queue";
}
function statusTone(status: string) {
  if (status === "Invoice ready") return "success";
  if (status === "Archived") return "neutral";
  return "warning";
}
function confidenceColor(n: number) {
  if (n >= 90) return "var(--text-success)";
  if (n >= 75) return "var(--text-warning)";
  return "var(--text-danger)";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEmail(d: any) {
  const issues = getIssues(d);
  return `Subject: POD ${d.reference} — delivery review\n\nHi ${d.customer},\n\nWe have reviewed POD ${d.id} for the delivery to ${d.destination}.\n\nStatus: ${d.status}\n${issues.length ? `Findings: ${issues.join(", ")}` : "No blocking exceptions detected."}\n\nRegards,\nMeri Operations`;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string | number; tone: string }) {
  return (
    <div className={`metric ${tone}`}>
      <div className="metric-top"><div className="metric-icon"><Icon size={16} /></div></div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export default function OperatorPage() {
  const router = useRouter();
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deliveries, setDeliveries] = useState<any[]>(seedDeliveries);
  const [selectedId, setSelectedId] = useState(seedDeliveries[0].id);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeView, setActiveView] = useState("inbox");
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDriverId, setTaskDriverId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [sendingTask, setSendingTask] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    loadProfile();
    loadDrivers();
    loadTasks();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (data) setProfileName(data.full_name);
  }

  async function loadDrivers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "driver");
    setDrivers(data || []);
  }

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("operator_id", user.id)
      .order("created_at", { ascending: false });
    setTasks(data || []);
  }

  async function sendTask() {
    if (!taskTitle || !taskDriverId) return;
    setSendingTask(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let fileUrl = null;
    let fileName = null;

    if (taskFile) {
      const { data } = await supabase.storage
        .from("task-attachments")
        .upload(`${user.id}/${Date.now()}-${taskFile.name}`, taskFile);
      if (data) {
        const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(data.path);
        fileUrl = urlData.publicUrl;
        fileName = taskFile.name;
      }
    }

    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();

    await supabase.from("tasks").insert({
      operator_id: user.id,
      driver_id: taskDriverId,
      company_id: profile?.company_id,
      title: taskTitle,
      body: taskBody,
      file_url: fileUrl,
      file_name: fileName,
    });

    setTaskTitle("");
    setTaskBody("");
    setTaskDriverId("");
    setTaskFile(null);
    setShowTaskModal(false);
    setSendingTask(false);
    loadTasks();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const loading = {
      id: "POD-loading", customer: "Processing...", reference: "—", destination: "—",
      driver: "—", deliveredAt: "—", status: "Needs review", confidence: 0,
      amount: "R0", signature: false, match: true, quality: "Readable", issues: [], audit: [],
    };
    setDeliveries((prev) => [loading, ...prev]);
    setSelectedId("POD-loading");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pod/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const extracted = await res.json();
      setDeliveries((prev) => prev.map((d) => d.id === "POD-loading" ? extracted : d));
      setSelectedId(extracted.id);
    } catch (err) {
      alert(`Extraction failed: ${(err as Error).message}`);
      setDeliveries((prev) => prev.filter((d) => d.id !== "POD-loading"));
    }
    e.target.value = "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function patch(id: string, changes: any, event?: ReturnType<typeof createAuditEvent>) {
    setDeliveries((prev) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prev.map((d: any) => {
        if (d.id !== id) return d;
        const audit = event ? [event, ...(d.audit || [])] : d.audit || [];
        return { ...d, ...changes, audit };
      })
    );
  }

  function selectView(v: string) {
    setActiveView(v);
    setStatusFilter("All");
  }

  function confirmReview() {
    const issues = getIssues(selected);
    const status = issues.length ? "Needs review" : "Invoice ready";
    patch(selected.id, { status, issues }, createAuditEvent(
      issues.length ? "Review blocked" : "Review confirmed",
      issues.length ? `Blocked: ${issues.join(", ").toLowerCase()}.` : "Cleared for invoice queue."
    ));
  }

  function archiveSelected() {
    patch(selected.id, { status: "Archived" }, createAuditEvent("Archived", "Moved out of active queue."));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const selected = deliveries.find((d) => d.id === selectedId) || deliveries[0];
  const selectedIssues = selected ? getIssues(selected) : [];

  const stats = useMemo(() => ({
    exceptions: deliveries.filter((d) => getIssues(d).length > 0).length,
    ready: deliveries.filter((d) => classifyAction(d) === "Send to invoice queue").length,
    avgConf: deliveries.length ? Math.round(deliveries.reduce((t, d) => t + d.confidence, 0) / deliveries.length) : 0,
    archived: deliveries.filter((d) => d.status === "Archived").length,
  }), [deliveries]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return deliveries.filter((d) => {
      const viewMatch = activeView === "inbox" ||
        (activeView === "exceptions" && getIssues(d).length > 0) ||
        (activeView === "invoice" && d.status === "Invoice ready") ||
        (activeView === "archive" && d.status === "Archived") ||
        activeView === "drivers";
      const statusMatch = statusFilter === "All" || d.status === statusFilter;
      const searchMatch = !term || [d.id, d.customer, d.reference, d.destination, d.driver].join(" ").toLowerCase().includes(term);
      return viewMatch && statusMatch && searchMatch;
    });
  }, [activeView, deliveries, query, statusFilter]);

  const actionOk = classifyAction(selected) === "Send to invoice queue";
  const timelineSteps = [
    { label: "Uploaded", done: true },
    { label: "AI extracted", done: true },
    { label: "Reviewed", done: selected.status !== "Needs review", current: selected.status === "Needs review" && selectedIssues.length > 0 },
    { label: "Invoice queue", done: selected.status === "Invoice ready" || selected.status === "Archived" },
  ];

  // Drivers view
  if (activeView === "drivers") {
    return (
      <main className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">M</div>
            <div>
              <strong>Meri AI</strong>
              <span>{profileName || "Operator"}</span>
            </div>
          </div>
          <p className="nav-label">Operations</p>
          <nav className="nav-list">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => selectView(id)}>
                <Icon size={15} /><span>{label}</span>
                <strong>{id === "drivers" ? drivers.length : id === "exceptions" ? stats.exceptions : id === "invoice" ? stats.ready : id === "archive" ? stats.archived : deliveries.length}</strong>
              </button>
            ))}
          </nav>
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <button className="nav-item" onClick={handleLogout}><LogOut size={15} /><span>Sign out</span></button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">Team management</p>
              <h1>Drivers</h1>
            </div>
            <button className="upload-button" onClick={() => setShowTaskModal(true)}>
              <Plus size={14} /> New task
            </button>
          </header>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Driver cards */}
            <p className="section-label">Your drivers ({drivers.length}/5)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {drivers.map((d) => (
                <div key={d.id} className="action-card">
                  <div className="action-card-icon ok" style={{ width: 40, height: 40, borderRadius: "50%", fontSize: 16, fontWeight: 700 }}>
                    {d.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong>{d.full_name}</strong>
                    <p>{deliveries.filter((del) => del.driver === d.full_name).length} deliveries today</p>
                  </div>
                </div>
              ))}
              {drivers.length === 0 && (
                <div className="empty-state" style={{ gridColumn: "1/-1" }}>
                  <strong>No drivers yet</strong>
                  <span>Drivers will appear here once they sign up and are assigned to your company.</span>
                </div>
              )}
            </div>

            {/* Recent tasks */}
            <p className="section-label" style={{ marginTop: 8 }}>Recent tasks</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.slice(0, 10).map((t) => (
                <div key={t.id} className="driver-delivery-row">
                  <div className={`status-dot ${t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning"}`} style={{ marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>{t.title}</strong>
                    <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                      {drivers.find((d) => d.id === t.driver_id)?.full_name || "Unknown driver"} · {new Date(t.created_at).toLocaleDateString("en-ZA")}
                    </small>
                  </div>
                  <span className={`pill ${t.status === "done" ? "success" : t.status === "seen" ? "neutral" : "warning"}`}>{t.status}</span>
                </div>
              ))}
              {tasks.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No tasks sent yet.</p>}
            </div>
          </div>
        </div>

        {/* Task modal */}
        {showTaskModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <div><h2>New task</h2><p>Send a task or instruction to a driver</p></div>
                <button className="icon-button" onClick={() => setShowTaskModal(false)}><X size={15} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="field">
                  <span>Assign to driver</span>
                  <select
                    value={taskDriverId}
                    onChange={(e) => setTaskDriverId(e.target.value)}
                    style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text)" }}
                  >
                    <option value="">Select driver…</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Title</span>
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Collect signed POD from client" />
                </label>
                <label className="field">
                  <span>Instructions</span>
                  <textarea
                    value={taskBody}
                    onChange={(e) => setTaskBody(e.target.value)}
                    placeholder="Detailed instructions for the driver…"
                    style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text)", minHeight: 80, resize: "vertical" }}
                  />
                </label>
                <label className="field">
                  <span>Attachment (optional)</span>
                  <input
                    type="file"
                    onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 12, color: "var(--text-muted)" }}
                  />
                </label>
              </div>
              <div className="action-row">
                <button className="secondary-button" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button className="primary-button" onClick={sendTask} disabled={sendingTask || !taskTitle || !taskDriverId}>
                  {sendingTask ? <><Loader2 size={14} className="spin" /> Sending…</> : <><Send size={14} /> Send task</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>Meri AI</strong>
            <span>{profileName || "Operator"}</span>
          </div>
        </div>
        <p className="nav-label">Operations</p>
        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => selectView(id)}>
              <Icon size={15} /><span>{label}</span>
              <strong>{id === "drivers" ? drivers.length : id === "exceptions" ? stats.exceptions : id === "invoice" ? stats.ready : id === "archive" ? stats.archived : deliveries.length}</strong>
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <button className="nav-item" onClick={handleLogout}><LogOut size={15} /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations workspace</p>
            <h1>Proof of Delivery</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={() => { setDeliveries(seedDeliveries); setSelectedId(seedDeliveries[0].id); }}>
              <RotateCcw size={14} /> Reset
            </button>
            <label className="upload-button">
              <Upload size={14} /> Upload POD
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" onChange={handleFile} />
            </label>
          </div>
        </header>

        <div className="metric-grid">
          <MetricCard icon={AlertTriangle} label="Open exceptions" value={stats.exceptions} tone="warning" />
          <MetricCard icon={FileCheck2} label="Invoice ready" value={stats.ready} tone="success" />
          <MetricCard icon={Gauge} label="Avg confidence" value={`${stats.avgConf}%`} tone="info" />
          <MetricCard icon={Clock3} label="Avg review time" value="3 min" tone="neutral" />
        </div>

        <div className="content-grid">
          <div className="panel-col">
            <div className="col-header">
              <div>
                <p className="eyebrow">POD inbox</p>
                <h2>{filtered.length} document{filtered.length !== 1 ? "s" : ""}</h2>
              </div>
              <div className="search-box">
                <Search size={13} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
              </div>
            </div>
            <div className="filter-tabs">
              {statusFilters.map((f) => (
                <button key={f} className={statusFilter === f ? "active" : ""} onClick={() => setStatusFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="col-body">
              {filtered.length === 0 && (
                <div className="empty-state">
                  <strong>No PODs found</strong>
                  <span>Try a different filter or upload a document.</span>
                </div>
              )}
              {filtered.map((d) => (
                <button key={d.id} className={`delivery-row ${d.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(d.id)}>
                  <span className={`status-dot ${statusTone(d.status)}`} />
                  <span className="delivery-row-body">
                    <strong>
                      {d.id === "POD-loading"
                        ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="spinner" /> Processing…</span>
                        : d.customer}
                    </strong>
                    <small>{d.id} · {d.reference}</small>
                  </span>
                  <Pill tone={statusTone(d.status)}>
                    {d.status === "Needs review" ? "Review" : d.status === "Invoice ready" ? "Invoice" : "Archived"}
                  </Pill>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-col review-col">
            <div className="col-header">
              <div>
                <p className="eyebrow">AI review · {selected.id}</p>
                <h2>{selected.customer}</h2>
              </div>
              <Pill tone={actionOk ? "success" : "warning"}>{classifyAction(selected)}</Pill>
            </div>
            <div className="col-body">
              <div className="document-preview">
                <FileText size={36} />
                <div className="document-preview-info">
                  <strong>{selected.quality} scan · {selected.driver}</strong>
                  <span>{selected.deliveredAt} · {selected.destination}</span>
                  <div className="confidence-bar">
                    <div className="confidence-bar-fill" style={{ width: `${selected.confidence}%`, background: confidenceColor(selected.confidence) }} />
                  </div>
                  <span style={{ fontSize: 11, color: confidenceColor(selected.confidence), marginTop: 4 }}>{selected.confidence}% confidence</span>
                </div>
              </div>

              <p className="section-label">Extracted fields</p>
              <div className="field-grid">
                {([["Customer", "customer"], ["Reference", "reference"], ["Destination", "destination"], ["Driver", "driver"], ["Delivered at", "deliveredAt"], ["Invoice value", "amount"]] as [string, string][]).map(([label, key]) => (
                  <label key={key} className="field">
                    <span>{label}</span>
                    <input value={selected[key]} onChange={(e) => patch(selected.id, { [key]: e.target.value })} />
                  </label>
                ))}
              </div>

              <p className="section-label">Verification</p>
              <div className="checks">
                <label className="toggle">
                  <input type="checkbox" checked={selected.signature} onChange={(e) =>
                    patch(selected.id, { signature: e.target.checked }, createAuditEvent("Signature check updated", e.target.checked ? "Marked present." : "Marked missing."))
                  } />
                  <span className="toggle-track" />
                  Signature present
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={selected.match} onChange={(e) =>
                    patch(selected.id, { match: e.target.checked }, createAuditEvent("Reference check updated", e.target.checked ? "Reference matched." : "Mismatch flagged."))
                  } />
                  <span className="toggle-track" />
                  Reference matches job
                </label>
              </div>

              <div className={`exception-box ${selectedIssues.length ? "has-issues" : "clear"}`}>
                <div className="exception-box-header">
                  {selectedIssues.length ? <AlertTriangle size={15} /> : <Check size={15} />}
                  {selectedIssues.length ? "Exceptions detected" : "No blocking exceptions"}
                </div>
                {selectedIssues.length
                  ? selectedIssues.map((i: string) => <div key={i} className="exception-item"><ChevronRight size={12} />{i}</div>)
                  : <p className="exception-clear-text">This POD is clear for invoicing.</p>
                }
              </div>

              <div className="action-row">
                <button className="secondary-button" onClick={archiveSelected}><Archive size={14} /> Archive</button>
                <button className="secondary-button" onClick={() => setEmailDraft(buildEmail(selected))}><Mail size={14} /> Email</button>
                <button className="primary-button" onClick={confirmReview}><ShieldCheck size={14} /> Confirm review</button>
              </div>
            </div>
          </div>

          <div className="panel-col action-col">
            <div className="col-header">
              <div><p className="eyebrow">Next action</p><h2>Outcome</h2></div>
            </div>
            <div className="col-body">
              <div className="action-card">
                <div className={`action-card-icon ${actionOk ? "ok" : "block"}`}>
                  {actionOk ? <Check size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div>
                  <strong>{classifyAction(selected)}</strong>
                  <p>{actionOk ? "POD is clean. Send to invoice queue." : "Resolve exceptions before invoicing."}</p>
                </div>
              </div>

              <p className="section-label" style={{ marginTop: 8 }}>Progress</p>
              <div className="mini-timeline">
                {timelineSteps.map((s) => (
                  <div key={s.label} className={`timeline-step ${s.done ? "done" : ""} ${s.current ? "current" : ""}`}>
                    <div className="timeline-dot">{s.done && <Check size={10} />}</div>
                    <span className="timeline-step-label">{s.label}</span>
                  </div>
                ))}
              </div>

              <p className="section-label" style={{ marginTop: 16 }}>Activity</p>
              <div className="audit-trail">
                <div className="audit-heading"><History size={14} /> Audit log</div>
                {(selected.audit || []).slice(0, 6).map((ev: { id: string; at: string; label: string; detail: string; actor: string }) => (
                  <div key={ev.id} className="audit-event">
                    <span className="audit-event-time">{ev.at}</span>
                    <span className="audit-event-label">{ev.label}</span>
                    <span className="audit-event-detail">{ev.detail}</span>
                    <span className="audit-event-actor">{ev.actor}</span>
                  </div>
                ))}
                {!(selected.audit || []).length && <p className="audit-empty">No activity yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {emailDraft !== null && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div><h2>Customer email</h2><p>{selected.customer} · {selected.reference}</p></div>
              <button className="icon-button" onClick={() => setEmailDraft(null)}><X size={15} /></button>
            </div>
            <textarea value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} />
            <div className="action-row">
              <button className="secondary-button" onClick={() => navigator.clipboard?.writeText(emailDraft ?? "")}><ClipboardCheck size={14} /> Copy</button>
              <button className="primary-button" onClick={() => {
                patch(selected.id, {}, createAuditEvent("Customer email prepared", "Operator drafted customer-facing email."));
                setEmailDraft(null);
              }}><Send size={14} /> Log email</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
