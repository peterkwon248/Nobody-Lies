/**
 * ─────────────────────────────────────────────────────────────
 *  생성 루프 되먹임 — 「답을 고르고 문장을 붙인다」를 뒤집는다
 * ─────────────────────────────────────────────────────────────
 * (2026-08-02 · `MEMORY.md` §근본 진단 · §값을 쟀다 — 국소적이다)
 *
 * ## 무엇이 거꾸로였나
 *
 * ```
 * 전    buildWorld → buildGameLayer(답을 첨자로 고름) → 문장을 붙임 → verifier 가 사후 검사
 * 후    buildWorld → buildGameLayer → proveBlanks → 약한 공란에 단서를 깐다 → 다시 잰다
 * ```
 *
 * 답이 `innocents[0]`·`WIN[0]` 같은 **배열 첨자**로 정해지고, **그 답에 도달할 단서를
 * 깔았는지는 아무도 안 물었다.** 2026-08-01에 인물 48개·시각 60개가 그렇게 찍기였고,
 * **게이트는 내내 초록이었다.** 이 모듈이 그 질문을 생성 경로 안으로 들여온다.
 *
 * ## ⚠ 이 모듈이 하지 **않는** 것
 *
 * **새 축을 덮지 않는다.** 하는 일은 **「지금 사람이 손으로 참으로 만든 것을 루프가
 * 강제하게」** 만드는 것뿐이다. 덮이는 범위는 `proof.ts` 의 `RULES` 가 전부이고,
 * 그것을 넓히는 일은 `matrix.ts` 의 **빈칸 19** 쪽이다. **둘을 같은 것으로 세면 안 된다.**
 *
 * 실측이 그렇게 말한다 — 착수 시점에 생성 사건의 공란은 이미 **320/320** 이 증명됐다.
 * 밀린 자리가 없으므로 이 루프는 **평소에 아무 일도 안 하는 것이 정상**이고, 값은
 * **회귀를 막는 데** 있다(08-01 부류가 일곱 번 재발했고 매번 게이트가 초록이었다).
 */
import type { Case } from './types.js'
import { proveBlanks, type BlankProof } from './proof.js'

const ko = (x: unknown): string =>
  typeof x === 'string' ? x : ((x as { ko?: string } | undefined)?.ko ?? '')

/**
 * **비용 0 이어도 정당한 규칙 — 선언된 전제.**
 *
 * ⚠ **blanket `cost > 0` 으로 종료 조건을 쓰면 안 된다.** 실측하니 생성 사건의 비용 0
 * 서른 개가 **정확히 R7(20) + R5(10)** 이다 — 우연히 무료인 것이 아니라 **전제로 선언한
 * 둘**이다(발견 시각 · 현장). 뭉뚱그려 물면 **검사가 거짓말이 된다.**
 */
const PREMISE = new Set(['R5 현장 전제', 'R7 발견 시각 전제', 'R8 씨앗 단어'])

/**
 * **비용 0 인데 정당한가** — 걸음이 **전부** 선언된 전제인가.
 *
 * 「조사 없이 풀린다」는 두 가지가 겹쳐 있다. **가르는 것이 이 함수 하나다:**
 *
 * ```
 * 전제라서 0    발견 시각 · 현장 — 사건이 열릴 때 이미 적혀 있다. 정당하다
 * 누설이라서 0   그 밖 전부 — 조사할 이유가 사라진다. 결함이다
 * ```
 *
 * `weakBlanks`(종료 조건)와 `proof-check`(계측)이 **같은 함수를 부른다** — 예전에는
 * 계측 쪽이 *"전제가 아니면 누설이다"* 라고 **판단을 사람에게 미루고** 있어서
 * 「손저작 비용 0 셋을 아직 안 갈랐다」가 블로커로 남아 있었다(2026-08-01에 닫음).
 */
export function isDeclaredPremise(p: BlankProof): boolean {
  return p.steps.length > 0 && p.steps.every((s) => PREMISE.has(s.rule))
}

/** 최대 회차. 이동이 서로를 열어줄 수 있으므로 한 바퀴로 안 끝날 수 있다 */
const MAX_ROUNDS = 4

export type Weakness = {
  chapter: number
  label: string
  /** 후보 id(사람이면 PersonId) */
  answer: string
  /** 화면에 뜨는 이름 */
  answerLabel: string
  /** `guess` 후보가 안 좁혀진다 · `free` 조사 없이 풀린다 */
  kind: 'guess' | 'free' | 'freeDeclared'
  why: string
}

