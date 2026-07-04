import { NextResponse } from "next/server";
import { extractFromDocument, type IngestMedia } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** POST a document (PDF / image / text) → structured extraction proposal. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const hint = (form.get("hint") as string | null)?.trim() || undefined;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = file.type || "";
  let media: IngestMedia;
  if (type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    media = { kind: "pdf", base64: buf.toString("base64") };
  } else if (IMAGE_TYPES.has(type)) {
    media = { kind: "image", base64: buf.toString("base64"), mediaType: type };
  } else if (type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
    media = { kind: "text", text: buf.toString("utf-8").slice(0, 100_000) };
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, image, or text/CSV." },
      { status: 415 },
    );
  }

  const { proposal, error } = await extractFromDocument(media, hint);
  if (!proposal) {
    return NextResponse.json({ error: error ?? "Extraction failed." }, { status: 502 });
  }
  return NextResponse.json({ proposal });
}
