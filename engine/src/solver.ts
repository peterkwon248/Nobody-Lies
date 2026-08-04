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

/** 가설 하나. 범인이 누구이고, 그 사람이 어디 있었고, 언제 죽였나 */
export type World = {
  culprit: PersonId
  /** 범인의 **진실** 격자. 슬롯 순서는 `c.slots` 와 같다 */
  culpritTruth: PresenceCell[]
  /**
   * ★ 언제 죽였나 — 사망 구간 칸 중 하나 ★ (2026-08-04 신설)
   *
   * ## 왜 계산이 아니라 변수인가
   *
   * 처음에는 `answerOf(시각)` 을 **계산**했다 — *"범인이 현장에 있던 칸"*.
   * 그런데 반사실 세계에서는 그 칸이 **0개이거나 2개 이상**이라 함수가 `null` 을
   * 냈고, 44건 중 **30건이 `undecidable`** 로 떨어졌다.
   *
   * 뿌리는 역할 함수의 의미론이 아니라 **세계 정의의 누락**이었다.
   * 「언제 죽였나」가 플레이어의 진짜 추리 대상이라면 그것은 세계에서 **읽는 값**이지
   * 세계로부터 **계산하는 값**이 아니다.
   *
   * ```
   * 전   answerOf(시각) = 범인이 현장에 있던 칸을 찾는다   → 유일하지 않으면 null
   * 후   answerOf(시각) = w.murderCell                    → ★ 읽기 · null 이 구조적으로 불가능
   * ```
   *
   * 범인이 현장에 두 번 있는 세계는 **`murderCell` 이 다른 두 세계로 갈라진다** —
   * `undecidable` 이 정직한 `ambiguous` 로 바뀐다. 그리고 그 모호를 해소하는 것이
   * 정확히 C5~C8(`exit.slot` · `brokenBy` 시점 · `walks.min`)이다.
   *
   * ## 오차 방향
   *
   * 변수 추가는 세계를 **늘리는** 쪽이라 **가짜 모호는 낳아도 거짓 유일은 못 낳는다.**
   * §4 의 「의심스러우면 덜 지운다」와 같은 방향이다.
   *
   * ⛔ **비용은 ×|사망 구간 칸| 이다** — `deathCells ≤ 3` 이므로 최대 ×3.
   * 커밋 4건과 생성 40건은 전부 창이 **1칸**이라 세계 수가 **안 변한다**.
   */
  murderCell: SlotId
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

  // C2 — **죽인 칸에서** 현장에 닿아야 기회가 성립한다.
  //
  // ⛳ murderCell 신설 전에는 「사망 구간 중 **한 칸이라도**」였다. 그건 느슨하다 —
  // 범인이 창의 다른 칸에 있었어도 통과했다. 이제 죽인 칸이 세계의 변수이므로
  // **그 칸 하나**를 묻는다. 조인 것이 아니라 **물음이 정확해진 것**이다.
  const at = truth.get(w.murderCell)
  if (at === undefined || !canReachScene(c, at)) return { ok: false, broke: 'C2' }

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

/**
 * ─────────────────────────────────────────────────────────────
 *  3단계 — `answerOf` · 공란별 관할 판정
 * ─────────────────────────────────────────────────────────────
 *
 * ## 난제 — **공란에 「무엇을 묻는가」가 없다**
 *
 * `Blank` 이 갖는 것은 `label`(범주)과 `answer`(정답)뿐이고, **질문은 서술문에
 * 있다.** 그런데 솔버는 산문을 안 읽는다(§3 정보 이중화). `proof.ts` 는 이 문제를
 * **산문을 읽어서** 풀었다(R1·R3 가 `report`·진술을 훑는다) — 솔버는 그 길이 막혀 있다.
 *
 * ## 그래서 **역할**을 구조로 찾는다
 *
 * 「이 답이 진짜 세계에서 **무슨 역할**을 하나」를 구조만으로 알아낸 뒤, **같은
 * 역할을 반사실 세계에서 다시 계산**한다. 그것이 `answerOf` 다.
 *
 * ```
 * culprit         label 인물 · answer 가 범인            → answerOf(w) = w.culprit
 * culpritLoc(s)   label 장소 · answer 가 범인의 s 칸 위치  → answerOf(w) = w 의 s 칸
 * culpritScene    label 시각 · answer 가 범인이 현장에 있던 칸
 * none            역할을 못 찾았다                       → vacuous
 * ```
 *
 * ## ⚠ 오차의 방향 — **거짓 초록이 구조적으로 불가능하다**
 *
 * ```
 * 역할을 잘못 붙인다      → answerOf 가 헛되이 갈린다 → ambiguous(거짓 빨강) → 사람이 본다
 * 역할을 못 찾는다        → vacuous → proof 관할로 넘어간다
 *                          → proof 도 안 물면 §6 교차표 다섯째 줄이 exit 1
 * ```
 *
 * **`none` 은 「괜찮다」가 아니라 「솔버는 할 말이 없다」다.** 그 구별이 무너지면
 * 이 모듈 전체가 「초록인데 아무것도 안 물고 있다」가 된다.
 *
 * ⛳ **후보 칸이 여럿이면 역할을 안 붙인다** — 범인이 `room` 에 두 칸 있는데 답이
 * `room` 이면 어느 칸을 묻는지 알 수 없다. 찍지 않고 `proof` 로 넘긴다.
 */
export type BlankRole =
  | { kind: 'culprit' }
  | { kind: 'culpritLoc'; slot: SlotId }
  | { kind: 'murderCell' }
  | { kind: 'none' }

/** 공란 하나를 사건 안에서 가리키는 열쇠. 장·순서로 짓는다 (id 필드가 없다) */
export const blankKey = (chapterOrder: number, i: number, label: string) =>
  `${chapterOrder}장·${i}·${label}`

/**
 * 답이 진짜 세계에서 하는 역할을 **구조로** 찾는다. 산문은 안 읽는다.
 */
export function roleOf(c: Case, label: string, answer: string): BlankRole {
  const truth = new Map(
    (c.people.find((p) => p.id === c.culprit)?.presence ?? []).map((x) => [x.slot, x.location]),
  )

  // ⚠ **라벨로 먼저 가른다** — 안 그러면 「범인이 어느 칸에 있던 장소」와 우연히
  // 같은 값을 가진 물증 위치 공란에 엉뚱한 역할이 붙는다. 역할 오배정은
  // 거짓 빨강이라 안전한 쪽이지만, **셈을 부풀려 「솔버가 넓게 본다」로 읽힌다.**
  switch (label) {
    case '인물':
      return answer === c.culprit ? { kind: 'culprit' } : { kind: 'none' }

    case '장소': {
      // ★ 답이 현장이면 「어디서 일어났나」를 묻는 것이고 그건 **전제**다 ★
      //
      // 사건 개요가 처음부터 말한다(`proof.ts` R5 현장 전제 · 비용 0). 추리가
      // 아니므로 세계가 정하지 않는다 — 관할은 proof 로 간다.
      //
      // ⛳ **`murderCell` 때와 같은 오배정을 여기서도 했다** (2026-08-04 역추적에서
      // 발견). 현장이 하필 범인이 한 칸에만 있던 장소라 `culpritLoc` 이 붙었고,
      // **37개 중 22개가 그렇게 가짜 모호로 세어지고 있었다.** 역추적이 아니었으면
      // 「C5~C8 이 28개를 못 묶는다」는 틀린 결론으로 스키마를 고칠 뻔했다.
      if (answer === c.incident.scene) return { kind: 'none' }

      // 범인이 그 장소에 있던 칸. **하나뿐일 때만** 붙인다 — 여럿이면 어느 칸을
      // 묻는지 알 수 없다. 찍지 않고 proof 로 넘긴다
      const at = [...truth].filter(([, loc]) => loc === answer).map(([s]) => s)
      return at.length === 1 ? { kind: 'culpritLoc', slot: at[0] } : { kind: 'none' }
    }

    case '시각': {
      // 답이 사망 구간 칸이면 「언제 죽였나」를 묻는 것이다 → 세계에서 **읽는다**
      //
      // ⛳ 창이 1칸인 사건에서는 murderCell 의 값이 하나뿐이라 이 공란이 자동으로
      // **vacuous** 가 된다. 그것이 옳은 의미론이다 — **칸이 하나면 「언제」는
      // 추리가 아니라 데이터**이고, 관할은 proof 로 간다.
      if (c.slots.some((s) => s.isWindow && s.id === answer)) return { kind: 'murderCell' }
      // 비-사망구간 칸을 묻는 시각 공란(실측 43개)은 역할을 못 찾는다 — proof 관할
      return { kind: 'none' }
    }

    default:
      // 확보 단어류(도구·동기·물품·은닉처·정체·접촉수단…)는 세계가 안 정한다.
      // **그래서 vacuous 이고, 그것이 proof.ts 를 강등하면 안 되는 이유다**(§6)
      return { kind: 'none' }
  }
}

/**
 * 그 역할을 세계 `w` 에서 다시 계산한다.
 *
 * `null` 은 **C9 실패**다 — 이 세계가 그 공란의 답을 결정하지 못한다.
 * 삼키지 않고 `undecidable` 로 올린다.
 */
export function answerOf(w: World, role: BlankRole): string | null {
  switch (role.kind) {
    case 'culprit':
      return w.culprit
    case 'culpritLoc': {
      const cell = w.culpritTruth.find((x) => x.slot === role.slot)
      return cell ? cell.location : null
    }
    // ★ 계산이 아니라 읽기다 — 그래서 null 이 구조적으로 불가능하다 ★
    case 'murderCell':
      return w.murderCell
    default:
      return null
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
      for (const murderCell of ctx.window) {
        enumerated++
        const r = consistent(c, { culprit: person.id, culpritTruth: grid, murderCell }, ctx)
        if (r.ok) {
          surviving++
          culprits.add(person.id)
        } else if (r.broke) killedBy[r.broke]++
      }
    }
  }

  // ★ 자기 검사 1호 ★ — 사건 데이터가 말하는 진짜 세계는 반드시 살아남아야 한다.
  // 안 남으면 일관성 함수가 고장난 것이지 사건이 틀린 것이 아니다.
  const trueTruth = truthGrid(c, c.culprit)
  const trueGrid = slots.map((s) => ({ slot: s, location: trueTruth.get(s) as LocationId }))
  // ⛳ 진짜 세계의 murderCell 은 데이터에 **없다** — 사건 파일이 「언제 죽였나」를
  //   적지 않는다. 그래서 창 칸 중 **하나라도** 일관이면 자기 검사를 통과로 본다.
  //   ★ 이것이 murderCell 이 진짜 변수라는 증거다 ★ 데이터에 있었으면 읽었을 것이다.
  const self = ctx.window
    .map((murderCell) => consistent(c, { culprit: c.culprit, culpritTruth: trueGrid, murderCell }, ctx))
    .reduce((best, r) => (best.ok ? best : r), { ok: false, broke: null } as ReturnType<typeof consistent>)

  return {
    enumerated,
    surviving,
    killedBy,
    culprits: [...culprits],
    trueWorldSurvives: self.ok,
    trueWorldBroke: self.broke,
  }
}

