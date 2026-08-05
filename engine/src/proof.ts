/**
 * ─────────────────────────────────────────────────────────────
 *  증명 사슬 — 「이 답이 왜 유일한가」를 기계가 적는다 (2026-08-01 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 있나
 *
 * 2026-08-01에 **지목 아닌 인물 공란 48개가 전부 찍기**인 것을 찾았다. 답이
 * `innocents[0]`·`innocents[i % 4]` 라는 **배열 첨자**였고 무고한 넷은 산문에서
 * 완전히 대칭이었다. 게이트는 내내 초록이었다 — 검증기가 보던 것은 **장 전체의
 * 조합 수 ≥ 30**(찍기 난이도)이라, **공란 하나가 근거 없이 정해져도 곱이 크면
 * 통과한다.**
 *
 * 그날 급히 만든 `verifier` §6.8 은 두 갈래 휴리스틱이었고 **짓는 동안 나를 두 번
 * 속였다**(성을 붙인 이름만 찾아 산장이 빨개졌고, 장 전환 지문이 이름을 말해서 심은
 * 결함이 통과했다). 불리언 하나로는 **왜 통과했는지**를 알 수 없어서 생긴 일이다.
 *
 * **그래서 판정을 불리언에서 「사슬」로 바꾼다.** 증명이 안 나오면 그 공란은 못 낸다.
 *
 * ## 설계 출처
 *
 * `joshhills/logic-puzzle-generator`(MIT · TypeScript)의 구조를 참고했다 —
 * `Solver.applyClue()` 가 `{ deductions, reasons }` 를 돌려주고
 * `GenerativeSession` 이 `isDirectAnswer`·`targetSolvedStepIndex` 를 들고 있다.
 * **코드를 옮긴 것이 아니라 개념 넷을 가져왔다**(증명 사슬 · 직답 표시 · 목표 해결
 * 시점 · 후보 소거 반복). 그쪽은 **논리 격자**(범주별 값 개수가 같은 1:1 배정)라
 * 우리 세계(무고한 넷이 동시에 홀에 있다)에는 그대로 못 쓴다.
 *
 * ## 판정 세 갈래
 *
 * ```
 * 증명 있음 · 비용 > 0    정상. 조사해야 갈린다
 * 증명 있음 · 비용 = 0    ⚠ 누설. 조사 없이 답이 나온다
 * 증명 없음               ⚠ 찍기이거나, 아직 규칙이 없는 자리
 * ```
 *
 * ⚠ **「증명 없음」이 곧 결함은 아니다.** 아래 `RULES` 가 덮는 만큼만 증명된다 —
 * 규칙이 없어서 못 낸 것과 근거가 없어서 못 낸 것을 이 모듈은 **구분하지 못한다.**
 * 그래서 `npm run proof-check` 가 **덮인 비율**을 인쇄한다. 그 비율이 곧
 * 「검사되지 않는 축이 얼마나 남았나」다.
 */
import type { Blank, Case, Fact, PersonId } from './types.js'

const ko = (x: unknown): string =>
  typeof x === 'string' ? x : ((x as { ko?: string } | undefined)?.ko ?? '')

export type ProofStep = {
  /** 무엇을 보고 */
  observation: string
  /** 그것을 보려면 조사 몇 회. 0 이면 처음부터 보인다 */
  cost: number
  /** 어느 규칙이 그렇게 말하나 */
  rule: string
  /** 지워지는 후보 */
  eliminates: string[]
  remaining: number
}

export type BlankProof = {
  chapter: number
  label: string
  answer: string
  answerLabel: string
  candidates: string[]
  steps: ProofStep[]
  /** 후보가 하나로 좁혀졌나 */
  unique: boolean
  /** 증명에 필요한 조사 횟수의 합. 0 이면 조사 없이 풀린다 = 누설 */
  cost: number
  /**
   * 후보 어휘를 **무엇으로** 골랐나 — `asks`(선언된 물음) 인가 `label`(폴백) 인가.
   *
   * ⛳ **조용한 폴백은 조용한 버림과 같은 병의 다른 증상이다** (2026-08-05).
   * 라벨 폴백은 사건마다 자유로운 문자열에 기대므로, 새 라벨이 들어오면 **아무 말 없이
   * 빈 후보 → 공란 통째로 건너뜀**이 된다(`협박대상` 이 그랬다). 그래서 폴백을 쓴
   * 사실을 **세어서 인쇄한다** — 지우지 않고 보이게 두는 쪽을 골랐다.
   *
   * ⚠ `terms` 는 폴백이 아니다 — `candidates: 'discovered'` 는 후보가 **확보 단어
   * 목록**으로 정해져 있어 라벨도 `asks` 도 안 본다. 처음에 이 셋을 둘로 뭉뚱그려
   * **discovered 공란 전부를 「라벨 폴백」으로 세고 있었다**(293개 중 대부분).
   * 세는 것이 틀리면 인쇄가 거짓말이 된다.
   */
  poolSource: 'asks' | 'label' | 'terms'
}

