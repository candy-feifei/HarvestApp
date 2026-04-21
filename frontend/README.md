# HarvestApp 前端

基于 **React + TypeScript + Vite 6**、**Tailwind CSS v4**、**shadcn/ui**、**React Router**、**TanStack Query** 的管理台骨架，用于大赛 HarvestApp 主题开发与协作。

## 文档（协作必读）

| 文档 | 说明 |
|------|------|
| [docs/前端搭建说明.md](./docs/前端搭建说明.md) | 从零搭建步骤、技术选型原因、ESLint 与对接 Nest 注意点 |
| [docs/目录结构说明.md](./docs/目录结构说明.md) | 当前目录树、`features` 约定、与侧栏/路由的对应关系 |
| [../prompts/README.md](../prompts/README.md) | 仓库根目录团队通用 Prompt 模板（大赛 AI 过程材料） |

## 本地开发

```bash
cd frontend
npm install
npm run dev
```

可选环境变量（与 Nest 联调时在项目根创建 `.env`）：

```env
# 与后端 main.ts 中全局前缀 `api` 一致（无尾斜杠）
VITE_API_BASE_URL=http://localhost:3000/api
```

常用脚本：`npm run build`（生产构建）、`npm run lint`（代码检查）、`npm run preview`（预览构建产物）。

## 技术栈摘要

- **构建**：Vite 6、`@vitejs/plugin-react`
- **UI**：Tailwind v4、shadcn/ui（Radix Nova）、Lucide
- **路由**：React Router（`createBrowserRouter` + 懒加载）
- **请求与缓存**：`src/lib/api/http.ts` 中的 `apiRequest` + TanStack Query
- **鉴权（方案 B）**：登录后 `access_token` 存 **`sessionStorage`**（`lib/auth/access-token.ts`），`apiRequest` 自动带 `Authorization: Bearer`；401 清 token 并跳转登录；路由见 `/login` 与 `RequireAuth`

---

以下为创建工程时自带的 Vite 模板说明（英文），如需扩展 ESLint 可参考其中链接。

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
