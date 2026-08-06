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
  /**
   * 진술 한 줄 요약. 용의자 카드가 「본인 주장」으로 보여준다.
   *
   * ★ 요약이지 판정이 아니다 ★ `~라고 진술.` 로 끝나야 하고 참·거짓을 암시하지
   * 않는다. 다섯 사람의 요약이 전부 같은 형식이어야 하며, 하나만 길거나 짧으면
   * 그 차이가 곧 신호가 된다.
   */
  claimSummary?: Text
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
/**
 * 관계 도식 — 누가 누구와 어떻게 얽혀 있나.
 *
 * **평면도(`FloorPlan`)와 같은 자리에 산다.** 사건마다 관계가 다르고 `Case` 는
 * 불변 사건 정의다. 앱에 두면 사건이 자기 관계도를 못 갖는다.
 *
 * ★ 좌표는 저작이다 ★ 자동 배치(force layout)를 쓰지 않는다 — 매번 다르게
 * 그려지면 「저번엔 세라가 가운데였는데」가 되고, 무엇보다 **밀집도가 곧
 * 「여기가 중요하다」** 가 된다. 0~100 백분율.
 *
 * ★ 도식은 판정하지 않는다 ★ 아직 안 드러난 관계는 **흐리게가 아니라 없다.**
 * 흐린 선은 「저기 뭔가 있다」이고, 그건 조사 0회에 사건의 크기를 알려주는 것이다.
 */
export type RelationGraph = {
  nodes: {
    id: string
    /** `person` 이면 `id` 가 `people` 을 가리킨다. 이름·색을 거기서 읽는다 */
    kind: 'victim' | 'person' | 'secret'
    /** `person` 이 아닌 노드의 이름 */
    label?: Text
    x: number
    y: number
    /** N개 장을 완성해야 **나타난다** */
    revealedAfter?: number
  }[]
  edges: {
    from: string
    to: string
    label: Text
    revealedAfter?: number
    /** 붉은 선. 사건의 중심을 지나는 관계 */
    danger?: boolean
  }[]
  /**
   * 조사로 열리는 관계. 그 조사를 수행해야 나타난다.
   *
   * `node` 가 있으면 노드도 같이 생긴다(대포폰·위장 유서처럼 물증이 곧 노드인 것).
   * **같은 짝의 `edges` 선을 덮어쓴다** — 추정 관계가 물증으로 확정되면
   * 선이 둘이 되는 게 아니라 하나로 바뀐다 (원본 `supersede`).
   */
  discoveries: {
    action: string
    node?: { id: string; label: Text; x: number; y: number }
    from: string
    to: string
    label: Text
    danger?: boolean
  }[]
}

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
  /**
   * 건물 사이 도보 경로. `min` 은 분 단위 소요.
   *
   * ★ `from`·`to` 는 **장소**다 — 선분이 아니라 사건의 사실이다 ★ (2026-07-29 신설)
   *
   * 여기 있던 것은 좌표 선분 + `building` 뿐이었고, 그래서 앱이
   * *"엔진 `walks` 는 좌표 선분이라 쌍을 도출할 수 없다"* 며 도보 시간표를
   * **비워버렸다**(`App.jsx` §this.WALK = []). 산장에서는 `building: 'annex'` 가
   * 우연히 건물 id 이자 장소 id 라 표가 채워졌는데, 생성 사건은 건물이
   * `b_annex` 고 장소가 `loc3` 이라 **어긋나서 매번 경고만 났다.**
   *
   * ★ 그리고 이 숫자는 도면 장식이 아니다 ★ 산장에서 세라의 *"걸어서 10분"* 이
   * 이 값이다 — 사망 추정 구간이 다섯 시간이면 왕복이 가능하고, 그 판단을
   * **플레이어가** 한다. 그래서 진술이 이 숫자를 인용할 수 있어야 한다
   * (`generate.ts` §statementOf). **게임은 대조해주지 않는다** — §절대 규칙의
   * 「자동 분석 일체 금지」다.
   */
  walks: {
    building?: string
    /** 출발 장소. 없으면 앱이 도보 시간표에 담지 못한다 */
    from?: LocationId
    /** 도착 장소 */
    to?: LocationId
    x1: number; y1: number; x2: number; y2: number; min?: number
  }[]
  /**
   * 고정물 — 화로·창문·금고·시신. 눌러서 조사한다.
   *
   * 키는 조사 대상 id 이고 값은 도면 위 좌표와 이름표다.
   *
   * `label` 은 **도면 위에 그려지는 한국어 이름표**다. 사건마다 다른 어휘이므로
   * 엔진이 정본이다 — 사건 2번의 고정물은 이름이 다르다. `doors`·`windows` 의
   * `label` 과 같은 규약이고, **영문은 앱에 남는다**(평면도 로마자 표기가
   * 아직 결정되지 않았다 — 결정되면 방 이름과 함께 받는다).
   *
   * 아이콘은 **앱이 정한다.** 어느 글리프를 쓰는지는 표시 속성이고, 인물의
   * 색·이니셜과 같은 부류다. 없으면 공통 표식으로 떨어진다.
   */
  /**
   * `loc` — **어느 장소에 속한 고정물인가.** 앱이 「그 장소가 공개됐는가」로
   * 도면 위 표시를 거르므로(`revealedLocs[f.loc]`), 없으면 좌표가 있어도
   * **영영 안 그려진다.** 2026-07-29에 생성 사건에서 그렇게 죽어 있었다 —
   * 손으로 쓴 사건은 앱 표에 `loc` 이 박혀 있어서 드러나지 않았다.
   */
  fixtures?: Record<string, {
    x: number; y: number; label?: string; loc?: LocationId
    /**
     * 시신인가. 앱이 이것만 **붉게 · 아이콘 없이** 그리고, 누르면 `fixture` 가
     * 아니라 `autopsy` 를 돌린다(`App.jsx` §buildFloorplan fixtures).
     *
     * ⚠ **키는 `body` 여야 한다** — 앱 `targetKey` 가 부검 조사의 키를 언제나
     * `'body'` 로 만들기 때문이다. 이 플래그는 그 관례를 **데이터로 적어두는 것**이고,
     * id 만 보고 짐작하지 않게 한다.
     */
    body?: boolean
  }>
}

