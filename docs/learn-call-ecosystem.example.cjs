// Sample PM2 config for the Learn Call stack (gateway 3033 + Learn LLM/TTS workers).
// Mirrors the running beego-voice-*-learn apps. Contains no secrets: OPENAI_API_KEY,
// AZURE_SPEECH_KEY, VOICE_JWT_SECRET, REDIS_URL, DB_* come from .env.local via --env-file.
// The old speaking stack (ecosystem.voice.config.cjs, port 3031, queues voice-llm/voice-tts) is separate.
//
// Deploy the web app (pm2 "beego") and these three apps from the same commit; see docs/learn-call-deploy.md.

const cwd = "/var/www/beego_vn_usr/data/www/beego.vn";

const learnEnv = {
  NODE_ENV: "production",
  VOICE_WS_PORT: "3033",
  VOICE_LLM_QUEUE: "voice-llm-learn",
  VOICE_TTS_QUEUE: "voice-tts-learn",
  VOICE_USAGE_QUEUE: "voice-usage-learn",
  // Gateway refuses and ends Learn calls unless Redis key voice:learn-call-gate is "1".
  LEARN_AI_CALL_RUNTIME_GATE: "1",
  // Never set LEARN_AI_CALL_QUOTA_MODE=test in production.
};

module.exports = {
  apps: [
    {
      name: "beego-voice-gateway-learn",
      cwd,
      script: "scripts/voice-ws-gateway.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: learnEnv,
      autorestart: true,
    },
    {
      name: "beego-voice-llm-learn",
      cwd,
      script: "scripts/voice-llm-worker.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: learnEnv,
      autorestart: true,
    },
    {
      name: "beego-voice-tts-learn",
      cwd,
      script: "scripts/voice-tts-worker.mjs",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: learnEnv,
      autorestart: true,
    },
  ],
};
