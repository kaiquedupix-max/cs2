FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends aapt apksigner default-jre-headless ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY . .
ENV NODE_ENV=production PORT=3000 CF_FILE_DIR=/app/data/counterframe
EXPOSE 3000
CMD ["node","server.js"]
