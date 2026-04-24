# ---------- Stage 1: build the client (TanStack Start) ----------
FROM node:20-slim AS client-build
WORKDIR /app

# Install all deps (incl. dev) for the build
COPY package.json package-lock.json* bun.lockb* ./
RUN npm install --no-audit --no-fund

# Copy the rest of the frontend source
COPY . .

# Build the app — outputs to ./dist (client assets under dist/client)
RUN npm run build


# ---------- Stage 2: install server prod deps ----------
FROM node:20-slim AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev


# ---------- Stage 3: runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=1990
ENV DB_PATH=/data/battleship.db
ENV STATIC_DIR=/app/public

# Server code + node_modules
COPY server/src ./server/src
COPY server/package*.json ./server/
COPY --from=server-deps /app/server/node_modules ./server/node_modules

# Built client assets — served as static files by the Node server
COPY --from=client-build /app/dist/client ./public

EXPOSE 1990
VOLUME ["/data"]

CMD ["node", "server/src/index.js"]
