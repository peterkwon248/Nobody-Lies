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

/**
 * 두 언어짜리 문장.
 *
 * 어휘가 고정이라 번역이 싸다 — 템플릿 20개를 번역하면 사건 1000개가 번역된다
 * (`SYSTEM-DECISIONS.md` §7). `en` 이 없으면 아직 번역 전이라는 뜻이다.
 */
export type Text = { ko: string; en?: string }

export type Person = {
  id: PersonId
  name: string
  age: number
  /** 표시용. 진술 화면 머리글이 「여 · 31 · 댄스 강사」로 부른다. 판정과 무관하다 */
  sex?: string
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
  /**
   * 진술 원문. **산문가(빌드 타임 LLM)가 채우는 자리다.**
   *
   * 주장의 내용은 `claim`(없으면 `presence`)에서 나오고, 여기에는 말투와
   * 성격만 담긴다. 사실을 새로 쓰지 않는다 — 손으로 쓰면 실수로 거짓이 섞이고
   * 그 순간 "무고한 사람은 거짓말하지 않는다"가 깨진다.
   */
  statement?: {
    paragraphs: Text[]
    /**
     * 진술 앞뒤의 지문. 몸짓과 시선만 적고 **사실을 새로 쓰지 않는다.**
     *
     * 인터루드의 「인물 묘사 금지」와 헷갈리기 쉬운데 층이 다르다. 서술자는
     * **확정** 층이라 그가 누구를 오래 보면 그것이 신호가 되지만, 지문은
     * 진술 화면 안에 있고 진술은 **주장** 층이다.
     *
     * 대신 다른 규율이 붙는다 — **전원이 갖거나 전원이 없어야 한다.**
     * 넷은 담담하고 하나만 불안하면 지문이 곧 범인 표시가 된다.
     * 검증기가 이것을 강제한다.
     */
    gesture?: { pre?: Text; post?: Text }
    /** 말투 지시. 산문가가 읽는다. 플레이어에게 보이지 않는다 */
    voice?: string
  }
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

/**
 * 현장 평면도의 기하 — 프로토타입 `GEO`(2329행)를 옮긴 것.
 *
 * **사건 파일에 둔다.** 사건마다 도면이 다르고 `Case` 는 불변 사건 정의이므로,
 * 앱에 두면 사건이 자기 지도를 갖고 다닐 수 없다.
 *
 * **선택 항목이다** — 생성 사건(daily)은 도면을 뽑을 수 없으므로 필수로 만들면
 * 생성기가 막힌다. `prologue`·`terms` 와 같은 부류다.
 *
 * 좌표는 `viewBox` 안의 값이고 비율로 환산해 쓴다. 방·구역은 `loc` 로
 * `locations` 를 가리키며, **검증기가 그 참조를 검사한다.**
 */
export type FloorPlan = {
  /** 도면 좌표계 */
  viewBox: { w: number; h: number }
  /** 축척 막대 */
  scale?: { x: number; len: number; y: number; label?: string }
  /**
   * 건물 외벽(poché). 두꺼운 선으로 그린다.
   *
   * `revealedAfter` — N개 장을 완성해야 도면에 **나타난다.** `Action.availableAfter`
   * 와 같은 어휘다. 별채가 그렇다.
   *
   * ★ 흐리게 두지 않고 아예 감춘다 ★ 흐린 채로 두면 「저기 뭔가 있다」가 되고,
   * 그것은 조사 0회에 사건의 크기를 알려주는 셈이다.
   */
  buildings: {
    id: string; x: number; y: number; w: number; h: number
    poche?: string; revealedAfter?: number
  }[]
  /** 방. `loc` 이 `locations` 의 id 를 가리킨다 */
  rooms: {
    id: string; building?: string; loc?: LocationId
    x: number; y: number; w: number; h: number
    label: string
    /** 사건 현장이면 옅은 색이 깔린다 */
    scene?: boolean
    tint?: string
    /** 그 장소를 대표하는 방. 조사 실행 상자가 여기 붙는다 */
    primary?: boolean
  }[]
  /** 건물 밖 구역(진입로·자택 등) */
  zones: {
    id: string; loc?: LocationId
    x: number; y: number; w: number; h: number
    label: string
    /** 빗금 — 실내가 아님 */
    hatch?: boolean
    /** 부지 밖. 점선 테두리 */
    offsite?: boolean
    primary?: boolean
  }[]
  /** 문. `hinge`·`swing` 으로 스윙 아크를 그린다 */
  doors: {
    id: string; x1: number; y1: number; x2: number; y2: number
    hinge?: 'p1' | 'p2'; swing?: number
    /** 늘 열려 있는 통로 — 문짝을 안 그린다 */
    open?: boolean
    /** 외벽에 난 문 */
    ext?: boolean
    building?: string
    label?: string
    /** 라벨 위치 */
    lx?: number; ly?: number
  }[]
  /** 창문. 3선으로 그린다 */
  windows: {
    x1: number; y1: number; x2: number; y2: number
    building?: string; label?: string; lx?: number; ly?: number
  }[]
  /** 건물 사이 도보 경로. `min` 은 분 단위 소요 */
  walks: { building?: string; x1: number; y1: number; x2: number; y2: number; min?: number }[]
  /**
   * 고정물 — 화로·창문·금고·시신. 눌러서 조사한다.
   *
   * 키는 조사 대상 id 이고 값은 도면 위 좌표다.
   */
  fixtures?: Record<string, { x: number; y: number }>
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
  /**
   * 조사 결과문. **`gives` 바로 옆에 있어야 한다.**
   *
   * 2026-07-24 플레이테스트에서 터진 버그가 정확히 이 둘이 떨어져 있어서였다 —
   * 프로토타입의 금고 조사가 "유서 초안이 나왔다"고 말하는데 실제로 주는 것이
   * 없었다. 문장은 한 파일에, 데이터는 다른 파일에 있으니 어긋나도 아무도 몰랐다.
   * 붙여 놓으면 검증기가 잡는다.
   */
  result?: { title: Text; body: Text }
}

/**
 * 트릭 아키타입.
 * 이름표가 아니라 **계약**이다 — 아키타입마다 요구하는 부품이 다르고
 * 검증기가 그것을 강제한다. 생성기도 같은 계약을 채워서 만든다.
 */
export type TrickType =
  | 'staged_suicide' | 'locked_room' | 'alibi_fabrication'
  | 'body_moved' | 'identity_swap' | 'delayed_mechanism'

/**
 * 인상의 종류. 아키타입이 "이 종류의 인상이 반드시 있어야 한다"고 요구한다.
 */
export type IllusionKind = 'death' | 'time' | 'place' | 'absence' | 'identity'

/**
 * 아키타입 계약.
 *
 * **이름표가 아니라 계약이라는 것이 핵심이다.** `staged_suicide` 가 문자열이던
 * 아침에는 밀실 구멍을 못 잡았고, `exit` 을 요구하는 계약이 되자 즉시 잡혔다.
 * 원형을 서른 개 넣어도 계약이 없으면 아침 상태로 돌아간다.
 *
 * 기존 추리물의 트릭 원형을 넓히려면 **여기에 계약을 추가한다.**
 * 이름만 늘리는 것은 아무것도 늘리지 않는다.
 */
export type ArchetypeContract = {
  label: string
  /** 이 트릭이 플레이어에게 주장하는 것 */
  asserts: string
  /** 현장이 닫혀 있다고 주장하는가 — 그렇다면 이탈 방법이 필수다 */
  requiresExit: boolean
  /** 반드시 있어야 하는 인상의 종류. 하나라도 있으면 만족 */
  requiresIllusion: IllusionKind[]
  /** 이 게임 구조와 맞지 않는 경우 그 이유. 생성기가 쓰지 않는다 */
  unsupported?: string
}

export const ARCHETYPES: Record<TrickType, ArchetypeContract> = {
  staged_suicide: {
    label: '위장 자살',
    asserts: '스스로 목숨을 끊었다',
    requiresExit: true,
    requiresIllusion: ['death'],
  },
  locked_room: {
    label: '밀실',
    asserts: '아무도 드나들 수 없었다',
    requiresExit: true,
    requiresIllusion: [],
  },
  alibi_fabrication: {
    label: '알리바이 위조',
    asserts: '그 시각 그 자리에 없었다',
    requiresExit: false,
    requiresIllusion: ['time', 'absence'],
  },
  body_moved: {
    label: '시신 이동',
    asserts: '발견된 곳에서 죽었다',
    requiresExit: false,
    requiresIllusion: ['place'],
  },
  delayed_mechanism: {
    label: '지연 장치',
    asserts: '범인이 있을 때 벌어졌다',
    requiresExit: false,
    requiresIllusion: ['time'],
  },
  identity_swap: {
    label: '정체 뒤바꾸기',
    asserts: '이 사람은 이 사람이다',
    requiresExit: false,
    requiresIllusion: ['identity'],
    // 용의자 목록 자체가 거짓이 되면 닫힘 후보(드롭다운)가 무너지고
    // 조합 수 검사도 의미를 잃는다. 쓰려면 공란 체계를 먼저 손봐야 한다.
    unsupported: '용의자 목록이 거짓이 되면 닫힘 후보와 조합 수 검사가 무너진다',
  },
}

/**
 * 플레이어가 처음 믿게 되는 인상.
 * 트릭은 인상의 집합이고, **깨지지 않는 인상이 하나라도 있으면
 * 플레이어는 진실에 도달할 수 없다.**
 */
export type Illusion = {
  id: string
  /** 어떤 종류의 인상인가. 아키타입 계약이 이것을 요구한다 */
  kind: IllusionKind
  /** 플레이어가 믿게 되는 것 */
  impression: string
  /** 이 인상을 만든 물건 */
  madeBy: EvidenceId[]
  /** 이 인상을 깨는 물증. 비어 있으면 검증 실패 */
  brokenBy: EvidenceId[]
}

/**
 * 범인이 현장을 떠난 방법.
 *
 * 2026-07-24 플레이테스트에서 드러난 구멍이 정확히 이 부품의 부재였다 —
 * 문과 창이 안쪽에서 밀봉된 방에서 범인이 어떻게 나갔는지 아무도 설명하지
 * 않았고, 검증기는 물리적 성립성 모델이 없어 잡지 못했다.
 */
export type Exit = {
  /** 언제 떠났는가 */
  slot: SlotId
  /** 어떻게 떠났는가 */
  method: string
  /** 이탈을 가능하게 한 물건 */
  enabledBy?: EvidenceId[]
  /** 이탈이 있었음을 드러내는 물증. 없으면 플레이어가 밀실을 풀 수 없다 */
  brokenBy: EvidenceId[]
}

export type Trick = {
  /**
   * 아키타입은 **여럿을 겹칠 수 있다.** 실제 추리물의 트릭은 대개 조합이다 —
   * 산장 사건도 위장 자살(유서·밀폐)과 알리바이 위조(사망 시각 위장)가 겹쳐 있다.
   * 선언한 아키타입의 계약이 **전부** 적용된다.
   */
  types: TrickType[]
  props: EvidenceId[]
  staging: EvidenceId[]
  illusions: Illusion[]
  exit?: Exit
  flaw: {
    text: string
    /**
     * 이 허점이 실제로 심긴 자리. 물증 id 또는 인물 id(그 사람의 진술).
     * **자유 텍스트로 두면 아무 데도 없는 허점을 적을 수 있다** —
     * 작가가 머릿속에만 갖고 있고 플레이어는 영영 못 만난다.
     */
    plantedIn: string[]
  }
}

/** 채점 부문. 라벨에서 도출된다 */
export type ScoreDomain = '물증' | '정황' | '심증'

export const DOMAIN_OF: Record<BlankLabel, ScoreDomain> = {
  '도구': '물증', '은폐수단': '물증', '위장물': '물증',
  '물품': '물증', '은닉처': '물증', '사인': '물증', '접촉수단': '물증',
  '인물': '정황', '장소': '정황', '시각': '정황', '마지막목격자': '정황',
  '동기': '심증', '정체': '심증', '협박대상': '심증',
}

/**
 * 답 뒤에 붙는 한국어 조사. **받침 유무로 갈리는 쌍을 그대로 적는다.**
 *
 * 어느 쪽을 쓸지는 답이 정해져야 알 수 있고(`문세라가` / `백리원이`), 답은
 * 플레이어가 넣는다. 그래서 저작 시점에는 쌍으로 두고 렌더 시점에 고른다.
 * 조사가 필요 없는 자리(문장이 조사 없이 이어지는 경우)는 생략한다.
 */
export type Particle = '이/가' | '을/를' | '은/는' | '과/와' | '(으)로'

export type Blank = {
  label: BlankLabel
  candidates: 'closed' | 'discovered'
  answer: string
  /** 서술문에서 이 공란 뒤에 붙는 조사 */
  particle?: Particle
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
  /**
   * 장이 열릴 때 뜨는 절차 한 줄. 서술자 3인칭.
   *
   * **제목이 말하는 것 이상을 말하면 안 된다.** 장이 열리는 순간 제목도 같이
   * 공개되므로 제목과 같은 정보량까지가 상한이다.
   *   ○ '방 안의 일은 정리됐다. 남은 것은 그 전날 밤이었다.'   (= 마지막 정황)
   *   ✗ '산장에는 마약이 흐르고 있었다.'                       (답을 말한다)
   *   ✗ '별채를 살펴볼 때다.'                                   (조사 추천 = 금지)
   *
   * 전부 쓰거나 전부 비우거나 둘 중 하나다. 일부만 쓰면 그 자체가 신호가 된다.
   * 생성 사건은 제목에서 템플릿으로 뽑아도 된다.
   */
  opening?: string
  blanks: Blank[]
  /**
   * 보고서 서술문. **공란이 문장 안에 박힌다.**
   *
   * 이 게임의 보고서는 목록이 아니라 한 문단의 글이고, 공란은 그 문장의 일부다.
   * 플레이어가 채우는 것은 칸이 아니라 **문장**이다 — 그래서 답이 맞는지와 별개로
   * 자기가 쓴 문장이 읽힌다. 결말에서 그 문장을 그대로 다시 보게 되는 것이 이
   * 게임의 마지막 장치다.
   *
   * 텍스트 조각과 공란 참조(같은 장 `blanks` 의 인덱스)가 번갈아 온다.
   * 검증기가 **모든 공란이 정확히 한 번 참조되는지** 강제한다 — 참조되지 않은
   * 공란은 문맥 없이 뜨고, 두 번 참조된 공란은 같은 답을 두 번 묻는다.
   */
  report?: ({ text: string } | { blank: number })[]
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
    /**
     * 시신 상태. **조사 없이 보이는 것만.**
     *
     * 부검 소견은 여기 오지 않는다 — `f_cause` 는 `available_after: 1` 이고
     * 사인은 3장의 유료 공란이다. 여기 적히는 것은 「외상 없음」처럼 시신을
     * 보기만 해도 아는 것이고, 그것이 없으면 위장 자살이라는 전제가 1턴부터
     * 성립하지 않는다.
     */
    bodyState?: Text
    /**
     * 현장 상태. **`seedTerms` 로 이미 손에 들어오는 것의 서술형.**
     *
     * 장소 이름이 아니다 — 「방문·창가 테이프, 화로에 연탄」처럼 무엇이 놓여
     * 있었는가다. 한때 앱이 여기에 장소 라벨(`다인의 방`)을 넣어서 브리핑이
     * 은폐 정황을 아예 말하지 않았다.
     *
     * **검증기가 여기 적힌 확보 단어를 `seedTerms` 와 대조한다** — 조사로만
     * 얻어야 할 단어를 서술이 미리 말하면 무료 누설이다.
     */
    sceneState?: Text
  }
  /** 시간 슬롯 레지스트리. 진술 격자의 열 */
  slots: Slot[]
  /** 장소 레지스트리. presence·claim·공란의 위치 어휘 */
  locations: Location[]
  /**
   * 현장 평면도. 없으면 평면도 화면이 뜨지 않는다 — 생성 사건(daily)이 그렇다.
   * 검증기가 `rooms`·`zones` 의 `loc` 참조와 고정물 id 를 검사한다.
   */
  floorPlan?: FloorPlan
  /** 문장의 출처. LLM 생성분은 파일에 고정된다 */
  prose?: {
    source: 'authored' | 'template' | 'llm'
    model?: string
    generatedAt?: number
  }
  /**
   * 진술 정독만으로 확보되는 단어.
   * 진술문이 이미 언급하는 물건이므로 조사 없이 손에 들어온다.
   * 이것이 없으면 1장처럼 조사 없이 확정되어야 할 장의 discovered 공란을
   * 채울 수 없어 시작하자마자 막힌다.
   */
  seedTerms?: string[]
  /** 프롤로그. 브리핑·진술에 이미 있는 사실만 다룬다 — 새 정보는 0 */
  prologue?: Text[]
  /**
   * 확보 단어 카드에 찍히는 출처와 설명.
   * **`source` 는 실제 획득 경로와 일치해야 한다** — 어긋나면 플레이어에게
   * 버그로 읽힌다(2026-07-24: 유서가 '본채 금고'라고 적혀 있었는데 실제로는
   * 소지품에서만 나왔다).
   */
  terms?: { word: string; source: Text; note: Text }[]
  people: Person[]
  victim: PersonId
  /**
   * 피해자의 표시 정보.
   *
   * 피해자는 `people` 에 넣지 않는다 — `guiltTable` 이 `people` 을 순회하므로
   * 넣으면 피해자의 유죄를 계산하게 된다. 그런데 브리핑·프롤로그·결말은 피해자의
   * 이름을 부른다. 그 자리가 없어서 화면에 id(`chaewon`)가 그대로 나왔다.
   */
  victimProfile?: { name: string; age?: number; job?: string }
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
  /** 건너뛸 수 없는 조사. 답을 그 조사로만 얻을 수 있는 경우다 */
  mandatoryActions: { label: string; cost: number }[]
  /** 주장이 실제 동선과 어긋나는 인물. 범인 외에 등장하면 검증 실패다 */
  lies: { person: string; slots: SlotId[] }[]
  domains: { domain: string; count: number }[]
  actionRatio: number
  decoyRatio: number
  difficulty: 'easy' | 'normal' | 'hard' | 'impossible'
}