/** 규칙 하나. 후보 집합을 줄이는 한 걸음을 낸다 */
type Rule = {
  id: string
  /** 이 공란에 걸리나 */
  applies: (ctx: Ctx) => boolean
  /** 걸리면 한 걸음을 낸다. 못 내면 null */
  step: (ctx: Ctx) => Omit<ProofStep, 'remaining'> | null
}

type Ctx = {
  c: Case
  chapter: number
  label: string
  answer: string
  /** 지금 남아 있는 후보 */
  pool: string[]
  /** 이 장의 서술문 텍스트(공란 자리는 뺀 것) */
  report: string
  /** 사람 id → 표시 이름 */
  nameOf: (id: string) => string
  /**
   * 이 공란이 **무엇을 묻는가**(`types.ts` §Asks).
   *
   * ⛳ 2026-08-05에 들어왔다. 그전까지 이 모듈은 **산문만 읽어서** 증명했고
   * (R1·R3·R6·R7), 그래서 서술문이 물건 이름을 안 말하는 손저작 공란은
   * **구조적으로 증명 불가**였다 — 근거가 없어서가 아니라 **읽을 채널이 없어서**다.
   */
  asks: Blank['asks']
}

/** 그 조사 결과 제목을 주는 사람이 유일하면 그 사람. 둘 이상이면 null */
function soleOwners(c: Case): Map<string, PersonId | null> {
  const m = new Map<string, PersonId | null>()
  for (const a of c.actions) {
    const pid = a.target?.kind === 'person' ? a.target.id : null
    const title = ko(a.result?.title)
    if (!pid || !title) continue
    m.set(title, m.has(title) ? null : (pid as PersonId))
  }
  return m
}

/** 그 조사를 하는 데 드는 비용 */
function costOfTitle(c: Case, title: string): number {
  const a = c.actions.find((x) => ko(x.result?.title) === title)
  return a?.cost ?? 1
}

/**
 * 그 사실을 알게 되는 데 드는 **최소** 조사 비용. `revealedBy` 가 비면 0(진술에서 무료).
 *
 * ⚠ 0 과 양수를 **다른 규칙 id 로** 내보낸다 — `clues.ts` 의 `isDeclaredPremise` 가
 * **규칙 id 로** 전제 여부를 가르기 때문이다. 한 id 로 뭉뚱그리면 「진술이라서 0」과
 * 「조사해서 양수」가 같은 이름을 달게 되고, 전제 판정이 둘을 못 가른다.
 */
function costOfFact(c: Case, f: Fact): number {
  if (!f.revealedBy.length) return 0
  const costs = c.actions
    .filter((a) => a.gives.some((eid) => f.revealedBy.includes(eid)))
    .map((a) => a.cost)
  return costs.length ? Math.min(...costs) : 0
}

/**
 * **플레이어가 읽을 수 있는 것만으로** 마지막 목격을 짚는다.
 *
 * `solver.ts` 의 `lastSighting` 과 **다른 데이터 경로다** — 저쪽은 반사실 세계의
 * `culpritTruth` 를 쓰고, 이쪽은 **진술(claim)** 과 **선언된 사망 구간**을 쓴다.
 * 플레이어는 범인의 진실 격자를 모르니 그것이 맞다.
 *
 * ⛳ `SOLVER-SPEC §9`(*"검산은 다른 데이터 경로"*)와 같은 이유로 일부러 따로 짰다 —
 * 같은 함수를 부르면 한쪽이 틀렸을 때 둘이 사이좋게 틀린다.
 */
