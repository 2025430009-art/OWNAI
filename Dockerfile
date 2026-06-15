FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    vulkan-tools \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace=backend

COPY backend ./backend
COPY config ./config
COPY models ./models
COPY logs ./logs
COPY .env.example .env

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "src/server.js"]