/**
 * ★ **종료 조건** ★ 빈 배열이면 **「이 사건의 모든 공란이 조사로 갈린다」**.
 *
 * ```
 * unique  ∧  ( cost > 0  ∨  걸음의 규칙이 전부 선언된 전제 )
 * ```
 *
 * ⚠ **`cost > 0` 항이 핵심이다.** 없으면 「단서를 깐다」의 가장 싼 답이 **무료 관측에
 * 박는 것**이 되고, 루프가 그쪽으로 수렴한다. 그러면 `proof-check` 은 100% 인데
 * **게임은 조사가 필요 없어진다** — 계산은 완벽한데 명제가 틀린 꼴이다.
 */
export function weakBlanks(c: Case): Weakness[] {
  const out: Weakness[] = []
  for (const p of proveBlanks(c)) {
    const at = { chapter: p.chapter, label: p.label, answer: p.answer, answerLabel: p.answerLabel }
    if (!p.unique) {
      out.push({ ...at, kind: 'guess', why: `후보 ${p.candidates.length}개가 안 좁혀진다` })
      continue
    }
    if (p.cost > 0) continue
    if (isDeclaredPremise(p)) continue
    const by = p.steps.map((s) => s.rule).join('·') || '걸음 없음'
    /**
     * **선언된 장이면 문안만 바꾼다 — 경고를 끄지 않는다** (2026-08-05 · 사용자 조건).
     *
     * 끄면 「선언해서 조용한 것」과 「아무도 안 본 것」이 화면에서 같아진다. 같은 날
     * `poolFor` 가 정확히 그 모양으로 공란 하나를 통째로 숨기고 있었다.
     * 선언은 **장 단위 하나뿐**이다(`types.ts` §Chapter.freeChapter) — 사실 단위로 열면
     * 누설 축 구멍이 선언의 모습으로 부활한다.
     */
    const declared = c.chapters.find((ch) => ch.order === p.chapter)?.freeChapter
    out.push({
      ...at,
      kind: declared ? 'freeDeclared' : 'free',
      why: `조사 없이 풀린다 (${by})`,
    })
  }
  return out
}

/**
 * 이동 하나 = `proof.ts` 규칙 하나의 **역방향**.
 *
 * 규칙이 *"이것을 보면 갈린다"* 를 읽는다면 이동은 *"갈리도록 이것을 적는다"* 를 쓴다.
 * **짝이 맞아야 한다** — 규칙이 안 읽는 자리에 쓰면 루프가 영원히 안 끝난다.
 */
type Move = {
  id: string
  applies: (c: Case, w: Weakness) => boolean
  /** 실제로 바꿨으면 true. 이미 되어 있거나 재료가 없으면 false */
  lay: (c: Case, w: Weakness) => boolean
}

