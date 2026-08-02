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
import type { Case, PersonId } from './types.js'

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
]

/** 그 라벨의 후보 어휘 */
function poolFor(c: Case, label: string, candidates: 'closed' | 'discovered'): string[] {
  if (candidates === 'discovered') return (c.terms ?? []).map((t) => t.word)
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
      let pool = poolFor(c, b.label, b.candidates)
      if (!pool.length) continue
      const steps: ProofStep[] = []

      /**
       * 규칙을 **더 못 줄일 때까지** 돌린다 — 참고 구현의 `runDeductionLoop` 와 같은
       * 모양이다. 한 규칙이 낸 걸음이 다음 규칙의 전제가 될 수 있다.
       */
      for (let guard = 0; guard < RULES.length + 2 && pool.length > 1; guard++) {
        let moved = false
        for (const rule of RULES) {
          const ctx: Ctx = { c, chapter: ch.order, label: b.label, answer: b.answer, pool, report, nameOf }
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
        candidates: poolFor(c, b.label, b.candidates),
        steps,
        unique: pool.length === 1,
        cost: steps.reduce((s, x) => s + x.cost, 0),
      })
    }
  }
  return out
}