function statedLastSighting(c: Case): { who: PersonId; at: string } | null {
  if (!c.victimPresence?.length) return null
  const order = c.slots.map((s) => s.id)
  // 사망 구간은 사건이 선언한다 — 플레이어도 브리핑에서 본다
  const windowAt = c.slots.findIndex((s) => s.isWindow)
  const from = windowAt >= 0 ? windowAt : order.length
  for (let i = from - 1; i >= 0; i--) {
    const slot = order[i]!
    const vAt = c.victimPresence.find((v) => v.slot === slot)?.location
    if (!vAt) continue
    const together = c.people
      .filter((p) => (p.claim ?? p.presence).some((x) => x.slot === slot && x.location === vAt))
      .map((p) => p.id)
    if (together.length === 1) return { who: together[0]!, at: vAt }
    if (together.length > 1) return null
  }
  return null
}

/** `asks: factSubject` 가 가리키는 사실 — 실재하고 주어가 답과 같을 때만 */
function subjectFact(x: Ctx): Fact | null {
  const asks = x.asks
  if (asks?.kind !== 'factSubject') return null
  const f = x.c.facts.find((y) => y.id === asks.fact)
  if (!f || f.subject !== x.answer) return null
  return f
}

/**
 * `asks: factValue` 가 가리키는 사실 — 실재하고 **값이 답과 같을 때만**.
 *
 * ⛳ `f.value !== x.answer` 면 `null` 을 낸다. 이 한 줄이 **저작 오류를 무는 자리**다 —
 * 사실의 값과 공란의 답이 어긋나면 증명이 안 서고 `solve-check` 이 무검사로 올린다.
 * `subjectFact` 의 `f.subject !== x.answer` 와 같은 모양이다.
 */
function valueFact(x: Ctx): Fact | null {
  const asks = x.asks
  if (asks?.kind !== 'factValue') return null
  const f = x.c.facts.find((y) => y.id === asks.fact)
  if (!f || f.value !== x.answer) return null
  return f
}

/**
 * 규칙표. **여기가 곧 「무엇을 증명할 수 있나」의 전부다.**
 * 새 규칙을 더하면 덮이는 공란이 늘고, 그것이 `proof-check` 의 비율로 나온다.
 */
