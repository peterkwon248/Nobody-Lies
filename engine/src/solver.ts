/**
 * ─────────────────────────────────────────────────────────────
 *  적대적 솔버 — 세계를 전수 열거해서 「답이 유일한가」를 증명한다
 * ─────────────────────────────────────────────────────────────
 *
 * 목표(사용자 확정): **「성실하게 플레이한 사람이 논리 결함 때문에 틀리거나
 * 막히는 일이 0」을 증명 가능한 층으로 만든다.**
 *
 * 증명 수단은 규칙 사슬(`proof.ts`)이 아니라 **세계 전수 열거**다. 사슬은
 * 「이 규칙으로 좁혀진다」를 말하는데, 규칙표에 없는 좁힘은 **말할 수 없다** —
 * 그래서 `proof-check` 의 「증명 없음」이 결함인지 규칙의 부재인지 갈리지 않았다.
 * 열거는 그 구별이 필요 없다. **남은 세계를 세면 된다.**
 *
 * ## ⚠ 이 파일은 아직 1단계다 — **판정을 내지 않는다**
 *
 * 착수 순서(§8)의 1단계(C1~C4)까지만 있다. C5~C9 와 `answerOf` 가 없으므로
 * **`solve()` 는 아직 없다.** 여기 있는 것은 `solveGrid()` 뿐이고 그것은
 * 「격자와 유죄만으로 세계가 몇으로 주는가」를 재는 **계측**이다.
 *
 * ⛔ **부분 솔버를 완성 솔버로 읽으면 안 된다.** 이 저장소가 여러 번 물린
 * 「초록인데 아무것도 안 물고 있다」가 정확히 그 모양이다. 그래서:
 *   · `verdict` 를 안 만든다 (`unique` 라는 낱말을 이 단계에서 안 쓴다)
 *   · 게이트에 안 건다 (`solve-check` 은 5단계에서 생긴다)
 *   · 아래 §안 보는 것 목록을 코드 옆에 둔다
 *
 * ## 규약 — `schema.ts` 와 같다
 *
 * **`node:fs` 금지 · throw 금지.** 브라우저의 `Generator.jsx` 가 부를 수 있어야
 * 한다(`generateCase` 무-throw 선례 — 유저 화면이 비면 안 된다). 실패는 결과
 * 객체로 돌려준다.
 *
 * ## 세계의 정의
 *
 * ```
 * 가설 = (범인 c ∈ 용의자 5) × (c 의 진실 격자 ∈ 장소^슬롯)
 * ```
 *
 * ★ **무고한 넷은 가설 변수가 아니다** ★ 「무고한 사람은 거짓말하지 않는다」가
 * 규칙이므로 그들의 `claim ?? presence` 가 곧 진실로 고정된다. **이 규칙이 말이
 * 아니라 코드라서 성립한다** — `verifier.ts` §7.5 가 무고한 자의 `claim ≠ presence`
 * 를 **오류**로 막는다. 경고였으면 이 산정 전체가 무너진다.
 *
 * 크기는 `npm run space-audit` 이 잰다 — 커밋 4건 1,715~12,005 · 최악 84,035.
 * 규칙이 없으면 10¹³~10²¹ 이라 열거가 불가능해진다. **핵심 명제가 곧 솔버의 전제다.**
 */
import type { Case, LocationId, PersonId, PresenceCell, SlotId } from './types.js'
import { deriveFacts, guiltTable } from './verifier.js'

/** 가설 하나. 범인이 누구이고 그 사람이 실제로 어디 있었나 */
export type World = {
  culprit: PersonId
  /** 범인의 **진실** 격자. 슬롯 순서는 `c.slots` 와 같다 */
  culpritTruth: PresenceCell[]
  /** 트릭이 exit 을 가지면 언제 떠났나. 2단계(C5)에서 쓴다 */
  exitSlot?: SlotId
}

/**
 * 일관성 조항 이름. **문자열을 여기 한 곳에서만 짓는다** — 계측 출력과 실패
 * 사유가 갈리면 「무엇이 세계를 지웠나」를 못 읽는다.
 */
export type Clause = 'C1' | 'C2' | 'C3' | 'C4'

export const CLAUSE_LABEL: Record<Clause, string> = {
  C1: 'C1 범인 거짓 요건 — 사망 구간에 진실≠진술 칸이 있다',
  C2: 'C2 기회의 물리 — 사망 구간에 현장 접근이 가능한 자리에 있다',
  C3: 'C3 유죄 유일성 — 전체 정보에서 유죄가 서는 사람이 범인 하나뿐',
  C4: 'C4 무고 배제 — 나머지 넷은 셋 중 하나가 끝내 안 선다',
}

