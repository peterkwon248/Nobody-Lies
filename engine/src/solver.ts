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
import type { Asks, Case, LocationId, PersonId, PresenceCell, SlotId } from './types.js'
import { deriveFacts, guiltTable, simulate } from './verifier.js'

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
  ctx: SolveContext,
  observed: Observation,
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

  // ── 여기부터 지식 조항 — **드러난 사실 위에서만** 묻는다 (§조항 재분류) ──
  //
  // ⚠ **위 C1·C2 는 세계 물리라 관측과 무관하다** — 세계의 내적 일관성이다.
  //   C3·C4 만 관측에 걸린다. 안 가르면 `curve` 가 0회 시점부터 세계 1이 된다.
  const facts = deriveFacts(c, observed.evidence, observed.confirmed)

  // C3 — **드러난 사실이 이 세계에서 참인가.** 「유죄가 서는가」가 아니다.
  //
  // ⛔ 「w.culprit 의 유죄 셋이 이미 섰나」로 쓰면 **k=0 에서 세계가 몰살한다** —
  //    아무것도 안 드러난 시점에는 누구의 유죄도 안 서기 때문이다. 수렴 방향이
  //    거꾸로다. 물어야 할 것은 **모순되나**이지 **증명됐나**가 아니다.
  if (c.facts.some((f) => f.kind === 'no_opportunity' && f.subject === w.culprit && facts.has(f.id)))
    return { ok: false, broke: 'C3' }

  // C4 — 드러난 사실이 **다른 사람**을 유죄로 확정했다면 이 가설은 죽는다.
  //      이것이 곡선을 내려가게 하는 기계다: 물증이 쌓이며 유죄가 한 사람으로
  //      좁혀지고, 그 사람이 아닌 범인 가설이 그때 지워진다.
  const guilty = guiltTable(c, facts).filter((g) => g.guilty).map((g) => g.person)
  if (guilty.length > 0 && !guilty.includes(w.culprit)) return { ok: false, broke: 'C4' }

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
  /** 사람마다 **하는 말**. 진술 정독은 무료이므로 k=0 부터 손에 있다 */
  stated: Map<PersonId, Map<SlotId, LocationId>>
}

/**
 * ⛳ **`guilty` 가 여기서 빠졌다** (2026-08-04). 전에는 이 캐시가 **전체 사실 위에서**
 * 유죄를 계산해 들고 있었는데, 그것을 `curve` 경로에서 그대로 쓰면 **0회 시점부터
 * 범인이 상수**가 되어 곡선이 평평한 거짓말이 된다. 유죄는 이제 `Observation` 이
 * 정한다(§지식 조항).
 */
export function buildContext(c: Case): SolveContext {
  return {
    window: windowSlots(c),
    stated: new Map(c.people.map((p) => [p.id, statedGrid(c, p.id)])),
  }
}

/**
 * **그 시점에 플레이어가 손에 쥔 것.**
 *
 * ⛔ `consistent` 의 **필수 인자**다. 옵션으로 두면 빼먹은 호출이 조용히 「전체 정보」가
 * 되고, 그것이 §조항 재분류의 함정이 **타입 시스템을 통과해 돌아오는 경로**다.
 */
export type Observation = {
  /** 그 시점까지 확보한 물증 */
  evidence: Set<string>
  /** 확인한 장 수 — `availableAfter` 게이트가 이것을 본다 */
  confirmed: number
}

/** 전체 정보. **명시적으로 만들어 넘긴다** — 기본값으로 숨기지 않는다 */
export function fullObservation(c: Case): Observation {
  return { evidence: new Set(c.evidence.map((e) => e.id)), confirmed: c.chapters.length }
}

/** 조사 0회 시점. 진술 정독 · 브리핑 · 씨앗 단어는 무료다(`atScene` 물증 포함) */
export function zeroObservation(): Observation {
  return { evidence: new Set(), confirmed: 0 }
}

/**
 * ⛳ `guiltyUnder` 헬퍼는 두지 않는다 — `consistent` 안에서 직접 편다.
 *
 * ★ **`deriveFacts` 를 반드시 `observed` 위에서 돌린다** ★ 전체 `c.facts` 를 읽으면
 * 조항만 가두고 파생을 안 가둔 것이라 **누수가 한 층 아래로 숨는다.** 그래서
 * `SolveContext` 캐시에 유죄를 넣지 않는다(위 주석 참조).
 */

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
/**
 * ⛔ **`roleOf` 는 삭제했다 — 폴백으로도 안 남긴다** (2026-08-04)
 *
 * 답의 구조적 우연으로 질문을 역추정하던 휴리스틱이었다. **하루에 두 번 틀렸다**:
 * ① 현장이 하필 범인이 한 칸에만 있던 장소라 36개가 가짜 모호가 됐고
 * ② 「언제」를 계산하려다 30건이 `undecidable` 이 됐다.
 * 두 번 다 실측이 잡았지 코드가 잡은 게 아니다.
 *
 * **같은 판정이 두 벌 있으면 갈라진다** — 그래서 안전망으로도 안 남긴다.
 * `asks` 가 없으면 `undecidable` 이다. C9 가 원래 그러라고 있다.
 */

