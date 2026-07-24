export type PersonId = string
export type LocationId = string
export type SlotId = string
export type EvidenceId = string
export type FactId = string

export type HiddenRole =
  | 'ringleader' | 'accomplice' | 'coerced' | 'investigator' | 'unaware'

export type FactKind =
  | 'identity' | 'opportunity' | 'no_opportunity'
  | 'motive' | 'means' | 'contradiction' | 'context'

export type ActionYield = 'solution' | 'redherring' | 'exclusion' | 'empty'

/**
 * 공란 라벨 고정 어휘. 어휘는 고정, 구성은 가변
 *
 * `공범`은 폐기했다. 라벨 존재 자체가 "범인 말고 한 명 더 있다"를
 * 조사 0회에 누설하고(design-brief §3), 유일성 검증이 인물 1명에서
 * 인물 쌍으로 올라가며, `무고한 사람은 거짓말하지 않는다`의 이음매에
 * 앉아 진술 도출 규칙을 하나 더 요구한다.
 * 공범 관계는 진실 세계 배경과 관계 그래프 간선으로만 존재한다.
 */
export type BlankLabel =
  | '인물' | '장소' | '시각' | '도구' | '동기' | '정체'
  | '은폐수단' | '위장물' | '마지막목격자'
  | '접촉수단' | '은닉처' | '사인' | '물품' | '협박대상'

export type PresenceCell = { slot: SlotId; location: LocationId }

export type Person = {
  id: PersonId
  name: string
  age: number
  job: string
  hiddenRole: HiddenRole
  /** 진실 위치. 누가 언제 어디 있었는지. 부분적일 수 있다(미확인 슬롯 = 격자 공란) */
  presence: PresenceCell[]
  /**
   * 위치 진술. 진실(presence)과 다르게 말할 때만 선언한다.
   * 없으면 진술 = presence — 무고한 자는 거짓말하지 않으므로 진술이 도출된다.
   * 이것이 "무고한 사람은 거짓말하지 않는다"를 보장하는 유일한 방법이다:
   * 손으로 쓰지 않으므로 실수로 거짓이 섞일 수 없다.
   * 범인은 여기에 알리바이 거짓말(위치)을 담는다.
   */
  claim?: PresenceCell[]
}

/** 시간 슬롯. 순서는 배열 순서. 격자의 열이 된다 */
export type Slot = {
  id: SlotId
  label: string
  /** 사망 추정 시간대. 범인의 위치 거짓말이 이 슬롯에서 결정적이다 */
  isWindow?: boolean
}

/** 장소. 격자·평면도의 위치 어휘 */
export type Location = {
  id: LocationId
  label: string
  /** 산장 부지 안인가. 부지 밖(off-site)은 사건 현장 접근이 불가능하다 */
  atLodge: boolean
}

export type Fact = {
  id: FactId
  kind: FactKind
  subject: PersonId
  content: string
  /** 비어 있으면 진술에서 무료 획득 */
  revealedBy: EvidenceId[]
  requires?: FactId[]
  /** N개 장을 확인해야 등장 */
  availableAfter?: number
}

export type Evidence = {
  id: EvidenceId
  /** 카드 제목. 짧은 명칭 */
  description: string
  /** 발견 위치. 어느 조사에서 나왔는지는 Action 에서 역참조한다 */
  foundAt?: string
  /**
   * 기록. 3인칭 관찰만 적는다.
   * 목적·의도·기능 판정 금지 — '위조' '가명' '밀폐' 같은 단어를 쓰지 않는다.
   * 그것은 플레이어가 내릴 결론이다.
   */
  record?: string
  /**
   * 내용 자체가 물증인 경우 카드 하단에 덧붙는 확장.
   * 서식을 갈아치우지 않고 아래에 붙인다.
   */
  extra?: {
    kind: 'messages' | 'document' | 'transcript'
    lines: { side?: 'in' | 'out'; at?: string; text: string }[]
  }
  isStaging?: boolean
  /**
   * 현장 자유 물증. 조사 없이 처음부터 열람 가능하다 (진술·현장에서 무료).
   * 어떤 action.gives 에도 없으면서 확보 단어를 주는 물증은 이 표식이 있어야
   * 검증기가 "확보 가능"으로 인정한다. 없으면 도달 불가로 판정한다.
   */
  atScene?: boolean
  /** 이 물증을 확보하면 확보 단어에 추가되는 후보들 */
  yieldsTerms?: string[]
}

export type Action = {
  id: string
  label: string
  cost: number
  gives: EvidenceId[]
  salience: number
  boostedBy?: { fact: FactId; amount: number }[]
  yield: ActionYield
  /** N개 장을 확인해야 조사 대상이 열림 */
  availableAfter?: number
}

export type Trick = {
  type: string
  props: EvidenceId[]
  staging: EvidenceId[]
  flaw: string
}

/** 채점 부문. 라벨에서 도출된다 */
export type ScoreDomain = '물증' | '정황' | '심증'

export const DOMAIN_OF: Record<BlankLabel, ScoreDomain> = {
  '도구': '물증', '은폐수단': '물증', '위장물': '물증',
  '물품': '물증', '은닉처': '물증', '사인': '물증', '접촉수단': '물증',
  '인물': '정황', '장소': '정황', '시각': '정황', '마지막목격자': '정황',
  '동기': '심증', '정체': '심증', '협박대상': '심증',
}

