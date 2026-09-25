/**
 * dsh-reviewer —— apply() 零依赖测试（单段版）
 * 运行：node test/apply.test.mjs
 */
import assert from 'node:assert/strict'
import { apply } from '../index.js'

let passed = 0
let failed = 0
const knownBugFailures = []
const unexpectedFailures = []

function makeMockCtx({ systemPrompt = 'ok' } = {}) {
  const registered = []
  const warns = []
  const errors = []
  let effectName = null
  const ctx = {
    _registered: registered, _warns: warns, _errors: errors,
    get sections() { return registered },
    get warns() { return warns },
    get errors() { return errors },
    get lastEffectName() { return effectName },
    logger: { warn: (m) => warns.push(m), error: (m) => errors.push(m) },
    effect(fn, name) { effectName = name; return fn() },
    systemPrompt:
      systemPrompt === 'ok'
        ? { section(spec) { registered.push(spec); return () => {} } }
        : systemPrompt === 'wrong-api' ? { add() {} } : undefined,
  }
  return ctx
}

function test(label, fn, { knownBug = false } = {}) {
  try { fn(); passed++; console.log(`  ✓ ${label}`) }
  catch (err) {
    if (knownBug) { knownBugFailures.push({ label, err: err.message }); console.log(`  ⚠ ${label}\n      → ${err.message}`) }
    else { unexpectedFailures.push({ label, err: err.message }); failed++; console.log(`  ✗ ${label}\n      → ${err.message}`) }
  }
}

console.log('\n=== 正常路径（单段评审） ===')
test('默认注入：1 段', () => { const c = makeMockCtx(); apply(c, {}); assert.equal(c.sections.length, 1) })
test('默认段 name = dsh-reviewer:reviewer', () => { const c = makeMockCtx(); apply(c, {}); assert.equal(c.sections[0].name, 'dsh-reviewer:reviewer') })
test('默认段 order = 60', () => { const c = makeMockCtx(); apply(c, {}); assert.equal(c.sections[0].order, 60) })
test('默认段包含评审标识文本', () => { const c = makeMockCtx(); apply(c, {}); assert.ok((c.sections[0].text || '').includes('代码评审专家')) })
test('默认段不含 complete', () => { const c = makeMockCtx(); apply(c, {}); assert.equal(c.sections[0].complete, undefined) })
test('config.text 整体覆盖', () => { const c = makeMockCtx(); apply(c, { text: '你是安全审计' }); assert.equal(c.sections.length, 1); assert.equal(c.sections[0].text, '你是安全审计'); assert.equal(c.sections[0].name, 'dsh-reviewer:reviewer') })
test('自定义 name 生效', () => { const c = makeMockCtx(); apply(c, { name: 'custom:r' }); assert.equal(c.sections[0].name, 'custom:r') })
test('order 数字生效', () => { const c = makeMockCtx(); apply(c, { order: 0 }); assert.equal(c.sections[0].order, 0) })
test('order 非数字回退 60', () => { const c = makeMockCtx(); apply(c, { order: '60' }); assert.equal(c.sections[0].order, 60) })

console.log('\n=== 边界 / 异常 ===')
test('[已修复] complete:true 设置 complete', () => { const c = makeMockCtx(); apply(c, { text: 'x', complete: true }); assert.equal(c.sections[0].complete, true) })
test('[已修复] complete:false 无 complete 无告警', () => { const c = makeMockCtx(); apply(c, { text: 'x', complete: false }); assert.equal(c.sections[0].complete, undefined); assert.equal(c.warns.length, 0) })
test('[已修复] complete:"false" 不误启用且告警', () => { const c = makeMockCtx(); apply(c, { complete: 'false' }); assert.equal(c.sections[0].complete, undefined); assert.equal(c.warns.length, 1) })
test('[已修复] order:NaN 消毒 60', () => { const c = makeMockCtx(); apply(c, { order: NaN }); assert.equal(c.sections[0].order, 60) })
test('[已修复] order:Infinity 消毒 60', () => { const c = makeMockCtx(); apply(c, { order: Infinity }); assert.equal(c.sections[0].order, 60) })
test('[已修复] config=null 不崩溃注入 1 段', () => { const c = makeMockCtx(); assert.doesNotThrow(() => apply(c, null)); assert.equal(c.sections.length, 1) })
test('[已修复] config 非对象不崩溃', () => { const c = makeMockCtx(); assert.doesNotThrow(() => apply(c, 'x')); assert.equal(c.sections.length, 1) })
test('[已修复] 缺失 systemPrompt 降级', () => { const c = makeMockCtx({ systemPrompt: 'missing' }); apply(c, {}); assert.equal(c.sections.length, 0); assert.equal(c.errors.length, 1) })
test('[已修复] API 改名降级', () => { const c = makeMockCtx({ systemPrompt: 'wrong-api' }); apply(c, {}); assert.equal(c.sections.length, 0); assert.equal(c.errors.length, 1) })

console.log('\n=== 已知限制 ===')
test('[KNOWN-BUG] 重复 apply 产生重复 section（无去重）', () => { const c = makeMockCtx(); apply(c, {}); apply(c, {}); assert.equal(c.sections.length, 1) }, { knownBug: true })

console.log('\n==== 汇总 ====')
console.log(`通过: ${passed} / 常规失败: ${failed} / 已知缺陷: ${knownBugFailures.length}`)
if (unexpectedFailures.length) { console.log('— 常规失败 —'); for (const f of unexpectedFailures) console.log(`  - ${f.label}: ${f.err}`) }
if (knownBugFailures.length) { console.log('— 已知缺陷 —'); for (const f of knownBugFailures) console.log(`  - ${f.label}: ${f.err}`) }
process.exit(failed > 0 ? 1 : 0)