/** 공란 하나를 사건 안에서 가리키는 열쇠. 장·순서로 짓는다 (id 필드가 없다) */
export const blankKey = (chapterOrder: number, i: number, label: string) =>
  `${chapterOrder}장·${i}·${label}`

/**
 * 답이 진짜 세계에서 하는 역할을 **구조로** 찾는다. 산문은 안 읽는다.
 */
/**
 * 공란이 묻는 것을 세계 `w` 에서 답한다.
 *
 * `null` 은 **C9 실패**다 — `asks` 가 없거나(손저작 미기입) 가리키는 것이 실재하지
 * 않는다. 삼키지 않고 `undecidable` 로 올린다.
 *
 * ⛳ **대부분은 세계와 무관하다** — 그래서 `vacuous` 로 떨어지고 관할이 `proof` 로
 * 간다(§6). 세계의 변수는 `culprit` 과 `murderCell` **둘뿐**이다.
 */
export function answerOf(c: Case, w: World, asks: Asks | undefined): string | null {
  if (!asks) return null
  switch (asks.kind) {
    // ── 세계의 변수 ──
    case 'culprit':
      return w.culprit
    case 'murderCell':
      return w.murderCell

    // ── 전제 · 구조 상수 ──
    case 'scene':
      return c.incident.scene ?? null
    case 'discoveryTime':
      return c.slots.length ? c.slots[c.slots.length - 1]!.id : null
    // 확보 단어 넷 — 전부 「그 물증이 주는 단어」다. 한 자리에서 푼다
    case 'murderWeapon':
    case 'culpritAlias':
    case 'culpritMotive':
    case 'strandTerm': {
      const e = c.evidence.find((x) => x.id === asks.evidence)
      return e?.yieldsTerms?.length === 1 ? e.yieldsTerms[0]! : null
    }

    case 'belongingsOwner': {
      // 그 물건을 주는 소지품 조사가 겨눈 사람. **1:1 이라야 답이 선다**(§식별 고리)
      const giving = c.actions.filter((a) =>
        a.gives.some((eid) => c.evidence.find((e) => e.id === eid)?.description === asks.item),
      )
      const who = [...new Set(giving.map((a) => (a.target?.kind === 'person' ? a.target.id : null)))]
      return who.length === 1 && who[0] ? who[0] : null
    }

    case 'recordPlace': {
      const e = c.evidence.find((x) => x.id === asks.evidence)
      return e?.pointsAt?.location ?? null
    }

    // 그 사실의 주어. 사실이 없으면 null — 삼키지 않는다
    case 'factSubject': {
      const f = c.facts.find((x) => x.id === asks.fact)
      return f?.subject ?? null
    }

    // 그 사실의 값. **`asks` 가 아니라 `Fact` 가 값을 쥔다** — 물음이 값을 품으면
    // 여기가 asks 를 되읽어 항진명제가 된다(기각된 안 · types.ts §Fact.value)
    case 'factValue': {
      const f = c.facts.find((x) => x.id === asks.fact)
      return f?.value ?? null
    }

    // ── 세계의 함수 (범인의 진실 격자에 의존한다) ──
    case 'lastSeenBy':
      return lastSighting(c, w)?.who ?? null
    case 'lastSeenLoc':
      return lastSighting(c, w)?.at ?? null

    /**
     * 지정된 칸을 읽는다. **진실 격자다 — `claim` 이 아니다**(types.ts §personAt).
     * 범인만 세계가 정하고 나머지는 자기 격자가 곧 진실이다(거짓말하지 않는다).
     * ⛳ 범인이 주어면 값이 세계마다 갈린다 — 그것이 이 의미론의 증명이다.
     */
    case 'personAt': {
      const cells =
        asks.person === w.culprit
          ? w.culpritTruth
          : (c.people.find((x) => x.id === asks.person)?.presence ?? [])
      return cells.find((x) => x.slot === asks.slot)?.location ?? null
    }
  }
}

/**
 * `murderCell` **이전** 슬롯 중 마지막으로 피해자와 같은 칸에 있던 사람과 그 장소.
 *
 * 「있던」은 세계 `w` 기준이다 — **범인만 `w.culpritTruth`**, 나머지 넷은 자기 격자다
 * (무고한 자는 거짓말하지 않으므로 `claim` 과 진실이 같다 · `types.ts` Person.claim).
 *
 * ⚠ **둘 이상이면 `null`** — 답이 세계의 함수가 아니다. C9 가 `undecidable` 로 올린다.
 */
function lastSighting(c: Case, w: World): { who: PersonId; at: LocationId } | null {
  if (!c.victimPresence?.length) return null
  const order = c.slots.map((s) => s.id)
  const murderAt = order.indexOf(w.murderCell)
  if (murderAt < 0) return null

  // 범인의 진실 격자는 세계가 준다. 나머지는 사건 데이터 그대로.
  const cellOf = (pid: PersonId): PresenceCell[] =>
    pid === w.culprit ? w.culpritTruth : (c.people.find((p) => p.id === pid)?.presence ?? [])

  for (let i = murderAt - 1; i >= 0; i--) {
    const slot = order[i]!
    const vAt = c.victimPresence.find((v) => v.slot === slot)?.location
    if (!vAt) continue
    const together = c.people
      .filter((p) => cellOf(p.id).some((cell) => cell.slot === slot && cell.location === vAt))
      .map((p) => p.id)
    if (together.length === 1) return { who: together[0]!, at: vAt }
    if (together.length > 1) return null // 모호 — 정직하게 뱉는다
  }
  return null
}

