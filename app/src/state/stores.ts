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
    quote?: string
    /** 인용의 층위. 확정(물증)과 주장(진술)을 섞지 않는다 — `HANDOFF` §6 */
    source?: '확정' | '주장'
    target?: string
    /** 만든 시각. 원본 `memoMeta()` 가 「오전 10:23 · 사건 보고서」를 만든다 */
    at?: number
    /** 어느 화면에서 만들었나. 되짚어 갈 실마리가 된다 */
    context?: string
  }[]
  cellMarks: { person: PersonId; slot: SlotId; kind: '확인' | '의심' | '모순' }[]
  boardItems: {
    id: string
    kind: 'person' | 'evidence' | 'note'
    x: number
    y: number
    links: string[]
  }[]
}

export const emptyAnnotations = (): PlayerAnnotations => ({
  highlights: [],
  notes: [],
  cellMarks: [],
  boardItems: [],
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
