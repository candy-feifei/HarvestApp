# 统一用 Debian bookworm，避免 Alpine(musl) 下 bcrypt 编译失败，
# 且与 Prisma 预编译 query engine 的平台一致（linux glibc）。

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# 供 `postinstall: prisma generate` 找到 `prisma/schema.prisma`（仅 copy 包文件时还没有 schema 会失败）
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# 生产镜像不装 devDependencies，故无 `prisma` CLI；根目录的 `postinstall: prisma generate` 会失败，先移除
RUN npm pkg delete scripts.postinstall
RUN npm ci --omit=dev
# Prisma CLI 与 builder 中一致（避免再装一遍引发 peer/平台问题）
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