/** 그 사람이 **하는 말**. 진실이 아니라 공개된 주장이다 */
export function statedGrid(c: Case, person: PersonId): Map<SlotId, LocationId> {
  const p = c.people.find((x) => x.id === person)
  const cells = p ? (p.claim ?? p.presence) : []
  return new Map(cells.map((cell) => [cell.slot, cell.location]))
}

/** 그 사람의 **진실**. 무고한 자에게만 뜻이 있다 — 범인의 진실은 가설이다 */
function truthGrid(c: Case, person: PersonId): Map<SlotId, LocationId> {
  const p = c.people.find((x) => x.id === person)
  return new Map((p?.presence ?? []).map((cell) => [cell.slot, cell.location]))
}

const windowSlots = (c: Case): SlotId[] =>
  c.slots.filter((s) => s.isWindow).map((s) => s.id)

/**
 * 현장에 닿을 수 있는 장소인가.
 *
 * ⚠ **보수적으로 판정한다** — 슬롯에 실제 시간 폭이 없으므로(`Slot` 은 id·label·
 * isWindow 뿐) `walks.min` 으로 왕복 가능성을 계산할 수 없다. 그래서 **부지 안이면
 * 전부 가능**으로 둔다.
 *
 * ★ 오차의 방향이 중요하다 ★ 세계를 **덜 지우는** 오차는 「모호」를 낳고(가짜
 * 빨간불 = 사람이 본다), **더 지우는** 오차는 「거짓 유일」을 낳는다(초록불이
 * 거짓말한다 = 최악). **의심스러우면 덜 지운다.**
 */
function canReachScene(c: Case, loc: LocationId): boolean {
  if (c.incident.scene && loc === c.incident.scene) return true
  return c.locations.find((l) => l.id === loc)?.atLodge ?? false
}

/**
 * 일관성 판정. **조항 하나가 빠지면 증명이 조용히 약해진다.**
 *
 * 돌려주는 것은 불리언이 아니라 **깨진 조항**이다 — 「몇 개 남았나」만으로는
 * 무엇이 지웠는지 못 읽고, 그러면 조항이 죽어도 알 수 없다(`clue-check ②` 의 교훈).
 */
export function consistent(
  c: Case,
  w: World,
  ctx: SolveContext = buildContext(c),
): { ok: boolean; broke: Clause | null } {
  const win = ctx.window
  const truth = new Map(w.culpritTruth.map((cell) => [cell.slot, cell.location]))
  const stated = ctx.stated.get(w.culprit) ?? new Map()

  // C1 — 범인은 사망 구간에서 위치를 거짓말한다. 반박할 거짓이 없으면 잡을 수 없다
  //      (verifier §7.5(iv) 의 뒤집기)
  if (!win.some((s) => truth.get(s) !== stated.get(s))) return { ok: false, broke: 'C1' }

  // C2 — 사망 구간 중 한 칸이라도 현장에 닿는 자리여야 기회가 성립한다
  if (!win.some((s) => { const l = truth.get(s); return l !== undefined && canReachScene(c, l) }))
    return { ok: false, broke: 'C2' }

  // C3·C4 — 전체 정보에서 유죄가 서는 사람. `ctx.guilty` 가 이미 계산해뒀다
  if (!ctx.guilty.includes(w.culprit)) return { ok: false, broke: 'C3' }
  if (ctx.guilty.length > 1) return { ok: false, broke: 'C4' }

  return { ok: true, broke: null }
}

/**
 * 세계와 **무관한** 값을 미리 계산한다.
 *
 * ★ 이 타입이 있다는 것 자체가 발견이다 ★ `guiltTable` 은 `facts[].subject` 를
 * 세므로 **격자와 무관**하다. 그래서 C3·C4 는 세계마다 다시 계산할 것이 아니라
 * **범인 축을 한 번 자르는** 조항이다. 축이 둘로 갈린다:
 *
 * ```
 * 누가 범인인가      물증이 여는 facts 가 정한다     ← C3·C4 · 격자 무관
 * 그 사람이 어디 있었나  격자가 정한다                 ← C1·C2 · 세계마다 다르다
 * ```
 *
 * 세계마다 다시 돌면 최악 84,035회 `deriveFacts` 다 — 느린 것도 문제지만
 * **축이 하나인 것처럼 읽히는 것이 더 문제다.**
 */
