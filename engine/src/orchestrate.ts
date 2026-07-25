import { generateCase } from './generate.js'
import { verify } from './verifier.js'
import type { Case, VerifyResult } from './types.js'

/**
 * 오케스트레이터 — 작가 · 비평가 · 실험자.
 *
 *   작가    generateCase()   조합으로 논리 골격을 만든다
 *   비평가  verify()         대부분을 버린다
 *   실험자  verify() 안의 simulate()  살아남은 것의 난이도를 잰다
 *
 * **셋 다 순수 코드다.** LLM이 없으므로 기기에서 돌고, 오프라인이고,
 * "이 사건은 N회로 풀린다"가 증명된 채로 나온다.
 * 산문은 이 루프 밖에서, 빌드 타임에, 파일에 고정된다.
 */

export type Judged = {
  seed: number
  case: Case
  result: VerifyResult
}

export type Batch = {
  tried: number
  passed: Judged[]
  /** 어떤 검사가 몇 번 걸렀는가. 생성기를 고칠 곳을 알려준다 */
  rejections: Map<string, number>
}

/** 오류 문구에서 검사 종류만 추린다 — 개별 id 를 지워 묶는다 */
function reason(msg: string): string {
  return msg.replace(/'[^']*'/g, "'…'").replace(/\d+/g, 'N').slice(0, 60)
}

/** 목표 난이도. 여기 들지 못하면 통과가 아니다 */
const WANTED = new Set<VerifyResult['difficulty']>(['normal', 'hard'])

/**
 * 예산은 작가가 정하지 않는다. **실험자가 찾는다.**
 *
 * 작가는 논리만 짜고, 몇 회로 풀리는지는 만들어봐야 안다.
 * 그래서 예산을 훑으며 목표 난이도에 드는 값을 고른다 —
 * 사람이 "예산 5가 맞나?" 를 손으로 고민하던 일이 이 루프로 대체된다.
 */
function fit(base: Case): { case: Case; result: VerifyResult } | { fail: VerifyResult } {
  let last = verify(base)
  if (!last.ok) return { fail: last }

  for (let budget = 2; budget <= 8; budget++) {
    const c = { ...base, budget }
    const r = verify(c)
    if (!r.ok) { last = r; continue }
    if (WANTED.has(r.difficulty)) return { case: c, result: r }
    last = r
  }
  return { fail: last }
}

export function run(seeds: number[]): Batch {
  const passed: Judged[] = []
  const rejections = new Map<string, number>()
  const note = (k: string) => rejections.set(k, (rejections.get(k) ?? 0) + 1)

  for (const seed of seeds) {
    let base: Case
    try {
      base = generateCase(seed)
    } catch (e) {
      note(`생성 실패: ${(e as Error).message.slice(0, 40)}`)
      continue
    }

    const out = fit(base)
    if ('case' in out) {
      passed.push({ seed, case: out.case, result: out.result })
      continue
    }
    if (out.fail.errors.length) out.fail.errors.forEach((e) => note(reason(e)))
    else note(`어떤 예산으로도 목표 난이도에 못 듦 (최종 ${out.fail.difficulty})`)
  }

  return { tried: seeds.length, passed, rejections }
}

/**
 * 배치 요약. **통과율보다 기각 사유가 중요하다** —
 * 어떤 검사가 계속 걸리는지가 생성기의 다음 수정 지점이다.
 */
export function report(b: Batch): string {
  const lines: string[] = []
  const rate = ((b.passed.length / b.tried) * 100).toFixed(0)
  lines.push(`  생성 ${b.tried}건 · 통과 ${b.passed.length}건 (${rate}%)`)

  if (b.passed.length) {
    const diffs = new Map<string, number>()
    for (const p of b.passed) diffs.set(p.result.difficulty, (diffs.get(p.result.difficulty) ?? 0) + 1)
    lines.push('')
    lines.push('  통과분 난이도')
    for (const [d, n] of [...diffs].sort((a, x) => x[1] - a[1]))
      lines.push(`    ${d.padEnd(12)}${n}건`)

    const budgets = new Map<number, number>()
    for (const p of b.passed) budgets.set(p.case.budget, (budgets.get(p.case.budget) ?? 0) + 1)
    lines.push('')
    lines.push('  실험자가 찾은 예산')
    for (const [k, n] of [...budgets].sort((a, x) => a[0] - x[0]))
      lines.push(`    ${String(k).padStart(2)}회      ${n}건`)

    const oracles = b.passed.map((p) => p.result.minActions)
    lines.push('')
    lines.push(`  최단 경로  ${Math.min(...oracles)}~${Math.max(...oracles)}회`)
  }

  if (b.rejections.size) {
    lines.push('')
    lines.push('  기각 사유 (많은 순)')
    for (const [k, n] of [...b.rejections].sort((a, x) => x[1] - a[1]).slice(0, 8))
      lines.push(`    ${String(n).padStart(4)}회  ${k}`)
  }
  return lines.join('\n')
}
