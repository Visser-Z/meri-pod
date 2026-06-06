"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, Archive, Check, ChevronRight, ClipboardCheck,
  Clock3, FileCheck2, FileText, Gauge, History, Inbox, Mail,
  Send, RotateCcw, Search, ShieldCheck, Upload, X,
} from "lucide-react";

const initialDeliveries = [
  {
    id: "POD-8912", customer: "Cape Fresh Distribution", reference: "CFD-44891",
    destination: "Montague Gardens, Cape Town", driver: "Sipho Mokoena",
    deliveredAt: "2026-06-03 09:42", status: "Needs review", confidence: 72,
    amount: "R4,200", signature: false, match: false, quality: "Readable",
    issues: ["Missing signature", "Reference mismatch"],
    audit: [{ id: "a1", at: "2026-06-03 09:44", actor: "Meri", label: "Exceptions detected", detail: "Missing signature and reference mismatch found during AI review." }],
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
    audit: [{ id: "a3", at: "2026-06-02 17:04", actor: "Operator", label: "Archived", detail: "POD archived after customer notification." }],
  },
];

const statusFilters = ["All", "Needs review", "Invoice ready", "Archived"];
const navItems = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "exceptions", label: "Exceptions", icon: AlertTriangle },
  { id: "invoice", label: "Invoice Queue", icon: FileCheck2 },
  { id: "archive", label: "Archive", icon: Archive },
];

function formatNow() { return new Date().toISOString().slice(0, 16).replace("T", " "); }
function createAuditEvent(label: string, detail: string, actor = "Operator") {
  return { id: `a-${Date.now()}`, at: formatNow(), actor, label, detail };
}
function getIssues(d: typeof initialDeliveries[0]) {
  const issues: string[] = [];
  if (!d.signature) issues.push("Missing signature");
  if (!d.match) issues.push("Reference mismatch");
  if (d.confidence < 80) issues.push("Low confidence");
  return issues;
}
function classifyAction(d: typeof initialDeliveries[0]) {
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
function buildEmail(d: typeof initialDeliveries[0]) {
  const issues = getIssues(d);
  return `Subject: POD ${d.reference} — delivery review\n\nHi ${d.customer},\n\nWe have reviewed POD ${d.id} for the delivery to ${d.destination}.\n\nStatus: ${d.status}\n${issues.length ? `Findings: ${issues.join(", ")}` : "No blocking exceptions detected."}\n\nRegards,\nMeri Operations`;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string | number; tone: string }) {
  return (
    <div className={`metric ${tone}`}>
      <div className="metric-top">
        <div className="metric-icon"><Icon size={16} /></div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Delivery = any;

export default function Home() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [selectedId, setSelectedId] = useState(initialDeliveries[0].id);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeView, setActiveView] = useState("inbox");
  const [emailDraft, setEmailDraft] = useState<string | null>(null);

  const selected = deliveries.find((d: Delivery) => d.id === selectedId) || deliveries[0];
  const selectedIssues = selected ? getIssues(selected) : [];

  const stats = useMemo(() => ({
    exceptions: deliveries.filter((d: Delivery) => getIssues(d).length > 0).length,
    ready: deliveries.filter((d: Delivery) => classifyAction(d) === "Send to invoice queue").length,
    avgConf: Math.round(deliveries.reduce((t: number, d: Delivery) => t + d.confidence, 0) / deliveries.length),
    archived: deliveries.filter((d: Delivery) => d.status === "Archived").length,
  }), [deliveries]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return deliveries.filter((d: Delivery) => {
      const viewMatch = activeView === "inbox" ||
        (activeView === "exceptions" && getIssues(d).length > 0) ||
        (activeView === "invoice" && d.status === "Invoice ready") ||
        (activeView === "archive" && d.status === "Archived");
      const statusMatch = statusFilter === "All" || d.status === statusFilter;
      const searchMatch = !term || [d.id, d.customer, d.reference, d.destination, d.driver].join(" ").toLowerCase().includes(term);
      return viewMatch && statusMatch && searchMatch;
    });
  }, [activeView, deliveries, query, statusFilter]);

  function patch(id: string, changes: Partial<Delivery>, event?: ReturnType<typeof createAuditEvent>) {
    setDeliveries((prev: Delivery[]) =>
      prev.map((d: Delivery) => {
        if (d.id !== id) return d;
        const audit = event ? [event, ...(d.audit || [])] : d.audit || [];
        return { ...d, ...changes, audit };
      })
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const accepted = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!accepted.includes(file.type) && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(file.name)) {
      window.alert("Upload a PDF, JPG, PNG, WebP, or HEIC POD.");
      e.target.value = "";
      return;
    }
    if (file.size > 20_000_000) {
      window.alert("File must be under 20MB.");
      e.target.value = "";
      return;
    }
    const loading: Delivery = {
      id: "POD-loading", customer: "Processing...", reference: "—", destination: "—",
      driver: "—", deliveredAt: "—", status: "Needs review", confidence: 0,
      amount: "R0", signature: false, match: true, quality: "Readable", issues: [], audit: [],
    };
    setDeliveries((prev: Delivery[]) => [loading, ...prev]);
    setSelectedId("POD-loading");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pod/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const extracted = await res.json();
      setDeliveries((prev: Delivery[]) => prev.map((d: Delivery) => d.id === "POD-loading" ? extracted : d));
      setSelectedId(extracted.id);
    } catch (err) {
      window.alert(`Extraction failed: ${(err as Error).message}`);
      setDeliveries((prev: Delivery[]) => prev.filter((d: Delivery) => d.id !== "POD-loading"));
    }
    e.target.value = "";
  }

  function selectView(v: string) {
    setActiveView(v);
    setStatusFilter("All");
    const first = deliveries.find((d: Delivery) => {
      if (v === "exceptions") return getIssues(d).length > 0;
      if (v === "invoice") return d.status === "Invoice ready";
      if (v === "archive") return d.status === "Archived";
      return true;
    });
    if (first) setSelectedId(first.id);
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

  const actionOk = classifyAction(selected) === "Send to invoice queue";
  const timelineSteps = [
    { label: "Uploaded", done: true },
    { label: "AI extracted", done: true },
    { label: "Reviewed", done: selected.status !== "Needs review", current: selected.status === "Needs review" && selectedIssues.length > 0 },
    { label: "Invoice queue", done: selected.status === "Invoice ready" || selected.status === "Archived" },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>Meri AI</strong>
            <span>POD Intelligence</span>
          </div>
        </div>
        <p className="nav-label">Operations</p>
        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => selectView(id)}>
              <Icon size={15} />
              <span>{label}</span>
              <strong>
                {id === "exceptions" ? stats.exceptions
                  : id === "invoice" ? stats.ready
                  : id === "archive" ? stats.archived
                  : deliveries.length}
              </strong>
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations workspace</p>
            <h1>Proof of Delivery</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={() => { setDeliveries(initialDeliveries); setSelectedId(initialDeliveries[0].id); }}>
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
              {filtered.map((d: Delivery) => (
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
                    patch(selected.id, { match: e.target.checked }, createAuditEvent("Reference check updated", e.target.checked ? "Reference matched." : "Reference mismatch flagged."))
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
              <div>
                <p className="eyebrow">Next action</p>
                <h2>Outcome</h2>
              </div>
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
              <div>
                <h2>Customer email</h2>
                <p>{selected.customer} · {selected.reference}</p>
              </div>
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
