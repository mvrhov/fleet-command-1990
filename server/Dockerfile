# This image only runs the standalone WebSocket server.
# For a single image that serves both the frontend and backend,
# build the repository-root Dockerfile instead.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=8080
ENV DB_PATH=/data/battleship.db
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "src/index.js"]

