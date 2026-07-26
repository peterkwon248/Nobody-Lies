import type { PersonId, SlotId } from '@engine/types'

/**
 * 저장소 3분리 — `HANDOFF-TO-CODE.md` §1 최우선 계약.
 *
 * ```
 * Case               불변. 사건 정의        → 정적 파일 (case/loadCase.ts)
 * PlayerAnnotations  가변. 플레이어가 만든 것 → 사건 하나 단위
 * CaseProgress       가변. 진행 기록          → 전체 단위
 * ```
 *
 * **프로토타입은 이 셋이 단일 상태 객체였다.** 처음부터 나눠두는 이유는 셋의
 * 수명이 다르기 때문이다 — 사건은 CDN 캐시, 주석은 사건별 로컬, 진행은 계정별.
 * 나중에 나누려면 저장 구조를 뜯어야 한다.
 */

export type HighlightKind = '표시' | '확인' | '의심' | '모순'

export type PlayerAnnotations = {
  highlights: { textRef: string; range: [number, number]; kind: HighlightKind }[]
  notes: {
    id: string
    content: string
    /**
     * 인용 원문. **따옴표를 붙이지 않은 날것이다** — 원본 `m.quote` 가 그렇고,
     * 화면이 `“…”` 를 그린다(메모장 401행 · 우측 패널 966행). 문자열에 미리
     * 박아두면 인용한 사람(`quoteWho`)을 따로 쓸 자리가 사라진다.
     */
    quote?: string
    /** 누구의 말인가. 원본 `quotePid` → 「— 서지안 · 인용」 */
    quoteWho?: string
    /** 인용의 층위. 확정(물증)과 주장(진술)을 섞지 않는다 — `HANDOFF` §6 */
    source?: '확정' | '주장'
    /**
     * 대상의 **종류**. 원본 `targetType`.
     *
     * `target` 하나만으로는 「서지안」이 인물인지 그 사람의 진술인지 구분이 안 된다.
     * 메모장의 필터·정렬·왼쪽 색 막대가 전부 이 값으로 갈린다.
     */
    targetType?: '없음' | '인물' | '진술' | '물증'
    target?: string
    /** 만든 시각. 원본 `memoMeta()` 가 「오전 10:23 · 사건 보고서」를 만든다 */
    at?: number
    /** 어느 화면에서 만들었나. 되짚어 갈 실마리가 된다 */
    context?: string
    /**
     * 인용 모으기. 켜둔 메모가 **둘 이상**이면 인용할 때 어디에 담을지 묻고,
     * **하나**면 묻지 않고 거기에 이어 붙인다 (원본 `routeQuote`).
     *
     * 원본은 `quotePins` 라는 별도 맵이라 메모를 지울 때 핀도 따로 지워야 했다.
     * 메모에 붙여두면 그 짝이 어긋날 자리가 없다.
     */
    pinned?: boolean
  }[]
  cellMarks: { person: PersonId; slot: SlotId; kind: '확인' | '의심' | '모순' }[]
  /**
   * 심증 — **플레이어 자신의 판단**이다. 게임은 여기에 관여하지 않는다.
   *
   * 절대 규칙(프로필의 유죄 판정 금지)에 걸리지 않는 이유가 그것이다.
   * 게임이 「기회 있음 ✓」이라고 말하는 것과 플레이어가 「유력」이라고 찍는 것은
   * 정반대다. **점수와 무관하고 채점에 쓰이지 않는다.**
   */
  verdicts: Record<PersonId, '제외' | '주목' | '유력'>
  /**
   * 용의자 화면에서 이미 본 조사. 여기 없는 조사에서 나온 단서에 「신규」가 붙는다
   * (원본 `seenClues` · `markProfileSeen()`).
   *
   * **조사 id 하나로 센다.** 원본은 `조사|인물|슬롯` 세 겹 키를 쓰는데, 한 조사의
   * 결과는 **동시에 도착하고 동시에 읽힌다** — `markProfileSeen()` 도 그 시점의
   * 기록 전체를 한꺼번에 본 것으로 처리한다. 세 겹으로 두면 같은 값을 세 벌 적는다.
   */
  seenClues: string[]
  board: Board
}

/** 연결선의 관계. 원본 `PB_REL`(1623행) 다섯 그대로 */
export type Relation = '모순' | '뒷받침' | '동일인' | '시간충돌' | '관련'

/**
 * 상황판 — 원본 `state.pb`.
 *
 * **여기가 이 게임에서 유일하게 「플레이어가 지은 것」이 남는 자리다.** 메모는
 * 글이고 마킹은 표시지만, 상황판은 배치다. 그래서 저장 구조가 화면 상태와
 * 섞이면 안 된다 — `pan`·`zoom`·선택은 **저장하지 않는다**(다시 열면 처음 화면).
 *
 * 한때 여기가 `boardItems: {id,kind,x,y,links}[]` 하나였다. 조각 위치와 연결선만
 * 있는 모양이라 그룹·라벨·시간축·크기를 담을 자리가 없었다 — stub 이었다.
 */
