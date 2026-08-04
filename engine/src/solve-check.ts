/**
 * ─────────────────────────────────────────────────────────────
 *  solve-check — 적대적 솔버의 게이트 (15단째)
 * ─────────────────────────────────────────────────────────────
 *
 * 오늘 손으로 돌린 것을 기계가 매번 돌리게 한다. **뮤테이션이 게이트 밖에 있으면
 * 다음에 계약이 깨져도 아무도 모른다.**
 *
 * ```
 * ① 건전성 삼종     unsat 아님 · 진짜 세계 포함 · §6 교차표
 * ② 계약 뮤테이션   f_no_* 하나의 무료성 제거 → ★ 안 물면 exit 1 ★
 * ③ 독립 리트머스   facts 경로 기대치 vs 열거 경로 (§9 열 번째 규칙의 상설화)
 * ```
 *
 * ★ ②가 이 검사의 값이다 ★ ①만 있으면 **솔버가 죽어도 초록**이다 —
 * 착수 시점에 이미 전건 통과라 아무것도 안 걸린다(`clue-check ②` 의 선례).
 *
 * ⛳ 뮤테이션은 **파일이 아니라 메모리 클론**에 건다. 어느 `f_no_*` 를 뽑는지는
 * **시드 결정적**이다 — 재현 안 되는 빨강은 못 고친다.
 */
import { readdirSync } from 'node:fs'
import { generateCase } from './generate.js'
import { loadCaseFile } from './load-case.js'
import { proveBlanks } from './proof.js'
import { consistentWorlds, solve, zeroObservation } from './solver.js'
import type { Case, Fact } from './types.js'

const N = Number(process.argv[2] ?? 40)
const errors: string[] = []
const note = (s: string) => console.log(s)

/** ③ 독립 검산 — `c.facts` 배열을 센다. `consistentWorlds` 와 **경로가 다르다** */
function expectedZeroCulprits(c: Case): number {
  const free = new Set(
    c.facts
      .filter(
        (f) =>
          f.kind === 'no_opportunity' &&
          (f.revealedBy?.length ?? 0) === 0 &&
          (f.availableAfter ?? 0) === 0,
      )
      .map((f) => f.subject),
  )
  return c.people.length - free.size
}

const zeroCulprits = (c: Case) =>
  new Set(consistentWorlds(c, zeroObservation()).map((w) => w.culprit)).size

/** 시드 결정적으로 하나 뽑는다 — 이름 정렬 후 첫 번째 */
function pickFreeNoOpp(c: Case): Fact | undefined {
  return c.facts
    .filter((f) => f.kind === 'no_opportunity' && (f.revealedBy?.length ?? 0) === 0)
    .sort((a, b) => a.id.localeCompare(b.id))[0]
}

const cases: [string, Case][] = []
for (const f of readdirSync('cases').filter((x) => x.endsWith('.yaml')).sort())
  cases.push([f.replace('.yaml', ''), loadCaseFile(`cases/${f}`)])
for (let s = 1; s <= N; s++) cases.push([`gen-${s}`, generateCase(s)])

// ── ① 건전성 삼종 ──────────────────────────────────────────────
let unchecked = 0
const uncheckedRows: string[] = []
/**
 * 후보 어휘를 **라벨 폴백**으로 고른 공란 수. 오류가 아니라 **인쇄**다.
 *
 * ⛳ 조용한 폴백은 조용한 버림과 같은 병이다 — 2026-08-05에 `poolFor` 가 모르는
 * 라벨(`협박대상`)을 빈 배열로 돌려 그 공란을 **아예 안 보고** 있었고, 화면에서는
 * 「경고 없음」과 구별되지 않았다. 폴백이 몇 개인지 보이면 새 라벨이 들어올 때
 * 사람이 먼저 안다. **0 으로 가는 것이 목표다**(`asks` 를 다 채우면 0 이 된다).
 */
