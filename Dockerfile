FROM node:22-slim

WORKDIR /app/backend

# Native deps for ffmpeg-static / optional ML packages on glibc (Render-friendly).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend ./

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 10000) + '/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node scripts/render-check.js && node src/server.js"]
