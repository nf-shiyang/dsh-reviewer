# DSH 插件「代码评审专家」— 适配与交接指南

> **用途**：当 DeepSeek Harness（dsh）大版本更新、本插件可能失效时，把**整个这个文件夹**整体发给任意 AI，让它照本指南核对并改写，使其兼容新版 dsh。

## 0. 一句话定位

这是 **dsh bundle 插件「代码评审专家」**：向 dsh 的 system prompt 注入「代码评审专家（质量守门员）」单段角色。它是「高级开发工程师套件」的一员：

- `github:nf-shiyang/DSH` —— 开发本体（全栈开发 + PM）
- `github:nf-shiyang/dsh-reviewer` —— **本插件（代码评审）**
- `github:nf-shiyang/dsh-docs` —— 技术文档
- `github:nf-shiyang/dsh-devops` —— 部署运维

默认角色文本在 `index.js` 的 `REVIEWER_ROLE` 常量，可通过 `config.text` 整体替换。

## 1. 文件清单

| 文件 | 作用 |
|------|------|
| `index.js` | 主体（ESM）。`name='reviewer'` / `inject=['systemPrompt']` / `apply(ctx,config)`；注入单段 `REVIEWER_ROLE` |
| `cordis.patch.yml` | bundle 挂载声明 |
| `package.json` | dsh bundle 声明 + peer 依赖 |
| `README.md` / `LICENSE` / `.gitignore` | 配套 |

## 2. 兼容契约（新版 dsh 核对 5 点）

### 2.1 注入接口（最关键）
```js
ctx.effect(() => ctx.systemPrompt.section({
  name: cfg.name || 'dsh-reviewer:reviewer',
  order,                                   // 默认 60
  text,                                    // config.text 覆盖 或 内置 REVIEWER_ROLE
  ...(complete ? { complete: true } : {}),
}), 'dsh-reviewer:reviewer')
```
`section()` 由 `@deepseek-ai/dsh-base` 提供（`inject: ['systemPrompt']`）。新版若改名（如 `ctx.prompt.addSection`），只改这一处调用。

### 2.2 模块格式
```js
export const name = 'reviewer'
export const inject = ['systemPrompt']
export function apply(ctx, config = {}) { ... }
```
> `apply` 实际未给默认参数，函数体内用 `const cfg = config && typeof config === 'object' ? config : {}` 兜底，对 `config` 为 null/undefined 安全。

### 2.3 Bundle 分发格式
`package.json` 须含：`"type":"module"`、`"dsh":{"bundle":{"patch":"./cordis.patch.yml"}}`、`"keywords":["dsh-plugin"]`。

### 2.4 cordis.patch.yml
```yaml
- insert:
    - id: reviewer
      name: 'dsh-reviewer'
      config:
        order: 60
```
顶层是 YAML 列表，`insert:` 项下是 `{id, name, config}`。

### 2.5 安装（0.1.x）
```sh
dsh plugin --profile web add github:nf-shiyang/dsh-reviewer
```

## 3. 已知良好版本
- 已验证兼容 **dsh 0.1.x**（含 0.1.7）。
- 依赖 cordis vendored 版本 `4.0.0-rc.7`。

## 4. 交给未来 AI 的执行清单
1. 核对 5 个契约点；2. 若 `section` 变则改 `index.js` 调用；3. 若 bundle 格式变则同步改；4. 更新 peer 版本；5. 更新 README 顶部版本；6. `node test/apply.test.mjs` 验证。

## 5. 备注（避免改坏）
- 角色文本 `REVIEWER_ROLE`（单段）。换角色改此常量或 `config.text`。
- `config.text` 空/非字符串时回退内置 `REVIEWER_ROLE`（务必保留，否则清空配置注入空段）。
- `order` 默认 60；`complete:true` 会抑制其它段，慎用。
- **重复挂载去重**：`index.js` 用模块级 `WeakMap` 按 `ctx + 段名` 记录已注册段落，同一上下文重复 `apply`（热重载 / 重复挂载）只注册一次并记 warn；teardown 释放段名以便重载重注册。新版适配保持此行为。
- 零运行时依赖，不要给 `index.js` 加 `import` 第三方包。

## 6. 快速还原命令
```sh
node --check index.js && node test/apply.test.mjs && git add -A && git commit -m "feat: adapt to dsh <新版本>" && git push
```
