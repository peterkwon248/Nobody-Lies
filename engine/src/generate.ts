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
 * 규모는 daily 고정이다 — 3인·2장·7공란.
 * campaign 규모를 조합으로 만들면 검증 실패율이 급등하고 서사가 무너진다
 * (`SYSTEM-DECISIONS.md` §생성). campaign 은 사람이 쓴다.
 */

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
}

const DEFAULT_PALETTE: Required<Omit<Palette, 'setting'>> & { setting: string } = {
  setting: '산장',
  names: ['서지안', '한유빈', '오나경', '백리원', '문세라', '윤다인', '임하늘', '남주원'],
  jobs: ['사진가', '번역가', '조리사', '학예사', '정비사', '약사'],
  items: ['만년필', '손목시계', '열쇠고리', '스카프', '라이터', '수첩'],
  motives: ['채무 관계', '자리 다툼', '오래된 약속', '지분 다툼'],
  places: { hall: '홀', room: '방', away: '자택' },
  times: { t0: '전날 밤', t1: '새벽', t2: '아침' },
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
  const names = shuffled(nonEmpty(P.names, DEFAULT_PALETTE.names)).slice(0, 4)
  const jobs = nonEmpty(P.jobs, DEFAULT_PALETTE.jobs)

  const ids: PersonId[] = ['p1', 'p2', 'p3']
  const culprit = pick(ids)
  const innocents = ids.filter((x) => x !== culprit)

  const tool = pick(nonEmpty(P.items, DEFAULT_PALETTE.items))
  const motive = pick(nonEmpty(P.motives, DEFAULT_PALETTE.motives))
  const alias = names[3]

  // ★ 트릭을 먼저 고른다 ★ 트릭이 격자·물증·조사를 결정하기 때문이다.
  // `templates/README.md` 의 저작 순서와 같다: 트릭 → 인물 배치 → 물증 → 사실 → 조사
  const t = TRICKS[pick(TRICK_KEYS)](culprit)

  // 무고한 둘은 t2에 홀로 도착한다 — 사망 구간(t1)에 현장에 없다.
  // 이 배치가 곧 배제이고, 검증기가 이것을 검사한다.
  const person = (id: PersonId, i: number) => ({
    id,
    name: names[i],
    age: 27 + Math.floor(r() * 12),
    job: pick(jobs),
    hiddenRole: id === culprit ? ('ringleader' as const) : ('unaware' as const),
    presence: id === culprit ? t.presence : [{ slot: 't2', location: 'hall' }],
    // 거짓말은 범인만. 무고한 사람은 claim 을 적지 않는다(= presence 와 같다)
    ...(id === culprit ? { claim: t.claim } : {}),
  })

  const baseEvidence: Ev[] = [
    { id: 'e_tool', description: tool, foundAt: places.room, record: '바닥에 떨어져 있었다.', yieldsTerms: [tool] },
    // 핵심 사실은 획득 경로가 둘 이상이어야 한다 — 비평가가 강제한다
    { id: 'e_toolmark', description: '도구가 남긴 자국', record: '같은 폭의 자국이 남아 있었다.', yieldsTerms: [tool] },
    { id: 'e_alias', description: `'${alias}' 라는 이름의 기록`, yieldsTerms: [alias] },
    { id: 'e_alias2', description: `'${alias}' 가 적힌 두 번째 기록`, yieldsTerms: [alias] },
    { id: 'e_motive', description: '금전 기록', yieldsTerms: [motive] },
    { id: 'e_mutual', description: '두 사람의 상호 보증', record: '두 사람이 말한 도착 시각이 서로 맞물렸다.' },
    { id: 'e_herring1', description: '개인적인 편지', record: '사건과 무관한 사연이 적혀 있었다.' },
    { id: 'e_herring2', description: '오래된 사진', record: '오래전에 찍힌 사진이었다.' },
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
    // 레드 헤링 — salience 를 해답보다 높게. 눈에 띄는 것부터 찍는 플레이어가 진다
    { id: 'a_h1', label: `소지품 검사 · ${names[ids.indexOf(innocents[0])]}`, cost: 1, gives: ['e_herring1'], salience: 0.85, yield: 'redherring',
      verb: 'belongings', target: { kind: 'person', id: innocents[0] },
      result: res('개인적인 편지', '소지품에서 개인적인 편지 한 통이 나왔다.') },
    { id: 'a_h2', label: `소지품 검사 · ${names[ids.indexOf(innocents[1])]}`, cost: 1, gives: ['e_herring2'], salience: 0.8, yield: 'redherring',
      verb: 'belongings', target: { kind: 'person', id: innocents[1] },
      result: res('오래된 사진', '소지품에서 오래된 사진 한 장이 나왔다.') },
    { id: 'a_alibi', label: '알리바이 대조', cost: 1, gives: ['e_mutual'], salience: 0.45, yield: 'exclusion',
      verb: 'alibi', pair: [innocents[0], innocents[1]],
      result: res('맞물리는 시각', '두 사람이 말한 도착 시각이 서로 맞물렸다.') },
    // 빈손도 배제 정보다. 조사 대상은 예산의 3배 이상이어야 선택이 소거가 아니라 판단이 된다
    { id: 'a_kitchen', label: '주방 수색', cost: 1, gives: [], salience: 0.2, yield: 'empty',
      verb: 'search', target: { kind: 'location', id: 'hall' } },
    { id: 'a_yard', label: '마당 수색', cost: 1, gives: [], salience: 0.15, yield: 'empty',
      verb: 'search', target: { kind: 'location', id: 'hall' } },
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
      { id: 'f_h1', kind: 'context', subject: innocents[0], content: '감추는 것이 있다', revealedBy: ['e_herring1'] },
      { id: 'f_h2', kind: 'context', subject: innocents[1], content: '감추는 것이 있다', revealedBy: ['e_herring2'] },
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
