FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
USER node
EXPOSE 3211
ENV NODE_ENV=production PORT=3211
CMD ["node", "src/bot.js"]
