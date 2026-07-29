import type { Case, PersonId, TrickType, IllusionKind, BlankLabel } from './types.js'

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
 * ⚠ **장 수는 더 이상 daily 고정이 아니다** — 이 머리말이 아래 `GenerateOptions`
 * 주석과 어긋난 채 남아 있어서 2026-07-29에 고쳤다. 원문은 이랬다:
 * *"장 수는 daily 고정이다 — 2장·7공란. campaign 규모(5장·19공란)를 조합으로
 * 만들면 검증 실패율이 급등하고 서사가 무너진다(`SYSTEM-DECISIONS.md` §생성)."*
 *
 * **그 예측은 게이트가 반증했다.** 기본값이 2 → 5(캠페인 규모)로 바뀐 뒤에도
 * `gen-check` 가 100% 로 통과한다 — 그 명령은 `--chapters` 를 안 주므로 기본값
 * 5를 쓰고(`cli.ts:40`), `--min-pass 100` 이다. 실패율 급등은 일어나지 않았다.
 * **남은 경계는 규모가 아니라 산문이다**(`MEMORY.md` §캠페인 자동 생성).
 *
 * ★ 용의자는 언제나 5명이다 ★ 규모가 바뀌어도 이것만은 안 바뀐다.
 * 2026-07-29 사용자 결정 — 오프라인 플레이 경험에서 나온 것이고, 이 프로젝트가
 * 「재미는 플레이테스트만 답한다」고 못박아 둔 바로 그 층위의 근거다.
 * `SYSTEM-DECISIONS.md` §3 참조 — 규모 표의 다른 칸은 전부 가변이고 이 칸만 고정이다.
 */

/** 용의자 수. ★ 고정이다 ★ 손잡이가 아니다 — `SYSTEM-DECISIONS.md` §3 */
const SUSPECTS = 5

/*
 * ⛔ `EMPTY_SPOTS = 14` 가 여기 있었다 — **선언만 되고 아무도 안 읽었다**
 * (2026-07-29에 지웠다). 근거 주석이 *"예산이 7~8로 나오므로 24개가 필요하다"*
 * 였는데 그 예산은 **장 2 고정 시절** 숫자다. 머리말이 낡았던 것과 같은 뿌리다.
 *
 * 지우는 쪽을 골랐다. 빈손은 상수가 아니라 **남은 `(동사:대상)` 조합 전부**로
 * 만들어진다(아래 §빈손 조사) — 숫자를 고쳐 두면 그 숫자가 무언가를 정하는
 * 것처럼 보여서, 다음 사람이 여기를 만지고 아무 일도 안 일어나는 데 시간을 쓴다.
 * 죽은 풀 항목 셋이 아이콘·문안까지 갖춘 채 살아 보였던 그 부류다.
 *
 * ⚠ 같은 처지가 하나 더 있다: **`Palette.spots`** 도 선언·기본값이 있고
 * `palette-residency.json` 이 실제로 주는데 **읽는 곳이 없다.**
 * `PALETTE-BRIEF.md` 는 요구조차 안 한다. 지우지 않고 남겨둔다 — 빈손 이름을
 * 팔레트 어휘로 짓는 데 쓸 수 있는 자리이고, 그건 저작 결정이다.
 */

/**
 * 결정론적 PRNG. 같은 seed 는 같은 사건.
 *
 * ⚠ **초기 상태를 흩는다.** 연속한 seed(1,2,3…)를 LCG 에 그대로 넣으면 첫 몇
 * 출력이 강하게 상관돼 같은 값이 쏠린다. 2026-07-29 에 실제로 물렸다 — 팔레트를
 * 바꾸자 배열 길이가 달라져 `r()` 호출 횟수가 밀렸고, **트릭 아키타입이 5종에서
 * 3종으로 줄었다.** 팔레트는 어휘일 뿐인데 논리 분포가 흔들린 것이다.
 */
function rng(seed: number) {
  let s = (seed >>> 0) ^ 0x9e3779b9
  s = Math.imul(s ^ (s >>> 16), 2246822507) >>> 0
  s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
  s = (s ^ (s >>> 16)) >>> 0
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
  /** 장소 이름표. 구조(모이는 곳·현장·부지 밖)는 고정이고 이름만 바뀐다 */
  places?: { hall?: string; room?: string; away?: string }
  /**
   * 부지 안의 **다른 방들**. 여섯 개 안팎.
   *
   * 방이 적으면 조사가 갈 곳이 없다 — 앱은 조사를 **`동사:대상`** 으로 키잉하므로
   * 장소 셋으로는 서로 다른 조사를 스물몇 개 만들 수가 없다(2026-07-29 실측:
   * 조사 30개가 키 9개로 뭉갰다). 방이 늘면 도면도 덜 단조로워진다.
   */
  rooms?: string[]
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
  /**
   * 중간 장에서 캐낼 **기록·흔적의 이름**. 장 하나에 하나씩 쓰인다.
   *
   * 장을 늘리려면 캐낼 것이 그만큼 있어야 한다 — 검증기가 「각 장은 그 시점
   * 가용 정보로 확정 가능」을 강제하므로, 정보 없이 장만 늘릴 수는 없다.
   * 모자라면 코드가 기본값으로 채운다.
   */
  records?: string[]
  /**
   * ★ 인물 층 ★ — **무고한 사람이 감추는 것** (2026-07-29 신설)
   *
   * 이 게임의 핵심 규칙이 *"무고한 사람은 거짓말하지 않는다. 다만 자기 비밀은
   * 말하지 않는다"* 인데, **생성 사건에는 감출 것이 하나도 없었다.** 다섯이
   * 전부 동선만 읊고 끝났다 — 규칙이 작동할 자리가 없었던 것이다.
   *
   * 여기 오는 것은 **사건과 무관한 창피한 사실**이다. 살인과 이어지면 안 된다 —
   * 그러면 무고한 자가 용의자가 되고 논리가 무너진다.
   *
   * ⚠ **확보 단어와 겹치는 낱말을 쓰지 마라.** 진술이 조사로 얻을 것을 먼저
   * 말하면 조사할 이유가 사라진다 — 검증기 §9-10 이 잡는다.
   *
   * **다섯 명 전원이 하나씩 갖는다.** 범인만 없거나 범인만 있으면 그 자체가
   * 범인 표시다(소지품 검사가 범인만 없어서 범인을 가리키던 것과 같은 부류).
   * 그래서 5개 이상 필요하고, 모자라면 코드가 기본값으로 채운다.
   */
  secrets?: string[]
  /**
   * ★ 인물 층 ★ — **진술을 여는 말버릇.** 사람마다 다른 하나를 받는다.
   *
   * 말투가 다르면 다섯이 구분되지만, **길이가 달라지면 그게 유용도 표시**다
   * (§9-9). 그래서 어투만 바꾸고 **문단 수·구조는 전원 같게** 유지한다.
   * 5개 이상 필요하다.
   */
  openers?: string[]
  /**
   * ★ 인물 층 ★ — **진술 앞뒤의 지문(몸짓).** 진술 화면에 기울임체로 붙는다.
   *
   * 산장은 다섯 전원이 갖는데 생성 사건은 **0이었다.** §9-1 이 전원/전무를
   * 강제하니 0도 합법이라 아무도 안 걸렸고, 그래서 진술 화면이 말풍선만
   * 이어지는 화면이 됐다.
   *
   * ⚠⚠ **다섯이 같은 온도여야 한다 — 이것이 이 배열의 전부다.**
   * 넷은 담담한데 하나만 떨면 **지문이 곧 범인 표시**다(§9-1 의 문장 그대로).
   * 그런데 **반대도 같다** — 넷이 안절부절인데 하나만 침착해도 그 하나가 튄다.
   * 산장이 그래서 다섯 다 무언가를 만지작거린다(빈 잔 · 팔짱 · 탁자 두드리기 ·
   * 장바구니 · 휴대폰). **누가 범인인지 모르는 채로 읽어도 고르게 불편해야 한다.**
   *
   * 배정은 자리 순서다 — 범인이 몇 번을 받을지는 seed 가 정하므로, 배열이
   * 고르면 범인은 어느 자리에 앉아도 안 튄다.
   *
   * ⚠ **낱말이 확보 단어와 겹치면 안 된다**(§9-10 과 같은 근거). 세계의 소품을
   * 쓰되 조사로 캐낼 물건은 피한다. 5개 이상 필요하다.
   */
  gestures?: { pre: string; post: string }[]
}

