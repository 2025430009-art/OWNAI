FROM node:22-alpine

WORKDIR /app

# Install only what backend workspace needs first (better layer cache).
COPY package.json ./
COPY backend/package.json ./backend/package.json
RUN npm install --workspace=backend

# Copy backend source after dependencies.
COPY backend ./backend

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=backend"]