const RULES: Rule[] = [
  /**
   * R1 소지품 고리 — 서술문이 **한 사람만 주는 조사 결과**를 말한다.
   *
   * 2026-08-01에 인물 공란 48개를 닫은 그 고리다. `HERRING` 이 사람마다 다른
   * 물건을 주고 소지품 검사가 1:1 로 드러낸다.
   */
  {
    id: 'R1 소지품 고리',
    applies: (x) => x.label === '인물',
    step: (x) => {
      const owners = soleOwners(x.c)
      for (const [title, pid] of owners) {
        if (!pid || !x.report.includes(title)) continue
        if (pid !== x.answer) continue
        const gone = x.pool.filter((p) => p !== pid)
        if (!gone.length) continue
        return {
          observation: `소지품 검사 → 「${title}」`,
          cost: costOfTitle(x.c, title),
          rule: 'R1 소지품 고리',
          eliminates: gone.map(x.nameOf),
        }
      }
      return null
    },
  },

  /**
   * R2 유죄 요건 — 지목 공란은 **동기·기회·수단 셋이 다 서는 사람**만 남는다.
   *
   * 이건 게임의 본체이고 §1(유일성)이 이미 받친다. 여기서는 **사슬로 적기만** 한다.
   */
  {
    id: 'R2 유죄 요건',
    applies: (x) => x.label === '인물' && x.answer === x.c.culprit,
    step: (x) => {
      const need = ['motive', 'opportunity', 'means']
      const have = need.filter((k) => x.c.facts.some((f) => f.kind === k && f.subject === x.c.culprit))
      if (have.length < need.length) return null
      const gone = x.pool.filter((p) => p !== x.c.culprit)
      if (!gone.length) return null
      /** 그 사실들을 여는 물증을 주는 조사의 비용 합 */
      const evIds = new Set(
        x.c.facts.filter((f) => need.includes(f.kind) && f.subject === x.c.culprit).flatMap((f) => f.revealedBy),
      )
      const cost = x.c.actions.filter((a) => a.gives.some((e) => evIds.has(e))).reduce((s, a) => s + a.cost, 0)
      return {
        observation: `유죄 요건 셋(${have.join('·')})이 한 사람에게 선다`,
        cost,
        rule: 'R2 유죄 요건',
        eliminates: gone.map(x.nameOf),
      }
    },
  },

  /**
   * R3 산문 지목 — 그 사람의 이름이 **산문 내용**에 나온다. 손저작이 쓰는 방식이다
   * (산장의 1장은 한유빈의 사연을 다른 진술이 말한다).
   *
   * ⛔ **조사 제목은 안 친다** — `소지품 검사 · X` 는 전원이 똑같이 갖는 목록이다.
   * ⛔ **장 전환 지문도 안 친다** — *"…남주원이 한마디를 보탰다"* 는 누가 말하는지만
   *    알린다. 이 한 줄 때문에 §6.8 첫 판이 심은 결함을 통과시켰다.
   * ⚠ **성을 뗀 꼴로 찾는다** — 한국어 진술은 「한유빈」을 「유빈 언니」로 부른다.
   */
  {
    id: 'R3 산문 지목',
    applies: (x) => x.label === '인물',
    step: (x) => {
      const bodies: string[] = []
      for (const p of x.c.people) for (const q of p.statement?.paragraphs ?? []) bodies.push(ko(q))
      for (const e of x.c.evidence) bodies.push(`${ko(e.description)} ${ko(e.record)}`)
      for (const a of x.c.actions) bodies.push(ko(a.result?.body))
      bodies.push(ko(x.c.prologue))

      const short = (id: string) => {
        const n = x.nameOf(id)
        return n.length > 2 ? n.slice(-2) : n
      }
      const named = x.pool.filter((p) => bodies.some((t) => t.includes(short(p))))
      // 답만 이름이 나와야 갈린다. 여럿 나오면 이 규칙으로는 못 좁힌다
      if (named.length !== 1 || named[0] !== x.answer) return null
      const gone = x.pool.filter((p) => p !== x.answer)
      if (!gone.length) return null
      return {
        observation: `산문이 「${x.nameOf(x.answer)}」만 이름으로 말한다`,
        cost: 0,
        rule: 'R3 산문 지목',
        eliminates: gone.map(x.nameOf),
      }
    },
  },

  /**
   * R4 확보 단어 — `discovered` 공란의 답은 **그 단어를 주는 조사**가 있어야 한다.
   * §6.5 가 이미 확보 가능성을 오류로 보므로, 여기서는 사슬과 **비용**을 적는다.
   */
  {
    id: 'R4 확보 단어',
    applies: (x) => (x.c.terms ?? []).some((t) => t.word === x.answer),
    step: (x) => {
      const giving = x.c.actions.filter((a) =>
        a.gives.some((eid) => x.c.evidence.find((e) => e.id === eid)?.yieldsTerms?.includes(x.answer)),
      )
      if (!giving.length) return null
      const gone = x.pool.filter((w) => w !== x.answer)
      if (!gone.length) return null
      return {
        observation: `「${ko(giving[0]!.label)}」가 단어 「${x.answer}」를 준다`,
        cost: Math.min(...giving.map((a) => a.cost)),
        rule: 'R4 확보 단어',
        eliminates: gone,
      }
    },
  },

  /**
   * R6 기록이 가리킨다 — 가닥 장의 서술문이 *"기록에 [단어]가 남아 있었고 [답]을
   * 가리켰다"* 고 묻고, **그 기록의 문안이 실제로 그 답을 말한다**(2026-08-01).
   *
   * 전에는 기록이 *"기록에 그대로 남아 있었다"* 라 **시각을 한 글자도 안 말했다** —
   * 인물 공란 48개와 같은 부류였고 `proof-check` 이 `시각 0/60` 으로 인쇄하던 자리다.
   */
  {
    id: 'R6 기록이 가리킨다',
    applies: (x) => x.label === '시각' || x.label === '장소',
    step: (x) => {
      const want =
        x.label === '시각'
          ? ko(x.c.slots.find((s) => s.id === x.answer)?.label)
          : ko(x.c.locations.find((l) => l.id === x.answer)?.label)
      if (!want) return null
      // 그 답을 문안에 말하는 물증 · 그것을 주는 조사
      for (const e of x.c.evidence) {
        if (!ko(e.record).includes(want)) continue
        const giving = x.c.actions.filter((a) => a.gives.includes(e.id))
        if (!giving.length) continue
        const gone = x.pool.filter((v) => v !== x.answer)
        if (!gone.length) continue
        return {
          observation: `「${ko(giving[0]!.label)}」의 기록이 「${want}」을 말한다`,
          cost: Math.min(...giving.map((a) => a.cost)),
          rule: 'R6 기록이 가리킨다',
          eliminates: gone,
        }
      }
      return null
    },
  },

  /**
   * R7 발견 시각 전제 — 시각 공란의 답이 **다시 모인 칸**(발견 시각)이면 브리핑이
   * 처음부터 말한다. 사건은 시신이 발견되면서 열리므로 **조사로 알아낼 것이 아니다.**
   *
   * ⚠ 그런데 08-01까지 **적혀 있지도 않았다** — 프롤로그·개요·현장 상태 셋 다 재봤고
   * 전부 없었다. 「전제라서 괜찮다」가 아니라 **전제로 쓰여 있지 않았던 것**이다.
   * 지금은 `incident.sceneState` 가 말한다.
   */
  {
    id: 'R7 발견 시각 전제',
    applies: (x) => x.label === '시각',
    step: (x) => {
      const want = ko(x.c.slots.find((s) => s.id === x.answer)?.label)
      const brief = `${ko(x.c.incident.sceneState)} ${ko(x.c.incident.description)}`
      if (!want || !brief.includes(want)) return null
      const gone = x.pool.filter((v) => v !== x.answer)
      if (!gone.length) return null
      return {
        observation: `브리핑이 발견 시각을 말한다 (전제)`,
        cost: 0,
        rule: 'R7 발견 시각 전제',
        eliminates: gone,
      }
    },
  },

  /**
   * R8 씨앗 단어 — 답이 `seedTerms` 이면 **진술 정독만으로 손에 들어온다.**
   *
   * `deriveTerms` 가 그렇게 정의한다 — 씨앗은 조사 0회 시점에 이미 확보 상태다
   * (산장의 「테이프」·「연탄」이 그것이고 브리핑의 `sceneState` 가 함께 말한다).
   * 그러니 비용 0 이고 **누설이 아니다** — §R5 현장 전제·§R7 발견 시각과 같은 자리다.
   *
   * ⚠ **반드시 R4 뒤에 둔다.** 씨앗이면서 조사로도 얻는 단어가 있다(생성 사건의
   * `tool` 이 그렇다 — 1장 도구 공란). 앞에 두면 **유료 경로가 있는데도 비용 0 으로
   * 증명**되어 그 공란이 조사 없이 풀리는 것처럼 보인다. R4 가 먼저 잡게 둔다.
   *
   * ★ 2026-08-01 밤에 발견 — 산장의 은폐수단 공란 둘(「테이프」)이 여기 있었다.
   * 규칙이 없어서 「찍기」로 인쇄되고 있었는데, 실제로는 브리핑이 이미 말하고 있었다.
   * **「증명 없음」이 결함이 아니라 규칙 없음이었던 실례다.**
   */
  {
    id: 'R8 씨앗 단어',
    applies: (x) => (x.c.seedTerms ?? []).includes(String(x.answer)),
    step: (x) => {
      const gone = x.pool.filter((w) => w !== x.answer)
      if (!gone.length) return null
      return {
        observation: `「${x.answer}」는 씨앗 단어다 — 진술 정독으로 얻는다 (전제)`,
        cost: 0,
        rule: 'R8 씨앗 단어',
        eliminates: gone,
      }
    },
  },

  /**
   * R5 현장 전제 — 장소 공란의 답이 **현장**이면 사건 개요가 처음부터 말한다.
   * 비용 0 이지만 **누설이 아니다** — 시신이 어디서 나왔는지는 전제이지 답이 아니다.
   */
  {
    id: 'R5 현장 전제',
    applies: (x) => x.label === '장소' && x.answer === x.c.incident.scene,
    step: (x) => {
      const gone = x.pool.filter((l) => l !== x.answer)
      if (!gone.length) return null
      return {
        observation: '사건 개요가 현장을 말한다 (전제)',
        cost: 0,
        rule: 'R5 현장 전제',
        eliminates: gone,
      }
    },
  },

  /**
   * R9 · R10 **사실의 주어** — 공란이 선언한 물음(`asks: factSubject`)을 그대로 읽는다.
   *
   * ## 왜 산문을 안 읽나
   *
   * R1·R3·R6·R7 은 전부 **서술문 문자열**을 뒤진다. 그래서 손저작 산장의 다섯 공란은
   * **구조적으로 증명 불가**였다 — 문장이 「요리를 돕기로 한 사람」이라 말하는데
   * 소지품 물건 이름(「파스」)이 글자로 없으니 R1 의 `report.includes` 가 영영 거짓이다.
   * 근거가 없어서가 아니라 **읽을 채널이 없어서** 못 낸 것이었다(2026-08-05 정독).
   *
   * `MANIFESTO §정보 이중화 원칙` 이 그 자리다 — **결정적 정보는 구조에 있고 산문은
   * 그것을 다시 말할 뿐**이어야 한다. 이 규칙이 구조 쪽을 읽는다.
   *
   * ## 왜 둘로 나눠 놓았나
   *
   * `clues.ts` 의 `isDeclaredPremise` 가 **규칙 id 로** 전제를 가른다. 「진술에서 무료」와
   * 「조사해서 얻음」을 한 id 로 내면 그 판정이 둘을 못 가르고, **전제를 넓히는 순간
   * 누설 검사에 구멍이 뚫린다.** 그래서 비용의 출처를 id 에 적는다.
   *
   * ⛔ **R9 를 `PREMISE` 에 넣지 않았다** — 자유 사실을 하나 더 쓰고 공란이 그것을
   * 가리키기만 하면 무엇이든 「정당하게 무료」가 되어 §5-b 의 누설 축이 죽는다.
   * 무료인 것이 정당한지는 **사건 설계의 판단**이라 사람이 본다.
   */
  {
    id: 'R9 사실의 주어 · 진술',
    applies: (x) => {
      const f = subjectFact(x)
      return Boolean(f) && costOfFact(x.c, f!) === 0
    },
    step: (x) => {
      const f = subjectFact(x)!
      const gone = x.pool.filter((v) => v !== x.answer)
      if (!gone.length) return null
      return {
        observation: `진술이 말한다 — 「${f.content}」`,
        cost: 0,
        rule: 'R9 사실의 주어 · 진술',
        eliminates: gone.map(x.nameOf),
      }
    },
  },
  {
    id: 'R10 사실의 주어 · 조사',
    applies: (x) => {
      const f = subjectFact(x)
      return Boolean(f) && costOfFact(x.c, f!) > 0
    },
    step: (x) => {
      const f = subjectFact(x)!
      const gone = x.pool.filter((v) => v !== x.answer)
      if (!gone.length) return null
      return {
        observation: `조사가 밝힌다 — 「${f.content}」`,
        cost: costOfFact(x.c, f),
        rule: 'R10 사실의 주어 · 조사',
        eliminates: gone.map(x.nameOf),
      }
    },
  },

  /**
   * R11 **마지막 목격** — `asks: lastSeenBy`·`lastSeenLoc` 을 진술 격자로 짚는다.
   *
   * 솔버 쪽 `lastSeenBy` 는 **세계의 함수**라 반사실 세계마다 갈리는데, 산장에서는
   * 갈린 값이 `{sakura, null}` 이라 `seen.size === 1` 이 되어 **`vacuous` 로 떨어진다**
   * (`solve()` 는 `null` 을 `seen` 에 안 넣는다). 그러면 관할이 proof 로 넘어오는데
   * 이쪽에 규칙이 없어서 **아무도 안 무는 공란**이 됐다 — 2026-08-05 `solve-check` 실측.
   */
  {
    id: 'R11 마지막 목격',
    applies: (x) => x.asks?.kind === 'lastSeenBy' || x.asks?.kind === 'lastSeenLoc',
    step: (x) => {
      const s = statedLastSighting(x.c)
      if (!s) return null
      const want = x.asks?.kind === 'lastSeenBy' ? s.who : s.at
      if (want !== x.answer) return null
      const gone = x.pool.filter((v) => v !== x.answer)
      if (!gone.length) return null
      return {
        observation: `진술 격자 — 사망 구간 이전에 피해자와 같은 칸에 있던 사람은 ${x.nameOf(s.who)} 하나다`,
        cost: 0,
        rule: 'R11 마지막 목격',
        eliminates: gone.map(x.nameOf),
      }
    },
  },

  /**
   * R12 · R13 **사실의 값** — `asks: factValue` 를 그대로 읽는다. R9·R10 의 짝이다.
   *
   * 저쪽이 사실의 **주어**를 물었다면 이쪽은 사실의 **값**을 묻는다. 산장 다섯이
   * 여기로 닫힌다 — 2장 시각 · 4장 물품·정체 · 5장 동기·은닉처.
   *
   * ## 왜 산문을 안 읽나 (R9 와 같은 이유)
   *
   * ```
   * f_alias_exists  「가명을 쓰는 유통책이 존재한다」   답 '김선생' 이 글자에 없다
   * f_last_seen     「새벽 3시까지 … 음주」            답은 슬롯 id 't1'
   * ```
   * 근거가 없어서가 아니라 **읽을 채널이 없어서** 못 냈다. 이제 구조가 답을 쥔다.
   *
   * ## ⛔ 둘로 나눈 이유도 R9·R10 과 같다
   *
   * `clues.ts` 의 `isDeclaredPremise` 가 **규칙 id 로** 전제를 가른다. 「진술에서
   * 무료」와 「조사해서 얻음」을 한 id 로 내면 그 판정이 둘을 못 가르고 **누설 검사에
   * 구멍이 뚫린다.** 그래서 비용의 출처를 id 에 적는다.
   *
   * ⛔ **R12 를 `PREMISE` 에 넣지 않았다** — 무료 사실 하나를 쓰고 공란이 그것을
   * 가리키기만 하면 무엇이든 「정당하게 무료」가 된다. 무료가 정당한지는 **사건
   * 설계의 판단**이라 사람이 본다(장 단위 `free_chapter` 로만 선언한다).
   *
   * ## ⚠ 지금 이 둘은 **발화 0 이다 — 죽은 규칙이 아니라 후순위 규칙이다**
   *
   * `proveBlanks` 는 규칙표 순서대로 돌다가 후보가 1개가 되면 멈춘다. 산장 다섯은
   * **먼저 오는 규칙이 이미 잡는다**(2026-08-05 실측):
   * ```
   * 4장 물품·정체 · 5장 동기·은닉처   R4 확보 단어   (pool=terms · 구조 채널)
   * 2장 시각                        R6 기록이 가리킨다 (pool=label · **산문 채널**)
   * ```
   * **이것이 현 상태에서 정상이다**(2026-08-05 사용자 확정). 이 둘이 서는 자리는
   * **R4 가 닿지 않는 미래 사건** — 확보 단어 경로가 없는 `factValue` 공란이다.
   * 그때 `byAsks` 도 `R4` 도 없이 값만 있는 공란을 이 둘이 받는다. **백업이다.**
   *
   * ⛔ **그러므로 발화 0 을 「고쳐야 할 것」으로 읽지 않는다.** 실효 방어는 다른
   * 두 곳에 있다 — 솔버의 `answerOf`(독립 경로)와 `schema.ts` 의 **답↔값 일치
   * 검사**(뮤테이션으로 물리는 것을 확인했다).
   *
   * ⛳ **순서를 바꾸지 않는다.** R12 를 R6 앞에 놓으면 2장 시각이 비용 0
   * (`f_last_seen.revealed_by: []`)이 되어 누설 경고가 하나 늘고, 그것을
   * `free_chapter` 로 덮으려면 **확인되지 않은 의도를 선언**하게 된다 —
   * 1장의 무료는 YAML 주석(*"1장이 조사 없이 확정되어야 하므로"*)이 받치는
   * 문서화된 설계지만, **2장의 무료는 `revealed_by: []` 가 만든 우연한 상태**이고
   * 저작 의도의 기록이 없다. **선언은 의도를 구조에 적는 행위라, 확인 안 된 것을
   * 선언하면 그것이 거짓 문서다**(2026-08-05 사용자 확정).
   */
  {
    id: 'R12 사실의 값 · 진술',
    applies: (x) => {
      const f = valueFact(x)
      return Boolean(f) && costOfFact(x.c, f!) === 0
    },
    step: (x) => {
      const f = valueFact(x)!
      const gone = x.pool.filter((v) => v !== x.answer)
      if (!gone.length) return null
      return {
        observation: `진술이 말한다 — 「${f.content}」`,
        cost: 0,
        rule: 'R12 사실의 값 · 진술',
        eliminates: gone.map(x.nameOf),
      }
    },
  },
  {
    id: 'R13 사실의 값 · 조사',
    applies: (x) => {
      const f = valueFact(x)
      return Boolean(f) && costOfFact(x.c, f!) > 0
    },
    step: (x) => {
      const f = valueFact(x)!
      const gone = x.pool.filter((v) => v !== x.answer)
      if (!gone.length) return null
      return {
        observation: `조사가 밝힌다 — 「${f.content}」`,
        cost: costOfFact(x.c, f),
        rule: 'R13 사실의 값 · 조사',
        eliminates: gone.map(x.nameOf),
      }
    },
  },
]

