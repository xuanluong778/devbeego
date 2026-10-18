import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

export async function resolve(specifier, context, defaultResolve) {
  let target = specifier;
  if (target.startsWith("@/")) {
    let resolved = path.resolve(process.cwd(), target.slice(2));
    if (!path.extname(resolved)) {
      if (fs.existsSync(resolved + ".js")) resolved += ".js";
      else if (fs.existsSync(path.join(resolved, "index.js"))) resolved = path.join(resolved, "index.js");
    }
    return defaultResolve(pathToFileURL(resolved).href, context);
  }

  try {
    return await defaultResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && !path.extname(specifier)) {
      try {
        return await defaultResolve(specifier + ".js", context);
      } catch {}
      try {
        return await defaultResolve(specifier + "/index.js", context);
      } catch {}
    }
    throw err;
  }
}