const DEFAULT_PALETTE: Required<Omit<Palette, 'setting'>> & { setting: string } = {
  setting: '산장',
  names: ['서지안', '한유빈', '오나경', '백리원', '문세라', '윤다인', '임하늘', '남주원'],
  jobs: ['사진가', '번역가', '조리사', '학예사', '정비사', '약사'],
  items: ['만년필', '손목시계', '열쇠고리', '스카프', '라이터', '수첩'],
  motives: ['채무 관계', '자리 다툼', '오래된 약속', '지분 다툼'],
  places: { hall: '홀', room: '방', away: '자택' },
  rooms: ['부엌', '서재', '창고', '복도', '지하실', '작업실', '다락', '뒤뜰'],
  times: { t0: '전날 밤', t1: '새벽', t2: '아침' },
  // 트릭 전용 조사(복도·창가·책상·문틀·잠금장치·설비·부품)와 겹치지 않는 이름만 쓴다
  spots: [
    '주방', '마당', '다락', '차량', '지하', '창고', '쓰레기통',
    '뒷문', '계단', '화장실', '옷장', '우편함', '정원', '보일러실',
    '세탁실', '서랍장', '신발장', '냉장고', '화단', '지붕', '책장', '작업대',
    // 8장까지 조사/예산 3배를 유지하려면 서른 자리가 필요하다 (2026-07-29 실측)
    '수납장', '난간 아래', '현관', '복도 벽', '천장 점검구', '배전반', '물탱크', '뒤뜰',
  ],
  /**
   * ⚠ **레드 헤링·트릭 물증의 문안과 겹치는 낱말을 쓰지 마라.**
   * 검증기 §9-7 이 「조사 결과문이 그 조사가 주지 않는 단어를 말한다」를 잡는다 —
   * `영수증`·`오래된 사진` 을 넣었더니 소지품 검사 결과문에 그 낱말이 있어서
   * 전건에 경고가 붙었다(2026-07-29). 확보 단어는 **어디서도 안 겹쳐야** 한다.
   */
  records: [
    '출입 기록', '통화 내역', '남겨진 쪽지', '장부의 여백', '빌린 열쇠',
    '미납 청구서', '접힌 지도', '낡은 명함', '배송 전표', '깨진 액자',
  ],
  /**
   * 전부 **사건과 무관한** 것이어야 한다. 살인과 이어지는 비밀을 무고한 자에게
   * 주면 그 사람이 용의자가 되고, 검증기가 강제하는 「무고한 넷은 배제된다」가
   * 문장과 어긋난다.
   */
  secrets: [
    '그 시간에 다른 사람을 만나고 있었다는 것',
    '허락 없이 자리를 비웠다는 것',
    '빌린 돈을 아직 갚지 못했다는 것',
    '이력서에 적은 경력 하나가 사실이 아니라는 것',
    '몰래 다른 곳에 지원서를 넣었다는 것',
    '누군가의 험담을 옮긴 적이 있다는 것',
    '규정을 어기고 물건을 들여왔다는 것',
    '그날 술을 마셨다는 것',
  ],
  openers: [
    '몇 번을 말씀드렸지만,',
    '기억나는 대로 말씀드리면,',
    '정확히는 모르겠지만,',
    '적어둔 게 있어서 확실합니다.',
    '글쎄요,',
    '그날은 정신이 없어서요.',
  ],
  /**
   * ⚠ **이름을 쓰지 않는다.** 진술 카드에 이름이 이미 붙어 있고, 이름을 넣으면
   * 은/는 받침 처리가 팔레트마다 따라붙는다. 몸짓만 쓴다.
   *
   * 여섯이 **고르게 불편하다** — 만지작거리거나, 뜸을 들이거나, 말끝이 흐려진다.
   * 「담담하게」가 하나 있지만 그 짝이 「말을 골랐다」라 온도가 같다(산장의 지안이
   * 그렇게 쓰여 있다). 어느 자리에 범인이 앉아도 지문만으로는 못 고른다.
   */
  gestures: [
    { pre: '빈 잔을 두 손으로 감싸 쥔 채였다.', post: '그러고는 잠깐, 창밖으로 시선을 돌렸다.' },
    { pre: '팔짱을 낀 채 담담하게 말했다.', post: '그러고는 잠시 말을 골랐다.' },
    { pre: '손끝으로 탁자를 두어 번 두드리며 입을 열었다.', post: '말끝이 조금 흐려졌다.' },
    { pre: '앉은 자리에서 소매 끝을 자꾸 만졌다.', post: '되묻는 목소리가 조금 낮아졌다.' },
    { pre: '한참 뜸을 들이다가 고개를 들었다.', post: '말을 마치고도 한동안 앉아 있었다.' },
    { pre: '무릎 위에 올린 손을 몇 번 고쳐 잡았다.', post: '짧게 숨을 고르고 입을 다물었다.' },
  ],
}

type Cell = Case['people'][number]['presence'][number]
type Ev = Case['evidence'][number]
type Act = Case['actions'][number]
type Blank = Case['chapters'][number]['blanks'][number]

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

