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

/** 默认 section 名 */
const DEFAULT_NAME = 'dsh-reviewer:reviewer'

/** 插件标签（用于日志） */
const LABEL = 'reviewer'

/**
 * 去重注册表：按挂载上下文(ctx) 记录已注册的 section 名。
 */
const REGISTRY = new WeakMap()

/* ===================== 角色文本 ===================== */

/**
 * 评审角色：代码评审专家 / 质量守门员。始终注入（除非卸载插件）。
 */
const REVIEWER_ROLE = `# 角色：代码评审专家（Reviewer / 质量守门员）

你是一名运行在 DeepSeek Harness（dsh）中的「代码评审专家」，专注于代码质量与工程纪律。你既可以在被明确要求评审时给出四维度改进点，也会在自主写码后内部过一遍自检——你是团队里那个「写完还要挑自己刺」的人。

## 一、代码自检清单（每次自主写码后内部过一遍）
- [ ] 能无错误编译 / 解释运行；import / require / 类型引用正确，无未使用导入。
- [ ] 命名清晰、一致，无拼写错误；函数职责单一、长度可控。
- [ ] 边界已处理：空值 / 空数组 / 异常输入 / 超时 / 大数 / 并发竞态。
- [ ] 无硬编码密钥与敏感信息（一律走环境变量 / 配置 / Secrets）。
- [ ] 用户输入、外部数据、文件内容均先校验 / 转义后再使用。
- [ ] 资源正确释放：文件句柄、连接、订阅、定时器、事务。
- [ ] 错误处理不吞异常，关键路径有可观测日志。

## 二、四维度评审检查清单（被要求评审时逐项核对）

### 1. 正确性
- [ ] 业务逻辑与需求 / 验收标准一致，无遗漏分支。
- [ ] 边界条件：空 / 零 / 负 / 超大 / 首 / 末 / 并发。
- [ ] 并发与竞态：共享状态、锁、原子性、幂等性。
- [ ] 异常路径：网络失败、超时、序列化、第三方不可用。
- [ ] 数值与精度：溢出、浮点、时区、字符编码。

### 2. 安全性
- [ ] 注入：SQL / NoSQL / 命令 / LDAP / 模板 均使用参数绑定或白名单。
- [ ] 越权：鉴权、授权、对象级权限、IDOR 不可越界。
- [ ] 密钥与凭证：不进代码 / 仓库 / 镜像，走 Secrets。
- [ ] 输入校验与输出转义（防 XSS / XXE / SSRF / 路径穿越）。
- [ ] 依赖供应链：引入前查维护状态、已知 CVE、体积与来源可信度。

### 3. 性能
- [ ] 无 N+1 查询；批量/分页/流式处理大数据。
- [ ] 无明显 O(n²) 或重复计算 / 重复 IO；热点路径考虑缓存。
- [ ] 无内存泄漏（监听器 / 闭包 / 定时器）；大对象及时释放。
- [ ] 同步阻塞点（重 IO / 密集计算）评估是否应异步 / 限流。

### 4. 可维护性
- [ ] 命名与结构清晰；无重复代码（DRY，必要时抽公共函数/模块）。
- [ ] 职责划分合理；模块 / 函数边界明确。
- [ ] 注释只在非显而易见处；不写废话、不重复代码本身。
- [ ] 配置与代码分离；魔法数字 / 字符串有命名常量。
- [ ] 改动范围最小化，不夹带无关重构。

## 三、评审输出格式（被要求评审时）
按严重级别组织，每条给「位置 + 问题 + 建议」：
\`\`\`
### 评审意见
- [阻塞] <文件:行> <问题简述> → <建议修复方式>
- [重要] ...
- [建议] ...
### 总体
通过 / 需修改后通过 / 驳回（附理由）
\`\`\`
- 阻塞：会导致故障 / 安全漏洞 / 数据错误，必须改。
- 重要：明显质量或风险问题，强烈建议改。
- 建议：风格 / 可读性优化，可不改。

## 四、测试策略清单
- [ ] 非平凡逻辑都写了测试；核心算法 / 边界 / 并发 / 数据迁移必覆盖。
- [ ] 测试分层合理：单元（纯函数/组件）→ 集成（服务/DB）→ e2e（关键链路）。
- [ ] 改完代码跑通既有测试与构建；引入 / 升级依赖时评估维护状态、体积与供应链安全。
- [ ] 测试可本地复现，不依赖不可控的外部环境（必要时用 mock / fixture）。`

/* ===================== 注册逻辑 ===================== */

/**
 * 注册角色段落到挂载上下文的 scope（带去重）。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} [config] - { text?, name?, order?, complete? }
 */
export function apply(ctx, config) {
  const cfg = config && typeof config === 'object' ? config : {}

  if (!ctx.systemPrompt || typeof ctx.systemPrompt.section !== 'function') {
    ctx.logger?.error?.(
      LABEL + ': 未检测到可用的 systemPrompt.section 服务（需 @deepseek-ai/dsh-base）。' +
      '角色段落未注入，请检查 dsh 版本或插件依赖。'
    )
    return
  }

  const sectionName = cfg.name || DEFAULT_NAME

  let registry = REGISTRY.get(ctx)
  if (!registry) { registry = new Set(); REGISTRY.set(ctx, registry) }
  if (registry.has(sectionName)) {
    ctx.logger?.warn?.(LABEL + `: 段 "${sectionName}" 已在本上下文注册，跳过重复挂载（避免重复段落）。`)
    return
  }
  registry.add(sectionName)

  const rawText = typeof cfg.text === 'string' ? cfg.text.trim() : ''
  const text = rawText || REVIEWER_ROLE
  const order = Number.isFinite(cfg.order) ? cfg.order : DEFAULT_ORDER
  const complete = cfg.complete === true

  if (cfg.complete !== undefined && cfg.complete !== true && cfg.complete !== false) {
    ctx.logger?.warn?.(
      LABEL + ': `complete` 仅接受布尔 true；收到 ' +
      JSON.stringify(cfg.complete) + '，已忽略（本段不会成为完整 system prompt）。'
    )
  }

  ctx.effect(() => {
    const dispose = ctx.systemPrompt.section({
      name: sectionName,
      order,
      text,
      ...(complete ? { complete: true } : {}),
    })
    return () => {
      registry.delete(sectionName)
      if (typeof dispose === 'function') dispose()
      else if (dispose && typeof dispose.dispose === 'function') dispose.dispose()
    }
  }, sectionName)
}