export type Fact = {
  id: FactId
  kind: FactKind
  subject: PersonId
  content: string
  /**
   * ★ 이 사실의 **값** ★ (2026-08-05 신설 · 사용자 승인)
   *
   * ## ⛔ 답의 사본이 아니다 — **사실이라는 저작물의 속성**이다
   *
   * 기각된 안은 *"`asks` 에 답의 단어를 적자"* 였다. 그러면 `answerOf` 가 `asks` 를
   * 읽어 되돌려주므로 **항진명제**가 된다 — 무엇을 물어도 언제나 맞는다.
   *
   * ```
   * ❌ asks 가 값을 품는다    answerOf(asks) = asks.term      항진명제
   * ✅ Fact 가 값을 갖는다    answerOf(asks) = fact(asks).value   가리킬 뿐이다
   * ```
   *
   * 「가명의 정체는 김선생이다」는 **저작된 사실**이고, 그 사실에 `revealedBy` 로
   * **도달 가능한가**는 별도로 검증된다. **대조의 실질이 그쪽으로 옮겨간다**
   * (`proof.ts` R12·R13 · `weakBlanks`). `belongingsOwner` 의 1:1 이 「검사가
   * 통과하는데 아무것도 안 문다」가 아니었던 것과 같은 자리다.
   *
   * ## 왜 `content` 로는 안 되나 — 재서 갈랐다 (2026-08-05)
   *
   * ```
   * f_alias_exists  content 「가명을 쓰는 유통책이 존재한다」  ← 답 '김선생' 이 글자에 없다
   * f_sakura_motive content 「분배금 다툼 + 폭로 임박」        ← 산문에 묻힌 부분 문자열
   * f_last_seen     content 「새벽 3시까지 본채에서 피해자와 음주」 ← 답은 슬롯 id 't1'
   * ```
   * **문자열을 파싱해도 못 찾거나, 찾아도 답의 꼴이 아니다.** 그래서 필드다.
   *
   * ⛳ **새 정보 생성이 아니라 파기 중단이다** — 생성기는 `f_identity`·`f_motive` 를
   * 만드는 순간 값을 이미 쥐고 있었고(`alias`·`motive`) 방출할 때 버리고 있었다.
   * `Blank.asks`·`Evidence.pointsAt` 과 같은 부류다(`MANIFESTO §정보 이중화 원칙`).
   */
  value?: string
  /**
   * ★ 인과 세 칸 — **동기가 「명사구 하나」로 끝나던 것을 편다** ★ (2026-08-06 신설)
   *
   * 발단: 테스터 5차 *"여전히 딱딱한 진실 나열"*. 진단은 **틀이 아니라 재료**였다 —
   * 1막 문장틀을 아무리 비트로 짜도 동기가 `content: '퍼진 소문'` 한 줄이면
   * **채울 인과가 없다**(`docs/ACT1-MEASUREMENT.md` §3 · 10건 전부 명사구였다).
   *
   * ```
   * background  무엇이 쌓였나      trigger  그날 무엇이 터졌나
   * resolve     왜 그 방법이었나
   * ```
   *
   * ⛳ **`content` 를 대체하지 않는다.** `content`(= 짧은 명사구)는 「동기」 공란의
   * **정답이자 확보 단어**다(`generate.ts` 의 공란·terms). 문장으로 바꾸면 드롭다운과
   * 단어 은행이 깨진다 — 그래서 **옆에 붙인다.**
   *
   * ⛳ **표현이지 사실이 아니다**(`MANIFESTO.md` §가름 축). 「무엇과 대조하면 틀렸다고
   * 말할 수 있나」에 대답이 없다 — 취향이다. 그래서 코드는 **자리만** 만들고 문안은
   * 저작(팔레트 · 사건 파일)에서 온다. 비면 1막이 짧은 폴백 한 줄로 돌아간다.
   *
   * ⚠ 오늘은 `kind: 'motive'` 사실만 쓴다. 다른 kind 에 다는 것을 막지는 않지만
   * **읽는 쪽이 없다** — 쓰기 전에 읽는 자리를 먼저 만든다.
   */
  story?: { background: string; trigger: string; resolve: string }
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
  /**
   * ★ 이 기록이 **가리키는** 장소·시각 ★ (2026-08-04 신설)
   *
   * `record` 산문이 *"…홀을 가리켰다"* 라고 말할 때 그 사실이 **글자에만** 살고
   * 있었다. `proof.ts` R6 가 `record` 텍스트에서 장소 이름표를 부분 문자열로 찾아
   * 우회하고 있었고(`Asks` 주석의 364개 중 40개가 이 자리), 솔버는 아무 말도 못 했다.
   *
   * ⚠ **`foundAt` 과 다르다.** `foundAt` 은 **발견된 곳**이고 사람이 읽는 문구다
   * (전수 44건에서 location id 인 것 0/51 — 그래서 옛 C7 조항이 폐기됐다).
   * 이쪽은 **가리키는 곳**이고 레지스트리 참조다. **둘을 같은 것으로 쓰면 안 된다.**
   *
   * ⛳ 생성기는 이 값을 이미 알고 쓴다(가닥의 조사가 `target: location 'hall'`).
   * 새 정보가 아니라 **파기 중단**이다 — `Blank.asks` 와 같은 부류.
   */
  pointsAt?: { location?: LocationId; slot?: SlotId }
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

/**
 * 조사 **동사**. 게임이 제공하는 조사 갈래이고 사건이 바뀌어도 이 여섯이다.
 *
 * 이것이 없으면 `label` 산문 접두(「소지품 검사 · 」「통화내역 조회 · 」)를
 * 파싱해야 동사를 안다. `target.kind` 로도 못 가른다 — `belongings` 와 `phone`
 * 이 **둘 다 person** 을 겨눈다.
 *
 * 앱이 조사를 `동사:대상id` 로 키잉하므로(`TERM_MAP`·`CLUE_MAP`·`FLOOR_CLUES`)
 * **`verb` + `target.id` 가 곧 그 키다.** 2026-07-27 에 신설했다.
 */
export type ActionVerb =
  | 'belongings' | 'search' | 'phone' | 'alibi' | 'autopsy' | 'fixture'

/**
 * 용의자 프로필의 세 칸. 조사가 여기에 한 줄씩 꽂는다.
 *
 * `facts` 의 `kind` 와 **다른 것이다.** `kind` 는 검증기가 유죄를 따지는
 * 논리 명제이고(`context`·`identity`·`no_opportunity` 까지 있다), 이쪽은
 * **플레이어가 보는 카드의 칸**이다. 셋뿐인 이유는 유죄 조건이 셋이라서다.
 */
export type ProfileSlot = 'motive' | 'means' | 'opportunity'

/**
 * 조사가 프로필에 남기는 한 줄.
 *
 * **조사 대상과 다른 사람에게 붙을 수 있다** — 백리원의 소지품에서 문세라에
 * 관한 것이 나오는 식이다. 그래서 `person` 을 명시한다.
 *
 * ★ 3인칭 관찰만 적는다 ★ 「~이므로 범인이다」 금지. 프로필의 유죄 판정은
 * 절대 규칙이 금지한 것이고, 이 칸이 그 규칙을 어기기 가장 쉬운 자리다.
 */
export type ActionClue = { person: PersonId; slot: ProfileSlot; text: Text }

export type Action = {
  id: string
  label: string
  /** 조사 갈래. 앱 키 = `verb:target.id` */
  verb?: ActionVerb
  /**
   * 이 조사가 용의자 프로필에 남기는 줄들. 앱 `CLUE_MAP` 의 정본이다
   * (2026-07-27 신설).
   *
   * `gives` 와 층이 다르다 — `gives` 는 **논리**(물증 id, 검증기가 읽는다),
   * 이쪽은 **화면**(프로필 카드에 뜨는 문장)이다. 같은 조사가 물증은 하나
   * 주면서 프로필에는 두 사람 몫을 남길 수 있다.
   */
  clues?: ActionClue[]
  cost: number
  gives: EvidenceId[]
  salience: number
  boostedBy?: { fact: FactId; amount: number }[]
  yield: ActionYield
  /** N개 장을 확인해야 조사 대상이 열림 */
  availableAfter?: number
  /**
   * 이 조사를 여는 지점. **평면도가 이 값으로 상자·고정물에 조사를 매단다.**
   *
   * 없으면 조사 화면 목록에서만 실행된다(알리바이 대조처럼 장소가 없는 것).
   * `id` 는 `kind` 에 따라 `locations` · `floorPlan.fixtures` · `people` 을 가리키고,
   * **검증기가 그 참조를 검사한다** — 도면을 고치면 조사가 조용히 끊긴다.
   */
  target?: { kind: 'location' | 'fixture' | 'person'; id: string }
  /**
   * **두 인물을 짝지어** 실행하는 조사. 알리바이 대조가 그것이다.
   *
   * `target` 과 다른 필드인 이유: 대상이 하나가 아니다. 평면도는 지점 하나에
   * 조사를 매달지만 이것은 매달 지점이 없고, 관계 도식에서 **두 명을 고르는
   * 행위 자체**가 실행 지점이다. 순서는 의미가 없다 — 검증기가 짝으로 본다.
   */
  pair?: [PersonId, PersonId]
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
  | 'staged_intrusion' | 'staged_accident'

/**
 * 인상의 종류. 아키타입이 "이 종류의 인상이 반드시 있어야 한다"고 요구한다.
 */
export const ILLUSION_KINDS = ['death', 'time', 'place', 'absence', 'identity'] as const
/**
 * ⛳ **값에서 타입을 뽑는다 — 반대가 아니다.** 예전에는 타입만 있어서 `schema.ts` 가
 * 같은 다섯 문자열을 **손으로 다시 적고** 있었다. 종류를 하나 늘릴 때 한쪽만 고치면
 * 조용히 어긋난다(`TRICK_TYPES` 와 같은 부류 · 이 저장소 최다 재발).
 */
export type IllusionKind = (typeof ILLUSION_KINDS)[number]

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
  /**
   * 외부인 위장 (2026-08-01 밤 신설 — 여섯째)
   *
   * ★ **다른 다섯과 속이는 축이 다르다** ★ 나머지는 전부 **사인·시각·장소**를 속인다.
   * 이것은 **용의자 집합 자체**를 속인다 — *"범인은 이 다섯 중에 없다"*.
   *
   * ⛳ **`identity_swap` 과 헷갈리면 안 된다.** 그쪽은 **용의자 목록이 거짓**이 되어
   * 닫힘 후보가 무너진다(그래서 `unsupported`). 이쪽은 **목록이 참인 채로** 바깥을
   * 가리키는 인상만 만든다 — 답은 여전히 다섯 중 하나라 공란 체계가 그대로 산다.
   *
   * `absence` 를 쓰는 이유: 인상이 *"범인이 이 안에 없었다"* 라 「그 자리에 없었다」의
   * 한 판본이다. `locked_room` 도 같은 종류를 *"아무도 드나들 수 없었다"* 로 쓴다.
   */
  staged_intrusion: {
    label: '외부인 위장',
    asserts: '바깥에서 누군가 들어왔다',
    requiresExit: false,
    requiresIllusion: ['absence'],
  },
  /**
   * 사고사 위장 (2026-08-01 밤 신설 — 일곱째)
   *
   * ⛳ **`staged_suicide` 와 인상 종류는 같고(`death`) 주장이 다르다** — 그쪽은
   * *"스스로 그랬다"*, 이쪽은 *"아무도 그러지 않았다"*. 추리물에서 다른 원형이고
   * **부품도 다르다**: 위장 자살은 남겨진 쪽지와 **이탈 방법**이 필요한데
   * (`requiresExit: true`) 사고는 닫힌 현장을 주장하지 않으므로 이탈이 필요 없다.
   *
   * ⚠ **기반 층을 안 건드린다** — 「흉기 바꿔치기」는 현장의 `e_tool` 자체를
   * 가짜로 만들어야 해서 빌더 하나로 안 끝난다. 이쪽은 **자국을 더할 뿐**이다.
   */
  staged_accident: {
    label: '사고사 위장',
    asserts: '사고로 죽었다',
    requiresExit: false,
    requiresIllusion: ['death'],
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

/**
 * ★ 이 공란이 **무엇을 묻는가** ★ (2026-08-04 신설)
 *
 * ## 왜 필요한가 — **질문이 산문에만 살고 있었다**
 *
 * `Blank` 이 갖는 것은 `label`(범주)과 `answer`(정답)뿐이었다. **무엇을 묻는지는
 * 서술문에만 있었다.** 그래서 적대적 솔버(`solver.ts`)가 답을 반사실 세계에서 다시
 * 계산할 수 없었고, `proof.ts` 는 **산문을 읽어서**(R1·R3·R6·R7) 우회하고 있었다.
 *
 * 실측(2026-08-04): 공란 702개 중 **364개(51.9%)가 산문을 읽는 규칙으로만** 검사된다.
 * 라벨로는 인물 171 · 시각 128 · 장소 65.
 *
 * ## 새 정보가 아니다 — **파기를 멈추는 것이다**
 *
 * 생성기는 공란을 만드는 순간 무엇을 묻는지 **알고 있다**(`generate.ts` 의 세 자리).
 * 방출할 때 버리고 있었을 뿐이다. 그래서 생성분 커버리지는 구조적으로 100% 다.
 *
 * ## ⛔ 추정하지 않는다
 *
 * 솔버가 답의 구조적 우연으로 질문을 **역추정**하던 휴리스틱(`roleOf`)은
 * **삭제했다.** 08-04 하루에 두 번 틀렸고(현장 전제 36개 · 사망 칸) 두 번 다
 * 실측이 잡았다. **같은 판정이 두 벌 있으면 갈라진다** — 폴백으로도 안 남긴다.
 * `asks` 가 없는 공란은 솔버가 `undecidable` 로 **정직하게 뱉는다**(C9 가 그러라고 있다).
 */
export type Asks =
  /** 범인은 누구인가 */
  | { kind: 'culprit' }
  /**
   * 확보 단어를 묻는 자리 셋. **어느 물증이 그 단어를 주는지**가 답의 채널이다.
   * ⛳ 처음에는 `evidence` 없이 뒀다가 80개가 틀린 답을 냈다 — 사실 id 를 돌려주고
   *    있었다. **「무엇을 묻나」만으로는 부족하고 「어디서 답이 나오나」가 함께 있어야
   *    한다**(2026-08-04 실측에서 잡았다).
   */
  | { kind: 'culpritAlias'; evidence: EvidenceId }
  | { kind: 'culpritMotive'; evidence: EvidenceId }
  | { kind: 'murderWeapon'; evidence: EvidenceId }
  /** 언제 죽였나 — 사망 구간 칸. **세계의 변수다**(`solver.ts` World.murderCell) */
  | { kind: 'murderCell' }
  /** 시신이 발견된 장소 — 사건 개요가 말하는 **전제** */
  | { kind: 'scene' }
  /** 발견 시각 — 다시 모인 칸. **전제** */
  | { kind: 'discoveryTime' }
  /** 소지품에서 그 물건이 나온 사람은 누구인가 (§식별 고리) */
  | { kind: 'belongingsOwner'; item: string }
  /**
   * **그 사실의 주어인 사람** (2026-08-05 신설 · 사용자 결정).
   *
   * 손저작 서술문 다섯이 「소지품 소유자」가 아니라 **그 사람이 한 일**을 묻고 있었다.
   * 정독으로 갈렸다 — 「요리를 돕기로 한 사람」·「전화를 받았다고 진술한 사람」·
   * 「가명을 캐묻기 시작한 사람」은 소지품과 아무 상관이 없다.
   *
   * ⛔ **`belongingsOwner` 로 때우면 안 된다** — 산장 넷은 소지품 고리가 1:1 이라
   * `answerOf` 가 **우연히 맞는 답**을 돌려준다. 검사가 통과하고 **솔버는 틀린 물음
   * 위에서 증명한다.** `roleOf`(답만 보고 질문을 추정)가 08-04에 두 번 틀린 것과
   * 같은 부류를 손저작에서 세 번째로 밟는 자리였다.
   *
   * ⛳ **어휘를 다섯 개 늘리지 않고 하나로 줄인 것이 이 설계다** — 물음이 다 다르지만
   * 전부 「그 사실의 주어」로 환원된다. 사실이 없으면 **거울한다**(파기 중단) —
   * 문안은 **진술이 말한 것만** 담는다. 진술에 없는 것을 사실로 만들면 그것이
   * 새 정보 생성이고, ⑤검열관 ⓐ가 잡아야 할 부류를 손으로 심는 것이 된다.
   */
  | { kind: 'factSubject'; fact: FactId }
  /**
   * **그 사실의 값** (2026-08-05 신설 · 사용자 승인). 답의 채널은 `Fact.value` 다.
   *
   * `factSubject` 의 짝이다 — 저쪽은 사실의 **주어**를, 이쪽은 사실의 **값**을 묻는다.
   * 산장 다섯이 이 하나로 닫힌다(2장 시각 · 4장 물품·정체 · 5장 동기·은닉처).
   *
   * ## ⛔ 왜 `strandTerm` 으로 못 때우나 — 세서 갈랐다
   *
   * 넷이 `candidates: discovered` 라 확보 단어처럼 보이는데, **카드 한 장이 단어
   * 여러 개를 준다:**
   * ```
   * e_wy_text  yields_terms [김선생, 마약, 폭로 임박]     ← 셋
   * e_burner   yields_terms [별채 대포폰, 김선생, 폭로 임박] ← 셋
   * ```
   * `strandTerm` 은 `yieldsTerms.length === 1` 일 때만 답을 가른다. **손저작에서만
   * 깨지는 전제다** — 생성분은 가닥마다 카드가 1:1 이라 지금 구현이 맞다.
   *
   * ## ⚠ 후보 영역은 이 물음이 정하지 못한다
   *
   * 값의 도메인은 **사실마다 다르다**(슬롯 id · 확보 단어 · 그 밖). 그래서
   * `byAsks` 가 `null` 을 돌려주고 라벨이 영역을 준다. **답을 보고 도메인을
   * 역추정하지 않는다** — 삭제된 `roleOf` 가 그 부류였다(08-04에 두 번 틀렸다).
   */
  | { kind: 'factValue'; fact: FactId }
  /**
   * **생전의 피해자를 마지막으로 본 사람** (2026-08-05 신설 · 사용자 승인).
   *
   * 의미론: `murderCell` **이전** 슬롯 중 마지막으로, 피해자와 같은 칸에 있던 사람.
   * 「있던」은 세계 `w` 기준이다 — 무고한 넷은 `claim`(거짓말하지 않으므로 진실과 같다),
   * 범인은 `w.culpritTruth`.
   *
   * ★ **그래서 이것이 진짜로 세계의 함수다** — 범인의 진실 격자가 세계마다 다르니
   * 답이 갈린다. 인계가 기대한 **첫 `discriminated` 공란**이 이 의미론에서 성립한다.
   *
   * ⚠ 같은 칸에 둘 이상이면 답이 세계의 함수가 아니다 → `null`(= C9 `undecidable`).
   * 정직하게 뱉는 것이 맞다.
   *
   * ⛔ 초안 의미론(*"`murderCell` **직전**, 피해자와 **현장**에 같이 있던 사람"*)은
   * **산장에서 계산이 안 섰다** — murderCell 직전(t1)에 세라는 별채에 있고 현장은
   * 방이다. 문장이 말하는 목격은 그 **한 칸 더 앞(t0 · 본채)**이다. 정독 없이
   * 박았으면 `answerOf` 가 sakura 를 못 돌려줬다.
   */
  | { kind: 'lastSeenBy' }
  /** 그 목격이 일어난 칸의 장소. **`lastSeenBy` 에 종속된다** (같은 슬롯을 쓴다) */
  | { kind: 'lastSeenLoc' }
  /**
   * **그 사람이 그 칸에 있던 장소** (2026-08-05 신설 · 사용자 확정).
   *
   * `lastSeenBy`·`lastSeenLoc` 과 같은 **격자 읽기 계열**이다. 저쪽이 피해자를
   * 기준으로 칸을 찾아 읽는다면, 이쪽은 **칸을 지정해서** 읽는다.
   *
   * ## 왜 「알리바이 행선지」 어휘를 안 만들었나
   *
   * `practice-room` 2장이 *"한 사람은 [cvs]로 향했고 왕복 사십 분"* 을 묻는다.
   * 「알리바이 행선지」 하나 때문에 어휘를 늘리는 것이 **어휘가 사건마다 자라는
   * 길의 입구다.** 순서대로 쟀더니 ①에서 끝났다 — 답 `cvs` 가 곧 `p4` 의 `t2` 칸이다.
   *
   * ## ★ 진실 격자를 읽는다 — `claim` 이 아니다 ★
   *
   * **보고서 공란은 「세계의 참」을 묻지 「그 사람이 뭐라고 말했나」를 묻지 않는다.**
   * `claim` 을 읽으면 그것은 **다른 물음**이 된다. 그런 공란이 나중에 필요하면
   * `claimedAt` 을 따로 만들고, **둘을 한 어휘에 섞지 않는다**(사용자 확정).
   *
   * ```
   * 범인      w.culpritTruth   ← 세계마다 갈린다
   * 나머지    people[].presence  (거짓말하지 않으므로 claim 과 같다)
   * ```
   *
   * ⛳ **범인이 주어면 `discriminated` 가 되는 것이 부작용이 아니라 이 의미론의
   * 증명이다** — 범인의 진짜 위치를 묻는 공란은 세계를 갈라야 정상이다.
   *
   * ⚠ 그래서 `schema.ts` 의 방어는 **진짜 세계에서의 일치까지만** 묻는다
   * (`people[].presence` 와 대조). 전 세계 일치를 요구하면 **정상 동작을 오류로
   * 잡는다.** 나머지는 솔버의 판정 몫이다.
   */
  | { kind: 'personAt'; person: PersonId; slot: SlotId }
  /** 그 기록이 말하는 확보 단어 */
  | { kind: 'strandTerm'; evidence: EvidenceId }
  /** 그 기록이 **가리키는** 장소. 답의 채널은 `Evidence.pointsAt` 이다 */
  | { kind: 'recordPlace'; evidence: EvidenceId }

export type Blank = {
  label: BlankLabel
  candidates: 'closed' | 'discovered'
  answer: string
  /**
   * 이 공란이 무엇을 묻는가. 위 `Asks` 참조.
   *
   * ⛳ **선택 항목이다** — 손저작 4건이 아직 안 채웠다. 없으면 솔버가 그 공란에
   * 대해 `undecidable` 을 낸다(삼키지 않는다).
   */
  asks?: Asks
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
  /**
   * 장 완성·조사로 **새로 열리는 주장.** 도착하는 표면이 둘이다.
   *
   * | `target` | 어디에 | 문장 길이 |
   * |---|---|---|
   * | `statement` | 그 인물의 진술에 문단이 하나 붙는다 | 말한 그대로 |
   * | `grid` | 진술 격자의 `(인물, slot)` 칸이 채워진다 | **짧은 라벨** |
   *
   * 같은 사건이 두 표면에 다 뜨기도 한다 — 오나경의 새벽 통화가 진술에서는
   * 「새벽에 다인 언니가 저한테도 전화를 했었어요」로, 격자에서는
   * 「통화 중 (본인 주장)」으로 뜬다. **격자는 칸이라 길면 안 들어간다.**
   *
   * `grid` 는 `slot` 이 필수다 — 격자의 열이 시간대이기 때문이다.
   * 2026-07-27 신설. 그전엔 `target: 'statement'` 하나뿐이라 **진술만 늘리고
   * 격자는 못 건드렸다**(앱 `CLAIM_REVEALS` 가 엔진 밖에 남아 있던 이유).
   */
  addClaims?: {
    speaker: PersonId
    content: string
    target: 'statement' | 'grid'
    /** `target: 'grid'` 일 때 필수. 격자의 어느 시간대 칸인가 */
    slot?: SlotId
  }[]
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
  /**
   * **이 장은 조사 없이 확정되도록 설계됐다** (2026-08-05 신설 · 사용자 결정).
   *
   * ## 왜 사건 데이터인가 — 규칙을 넓히지 않으려고
   *
   * 산장 1장은 진술 정독만으로 풀리게 저작됐다(*"1장이 조사 없이 확정되어야 하므로"* —
   * `mountain-lodge.yaml` 자기 주석). 그런데 §5-b 는 그것을 **누설**로 읽는다.
   *
   * 처음 든 수는 `proof.ts` 의 새 규칙을 `clues.ts` 의 `PREMISE` 에 넣는 것이었는데
   * **그러면 누설 축에 구멍이 뚫린다** — 자유 사실을 하나 쓰고 공란이 그것을 가리키기만
   * 하면 **무엇이든** 「정당하게 무료」가 된다. 전제를 **규칙**으로 넓히는 대신
   * **사건이 지게** 했다. `asks` 와 같은 논리다 — **구조가 자기 뜻을 적는다.**
   *
   * ## ⛔ 사실 단위 선언은 금지다
   *
   * *"이 사실은 무료여도 된다"* 를 `Fact` 에 달면 **누설 축 구멍이 선언의 모습으로
   * 부활한다.** 선언은 **장 단위 하나뿐**이다 — 장은 몇 개 안 되고 사람이 다 읽는다.
   *
   * ## 비대칭이 이 필드의 값이다
   *
   * ```
   * 선언한 장  + 무료 공란   「무료(설계 선언됨)」로 인쇄한다. 경고를 끄지 않는다
   * 선언 없는 장 + 무료 공란   여전히 경고 — 「선언 안 하고 무료」가 새 결함 부류다
   * ```
   *
   * **경고를 끄지 않는 것이 조건이었다** — 침묵과 선언이 화면에서 구별돼야 오늘
   * `poolFor` 에서 나온 부류(「안 봤다」가 「경고 없음」처럼 보이는 것)를 사람이 거른다.
   */
  freeChapter?: boolean
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
  /**
   * 관계 도식. 없으면 도식 화면이 뜨지 않는다 — 평면도와 같은 취급이다.
   * 검증기가 노드·간선의 참조와 `discoveries.action` 을 검사한다.
   */
  relationGraph?: RelationGraph
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
  /**
   * 피해자의 동선. **세계 변수가 아니라 상수다** (2026-08-05 신설).
   *
   * 피해자는 진술하지 않으므로 `claim` 이 없고 거짓말 문제도 없다 — 저작된 사실이다.
   *
   * ⛳ **이것이 없으면 `lastSeenBy` 가 설 수 없다.** 「피해자와 같은 칸에 있던
   * 사람」을 물으려면 피해자가 어느 칸에 있었는지가 있어야 하는데, 피해자는
   * `people`(용의자 목록) 밖이라 `presence` 행 자체가 없었다. 2026-08-05에
   * 산장 서술문을 정독하다 걸렸다 — 어휘가 아니라 **데이터**가 없던 것이다.
   */
  victimPresence?: PresenceCell[]
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
