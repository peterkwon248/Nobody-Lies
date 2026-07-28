import type { Case, PersonId, TrickType, IllusionKind } from './types.js'

/**
 * 작가 — 논리 골격 생성기.
 *
 * **LLM이 없다.** 진실 세계를 조합으로 만들고, 거기서 물증·조사·공란을 도출한다.
 * 순수 함수이므로 기기에서도 돌고, 같은 seed 는 같은 사건을 낸다.
 *
 * 산문(진술·프롤로그·인터루드·에필로그)은 여기서 만들지 않는다.
 * 그것은 빌드 타임 LLM의 몫이고 결과는 파일에 고정된다.
 *
 * ── 역할 분담 ────────────────────────────────────────────────
 *   LLM    무대·이름·직업·물건·동기의 **어휘**       → `Palette`
 *   코드   트릭·격자·물증·사실·조사·공란·예산        → 이 파일
 *   검증기 관문                                    → verifier.ts
 *
 * **팔레트 하나로 사건 여러 개가 나온다.** LLM 호출은 사건 수가 아니라
 * 세계 수에 비례한다 — 이것이 「적은 비용으로 많이」의 실제 근거다.
 *
 * 장 수는 daily 고정이다 — 2장·7공란. campaign 규모(5장·19공란)를 조합으로
 * 만들면 검증 실패율이 급등하고 서사가 무너진다(`SYSTEM-DECISIONS.md` §생성).
 *
 * ★ 용의자는 언제나 5명이다 ★ 규모가 바뀌어도 이것만은 안 바뀐다.
 * 2026-07-29 사용자 결정 — 오프라인 플레이 경험에서 나온 것이고, 이 프로젝트가
 * 「재미는 플레이테스트만 답한다」고 못박아 둔 바로 그 층위의 근거다.
 * `SYSTEM-DECISIONS.md` §3 참조 — 규모 표의 다른 칸은 전부 가변이고 이 칸만 고정이다.
 */

/** 용의자 수. ★ 고정이다 ★ 손잡이가 아니다 — `SYSTEM-DECISIONS.md` §3 */
const SUSPECTS = 5

/**
 * 빈손 조사 개수.
 *
 * 조사 대상이 **예산의 3배 이상**이어야 선택이 소거가 아니라 판단이 된다.
 * 나머지 조사가 11개(해답 4 + 레드 헤링 4 + 배제 1 + 트릭 전용 2)이고
 * 예산이 7~8로 나오므로 24개가 필요하다 → 14개.
 */
const EMPTY_SPOTS = 14

/** 결정론적 PRNG. 같은 seed 는 같은 사건 */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/**
 * 세계 팔레트 — **LLM이 채우는 유일한 자리**.
 *
 * 전부 선택적이고, 비면 아래 기본값을 쓴다. 그래서 `generateCase(seed)` 는
 * 팔레트가 없던 시절과 **완전히 같은 사건**을 낸다(회귀 없음).
 *
 * ★ 여기에 논리를 넣지 않는다 ★ 팔레트는 어휘일 뿐이다. 누가 범인인지,
 * 무엇이 트릭인지는 코드가 정한다 — LLM에게 논리를 시키면 검증 실패율이
 * 올라가고, 그 실패가 곧 비용이다.
 */
export type Palette = {
  /** 무대 이름. 제목에 쓰인다 */
  setting?: string
  names?: string[]
  jobs?: string[]
  items?: string[]
  motives?: string[]
  /** 장소 이름표. 구조(홀·현장·부지 밖)는 고정이고 이름만 바뀐다 */
  places?: { hall?: string; room?: string; away?: string }
  /** 시간대 이름표. 가운데가 사망 추정 구간이다 */
  times?: { t0?: string; t1?: string; t2?: string }
  /**
   * 빈손 조사가 될 자리들. **8개 이상 필요하다.**
   *
   * 빈손도 배제 정보이고, **조사 대상이 예산의 3배 이상이어야 선택이 소거가
   * 아니라 판단이 된다.** 이것이 부족하면 후보가 뻔해져서 플레이어가 추론
   * 대신 전수조사를 한다 — 검증기가 경고로 잡는다.
   */
  spots?: string[]
}