export type Board = {
  /** 판에 놓인 조각. key 는 카드 id(`p_yena`·`e_연탄`·`q_yena`·`m…`) */
  placed: Record<string, { x: number; y: number }>
  /** 조각 크기. 없으면 `full` */
  size: Record<string, 'dot' | 'chip' | 'full'>
  /** 판 위에서 쓴 메모. 메모장(`notes`)과 **다른 것이다** — 이건 배치물이다 */
  memoText: Record<string, string>
  memoOrder: string[]
  /** 연결선. 같은 짝은 하나만 남는다 */
  strings: { a: string; b: string; rel: Relation }[]
  /** 자유 텍스트 라벨 */
  labels: { id: string; x: number; y: number; text: string }[]
  /** 영역 · 교집합 · 타임라인 밴드 */
  groups: {
    id: string; x: number; y: number; w: number; h: number
    shape: '영역' | '교집합' | '타임라인'
    label: string
  }[]
  /**
   * 결속 — **같이 움직이는 조각들**. 영역(`groups`)과 다르다.
   *
   * 영역은 판 위의 자리이고 결속은 조각들끼리의 관계다. 그래서 결속은 흩어져
   * 있어도 되고, 하나를 끌면 전부 따라온다 (원본 `binds` · `PB_makeBlock`).
   */
  binds: { id: string; mem: string[] }[]
  /** 타임라인 시간 마커 */
  times: { id: string; x: number; label: string }[]
  /** 고정. 켜면 드래그가 안 된다 — 다 짜맞춘 판을 실수로 흐트러뜨리지 않도록 */
  pins: Record<string, boolean>
}

export const emptyBoard = (): Board => ({
  placed: {}, size: {}, memoText: {}, memoOrder: [],
  strings: [], labels: [], groups: [], binds: [], times: [], pins: {},
})

export const emptyAnnotations = (): PlayerAnnotations => ({
  highlights: [],
  notes: [],
  cellMarks: [],
  verdicts: {},
  seenClues: [],
  board: emptyBoard(),
})

/**
 * 진입 흐름의 단계. `design-brief.md` §4.01 — 화면 순서가 곧 게임 구조다.
 * 진술을 읽기 전에는 어떤 공란도 채울 수 없다.
 */
export type Stage = 'prologue' | 'brief' | 'read' | 'free'

/** 조사 기록. 협동 모드(v2) 대비 필드를 지금 넣어둔다 — 나중이면 저장 구조를 뜯는다 */
export type InvestigationEntry = {
  actionId: string
  at: number
  by?: string
  shared?: boolean
}

export type CaseProgress = {
  caseId: string
  status: 'unplayed' | 'in_progress' | 'cleared' | 'failed'
  /** 진입 흐름 어디까지 왔나. 이어하기가 이 값으로 복원한다 */
  stage: Stage
  /** 진술 정독을 마친 인물. 다 읽어야 1장이 열린다 */
  statementsRead: PersonId[]
  actionsUsed: number
  investigations: InvestigationEntry[]
  /**
   * 장별 재개봉 사용 여부. 장당 1회. **한 번 참이 되면 되돌아가지 않는다**
   */
  reopensUsed: Record<number, boolean>
  /**
   * 지금 재개봉해서 편집 중인 장.
   *
   * **`reopensUsed` 와 다른 상태다** — 원본이 `reopenUsed` / `reopenActive` 로
   * 나눠 갖고 있고, 「편집 완료」가 성립하려면 나뉘어야 한다. 하나로 두면
   * 닫는 순간 재개봉 권한이 되살아난다.
   */
  reopensOpen: Record<number, boolean>
  /** 공란 입력. key = `${chapterOrder}:${blankIndex}` */
  answers: Record<string, string>
  /** 완성된 장 (정답 여부와 무관하게 완성된다) */
  solved: number[]
  elapsedMs: number
  clearedAt?: number
  /**
   * 안 읽음 — 장을 완성해서 새 정보가 **도착한** 화면들 (원본 `unread`).
   *
   * ★ 재촉이 아니라 도착 신호다 ★ 토스트는 「어디에 생겼다」만 말하고 사라지고,
   * 점은 그 화면에 **들어가면** 사라진다. 무엇이 왔는지는 말하지 않는다 —
   * 그건 가서 읽을 일이다.
   *
   * 목적지는 `Reveal.surface` 가 정한다. 엔진이 이미 「이 공개가 어느 화면에
   * 내려앉는가」를 갖고 있으므로 그 값을 다시 도출하지 않는다.
   */
  unread: string[]
}

export const newProgress = (caseId: string): CaseProgress => ({
  caseId,
  status: 'unplayed',
  stage: 'prologue',
  statementsRead: [],
  actionsUsed: 0,
  investigations: [],
  reopensUsed: {},
  reopensOpen: {},
  answers: {},
  solved: [],
  elapsedMs: 0,
  unread: [],
})

// ── 영속화 ────────────────────────────────────────────────────────────
// 지금은 localStorage 다. `Case` 가 정적 파일이라 협동 모드 전까지 서버가
// 거의 필요 없다는 인프라 전략의 귀결이다 (`HANDOFF` §1).

const KEY = (kind: string, caseId: string) => `nobody-lies:${kind}:${caseId}`

export function load<T>(kind: 'progress' | 'annotations', caseId: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY(kind, caseId))
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}

export function save(kind: 'progress' | 'annotations', caseId: string, value: unknown): void {
  try {
    localStorage.setItem(KEY(kind, caseId), JSON.stringify(value))
  } catch {
    // 저장 실패는 플레이를 막지 않는다. 조용히 넘어간다
  }
}