let labelFallback = 0
for (const [name, c] of cases) {
  const r = solve(c)
  if (r.verdict === 'unsat') errors.push(`${name}: unsat — 사건 데이터가 규칙과 모순이다`)

  // 진짜 세계 포함은 `solveGrid` 의 자기 검사와 같은 명제다. 여기서는 unsat 이
  // 아니라는 것으로 갈음하지 않고 **직접** 묻는다 (solve 는 세계를 이미 모았다)
  if (r.worlds === 0) errors.push(`${name}: 일관 세계 0`)

  // §6 교차표 다섯째 줄 — vacuous 인데 proof 도 안 물면 **무검사 공란**이다
  const proofs = proveBlanks(c)
  labelFallback += proofs.filter((x) => x.poolSource === 'label').length
  const used = new Set<number>()
  for (const b of r.blanks) {
    if (b.verdict === 'discriminated') continue
    const chapter = Number(b.key.split('장')[0])
    const pi = proofs.findIndex(
      (x, i) => !used.has(i) && x.chapter === chapter && x.label === b.label && x.answer === b.answer,
    )
    const p = pi >= 0 ? (used.add(pi), proofs[pi]) : null
    if (!p || !p.unique) {
      unchecked++
      uncheckedRows.push(`${name} · ${b.key} · 답 ${b.answer}`)
    }
  }
}
note(`\n  ① 건전성 — 사건 ${cases.length}건`)
note(`    ${errors.length === 0 ? '✓' : '✗'} unsat 0 · 일관 세계 ≥ 1`)
if (unchecked) {
  errors.push(`무검사 공란 ${unchecked}개 — 솔버도 proof 도 안 문다 (§6 교차표 다섯째 줄)`)
  note(`    ✗ 무검사 공란 ${unchecked}개`)
  for (const s of uncheckedRows) note(`        ${s}`)
} else note(`    ✓ 무검사 공란 0`)
note(
  `    · 후보 어휘를 라벨 폴백으로 고른 공란 ${labelFallback}개` +
    ` (asks 를 채우면 0 이 된다 — 폴백은 새 라벨을 조용히 버릴 수 있다)`,
)

// ── ② 계약 뮤테이션 ────────────────────────────────────────────
note(`\n  ② 계약 뮤테이션 — f_no_* 하나의 무료성 제거`)
let bit = 0
let skipped = 0
for (const [name, c] of cases) {
  const target = pickFreeNoOpp(c)
  if (!target) {
    skipped++
    continue
  }
  const clone = JSON.parse(JSON.stringify(c)) as Case
  const t = clone.facts.find((f) => f.id === target.id)!
  t.revealedBy = ['__unreachable__']

  const before = zeroCulprits(c)
  const after = zeroCulprits(clone)
  if (after > before) bit++
  else errors.push(`${name}: 계약 뮤테이션(${target.id})이 안 물렸다 — 0회 범인후보 ${before} → ${after}`)
}
note(`    ${bit === cases.length - skipped ? '✓' : '✗'} ${bit}/${cases.length - skipped} 물었다` +
  (skipped ? ` (공짜 무죄 사실 없는 ${skipped}건 건너뜀)` : ''))

// ── ③ 독립 리트머스 ────────────────────────────────────────────
note(`\n  ③ 독립 리트머스 — facts 경로 vs 열거 경로`)
let agree = 0
for (const [name, c] of cases) {
  const exp = expectedZeroCulprits(c)
  const got = zeroCulprits(c)
  if (exp === got) agree++
  else errors.push(`${name}: 0회 범인후보 기대 ${exp} ≠ 실측 ${got} — 두 경로가 갈렸다`)
}
note(`    ${agree === cases.length ? '✓' : '✗'} ${agree}/${cases.length} 일치`)

if (errors.length) {
  console.log(`\n  ✗ solve-check 실패 — ${errors.length}건\n`)
  for (const e of errors.slice(0, 20)) console.log(`    · ${e}`)
  if (errors.length > 20) console.log(`    … 그 밖 ${errors.length - 20}건`)
  console.log()
  process.exit(1)
}
console.log('\n  ✓ solve-check 통과\n')
