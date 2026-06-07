import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { generatePodId } from "@/lib/ids";

const anthropic = new Anthropic();

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

interface ExtractedPOD {
  customer: string;
  reference: string;
  destination: string;
  driver: string;
  delivered_at: string;
  amount: string;
  signature: boolean;
  confidence: number;
  quality: string;
}

const EXTRACTION_PROMPT = `You are a logistics document parser. Extract structured data from this proof of delivery (POD) document.

Return ONLY a valid JSON object with these exact fields:
- customer: string (recipient company or person name)
- reference: string (delivery reference, job number, or order number)
- destination: string (delivery address)
- driver: string (driver name if present, else "Unknown")
- delivered_at: string (delivery date and time in format "YYYY-MM-DD HH:mm", use 12:00 if only date is present)
- amount: string (invoice or delivery value with currency symbol e.g. "R4200", use "R0" if not found)
- signature: boolean (true if you can see a signature or text confirming delivery was signed)
- confidence: number (0-100, how confident are you in the extraction quality)
- quality: string (one of: "Good", "Readable", "Poor")

Do not include any explanation, preamble, or markdown — only the raw JSON object.`;

function safeParseExtraction(text: string): ExtractedPOD {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as ExtractedPOD;
  } catch {
    return {
      customer: "Unknown",
      reference: "Unknown",
      destination: "Unknown",
      driver: "Unknown",
      delivered_at: new Date().toISOString().slice(0, 16).replace("T", " "),
      amount: "R0",
      signature: false,
      confidence: 40,
      quality: "Poor",
    };
  }
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractedPOD> {
  // Extract text from PDF buffer using basic string parsing
  // Avoids pdfjs-dist which requires browser APIs not available in Node
  const raw = buffer.toString("latin1");
  const textChunks: string[] = [];
  const regex = /BT[\s\S]*?ET/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const block = match[0];
    const tjMatches = block.match(/\(([^)]+)\)\s*Tj/g) || [];
    const tfMatches = block.match(/\[([^\]]+)\]\s*TJ/g) || [];
    for (const m of tjMatches) {
      const t = m.match(/\(([^)]+)\)/);
      if (t) textChunks.push(t[1]);
    }
    for (const m of tfMatches) {
      const inner = m.replace(/[\[\]]/g, "");
      const parts = inner.match(/\(([^)]+)\)/g) || [];
      for (const p of parts) textChunks.push(p.replace(/[()]/g, ""));
    }
  }
  const rawText = textChunks.join(" ").replace(/\s+/g, " ").trim();

  if (!rawText || rawText.length < 20) {
    return {
      customer: "Unknown", reference: "Unknown", destination: "Unknown",
      driver: "Unknown",
      delivered_at: new Date().toISOString().slice(0, 16).replace("T", " "),
      amount: "R0", signature: false, confidence: 20, quality: "Poor",
    };
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: `${EXTRACTION_PROMPT}\n\nPOD TEXT:\n${rawText.slice(0, 6000)}` }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return safeParseExtraction(text);
}

async function extractFromImage(
  buffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<ExtractedPOD> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType, data: buffer.toString("base64") } },
        { type: "text", text: EXTRACTION_PROMPT },
      ],
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return safeParseExtraction(text);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const companyId = (formData.get("company_id") as string) ?? process.env.DEFAULT_COMPANY_ID;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const mimeType = file.type === "image/heic" ? "image/jpeg" : file.type;

    if (!ACCEPTED_TYPES.includes(mimeType))
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });

    if (file.size > 20 * 1024 * 1024)
      return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    const extracted = mimeType === "application/pdf"
      ? await extractFromPdf(buffer)
      : await extractFromImage(buffer, mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif");

    const issues: string[] = [];
    if (!extracted.signature) issues.push("Missing signature");
    if (extracted.confidence < 80) issues.push("Low confidence");

    const podId = generatePodId();

    await db.query(
      `INSERT INTO deliveries (id, company_id, customer, reference, destination, driver,
       delivered_at, status, confidence, amount, signature, match, quality, issues, file_url, raw_extraction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [podId, companyId, extracted.customer, extracted.reference, extracted.destination,
       extracted.driver, extracted.delivered_at, "Needs review", extracted.confidence,
       extracted.amount, extracted.signature, true, extracted.quality,
       JSON.stringify(issues), null, JSON.stringify({ extracted })]
    );

    const auditEvents = [
      { label: "POD uploaded", detail: `${file.name} accepted.`, actor: "Operator" },
      { label: "AI extraction completed", detail: `${extracted.confidence}% confidence.`, actor: "Meri" },
      ...(issues.length ? [{ label: "Exceptions detected", detail: issues.join(", "), actor: "Meri" }] : []),
    ];

    for (const e of auditEvents) {
      await db.query(
        `INSERT INTO audit_events (delivery_id, actor, label, detail) VALUES ($1,$2,$3,$4)`,
        [podId, e.actor, e.label, e.detail]
      );
    }

    return NextResponse.json({
      id: podId,
      customer: extracted.customer,
      reference: extracted.reference,
      destination: extracted.destination,
      driver: extracted.driver,
      deliveredAt: extracted.delivered_at,
      status: "Needs review",
      confidence: extracted.confidence,
      amount: extracted.amount,
      signature: extracted.signature,
      match: true,
      quality: extracted.quality,
      issues,
      fileUrl: null,
      audit: auditEvents.map((e, i) => ({
        id: `audit-${podId}-${i}`,
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        actor: e.actor, label: e.label, detail: e.detail,
      })),
    });

  } catch (err) {
    console.error("POD upload error:", err);
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
