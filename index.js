/**
 * dsh-reviewer
 * 让 DeepSeek Harness 以「代码评审专家（质量守门员）」角色工作。
 *
 * 这是「高级开发工程师」套件中的独立评审插件。与 dsh-senior-developer（开发本体）
 * 配合使用时，本插件补齐「写完代码后的自检 + 被要求评审时的四维度改进点 + 测试策略」。
 * 不需要时直接卸载本插件即可，无需改任何配置文件。
 *
 * 分发为 bundle：cordis.patch.yml 插入本行。可通过该行 config 控制：
 *   text     — 自定义角色文本（不填则用内置「代码评审专家」默认角色）
 *   name     — section 名（默认 dsh-reviewer:reviewer）
 *   order    — 排序（默认 60；排在开发核心段 50 之后）
 *   complete — true 时本段成为完整 system prompt，抑制其它段（慎用）
 *
 * systemPrompt 服务由 @deepseek-ai/dsh-base 提供，本插件无运行时依赖。
 * @module dsh-reviewer
 */

/** Cordis 插件名 */
export const name = 'reviewer'

/** 依赖的系统提示词注册表 */
export const inject = ['systemPrompt']

/** 默认排序值（排在开发核心段 50 之后） */
const DEFAULT_ORDER = 60

/* ===================== 角色文本 ===================== */

/**
 * 评审角色：代码评审专家 / 质量守门员。始终注入（除非卸载插件）。
 */
const REVIEWER_ROLE = `# 角色：代码评审专家（Reviewer / 质量守门员）

你是一名运行在 DeepSeek Harness（dsh）中的「代码评审专家」，专注于代码质量与工程纪律。你既可以在被明确要求评审时给出四维度改进点，也会在自主写码后内部过一遍自检——你是团队里那个「写完还要挑自己刺」的人。

## 代码自检（每次写码后内部过一遍）
- 可无错误编译 / 解释运行；必要 import / require / 类型已处理；命名清晰无拼写错误。
- 无硬编码密钥（一律走环境变量 / 配置）；已处理边界（空值、空数组、异常输入、超时）。
- 数据库参数已绑定（防 SQL 注入）；用户输入展示已转义（防 XSS）；文件上传做了类型 / 大小校验。
- 性能合理：避免 N+1 查询、明显 O(n²)、无意义全表扫描；高频路径考虑缓存与批处理。
- 依赖克制：只用成熟、维护中的依赖，按需引入，不为一个小功能拉入重型库；引入前评估体积与供应链风险。

## 四维度评审（被要求评审代码时）
从以下四个维度给出**可执行的改进点**，而不是泛泛而谈：
1. **正确性**：逻辑错误、边界、并发、异常路径是否覆盖。
2. **安全**：注入 / 越权 / 密钥 / 输入校验 / 依赖供应链。
3. **性能**：算法复杂度、查询效率、不必要的重复计算或 IO。
4. **可维护性**：命名、结构、重复代码、职责划分、注释是否必要且精简。

## 测试策略
- 对非平凡逻辑编写测试；测试层级（单元 / 集成 / e2e）与投入随风险递增：核心算法、边界、并发、数据迁移必须覆盖。
- 改完代码跑通既有测试与构建；引入或升级依赖时评估维护状态、体积与供应链安全。`

/* ===================== 注册逻辑 ===================== */

/**
 * 注册角色段落到挂载上下文的 scope。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} [config] - { text?, name?, order?, complete? }
 */
export function apply(ctx, config) {
  const cfg = config && typeof config === 'object' ? config : {}

  if (!ctx.systemPrompt || typeof ctx.systemPrompt.section !== 'function') {
    ctx.logger?.error?.(
      'reviewer: 未检测到可用的 systemPrompt.section 服务（需 @deepseek-ai/dsh-base）。' +
      '角色段落未注入，请检查 dsh 版本或插件依赖。'
    )
    return
  }

  const rawText = typeof cfg.text === 'string' ? cfg.text.trim() : ''
  const text = rawText || REVIEWER_ROLE
  const order = Number.isFinite(cfg.order) ? cfg.order : DEFAULT_ORDER
  const complete = cfg.complete === true

  if (cfg.complete !== undefined && cfg.complete !== true && cfg.complete !== false) {
    ctx.logger?.warn?.(
      'reviewer: `complete` 仅接受布尔 true；收到 ' +
      JSON.stringify(cfg.complete) + '，已忽略（本段不会成为完整 system prompt）。'
    )
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: cfg.name || 'dsh-reviewer:reviewer',
    order,
    text,
    ...(complete ? { complete: true } : {}),
  }), 'dsh-reviewer:reviewer')
}
