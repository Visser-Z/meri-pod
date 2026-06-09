"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, MapPin, Navigation, Camera, FileText,
  CheckCircle2, RotateCcw, Loader2, Package, ChevronRight
} from "lucide-react";

type Step = "detail" | "sign" | "upload" | "done";

const S = {
  app: { display: "flex", flexDirection: "column" as const, height: "100dvh", maxWidth: 430, margin: "0 auto", background: "#0d1117", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased", overflow: "hidden" },
  screen: { flex: 1, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "52px 20px 16px", background: "#010409", flexShrink: 0 },
  backBtn: { width: 36, height: 36, borderRadius: "50%", background: "#161b22", border: "1px solid #30363d", display: "grid", placeItems: "center", cursor: "pointer", color: "#8b949e", flexShrink: 0 },
  ctaBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: 16, background: "#c8ff00", color: "#000", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", width: "100%", letterSpacing: "-0.01em" },
  ghostBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 12, background: "none", border: "1px solid #30363d", color: "#8b949e", fontSize: 13, cursor: "pointer", width: "100%" },
  navBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 16, background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", fontSize: 15, fontWeight: 600, textDecoration: "none", width: "100%" },
  infoCard: { margin: "12px 20px", padding: 18, background: "#161b22", border: "1px solid #30363d", borderRadius: 18, display: "flex", flexDirection: "column" as const, gap: 16 },
  infoRow: { display: "flex", alignItems: "flex-start", gap: 14 },
  infoLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#8b949e", marginBottom: 3, display: "block" },
  infoValue: { fontSize: 15, fontWeight: 500, color: "#e6edf3", lineHeight: 1.4 },
  uploadOption: { display: "flex", alignItems: "center", gap: 14, padding: 18, background: "#161b22", border: "1px solid #30363d", borderRadius: 16, cursor: "pointer", width: "100%" },
};

export default function DeliveryDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const customer = searchParams.get("customer") || "Unknown";
  const destination = searchParams.get("destination") || "";
  const reference = searchParams.get("reference") || "";
  const amount = searchParams.get("amount") || "R0";

  const [step, setStep] = useState<Step>("detail");
  const [uploading, setUploading] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current; if (!canvas) return;
    e.preventDefault(); drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#c8ff00"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setHasSig(true);
  }

  function clearSig() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pod/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      setStep("done");
    } catch (err) {
      alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div style={S.app}>
      <div style={S.screen}>

        {/* Detail */}
        {step === "detail" && (
          <>
            <div style={S.header}>
              <button style={S.backBtn} onClick={() => router.back()}><ArrowLeft size={16} /></button>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Dropoff order</p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3", letterSpacing: "-0.01em" }}>{customer}</h2>
                <p style={{ fontSize: 13, color: "#8b949e", marginTop: 1 }}>{reference}</p>
              </div>
            </div>

            <div style={S.infoCard}>
              <div style={S.infoRow}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1a2600", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <MapPin size={16} color="#c8ff00" />
                </div>
                <div>
                  <span style={S.infoLabel}>Delivery address</span>
                  <span style={S.infoValue}>{destination}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "#30363d" }} />
              <div style={S.infoRow}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0c2041", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Package size={16} color="#58a6ff" />
                </div>
                <div>
                  <span style={S.infoLabel}>Invoice value</span>
                  <span style={{ ...S.infoValue, fontSize: 20, fontWeight: 700, color: "#e6edf3" }}>{amount}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={navUrl} target="_blank" rel="noopener noreferrer" style={S.navBtn}>
                <Navigation size={18} color="#58a6ff" /> Open in Maps
              </a>
              <button style={S.ctaBtn} onClick={() => setStep("sign")}>
                Arrive at dropoff →
              </button>
            </div>
          </>
        )}

        {/* Signature */}
        {step === "sign" && (
          <>
            <div style={S.header}>
              <button style={S.backBtn} onClick={() => setStep("detail")}><ArrowLeft size={16} /></button>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Step 1 of 2</p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Driver signature</h2>
              </div>
            </div>

            <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "#8b949e" }}>Sign with your finger to confirm this delivery</p>
              <div style={{ background: "#161b22", border: `1px solid ${hasSig ? "#238636" : "#30363d"}`, borderRadius: 18, padding: 16, transition: "border-color 200ms" }}>
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={200}
                  style={{ width: "100%", borderRadius: 10, background: "#0d1117", touchAction: "none", cursor: "crosshair", display: "block" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={() => { drawing.current = false; }}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={() => { drawing.current = false; }}
                />
                <p style={{ fontSize: 11, color: "#484f58", textAlign: "center", marginTop: 8 }}>Sign above</p>
              </div>

              <button style={S.ghostBtn} onClick={clearSig}>
                <RotateCcw size={14} /> Clear
              </button>

              <button style={{ ...S.ctaBtn, opacity: hasSig ? 1 : 0.4 }} disabled={!hasSig} onClick={() => setStep("upload")}>
                Confirm signature →
              </button>
            </div>
          </>
        )}

        {/* Upload */}
        {step === "upload" && (
          <>
            <div style={S.header}>
              <button style={S.backBtn} onClick={() => setStep("sign")}><ArrowLeft size={16} /></button>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Step 2 of 2</p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Upload POD</h2>
              </div>
            </div>

            <div style={{ padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 4 }}>Photograph or upload the signed delivery note</p>

              <label style={S.uploadOption}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#1a2600", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Camera size={22} color="#c8ff00" />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#e6edf3" }}>Take a photo</strong>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>Use your camera</span>
                </div>
                <ChevronRight size={16} color="#484f58" />
                <input type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: "none" }} />
              </label>

              <label style={S.uploadOption}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0c2041", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <FileText size={22} color="#58a6ff" />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#e6edf3" }}>Upload file</strong>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>PDF or image from device</span>
                </div>
                <ChevronRight size={16} color="#484f58" />
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} style={{ display: "none" }} />
              </label>

              {uploading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 20, color: "#8b949e", fontSize: 14 }}>
                  <Loader2 size={18} style={{ animation: "spin 600ms linear infinite", color: "#c8ff00" }} />
                  Processing POD…
                </div>
              )}
            </div>
          </>
        )}

        {/* Done */}
        {step === "done" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 24, textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#0d2818", border: "2px solid #238636", display: "grid", placeItems: "center" }}>
              <CheckCircle2 size={40} color="#3fb950" />
            </div>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#e6edf3", marginBottom: 10, letterSpacing: "-0.02em" }}>Delivery complete</h2>
              <p style={{ fontSize: 14, color: "#8b949e", lineHeight: 1.7 }}>
                {customer} has been marked as delivered.<br />The POD has been submitted for review.
              </p>
            </div>
            <button style={{ ...S.ctaBtn, marginTop: 8 }} onClick={() => router.push("/driver")}>
              Back to deliveries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