/**
 * 그 라벨의 후보 어휘.
 *
 * ⚠ **모르는 라벨은 빈 배열이고, 빈 배열이면 `proveBlanks` 가 그 공란을 통째로
 * 건너뛴다.** 그래서 「경고가 없다」와 「아예 안 봤다」가 화면에서 똑같이 보였다 —
 * 산장의 `협박대상` 공란이 그 상태로 살아 있었고, 2026-08-05에 `solve-check` 이
 * *"솔버도 proof 도 안 문다"* 로 잡아냈다. **안 보는 검사는 없는 검사다.**
 *
 * 그래서 **선언된 물음(`asks`)이 있으면 그것이 답의 영역을 정한다** — 라벨 어휘는
 * 사건마다 자유롭게 늘어나지만 `Asks` 는 닫힌 열 몇 가지라 여기가 훨씬 안전하다.
 * 라벨 판정은 `asks` 가 없는 공란(손저작 미기입)을 위한 폴백으로만 남는다.
 */
function poolFor(
  c: Case,
  label: string,
  candidates: 'closed' | 'discovered',
  asks?: Blank['asks'],
): string[] {
  if (candidates === 'discovered') return (c.terms ?? []).map((t) => t.word)
  return byAsks(c, asks) ?? byLabel(c, label)
}

