import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { ensureVocabularySchema } from "@/lib/vocabulary/ensure-schema";
import {
  buildVocabularySelectFragments,
  getVocabularyTableColumnSet,
} from "@/lib/vocabulary/vocabulary-columns";
import { buildVocabularyImageMetadata } from "@/lib/vocabulary/image-prompt";
import { IMAGE_STYLE_OPTIONS } from "@/lib/vocabulary/image-styles";
import { normalizeMediaUrl } from "@/lib/media-url";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = ["regenerate", "approve", "reject", "hide", "set_style"];

export async function GET(request) {
  try {
    const admin = await requireAdminUser(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    await ensureVocabularySchema(pool);
    const cols = await getVocabularyTableColumnSet();
    const { selectList } = buildVocabularySelectFragments(cols);

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "pending").trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 24)));
    const offset = (page - 1) * limit;

    const where = cols.has("image_status") ? "image_status = ?" : "1=1";
    const params = cols.has("image_status") ? [status] : [];

    const [rows] = await pool.query(
      `SELECT ${selectList}
       FROM vocabulary
       WHERE ${where}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM vocabulary WHERE ${where}`,
      params
    );

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        image_url: normalizeMediaUrl(row.image_url),
      })),
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
      },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load vocabulary images.${detail}`.trim() },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminUser(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    await ensureVocabularySchema(pool);
    const cols = await getVocabularyTableColumnSet();
    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();
    const imageStyle = String(body?.image_style || "").trim().toLowerCase();
    const ids = Array.isArray(body?.ids)
      ? body.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : body?.id
      ? [Number(body.id)].filter((n) => Number.isFinite(n) && n > 0)
      : [];

    if (!ids.length) {
      return NextResponse.json({ success: false, message: "id or ids is required." }, { status: 400 });
    }

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
    }

    if (action === "set_style" && !IMAGE_STYLE_OPTIONS.includes(imageStyle)) {
      return NextResponse.json({ success: false, message: "Invalid image_style." }, { status: 400 });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT id, word, vietnamese_meaning, part_of_speech, topic, example_sentence, example_sentence_vi, level, image_url, image_status, image_style, image_source
       FROM vocabulary WHERE id IN (${placeholders})`,
      ids
    );

    const updated = [];
    for (const row of rows) {
      if (action === "approve" && cols.has("image_status")) {
        await pool.query(`UPDATE vocabulary SET image_status = 'approved' WHERE id = ?`, [row.id]);
        updated.push({ id: row.id, image_status: "approved" });
        continue;
      }

      if (action === "reject" && cols.has("image_status")) {
        await pool.query(`UPDATE vocabulary SET image_status = 'rejected' WHERE id = ?`, [row.id]);
        updated.push({ id: row.id, image_status: "rejected" });
        continue;
      }

      if (action === "hide" && cols.has("image_status")) {
        await pool.query(`UPDATE vocabulary SET image_status = 'hidden', image_url = '' WHERE id = ?`, [
          row.id,
        ]);
        updated.push({ id: row.id, image_status: "hidden" });
        continue;
      }

      const regenRow =
        action === "set_style" ? { ...row, image_style: imageStyle } : row;
      const meta = buildVocabularyImageMetadata(regenRow);
      const sets = [];
      const params = [];

      if (cols.has("semantic_hint")) {
        sets.push("semantic_hint = ?");
        params.push(meta.semantic_hint);
      }
      if (cols.has("image_prompt")) {
        sets.push("image_prompt = ?");
        params.push(meta.image_prompt);
      }
      if (cols.has("image_style")) {
        sets.push("image_style = ?");
        params.push(meta.image_style);
      }
      if (cols.has("image_source")) {
        sets.push("image_source = ?");
        params.push(meta.image_source);
      }
      if (cols.has("image_url")) {
        sets.push("image_url = ?");
        params.push(meta.image_url);
      }
      if (cols.has("image_status")) {
        sets.push("image_status = ?");
        params.push(meta.image_status);
      }

      if (sets.length) {
        params.push(row.id);
        await pool.query(`UPDATE vocabulary SET ${sets.join(", ")} WHERE id = ?`, params);
      }

      updated.push({
        id: row.id,
        image_url: normalizeMediaUrl(meta.image_url),
        image_status: meta.image_status,
        image_style: meta.image_style,
        image_source: meta.image_source,
        semantic_hint: meta.semantic_hint,
        image_prompt: meta.image_prompt,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to update vocabulary images.${detail}`.trim() },
      { status: 500 }
    );
  }
}
