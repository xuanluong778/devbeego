/**
 * Learn Call LLM stream & token ordering utility.
 * Guarantees in-order token processing, sequential dispatch, and proper lifecycle/cancel handling.
 */

export function parseSseLine(rawLine) {
  const line = String(rawLine || "").trim();
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload) return null;
  if (payload === "[DONE]") return { done: true, delta: "", finishReason: null };

  try {
    const json = JSON.parse(payload);
    const choice = json.choices?.[0];
    const delta = choice?.delta?.content || "";
    const finishReason = choice?.finish_reason || null;
    return {
      done: false,
      delta,
      finishReason,
      truncated: finishReason === "length",
    };
  } catch (_e) {
    return null;
  }
}

/**
 * An async sequential token processor queue.
 * Ensures tokens are dispatched and awaited strictly in FIFO order,
 * eliminating race conditions when token callbacks perform async operations.
 */
export function createOrderedTokenQueue(onToken) {
  let chain = Promise.resolve();
  let aborted = false;
  let count = 0;

  return {
    push(token, meta) {
      if (aborted) return chain;
      count += 1;
      chain = chain.then(async () => {
        if (aborted) return;
        await onToken(token, meta);
      });
      return chain;
    },
    async flush() {
      await chain;
      return { count, aborted };
    },
    abort() {
      aborted = true;
    },
    isAborted() {
      return aborted;
    },
    size() {
      return count;
    },
  };
}

/**
 * Stream an SSE response from OpenAI Chat Completion.
 * Sequentially awaits onToken callback for every token, ensuring:
 * 1. Sequential token order regardless of callback duration.
 * 2. Completion of all token processing before resolving.
 * 3. Graceful handling of AbortSignal / cancellation.
 * 4. Proper detection of finish_reason ("length", "stop").
 *
 * @param {object} opts
 * @param {Response} opts.response Fetch response with readable stream body
 * @param {(token: string, meta: { finishReason: string|null, truncated: boolean }) => Promise<void>|void} opts.onToken
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ aborted: boolean, truncated: boolean, count: number }>}
 */
export async function streamOpenAIChatSse({ response, onToken, signal }) {
  if (!response?.ok || !response?.body) {
    throw new Error(`OpenAI chat stream failed: HTTP ${response?.status || "unknown"}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  let truncated = false;
  let count = 0;

  try {
    for (;;) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch (_) {}
        return { aborted: true, truncated, count };
      }

      const { done, value } = await reader.read();

      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch (_) {}
        return { aborted: true, truncated, count };
      }

      if (done) break;

      carry += decoder.decode(value, { stream: true });
      const lines = carry.split("\n");
      carry = lines.pop() || "";

      for (const line of lines) {
        if (signal?.aborted) {
          try {
            await reader.cancel();
          } catch (_) {}
          return { aborted: true, truncated, count };
        }

        const parsed = parseSseLine(line);
        if (!parsed) continue;
        if (parsed.done) return { aborted: false, truncated, count };

        if (parsed.truncated) truncated = true;
        if (parsed.delta || parsed.finishReason) {
          count += 1;
          await onToken(parsed.delta, {
            finishReason: parsed.finishReason,
            truncated: parsed.truncated,
          });
        }
      }
    }

    // Process any remaining data in carry buffer
    if (carry && !signal?.aborted) {
      const parsed = parseSseLine(carry);
      if (parsed && !parsed.done) {
        if (parsed.truncated) truncated = true;
        if (parsed.delta || parsed.finishReason) {
          count += 1;
          await onToken(parsed.delta, {
            finishReason: parsed.finishReason,
            truncated: parsed.truncated,
          });
        }
      }
    }

    return { aborted: false, truncated, count };
  } finally {
    try {
      reader.releaseLock?.();
    } catch (_) {}
  }
}

