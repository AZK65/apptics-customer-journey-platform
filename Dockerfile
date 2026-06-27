# Customer Journey Platform — app + WhatsApp/Telegram workers in one container.
# Node 22 (pnpm 11.9 requires >= 22.13).
FROM node:22-slim

# Chromium + fonts for headless WhatsApp Web (whatsapp-web.js / Puppeteer).
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-freefont-ttf \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app
RUN corepack enable

# Install deps (lockfile-frozen). pnpm-workspace.yaml carries the allowBuilds.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Shared volume for sessions + worker stores — MOUNT A RAILWAY VOLUME at /data.
ENV WHATSAPP_DATA_PATH=/data/whatsapp-store.json
ENV TELEGRAM_DATA_PATH=/data/telegram-store.json
ENV AD_STORE_PATH=/data/ad-attribution.json
ENV WWEBJS_AUTH_PATH=/data/.wwebjs-auth
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "boot.mjs"]