export type Blank = {
  label: BlankLabel
  candidates: 'closed' | 'discovered'
  answer: string
  /**
   * 이 공란에 제시되는 후보 개수 (미끼 포함).
   * 생략 시 인물은 용의자 수, 그 외는 4로 가정한다.
   * 지목 장의 조합 수 계산에 쓰인다.
   */
  candidatePool?: number
  /**
   * 이 공란이 범인 지목인가.
   * 범인의 이름이 등장하는 것과 범인으로 지목하는 것은 다르다.
   * 예: '마지막목격자 = 사쿠라'는 지목이 아니다.
   */
  isAccusation?: boolean
}

/** 정보 공개 트리거. 장 확인이 아니라 인과적 사건이 정보를 연다 */
/**
 * 정보 공개 트리거.
 * 장 완성과 조사 실행 둘뿐이다. 공란 단위 트리거는 잠금과 충돌하므로 쓰지 않는다.
 */
export type RevealTrigger =
  | { on: 'action'; actionId: string }
  | { on: 'chapterComplete'; chapterOrder: number }

/**
 * 공개 정보의 유용도. 난이도의 핵심 손잡이.
 * decoy 는 거짓이 아니라 "참이지만 정답과 무관한" 정보다.
 * 공개 정보는 모두 확정 층이므로 거짓일 수 없다.
 */
export type RevealYield = 'path' | 'narrow' | 'decoy' | 'flavor'

export type Reveal = {
  trigger: RevealTrigger
  yield: RevealYield
  facts?: FactId[]
  actions?: string[]
  narrowsWindow?: [SlotId, SlotId]
  addClaims?: { speaker: PersonId; content: string; target: 'statement' }[]
  /** 공개 시 함께 뜨는 서사 조각 */
  narration?: string
  /** 이 정보가 도착하는 화면. 배지·라우팅용 */
  surface: 'statement' | 'map' | 'graph' | 'suspect' | 'overview'
}

/** @deprecated 장 확인 기반. Reveal 로 대체 */
export type ChapterReveal = {
  facts?: FactId[]
  actions?: string[]
  narrowsWindow?: [SlotId, SlotId]
  addClaims?: { speaker: PersonId; content: string }[]
}

export type Chapter = {
  order: number
  title: string
  blanks: Blank[]
  /** 이 사실들이 모이면 확정 가능. 잠금은 없고 정보 가용성이 게이트다 */
  requiresFacts: FactId[]
  /**
   * 결말 서사에서의 배치 순서. 장 순서(order)는 의존성 순이므로
   * 사건 시간순과 다를 수 있다. 생략 시 order 를 따른다.
   */
  epilogueOrder?: number
  reveals?: ChapterReveal
  /**
   * 결말 서사 조각. 이 장이 확인되면 확정된다.
   * 공란은 {blank_id}로 참조하며 플레이어의 답이 꽂힌다 (틀린 답도).
   * 결말 화면에서 사건 시간순으로 재배열되어 하나의 이야기가 된다.
   */
  epilogue?: string
}

export type IncidentKind =
  | 'homicide' | 'theft' | 'leak' | 'forgery'
  | 'disappearance' | 'sabotage'
  /** 조사 예산 0. 모든 정보가 텍스트에 있는 논리 퍼즐형. v1.5 */
  | 'audit'

export type Case = {
  id: string
  title: string
  scale: 'daily' | 'campaign'
  budget: number
  incident: {
    kind: IncidentKind
    /** 사건의 대상. 사람이 아닐 수도 있다 */
    subject: string
    description: string
    /** 사건 현장. 무고한 자가 사망 시간대에 여기 있으면 기회가 생긴다 */
    scene?: LocationId
  }
  /** 시간 슬롯 레지스트리. 진술 격자의 열 */
  slots: Slot[]
  /** 장소 레지스트리. presence·claim·공란의 위치 어휘 */
  locations: Location[]
  /** 문장의 출처. LLM 생성분은 파일에 고정된다 */
  prose?: {
    source: 'authored' | 'template' | 'llm'
    model?: string
    generatedAt?: number
  }
  people: Person[]
  victim: PersonId
  culprit: PersonId
  trick: Trick
  evidence: Evidence[]
  facts: Fact[]
  actions: Action[]
  chapters: Chapter[]
  /** 정보 공개 규칙. 장이 아니라 사건에 매단다 */
  reveals: Reveal[]
  /** 장당 재개봉 허용 횟수. 완성 후 되돌릴 수 있는 안전망 */
  reopenPerChapter: number
  /**
   * 보너스 트리거 (v1.5). 하이라이트·관계 연결로 조사를 절약한다.
   * 필수 경로가 아니므로 검증에서 제외된다.
   */
  bonusReveals?: {
    on: 'highlightLink' | 'graphLink'
    savesAction: string
    narration?: string
  }[]
}

export type GuiltCheck = {
  person: PersonId
  motive: boolean
  opportunity: boolean
  means: boolean
  guilty: boolean
}

export type VerifyResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
  guiltTable: GuiltCheck[]
  totalBlanks: number
  minActions: number
  minPath: string[]
  typicalActions: number
  typicalPath: string[]
  band: [number, number]
  keyFactRoutes: { fact: FactId; routes: number }[]
  domains: { domain: string; count: number }[]
  actionRatio: number
  decoyRatio: number
  difficulty: 'easy' | 'normal' | 'hard' | 'impossible'
}
