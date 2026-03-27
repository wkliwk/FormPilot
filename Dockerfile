# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# ---- Dev ----
# Usage: docker compose up (runs dev server with hot reload)
FROM base AS dev
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- Build ----
FROM base AS build
RUN npx prisma generate
RUN npm run build

# ---- Prod ----
# NOTE: For a smaller production image, add `output: "standalone"` to
# next.config.ts and switch CMD to: node .next/standalone/server.js
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "start"]