/** 선언된 물음이 정하는 영역. 물음이 없거나 영역이 없는 종류면 `null` */
function byAsks(c: Case, asks?: Blank['asks']): string[] | null {
  switch (asks?.kind) {
    case 'culprit':
    case 'belongingsOwner':
    case 'factSubject':
    case 'lastSeenBy':
      return c.people.map((p) => p.id)
    case 'scene':
    case 'recordPlace':
    case 'lastSeenLoc':
      return c.locations.map((l) => l.id)
    case 'murderCell':
    case 'discoveryTime':
      return c.slots.map((s) => s.id)
  }
  return null
}

/** 폴백 — `asks` 가 없는 공란(손저작 미기입)용. **쓰이면 세어서 인쇄한다** */
function byLabel(c: Case, label: string): string[] {
  if (label === '인물' || label === '마지막목격자') return c.people.map((p) => p.id)
  if (label === '장소') return c.locations.map((l) => l.id)
  if (label === '시각') return c.slots.map((s) => s.id)
  return []
}

/** 사건의 모든 공란에 대해 증명을 시도한다 */
export function proveBlanks(c: Case): BlankProof[] {
  const nameOf = (id: string) => ko(c.people.find((p) => p.id === id)?.name) || id
  const out: BlankProof[] = []

  for (const ch of c.chapters) {
    const report = (ch.report ?? []).map((r) => ('text' in r ? r.text : '')).join('')
    for (const b of ch.blanks) {
      let pool = poolFor(c, b.label, b.candidates, b.asks)
      if (!pool.length) continue
      const steps: ProofStep[] = []

      /**
       * 규칙을 **더 못 줄일 때까지** 돌린다 — 참고 구현의 `runDeductionLoop` 와 같은
       * 모양이다. 한 규칙이 낸 걸음이 다음 규칙의 전제가 될 수 있다.
       */
      for (let guard = 0; guard < RULES.length + 2 && pool.length > 1; guard++) {
        let moved = false
        for (const rule of RULES) {
          const ctx: Ctx = {
            c, chapter: ch.order, label: b.label, answer: b.answer, pool, report, nameOf,
            asks: b.asks,
          }
          if (!rule.applies(ctx)) continue
          const s = rule.step(ctx)
          if (!s) continue
          pool = pool.filter((v) => !s.eliminates.includes(v) && !s.eliminates.includes(nameOf(v)))
          steps.push({ ...s, remaining: pool.length })
          moved = true
          if (pool.length <= 1) break
        }
        if (!moved) break
      }

      out.push({
        chapter: ch.order,
        label: b.label,
        answer: b.answer,
        answerLabel: nameOf(b.answer),
        candidates: poolFor(c, b.label, b.candidates, b.asks),
        steps,
        unique: pool.length === 1,
        cost: steps.reduce((s, x) => s + x.cost, 0),
        poolSource:
          b.candidates === 'discovered' ? 'terms' : byAsks(c, b.asks) ? 'asks' : 'label',
      })
    }
  }
  return out
}