/** 일관 세계를 실제로 모아서 돌려준다. `solveGrid` 는 세기만 한다 */
export function consistentWorlds(c: Case): World[] {
  const slots = c.slots.map((s) => s.id)
  const locs = c.locations.map((l) => l.id)
  const ctx = buildContext(c)
  const out: World[] = []
  for (const person of c.people)
    for (const grid of gridAssignments(slots, locs))
      for (const murderCell of ctx.window) {
        const w = { culprit: person.id, culpritTruth: grid, murderCell }
        if (consistent(c, w, ctx).ok) out.push(w)
      }
  return out
}

export type BlankReport = {
  key: string
  label: string
  answer: string
  role: BlankRole['kind']
  verdict: 'discriminated' | 'vacuous'
  /** 일관 세계들이 낸 서로 다른 답의 수. vacuous 면 1(또는 역할 없음) */
  distinct: number
  /** 답이 갈릴 때 실제로 나온 값들 (최대 6개만 인쇄용) */
  values: string[]
  /** 진짜 답이 그 집합에 있나. 없으면 역할 배정이 틀린 것이다 */
  containsTrue: boolean
}

export type SolveResult = {
  worlds: number
  verdict: 'unique' | 'ambiguous' | 'unsat' | 'undecidable'
  /** discriminated 공란만으로 만든 답안 벡터의 가짓수 */
  answerVectors: number
  blanks: BlankReport[]
  /** C9 실패 — 세계가 답을 결정 못 한 (공란, 세계) 쌍의 수 */
  undecided: number
  /**
   * ★ C5~C8 이 아직 없다 ★ 그래서 `ambiguous` 는 **잠정**이다.
   *
   * 단조성 때문에 방향이 한쪽이다 — 지금 세계 집합은 덜 지워진 상태이고,
   * 조항을 더하면 집합은 **줄기만** 한다. 큰 집합에서 답안 벡터가 1이면 작은
   * 집합에서도 1이다. **즉 `unique` 는 최종이고 `ambiguous` 만 잠정이다.**
   */
  provisional: true
}

