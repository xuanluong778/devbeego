/**
 * Resolve Next.js `@/` imports for plain Node ESM scripts.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = path.join(root, specifier.slice(2));
    const tryPaths = [abs, abs + ".js", abs + ".jsx", abs + ".mjs", abs + "/index.js"];
    let lastErr;
    for (const p of tryPaths) {
      try {
        return await nextResolve(pathToFileURL(p).href, context);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }
  return nextResolve(specifier, context);
}