const DEFAULT_PALETTE: Required<Omit<Palette, 'setting'>> & { setting: string } = {
  setting: '산장',
  names: ['서지안', '한유빈', '오나경', '백리원', '문세라', '윤다인', '임하늘', '남주원'],
  jobs: ['사진가', '번역가', '조리사', '학예사', '정비사', '약사'],
  items: ['만년필', '손목시계', '열쇠고리', '스카프', '라이터', '수첩'],
  motives: ['채무 관계', '자리 다툼', '오래된 약속', '지분 다툼'],
  places: { hall: '홀', room: '방', away: '자택' },
  times: { t0: '전날 밤', t1: '새벽', t2: '아침' },
  // 트릭 전용 조사(복도·창가·책상·문틀·잠금장치·설비·부품)와 겹치지 않는 이름만 쓴다
  spots: [
    '주방', '마당', '다락', '차량', '지하', '창고', '쓰레기통',
    '뒷문', '계단', '화장실', '옷장', '우편함', '정원', '보일러실',
  ],
}

type Cell = Case['people'][number]['presence'][number]
type Ev = Case['evidence'][number]
type Act = Case['actions'][number]

/**
 * 아키타입이 만들어내는 부품 한 벌.
 *
 * **트릭을 바꾸면 격자까지 바뀐다.** 이름표만 갈아끼우면 사건은 하나뿐이다 —
 * 2026-07-29 이전의 생성기가 그랬다(200건이 전부 같은 사건).
 */
type TrickBuild = {
  types: TrickType[]
  illusion: { id: string; kind: IllusionKind; impression: string; madeBy: string[]; brokenBy: string[] }
  exit?: { slot: string; method: string; enabledBy?: string[]; brokenBy: string[] }
  props: string[]
  staging: string[]
  flaw: string
  /** 이 트릭에만 있는 물증과 그것을 주는 조사 */
  evidence: Ev[]
  actions: Act[]
  /** 범인의 실제 동선과 주장. ★ window(t1) 에서 반드시 어긋나야 한다 ★ */
  presence: Cell[]
  claim: Cell[]
  /** 기회 사실의 문안과 근거 */
  opportunity: { content: string; revealedBy: string[] }
}

/** 결과문은 전부 한 문장 — 길이가 다르면 그것이 곧 유용도 표시다(절대 규칙 3) */
const res = (title: string, body: string) => ({ title: { ko: title }, body: { ko: body } })

/**
 * 다섯 아키타입. **계약을 코드가 채운다** —
 * `ARCHETYPES` 가 요구하는 exit·인상 종류를 여기서 만족시킨다.
 * `identity_swap` 은 빠져 있다(용의자 목록이 거짓이 되면 공란 체계가 무너진다).
 */