/**
 * ─────────────────────────────────────────────────────────────
 *  4단계 — `curve` · **솔버 값의 전부가 여기 있다**
 * ─────────────────────────────────────────────────────────────
 *
 * 전체 정보 `unique` 는 실측으로 **자동 충족**이었다(`discriminated` 0/702).
 * 그래서 그것은 출시 조건이 아니라 **건전성 전제조건**이고, 출시 조건은 이쪽이다:
 *
 * ```
 * 예산 내 오라클 경로에서 답안 벡터 1 에 도달하는가
 * ```
 *
 * `simulate` 의 `trace`(0단계에서 붙여둔 것)를 따라 관측을 누적하며 세계 수를 찍는다.
 */
export type CurvePoint = { step: number; action: string; cost: number; worlds: number; culprits: number }

export function curve(c: Case): CurvePoint[] {
  const sim = simulate(c, 1)
  const pts: CurvePoint[] = []

  const at = (step: number, action: string, cost: number, o: Observation) => {
    const ws = consistentWorlds(c, o)
    pts.push({ step, action, cost, worlds: ws.length, culprits: new Set(ws.map((w) => w.culprit)).size })
  }

  at(0, '(진술 정독 · 브리핑)', 0, zeroObservation())
  sim.trace.forEach((t, i) => {
    // ⛳ `confirmed` 는 그 시점 확인한 장 수다. `simulate` 는 가능해지는 즉시 장을
    //    확인하므로 보수적으로 **누적 조사 수 기준의 하한**을 쓴다 — 덜 지우는 쪽이다
    at(i + 1, t.action, t.cost, { evidence: new Set(t.evidence), confirmed: c.chapters.length })
  })
  return pts
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
  // ★ 전체 정보를 **명시적으로** 만들어 넘긴다 — 기본값으로 숨기지 않는다
  const full = fullObservation(c)
  const killedBy: Record<Clause, number> = { C1: 0, C2: 0, C3: 0, C4: 0 }
  const culprits = new Set<PersonId>()
  let enumerated = 0
  let surviving = 0

  for (const person of c.people) {
    for (const grid of gridAssignments(slots, locs)) {
      for (const murderCell of ctx.window) {
        enumerated++
        const r = consistent(c, { culprit: person.id, culpritTruth: grid, murderCell }, ctx, full)
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
    .map((murderCell) => consistent(c, { culprit: c.culprit, culpritTruth: trueGrid, murderCell }, ctx, full))
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

/**
 * 그 관측 아래의 일관 세계를 모은다. `solveGrid` 는 세기만 한다.
 *
 * ⛔ `observed` 는 **필수**다 — 전체 정보를 원하면 `fullObservation(c)` 를 만들어 넘긴다.
 */
export function consistentWorlds(c: Case, observed: Observation): World[] {
  const slots = c.slots.map((s) => s.id)
  const locs = c.locations.map((l) => l.id)
  const ctx = buildContext(c)
  const out: World[] = []
  for (const person of c.people)
    for (const grid of gridAssignments(slots, locs))
      for (const murderCell of ctx.window) {
        const w = { culprit: person.id, culpritTruth: grid, murderCell }
        if (consistent(c, w, ctx, observed).ok) out.push(w)
      }
  return out
}

export type BlankReport = {
  key: string
  label: string
  answer: string
  /** 이 공란이 묻는 것. `'none'` 은 `asks` 가 없다는 뜻이다 (손저작 미기입) */
  role: Asks['kind'] | 'none'
  verdict: 'discriminated' | 'vacuous'
  /** 일관 세계들이 낸 서로 다른 답의 수. vacuous 면 1(또는 asks 없음) */
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
  const worlds = consistentWorlds(c, fullObservation(c))
  const blanks: BlankReport[] = []

  if (worlds.length === 0)
    return { worlds: 0, verdict: 'unsat', answerVectors: 0, blanks, undecided: 0, provisional: true }

  let undecided = 0
  const vectors = new Set<string>()
  const perWorld: string[][] = worlds.map(() => [])

  for (const ch of c.chapters)
    ch.blanks.forEach((b, i) => {
      const seen = new Set<string>()
      const col: (string | null)[] = worlds.map((w) => {
        const v = answerOf(c, w, b.asks)
        if (v === null) {
          undecided++
          return null
        }
        seen.add(v)
        return v
      })

      const discriminated = seen.size > 1
      if (discriminated) col.forEach((v, wi) => perWorld[wi].push(v ?? '∅'))

      blanks.push({
        key: blankKey(ch.order, i, b.label),
        label: b.label,
        answer: b.answer,
        role: b.asks?.kind ?? 'none',
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
