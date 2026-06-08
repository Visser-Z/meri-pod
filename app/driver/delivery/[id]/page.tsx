"use client";

export const dynamic = "force-dynamic";

import { useRef, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, MapPin, Navigation, Camera, FileText,
  CheckCircle2, Pen, RotateCcw, Loader2, Package
} from "lucide-react";

type Step = "detail" | "sign" | "upload" | "done";

export default function DeliveryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const customer = searchParams.get("customer") || "Unknown";
  const destination = searchParams.get("destination") || "";
  const reference = searchParams.get("reference") || "";
  const amount = searchParams.get("amount") || "R0";

  const [step, setStep] = useState<Step>("detail");
  const [uploading, setUploading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);

  // Encode destination for OpenStreetMap
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=18.3,-34.1,18.7,-33.8&layer=mapnik&marker=${encodeURIComponent(destination)}`;
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  // Signature pad handlers
  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#c8ff00";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSig(true);
  }

  function endDraw() { drawing.current = false; }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function handlePODUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    <div className="driver-app">
      <div className="driver-screen" style={{ paddingBottom: 0 }}>

        {/* ── Detail step ── */}
        {step === "detail" && (
          <>
            <div className="driver-app-header" style={{ position: "relative" }}>
              <button className="driver-back-btn" onClick={() => router.back()}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dropoff order</p>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{customer}</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{reference}</p>
              </div>
              <div style={{ width: 40 }} />
            </div>

            {/* Map */}
            <div className="driver-map-container">
              {!mapLoaded && (
                <div className="driver-map-placeholder">
                  <MapPin size={24} color="var(--accent)" />
                  <span>{destination}</span>
                </div>
              )}
              <iframe
                src={mapSrc}
                className="driver-map-iframe"
                style={{ opacity: mapLoaded ? 1 : 0 }}
                onLoad={() => setMapLoaded(true)}
                title="Delivery location"
              />
            </div>

            {/* Delivery info card */}
            <div className="driver-detail-card">
              <div className="driver-detail-row">
                <MapPin size={16} color="var(--accent)" />
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Address</p>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{destination}</p>
                </div>
              </div>
              <div className="driver-detail-row">
                <Package size={16} color="var(--text-info)" />
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Invoice value</p>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{amount}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <a href={navUrl} target="_blank" rel="noopener noreferrer" className="driver-nav-action-btn">
                <Navigation size={18} /> Navigate
              </a>
              <button className="driver-cta-btn" onClick={() => setStep("sign")}>
                Arrive at dropoff →
              </button>
            </div>
          </>
        )}

        {/* ── Signature step ── */}
        {step === "sign" && (
          <>
            <div className="driver-app-header">
              <button className="driver-back-btn" onClick={() => setStep("detail")}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Driver&apos;s signature</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Sign to confirm delivery</p>
              </div>
              <div style={{ width: 40 }} />
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              <div className="driver-sig-container">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={220}
                  className="driver-sig-canvas"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                <p style={{ fontSize: 11, color: "var(--text-subtle)", textAlign: "center", marginTop: 8 }}>Sign above</p>
              </div>

              <button className="driver-ghost-btn" onClick={clearSig}>
                <RotateCcw size={14} /> Clear signature
              </button>

              <button
                className="driver-cta-btn"
                disabled={!hasSig}
                onClick={() => setStep("upload")}
                style={{ opacity: hasSig ? 1 : 0.4 }}
              >
                Confirm →
              </button>
            </div>
          </>
        )}

        {/* ── Upload step ── */}
        {step === "upload" && (
          <>
            <div className="driver-app-header">
              <button className="driver-back-btn" onClick={() => setStep("sign")}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Upload POD</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Photo or PDF of signed delivery note</p>
              </div>
              <div style={{ width: 40 }} />
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <label className="driver-upload-option">
                <Camera size={24} color="var(--accent)" />
                <div>
                  <strong>Take a photo</strong>
                  <span>Use your camera to photograph the POD</span>
                </div>
                <input type="file" accept="image/*" capture="environment" onChange={handlePODUpload} style={{ display: "none" }} />
              </label>

              <label className="driver-upload-option">
                <FileText size={24} color="var(--text-info)" />
                <div>
                  <strong>Upload file</strong>
                  <span>PDF or image from your device</span>
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handlePODUpload} style={{ display: "none" }} />
              </label>

              {uploading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 20, color: "var(--text-muted)" }}>
                  <Loader2 size={18} style={{ animation: "spin 600ms linear infinite" }} />
                  <span>Processing POD…</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Done step ── */}
        {step === "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 32, gap: 20, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--bg-pill-success)", border: "2px solid var(--border-success)", display: "grid", placeItems: "center" }}>
              <CheckCircle2 size={36} color="var(--text-success)" />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Delivery complete</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                {customer} has been marked as delivered. The POD has been submitted for review.
              </p>
            </div>
            <button className="driver-cta-btn" style={{ width: "100%" }} onClick={() => router.push("/driver")}>
              Back to deliveries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