const TRICKS: Record<string, (culprit: PersonId) => TrickBuild> = {
  // 그 시각 그 자리에 없었다 — 범인은 현장에 있었고 홀에 있었다고 말한다
  alibi_fabrication: (culprit) => ({
    types: ['alibi_fabrication'],
    illusion: {
      id: 'il_absent', kind: 'absence', impression: '범인은 그 시각 현장에 없었다',
      madeBy: [], brokenBy: ['e_trace', 'e_log'],
    },
    props: ['e_tool'], staging: [],
    flaw: '그 시각에 현장에 없었다면 왜 아침에 가장 먼저 알았는가',
    evidence: [
      { id: 'e_trace', description: '새벽의 흔적', record: '복도 끝에 젖은 자국이 남아 있었다.' },
      { id: 'e_log', description: '출입 기록', record: '문이 새벽에 한 번 여닫혔다.' },
    ],
    actions: [
      { id: 'a_hall', label: '복도 조사', cost: 1, gives: ['e_trace'], salience: 0.4, yield: 'solution',
        verb: 'search', target: { kind: 'location', id: 'hall' },
        result: res('복도 끝의 자국', '복도 끝에 젖은 자국이 남아 있었다.') },
      { id: 'a_door', label: '출입 기록 조회', cost: 1, gives: ['e_log'], salience: 0.35, yield: 'solution',
        verb: 'fixture', target: { kind: 'location', id: 'room' },
        result: res('새벽의 여닫힘', '문이 새벽에 한 번 여닫힌 기록이 있었다.') },
    ],
    presence: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'room' }, { slot: 't2', location: 'hall' }],
    claim: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'hall' }, { slot: 't2', location: 'hall' }],
    opportunity: { content: '새벽에 현장에 있었다', revealedBy: ['e_trace', 'e_log'] },
  }),

  // 스스로 목숨을 끊었다 — 남겨진 것이 있고, 나간 자리가 있다
  staged_suicide: (culprit) => ({
    types: ['staged_suicide'],
    illusion: {
      id: 'il_own_hand', kind: 'death', impression: '스스로 목숨을 끊었다',
      madeBy: ['e_staged'], brokenBy: ['e_toolmark', 'e_sill'],
    },
    exit: { slot: 't1', method: '창을 넘어 나갔다', enabledBy: ['e_staged'], brokenBy: ['e_sill'] },
    props: ['e_tool'], staging: ['e_staged'],
    flaw: '스스로 그랬다면 왜 문이 안에서만 잠겨 있지 않았는가',
    evidence: [
      { id: 'e_staged', description: '남겨진 쪽지', record: '글씨가 본인의 다른 기록과 달랐다.', isStaging: true },
      { id: 'e_sill', description: '창턱의 자국', record: '창턱 바깥쪽에 눌린 자국이 있었다.' },
    ],
    actions: [
      { id: 'a_desk', label: '책상 조사', cost: 1, gives: ['e_staged'], salience: 0.45, yield: 'solution',
        verb: 'search', target: { kind: 'location', id: 'room' },
        result: res('책상 위의 쪽지', '책상 위에 쪽지 한 장이 놓여 있었다.') },
      { id: 'a_window', label: '창가 조사', cost: 1, gives: ['e_sill'], salience: 0.3, yield: 'solution',
        verb: 'fixture', target: { kind: 'location', id: 'room' },
        result: res('창턱의 자국', '창턱 바깥쪽에 눌린 자국이 남아 있었다.') },
    ],
    presence: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'room' }, { slot: 't2', location: 'hall' }],
    claim: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'hall' }, { slot: 't2', location: 'hall' }],
    opportunity: { content: '새벽에 현장에 있었다', revealedBy: ['e_sill', 'e_staged'] },
  }),

  // 아무도 드나들 수 없었다 — 닫힌 것처럼 보이는 자리에 틈이 있다
  locked_room: (culprit) => ({
    types: ['locked_room'],
    illusion: {
      id: 'il_sealed', kind: 'absence', impression: '그 방에는 아무도 드나들 수 없었다',
      madeBy: ['e_seal'], brokenBy: ['e_gap'],
    },
    exit: { slot: 't1', method: '잠금이 걸리기 전에 빠져나갔다', enabledBy: ['e_seal'], brokenBy: ['e_gap'] },
    props: ['e_tool'], staging: ['e_seal'],
    flaw: '안에서만 잠글 수 있었다면 왜 열쇠가 바깥에 있었는가',
    evidence: [
      { id: 'e_seal', description: '안쪽에서 걸린 잠금', record: '잠금장치가 안쪽으로 걸려 있었다.', isStaging: true },
      { id: 'e_gap', description: '문틀의 틈', record: '문틀 아래쪽에 손가락 하나 폭의 틈이 있었다.' },
    ],
    actions: [
      { id: 'a_lock', label: '잠금장치 조사', cost: 1, gives: ['e_seal'], salience: 0.5, yield: 'solution',
        verb: 'fixture', target: { kind: 'location', id: 'room' },
        result: res('안쪽으로 걸린 잠금', '잠금장치가 안쪽으로 걸려 있었다.') },
      { id: 'a_frame', label: '문틀 조사', cost: 1, gives: ['e_gap'], salience: 0.25, yield: 'solution',
        verb: 'search', target: { kind: 'location', id: 'room' },
        result: res('문틀 아래의 틈', '문틀 아래쪽에 좁은 틈이 나 있었다.') },
    ],
    presence: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'room' }, { slot: 't2', location: 'hall' }],
    claim: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'hall' }, { slot: 't2', location: 'hall' }],
    opportunity: { content: '새벽에 현장에 있었다', revealedBy: ['e_gap', 'e_seal'] },
  }),

  // 발견된 곳에서 죽었다 — 옮겨진 자국이 남는다
  body_moved: (culprit) => ({
    types: ['body_moved'],
    illusion: {
      id: 'il_here', kind: 'place', impression: '발견된 자리에서 그대로 죽었다',
      madeBy: ['e_arranged'], brokenBy: ['e_drag', 'e_lividity'],
    },
    props: ['e_tool'], staging: ['e_arranged'],
    flaw: '그 자리에서 그랬다면 왜 바닥에 끌린 자국이 홀에서부터 이어지는가',
    evidence: [
      { id: 'e_arranged', description: '정돈된 자리', record: '주변이 지나치게 정돈돼 있었다.', isStaging: true },
      { id: 'e_drag', description: '끌린 자국', record: '홀에서 방까지 바닥에 끌린 자국이 이어졌다.' },
      { id: 'e_lividity', description: '시반의 방향', record: '시반이 놓인 자세와 맞지 않는 쪽에 몰려 있었다.' },
    ],
    actions: [
      { id: 'a_hall', label: '복도 조사', cost: 1, gives: ['e_drag'], salience: 0.4, yield: 'solution',
        verb: 'search', target: { kind: 'location', id: 'hall' },
        result: res('바닥에 이어진 자국', '홀에서 방 쪽으로 끌린 자국이 이어졌다.') },
      { id: 'a_lividity', label: '시신 자세 검사', cost: 1, gives: ['e_lividity', 'e_arranged'], salience: 0.3, yield: 'solution',
        verb: 'autopsy', target: { kind: 'location', id: 'room' },
        result: res('맞지 않는 쪽', '시반이 놓인 자세와 맞지 않는 쪽에 몰려 있었다.') },
    ],
    presence: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'hall' }, { slot: 't2', location: 'hall' }],
    claim: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'away' }, { slot: 't2', location: 'hall' }],
    opportunity: { content: '새벽에 부지 안에 있었다', revealedBy: ['e_drag', 'e_lividity'] },
  }),

  // 범인이 있을 때 벌어졌다 — 실은 미리 놓여 있었다.
  // ★ 이것만 격자가 다르다 ★ 범인은 전날 밤에 현장에 들어갔고 사망 구간에는
  // 부지 안 다른 곳에 있었다. 그리고 부지에 있었다는 사실 자체를 숨긴다.
  delayed_mechanism: (culprit) => ({
    types: ['delayed_mechanism'],
    illusion: {
      id: 'il_then', kind: 'time', impression: '숨을 거둔 그 시각에 누군가 그 자리에 있었다',
      madeBy: [], brokenBy: ['e_device', 'e_timer'],
    },
    props: ['e_device'], staging: [],
    flaw: '그 시각에 아무도 없었다면 무엇이 그것을 시작했는가',
    evidence: [
      { id: 'e_device', description: '설치된 장치', record: '방 한쪽에 미리 놓인 장치가 있었다.' },
      { id: 'e_timer', description: '맞춰진 눈금', record: '눈금이 새벽 시각에 맞춰져 있었다.' },
    ],
    actions: [
      { id: 'a_device', label: '설비 조사', cost: 1, gives: ['e_device'], salience: 0.35, yield: 'solution',
        verb: 'fixture', target: { kind: 'location', id: 'room' },
        result: res('미리 놓인 것', '방 한쪽에 미리 놓인 장치가 있었다.') },
      { id: 'a_parts', label: '부품 확인', cost: 1, gives: ['e_timer'], salience: 0.25, yield: 'solution',
        verb: 'search', target: { kind: 'location', id: 'room' },
        result: res('맞춰진 눈금', '눈금이 새벽 시각에 맞춰져 있었다.') },
    ],
    presence: [{ slot: 't0', location: 'room' }, { slot: 't1', location: 'hall' }, { slot: 't2', location: 'hall' }],
    claim: [{ slot: 't0', location: 'away' }, { slot: 't1', location: 'away' }, { slot: 't2', location: 'hall' }],
    opportunity: { content: '전날 밤 현장에 들어갔다', revealedBy: ['e_device', 'e_timer'] },
  }),
}

