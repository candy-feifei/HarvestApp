# ChronaApp

本目录为 **ChronaApp** 全栈工程：`frontend`（Vite + React）、`backend`（NestJS + Prisma）、根目录 `docker-compose.yml` 可一键拉起 PostgreSQL、API 与前端（Nginx 反代 `/api`）。另有 `docs`、`prompts`、`AI` 等辅助资料目录。

## 在线访问

部署环境登录页（Chrona）：<http://118.25.197.181:8080/login>

本地默认可通过 `docker compose up -d --build` 启动后访问 `http://localhost:8080`（详见 `docker-compose.yml` 内注释）。
