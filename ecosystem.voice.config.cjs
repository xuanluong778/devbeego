// Beego voice stack — port 3031 (3001 occupied by docker)
// Usage: pm2 start ecosystem.voice.config.cjs

const fs = require("fs");
const path = require("path");

function parseEnv(file) {
  try {
    const content = fs.readFileSync(file, "utf8");
    const res = {};
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq > 0) {
        res[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
      }
    }
    return res;
  } catch {
    return {};
  }
}

const dockerEnv = parseEnv(path.join(__dirname, ".env.docker"));

module.exports = {
  apps: [
    {
      name: "beego-voice-gateway",
      cwd: "/var/www/beego_vn_usr/data/www/beego.vn",
      script: "scripts/voice-ws-gateway.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: {
        NODE_ENV: "production",
        VOICE_WS_PORT: "3031",
      },
      max_memory_restart: "400M",
      autorestart: true,
    },
    {
      name: "beego-voice-llm",
      cwd: "/var/www/beego_vn_usr/data/www/beego.vn",
      script: "scripts/voice-llm-worker.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      autorestart: true,
    },
    {
      name: "beego-voice-tts",
      cwd: "/var/www/beego_vn_usr/data/www/beego.vn",
      script: "scripts/voice-tts-worker.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      autorestart: true,
    },
    {
      name: "beego-voice-usage",
      cwd: "/var/www/beego_vn_usr/data/www/beego.vn",
      script: "scripts/voice-usage-worker.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: { NODE_ENV: "production" },
      max_memory_restart: "200M",
      autorestart: true,
    },
    {
      name: "beego-voice-realtime-watchdog",
      cwd: __dirname,
      script: "scripts/voice-realtime-watchdog.mjs",
      node_args: "--env-file=.env.docker",
      env: {
        NODE_ENV: "production",
        ...dockerEnv,
        REDIS_URL: "redis://127.0.0.1:6399",
      },
      max_memory_restart: "200M",
      autorestart: true,
    },
  ],
};
