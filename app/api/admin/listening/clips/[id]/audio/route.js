import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { rowToListeningClip } from "@/lib/listening/clip-mapper";
import { ensureListeningSchema } from "@/lib/listening/ensure-schema";

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);

function extForMime(mime, filename) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".mp3")) return "mp3";
  if (lower.endsWith(".wav")) return "wav";
  if (lower.endsWith(".ogg")) return "ogg";
  if (lower.endsWith(".m4a")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("m4a") || mime.includes("mp4")) return "m4a";
  return "mp3";
}

export async function POST(request, { params }) {
  try {
    const admin = await requireAdminUser(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    await ensureListeningSchema();

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "Invalid id." }, { status: 400 });
    }

    const [rows] = await pool.query(`SELECT id, slug FROM listening_clips WHERE id = ? LIMIT 1`, [id]);
    const clip = rows[0];
    if (!clip) {
      return NextResponse.json({ success: false, message: "Clip not found." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "file is required." }, { status: 400 });
    }

    if (!ALLOWED.has(file.type) && !String(file.name || "").match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return NextResponse.json(
        { success: false, message: "Chỉ chấp nhận MP3, WAV, OGG hoặc M4A." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "File tối đa 12MB." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = extForMime(file.type, file.name);
    const safeSlug = String(clip.slug || `clip-${id}`).replace(/[^a-z0-9-_]/gi, "-");
    const dir = path.join(process.cwd(), "public", "uploads", "listening");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${safeSlug}-${Date.now()}.${ext}`;
    await fs.writeFile(path.join(dir, filename), buf);

    const publicUrl = `/uploads/listening/${filename}`;
    await pool.query(`UPDATE listening_clips SET audio_url = ? WHERE id = ?`, [publicUrl, id]);

    const [updatedRows] = await pool.query(`SELECT * FROM listening_clips WHERE id = ? LIMIT 1`, [id]);
    return NextResponse.json({
      success: true,
      data: rowToListeningClip(updatedRows[0]),
      message: "Đã upload audio.",
    });
  } catch (error) {
    console.error("[admin/listening/clips/audio] POST", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Upload failed." },
      { status: 500 }
    );
  }
}
