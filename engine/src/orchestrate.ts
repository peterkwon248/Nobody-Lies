import { generateCase } from './generate.js'
import type { Palette } from './generate.js'
import { verify } from './verifier.js'
import type { Case, VerifyResult } from './types.js'

type Difficulty = VerifyResult['difficulty']

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

/** 목표 난이도의 기본값. 여기 들지 못하면 통과가 아니다 */
const WANTED: Difficulty[] = ['normal', 'hard']

export type RunOptions = {
  /** LLM이 채운 세계 팔레트. 없으면 생성기 기본 어휘 */
  palette?: Palette
  /** 보고서 장 수 (2~8). 기본 5 */
  chapters?: number
  /** 사망 구간 칸 수 (1~3). 기본 1 — 1이면 전과 같은 사건이 나온다 */
  deathCells?: number
  /**
   * 목표 난이도. **순서가 곧 선호도다** — 앞쪽을 먼저 고른다.
   *
   * 이것이 없던 동안 결과가 전부 `hard` 였다. 예산을 낮은 쪽부터 훑으면서
   * 「목표에 들면 즉시 반환」했기 때문이다 — 낮은 예산일수록 어려우므로
   * 항상 어려운 쪽이 먼저 걸렸다. **캠페인은 난이도가 올라가야 하므로
   * 무엇을 원하는지 말할 수 있어야 한다.**
   */
  want?: Difficulty[]
}

/**
 * 예산은 작가가 정하지 않는다. **실험자가 찾는다.**
 *
 * 작가는 논리만 짜고, 몇 회로 풀리는지는 만들어봐야 안다.
 * 그래서 예산을 훑어 **성립하는 (예산, 난이도) 쌍을 전부 모은 뒤**
 * 원하는 난이도를 고른다 — 사람이 "예산 5가 맞나?" 를 손으로 고민하던
 * 일이 이 루프로 대체된다.
 */
function fit(base: Case, want: Difficulty[]): { case: Case; result: VerifyResult } | { fail: VerifyResult } {
  /**
   * ⚠ **예산을 2..N 으로 훑고 있었다. 두 번 틀린 자리다.**
   *
   * 하나. 작가가 적어둔 예산으로 먼저 검증하고 실패하면 포기했다 — 예산을
   * 찾는 것이 이 함수의 일인데 예산 때문에 포기했다. 장 수를 늘리자 기본
   * 예산으로는 필수 조사를 못 담아 통과율이 0%가 됐다.
   *
   * 둘. 훑는 것 자체가 **낭비였다.** `budget` 은 검증기에서 **비교에만** 쓰이고
   * `simulate`·오라클 탐색 안에 안 들어간다 — 즉 **기대 회차는 예산과 무관하다.**
   * 그런데 예산마다 그 무거운 탐색을 다시 돌리고 있었다. 8장 사건에서는
   * 20건 생성이 5분을 넘겨 죽었다.
   *
   * 이제 **한 번 재고 산수로 예산을 정한다.** 난이도 정의가 곧 공식이다:
   *
   *     slack = budget − 기대       hard=0 · normal=1 · easy=2
   *     → budget = 기대 + slack
   *
   * 그 예산으로 한 번 더 검증해 예산에 걸린 나머지 조건(필수 조사 ≤ 예산 ·
   * 최단 ≤ 예산 · 조사 배수)을 확인한다. **19회 → 2회.**
   */
  const SLACK_OF: Record<Difficulty, number> = { hard: 0, normal: 1, easy: 2, impossible: -1 }

  const probe = verify(base)
  if (probe.errors.some((e) => !/예산|배수/.test(e))) return { fail: probe }

  let last: VerifyResult = probe
  for (const d of want) {
    const slack = SLACK_OF[d]
    if (slack === undefined || slack < 0) continue
    const budget = probe.typicalActions + slack
    if (budget < 1) continue
    const c = { ...base, budget }
    const r = verify(c)
    last = r
    if (r.ok && r.difficulty === d) return { case: c, result: r }
  }
  return { fail: last }
}

export function run(seeds: number[], opts: RunOptions = {}): Batch {
  const passed: Judged[] = []
  const rejections = new Map<string, number>()
  const note = (k: string) => rejections.set(k, (rejections.get(k) ?? 0) + 1)
  const want = opts.want?.length ? opts.want : WANTED

  for (const seed of seeds) {
    let base: Case
    try {
      base = generateCase(seed, opts.palette, { chapters: opts.chapters, deathCells: opts.deathCells })
    } catch (e) {
      note(`생성 실패: ${(e as Error).message.slice(0, 40)}`)
      continue
    }

    const out = fit(base, want)
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
    /**
     * ★ 아키타입 분포를 반드시 찍는다 ★
     *
     * 2026-07-29 이전에는 이 줄이 없었고, 생성기가 `alibi_fabrication` 하나만
     * 내놓는 것을 아무도 못 봤다. 통과율 100% 가 「다양하다」로 읽혔기 때문이다.
     * **통과율은 다양성을 증명하지 않는다.**
     */
    const tricks = new Map<string, number>()
    for (const p of b.passed) {
      const k = p.case.trick.types.join('+')
      tricks.set(k, (tricks.get(k) ?? 0) + 1)
    }
    lines.push('')
    lines.push(`  트릭 아키타입  ${tricks.size}종`)
    for (const [t, n] of [...tricks].sort((a, x) => x[1] - a[1]))
      lines.push(`    ${t.padEnd(22)}${n}건`)

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

  /**
   * ★ 통과분에 상주하는 경고를 반드시 찍는다 ★
   *
   * 이 줄이 없던 동안 `조사/예산 1.86배 — 3배 이상 권장` 이 **통과 전건에**
   * 붙어 있었는데 아무도 못 봤다. 리포트가 기각 사유만 보여줬기 때문이다.
   * **통과는 「문제가 없다」가 아니라 「오류가 없다」일 뿐이다.**
   *
   * 2026-07-29에 같은 형태의 사각지대를 하루에 셋 밟았다 —
   * 게이트에 없던 생성기 · 리포트에 없던 아키타입 분포 · 그리고 이것.
   */
  if (b.passed.length) {
    const warns = new Map<string, number>()
    for (const p of b.passed)
      for (const w of p.result.warnings) {
        const k = w.replace(/'[^']*'/g, "'…'").replace(/\d+(\.\d+)?/g, 'N')
        warns.set(k, (warns.get(k) ?? 0) + 1)
      }
    if (warns.size) {
      lines.push('')
      lines.push('  ⚠ 통과분에 상주하는 경고')
      for (const [k, n] of [...warns].sort((a, x) => x[1] - a[1]).slice(0, 8))
        lines.push(`    ${String(n).padStart(4)}/${b.passed.length}건  ${k.slice(0, 70)}`)
    }
  }

  if (b.rejections.size) {
    lines.push('')
    lines.push('  기각 사유 (많은 순)')
    for (const [k, n] of [...b.rejections].sort((a, x) => x[1] - a[1]).slice(0, 8))
      lines.push(`    ${String(n).padStart(4)}회  ${k}`)
  }
  return lines.join('\n')
}
