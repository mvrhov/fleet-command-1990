FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=8080
ENV DB_PATH=/data/battleship.db
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "src/index.js"]
