/**
 * ─────────────────────────────────────────────────────────────
 *  되먹임 검사 — `npm run clue-check [건수]`
 * ─────────────────────────────────────────────────────────────
 * (2026-08-02 · `clues.ts` 와 한 벌)
 *
 * **두 단이다.** `brief-check` 이 두 단인 것과 같은 이유다 — 앞단이 없으면
 * **검사와 대상이 사이좋게 같이 낡는다.**
 *
 * ```
 * ① 생성 N건에 약한 공란이 0 인가        ← 회귀 감시. 이것이 본체다
 * ② 이동을 심어서 실제로 무나             ← 없으면 ①이 「이동이 죽어도 초록」이다
 * ```
 *
 * ★ **②가 왜 필요한가** ★ 착수 시점 실측이 **320/320** 이라 **①은 이동이 전부
 * 죽어 있어도 초록이다.** 이 저장소는 그 부류로 여러 번 물렸다(`TRICKS` 죽은 인자 ·
 * `COLLECTED_POOL` decoy 3 · `REVEALS[].yield`). 그리고 08-01에 **「고치기 전 상태를
 * 심었는데 통과했다」**는 일이 실제로 있었다 — **심어보지 않으면 검사를 믿지 않는다.**
 *
 * ⚠ **심은 것이 안 물리면 그것도 실패다.** 「심었는데 통과」는 이동이 좋아서가 아니라
 * **심기가 틀린 것**이고, 그걸 초록으로 넘기면 ②가 거짓말이 된다.
 */
import { generateCase } from './generate.js'
import { weakBlanks, closeClues, MOVE_IDS } from './clues.js'
import type { Case } from './types.js'

const N = Number(process.argv[2] ?? 40)
let failed = false

// ── ① 생성 전건에 약한 공란이 0 인가 ────────────────────────────
const offenders: string[] = []
let blanksSeen = 0
for (let i = 1; i <= N; i++) {
  const c = generateCase(i) as Case
  blanksSeen += c.chapters.reduce((s, ch) => s + ch.blanks.length, 0)
  for (const w of weakBlanks(c))
    offenders.push(`gen-${i} · ${w.chapter}장 '${w.label}' → ${w.answerLabel}  [${w.kind}] ${w.why}`)
}

console.log(`\n  생성 ${N}건 · 공란 ${blanksSeen}개`)
if (offenders.length) {
  failed = true
  console.log(`\n  ✗ 약한 공란 ${offenders.length}개 — 조사로 안 갈리거나 무료로 풀린다\n`)
  for (const line of offenders.slice(0, 12)) console.log(`    ${line}`)
  if (offenders.length > 12) console.log(`    … 그 밖 ${offenders.length - 12}개`)
} else {
  console.log(`  ✓ 약한 공란 0 — 모든 공란이 조사로 갈린다 (전제 둘은 예외로 선언됨)`)
}

// ── ② 이동을 심어서 확인한다 ──────────────────────────────────
/**
 * 심기 하나. **세 가지를 다 통과해야 산다:**
 * `심기 전 0` → `심은 뒤 > 0` → `루프 뒤 0`.
 * 가운데가 없으면 **심기가 틀린 것**이고 이동이 좋다는 증거가 아니다.
 */
function plant(name: string, seed: number, breakIt: (c: Case) => void) {
  const c = generateCase(seed) as Case
  if (weakBlanks(c).length) {
    failed = true
    console.log(`    ✗ ${name} — 심기 전부터 약하다. 이 씨앗으로는 못 잰다`)
    return
  }
  breakIt(c)
  const after = weakBlanks(c)
  if (!after.length) {
    failed = true
    console.log(`    ✗ ${name} — 심었는데 안 물린다. **심기가 틀렸다** (검사가 거짓말이 된다)`)
    return
  }
  const left = closeClues(c)
  if (left.length) {
    failed = true
    console.log(`    ✗ ${name} — 심은 ${after.length}개 중 ${left.length}개를 못 닫았다`)
    return
  }
  console.log(`    ✓ ${name} — 심어서 ${after.length}개가 물렸고 루프가 전부 닫았다`)
}

console.log(`\n  ── 이동을 심어서 확인 (${MOVE_IDS.length}개) ──`)

plant('M1 발견 시각 전제', 1, (c) => {
  // 08-01 이전 상태 — 브리핑이 발견 시각을 한 글자도 안 말했다
  c.incident.sceneState = undefined
})

plant('M2 기록이 가리킨다', 2, (c) => {
  // 08-01 이전 상태 — 가닥 기록이 *"기록에 그대로 남아 있었다"* 였다
  for (const e of c.evidence) if (e.record?.includes('적힌 줄이 남아 있었다')) e.record = '기록에 그대로 남아 있었다.'
})

console.log('')
if (failed) process.exit(1)
