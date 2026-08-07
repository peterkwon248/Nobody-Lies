/**
 * ─────────────────────────────────────────────────────────────
 *  페어플레이 — 말투가 범인을 가리키지 않는가  `npm run voice-check [건수]`
 * ─────────────────────────────────────────────────────────────
 * (2026-08-07 · 말투 프로필 5종과 **같은 커밋**)
 *
 * ## ⛔ 왜 지금 생겼나 — 어제까지는 이 검사가 «자동으로 참»이었다
 *
 * 전에는 다섯 진술이 **같은 틀 아홉 개**를 지났다. 문장이 47% 복제될 만큼 똑같아서
 * 「범인만 다른 틀」이 **구조적으로 불가능**했다. 프로필을 사람마다 갈리게 하는
 * 순간 그 보호가 사라진다 — **다른 것이 곧 신호**가 된다.
 *
 * ★ **이것이 「값과 방어를 같이 낸다」의 판본이다**(§defense-ships-with-the-value).
 * 틀 풀만 먼저 넣으면 그 사이 창이 무방비다.
 *
 * ## 세 단이다
 *
 * ```
 * ① 구조    한 사건 안에서 다섯이 «서로 다른» 프로필을 정확히 하나씩 쓴다
 *           문단 수·살 개수가 다섯이 같다 (§9-9 길이 쏠림)
 * ② 분포    N건에서 «범인의 프로필»이 다섯 종에 고르게 흩어진다
 *           범인이 특정 프로필에 쏠리면 그것이 곧 표식이다
 * ③ 심기    ①②가 죽어도 초록인지 본다 — 심은 것이 안 물리면 그것도 실패다
 * ```
 *
 * ## ⛔ 왜 「기대값 재계산」이 아닌가 — 검산이 피검산과 같은 길을 걸으면 안 된다
 *
 * 「(씨앗, 인덱스)로 배정을 다시 계산해서 대본다」가 제일 먼저 떠오르는데 **그건
 * 무효다.** 같은 셔플을 재구현하면 두 벌이 사이좋게 같이 틀리고, 생성기 함수를
 * 그대로 import 하면 **언제나 통과**한다(§verification-needs-a-different-path ·
 * `SOLVER-SPEC §9`). 그래서 이 검사는 **배정 규칙을 모른 채 결과 데이터만** 본다 —
 * 「누가 어느 프로필을 받았나」와 「그 사람이 범인인가」의 **관계**만 잰다.
 *
 * ⛳ **산문을 다시 읽지도 않는다.** 문단 텍스트를 파싱해 「범인 문장이 다른가」를
 * 보는 길은 렌더 재독이고, 문안을 고치면 조용히 낡는다. 여기서 보는 것은
 * `statement.voice`(선언된 규격)와 문단 «개수»뿐이다.
 */
import { generateCase } from './generate.js'
import { VOICES } from './generate.js'
import type { Case } from './types.js'

const N = Number(process.argv[2] ?? 60)

/** spec 문안 → 프로필 id. 생성기는 `voice` 에 spec 을 적으므로 되짚어 이름을 얻는다 */
const idOfSpec = new Map(VOICES.map((v) => [v.spec, v.id]))

type Row = { seed: number; culpritVoice: string | null; voices: (string | null)[] }

/**
 * ① 구조 — 한 사건 안에서. **배정 규칙을 안 쓰고 결과만 본다.**
 *
 * 순수 함수로 뽑아둔 이유는 ③에서 **같은 함수에 망가진 사건을 먹여야** 하기
 * 때문이다. 검사 본체와 심기가 다른 코드를 타면 ③이 아무것도 증명하지 못한다.
 */
function structureProblems(c: Case, label: string): string[] {
  const p: string[] = []
  const people = c.people ?? []
  if (people.length !== VOICES.length) {
    p.push(`${label} 인물 ${people.length}명인데 프로필은 ${VOICES.length}종이다 — 전단사가 성립하지 않는다`)
    return p
  }
  const specs = people.map((x) => x.statement?.voice ?? null)
  if (specs.some((s) => !s)) {
    p.push(`${label} voice 가 빈 사람이 ${specs.filter((s) => !s).length}명 — 빈 자리가 곧 표식이다`)
  }
  const ids = specs.map((s) => (s ? idOfSpec.get(s) ?? `(모르는 규격: ${s.slice(0, 20)})` : null))
  const uniq = new Set(ids.filter(Boolean))
  if (uniq.size !== people.length) {
    p.push(`${label} 프로필이 겹친다 — ${ids.join(' · ')}`)
  }
  for (const id of ids) if (id?.startsWith('(모르는')) p.push(`${label} ${id}`)

  /** 문단 수·살 개수가 사람마다 갈리면 길이가 곧 유용도 표시다 (§9-9 · §절대 규칙) */
  const counts = people.map((x) => (x.statement?.paragraphs ?? []).length)
  if (new Set(counts).size > 1) {
    p.push(`${label} 문단 수가 사람마다 다르다 — ${counts.join('·')}`)
  }
  return p
}

