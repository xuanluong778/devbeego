import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const createConfig = (phase) => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  const distDir = process.env.NEXT_DIST_DIR && process.env.NEXT_DIST_DIR !== ".next"
    ? process.env.NEXT_DIST_DIR
    : ".next";
  return {
    distDir,
    async headers() {
      return [
        {
          source: "/downloads/beego.apk",
          headers: [
            {
              key: "Content-Type",
              value: "application/vnd.android.package-archive",
            },
            {
              key: "Content-Disposition",
              value: 'attachment; filename="beego.apk"',
            },
          ],
        },
      ];
    },
    experimental: {
      instrumentationHook: true,
      // Limit workers on memory-constrained hosts
      cpus: 1,
      workerThreads: false,
    },
    // Cho phép HMR / _next khi mở app qua tunnel (ngrok, v.v.) — xem https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
    allowedDevOrigins: isDevServer
      ? ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app", "*.loca.lt"]
      : undefined,
    // Trên Windows, cache webpack dev dễ lệch chunk → 404 layout.css / main-app.js. Tắt cache khi dev.
    webpack: (config, { dev }) => {
      if (dev) {
        config.cache = false;
      }
      return config;
    },
  };
};

export default createConfig;
