/** Align Azure word assessments onto passage tokens. Never marks a word wrong without an Azure error. */

export function normalizeSpoken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^a-z0-9']+/g, "");
}

/**
 * @param {{text:string}[]} tokens display tokens, whitespace included
 * @param {{word:string,error:string,accuracy:number|null,phonemes?:object[]}[]} azureWords
 */
export function alignAzureWords(tokens, azureWords) {
  const queue = (Array.isArray(azureWords) ? azureWords : []).filter(
    (row) => row && String(row.error || "") !== "Insertion"
  );
  let cursor = 0;
  return (tokens || []).map((token) => {
    const key = normalizeSpoken(token?.text);
    if (!key) return { status: "space" };
    let found = -1;
    const end = Math.min(queue.length, cursor + 4);
    for (let i = cursor; i < end; i += 1) {
      if (normalizeSpoken(queue[i].word) === key) {
        found = i;
        break;
      }
    }
    if (found < 0) return { status: "unknown" };
    cursor = found + 1;
    const row = queue[found];
    const error = String(row.error || "None");
    const base = {
      error,
      accuracy: row.accuracy == null ? null : Number(row.accuracy),
      phonemes: Array.isArray(row.phonemes) ? row.phonemes : [],
    };
    if (error === "Mispronunciation" || error === "Omission") return { status: "bad", ...base };
    return { status: "ok", ...base };
  });
}

export function errorLabelVi(error) {
  if (error === "Mispronunciation") return "Azure đánh dấu phát âm chưa khớp từ này.";
  if (error === "Omission") return "Azure đánh dấu từ này bị bỏ sót.";
  if (error === "UnexpectedBreak" || error === "MissingBreak" || error === "Monotone") {
    return "Âm từ ổn. Azure chỉ ghi nhận ngắt hoặc ngữ điệu khác mẫu.";
  }
  if (error === "None") return "Azure không đánh dấu lỗi ở từ này.";
  return "";
}
