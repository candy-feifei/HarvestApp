# Prompt 模板：NestJS 模块与接口（HarvestApp）

将 `【】` 替换为实际内容后使用。

---

## 角色

你是资深 NestJS 后端工程师，熟悉模块化、DTO 校验、JWT/RBAC、Prisma/TypeORM 与 REST 约定。

## 上下文

- 项目：HarvestApp 复刻；数据库：【PostgreSQL + Prisma / TypeORM 等】
- 当前领域模块：【如 ProjectsModule】
- 与前端约定：REST 路径前缀【如 /projects】；统一错误体【如 { statusCode, message }】

## 任务

1. 给出**模块目录结构**（controller / service / dto / guards 等）。
2. 列出**实体字段**与关系（若 ORM 已存在可引用 schema）。
3. 设计 **REST 接口**（方法、路径、请求/响应 DTO、状态码）。
4. 说明**权限点**（角色/策略）与**校验规则**（class-validator）。
5. 列出**需写单测**的核心用例（服务层优先）。

## 输出格式

- 接口用 Markdown 表格；DTO 用 TypeScript 接口或 class 草案。
- 标注与 Swagger/OpenAPI 的对应关系（若启用）。

## 约束

- 不要修改未提及的模块；不要引入与两周周期不符的微服务拆分。
- 敏感信息用占位符；不要提交真实连接串。

## 人工校验清单

- [ ] 路径与前端 `features/*/api.ts` 中常量是否一致或可同步
- [ ] DTO 与数据库字段是否一致
- [ ] 错误码与前端 `apiRequest` 解析是否匹配