/**
 * 3단계 판정.
 *
 * ⛔ **`vacuous` 는 「검사됐다」가 아니다** — 솔버가 **할 말이 없다**는 뜻이고
 * 관할이 `proof`/`weakBlanks` 로 넘어간다. 둘 다 안 물면 그 공란은 **무검사**이고
 * §6 교차표가 그것을 `exit 1` 로 센다. 그 배선은 6단계에서 붙는다.
 */
export function solve(c: Case): SolveResult {
  const worlds = consistentWorlds(c)
  const blanks: BlankReport[] = []

  if (worlds.length === 0)
    return { worlds: 0, verdict: 'unsat', answerVectors: 0, blanks, undecided: 0, provisional: true }

  let undecided = 0
  const vectors = new Set<string>()
  const perWorld: string[][] = worlds.map(() => [])

  for (const ch of c.chapters)
    ch.blanks.forEach((b, i) => {
      const role = roleOf(c, b.label, b.answer)
      const seen = new Set<string>()
      const col: (string | null)[] = worlds.map((w) => {
        const v = answerOf(w, role)
        if (v === null) {
          if (role.kind !== 'none') undecided++
          return null
        }
        seen.add(v)
        return v
      })

      const discriminated = role.kind !== 'none' && seen.size > 1
      if (discriminated) col.forEach((v, wi) => perWorld[wi].push(v ?? '∅'))

      blanks.push({
        key: blankKey(ch.order, i, b.label),
        label: b.label,
        answer: b.answer,
        role: role.kind,
        verdict: discriminated ? 'discriminated' : 'vacuous',
        distinct: seen.size,
        values: [...seen].slice(0, 6),
        containsTrue: seen.size === 0 || seen.has(b.answer),
      })
    })

  for (const v of perWorld) vectors.add(v.join('|'))

  const verdict: SolveResult['verdict'] =
    undecided > 0 ? 'undecidable' : vectors.size <= 1 ? 'unique' : 'ambiguous'

  return {
    worlds: worlds.length,
    verdict,
    answerVectors: vectors.size,
    blanks,
    undecided,
    provisional: true,
  }
}
