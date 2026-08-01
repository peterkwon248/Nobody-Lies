/**
 * ─────────────────────────────────────────────────────────────
 *  증명 사슬 계측 — `npm run proof-check [건수]`
 * ─────────────────────────────────────────────────────────────
 *
 * **「이 답이 왜 유일한가」를 기계가 적을 수 있는 공란이 몇 개인가**를 센다.
 * `plan-check` 이 도면에 한 것을 공란에 한다.
 *
 * ⛔ **게이트에 걸지 않는다.** 덮인 비율이 곧 「규칙표가 얼마나 자랐나」인데
 * 기준치가 없다 — `world-check`·`voice-check`·`plan-check` 과 같은 자리다.
 * 대신 **verifier §6.8 이 「증명 없음」을 경고로 문다**(그쪽은 기준이 있다).
 *
 * 인수 없이 부르면 커밋된 사건 전건, 숫자를 주면 그만큼 생성해서 센다.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { parseCase } from './schema.js'
import { generateCase } from './generate.js'
import { proveBlanks, type BlankProof } from './proof.js'
import type { Case } from './types.js'

const n = Number(process.argv[2] ?? 0)
const cases: { id: string; c: Case }[] = []

if (n > 0) {
  for (let i = 1; i <= n; i++) cases.push({ id: `gen-${i}`, c: generateCase(i) as Case })
} else {
  const dir = join('cases')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml'))) {
    const path = join(dir, f)
    cases.push({ id: f.replace(/\.yaml$/, ''), c: parseCase(load(readFileSync(path, 'utf8')), path) })
  }
}

let total = 0
let proved = 0
let free = 0
const byLabel = new Map<string, { n: number; ok: number }>()
const ruleHits = new Map<string, number>()
const naked: BlankProof[] = []

for (const { c } of cases) {
  for (const p of proveBlanks(c)) {
    total++
    const b = byLabel.get(p.label) ?? { n: 0, ok: 0 }
    b.n++
    if (p.unique) {
      proved++
      b.ok++
      for (const s of p.steps) ruleHits.set(s.rule, (ruleHits.get(s.rule) ?? 0) + 1)
      if (p.cost === 0) free++
    } else naked.push(p)
    byLabel.set(p.label, b)
  }
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : '—')

console.log(`\n  사건 ${cases.length}건 · 공란 ${total}개\n`)
console.log(`  증명됨        ${String(proved).padStart(4)} / ${total}   ${pct(proved, total)}`)
console.log(`  증명 없음     ${String(total - proved).padStart(4)}        ← 찍기이거나, 아직 규칙이 없는 자리`)
console.log(`  비용 0        ${String(free).padStart(4)}        ← 조사 없이 풀린다. 전제가 아니면 누설이다\n`)

console.log('  ── 라벨별 ──')
for (const [label, v] of [...byLabel.entries()].sort((a, b) => b[1].n - a[1].n))
  console.log(`    ${label.padEnd(12)} ${String(v.ok).padStart(4)} / ${String(v.n).padEnd(4)}  ${pct(v.ok, v.n)}`)

console.log('\n  ── 규칙별 발화 ──')
for (const [rule, k] of [...ruleHits.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`    ${rule.padEnd(16)} ${k}`)

if (naked.length) {
  console.log('\n  ── 증명이 안 나온 자리 (앞 12개) ──')
  for (const p of naked.slice(0, 12))
    console.log(`    ${p.chapter}장 '${p.label}' → ${p.answerLabel}   후보 ${p.candidates.length}`)
  if (naked.length > 12) console.log(`    … 그 밖 ${naked.length - 12}개`)
}

/** 사슬을 한 건만 눈으로 보여준다 — 「증명」이 무엇인지 문서 대신 출력으로 말한다 */
const sample = cases[0] && proveBlanks(cases[0].c).find((p) => p.unique && p.steps.length)
if (sample) {
  console.log(`\n  ── 사슬 표본 (${cases[0]!.id} · ${sample.chapter}장 '${sample.label}') ──`)
  console.log(`    답 ${sample.answerLabel}   후보 ${sample.candidates.length}개에서 시작`)
  for (const s of sample.steps)
    console.log(`      · ${s.observation}  [비용 ${s.cost} · ${s.rule}]  → 남은 후보 ${s.remaining}`)
}
console.log('')
