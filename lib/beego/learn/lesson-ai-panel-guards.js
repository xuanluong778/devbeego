/** Pure gates for the Learn lesson AI panel. No network, no audio. */

export function assistToggleLabel(turn, open) {
  const translation = String(turn?.translation || "").trim();
  const explanation = String(turn?.vi || turn?.mistakes_explanation || "").trim();
  if (translation) return open ? "Ẩn dịch" : "Dịch";
  if (explanation) return open ? "Ẩn giải thích" : "Giải thích";
  return "";
}

export function assistToggleBody(turn) {
  const translation = String(turn?.translation || "").trim();
  if (translation) return { kind: "translation", text: translation };
  const explanation = String(turn?.vi || turn?.mistakes_explanation || "").trim();
  if (explanation) return { kind: "explanation", text: explanation };
  return null;
}

export function createPanelActivityGate() {
  let generation = 0;
  let closed = false;
  return {
    close() {
      closed = true;
      generation += 1;
    },
    isClosed() {
      return closed;
    },
    canApplyTranscript() {
      return !closed;
    },
    beginSpeak() {
      if (closed) return 0;
      generation += 1;
      return generation;
    },
    canFinishSpeak(token) {
      return !closed && token > 0 && token === generation;
    },
  };
}
