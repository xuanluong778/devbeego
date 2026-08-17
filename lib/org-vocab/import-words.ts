import * as XLSX from "xlsx";
import type { ImportWordInput } from "@/lib/org-vocab/types";

function normalizeKey(key: string): string {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return "";
}

function normalizePos(raw: string): string {
  const pos = String(raw || "").trim().toLowerCase();
  if (!pos) return "other";
  if (pos === "n" || pos === "noun" || pos === "pl") return "noun";
  if (pos === "v" || pos === "verb") return "verb";
  if (pos === "adj" || pos === "adjective") return "adjective";
  if (pos === "adv" || pos === "adverb") return "adverb";
  return pos.slice(0, 50);
}

export function normalizeImportRow(raw: Record<string, unknown>): ImportWordInput | null {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw || {})) {
    row[normalizeKey(k)] = v;
  }

  const word = pickField(row, ["word", "tu", "english", "từ"]);
  const meaning_vi = pickField(row, [
    "meaning_vi",
    "meaning",
    "vietnamese_meaning",
    "nghia",
    "nghĩa",
    "vietnamese",
  ]);

  if (word.length < 2 || !meaning_vi) return null;

  return {
    word,
    meaning_vi,
    ipa: pickField(row, ["ipa", "pronunciation", "phonetic"]) || undefined,
    part_of_speech: normalizePos(pickField(row, ["part_of_speech", "pos", "loai_tu"])),
    example_sentence: pickField(row, ["example_sentence", "example", "cau_vi_du"]) || undefined,
    example_vi: pickField(row, ["example_vi", "example_sentence_vi", "cau_vi"]) || undefined,
    level: pickField(row, ["level", "cap_do"]) || "beginner",
    topic: pickField(row, ["topic", "chu_de"]) || undefined,
  };
}

export function normalizeImportRows(rows: Record<string, unknown>[]): ImportWordInput[] {
  const out: ImportWordInput[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const row = normalizeImportRow(raw);
    if (!row) continue;
    const key = row.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function parseImportBuffer(buffer: Buffer, filename = ""): ImportWordInput[] {
  const ext = String(filename).split(".").pop()?.toLowerCase() || "";
  if (ext === "csv" || ext === "txt") {
    const text = buffer.toString("utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(delimiter).map((h) => normalizeKey(h.replace(/^"|"$/g, "")));
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? "";
      });
      return obj;
    });
    return normalizeImportRows(rows);
  }

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return normalizeImportRows(rows);
}

export function parseImportJsonBody(body: unknown): ImportWordInput[] {
  if (!Array.isArray(body)) return [];
  return normalizeImportRows(body as Record<string, unknown>[]);
}
