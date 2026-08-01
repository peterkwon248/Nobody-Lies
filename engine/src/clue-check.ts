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
 * ③ 검증기가 그것을 실제로 말하나          ← 08-02 §5 교체와 한 벌. 배선이 무방비였다
 * ```
 *
 * ★ **③이 왜 붙었나** ★ ①②는 `weakBlanks` 를 **직접** 부른다. 그래서 `verifier` §5-b 의
 * 배선(`weakBlanks` → `warnings`)을 통째로 지워도 **이 검사는 초록**이다. 08-02에 §5 를
 * 「조합 수 ≥ 30」에서 이 명제로 갈아 끼우면서 생긴 자리다 — **부르는 쪽이 둘이면 한 쪽이
 * 조용히 죽는다**(`REVEALS[].yield` 부류).
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
import { verify, weaknessWarning } from './verifier.js'
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

// ── ③ 검증기가 그 명제를 실제로 말하나 ────────────────────────
/**
 * **배선 검사다.** ①②가 통과해도 `verifier` §5-b 가 `weakBlanks` 를 안 읽으면
 * 사람에게는 아무 말도 안 간다. 세 가지를 본다:
 *
 * ```
 * 깨끗한 사건    약한 공란 0 → 경고도 0        거짓 양성이 없다
 * 심은 사건      약한 공란 > 0 → 경고가 그만큼   삼키지 않는다
 * 문안           weaknessWarning() 과 글자까지 같다   단일 출처가 살아 있다
 * ```
 *
 * ⚠ **개수만 세면 안 된다** — 다른 검사가 우연히 그만큼 경고를 낼 수 있다. 그래서
 * `weaknessWarning()` 이 낸 **바로 그 줄**이 들어 있는지 본다(같은 함수를 쓰므로
 * 문안을 고쳐도 안 깨진다 — 배선이 끊길 때만 깨진다).
 */
console.log('\n  ── 검증기가 말하나 (§5-b 배선) ──')
{
  const clean = generateCase(3) as Case
  const cleanSaid = verify(clean).warnings.filter((w) => w.includes('증명 사슬이 안 선다')).length
  if (weakBlanks(clean).length || cleanSaid) {
    failed = true
    console.log(`    ✗ 깨끗한 사건인데 §5-b 경고 ${cleanSaid}개 — 거짓 양성이다`)
  } else console.log('    ✓ 깨끗한 사건에는 §5-b 경고가 0')

  const broken = generateCase(3) as Case
  broken.incident.sceneState = undefined
  const weak = weakBlanks(broken)
  const warns = verify(broken).warnings
  const missing = weak.filter((w) => !warns.includes(weaknessWarning(w)))
  if (!weak.length) {
    failed = true
    console.log('    ✗ 심었는데 약한 공란이 0 — **심기가 틀렸다**')
  } else if (missing.length) {
    failed = true
    console.log(`    ✗ 약한 공란 ${weak.length}개 중 ${missing.length}개를 검증기가 안 말한다 — 배선이 끊겼다`)
  } else console.log(`    ✓ 심은 ${weak.length}개를 검증기가 그대로 경고한다 (문안 단일 출처)`)
}

console.log('')
if (failed) process.exit(1)