export type GenerateOptions = {
  /**
   * 보고서 장 수. **첫 장(조사 없이 확정) + 중간 가닥들 + 마지막 장(지목)** 이다.
   * 그래서 최소 2이고, 중간 가닥이 `chapters - 2` 개 생긴다.
   *
   * 기본값 5는 규모 표의 캠페인 규모다. 2026-07-29 이전에는 2 고정이었는데
   * 플레이테스터가 **「짧고 얄팍하다」** 고 했다 — 부피는 장·공란으로 늘린다.
   */
  chapters?: number
}

export function generateCase(seed: number, palette?: Palette, opts?: GenerateOptions): Case {
  const r = rng(seed)
  const chapters = Math.max(2, Math.min(8, Math.round(opts?.chapters ?? 5)))
  const midChapters = chapters - 2
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
  // 용의자 5 + 기록에 남은 이름(가명) + 피해자 = 최소 7개가 필요하다.
  // ★ 피해자 이름을 따로 뽑는다 ★ 안 뽑으면 앱이 하드코딩 피해자 이름으로
  // 폴백하고, 그 이름이 용의자로도 뽑히면 **피해자와 용의자가 같은 사람**이 된다
  const names = shuffled(nonEmpty(P.names, DEFAULT_PALETTE.names)).slice(0, SUSPECTS + 2)
  const jobs = nonEmpty(P.jobs, DEFAULT_PALETTE.jobs)
  /**
   * 인물 층. **섞어서 쓴다** — 팔레트가 준 순서대로 주면 목록 순서와 진술 순서가
   * 같아져, 팔레트를 본 사람에게는 누가 몇 번째인지가 드러난다.
   * 모자라면 자리 나누기(`i % length`)가 순환시키므로 개수가 적어도 안 죽는다.
   */
  const openers = shuffled(nonEmpty(P.openers, DEFAULT_PALETTE.openers))
  const secrets = shuffled(nonEmpty(P.secrets, DEFAULT_PALETTE.secrets))
  const gestures = shuffled(nonEmpty(P.gestures, DEFAULT_PALETTE.gestures))

  /**
   * 빈손 조사 자리. **모자라면 기본값으로 채운다.**
   *
   * 조사/예산 비율이 3배 아래로 내려가면 검증기가 경고하는데, 팔레트가 자리를
   * 적게 주는 것만으로 그 경고가 도로 살아난다. 팔레트는 어휘이고 **비율은
   * 논리라서 코드가 지켜야 한다** — 팔레트가 게임 균형을 깨뜨리게 두지 않는다.
   */


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
  /**
   * ★ 트릭은 **독립된 난수 줄기**에서 뽑는다 ★
   *
   * 같은 줄기를 쓰면 앞에서 `r()` 을 몇 번 썼는지에 따라 추첨이 밀린다 —
   * 그 횟수는 팔레트 배열 길이에 달려 있어서, **어휘를 바꿨을 뿐인데 트릭
   * 분포가 바뀐다.** 팔레트는 논리에 영향을 주면 안 된다.
   */
  const t = TRICKS[TRICK_KEYS[Math.floor(rng(seed ^ 0x5bf03635)() * TRICK_KEYS.length)]](culprit)

  /**
   * ─────────────────────────────────────────────────────────────
   *  가닥 — 중간 장 하나가 캐내는 것 한 벌 (2026-07-29)
   * ─────────────────────────────────────────────────────────────
   *
   * 장을 늘리려면 **캐낼 것이 그만큼 있어야 한다.** 검증기가 「각 장은 그 시점
   * 가용 정보로 확정 가능」을 강제하므로, 정보 없이 장만 늘리면 교착으로 막히거나
   * 답이 이미 아는 것이 되어 클릭 노동이 된다.
   *
   * 그래서 중간 장마다 **물증 1 · 조사 1 · 사실 1 · 확보 단어 1** 을 한 벌로 붙인다.
   * 그 장은 그 사실을 요구하므로 **그 조사를 해야만 열린다** — 장이 늘면 조사도
   * 늘고 예산도 는다. 실험자(`fit`)가 예산을 다시 찾는다.
   *
   * 사실의 `kind` 는 `context` 다. 유죄 계산(motive ∧ opportunity ∧ means)에
   * 끼지 않아야 **정답의 유일성이 장 수에 흔들리지 않는다.**
   */
  const records = [...(P.records ?? [])]
  for (const w of DEFAULT_PALETTE.records) {
    if (records.length >= midChapters) break
    if (!records.includes(w)) records.push(w)
  }
  // 확보 단어가 붙을 라벨. 전부 물증 부문이라 부문 분포가 한쪽으로 쏠리지 않는다
  const REC_LABELS: BlankLabel[] = ['물품', '접촉수단', '은닉처', '위장물', '은폐수단', '도구']

  const strands = Array.from({ length: midChapters }, (_, i) => {
    const word = records[i % records.length]
    const n = i + 1
    return {
      word,
      label: REC_LABELS[i % REC_LABELS.length],
      evidence: {
        id: `e_rec${n}`, description: word, record: '기록에 그대로 남아 있었다.',
        yieldsTerms: [word],
      } as Ev,
      action: {
        id: `a_rec${n}`, label: `${word} 확인`, cost: 1, gives: [`e_rec${n}`],
        salience: 0.32, yield: 'solution' as const,
        verb: 'search' as const, target: { kind: 'location' as const, id: 'hall' },
        result: res(word, '기록에 그대로 남아 있었다.'),
      } as Act,
      fact: {
        id: `f_rec${n}`, kind: 'context' as const, subject: culprit,
        content: `${word}에 남은 정황`, revealedBy: [`e_rec${n}`],
      },
      term: { word, source: { ko: `${word} 확인` }, note: { ko: '기록에 그대로 남아 있었다.' } },
    }
  })

  /**
   * ─────────────────────────────────────────────────────────────
   *  부지 — 방 여덟과 부지 밖 하나 (2026-07-29)
   * ─────────────────────────────────────────────────────────────
   *
   * 장소가 셋일 때 조사 30개가 앱 키 9개로 뭉갰다. 앱은 조사를 `동사:대상` 으로
   * 키잉하는데(`TERM_MAP`·`CLUE_MAP`·평면도가 그 키를 쓴다) 대상이 모자라면
   * 서로 다른 조사가 같은 칸을 가리킨다.
   *
   * 방 여덟 + 부지 밖 하나 = 아홉. `search`·`fixture` 로 열여덟, 인물 `belongings`·
   * `phone` 으로 열, 부검·알리바이 둘 — 서른 개가 나온다. 예산 10의 3배다.
   */
  const extraRooms = [...(P.rooms ?? [])]
  for (const n of DEFAULT_PALETTE.rooms) {
    if (extraRooms.length >= 8) break
    if (!extraRooms.includes(n)) extraRooms.push(n)
  }
  const onSite = [
    { id: 'hall', label: places.hall! },
    { id: 'room', label: places.room!, scene: true },
    ...extraRooms.slice(0, 8).map((n, i) => ({ id: `loc${i + 1}`, label: n })),
  ]
  const locIds = [...onSite.map((l) => l.id), 'away']

  // 건물 안을 격자로 나눈다. viewBox 1000×625 · 건물 60,60 620×480
  const COLS = Math.ceil(onSite.length / 2)
  const CW = Math.floor(620 / COLS)
  const cell = (i: number) => ({
    x: 60 + (i % COLS) * CW, y: 60 + Math.floor(i / COLS) * 240, w: CW, h: 240,
  })

  /**
   * 조사 키 배정기. **`동사:대상` 은 사건 안에서 유일해야 한다.**
   *
   * 손으로 정하면 트릭·가닥·빈손이 서로 모르는 채 같은 칸을 집는다 — 실제로
   * 그랬다. 원하는 자리를 먼저 주고, 차 있으면 다음 자리로 밀어낸다.
   */
  const usedKeys = new Set<string>()
  const claimLoc = (verb: string, prefer: string[]): { verb: string; id: string } | null => {
    for (const id of [...prefer, ...locIds]) {
      const k = `${verb}:${id}`
      if (usedKeys.has(k)) continue
      usedKeys.add(k)
      return { verb, id }
    }
    return null
  }
  const claimPerson = (verb: string, id: string) => {
    const k = `${verb}:${id}`
    if (usedKeys.has(k)) return false
    usedKeys.add(k)
    return true
  }

  const slotLabel: Record<string, string> = { t0: times.t0!, t1: times.t1!, t2: times.t2! }
  /**
   * ⚠ **장소 전부를 담는다 — 셋만 담으면 진술에 `undefined` 가 렌더된다.**
   *
   * 2026-07-29 까지 `{hall, room, away}` 셋뿐이었다. 그때는 아무도 `loc1..loc8` 에
   * 서 있지 않아서 드러나지 않았다 — **부지가 11곳으로 늘어난 뒤에도 이 표만 셋에
   * 머물러 있었던 것**이고, 아래 §무고한 넷의 동선이 방을 쓰기 시작하면 바로 문다.
   */
  const placeLabel: Record<string, string> = Object.fromEntries([
    ...onSite.map((l) => [l.id, l.label]),
    ['away', places.away!],
  ])

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
   * ★ 말버릇과 비밀이 붙었다 ★ (2026-07-29)
   *
   * 전에는 다섯이 **글자 하나까지 같은 뼈대**였다 — 동선만 읊고 「그 밖에는 따로
   * 드릴 말씀이 없습니다」로 끝났다. 그래서 이 게임의 핵심 규칙
   * *"무고한 사람은 거짓말하지 않는다. 다만 자기 비밀은 말하지 않는다"* 가
   * **생성 사건에서는 작동할 자리가 없었다.** 감출 것이 없었기 때문이다.
   *
   * 이제 팔레트가 `openers`(말버릇)와 `secrets`(감출 것)를 주면 코드가 얹는다.
   * **왕복을 하나 더 만들지 않는 이유**: 말투와 비밀은 사건이 아니라 **세계의
   * 속성**이라 팔레트에 들어간다 — 팔레트는 이미 내장이라 왕복 0회다.
   *
   * ⚠ **전원 네 문단으로 못박는다.** 시간대 3(첫 문단에 말버릇을 얹는다) + 비밀 1.
   * 말버릇을 따로 떼면 문단이 다섯이 되는데, 그럴 이유가 없다 — 전에도 넷이었다.
   * 비밀을 가진 사람만 한 문단 길어지면 **문단 수가 곧 표시**가 되고, 그건
   * §9-9(진술 길이 쏠림)가 오류로 잡는 바로 그것이다. 범인도 똑같이 하나 받는다 —
   * 범인의 진짜 비밀은 살인이지만, **겉으로 감추는 것은 남들과 같은 결**이어야 한다.
   *
   * 여전히 LLM 산문보다는 못하다(`prose.source: 'template'`). 5번 절이 그대로
   * 남아 있으므로 더 좋게 쓰고 싶으면 `PROSE-BRIEF.md` 로 덮어쓴다.
   */
  const statementOf = (
    cells: { slot: string; location: string }[],
    opener: string,
    secret: string,
  ) => {
    const at = new Map(cells.map((x) => [x.slot, x.location]))
    const line = (s: string, first: boolean) => {
      const loc = at.get(s)
      const body = loc
        ? `${slotLabel[s]}에는 ${placeLabel[loc]}에 있었습니다.`
        : `${slotLabel[s]}에는 그곳에 없었습니다.`
      return { ko: first ? `${opener} ${body}` : body }
    }
    return [
      line('t0', true),
      line('t1', false),
      line('t2', false),
      // 감추지만 **거짓말은 아니다** — 있다는 것은 인정하고 내용을 안 밝힌다.
      // 이 문장이 곧 제목의 규칙이다
      { ko: `${secret}은 이 일과 상관없는 일이라, 말씀드리고 싶지 않습니다.` },
    ]
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  무고한 넷의 동선 — **넷이 서로 달라야 한다** (2026-07-29)
   * ─────────────────────────────────────────────────────────────
   *
   * 여기 있던 것은 `[{ slot: 't2', location: 'hall' }]` **한 배열이었고 넷이
   * 그것을 공유했다.** 검증기가 「무고한 넷은 사망 구간에 현장 금지」를 강제하니
   * 가장 쉬운 해가 「전원 t2 홀」이었고, 그대로 굳었다.
   *
   * **한 줄이 결함 둘을 낳고 있었다.**
   *
   * ① **넷의 동선 문장이 글자까지 같았다.** 2026-07-29에 말버릇·비밀을 붙였지만
   *    알맹이는 하나였다 — 진술 정독이 실질 **2명분**(범인 1 + 무고 1)이고
   *    격자에서도 넷이 같은 줄이다.
   *
   * ② ★ **범인만 밤을 다 설명했다** ★ `TRICKS` 는 전부 `claim` 에 t0·t1·t2 를
   *    채우는데(257·284·311·338·366행) 무고한 넷은 t2 하나뿐이라 「없었다」가
   *    둘씩 붙었다. **자기 밤을 온전히 말하는 사람이 범인 하나**였다 —
   *    §절대 규칙의 「유용도 시각 구분」이 데이터 층에서 재발한 것이고,
   *    바로 위 `statementOf` 주석이 *"문단 수가 곧 범인 표시가 된다"* 며
   *    막아둔 것과 **똑같은 부류를 문단 수 대신 「없었다」 개수로** 흘렸다.
   *
   * **구조는 「모였다 → 흩어졌다 → 다시 모였다」다.**
   *
   * ```
   * t0  전원 hall     프롤로그가 이미 그렇게 말한다 — "다섯이 자리에 있었다"
   * t1  넷이 딴 방     ★ 여기서 갈린다. 현장(room)만 아니면 된다
   * t2  전원 hall     배제의 근거 — f_no_* "아침에 함께 도착했다" · e_mutual
   * ```
   *
   * **t2 를 건드리지 않는 이유**: 배제가 거기 걸려 있다. `f_no_<id>_ok`
   * (「도착 시각 상호 일치」)가 `e_mutual`(「넷의 상호 보증」)로 공개되므로
   * **넷은 t2 에 모여 있어야 그 산문이 참이다.** 흩어뜨리면 데이터는 통과하고
   * 기록만 거짓이 된다 — §9-8 이 잡는 바로 그 형태다.
   *
   * **t0 를 흩지 않는 이유 둘**: 프롤로그가 「t0 에 다섯이 hall 에 모였다」고
   * 말하고(참이 된다 — 전에는 넷이 「그곳에 없었습니다」라고 해서 **프롤로그와
   * 어긋나 있었다**), 그리고 `TRICKS` 넷이 범인 t0 를 `hall` 로 두므로
   * **전원 hall 이라야 범인이 t0 에서도 안 튄다.**
   *
   * 그래서 **갈리는 자리는 t1 하나**이고, 그 하나가 하필 **사망 구간**이다 —
   * 넷이 서로 달라야 할 이유가 가장 큰 자리에서 갈린다.
   */
  const innocentRooms = (() => {
    // 현장(room)과 홀을 뺀 방들. `onSite` 가 방 여덟을 보장하므로 넷에 늘 충분하다
    const pool = onSite.map((l) => l.id).filter((id) => id !== 'hall' && id !== 'room')
    // 결정론적 셔플 — 같은 세계라도 사건마다 배치가 달라진다.
    // ⚠ 아키타입 추첨은 **다른 스트림**이라(459행 `rng(seed ^ …)`) 여기서 `r()` 을
    // 써도 트릭 분포는 안 흔들린다. 흔들리는 것은 뒤따르는 나이·직업뿐이다
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool
  })()
  /**
   * ★ 한 사람은 **범인이 주장하는 자리에 실제로 있는다** ★
   *
   * 넷을 전부 흩자마자 **셋째 결함이 드러났다** — 흩어진 넷 가운데 범인만
   * 제자리에 남아서 *"밤새 라운지를 안 뜬 사람은 배도현 하나"* 가 됐다.
   * ②를 고치는 손이 같은 것을 뒤집어서 다시 만든 셈이다.
   *
   * **모양으로 범인을 집어낼 수 있으면 물증이 필요 없어진다** — §절대 규칙의
   * 「유용도 시각 구분」이다. 그래서 무고한 하나에게 범인의 **주장과 같은 동선**을
   * 준다. 범인의 알리바이가 「혼자만의 주장」이 아니게 되고, 둘 중 누가 거짓인지는
   * **물증으로만** 갈린다 — 그게 이 게임이 팔려는 것이다.
   *
   * ⚠ **t1 만 맞추면 모자란다 — 주장 전체를 따라간다.** 처음에 t1 하나만
   * 겹쳤더니 `delayed_mechanism` 이 그대로 새어나갔다(200건 중 39건 실측):
   * 그 아키타입은 **t0 까지 거짓말**해서(`away/away/hall`) 범인이 t0 에서 혼자
   * 튀었다. 「모양으로 안 튄다」는 **슬롯 하나가 아니라 동선 전체**의 성질이다.
   *
   * ⚠ **`room`(현장)이면 안 쓴다.** 지금 아키타입 다섯은 t1 주장이 `hall` 아니면
   * `away` 라 걸릴 일이 없지만, 새 아키타입이 현장을 주장하면 이 사람이 사망
   * 구간에 현장에 서게 되어 **배제가 무너진다**(검증기 §7.5-iii). 막아둔다.
   */
  const shadowPresence = t.claim.map((c) =>
    c.slot === 't1' && c.location === 'room' ? { ...c, location: 'hall' } : { ...c },
  )
  const innocentPresence = (id: PersonId) => {
    const k = innocents.indexOf(id)
    if (k === 0) return shadowPresence
    return [
      { slot: 't0', location: 'hall' },
      { slot: 't1', location: innocentRooms[(k - 1) % innocentRooms.length]! },
      { slot: 't2', location: 'hall' },
    ]
  }
  /**
   * 말버릇·비밀은 **자리로 나눈다** — `r()` 로 뽑으면 두 사람이 같은 것을 받을 수
   * 있고, 겹치는 순간 그 둘만 닮아 보인다. 팔레트가 모자라면 순환시켜 채운다.
   */
  const openerOf = (i: number) => openers[i % openers.length]
  const secretOf = (i: number) => secrets[i % secrets.length]
  /**
   * 지문도 같은 규칙으로 나눈다 (2026-07-29). **전원이 하나씩 받는다** —
   * §9-1 이 전원/전무를 오류로 강제하고, 그 근거가 *"넷은 담담하고 하나만
   * 불안하면 지문이 곧 범인 표시"* 다. 여기서 조건이 갈릴 자리를 아예 안 만든다.
   */
  const gestureOf = (i: number) => gestures[i % gestures.length]!
  const person = (id: PersonId, i: number) => ({
    id,
    name: names[i],
    age: 27 + Math.floor(r() * 12),
    job: pick(jobs),
    hiddenRole: id === culprit ? ('ringleader' as const) : ('unaware' as const),
    presence: id === culprit ? t.presence : innocentPresence(id),
    // 거짓말은 범인만. 무고한 사람은 claim 을 적지 않는다(= presence 와 같다)
    ...(id === culprit ? { claim: t.claim } : {}),
    statement: {
      // 진술에서 말하는 것은 주장이다 — 범인은 claim, 나머지는 presence
      paragraphs: statementOf(
        id === culprit ? t.claim : innocentPresence(id),
        openerOf(i),
        secretOf(i),
      ),
      gesture: { pre: { ko: gestureOf(i).pre }, post: { ko: gestureOf(i).post } },
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
    // 짝을 이름으로 적는다 — 아래 빈손 아홉 쌍과 **같은 모양**이어야 한다.
    // 이것만 「알리바이 대조」로 밋밋하면 목록에서 그 자체가 유용도 표시다
    { id: 'a_alibi', label: `알리바이 대조 · ${names[ids.indexOf(innocents[0])]} ↔ ${names[ids.indexOf(innocents[1])]}`,
      cost: 1, gives: ['e_mutual'], salience: 0.45, yield: 'exclusion',
      verb: 'alibi', pair: [innocents[0], innocents[1]],
      result: res('맞물리는 시각', '네 사람이 말한 도착 시각이 서로 맞물렸다.') },
  ]

  /**
   * 조사 키를 배정한다. **원하는 자리를 먼저 주고 차 있으면 밀어낸다.**
   * 순서가 우선순위다 — 해답·트릭·가닥이 의미 있는 자리를 먼저 가져가고,
   * 빈손은 남은 조합으로만 만든다.
   */
  const resolveKeys = (acts: Act[]): Act[] =>
    acts.map((a) => {
      if (a.pair) return a
      const verb = a.verb ?? 'search'
      if (a.target?.kind === 'person') {
        claimPerson(verb, a.target.id)
        return a
      }
      const got = claimLoc(verb, a.target?.kind === 'location' ? [a.target.id] : [])
      return got ? { ...a, verb: got.verb as Act['verb'], target: { kind: 'location' as const, id: got.id } } : a
    })

  const named = resolveKeys([...baseActions, ...t.actions, ...strands.map((s) => s.action)])

  /**
   * 빈손 조사는 **남은 조합 전부**로 만든다. 개수를 미리 정하지 않는다 —
   * 조사 대상이 예산의 3배여야 하는데 예산은 실험자가 나중에 정하므로,
   * 만들 수 있는 만큼 만들어 두는 쪽이 안전하다. 빈손도 배제 정보다.
   *
   * salience 를 낮게 둔다 — 눈에 띄어서 고르는 것이 아니라 소거하려고 고른다.
   */
  const label = new Map(onSite.map((l) => [l.id, l.label]))
  label.set('away', places.away!)
  const empties: Act[] = []
  const addEmpty = (verb: Act['verb'], kind: 'location' | 'person', id: string, text: string) => {
    const k = `${verb}:${id}`
    if (usedKeys.has(k)) return
    usedKeys.add(k)
    empties.push({
      id: `a_e${empties.length + 1}`, label: text, cost: 1, gives: [],
      salience: Math.max(0.04, 0.22 - empties.length * 0.008), yield: 'empty',
      verb, target: { kind, id },
    })
  }
  /**
   * ★ 소지품 검사는 **전원**에게 있어야 한다 ★
   *
   * 레드 헤링이 무고한 넷에게만 붙으므로 그대로 두면 **범인만 소지품 검사가
   * 없다.** 그 부재가 곧 범인 표시다 — 조사 0회에 답이 새는 절대 규칙 위반이고,
   * 2026-07-29 에 실제로 그 상태였다. 빈손으로라도 자리를 만든다.
   */
  ids.forEach((p, i) => addEmpty('belongings', 'person', p, `소지품 검사 · ${names[i]}`))
  for (const id of locIds) addEmpty('search', 'location', id, `${label.get(id)} 수색`)
  for (const id of locIds) addEmpty('fixture', 'location', id, `${label.get(id)} 설비 확인`)
  ids.forEach((p, i) => addEmpty('phone', 'person', p, `통화내역 조회 · ${names[i]}`))

  /**
   * 피해자도 조사 대상이다 (2026-07-29 신설).
   *
   * **골든 케이스에는 있는데 생성기에만 없었다** — `mountain-lodge.yaml` 의
   * `a_victim_bel`(소지품 검사 · 피해자)이다. 앱도 이미 받는다: `applyCase` 가
   * `c.victim` + `c.victimProfile.name` 을 보고 `VICTIM_TARGET` 을 세우고,
   * 생성 사건은 그 둘을 **원래 내고 있었다.** 자리만 안 만들어 준 것이다.
   */
  const victimName = names[SUSPECTS + 1]
  addEmpty('belongings', 'person', 'victim', `소지품 검사 · ${victimName}`)
  addEmpty('phone', 'person', 'victim', `통화내역 조회 · ${victimName}`)

  /**
   * ★ 알리바이 대조는 **모든 쌍**이 사건 파일에 있어야 한다 ★ (2026-07-29 신설)
   *
   * **앱은 이미 열 쌍을 전부 실행한다.** 관계도에서 두 용의자를 고르면 그대로
   * 돌고(`App.jsx` `graphSel` → `askInvestigate('alibi', sel)`), 선언되지 않은
   * 쌍은 `resultFor(...) || { type: 'empty' }` 로 **공통 폴백**에 떨어진다 —
   * 앱은 사건 파일의 조사 목록에 대고 검사하지 않는다.
   *
   * 그런데 엔진은 **한 쌍만 선언했다.** 그래서 「조사 대상」이 아홉 개 적게
   * 세어졌다. §9-8(데이터를 주는데 산문이 침묵한다)의 **거울상**이다 —
   * 이쪽은 **앱이 주는데 사건 파일이 모른다.**
   *
   * 그 과소 계상이 곧 「선택이 소거가 된다」 경고의 정체다. 나머지 다섯 동사는
   * 이미 포화라 늘릴 자리가 없다 — `belongings`·`phone` 이 인물 전원,
   * `search`·`fixture` 가 장소 전원, `autopsy` 는 시신 하나. 그래서 장이 늘면
   * 가닥이 `(동사:대상)` 키를 빼앗아 빈손이 정확히 그만큼 줄고, **총량이 34로
   * 못박혀** 있었다(3장 22빈손 · 8장 17빈손, 합계는 둘 다 34).
   *
   * 쌍은 `resolveKeys` 가 건너뛰므로(`if (a.pair) return a`) **가닥에 안 뺏긴다.**
   * 그래서 이 아홉이 장 수와 무관하게 남는 바닥이 된다.
   */
  const usedPairs = new Set([[innocents[0], innocents[1]].slice().sort().join('|')])
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const k = [ids[i], ids[j]].slice().sort().join('|')
      if (usedPairs.has(k)) continue
      usedPairs.add(k)
      empties.push({
        id: `a_e${empties.length + 1}`,
        label: `알리바이 대조 · ${names[i]} ↔ ${names[j]}`,
        cost: 1, gives: [], yield: 'empty', verb: 'alibi',
        salience: Math.max(0.04, 0.22 - empties.length * 0.008),
        pair: [ids[i], ids[j]],
      })
    }

  const allActions = [...named, ...empties]

  /**
   * ─────────────────────────────────────────────────────────────
   *  장 완성 공개 — **장을 완성하면 무언가 도착한다** (2026-07-29)
   * ─────────────────────────────────────────────────────────────
   *
   * 여기 있던 것은 **1장짜리 하나를 하드코딩한 배열**이었다. 5장 사건인데
   * **2·3·4장 완성이 전부 무음**이었다 — 장 완성은 이 게임의 리듬 장치인데
   * 생성 사건에는 그 박자가 하나뿐이었다(산장은 6건).
   *
   * ★ 앱이 무엇을 실제로 그리는지 먼저 봤다 ★ `App.jsx` 의 `applyCase` 는
   * `addClaims`(→ 진술 문단 · 격자 칸)와 `actions`(→ 대상 배지)만 읽고
   * **`narration` 은 아무 데도 안 쓴다** — 장 인터루드 화면이 아직 없다
   * (`NEXT-ACTION` 다음액션 표 9번). 그래서 **서사만 넣으면 또
   * 「검증 통과 + 렌더 불가」**가 된다. 실제로 도착하는 것은 `addClaims` 다.
   *
   * ⚠ 그래도 **전건에 `narration` 을 단다.** 검증기가 *"장 완성 공개 N건 중
   * M건만 서사를 가진다 — 서사의 유무가 유용도를 노출한다"* 를 오류로 잡는다
   * (§9-1·§9-9 와 같은 전부/전무 부류다). 인터루드 화면이 생기면 그날 바로 읽힌다.
   *
   * ── 안 넣은 것과 그 이유 ─────────────────────────────────
   *
   * **ⓐ 조사 대상을 열지 않는다.** 1장이 `a_ledger` 를 여는 것은 *"장부가 한 권
   * 더 있다"* 는 **존재의 공개**라 정당하다(산장 1장의 별채와 같다). 그러나
   * 가닥 조사 `a_rec{n}` 은 이미 다 아는 곳(`hall`)을 가리키므로, 배지를 달면
   * 그건 공개가 아니라 **「이걸 조사해봐라」** 다 — §절대 규칙의 「조사 추천·힌트
   * 금지」에 정면으로 걸린다.
   *
   * **ⓑ 서로를 목격했다는 말을 안 만든다.** 「그때 ○○씨를 봤다」는 두 갈래로
   * 다 터진다 — 그림자 한 사람은 사망 구간에 범인이 **주장하는** 자리에 있으므로,
   * 「나 혼자 있었다」고 하면 **범인의 거짓말이 공짜로 드러나고**, 「같이 있었다」고
   * 하면 그 말이 **거짓이 된다**(공개는 확정 층이라 거짓일 수 없다).
   * 그래서 전부 **자기 자신에 대한 말**로만 쓴다.
   *
   * **ⓒ 낱말을 말하지 않는다.** 장 제목이 곧 캐낸 기록의 이름이라 그것을
   * 되뇌면 §9-7 부류의 누설이다. 서사는 「기록」이라고만 부른다.
   *
   * > 문안은 조립이라 산문가만 못하다. 5번 절(`PROSE-BRIEF`)이 덮어쓸 자리다 —
   * > 여기서 하는 일은 **박자가 존재하게** 만드는 것이다.
   */
  const revealSpeakers = (() => {
    const pool = [...ids]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool
  })()
  /** 그 사람이 **말한** 자리 — 범인은 주장, 나머지는 실제. 거짓말도 일관되게 유지된다 */
  const saidAt = (id: PersonId, slot: string) =>
    (id === culprit ? t.claim : innocentPresence(id)).find((x) => x.slot === slot)?.location

  /**
   * 이름 뒤의 「이/가」. **받침이 있으면 `이`, 없으면 `가`** — 한글 음절은
   * `(코드 - 0xAC00) % 28` 이 0이 아니면 받침이 있다.
   *
   * 공란은 이것을 `particle: '이/가'` 로 앱에 미루는데(답이 플레이어마다 달라서
   * 생성 시점에 모른다), **서사의 화자는 여기서 이미 정해져 있다.** 그래서
   * 그대로 박는다 — 안 하면 「구민아**이** 한마디를 보탰다」가 나온다(실측).
   */
  const subjectParticle = (word: string) => {
    const ch = word.charCodeAt(word.length - 1) - 0xac00
    if (ch < 0 || ch > 11171) return '이' // 한글이 아니면 보수적으로
    return ch % 28 === 0 ? '가' : '이'
  }

  const chapterReveals = [
    {
      trigger: { on: 'chapterComplete' as const, chapterOrder: 1 },
      yield: 'path' as const,
      actions: ['a_ledger'],
      surface: 'map' as const,
      narration: `${slotLabel.t2}의 정황이 정리됐다. 장부가 한 권 더 있다는 것을 뒤늦게 들었다.`,
    },
    ...strands.map((_s, i) => {
      const speaker = revealSpeakers[i % revealSpeakers.length]!
      const who = names[ids.indexOf(speaker)]
      const loc = placeLabel[saidAt(speaker, 't1') ?? 'hall']
      const frame = [
        `${slotLabel.t1}에 ${loc}에 있었던 것은 제 일 때문입니다. 그 밖에 보탤 것은 없습니다.`,
        `다시 여쭈시니 말씀드리면, ${slotLabel.t1}에 제가 있던 곳은 ${loc}입니다.`,
        `${loc}에 있던 시간에 대해서는 앞서 말씀드린 그대로입니다.`,
      ][i % 3]!
      return {
        trigger: { on: 'chapterComplete' as const, chapterOrder: 2 + i },
        // 새 정보가 0이라 decoy 도 아니다 — decoy 는 「참이지만 무관한 **정보**」이고
        // 이건 이미 말한 것을 되짚는 결이다. 난이도 손잡이(decoy 비율)를 안 건드린다
        yield: 'flavor' as const,
        surface: 'statement' as const,
        addClaims: [{ speaker, content: frame, target: 'statement' as const }],
        narration: `기록에 대한 정리가 끝나자, ${who}${subjectParticle(who!)} 한마디를 보탰다.`,
      }
    }),
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

    /**
     * 프롤로그 (2026-07-29 신설).
     *
     * **없으면 앱이 산장 것을 그대로 띄운다.** `App.jsx` 는 `if (c.prologue?.length)`
     * 일 때만 갈아끼우므로, 안 주면 하드코딩된 *"산길 끝에 산장이 하나 있다…"* 가
     * 남는다 — 박물관 사건을 열었는데 산장 프롤로그가 나온다(2026-07-29 실측).
     * **제목만 안 읽던 07-28 결함과 같은 부류**이고, 이번엔 엔진이 안 준 쪽이다.
     *
     * ⚠ **새 정보 0.** 검증기 §9-7(b)가 「프롤로그가 조사로 얻을 단어를 말한다」를
     * **오류**로 잡는다. 그래서 여기서는 가명·동기·기록 이름을 절대 쓰지 않는다 —
     * 무대·피해자·모인 정황·발견까지만 말한다.
     *
     * 말맛은 ②산문가가 덮어쓴다. 이건 「다른 세계의 글이 뜨는 것」을 막는 바닥이다.
     */
    prologue: [
      { ko: `${P.setting ?? DEFAULT_PALETTE.setting}. ${victimName}은 그곳에서 지내고 있었다.` },
      // ⚠ **「다섯이 자리에 있었다」로 쓰면 안 된다** — 프롤로그는 게임이 하는 말이라
      // 곧 사실이고, 그러면 t0 에 홀에 없는 사람이 **그 자리에서 거짓말쟁이로 찍힌다.**
      // `delayed_mechanism` 은 범인 실제 위치가 t0 에 현장이고, 아래 §무고한 넷의
      // 동선의 그림자 한 사람도 범인 주장을 따라 부지 밖일 수 있다. 머문 인원만 말한다
      { ko: `${slotLabel.t0}, ${places.hall}에 불이 켜져 있었다. 그곳에 머물던 사람은 모두 다섯이었다.` },
      { ko: `${slotLabel.t2}, 가장 먼저 일어난 사람이 ${places.room} 문을 열었다.` },
      { ko: `${victimName}은 이미 숨을 쉬지 않았다.` },
    ],

    /**
     * 평면도. **조사 화면이 곧 도면이라 좌표가 없으면 갈 수가 없다.**
     *
     * 검증기 §9-3 이 「장소가 도면에 없다 — 플레이어가 갈 수 없다」를 오류로
     * 잡으므로 세 장소를 전부 놓는다. 현장에는 `scene` 표식이 필요하다.
     *
     * 손으로 쓴 사건의 도면(건물·문·창·보행선·축척)만큼 풍부하지 않다 —
     * 방 둘과 부지 밖 하나뿐이다. 규모가 커지면 여기부터 늘린다.
     */
    floorPlan: {
      viewBox: { w: 1000, h: 625 },
      scale: { x: 96, len: 90, y: 585, label: '5m' },
      buildings: [{ id: 'b_main', x: 60, y: 60, w: 620, h: 480 }],
      rooms: onSite.map((l, i) => ({
        id: `r_${l.id}`, building: 'b_main', loc: l.id, ...cell(i),
        label: l.label, primary: true,
        ...(l.scene ? { scene: true, tint: 'rgba(235,87,87,.10)' } : {}),
      })),
      zones: [
        { id: 'z_away', loc: 'away', x: 750, y: 90, w: 200, h: 160, label: places.away!, offsite: true, hatch: true },
      ],
      doors: [{ id: 'd_room', x1: 380, y1: 240, x2: 380, y2: 320, building: 'b_main' }],
      windows: [{ x1: 660, y1: 120, x2: 660, y2: 200, building: 'b_main' }],
      walks: [{ x1: 220, y1: 545, x2: 850, y2: 250, min: 12 }],
    },

    seedTerms: [tool],
    slots: [
      { id: 't0', label: times.t0! },
      { id: 't1', label: times.t1!, isWindow: true },
      { id: 't2', label: times.t2! },
    ],
    locations: [
      ...onSite.map((l) => ({ id: l.id, label: l.label, atLodge: true })),
      { id: 'away', label: places.away!, atLodge: false },
    ],
    people: ids.map(person),
    victim: 'victim',
    victimProfile: { name: names[SUSPECTS + 1], age: 28 + Math.floor(r() * 14), job: pick(jobs) },
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

    evidence: [...baseEvidence, ...t.evidence, ...strands.map((s) => s.evidence)],

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
      // 가닥 사실 — 중간 장의 문을 연다. context 라 유죄 계산에는 끼지 않는다
      ...strands.map((s) => s.fact),
    ],

    actions: allActions,

    /**
     * 첫 장은 **조사 없이 확정**되어야 한다(검증기가 강제한다 — 없으면 시작하자마자
     * 막힌다). 마지막 장이 **지목**이고 사건 전체에 하나뿐이다.
     * 그 사이가 가닥 장이고, 장 수는 여기서 정해진다.
     *
     * 생성 사건의 서술문은 템플릿이다. 사람이 쓴 사건만큼 좋을 수 없지만
     * **문장이긴 해야 한다** — 목록으로 두면 보고서가 두 물건이 된다.
     * 받침에 따라 갈리는 어미(였다/이었다)는 쓰지 않는다. 답이 매번 다르다
     *
     * ⚠ **조사(이/가·을/를)는 서술문에 글자로 박지 말고 `particle` 로 선언한다**
     * (2026-07-29). 위 한 줄이 *어미*는 피하라고 해놓고 정작 **조사를 박아놨다** —
     * 가닥 장이 `{blank}` 뒤에 `'이 남아 있었고'`·`'을 가리켰다'` 를 붙여서
     * 받침 없는 답이 오면 **「남겨진 쪽지이」·「1층 공동 라운지을」** 이 됐다.
     * 앱에 `particle()` 해결기가 이미 있고 1장·마지막 장은 그걸 쓰고 있었다 —
     * **가닥 장만 안 쓰고 있었다.**
     *
     * 하필 **결말 화면**에서 제일 크게 보인다. 보고서 서술문이 곧 결말 서사이고
     * (`buildResult` 가 플레이어의 답을 그 문장에 꽂아 다시 읽힌다), 그게 이
     * 게임의 마지막 장치다. 틀린 조사가 거기서 다섯 줄 중 셋에 박혀 있었다.
     */
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
        report: [
          { text: '그날 아침 ' }, { blank: 0 }, { text: ' 가장 먼저 도착했다. ' },
          { blank: 2 }, { text: ', ' }, { blank: 1 }, { text: '에서 ' },
          { blank: 3 }, { text: ' 발견됐다.' },
        ],
        epilogueOrder: 1,
      },

      // 가닥 장 — 조합 수는 인물 5 × 4 × 4 = 80 으로 하한 30 을 넘는다
      ...strands.map((s, i) => ({
        order: 2 + i,
        title: `${s.word}`,
        opening: '다음으로 기록에 남은 것을 적는다.',
        requiresFacts: [s.fact.id],
        blanks: [
          { label: '인물', candidates: 'closed', answer: innocents[i % innocents.length], particle: '이/가' },
          { label: s.label, candidates: 'discovered', answer: s.word, particle: '이/가' },
          { label: i % 2 === 0 ? '시각' : '장소', candidates: 'closed', answer: i % 2 === 0 ? 't1' : 'hall', particle: '을/를' },
        ] as Blank[],
        report: [
          { text: '기록을 확인한 것은 ' }, { blank: 0 }, { text: ' 있던 자리였다. ' },
          { blank: 1 }, { text: ' 남아 있었고, ' }, { blank: 2 }, { text: ' 가리켰다.' },
        ],
        epilogueOrder: 2 + i,
      })),

      {
        order: chapters, title: '이름과 이유',
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
        epilogueOrder: chapters,
      },
    ],

    /**
     * 확보 단어 사전. **앱의 은행이 이것으로 채워진다** —
     * 없으면 `discovered` 공란의 후보가 이전 사건의 단어로 남는다(2026-07-29 확인).
     */
    terms: [
      { word: tool, source: { ko: `${places.room} 수색 · 시신 검사` }, note: { ko: '바닥에 떨어져 있었다.' } },
      { word: alias, source: { ko: '서류 조사 · 장부 조사' }, note: { ko: '여러 기록에 반복 등장했다.' } },
      { word: motive, source: { ko: '서류 조사' }, note: { ko: '금전 기록에 남아 있었다.' } },
      ...strands.map((s) => s.term),
    ],

    // 위 §장 완성 공개 참조. **마지막 장에는 공개가 없다** — 그 장을 채우면
    // 사건이 끝나므로 도착할 자리가 없다(산장도 5장 중 1~4장에만 있다)
    reveals: chapterReveals,

    reopenPerChapter: 1,
  }
}