const TRICK_KEYS = Object.keys(TRICKS)

export function generateCase(seed: number, palette?: Palette): Case {
  const r = rng(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const shuffled = <T,>(xs: T[]) => {
    const a = [...xs]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const P = { ...DEFAULT_PALETTE, ...palette }
  const places = { ...DEFAULT_PALETTE.places, ...palette?.places }
  const times = { ...DEFAULT_PALETTE.times, ...palette?.times }
  const nonEmpty = <T,>(xs: T[] | undefined, fb: T[]) => (xs?.length ? xs : fb)
  // 5명 + 기록에 남은 이름 하나
  const names = shuffled(nonEmpty(P.names, DEFAULT_PALETTE.names)).slice(0, SUSPECTS + 1)
  const jobs = nonEmpty(P.jobs, DEFAULT_PALETTE.jobs)

  /**
   * 빈손 조사 자리. **모자라면 기본값으로 채운다.**
   *
   * 조사/예산 비율이 3배 아래로 내려가면 검증기가 경고하는데, 팔레트가 자리를
   * 적게 주는 것만으로 그 경고가 도로 살아난다. 팔레트는 어휘이고 **비율은
   * 논리라서 코드가 지켜야 한다** — 팔레트가 게임 균형을 깨뜨리게 두지 않는다.
   */
  const spots = [...(P.spots ?? [])]
  for (const s of DEFAULT_PALETTE.spots) {
    if (spots.length >= EMPTY_SPOTS) break
    if (!spots.includes(s)) spots.push(s)
  }

  const ids: PersonId[] = ['p1', 'p2', 'p3', 'p4', 'p5']
  const culprit = pick(ids)
  const innocents = ids.filter((x) => x !== culprit)

  const tool = pick(nonEmpty(P.items, DEFAULT_PALETTE.items))
  const motive = pick(nonEmpty(P.motives, DEFAULT_PALETTE.motives))
  const alias = names[SUSPECTS]

  /**
   * 레드 헤링 — 무고한 넷 **전원**이 감출 것을 갖는다.
   *
   * 하나라도 빠지면 그 사람만 깨끗해 보여서 후보가 넷에서 셋으로 줄어든다.
   * 「전부 갖거나 전무」는 이 게임에서 지문·서사에 이미 걸려 있는 규칙이고,
   * 의심 재료에도 같은 이유로 적용된다.
   *
   * salience 는 전부 0.6 이상 — 검증기가 「매력적인 함정 3개 미만」을 경고한다.
   * 그리고 **범인 쪽 조사보다 높다.** 눈에 띄는 것부터 찍는 플레이어가 져야 한다.
   */
  const HERRING = [
    { ev: '개인적인 편지', rec: '사건과 무관한 사연이 적혀 있었다.', res: '소지품에서 개인적인 편지 한 통이 나왔다.', s: 0.85 },
    { ev: '오래된 사진', rec: '오래전에 찍힌 사진이었다.', res: '소지품에서 오래된 사진 한 장이 나왔다.', s: 0.8 },
    { ev: '접힌 영수증', rec: '여러 번 접힌 자국이 있었다.', res: '소지품에서 접힌 영수증 한 장이 나왔다.', s: 0.75 },
    { ev: '지워진 기록', rec: '일부가 지워진 채 남아 있었다.', res: '소지품에서 일부가 지워진 기록이 나왔다.', s: 0.7 },
  ]

  // ★ 트릭을 먼저 고른다 ★ 트릭이 격자·물증·조사를 결정하기 때문이다.
  // `templates/README.md` 의 저작 순서와 같다: 트릭 → 인물 배치 → 물증 → 사실 → 조사
  const t = TRICKS[pick(TRICK_KEYS)](culprit)

  const slotLabel: Record<string, string> = { t0: times.t0!, t1: times.t1!, t2: times.t2! }
  const placeLabel: Record<string, string> = { hall: places.hall!, room: places.room!, away: places.away! }

  /**
   * 진술 원문을 **동선에서 도출한다.**
   *
   * `templates/README.md` 가 적어둔 규칙 그대로다 — *"무고한 네 명의 진술은 직접
   * 쓰지 않는다. `presence` 를 선언하면 엔진이 진술의 주장을 도출한다. 손으로
   * 쓰면 실수로 거짓이 섞이고, 그 순간 논리가 무너진다."*
   *
   * 범인은 `claim`(거짓말), 나머지는 `presence`(진실)를 말한다. 거짓이 데이터에
   * 있으므로 문장이 저절로 맞는다.
   *
   * ★ 다섯 명의 문단 수가 같아야 한다 ★ 있었던 시간대만 말하면 범인이 셋,
   * 무고한 자가 하나가 되어 **문단 수가 곧 범인 표시**가 된다. 그래서 슬롯
   * 전체를 훑고 없던 시간대는 「없었다」로 말한다 — 전원 네 문단.
   *
   * 이것은 자리표시 산문이다(`prose.source: 'template'`). 말투도 재미도 없다 —
   * 그건 ②산문가가 `PROSE-BRIEF.md` 로 덮어쓴다.
   */
  const statementOf = (cells: { slot: string; location: string }[]) => {
    const at = new Map(cells.map((x) => [x.slot, x.location]))
    return [
      ...['t0', 't1', 't2'].map((s) => {
        const loc = at.get(s)
        return {
          ko: loc
            ? `${slotLabel[s]}에는 ${placeLabel[loc]}에 있었습니다.`
            : `${slotLabel[s]}에는 그곳에 없었습니다.`,
        }
      }),
      { ko: '그 밖에는 따로 드릴 말씀이 없습니다.' },
    ]
  }

  // 무고한 넷은 t2에 홀로 도착한다 — 사망 구간(t1)에 현장에 없다.
  // 이 배치가 곧 배제이고, 검증기가 이것을 검사한다.
  const innocentPresence = [{ slot: 't2', location: 'hall' }]
  const person = (id: PersonId, i: number) => ({
    id,
    name: names[i],
    age: 27 + Math.floor(r() * 12),
    job: pick(jobs),
    hiddenRole: id === culprit ? ('ringleader' as const) : ('unaware' as const),
    presence: id === culprit ? t.presence : innocentPresence,
    // 거짓말은 범인만. 무고한 사람은 claim 을 적지 않는다(= presence 와 같다)
    ...(id === culprit ? { claim: t.claim } : {}),
    statement: {
      // 진술에서 말하는 것은 주장이다 — 범인은 claim, 나머지는 presence
      paragraphs: statementOf(id === culprit ? t.claim : innocentPresence),
    },
  })

  const baseEvidence: Ev[] = [
    { id: 'e_tool', description: tool, foundAt: places.room, record: '바닥에 떨어져 있었다.', yieldsTerms: [tool] },
    // 핵심 사실은 획득 경로가 둘 이상이어야 한다 — 비평가가 강제한다
    { id: 'e_toolmark', description: '도구가 남긴 자국', record: '같은 폭의 자국이 남아 있었다.', yieldsTerms: [tool] },
    { id: 'e_alias', description: `'${alias}' 라는 이름의 기록`, yieldsTerms: [alias] },
    { id: 'e_alias2', description: `'${alias}' 가 적힌 두 번째 기록`, yieldsTerms: [alias] },
    { id: 'e_motive', description: '금전 기록', yieldsTerms: [motive] },
    { id: 'e_mutual', description: '넷의 상호 보증', record: '네 사람이 말한 도착 시각이 서로 맞물렸다.' },
    ...HERRING.map((h, i) => ({ id: `e_herring${i + 1}`, description: h.ev, record: h.rec })),
  ]

  const baseActions: Act[] = [
    { id: 'a_room', label: `${places.room} 수색`, cost: 1, gives: ['e_tool'], salience: 0.5, yield: 'solution',
      verb: 'search', target: { kind: 'location', id: 'room' },
      result: res('바닥에 떨어진 것', `${places.room} 바닥에 물건 하나가 떨어져 있었다.`) },
    { id: 'a_body', label: '시신 검사', cost: 1, gives: ['e_toolmark'], salience: 0.6, yield: 'solution',
      verb: 'autopsy', target: { kind: 'location', id: 'room' },
      result: res('같은 폭의 자국', '같은 폭으로 눌린 자국이 남아 있었다.') },
    { id: 'a_papers', label: '서류 조사', cost: 1, gives: ['e_alias', 'e_motive'], salience: 0.3, yield: 'solution',
      verb: 'search', target: { kind: 'location', id: 'hall' },
      result: res('반복되는 이름', '여러 장에 같은 이름과 금전 기록이 적혀 있었다.') },
    { id: 'a_ledger', label: '장부 조사', cost: 1, gives: ['e_alias2'], salience: 0.3, yield: 'solution',
      verb: 'search', target: { kind: 'location', id: 'hall' },
      result: res('두 번째 기록', '장부에 같은 이름이 한 번 더 적혀 있었다.') },
    // 레드 헤링 — 무고한 넷 전원. salience 를 해답보다 높게
    ...innocents.map((id, i) => ({
      id: `a_h${i + 1}`, label: `소지품 검사 · ${names[ids.indexOf(id)]}`, cost: 1,
      gives: [`e_herring${i + 1}`], salience: HERRING[i].s, yield: 'redherring' as const,
      verb: 'belongings' as const, target: { kind: 'person' as const, id },
      result: res(HERRING[i].ev, HERRING[i].res),
    })),
    { id: 'a_alibi', label: '알리바이 대조', cost: 1, gives: ['e_mutual'], salience: 0.45, yield: 'exclusion',
      verb: 'alibi', pair: [innocents[0], innocents[1]],
      result: res('맞물리는 시각', '네 사람이 말한 도착 시각이 서로 맞물렸다.') },
    /**
     * 빈손도 배제 정보다. **조사 대상이 예산의 3배 이상**이어야 선택이 소거가
     * 아니라 판단이 된다 — 검증기가 그 비율을 잰다.
     *
     * 2026-07-29 이전에는 둘뿐이라 비율이 1.86배였고 **60/60 전건에 경고가
     * 상주했다.** 배치 리포트가 경고를 안 찍어서 몰랐다(`orchestrate.ts` 에서
     * 그 줄도 함께 고쳤다). `case-template.yaml` 은 처음부터 열 개를 실었다.
     *
     * salience 를 낮게 둔다 — 눈에 띄어서 고르는 것이 아니라 소거하려고 고르는 것이다.
     */
    ...spots.map((spot, i) => ({
      id: `a_e${i + 1}`, label: `${spot} 수색`, cost: 1, gives: [] as string[],
      salience: Math.max(0.04, 0.22 - i * 0.012), yield: 'empty' as const,
      verb: 'search' as const, target: { kind: 'location' as const, id: 'hall' },
    })),
  ]

  return {
    id: `gen-${seed}`,
    title: `${P.setting ?? DEFAULT_PALETTE.setting} 사건 ${seed}`,
    scale: 'daily',
    budget: 3,
    incident: {
      kind: 'homicide', subject: 'victim', description: `${places.room}에서의 사망`,
      scene: 'room',
    },
    prose: { source: 'template' },
    seedTerms: [tool],
    slots: [
      { id: 't0', label: times.t0! },
      { id: 't1', label: times.t1!, isWindow: true },
      { id: 't2', label: times.t2! },
    ],
    locations: [
      { id: 'hall', label: places.hall!, atLodge: true },
      { id: 'room', label: places.room!, atLodge: true },
      { id: 'away', label: places.away!, atLodge: false },
    ],
    people: ids.map(person),
    victim: 'victim',
    culprit,

    // ★ 아키타입 계약을 코드가 채운다 ★ exit·인상 종류는 트릭이 결정한다
    trick: {
      types: t.types,
      props: t.props,
      staging: t.staging,
      illusions: [t.illusion],
      ...(t.exit ? { exit: t.exit } : {}),
      flaw: { text: t.flaw, plantedIn: [culprit] },
    },

    evidence: [...baseEvidence, ...t.evidence],

    facts: [
      { id: 'f_opp', kind: 'opportunity', subject: culprit, content: t.opportunity.content, revealedBy: t.opportunity.revealedBy },
      // 무고한 사람의 배제는 물증(상호 보증)이 받쳐야 한다.
      // 자기 진술에만 기대면 그 사람을 범인으로 가정했을 때 배제가 사라진다.
      ...innocents.map((id) => ({
        id: `f_no_${id}`, kind: 'no_opportunity' as const, subject: id,
        content: '아침에 함께 도착했다', revealedBy: [] as string[],
      })),
      ...innocents.map((id) => ({
        id: `f_no_${id}_ok`, kind: 'no_opportunity' as const, subject: id,
        content: '도착 시각 상호 일치', revealedBy: ['e_mutual'],
      })),
      { id: 'f_identity', kind: 'identity', subject: culprit, content: `${alias} = 범인`, revealedBy: ['e_alias', 'e_alias2'] },
      { id: 'f_means', kind: 'means', subject: culprit, content: '도구를 다룰 수 있었다', revealedBy: ['e_tool', 'e_toolmark'] },
      { id: 'f_motive', kind: 'motive', subject: culprit, content: motive, revealedBy: ['e_motive'], requires: ['f_identity'] },
      // 레드 헤링 — 무고한 사람의 비밀. 수상해 보이지만 사건과 무관하다
      ...innocents.map((id, i) => ({
        id: `f_h${i + 1}`, kind: 'context' as const, subject: id,
        content: '감추는 것이 있다', revealedBy: [`e_herring${i + 1}`],
      })),
    ],

    actions: [...baseActions, ...t.actions],

    chapters: [
      {
        order: 1, title: '아침의 발견',
        opening: '먼저 그 아침에 무엇이 있었는지를 적는다.',
        requiresFacts: innocents.map((id) => `f_no_${id}`),
        blanks: [
          { label: '인물', candidates: 'closed', answer: innocents[0], particle: '이/가' },
          { label: '장소', candidates: 'closed', answer: 'room' },
          { label: '시각', candidates: 'closed', answer: 't2' },
          { label: '도구', candidates: 'discovered', answer: tool, particle: '이/가' },
        ],
        // 생성 사건의 서술문은 템플릿이다. 사람이 쓴 사건만큼 좋을 수 없지만
        // **문장이긴 해야 한다** — 목록으로 두면 보고서가 두 물건이 된다.
        // 받침에 따라 갈리는 어미(였다/이었다)는 쓰지 않는다. 답이 매번 다르다
        report: [
          { text: '그날 아침 ' }, { blank: 0 }, { text: ' 가장 먼저 도착했다. ' },
          { blank: 2 }, { text: ', ' }, { blank: 1 }, { text: '에서 ' },
          { blank: 3 }, { text: ' 발견됐다.' },
        ],
        epilogueOrder: 1,
      },
      {
        order: 2, title: '이름과 이유',
        opening: '남은 것은 이름과 이유다.',
        requiresFacts: ['f_motive', 'f_opp', 'f_means'],
        blanks: [
          { label: '인물', candidates: 'closed', answer: culprit, isAccusation: true },
          { label: '정체', candidates: 'discovered', answer: alias },
          { label: '동기', candidates: 'discovered', answer: motive },
        ],
        report: [
          { text: '모든 정황이 한 사람을 가리켰다. 진범은 ' }, { blank: 0 },
          { text: '. 기록에 남은 이름은 ' }, { blank: 1 },
          { text: ', 그리고 그를 움직인 것은 ' }, { blank: 2 }, { text: '.' },
        ],
        epilogueOrder: 2,
      },
    ],

    reveals: [
      {
        trigger: { on: 'chapterComplete', chapterOrder: 1 },
        yield: 'path',
        actions: ['a_ledger'],
        surface: 'map',
        narration: '아침의 정황이 정리됐다. 장부가 한 권 더 있다는 것을 알게 됐다.',
      },
    ],

    reopenPerChapter: 1,
  }
}
