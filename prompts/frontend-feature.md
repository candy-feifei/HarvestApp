# Prompt 模板：前端领域功能（React + features/）

将 `【】` 替换为实际内容后使用。

---

## 角色

你是资深 React + TypeScript 工程师，熟悉 Vite、Tailwind、shadcn/ui、TanStack Query、React Router。

## 上下文

- 仓库约定：`frontend/src/features/<领域>/` 竖切；请求经 `apiRequest`；列表优先 `useQuery`。
- 当前领域：【如 projects】
- 相关文件：【可贴 `nav-config` 片段、OpenAPI 链接、或 Nest 接口表】
- 设计稿 / 交互：【链接或文字说明】

## 任务

1. 在指定路径下实现或调整【页面/组件】，满足【验收点列表】。
2. 使用已有 `components/ui`，避免重复造基础组件。
3. 对接接口【列出 URL 与方法】；处理 loading、空态、错误提示（可与 `ApiError` 对齐）。
4. 如需新路由，说明需改动的文件：`router.tsx`、`nav-config`（若菜单变更）。

## 输出格式

- 先给**文件变更清单**，再给**关键代码片段**或完整文件（按对话工具能力）。
- 说明依赖的 npm 包是否已存在；若需 `npx shadcn add`，单独列出。

## 约束

- 不改动无关 `features`；不删除已有注释除非替换为更清晰说明。
- 不使用真实密钥；环境变量仅 `VITE_*`。

## 人工校验清单

- [ ] `npm run build` / `npm run lint` 是否通过
- [ ] 路由与侧栏是否同步
- [ ] 401/403 行为是否符合当前鉴权方案（若已实现）