console.log(`\n§1 구조 — 사건 안에서 다섯이 서로 다른 프로필을 하나씩 쓰나 (${N}건)`)
const rows: Row[] = []
let structFails = 0
for (let s = 1; s <= N; s++) {
  const c = generateCase(s) as Case
  const probs = structureProblems(c, `gen-${s}`)
  if (probs.length) { structFails++; for (const m of probs) console.log(`  ⛔ ${m}`) }
  const people = c.people ?? []
  const voices = people.map((x) => (x.statement?.voice ? idOfSpec.get(x.statement.voice) ?? null : null))
  const ci = people.findIndex((x) => x.id === c.culprit)
  rows.push({ seed: s, culpritVoice: ci >= 0 ? voices[ci] ?? null : null, voices })
}
if (!structFails) console.log(`  ✓ ${N}건 전부 — 프로필 전단사 · 문단 수 균등 · voice 빈 자리 0`)

console.log('\n§2 분포 — 범인의 프로필이 다섯 종에 흩어지나')
const tally = new Map<string, number>()
for (const v of VOICES) tally.set(v.id, 0)
for (const r of rows) if (r.culpritVoice) tally.set(r.culpritVoice, (tally.get(r.culpritVoice) ?? 0) + 1)
let distFails = 0
const expect = N / VOICES.length
for (const [id, n] of tally) {
  const pct = Math.round((n / N) * 100)
  const bad = n === 0 || n > expect * 2.5
  if (bad) distFails++
  console.log(`  ${bad ? '⛔' : '✓ '} ${id.padEnd(10)} 범인 ${String(n).padStart(3)}건 (${pct}%)`)
}
/**
 * ⚠ **관용 폭이 왜 이렇게 넓나** — 씨앗 60건이면 기대 12건이고 표본 요동이 크다.
 * 여기서 무는 것은 **잡음이 아니라 배선**이다: 0건(그 프로필은 절대 범인이 아니다)
 * 이거나 2.5배 쏠림(그 프로필이면 범인이다)이면 그것은 요동이 아니라 규칙이다.
 */
if (!distFails) console.log(`  ✓ 다섯 종 모두 범인이 된 적이 있고 쏠림도 없다 (기대 ${expect}건)`)

/**
 * §3 심기 — ①이 죽어 있어도 초록인지 본다.
 *
 * ⚠ **심은 것이 안 물리면 그것도 실패다.** 「심었는데 통과」는 배선이 좋아서가
 * 아니라 심기가 틀린 것이고, 초록으로 넘기면 ①이 거짓말이 된다.
 */
console.log('\n§3 심기 — 망가진 사건을 먹여서 실제로 무나')
const clone = (c: Case): Case => JSON.parse(JSON.stringify(c))
const base = generateCase(1) as Case

/**
 * 심을 자리를 집는다. **없으면 던진다** — `statement` 는 타입이 선택적이라
 * `?.` 로 넘기면 «심기가 조용히 아무것도 안 하고» ③이 「통과」를 인쇄한다.
 * 심기가 대상을 못 찾은 것은 검사 실패보다 나쁜 상태이므로 크게 죽는다.
 */
function stmtOf(c: Case, who: 'culprit' | number) {
  const i = who === 'culprit' ? c.people.findIndex((x) => x.id === c.culprit) : who
  const p = c.people[i]
  if (!p?.statement) throw new Error(`심을 자리가 없다 — people[${i}].statement 가 비었다`)
  return p.statement
}
const plants: { id: string; why: string; make: () => Case }[] = [
  {
    id: 'M1 범인만 다른 풀',
    why: '범인에게만 고정 프로필을 물린다 — 프로필이 겹쳐 전단사가 깨진다',
    make: () => {
      const c = clone(base)
      // 범인을 첫 프로필로 못 박는다. 이미 그 프로필을 쓰는 사람과 겹친다
      stmtOf(c, 'culprit').voice = VOICES[0]!.spec
      return c
    },
  },
  {
    id: 'M2 범인만 긴 진술',
    why: '범인에게 문단 하나를 더 준다 — 길이가 곧 유용도 표시다 (§9-9)',
    make: () => {
      const c = clone(base)
      stmtOf(c, 'culprit').paragraphs.push({ ko: '덧붙일 말이 있습니다.' })
      return c
    },
  },
  {
    id: 'M3 voice 빈 자리',
    why: 'voice 를 하나 비운다 — 빈 자리도 표식이다 (0/35 이던 그 자리)',
    make: () => {
      const c = clone(base)
      delete (stmtOf(c, 'culprit') as { voice?: string }).voice
      return c
    },
  },
  {
    id: 'M4 모르는 규격',
    why: 'VOICES 밖의 문안을 적는다 — 손저작이 규격을 벗어난 경우를 문다',
    make: () => {
      const c = clone(base)
      stmtOf(c, 0).voice = '아무렇게나 말한다'
      return c
    },
  },
]
let plantFails = 0
for (const pl of plants) {
  const probs = structureProblems(pl.make(), 'planted')
  if (probs.length) console.log(`  ✓ ${pl.id.padEnd(18)} 물렸다 — ${probs[0]}`)
  else { plantFails++; console.log(`  ⛔ ${pl.id.padEnd(18)} 심었는데 통과했다 (${pl.why})`) }
}

const total = structFails + distFails + plantFails
if (total) {
  console.error(`\n⛔ voice-check 실패 — 구조 ${structFails} · 분포 ${distFails} · 심기 ${plantFails}\n`)
  process.exit(1)
}
console.log(`\n✅ voice-check 통과 — 구조 ${N}건 · 분포 5종 · 심기 ${plants.length}/${plants.length} 물림\n`)