const MOVES: Move[] = [
  /**
   * ★ M1 발견 시각을 전제로 적는다 ★ — `R7 발견 시각 전제` 의 역방향.
   *
   * ⛔ **아무 시각에나 쓰면 안 된다.** 브리핑은 **무료 관측**이라 답을 여기 적으면
   * 그 공란은 조사 없이 풀린다 — 이 루프가 저지르기 가장 쉬운 배신이 정확히 이것이다.
   * **다시 모인 칸(발견 시각)만** 예외인 이유는 사건이 **시신이 발견되면서 열리기**
   * 때문이다. 조사로 알아낼 것이 아니라 처음부터 적혀 있어야 하는 것이고,
   * 08-01까지 **적혀 있지도 않았다**(프롤로그·개요·현장 상태 셋 다 재봤고 전부 없었다).
   *
   * ⚠ **`slots` 는 시간 축 순서다**(`generate.ts` §AXIS = `[FIRST, ...WIN, LAST]`).
   * 마지막 칸이 곧 다시 모인 칸이다.
   */
  {
    id: 'M1 발견 시각 전제',
    applies: (c, w) => w.label === '시각' && w.answer === c.slots.at(-1)?.id,
    lay: (c, w) => {
      const want = ko(c.slots.find((s) => s.id === w.answer)?.label)
      if (!want) return false
      if (`${ko(c.incident.sceneState)} ${ko(c.incident.description)}`.includes(want)) return false
      const where = ko(c.locations.find((l) => l.id === c.incident.scene)?.label)
      c.incident.sceneState = { ko: where ? `${want}, ${where}에서 발견됐다.` : `${want}에 발견됐다.` }
      return true
    },
  },

  /**
   * ★ M2 기록이 답을 말하게 한다 ★ — `R6 기록이 가리킨다` 의 역방향.
   *
   * 08-01에 시각 공란 60개를 닫은 손이다. 서술문이 *"기록에 [단어]가 남아 있었고
   * **[시각]을 가리켰다**"* 라고 묻는데 기록 문안이 *"기록에 그대로 남아 있었다"* 라
   * **시각을 한 글자도 안 말했다.**
   *
   * **물증은 조사 뒤에 열리므로 비용 > 0 이다** — M1 과 달리 아무 답에나 써도 누설이
   * 아니다. 장 → `requiresFacts` → `revealedBy` 로 **그 장이 여는 물증**을 찾고,
   * 그중 **실제로 조사가 주는 것**에만 적는다(아무 조사도 안 주면 비용이 0 이 된다).
   *
   * ⚠ **문안이 세 자리에 산다** — 물증 카드 · 조사 결과문 · 확보 단어 노트. 갈리면
   * 이 저장소 **최다 재발 부류**다(07-31 `REC_TOOL`·`REC_MUTUAL`). 그래서 같이 쓴다.
   *
   * ⚠ **문안이 투박한 것은 의도다.** 「기록에 남은 것은 「X」.」는 조사(助詞)를 안 타서
   * 어떤 답이 와도 안 깨진다. **이 이동은 평소에 안 도는 backstop 이고**, 돌았다는 것
   * 자체가 생성기가 회귀했다는 신호다 — 그때는 문장이 예쁜 것보다 **정확한 것**이 낫다.
   */
  {
    id: 'M2 기록이 가리킨다',
    applies: (_c, w) => w.label === '시각' || w.label === '장소',
    lay: (c, w) => {
      const want =
        w.label === '시각'
          ? ko(c.slots.find((s) => s.id === w.answer)?.label)
          : ko(c.locations.find((l) => l.id === w.answer)?.label)
      if (!want) return false
      const ch = c.chapters.find((x) => x.order === w.chapter)
      if (!ch) return false
      const need = new Set(ch.requiresFacts ?? [])
      const evIds = new Set(c.facts.filter((f) => need.has(f.id)).flatMap((f) => f.revealedBy))
      const ev = c.evidence.find(
        (e) => evIds.has(e.id) && !e.atScene && c.actions.some((a) => a.gives.includes(e.id)),
      )
      if (!ev || ko(ev.record).includes(want)) return false
      const line = `기록에 남은 것은 「${want}」.`
      ev.record = ev.record ? `${ev.record} ${line}` : line
      for (const t of c.terms ?? []) if (ev.yieldsTerms?.includes(t.word)) t.note = { ko: ev.record }
      return true
    },
  },
]

/**
 * ★ 루프 ★ 약한 공란이 없어질 때까지 단서를 깐다.
 *
 * **사건을 제자리에서 고친다**(mutate). 돌려주는 것은 **끝내 못 닫은 약점**이고,
 * 빈 배열이면 전부 닫혔다는 뜻이다.
 *
 * ⛔ **못 닫아도 throw 하지 않는다.** `generateCase` 는 브라우저의 `Generator.jsx` 가
 * 부르므로 **던지면 유저 화면이 통째로 죽는다**(2026-07-26에 `StatusIcon` 이 정확히
 * 그렇게 화면을 비웠다). 무는 것은 게이트(`clue-check`)와 검증기 쪽이다.
 *
 * ⚠ **이동이 없어서 못 닫은 것과 근거가 없어서 못 닫은 것을 이 모듈은 구분 못 한다** —
 * `proof.ts` 가 「증명 없음」에 대해 갖는 것과 같은 한계다. 그래서 남은 것을 **그대로
 * 돌려준다**(삼키지 않는다).
 */
export function closeClues(c: Case, maxRounds = MAX_ROUNDS): Weakness[] {
  for (let round = 0; round < maxRounds; round++) {
    const weak = weakBlanks(c)
    if (!weak.length) return []
    let laid = 0
    for (const w of weak) {
      for (const m of MOVES) {
        if (!m.applies(c, w)) continue
        if (m.lay(c, w)) {
          laid++
          break
        }
      }
    }
    // 한 바퀴 돌았는데 아무것도 못 깔았다 — 더 돌려도 같다
    if (!laid) return weak
  }
  return weakBlanks(c)
}

/** 이동 목록. `clue-check` 이 「심어서 확인」할 때 쓴다 */
export const MOVE_IDS = MOVES.map((m) => m.id)
