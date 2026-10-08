// Beego voice stack — port 3031 (3001 occupied by docker)
// Usage: pm2 start ecosystem.voice.config.cjs

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
  ],
};
