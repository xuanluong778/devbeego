FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time public env (must match production domain)
ARG NEXT_PUBLIC_APP_URL=https://dev.beego.vn
ARG NEXT_PUBLIC_VOICE_WS_URL=wss://dev.beego.vn/voice
ARG LEARN_AI_CALL_WS_URL=wss://dev.beego.vn/voice-learn
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_VOICE_WS_URL=$NEXT_PUBLIC_VOICE_WS_URL
ENV LEARN_AI_CALL_WS_URL=$LEARN_AI_CALL_WS_URL
RUN npm run build && test -f .next/BUILD_ID

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -u 1001 beego
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app ./app
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/jsconfig.json ./
COPY --from=builder /app/instrumentation.ts ./
RUN chown -R beego:beego /app
USER beego
EXPOSE 3025 3031 3033
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3025"]
