const path = require("path");
const fs = require("fs");

const appDir = __dirname;
const envLocalPath = path.join(appDir, ".env.local");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

module.exports = {
  apps: [
    {
      name: "apptienganh",
      cwd: appDir,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        ...parseEnvFile(envLocalPath),
      },
    },
  ],
};