export type SolveContext = {
  window: SlotId[]
  /** 전체 정보에서 유죄 셋이 다 서는 사람 */
  guilty: PersonId[]
  /** 사람마다 **하는 말** */
  stated: Map<PersonId, Map<SlotId, LocationId>>
}

export function buildContext(c: Case): SolveContext {
  const full = deriveFacts(c, new Set(c.evidence.map((e) => e.id)), c.chapters.length)
  return {
    window: windowSlots(c),
    guilty: guiltTable(c, full).filter((g) => g.guilty).map((g) => g.person),
    stated: new Map(c.people.map((p) => [p.id, statedGrid(c, p.id)])),
  }
}

/** 데카르트 곱 — 슬롯마다 장소 하나. `L^S` 개를 낸다 */
function* gridAssignments(slots: SlotId[], locs: LocationId[]): Generator<PresenceCell[]> {
  const n = slots.length
  const idx = new Array(n).fill(0)
  const total = Math.pow(locs.length, n)
  for (let k = 0; k < total; k++) {
    yield slots.map((s, i) => ({ slot: s, location: locs[idx[i]] }))
    for (let i = n - 1; i >= 0; i--) {
      if (++idx[i] < locs.length) break
      idx[i] = 0
    }
  }
}

export type GridResult = {
  /** 열거한 세계 수 (= P × L^S) */
  enumerated: number
  /** 일관 세계 수 */
  surviving: number
  /** 조항별로 지운 세계 수. 먼저 깨진 조항에 셈이 붙는다 (단락 평가) */
  killedBy: Record<Clause, number>
  /** 살아남은 세계의 범인 후보 */
  culprits: PersonId[]
  /** ★ 자기 검사 1호 ★ 사건 데이터의 진짜 세계가 일관 집합에 있는가 */
  trueWorldSurvives: boolean
  /** 진짜 세계가 탈락했다면 무엇에 걸렸나 — 일관성 함수가 고장난 것이다 */
  trueWorldBroke: Clause | null
}

/**
 * 1단계 계측 — **격자와 유죄만으로 세계가 몇으로 주는가.**
 *
 * ⛔ **이것은 판정이 아니다.** C5~C9 가 없고 `answerOf` 도 없다. 「유일하다」를
 * 여기서 말하면 안 된다 — 남은 세계가 1이어도 그건 **아직 안 본 조항이 있는
 * 상태의 1**이다.
 *
 * ## 안 보는 것 (2단계 이후)
 * ```
 * C5 트릭 계약     ARCHETYPES 의 requiresExit · requiresIllusion
 * C6 인상 파괴     illusion.brokenBy 가 조사로 도달 가능한가
 * C7 물증 귀속     staging 물증이 범인 동선에서 제작 가능한가
 * C8 허점 실재     trick.flaw.plantedIn 이 실재하고 도달 가능한가
 * C9 공란 도출     answerOf(w, blank) 가 정의되는가
 * ```
 */
export function solveGrid(c: Case): GridResult {
  const slots = c.slots.map((s) => s.id)
  const locs = c.locations.map((l) => l.id)
  const ctx = buildContext(c)
  const killedBy: Record<Clause, number> = { C1: 0, C2: 0, C3: 0, C4: 0 }
  const culprits = new Set<PersonId>()
  let enumerated = 0
  let surviving = 0

  for (const person of c.people) {
    for (const grid of gridAssignments(slots, locs)) {
      enumerated++
      const r = consistent(c, { culprit: person.id, culpritTruth: grid }, ctx)
      if (r.ok) {
        surviving++
        culprits.add(person.id)
      } else if (r.broke) killedBy[r.broke]++
    }
  }

  // ★ 자기 검사 1호 ★ — 사건 데이터가 말하는 진짜 세계는 반드시 살아남아야 한다.
  // 안 남으면 일관성 함수가 고장난 것이지 사건이 틀린 것이 아니다.
  const trueTruth = truthGrid(c, c.culprit)
  const trueWorld: World = {
    culprit: c.culprit,
    culpritTruth: slots.map((s) => ({ slot: s, location: trueTruth.get(s) as LocationId })),
  }
  const self = consistent(c, trueWorld, ctx)

  return {
    enumerated,
    surviving,
    killedBy,
    culprits: [...culprits],
    trueWorldSurvives: self.ok,
    trueWorldBroke: self.broke,
  }
}
