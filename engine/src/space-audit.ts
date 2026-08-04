/**
 * 상태 공간 산정 — 적대적 솔버가 열거해야 하는 세계의 수를 실측한다.
 *
 * 세계(world) 정의:
 *   가설 = (범인 c ∈ 용의자 5) × (c 의 진실 격자 ∈ 장소^슬롯)
 *   무고한 넷의 진실 격자는 그들의 claim(없으면 presence)으로 고정된다 —
 *   「무고한 사람은 거짓말하지 않는다」가 규칙이므로 가설 변수가 아니다.
 *   ★ 그 규칙은 말이 아니라 코드다 — `verifier.ts` §7.5 가 **오류**로 막는다.
 *     경고였으면 이 산정 전체가 무너진다(아래 `naive` 열이 그 크기다).
 *
 * 별도로:
 *   제출 공간 = ∏(공란별 후보 수) — 플레이어가 낼 수 있는 답안지의 수.
 *   솔버가 아니라 채점이 마주하는 공간이고, 유일성은 이 공간에서 정확히
 *   1개의 답안만 만점이어야 한다는 뜻이다.
 *
 * ─────────────────────────────────────────────────────────────
 * ⛳ **출처와 인용에 대하여** (2026-08-04)
 *
 * 이 파일은 챗봇 상담에서 `SOLVER-SPEC` 과 함께 인계됐다. 스펙 v1 은 이것을
 * *"(이미 있음)"* 이라고 적었는데 **우리 트리에는 없었다** — 상대의 분석용
 * 클론에만 있었다. 그래서 §0 의 숫자는 **인용을 못 믿고 독립으로 다시 재서**
 * 확인했고(전건 일치), 그 뒤에 이 파일을 들였다.
 *
 * **순서가 중요하다** — 숫자가 맞아서 인용을 봐준 것이 아니라, 인용이 안 맞아서
 * 다시 쟀더니 숫자가 맞았다. ⑤검열관의 ⓐ(인용 대조)가 설계된 그대로 작동한 자리다.
 * 이제 이 파일이 저장소에 있으므로 **그 인용은 참이 됐다** — `npm run space-audit`.
 * ─────────────────────────────────────────────────────────────
 *
 * ⛔ **게이트에 안 건다.** 합격선이 없는 **측정**이지 검사가 아니다 —
 * 기준치 없는 기계를 게이트에 걸면 검사가 거짓말이 된다(`NEXT-ACTION` §게이트에
 * 안 건 도구). 값은 「솔버를 지어도 되는가」의 근거를 **다시 뽑을 수 있다**는 것이다.
 */
import { generateCase } from './generate.js'
import { loadCaseFile as loadCase } from './load-case.js'
import type { Case } from './types.js'

const fmt = (n: number): string => (n >= 1e9 ? n.toExponential(2) : n.toLocaleString('en-US'))

function audit(c: Case, name: string) {
  const P = c.people.length
  const S = c.slots.length
  const L = c.locations.length
  const A = c.actions.length
  const E = c.evidence.length
  const CH = c.chapters.length
  const blanks = c.chapters.flatMap((ch) => ch.blanks)
  const B = blanks.length

  // ── 세계 공간 ──
  // 범인 후보 5 × 범인의 진실 격자 L^S
  const culpritGrid = Math.pow(L, S)
  const worlds = P * culpritGrid
  // 대조용 — 규칙 없이 다섯 명 전부의 격자를 미지수로 두면
  const naive = Math.pow(culpritGrid, P)

  // ── 제출 공간 ──
  // schema 기본값: 인물 = 용의자 수, 그 외 = 4 (candidatePool 이 있으면 그 값)
  let submission = 1
  const pools: number[] = []
  for (const b of blanks) {
    const pool = b.candidatePool ?? (b.label === '인물' ? P : 4)
    pools.push(pool)
    submission *= pool
  }

  // ── 솔버 비용 추정 ──
  // 세계 하나당 검사할 관측: 조사 결과 A + 물증 E + 공란 B + 격자 셀 P×S
  const checksPerWorld = A + E + B + P * S
  const ops = worlds * checksPerWorld

  return { name, P, S, L, A, E, CH, B, worlds, naive, submission, ops, pools }
}

const rows: ReturnType<typeof audit>[] = []

// 커밋된 사건 4건
for (const f of [
  'cases/mountain-lodge.yaml',
  'cases/practice-room.yaml',
  'cases/pipe-organ-workshop.yaml',
  'cases/closing-theater.yaml',
]) {
  try {
    rows.push(audit(loadCase(f), f.replace('cases/', '').replace('.yaml', '')))
  } catch (e) {
    console.error(`${f}: 로드 실패 — ${(e as Error).message}`)
  }
}

// 생성 사건 40건 (gen-check 과 같은 표본)
const gen: ReturnType<typeof audit>[] = []
for (let seed = 1; seed <= 40; seed++) {
  gen.push(audit(generateCase(seed), `gen-${seed}`))
}

console.log('사건별 실측')
console.log(
  'case'.padEnd(22),
  'S(슬롯)',
  'L(장소)',
  'A(조사)',
  'E(물증)',
  'B(공란)',
  '세계수'.padStart(10),
  '제출공간'.padStart(14),
  '솔버ops'.padStart(12),
)
for (const r of rows) {
  console.log(
    r.name.padEnd(22),
    String(r.S).padStart(7),
    String(r.L).padStart(7),
    String(r.A).padStart(7),
    String(r.E).padStart(7),
    String(r.B).padStart(7),
    fmt(r.worlds).padStart(10),
    fmt(r.submission).padStart(14),
    fmt(r.ops).padStart(12),
  )
}

const agg = (xs: number[]) => ({
  min: Math.min(...xs),
  max: Math.max(...xs),
  avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
})
console.log('\n생성 40건 집계')
for (const k of ['S', 'L', 'A', 'E', 'B', 'worlds', 'submission', 'ops'] as const) {
  const a = agg(gen.map((g) => g[k] as number))
  console.log(
    k.padEnd(10),
    'min',
    fmt(a.min).padStart(12),
    'max',
    fmt(a.max).padStart(12),
    'avg',
    fmt(a.avg).padStart(12),
  )
}

// 최악 조합 — 생성기의 손잡이 한계치 (deathCells 3 → 슬롯 5, 장 8)
const worst = audit(generateCase(7, undefined, { deathCells: 3, chapters: 8 }), 'worst-knobs')
console.log(
  '\n최악 손잡이 (deathCells 3 · 장 8):',
  'S',
  worst.S,
  'L',
  worst.L,
  'B',
  worst.B,
  '세계수',
  fmt(worst.worlds),
  '제출',
  fmt(worst.submission),
  'ops',
  fmt(worst.ops),
)

// ★ 규칙이 없으면 얼마나 커지나 — 「핵심 명제가 곧 솔버의 전제다」의 크기
console.log('\n규칙(무고한 자는 거짓말하지 않는다)이 없으면')
for (const r of [...rows, worst]) {
  console.log(`  ${r.name.padEnd(22)} ${fmt(r.worlds).padStart(10)}  →  ${fmt(r.naive)}`)
}
