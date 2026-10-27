import pool from "@/lib/db";
import { ensurePathAdminSchema } from "@/lib/admin/ensure-path-admin-schema";
import { writeAdminAuditLog } from "@/lib/admin/audit-log";
import { catalogLessonMeta } from "@/lib/admin/path-catalog";

export type PathTemplateItemInput = {
  lessonId: string;
  sortIndex?: number;
  required?: boolean;
};

function mapItemRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    sortIndex: Number(row.sort_index),
    gateNumber: Number(row.gate_number),
    chapterTitle: String(row.chapter_title),
    lessonId: String(row.lesson_id),
    itemType: String(row.item_type) as "lesson" | "exam",
    title: String(row.title),
    required: Number(row.required) === 1,
  };
}

async function loadTemplateItems(templateId: number) {
  const [rows] = await pool.query(
    `SELECT * FROM admin_path_template_items WHERE template_id = ? ORDER BY sort_index ASC, id ASC`,
    [templateId]
  );
  return (rows as Record<string, unknown>[]).map(mapItemRow);
}

export async function listPathTemplates(status?: "draft" | "published" | "all") {
  await ensurePathAdminSchema();
  const st = status && status !== "all" ? status : null;
  const [rows] = await pool.query(
    `SELECT t.*,
            (SELECT COUNT(*) FROM admin_path_template_items i WHERE i.template_id = t.id) AS item_count
     FROM admin_path_templates t
     ${st ? "WHERE t.status = ?" : ""}
     ORDER BY t.updated_at DESC`,
    st ? [st] : []
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    description: r.description != null ? String(r.description) : null,
    status: String(r.status) as "draft" | "published",
    version: Number(r.version),
    itemCount: Number(r.item_count || 0),
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getPathTemplate(templateId: number) {
  await ensurePathAdminSchema();
  const [rows] = await pool.query(`SELECT * FROM admin_path_templates WHERE id = ? LIMIT 1`, [templateId]);
  const t = (rows as Record<string, unknown>[])[0];
  if (!t) return null;
  const items = await loadTemplateItems(templateId);
  return {
    id: Number(t.id),
    title: String(t.title),
    description: t.description != null ? String(t.description) : null,
    status: String(t.status) as "draft" | "published",
    version: Number(t.version),
    publishedAt: t.published_at,
    createdBy: Number(t.created_by),
    items,
  };
}

export async function createPathTemplate(params: {
  title: string;
  description?: string;
  createdBy: number;
}) {
  await ensurePathAdminSchema();
  const title = String(params.title || "").trim().slice(0, 200);
  if (!title) return { ok: false as const, code: "TITLE_REQUIRED" };
  const [result] = await pool.query(
    `INSERT INTO admin_path_templates (title, description, status, version, created_by)
     VALUES (?, ?, 'draft', 1, ?)`,
    [title, params.description ? String(params.description).slice(0, 5000) : null, params.createdBy]
  );
  const id = Number((result as { insertId?: number }).insertId);
  await writeAdminAuditLog({
    actorUserId: params.createdBy,
    action: "path_template.create",
    meta: { template_id: id, title },
  });
  return { ok: true as const, id };
}

function resolveItems(inputs: PathTemplateItemInput[]) {
  const out: Array<{
    sortIndex: number;
    gateNumber: number;
    chapterTitle: string;
    lessonId: string;
    itemType: "lesson" | "exam";
    title: string;
    required: boolean;
  }> = [];
  let sort = 0;
  for (const raw of inputs) {
    const lessonId = String(raw.lessonId || "").trim();
    if (!lessonId) continue;
    const meta = catalogLessonMeta(lessonId);
    if (!meta) continue;
    sort += 1;
    out.push({
      sortIndex: raw.sortIndex != null ? Number(raw.sortIndex) : sort,
      gateNumber: meta.chapter.gateNumber,
      chapterTitle: meta.chapter.chapterTitle,
      lessonId,
      itemType: meta.lesson.itemType,
      title: meta.lesson.title,
      required: raw.required !== false,
    });
  }
  out.sort((a, b) => a.sortIndex - b.sortIndex);
  return out;
}

export async function savePathTemplateDraft(params: {
  templateId: number;
  actorUserId: number;
  title?: string;
  description?: string | null;
  items?: PathTemplateItemInput[];
}) {
  await ensurePathAdminSchema();
  const tpl = await getPathTemplate(params.templateId);
  if (!tpl) return { ok: false as const, code: "NOT_FOUND" };
  if (tpl.status === "published") {
    await pool.query(`UPDATE admin_path_templates SET status = 'draft' WHERE id = ?`, [params.templateId]);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (params.title != null) {
    updates.push("title = ?");
    values.push(String(params.title).trim().slice(0, 200));
  }
  if (params.description !== undefined) {
    updates.push("description = ?");
    values.push(params.description ? String(params.description).slice(0, 5000) : null);
  }
  if (updates.length) {
    values.push(params.templateId);
    await pool.query(`UPDATE admin_path_templates SET ${updates.join(", ")} WHERE id = ?`, values);
  }

  if (Array.isArray(params.items)) {
    const resolved = resolveItems(params.items);
    await pool.query(`DELETE FROM admin_path_template_items WHERE template_id = ?`, [params.templateId]);
    for (const item of resolved) {
      await pool.query(
        `INSERT INTO admin_path_template_items
         (template_id, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          params.templateId,
          item.sortIndex,
          item.gateNumber,
          item.chapterTitle,
          item.lessonId,
          item.itemType,
          item.title,
          item.required ? 1 : 0,
        ]
      );
    }
  }

  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    action: "path_template.save_draft",
    meta: { template_id: params.templateId, item_count: params.items?.length },
  });
  return { ok: true as const };
}

export async function publishPathTemplate(templateId: number, actorUserId: number) {
  await ensurePathAdminSchema();
  const tpl = await getPathTemplate(templateId);
  if (!tpl) return { ok: false as const, code: "NOT_FOUND" };
  if (!tpl.items.length) {
    return { ok: false as const, code: "EMPTY", message: "Lộ trình cần ít nhất một bài học trước khi xuất bản." };
  }
  const nextVersion = tpl.status === "published" ? tpl.version + 1 : tpl.version;
  await pool.query(
    `UPDATE admin_path_templates
     SET status = 'published', version = ?, published_at = NOW()
     WHERE id = ?`,
    [nextVersion, templateId]
  );
  await writeAdminAuditLog({
    actorUserId,
    action: "path_template.publish",
    meta: { template_id: templateId, version: nextVersion },
  });
  return { ok: true as const, version: nextVersion };
}

export async function duplicatePathTemplate(templateId: number, actorUserId: number) {
  const tpl = await getPathTemplate(templateId);
  if (!tpl) return { ok: false as const, code: "NOT_FOUND" };
  const created = await createPathTemplate({
    title: `${tpl.title} (bản sao)`,
    description: tpl.description || undefined,
    createdBy: actorUserId,
  });
  if (!created.ok) return created;
  await savePathTemplateDraft({
    templateId: created.id,
    actorUserId,
    items: tpl.items.map((i) => ({ lessonId: i.lessonId, sortIndex: i.sortIndex, required: i.required })),
  });
  return { ok: true as const, id: created.id };
}
