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
/**
 * 방 하나. **이름만 주면 그만이고, 성질을 붙이면 도면이 그만큼 그럴듯해진다.**
 *
 * ★ 좌표는 받지 않는다 ★ 배치는 코드가 한다 — LLM 에게 좌표를 시키면 겹치는 방과
 * 허공의 문이 나온다. 여기서 받는 것은 **코드가 알 수 없는 세계 지식**뿐이다:
 * 암실에 창이 있으면 안 되고, 가마실에는 가마가 있다.
 */
export type RoomSpec = {
  name: string
  /** 창이 날 수 없는 방. 암실·지하·수장고처럼 빛을 막는 곳 */
  noWindow?: boolean
  /**
   * 그 방에서 **눌러볼 만한 설비** 이름. 도면 위의 점이 되고 「고정물 조사」의
   * 대상이 된다(가마 · 인화기 · 보일러). 없으면 코드가 총칭으로 채운다.
   */
  fixture?: string
}

/**
 * 장소 하나. **`RoomSpec` 과 같은 규약이다** — 이름만 주면 그만이고, 설비 이름을
 * 붙이면 도면 위에 점이 하나 더 뜬다.
 */
export type PlaceSpec = {
  name: string
  /**
   * 그 장소에서 **눌러볼 만한 설비** 이름. 산장은 거실(`main`)에 **금고**가 있고
   * 그것이 유서의 경로다 — 모이는 곳에 이름 있는 설비가 있으면 조사가 뜻을 갖는다.
   * 없으면 코드가 총칭(「…의 설비」)으로 채운다.
   */
  fixture?: string
}

export type Palette = {
  /** 무대 이름. 제목에 쓰인다 */
  setting?: string
  names?: string[]
  jobs?: string[]
  items?: string[]
  motives?: string[]
  /**
   * 장소 이름표. 구조(모이는 곳·현장·진입로·부지 밖)는 고정이고 이름만 바뀐다.
   *
   * `approach` 는 **부지 안의 실외**다(산장의 진입로). 건물과 부지 밖 사이에
   * 있어야 보행 시간이 뜻을 갖는다 — 「걸어서 2분」이 알리바이의 재료가 된다.
   *
   * ★ `rooms` 와 **같은 규약**이다 ★ 맨 문자열이면 이름만, `{ name, fixture }` 면
   * 설비 이름까지. 전에는 문자열만 받아서 **이 넷만 설비 이름을 가질 길이 구조적으로
   * 없었고**, 그래서 팔레트 방이 아무리 잘 써 와도 `hall`·`room`·`approach`·`away`
   * 는 언제나 「…의 설비」로 남았다 (2026-07-29 밤에 뚫었다).
   */
  places?: {
    hall?: string | PlaceSpec; room?: string | PlaceSpec
    away?: string | PlaceSpec; approach?: string | PlaceSpec
  }
  /**
   * 부지 안의 **다른 방들**. 여섯 개 안팎.
   *
   * 방이 적으면 조사가 갈 곳이 없다 — 앱은 조사를 **`동사:대상`** 으로 키잉하므로
   * 장소 셋으로는 서로 다른 조사를 스물몇 개 만들 수가 없다(2026-07-29 실측:
   * 조사 30개가 키 9개로 뭉갰다). 방이 늘면 도면도 덜 단조로워진다.
   */
  rooms?: (string | RoomSpec)[]
  /**
   * 시간대 이름표. 가운데(`t1`)가 사망 추정 구간이다.
   *
   * ★ **가장 비싼 어휘 자리다** ★ `times` 는 **진술마다 반복 인용**되므로
   * (*"…에는 …에 있었습니다"*) 한 낱말을 모르면 **다섯 사람의 진술이 전부
   * 흐려진다.** 업계 은어를 쓰지 않는다 — 기준은 *"그 직업이 아닌 사람이 사전
   * 없이 읽어서 뜻이 서는가"*(§업계 은어를 쓰지 마세요).
   *
   * `window` — **사망 구간을 두 칸 이상으로 쪼갤 때만** 쓴다(`deathCells` ≥ 2).
   * 칸마다 이름표가 하나씩 필요한데 `t1` 은 하나뿐이라서다. 안 주면 생성기가
   * `t1` 에 「(전반)·(중반)·(후반)」을 붙여 만들지만 **그것은 기계가 지은
   * 어휘**이고 이 자리는 가장 비싼 자리다 — 검증기가 경고한다. 되도록 적는다.
   *
   * ```
   * times: { t0: '폐관 준비', t1: '야간 순찰 시간', t2: '개관 직전',
   *          window: ['첫 순찰', '두 번째 순찰'] }
   * ```
   */
  times?: { t0?: string; t1?: string; t2?: string; window?: string[] }
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
  /**
   * ⚠ **설비 이름이 여기에도 있어야 한다** (2026-07-29 밤).
   *
   * 전에는 기본 팔레트가 설비 이름을 하나도 안 줘서, 「기본 어휘」로 만든 사건은
   * **트릭이 만든 고정물 조사만 물건 이름**(`잠금장치 조사`)이고 나머지는 전부
   * `○○ 설비 확인` 이었다. **모양이 갈리는 쪽이 정확히 쓸모 있는 쪽**이라
   * 절대 규칙(유용도 비노출)을 어겼다 — 8건 중 8건. 세 내장 팔레트만 채우면
   * 이 세계에서만 남는다.
   */
  places: {
    hall: { name: '홀', fixture: '벽난로' },
    room: { name: '방', fixture: '화로' },
    away: { name: '자택', fixture: '현관 등' },
    approach: { name: '진입로', fixture: '장작더미' },
  },
  rooms: [
    { name: '부엌', fixture: '아궁이' },
    { name: '서재', fixture: '문서함' },
    { name: '창고', fixture: '공구함' },
    { name: '복도', fixture: '괘종시계' },
    { name: '지하실', noWindow: true, fixture: '보일러' },
    { name: '작업실', fixture: '작업 선반' },
    { name: '다락', fixture: '낡은 트렁크' },
    { name: '뒤뜰', fixture: '장독대' },
  ],
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
  /**
   * ★ 공간 계약 ★ (2026-07-29 신설)
   *
   * **트릭은 이름표가 아니라 계약이다** — 이 파일이 물증·조사·격자에 대해서는
   * 그 규칙을 지켜왔는데 **공간만 계약 밖이었다.** 그래서 `staged_suicide` 가
   * *"창을 넘어 나갔다"* 고 말하는 사건 **전부**에서 현장에 창이 없었다(창이
   * 상수 좌표라 늘 엉뚱한 방에 있었다). 트릭이 말한 것이 도면에 없으면 그것은
   * 이름표일 뿐이다.
   *
   * 여기 적힌 것을 아래 §도면이 반드시 만족시키고, 검증기 §9-3 이 대조한다.
   */
  space?: {
    /** 현장에 창이 있어야 한다 — 창으로 빠져나갔다고 말하는 트릭 */
    sceneWindow?: boolean
    /** 현장 문이 잠기는 문이어야 한다 — 밀실을 주장하는 트릭 */
    sceneLocked?: boolean
  }
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
        verb: 'fixture', target: { kind: 'fixture', id: 'room' },
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
    space: { sceneWindow: true },   // 넘어갈 창이 도면에 실재해야 한다
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
        verb: 'fixture', target: { kind: 'fixture', id: 'room' },
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
    space: { sceneLocked: true },    // 잠기는 문이 도면에 실재해야 한다
    props: ['e_tool'], staging: ['e_seal'],
    flaw: '안에서만 잠글 수 있었다면 왜 열쇠가 바깥에 있었는가',
    evidence: [
      { id: 'e_seal', description: '안쪽에서 걸린 잠금', record: '잠금장치가 안쪽으로 걸려 있었다.', isStaging: true },
      { id: 'e_gap', description: '문틀의 틈', record: '문틀 아래쪽에 손가락 하나 폭의 틈이 있었다.' },
    ],
    actions: [
      { id: 'a_lock', label: '잠금장치 조사', cost: 1, gives: ['e_seal'], salience: 0.5, yield: 'solution',
        verb: 'fixture', target: { kind: 'fixture', id: 'room' },
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
        // ★ 부검은 **시신**을 겨눈다 — 방이 아니다 ★ 산장이 그렇고
      // (`mountain-lodge.yaml:665`), 앱 `targetKey` 가 부검 키를 **언제나 `body`**
      // 로 만든다(`App.jsx:1975`). 방을 겨누면 키가 `autopsy:room` 이 되어 앱이
      // 못 찾고, **산장의 하드코딩 결과문으로 떨어졌다**(2026-07-29 실측)
      verb: 'autopsy', target: { kind: 'fixture', id: 'body' },
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
        verb: 'fixture', target: { kind: 'fixture', id: 'room' },
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
  /**
   * ★ 사망 구간을 몇 칸으로 쪼갤까 ★ (1~3, 기본 1) — 2026-07-30 신설
   *
   * **손잡이가 「슬롯 수」가 아닌 이유.** 시간 축은 「모였다 → 흩어졌다 → 다시
   * 모였다」이고 **양 끝은 논리가 붙잡고 있다**: `t0` 는 프롤로그가 *"다섯이 자리에
   * 있었다"* 고 말하고 `TRICKS` 넷이 범인 t0 를 `hall` 로 두며, 마지막 칸에는 무고한
   * 넷의 배제(`f_no_*_ok` · `e_mutual` 「도착 시각 상호 일치」)가 걸려 있다.
   * 양 끝을 늘리면 다섯이 *"거기도 홀에 있었습니다"* 를 한 줄씩 더 말할 뿐이고
   * **진술만 길어지고 판단할 것은 그대로다.**
   *
   * 그래서 늘릴 수 있는 자리는 **갈리는 칸 하나**뿐이고, 그것이 사망 구간이다.
   *
   * ```
   * 1  t0 · [t1] · t2                갈림 1회 — 「구간 안에 있었나」 하나
   * 2  t0 · [t1 · t2] · t3           갈림 2회 — 각자 두 번 움직인다
   * 3  t0 · [t1 · t2 · t3] · t4      갈림 3회
   * ```
   *
   * 2 이상이면 *"10~11시엔 주방, 11~12시엔 세탁실"* 이 되어 **알리바이 대조가 실제로
   * 조합 문제가 된다.** 지금은 「구간 안에 있었나」 하나뿐이다.
   *
   * ★ **1이면 지금 나가는 사건과 한 글자도 안 바뀐다** ★ 슬롯 id 가 `t0·t1·t2`
   * 그대로이고 무고한 넷의 자리 배정도 같은 값으로 떨어진다(회귀 0 · 12건 diff 로 확인).
   *
   * ⚠ **산장의 넷째 칸은 이걸로 안 나온다.** 「새벽 3시」는 전화가 걸려온 **시점**이라
   * 사건이 필요하고, 기계는 사건을 못 만든다. 그 칸이 필요해서 4개인 것이지
   * 4개라서 좋은 게 아니다.
   */
  deathCells?: number
}

export function generateCase(seed: number, palette?: Palette, opts?: GenerateOptions): Case {
  const r = rng(seed)
  const chapters = Math.max(2, Math.min(8, Math.round(opts?.chapters ?? 5)))
  const midChapters = chapters - 2
  /**
   * ─────────────────────────────────────────────────────────────
   *  시간 축 — 슬롯 id 는 **자리로 계산한다** (2026-07-30)
   * ─────────────────────────────────────────────────────────────
   *
   * 전에는 `t0`·`t1`·`t2` 가 **글자로** 스물일곱 군데에 박혀 있었다. 사망 구간을
   * 쪼개려면 마지막 칸 id 가 `t2`→`t3`→`t4` 로 밀리므로, 읽는 쪽이 전부
   * 「몇 번째 칸인가」로 물어야 한다.
   *
   * ```
   * FIRST      t0                모임. 프롤로그가 참조한다
   * WIN[i]     t1 … tN           갈리는 칸(=사망 구간). isWindow
   * LAST       t(N+1)            다시 모임. 배제가 걸려 있다
   * ```
   *
   * `deathCells === 1` 이면 `FIRST/WIN[0]/LAST` = `t0/t1/t2` — **전과 같은 글자**다.
   */
  const deathCells = Math.max(1, Math.min(3, Math.round(opts?.deathCells ?? 1)))
  const FIRST = 't0'
  const WIN = Array.from({ length: deathCells }, (_, i) => `t${i + 1}`)
  const LAST = `t${deathCells + 1}`
  const isWin = (slot: string) => WIN.includes(slot)
  /** 시간 축 전체, 순서대로. `slots` 방출과 `slotLabel` 이 이것을 쓴다 */
  const AXIS = [FIRST, ...WIN, LAST]
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
  /**
   * 장소를 **이름과 설비 이름 두 갈래로 갈라 담는다.**
   *
   * `rooms` 와 같은 규약(맨 문자열 | `{ name, fixture }`)으로 받되, 여기서 한 번만
   * 풀어서 `places` 는 **전과 똑같이 이름의 표**로 남긴다 — 아래 열몇 군데가 그대로
   * 읽는다. 읽는 쪽을 다 고치면 `places.hall` 하나가 두 뜻을 갖게 되고, 그건
   * *"같은 사건이 두 표현으로 존재"* 하는 자리를 새로 만드는 것이다.
   */
  const PLACE_KEYS = ['hall', 'room', 'away', 'approach'] as const
  const rawPlaces = { ...DEFAULT_PALETTE.places, ...palette?.places }
  const nameOf = (v: string | PlaceSpec | undefined) => (typeof v === 'string' ? v : v?.name)
  const fixOf = (v: string | PlaceSpec | undefined) => (typeof v === 'string' ? undefined : v?.fixture)
  const places = Object.fromEntries(
    PLACE_KEYS.map((k) => [k, nameOf(rawPlaces[k]) ?? nameOf(DEFAULT_PALETTE.places![k])!]),
  ) as Record<(typeof PLACE_KEYS)[number], string>
  /** 팔레트가 준 설비 이름. 없으면 `undefined` 라 아래가 총칭으로 채운다 */
  const placeFixture = Object.fromEntries(
    PLACE_KEYS.map((k) => [k, fixOf(rawPlaces[k])]),
  ) as Record<(typeof PLACE_KEYS)[number], string | undefined>
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
    /**
     * ★ 다섯째는 2026-07-30에 **누설을 막으려고** 늘렸다 ★
     *
     * 전에는 넷이었고 `innocents.map` 이라 **범인만 소지품이 비었다.** 150건 전수로
     * 쟀더니 **150/150** — 소지품 검사가 비는 유일한 사람이 언제나 범인이었다.
     * 앱의 빈손 문구가 하필 *"이 대상은 배제해도 좋다"* 라, 다섯 번 눌러본 사람은
     * 답을 손에 쥔다(예산 11 중 5). **게이트 7단은 내내 초록이었다.**
     */
    { ev: '낡은 명함', rec: '오래 지니고 다닌 자국이 있었다.', res: '소지품에서 낡은 명함 한 장이 나왔다.', s: 0.65 },
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
  const tRaw = TRICKS[TRICK_KEYS[Math.floor(rng(seed ^ 0x5bf03635)() * TRICK_KEYS.length)]](culprit)
  /**
   * ★ 아키타입의 3칸 선언을 **축 전체로 늘린다** ★ (2026-07-30)
   *
   * `TRICKS` 는 모듈 레벨이라 `WIN`·`LAST` 를 못 본다. 그래서 다섯 아키타입은
   * 계속 `t0`·`t1`·`t2` 로 **자리의 뜻**(모임 · 갈림 · 다시모임)을 선언하고,
   * 여기서 한 번 늘린다 — **읽는 쪽 여섯 군데는 늘어난 배열만 본다.**
   *
   * ⚠ **갈림 칸을 그대로 반복한다.** 「사망 구간 안에서 범인이 어떻게 움직이나」는
   * 아키타입마다 다시 정의해야 하는 **저작**이고(특히 `delayed_mechanism` 은 t0
   * 까지 거짓말한다), 기계가 지어내면 트릭의 논리가 무너진다. 반복은 *"구간 내내
   * 거기 있었다"* 는 뜻이라 다섯 아키타입 전부에서 참이다.
   *
   * ★ **모양으로 안 튄다** ★ 범인이 창 내내 제자리인 것은 **그림자도 같다**
   * (`shadowPresence` 가 범인의 주장을 그대로 따라간다). 갈리는 것은 나머지 셋이고,
   * 「제자리 둘 · 움직임 셋」은 `deathCells === 1` 에서도 이미 그 모양이었다 —
   * 둘 중 누가 거짓인지는 **물증으로만** 갈린다.
   *
   * `deathCells === 1` 이면 입력과 **같은 배열**이 나온다(회귀 0).
   */
  const expandCells = (cells: Cell[]): Cell[] => {
    const at = new Map(cells.map((c) => [c.slot, c.location]))
    return [
      { slot: FIRST, location: at.get('t0')! },
      ...WIN.map((s) => ({ slot: s, location: at.get('t1')! })),
      { slot: LAST, location: at.get('t2')! },
    ]
  }
  const t = {
    ...tRaw,
    presence: expandCells(tRaw.presence),
    claim: expandCells(tRaw.claim),
    // 빠져나간 시점은 **갈림의 마지막 칸**이다 — 그 뒤 `LAST` 에는 홀에 있다
    ...(tRaw.exit ? { exit: { ...tRaw.exit, slot: WIN[WIN.length - 1]! } } : {}),
  }

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
   *  부지 — **격자가 아니라 건물이다** (2026-07-29 오후 재작성)
   * ─────────────────────────────────────────────────────────────
   *
   * 여기 있던 것은 **방 여덟 + 부지 밖 하나**였고, 그 여덟이 도면을 격자로
   * 묶어두고 있었다. 사용자: *"현장의 비주얼이나 위치의 정교함 등은
   * 산장살인사건 등을 따라야 되는데?"*
   *
   * **왜 여덟이었나 — 방 개수가 조사 수를 떠받치고 있었다.** 「조사 대상 ≥ 예산
   * 3배」(검증기 §8)를 방으로 채웠다. 그런데 2026-07-29 오전에 알리바이 10쌍·
   * 피해자 조사 2·인물 12가 열리면서 **그 짐이 필요 없어졌다.** 산수로 확인:
   *
   * ```
   * 방 8 (옛것)   조사 45 / 예산 10 = 4.5배
   * 방 3 + 진입로  조사 37 / 예산 10 = 3.7배   ← 지금. 여유가 그대로 있다
   * ```
   *
   * ★ **그리고 방 수 ≠ 장소 수다** ★ 산장은 방이 넷인데 장소는 셋이다 —
   * 거실과 부엌이 **같은 `loc: main`** 을 가리킨다(`mountain-lodge.yaml` 159·160행).
   * 도면의 풍성함과 조사 수가 애초에 묶여 있지 않았다. 그것을 몰라서 여덟이 됐다.
   *
   * **이제 자리마다 제 크기와 제 건물을 갖는다.** 아래 `SITES` 가 그 표이고,
   * 도면의 방·구역·문·창·고정물·보행선이 전부 여기서 나온다.
   */
  /** 팔레트가 문자열로 줘도, 성질을 붙여 줘도 받는다 */
  const asRoom = (r: string | RoomSpec): RoomSpec => (typeof r === 'string' ? { name: r } : r)
  const extraRooms: RoomSpec[] = [...(P.rooms ?? [])].map(asRoom)
  // 넷째가 **딸린 방**(`SUBROOMS`)의 이름이 된다 — 셋에서 멈추면 그 자리가 빈다
  for (const d of DEFAULT_PALETTE.rooms) {
    if (extraRooms.length >= 4) break
    const n = asRoom(d)
    if (!extraRooms.some((r) => r.name === n.name)) extraRooms.push(n)
  }
  type Rect = { x: number; y: number; w: number; h: number }
  type Site = {
    id: string; label: string
    scene?: boolean; noWindow?: boolean; fixture?: string
    /** 도면 위 자리. **격자 계산이 아니라 저작된 좌표다** */
    rect: Rect
    /** 실내면 어느 건물인가. 없으면 실외 구역(`zones`) */
    building?: string
    /** 실외 구역의 성질 */
    hatch?: boolean; offsite?: boolean
    /**
     * 본채에서 **걸어서 몇 분**인가. 본채 안의 방에는 없다.
     *
     * ★ 도면과 진술이 이 한 값을 같이 읽는다 ★ 전에는 보행선이 도면에만 있는
     * 상수(12분)였고 **진술은 그런 숫자가 있는 줄도 몰랐다.** 산장에서는 세라가
     * *"걸어서 10분"* 이라고 **말하고**, 사망 추정 구간이 다섯 시간이라 왕복이
     * 가능한지를 플레이어가 잰다. 숫자가 도면에만 있으면 잴 것이 없다.
     */
    walkMin?: number
  }
  /**
   * ★ 건물 도면 ★ — 산장(`mountain-lodge.yaml` §floor_plan)의 배치를 따른다.
   *
   * ```
   *      x=70        330            602      712      940
   * y=60 ┌──────────┬──────────────┐         ┌────────┐
   *      │          │     홀        │         │  별채   │ ← 1장 완성 후 나타난다
   *      │          │  272×200     │         │ 228×150│
   *      │   현장    ├──────────────┤ 정문     └────────┘
   *      │  260×485 │    방1        │  ⇢ 10분
   *      │  ★ 가장  │  272×150     │         ┌────────┐
   *      │    크다   ├──────────────┤         │자택(밖) │
   *      │          │    방2        │         └────────┘
   *      │          │  272×135     │ 후문     ┌────────┐
   * y=545└──────────┴──────────────┘  ⇢ 2분   │ 진입로  │
   * ```
   *
   * **다섯이 전부 다른 크기다.** 현장은 126,100 이고 나머지는 30,780~54,400 이라
   * 도면을 열자마자 어디가 사건의 중심인지 보인다 — 산장이 그렇게 생겼다.
   */
  const [x1, xr, xa] = [70, 330, 712] as const
  /**
   * ⚠ **차례는 옛것 그대로 둔다**(hall 먼저). 자리는 이제 `rect` 가 정하므로
   * 배열 순서는 도면과 무관하지만, `locations` 가 이 순서로 나가고 **07-29에
   * 인물 순서를 바꿨다가 색이 뒤바뀐 전례**가 있다. 안 건드린다.
   */
  const SITES: Site[] = [
    { id: 'hall', label: places.hall!, fixture: placeFixture.hall, building: 'b_main', rect: { x: xr, y: 60, w: 272, h: 170 } },
    // ★ 현장은 팔레트 방이 아니라 `places.room` 이다 ★ 그래서 `noWindow` 가 붙을 수
    // 없고, 트릭이 창을 요구해도 항상 만족시킬 수 있다(아래 §공간 계약)
    { id: 'room', label: places.room!, fixture: placeFixture.room, scene: true, building: 'b_main', rect: { x: x1, y: 60, w: 260, h: 485 } },
    ...extraRooms.slice(0, 3).map((r, i) => ({
      id: `loc${i + 1}`, label: r.name, noWindow: r.noWindow, fixture: r.fixture,
      // 셋째 방은 **별채**다 — 1장을 완성해야 도면에 나타나고, 걸어서 10분이다
      building: i === 2 ? 'b_annex' : 'b_main',
      ...(i === 2 ? { walkMin: 10 } : {}),
      rect: [
        { x: xr, y: 360, w: 272, h: 105 },
        { x: xr, y: 465, w: 272, h: 80 },
        { x: xa, y: 66, w: 228, h: 150 },
      ][i]!,
    })),
    // 실외 구역 둘. 진입로는 부지 안이고(`atLodge`) 자택은 밖이다
    { id: 'approach', label: places.approach!, fixture: placeFixture.approach, hatch: true, walkMin: 2, rect: { x: xa, y: 430, w: 228, h: 140 } },
  ]
  /**
   * ─────────────────────────────────────────────────────────────
   *  딸린 방 — **장소를 안 늘리고 방만 늘린다** (2026-07-29)
   * ─────────────────────────────────────────────────────────────
   *
   * ★ 산장은 방이 넷인데 실내 장소가 셋이다 ★ 거실과 부엌이 **같은 `loc: main`**
   * 을 가리킨다(`mountain-lodge.yaml` 159·160행). 그래서 도면은 풍성한데 조사는
   * 안 늘어난다.
   *
   * 앞선 커밋에서 이 사실을 **찾아서 방을 여덟에서 셋으로 줄이는 근거로 썼지만
   * 정작 쓰지는 않았다.** 여기가 그 레버다 — 방 하나가 더 생기고 조사는 그대로다:
   *
   * ```
   * 방 5 → 6      조사 37 → 37 (그대로)      장소 7 → 7 (그대로)
   * ```
   *
   * **딸린 방은 `primary` 가 아니다.** 앱이 `primary` 인 방에 조사 실행 상자를
   * 매달므로(`anchorByLoc`), 한 장소에 상자가 둘 생기지 않는다. 그러나 두 방 다
   * 같은 `loc` 이라 **수색하면 둘 다 「빈손」/「물증」으로 같이 바뀐다** — 같은
   * 곳이니 맞다(산장이 그렇게 동작한다).
   *
   * ⚠ **고정물은 장소마다 하나 그대로다.** 딸린 방에는 설비가 없다 — 산장의
   * 부엌에도 없고 거실에만 금고가 있다. 균일성은 **장소 단위**로 지킨다.
   */
  type SubRoom = { id: string; loc: string; label: string; rect: Rect; building: string; noWindow?: boolean }
  const SUBROOMS: SubRoom[] = [
    {
      id: 'r_hallside', loc: 'hall', building: 'b_main',
      // 팔레트의 넷째 방 이름. 없으면 기본 팔레트가 채운다(`extraRooms` 가 늘 8개 이상)
      label: extraRooms[3]?.name ?? '부엌',
      noWindow: extraRooms[3]?.noWindow,
      rect: { x: xr, y: 230, w: 272, h: 130 },
    },
  ]
  /**
   * 본채에서 떨어진 자리들 — 보행선과 진술의 거리 문구가 **같이** 여기서 나온다.
   * 좌표는 나가는 문(정문·후문)에 맞춰 저작한다.
   */
  const OUTLYING: { site: Site; y: number }[] = [
    { site: SITES.find((s) => s.walkMin === 10)!, y: 140 },   // 정문 → 별채
    { site: SITES.find((s) => s.id === 'approach')!, y: 508 }, // 후문 → 진입로
  ]
  /** 실내 방만. 문·창은 여기서만 나온다 */
  const rooms = SITES.filter((s) => s.building)
  const onSite = SITES
  const locIds = [...SITES.map((l) => l.id), 'away']

  /**
   * ⛔ **여기 있던 격자 계산(`ROWS`·`HALLWAY`·`CW`·`RH`·`cell`·`leftCol`)이
   * 사라졌다.** 중복도 2열이 「방 열 개를 어떻게든 담는」 답이었는데, 방을 셋으로
   * 줄이자 담을 것이 없어졌다. 이제 자리는 위 `SITES` 의 `rect` 가 직접 말한다.
   *
   * 격자를 두 번 고쳤던 기록은 남긴다 — 5열×2행은 칸 폭이 124(화면 ~62px)라
   * **방 이름이 한 글자씩 세로로 깨졌고**, 2열 중복도로 폭을 280 으로 넓혀
   * 그것을 고쳤다. 둘 다 **방이 여덟이라는 전제** 위에 있었고, 그 전제가 틀렸다.
   */
  /*
   * ⛔ 여기 `namedFixtures = onSite.every(l => !!l.fixture)` 가 있었다 —
   * 「전원이 고유 이름을 갖거나 전원이 총칭이거나」로 못박았던 것인데 **과했다.**
   *
   * `hall`·`room` 은 팔레트 방이 아니라(`places` 에서 온다) 설비 이름을 가질
   * 길이 없어서, 규칙이 **언제나** 전부를 총칭으로 되돌렸다. 팔레트가 아무리
   * 잘 써 와도 화면에 안 나타난다.
   *
   * > **길은 2026-07-29 밤에 뚫렸다** — `places` 가 `{ name, fixture }` 를 받는다.
   * > 그래도 **전원/전무를 되살리지 않는다**: 아래 ★ 문단의 근거(팔레트는 사건을
   * > 모른다)는 길이 생긴 것과 무관하게 그대로다. 섞여도 된다.
   *
   * ★ 그리고 지문·서사와 달리 여기는 균일할 필요가 없다 ★ **팔레트는 사건을
   * 모른다** — 어느 방이 현장이 될지, 트릭이 무엇일지 모르는 채로 세계를 짓는다.
   * 그래서 설비 이름은 트릭·범인과 **상관될 수가 없다.** 가마실에 가마가 있는 것은
   * 정보가 아니라 질감이다. 균일성이 필요한 것은 **사건을 아는 층**(인물의 지문·
   * 장 서사)이고, 세계 어휘는 그 층이 아니다.
   */

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

  /**
   * 사망 구간 칸별 이름표.
   *
   * **한 칸이면 `t1` 을 그대로 쓴다** — 접미가 안 붙으므로 전과 같은 글자다.
   * 두 칸 이상이면 팔레트의 `times.window` 를 먼저 보고, 없으면 「(전반)·(중반)·
   * (후반)」을 붙여 만든다. 이 접미를 고른 이유는 **어느 명사에 붙여도 뜻이
   * 서기 때문**이다(「야간 순찰 시간 (전반)」) — 「이른/늦은」은 「새벽」에는
   * 붙지만 「야간 순찰 시간」에는 안 붙는다.
   *
   * ⚠ 기계가 지은 어휘이므로 검증기가 경고한다. 팔레트가 적어주는 것이 낫다.
   */
  const HALVES: Record<number, string[]> = { 2: ['전반', '후반'], 3: ['전반', '중반', '후반'] }
  const winLabels = WIN.map((_, i) => {
    const authored = times.window?.[i]
    if (authored) return authored
    if (deathCells === 1) return times.t1!
    return `${times.t1!} (${HALVES[deathCells]![i]!})`
  })
  const slotLabel: Record<string, string> = {
    [FIRST]: times.t0!,
    ...Object.fromEntries(WIN.map((s, i) => [s, winLabels[i]!])),
    [LAST]: times.t2!,
  }
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
  /**
   * 감출 것을 **문장에 얹을 꼴로 맞춘다.** (2026-07-29 밤)
   *
   * ★ 조사가 글자로 박혀 있었다 ★ 틀이 `${secret}은` 이었다. 내장 팔레트의
   * `secrets` 는 전부 **「…다는 것」**으로 끝나서 「…것은」이 되니 멀쩡했는데,
   * 서식은 이 칸을 *"각자 감추는, 사건과 무관한 창피한 사실"* 이라고만 적어둔다 —
   * **「사실」이라고 하면 챗봇은 문장으로 써 온다.** 사용자 팔레트가 실제로 그랬고
   * 다섯 명 전원의 마지막 문단이 이렇게 나갔다:
   *
   * ```
   * 몰래 도박에 손을 대고 있다은 이 일과 상관없는 일이라, …
   * 이력서의 경력을 부풀렸다은 …
   * ```
   *
   * **07-29 오전의 「남겨진 쪽지이」·「1층 공동 라운지을」과 같은 부류다** —
   * 그때는 서술문이었고 이번은 진술이다. 내장 팔레트로만 재면 안 드러난다.
   *
   * 세 꼴을 받는다: 「…것」(명사구) · 「…다」(문장) · 그 밖의 명사구.
   *
   * ⚠ **꼴은 「…을/를」이다** — 진술이 아니라 **소지품 검사 결과문**에 들어가기
   * 때문이다(2026-07-30에 자리를 옮겼다. 아래 §비밀은 조사로 드러난다 참조).
   */
  const secretObject = (raw: string) => {
    const s = raw.trim().replace(/[.·]+$/, '')
    if (/것$/.test(s)) return `${s}을`         // 「…했다는 것」 → 「…것을」
    if (/다$/.test(s)) return `${s}는 것을`     // 「…대고 있다」 → 「…있다는 것을」
    // 그 밖의 명사구는 받침으로 가른다 — `subjectParticle` 과 같은 셈법
    const ch = s.charCodeAt(s.length - 1) - 0xac00
    if (ch < 0 || ch > 11171) return `${s}을`
    return `${s}${ch % 28 === 0 ? '를' : '을'}`
  }

  /**
   * ★ 비밀은 **진술에서 말하지 않는다 — 조사로 드러난다** ★
   * (2026-07-30 · 사용자 지적 · 레퍼런스 대조로 확인)
   *
   * 전에는 진술 마지막 문단이 이랬다:
   *
   * ```
   * 이력서를 부풀렸다는 것은 이 일과 상관없는 일이라, 말씀드리고 싶지 않습니다.
   * ```
   *
   * **셋이 한꺼번에 틀렸다.** ① 다섯 명이 **글자까지 같았다**(틀이 하나였다).
   * ② **내용을 전부 말해놓고** 「말씀드리고 싶지 않습니다」로 끝난다 — 이미 다 말했다.
   * ③ **제목의 규칙을 뒤집는다** — *"다만 자기 비밀은 **말하지 않는다**"* 이지
   * 「말하지 않겠다고 말한다」가 아니다.
   *
   * ★ 골든 케이스가 답을 갖고 있었다 ★ **산장 진술에 감춤 선언은 0/5**다. 아무도
   * 그런 말을 하지 않고, 대신 **소지품 검사가 그 사람의 비밀을 드러낸다**
   * (`a_yuri → 약물 투약 흔적` · redherring). 여기도 그 모양으로 옮겼다 —
   * 진술은 침묵하고, 비밀은 아래 §HERRING 의 소지품 결과문에서 나온다.
   *
   * 문단은 **넷에서 셋으로** 줄었다(축의 칸 + 도입구). 다섯 전원이 같이 줄므로
   * §9-9(길이 쏠림)는 흔들리지 않는다.
   */
  const statementOf = (
    cells: { slot: string; location: string }[],
    opener: string,
  ) => {
    const at = new Map(cells.map((x) => [x.slot, x.location]))
    /**
     * ★ 안 움직인 사람이 **같은 문장을 세 번** 말하고 있었다 ★
     * (2026-07-30 · 사용자가 화면에서 잡았다)
     *
     * ```
     * 전날 밤에는 홀에 있었습니다.
     * 새벽에는 홀에 있었습니다.      ← 글자까지 같다
     * 아침에는 홀에 있었습니다.      ← 또 같다
     * ```
     *
     * 자리가 **바뀌었는지**를 보고 문장을 고른다. 데이터는 한 글자도 안 바뀌고
     * 정보량도 그대로다 — 제자리인지 아닌지는 **전에도 글자로 다 보였다**
     * (「홀·홀·홀」). 읽는 결만 고친다.
     *
     * ⚠ **문단 수는 안 건드린다** — 묶어서 줄이면 「안 움직인 사람만 짧다」가 되고
     * 그 모양이 곧 범인 쪽 표시다(§9-9 · 아래 §축의 칸마다 한 문단).
     *
     * ⚠ **변수 뒤 조사를 안 쓴다** — 자리 이름이 팔레트에서 오므로 끝 글자를
     * 모른다. 「…로/으로」를 피해 「자리를 옮겨 …에」로 쓴다.
     */
    const line = (s: string, first: boolean, prevLoc?: string, nth = 0) => {
      const loc = at.get(s)
      /**
       * ★ 본채에서 떨어진 자리면 **얼마나 먼지 말한다** ★ (2026-07-29)
       *
       * 산장에서 세라가 *"걸어서 10분"* 이라고 말하는 그 문장이다. 사망 추정
       * 구간이 다섯 시간이면 왕복이 가능하고, **그 계산을 플레이어가 한다** —
       * §절대 규칙이 「자동 분석 일체」를 금지하므로 게임은 대조해주지 않는다.
       * 숫자가 도면에만 있으면 잴 것이 없어서, 여기서 같은 값을 인용한다.
       *
       * ⚠ **거리는 사람이 아니라 자리의 성질이다.** 한 사람만 이 문장을 받는
       * 것처럼 보이지만, 받는 조건은 「그 자리에 있었나」뿐이고 그 자리는
       * 무고한 넷에게 고르게 돌아간다(200건 실측: 별채 153 · 진입로 148).
       * 그리고 **범인의 그림자 한 사람이 범인과 같은 동선**이라, 범인이 별채를
       * 주장하면 무고한 하나도 같은 문장을 받는다 — 모양으로 안 튄다.
       */
      const far = loc ? SITES.find((x) => x.id === loc)?.walkMin : undefined
      // 자리를 안 옮겼을 때. 칸 번호로 갈라서 **연달아 같은 문장이 안 나오게** 한다
      const SAME = [
        `${slotLabel[s]}에도 같은 자리에 있었습니다.`,
        `${slotLabel[s]}까지 자리를 뜨지 않았습니다.`,
        `${slotLabel[s]}에도 그 자리를 지켰습니다.`,
      ]
      // 자리를 옮겼을 때. 여기도 갈라야 한다 — 안 그러면 「자리를 옮겨」가 네 번 나온다
      const MOVE = [
        `${slotLabel[s]}에는 자리를 옮겨 ${placeLabel[loc!]}에 있었습니다.`,
        `${slotLabel[s]}에는 ${placeLabel[loc!]}에 가 있었습니다.`,
        `${slotLabel[s]}에는 ${placeLabel[loc!]}으로 옮겼습니다.`.replace(/([가-힣])으로 옮겼습니다/, (_m, ch) =>
          // 「…로/으로」는 받침으로 갈린다 — 자리 이름이 팔레트에서 오므로 여기서 센다
          (ch.charCodeAt(0) - 0xac00) % 28 === 0 ? `${ch}로 옮겼습니다` : `${ch}으로 옮겼습니다`,
        ),
      ]
      const body = !loc
        ? `${slotLabel[s]}에는 그곳에 없었습니다.`
        : loc === prevLoc
          ? SAME[nth % SAME.length]!
          : (first ? `${slotLabel[s]}에는 ${placeLabel[loc]}에 있었습니다.` : MOVE[nth % MOVE.length]!) +
            (far ? ` ${places.hall}에서 걸어서 ${far}분 거리입니다.` : '')
      return { ko: first ? `${opener} ${body}` : body }
    }
    return [
      /**
       * **축의 칸마다 한 문단.** 다섯이 같은 개수를 받는다 — 위 주석의
       * *"문단 수가 곧 범인 표시가 된다"* 를 칸 수가 늘어도 지킨다
       * (§9-9 진술 길이 쏠림도 같은 이유로 안 흔들린다).
       */
      ...AXIS.map((s, i) => line(s, i === 0, i > 0 ? at.get(AXIS[i - 1]!) : undefined, i)),
      // ⛔ **여기에 「감추는 것이 있다」 문단을 다시 넣지 마라.** 그것이 제목의 규칙을
      // 뒤집는다 — 비밀은 말하지 않는 것이지 말하지 않겠다고 말하는 것이 아니다.
      // 산장 진술 5편에 그런 문장은 0개다. 비밀은 소지품 검사가 드러낸다(§HERRING).
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
    /**
     * 현장(room)과 홀을 뺀 자리들 — 방 셋(별채 포함) + 진입로 = **넷**.
     *
     * ⚠ **넷 중 셋만 여기서 뽑는다**(`k=0` 은 아래 `shadowPresence`). 방을 여덟에서
     * 셋으로 줄일 때 **여기가 첫 번째 지뢰였다** — 아래 `innocentRooms[(k-1) % len]`
     * 이 모듈러라 터지지는 않지만 **풀이 셋보다 작으면 두 사람이 같은 방을 받고**,
     * 그 순간 「넷의 동선이 서로 다르다」가 깨진다(2026-07-29 오전에 200건을
     * 세어보고서야 잡았던 바로 그 결함). 진입로가 풀에 드는 것이 여유분이다.
     */
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
    isWin(c.slot) && c.location === 'room' ? { ...c, location: 'hall' } : { ...c },
  )
  /**
   * ★ 나머지 셋은 **창의 칸마다 자리를 옮긴다** ★ (2026-07-30)
   *
   * 회전(rotation)으로 배정한다 — 사람 `k`, 칸 `i` 에 `pool[(k-1+i) % len]`.
   * 이 한 줄이 두 조건을 **동시에** 만족한다:
   *
   * ```
   * 같은 칸의 셋이 서로 다른가   pool[i], pool[i+1], pool[i+2]  → 풀 ≥ 3 이면 참
   * 한 사람이 실제로 움직이나    pool[k-1], pool[k], pool[k+1]  → 칸 수 ≤ 풀 크기면 참
   * ```
   *
   * 풀은 방 셋 + 진입로 = **넷**이고 칸은 최대 셋이라 둘 다 언제나 선다.
   * `deathCells === 1` 이면 `i = 0` 뿐이라 **전과 같은 `pool[k-1]`** 이다(회귀 0).
   *
   * ⚠ **한 칸에 두 사람이 같은 방을 받으면** 「넷의 동선이 서로 다르다」가 깨진다 —
   * 2026-07-29 오전에 방을 여덟에서 셋으로 줄이며 실제로 밟은 지뢰이고, 회전이
   * 모듈러라 **터지지 않고 조용히** 깨지는 자리다. 그래서 위 두 줄이 부등식이다.
   */
  const innocentPresence = (id: PersonId) => {
    const k = innocents.indexOf(id)
    if (k === 0) return shadowPresence
    return [
      { slot: FIRST, location: 'hall' },
      ...WIN.map((s, i) => ({
        slot: s,
        location: innocentRooms[(k - 1 + i) % innocentRooms.length]!,
      })),
      { slot: LAST, location: 'hall' },
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
  /**
   * 프로필 카드의 **「본인 주장」** 한 줄. (2026-07-29 밤 신설)
   *
   * ★ 없어서 카드에 빈칸이 떴다 ★ 산장은 다섯 다 `claim_summary` 를 갖는데
   * 생성기가 안 냈고, `applyCase` 는 **같은 인물일 때만** 앱 문안을 물려주므로
   * (`claimKo: ko(p.claimSummary) || (same ? slot.claimKo : '')`) 생성 인물은
   * 빈 문자열이 됐다. 첫 실플레이에서 사용자가 찾았다.
   *
   * ⚠ **새 사실을 만들지 않는다.** 진술 둘째 문단이 이미 말하는 것을 한 줄로
   * 줄인 것뿐이다 — 그래서 누설이 아니다. `t1` 만 말한다: t0·t2 는 다섯이 전부
   * 같은 곳이라(모였다 → 흩어졌다 → 다시 모였다) 요약에 넣으면 다섯 줄이 글자까지
   * 같아진다.
   *
   * ⚠ **범인도 같은 틀을 쓴다** — 범인은 `claim`(거짓), 나머지는 `presence`(참)를
   * 요약하므로 **문장의 모양은 다섯이 같다.** 여기서 갈리면 그게 곧 범인 표시다.
   */
  const claimSummaryOf = (cells: { slot: string; location: string }[]) => {
    const at = new Map(cells.map((c) => [c.slot, c.location]))
    /**
     * **창의 칸을 전부 말한다.** 한 칸이면 전과 같은 한 문장이고(회귀 0), 두 칸
     * 이상이면 *"…에는 …에, …에는 …에 있었다고 진술."* 이 된다.
     *
     * ⚠ 앞뒤 칸(`FIRST`·`LAST`)은 여전히 뺀다 — 다섯이 전부 같은 곳이라
     * 넣으면 **다섯 줄이 글자까지 같아진다.**
     */
    const parts = WIN.map((s) => {
      const loc = at.get(s)
      return `${slotLabel[s]}에는 ${placeLabel[loc!] ?? loc}에`
    })
    return { ko: `${parts.join(', ')} 있었다고 진술.` }
  }

  const person = (id: PersonId, i: number) => ({
    id,
    name: names[i],
    age: 27 + Math.floor(r() * 12),
    job: pick(jobs),
    hiddenRole: id === culprit ? ('ringleader' as const) : ('unaware' as const),
    presence: id === culprit ? t.presence : innocentPresence(id),
    // 거짓말은 범인만. 무고한 사람은 claim 을 적지 않는다(= presence 와 같다)
    ...(id === culprit ? { claim: t.claim } : {}),
    claimSummary: claimSummaryOf(id === culprit ? t.claim : innocentPresence(id)),
    statement: {
      // 진술에서 말하는 것은 주장이다 — 범인은 claim, 나머지는 presence
      paragraphs: statementOf(
        id === culprit ? t.claim : innocentPresence(id),
        openerOf(i),
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
      // ★ 부검은 **시신**을 겨눈다 — 방이 아니다 ★ 산장이 그렇고
      // (`mountain-lodge.yaml:665`), 앱 `targetKey` 가 부검 키를 **언제나 `body`**
      // 로 만든다(`App.jsx:1975`). 방을 겨누면 키가 `autopsy:room` 이 되어 앱이
      // 못 찾고, **산장의 하드코딩 결과문으로 떨어졌다**(2026-07-29 실측)
      verb: 'autopsy', target: { kind: 'fixture', id: 'body' },
      result: res('같은 폭의 자국', '같은 폭으로 눌린 자국이 남아 있었다.') },
    { id: 'a_papers', label: '서류 조사', cost: 1, gives: ['e_alias', 'e_motive'], salience: 0.3, yield: 'solution',
      verb: 'search', target: { kind: 'location', id: 'hall' },
      result: res('반복되는 이름', '여러 장에 같은 이름과 금전 기록이 적혀 있었다.') },
    { id: 'a_ledger', label: '장부 조사', cost: 1, gives: ['e_alias2'], salience: 0.3, yield: 'solution',
      verb: 'search', target: { kind: 'location', id: 'hall' },
      result: res('두 번째 기록', '장부에 같은 이름이 한 번 더 적혀 있었다.') },
    /**
     * 레드 헤링 — **다섯 전원.** salience 를 해답보다 높게.
     *
     * ⚠ **`innocents` 를 쓰면 안 된다** — 그러면 범인만 소지품이 비고, 그 빈자리가
     * 곧 정답이다(2026-07-30 실측 150/150). 범인도 사건과 무관한 것 하나를 갖는다 —
     * 서식이 *"감추는 것은 다섯 명 전원이 하나씩, **범인도 포함**"* 이라고 이미
     * 요구하던 것이고, 산장도 다섯 전원의 소지품에서 무언가가 나온다.
     *
     * HERRING 배정이 `ids` 순서라 범인이 특정 salience 에 고정되지 않는다
     * (범인 인덱스 분포 150건 실측: 18.7/16.7/17.3/27.3/20.0%, χ² p≈0.24).
     */
    ...ids.map((id, i) => ({
      id: `a_h${i + 1}`, label: `소지품 검사 · ${names[ids.indexOf(id)]}`, cost: 1,
      gives: [`e_herring${i + 1}`], salience: HERRING[i].s, yield: 'redherring' as const,
      verb: 'belongings' as const, target: { kind: 'person' as const, id },
      /**
       * ★ 여기가 비밀이 드러나는 자리다 ★ (2026-07-30에 진술에서 옮겨 왔다)
       *
       * 제목은 **물건**, 본문은 **물건 + 그 사람의 비밀**이다. 산장이 그 모양이고
       * (`a_yuri → 약물 투약 흔적`), 진술은 비밀에 대해 **한 마디도 안 한다.**
       *
       * `secretOf(i)` 의 `i` 가 `person(id, i)` 와 **같은 축(`ids`)**이라 사람과
       * 비밀이 어긋나지 않는다. 조사(助詞)는 `secretObject` 가 붙인다 —
       * 팔레트가 「…것」·「…다」·명사구 세 꼴로 오기 때문이다.
       */
      result: res(HERRING[i].ev, `${HERRING[i].res} ${secretObject(secretOf(i))} 확인했다.`),
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
      /**
       * ⚠ **`kind` 를 보고 선호를 정하지 않는다** (2026-07-29).
       *
       * 전에는 `kind === 'location'` 일 때만 원래 대상을 선호 목록에 넣었다.
       * 고정물 조사의 kind 를 `fixture` 로 바로잡자 **선호가 빈 배열이 되어**
       * 현장(`room`)을 지키지 못하고 남은 첫 자리(`hall`)를 집었다 — 트릭이
       * 현장의 설비를 조사하는 것이었는데 엉뚱한 방으로 밀려났다(40건 중 29건).
       *
       * 그리고 **원래 `kind` 를 유지한다.** 여기서 `location` 으로 되쓰면
       * 고정물 조사가 다시 장소 조사로 둔갑해 §9-4 의 짝 검사가 빗나간다.
       */
      const kind = a.target?.kind === 'fixture' ? 'fixture' as const : 'location' as const
      const got = claimLoc(verb, a.target ? [a.target.id] : [])
      return got ? { ...a, verb: got.verb as Act['verb'], target: { kind, id: got.id } } : a
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
  /**
   * 고정물 이름표. **고정물 조사의 이름을 여기서 짓는다.**
   *
   * ★ 골든 케이스가 그렇게 한다 ★ `화로 조사`→`hearth` · `원고 조사`→`safe` —
   * **방이 아니라 물건**의 이름으로 짓는다. 생성기는 `${장소} 설비 확인` 으로
   * 지어왔는데, 팔레트가 설비 이름을 줄 수 있게 된 지금 그러면 **이름이 도면에만
   * 남고 조사 목록에서는 사라진다.**
   *
   * ⚠ **그리고 이건 절대 규칙 문제였다** (2026-07-29 밤 실측 · 36건 전부).
   * 트릭이 만든 고정물 조사는 `잠금장치 조사` 처럼 **물건 이름**인데 빈손은 전부
   * `○○ 설비 확인` 이었다 — **모양이 갈리는 쪽이 정확히 쓸모 있는 쪽**이라
   * *"결정적 단서와 레드 헤링이 완전히 동일하게 생겨야 함"* 을 어겼다.
   * 이름을 물건으로 통일하면 그 갈림이 사라진다.
   */
  const fixLabel = new Map(onSite.map((l) => [l.id, l.fixture]))
  fixLabel.set('away', placeFixture.away)
  const empties: Act[] = []
  const addEmpty = (verb: Act['verb'], kind: 'location' | 'person' | 'fixture', id: string, text: string) => {
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
  /**
   * ⚠ **`kind` 는 `fixture` 다** (2026-07-29). 전에는 `location` 이었다 — verb 는
   * 고정물인데 kind 는 장소라, §9-4 의 양방향 검사가 **둘 다 빗나갔다**:
   * 정방향은 장소 풀로 검사돼 통과하고, 역방향(`fixture:<id>` 로 겨눈 조사가
   * 있는가)은 짝을 못 찾았다. 그 사이로 「도달 불가 조사 11개」가 지나갔다.
   */
  // 이름이 있으면 물건으로 짓는다 — 위 §고정물 이름표 참조. 없을 때만 총칭으로 내려간다
  for (const id of locIds) {
    const fx = fixLabel.get(id)
    addEmpty('fixture', 'fixture', id, fx ? `${fx} 조사` : `${label.get(id)} 설비 확인`)
  }
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
  /**
   * 이름 뒤의 「은/는」. 위와 **같은 셈법**이다 — 받침이 있으면 `은`, 없으면 `는`.
   *
   * ★ 없어서 프롤로그가 글자로 박고 있었다 ★ (2026-07-30 실측)
   *
   * `${victimName}은` 이 두 군데 있었고, 피해자 이름이 모음으로 끝나면
   * **「문세라은 이미 숨을 쉬지 않았다」**가 나왔다. 40건을 뽑아 세었더니
   * 이름이 모음으로 끝나는 사건이 **여럿**이었고, 프롤로그는 **모든 사건이
   * 반드시 보여주는 첫 화면**이라 노출이 100%다.
   *
   * 07-29 밤에 닫은 「~다은」과 **같은 부류**다(조사를 갈리지 않는 것으로 착각).
   * 그때는 조사 오류 문안이었고 이번엔 프롤로그다 — `subjectParticle` 이 이미
   * 옆에 있었는데 **은/는 짝이 없어서** 안 쓰였다.
   */
  const topicParticle = (word: string) => {
    const ch = word.charCodeAt(word.length - 1) - 0xac00
    if (ch < 0 || ch > 11171) return '은'
    return ch % 28 === 0 ? '는' : '은'
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  ★ 사망 구간 축소 — 부검이 시간에 대해 말하게 한다 ★ (2026-07-30)
   * ─────────────────────────────────────────────────────────────
   *
   * 산장은 `narrows_window: [t1, t2]` 를 갖는다(YAML 1077행). 생성기는 안 냈고,
   * 07-30에 앱의 축소를 **선언 기반**으로 바꾸면서 생성 사건은 축소가 **아예
   * 없어졌다.** 그 자리를 되살린다 — 시간을 다루는 유일한 조사가 시간에 대해
   * 침묵하고 있었다.
   *
   * ⚠ **`deathCells === 1` 이면 안 낸다.** 칸이 하나면 좁힐 데가 없다. 기본값이
   * 1이라 **지금 나가는 사건은 한 글자도 안 바뀐다**(회귀 0 — diff 로 증명한다).
   *
   * 범위는 **마지막 칸을 뺀 것**이다. 남는 칸이 하나면 앱이 그 칸 이름을 그대로
   * 쓰고, 둘이면 각자 제 이름을 지킨다(같은 글자가 두 열에 겹치지 않게).
   *
   * ⚠ **조사 id 를 글자로 박지 않는다** — 부검을 내는 자리가 아키타입마다 다르다
   * (`staged_suicide` 는 `a_lividity`). `verb` 로 찾는다.
   *
   * ⚠ **조사(助詞)가 갈리는 문장을 안 쓴다** — 칸 이름이 팔레트에서 오므로 끝
   * 글자를 모른다. 「안으로」·「사이로」를 범위 쪽에 붙여 변수 뒤 조사를 없앴다.
   * (07-30의 「문세라은」과 같은 부류를 미리 막는다)
   */
  const autopsyId = allActions.find((a) => a.verb === 'autopsy')?.id
  const narrowFrom = WIN[0]!
  const narrowTo = WIN[Math.max(0, deathCells - 2)]!
  const narrowRange =
    narrowFrom === narrowTo
      ? `${slotLabel[narrowFrom]!} 안으로`
      : `${slotLabel[narrowFrom]!}에서 ${slotLabel[narrowTo]!} 사이로`
  const narrowReveals =
    deathCells >= 2 && autopsyId
      ? [
          {
            trigger: { on: 'action' as const, actionId: autopsyId },
            yield: 'narrow' as const,
            surface: 'overview' as const,
            narrowsWindow: [narrowFrom, narrowTo] as [string, string],
            narration: `부검 결과, 사망 시각이 ${narrowRange} 좁혀졌다.`,
          },
        ]
      : []

  const chapterReveals = [
    ...narrowReveals,
    {
      trigger: { on: 'chapterComplete' as const, chapterOrder: 1 },
      yield: 'path' as const,
      actions: ['a_ledger'],
      surface: 'map' as const,
      narration: `${slotLabel[LAST]}의 정황이 정리됐다. 장부가 한 권 더 있다는 것을 뒤늦게 들었다.`,
    },
    ...strands.map((_s, i) => {
      const speaker = revealSpeakers[i % revealSpeakers.length]!
      const who = names[ids.indexOf(speaker)]
      // 창의 **첫 칸**을 말한다 — 칸이 여럿이어도 이 문장은 한 순간을 가리킨다
      const loc = placeLabel[saidAt(speaker, WIN[0]!) ?? 'hall']
      const frame = [
        `${slotLabel[WIN[0]!]}에 ${loc}에 있었던 것은 제 일 때문입니다. 그 밖에 보탤 것은 없습니다.`,
        `다시 여쭈시니 말씀드리면, ${slotLabel[WIN[0]!]}에 제가 있던 곳은 ${loc}입니다.`,
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
    /**
     * ⚠ **제목에 seed 를 박지 않는다** (2026-07-29).
     *
     * 여기는 `사건 ${seed}` 였다 — 「레지던시 사건 **17050**」이 홈과 사이드바에
     * 그대로 떴다. seed 는 재현용 내부 값이지 **플레이어가 볼 것이 아니다.**
     *
     * 구분은 이미 되고 있었다 — 홈 목록이 만든 순서대로 `G1`·`G2` 를 붙인다
     * (`buildHome`). 같은 세계로 여럿 만들어도 행이 갈린다. 즉 **숫자는 중복이었다.**
     * 재현이 필요하면 `id`(`gen-<seed>`)에 그대로 남아 있다.
     */
    title: `${P.setting ?? DEFAULT_PALETTE.setting} 사건`,
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
      { ko: `${P.setting ?? DEFAULT_PALETTE.setting}. ${victimName}${topicParticle(victimName)} 그곳에서 지내고 있었다.` },
      /**
       * ⚠ **「다섯이 자리에 있었다」로 쓰면 안 된다** — 프롤로그는 게임이 하는 말이라
       * 곧 사실이고, 그러면 t0 에 홀에 없는 사람이 **그 자리에서 거짓말쟁이로 찍힌다.**
       * `delayed_mechanism` 은 범인 실제 위치가 t0 에 현장이고, 아래 §무고한 넷의
       * 동선의 그림자 한 사람도 범인 주장을 따라 부지 밖일 수 있다. 머문 인원만 말한다.
       *
       * ★ **그 「머문 인원만」이 문장에서는 안 지켜지고 있었다** ★ (2026-07-30)
       *
       * 전에는 이랬다 — `«{hall}에 불이 켜져 있었다. 그곳에 머물던 사람은 모두
       * 다섯이었다.»` **「그곳」의 바로 앞이 `places.hall`** 이라 「로비에 머물던
       * 다섯」으로 읽힌다. 위 문단이 같은 「그곳」을 **무대**로 쓰고 있어서
       * (`{victim}은 그곳에서 지내고 있었다`) 한 낱말이 두 뜻으로 갈렸다.
       *
       * 실측(2026-07-30): `delayed_mechanism` 이면 범인이 t0 를 `away` 로 주장하고
       * **그림자는 그것이 참**이라, 로비에 있던 사람은 셋인데 프롤로그가 다섯이라고
       * 말했다. 기준선 12건 중 **4건**이 그 아키타입이었다.
       *
       * **고친 방법은 「인원을 시각에서 떼는 것」이다.** 셋을 동시에 만족해야 했다:
       *
       * ```
       * ① 「그곳」이 무대여야 한다        → 홀보다 먼저 둔다 (위 문단의 그곳에 붙는다)
       * ② 피해자를 빼야 한다            → 「다섯 사람이 더」 (피해자도 그곳에 산다)
       * ③ 시각을 붙이면 안 된다         → away 를 주장하는 사람은 t0 에 무대에 없다
       * ```
       *
       * ②를 놓쳐서 한 번 헛디뎠다 — 「그곳」을 무대로 옮기자마자 *"그곳에 머물던
       * 사람은 모두 다섯"* 이 **피해자를 포함해 여섯**이 되어, 20%에서 틀리던 문장이
       * **100%에서 틀리게** 됐다. 지시 대상을 고치면 **셈의 기준도 같이 바뀐다.**
       *
       * 그래서 인원은 **사건 내내의 사실**로 말하고(시각 없음), 시각은 **사람을 말하지
       * 않는** 홀의 불로 옮겼다. 논리·그림자·아키타입은 한 줄도 안 건드렸다 —
       * 셋 다 옳았고 문장만 틀렸다.
       *
       * ⚠ **이름에 조사를 새로 붙이지 않았다.** 엔진 산문은 `에`·`에는`·`에서` 처럼
       * **갈리지 않는 조사만** 쓴다(`과/와`·`이/가` 는 이름의 끝 글자에 따라 갈린다).
       */
      { ko: `그곳에는 다섯 사람이 더 머물고 있었다. ${slotLabel[FIRST]}, ${places.hall}에는 불이 켜져 있었다.` },
      { ko: `${slotLabel[LAST]}, 가장 먼저 일어난 사람이 ${places.room} 문을 열었다.` },
      { ko: `${victimName}${topicParticle(victimName)} 이미 숨을 쉬지 않았다.` },
    ],

    /**
     * ─────────────────────────────────────────────────────────────
     *  평면도 — **격자에서 도출한다** (2026-07-29 재작성)
     * ─────────────────────────────────────────────────────────────
     *
     * **조사 화면이 곧 도면이라 좌표가 없으면 갈 수가 없다.**
     *
     * 여기 있던 것은 문 하나·창 하나·고정물 0 의 **상수 덩어리**였다. 인물·물증·
     * 조사·공란·예산은 전부 사건에서 계산되는데 도면만 리터럴이었고, 그래서
     * 결함 넷이 한 뿌리에서 나왔다:
     *
     * ```
     * ① 문·창이 3방 시절 좌표      방이 10개가 돼도 안 따라와 방 한가운데 떴다
     * ② 방이 균일 격자             복도도 인접성도 없어 배치에 뜻이 없었다
     * ③ 트릭이 말한 공간이 없다     staged_suicide 가 「창을 넘었다」는데 현장에 창이 없었다
     * ④ 고정물 0                  「고정물 조사」 11개가 도면에 점이 없어 **도달 불가**였다
     * ```
     *
     * ④가 가장 비쌌다 — 앱은 `fp.fixtures` 로 `FIXTURES` 를 만드는데(`App.jsx`)
     * 비어 있으면 그 동사 전체를 고를 수 없다. **사건 파일이 주는데 앱이 못 준다.**
     *
     * 이제 전부 위 격자에서 나온다. 방마다 복도 쪽 문 하나, 바깥벽에 창(팔레트가
     * `noWindow` 라 한 방은 제외), 방마다 고정물 한 점. 트릭의 공간 계약은 아래
     * `space` 가 강제하고 검증기 §9-3 이 대조한다.
     */
    floorPlan: {
      viewBox: { w: 1000, h: 625 },
      scale: { x: 96, len: 90, y: 585, label: '5m' },
      /**
       * 건물 둘. **별채는 1장을 완성해야 나타난다** — 산장이 그렇다
       * (`mountain-lodge.yaml` 154행). `types.ts` §buildings 가 *"흐리게 두지
       * 않고 아예 감춘다"* 고 못박은 그 자리이고, 스키마에 이미 있던 것을
       * 생성 사건이 한 번도 안 쓰고 있었다.
       */
      buildings: [
        { id: 'b_main', x: 70, y: 60, w: 532, h: 485, poche: 'var(--fg-3)' },
        { id: 'b_annex', x: xa, y: 66, w: 228, h: 150, poche: 'var(--accent)', revealedAfter: 1 },
      ],
      rooms: [
        ...rooms.map((l) => ({
          id: `r_${l.id}`, building: l.building!, loc: l.id, ...l.rect,
          label: l.label, primary: true,
          ...(l.scene ? { scene: true, tint: 'rgba(235,87,87,.10)' } : {}),
        })),
        // 딸린 방 — 같은 `loc` 을 가리키고 `primary` 가 아니다 (위 §딸린 방)
        ...SUBROOMS.map((s) => ({
          id: s.id, building: s.building, loc: s.loc, ...s.rect, label: s.label,
        })),
      ],
      /**
       * 실외 구역 둘. **진입로는 부지 안, 자택은 밖**이다 — 그 사이에 보행
       * 시간이 생기고, 그 숫자가 알리바이의 재료가 된다(산장의 「걸어서 10분」).
       */
      zones: [
        ...SITES.filter((s) => !s.building).map((s) => ({
          id: `z_${s.id}`, loc: s.id, ...s.rect, label: s.label,
          ...(s.hatch ? { hatch: true } : {}), primary: true,
        })),
        /**
         * ⚠ **`primary` 가 빠져 있었다.** 앱이 인물 마커를 `anchorByLoc`(= 그 장소의
         * `primary` 방/구역)에 찍는데, 없으면 **자택을 주장한 사람이 도면에서
         * 사라진다.** 산장의 `homeZ` 에는 붙어 있다(`mountain-lodge.yaml:165`).
         */
        { id: 'z_away', loc: 'away', x: xa, y: 250, w: 228, h: 120, label: places.away!, offsite: true, hatch: true, primary: true },
      ],
      /**
       * 문 — **건물의 문이지 방의 문이 아니다.** 전에는 방마다 하나씩 복도 쪽에
       * 냈는데(방 열 개 → 문 열 개), 그것이 격자를 격자로 보이게 하던 것 중
       * 하나였다. 이제 산장처럼 **역할별로** 낸다: 현장의 스윙 문 · 방 사이
       * 열린 통로 둘 · 외벽의 정문·후문 · 별채 문.
       *
       * ⛔ **이름표를 붙이지 않는다.** 2026-07-29에 현장 문에만 「잠긴 문」을
       * 달았다가 걷어냈다 — 하나만 이름이 붙으면 **도면이 트릭을 가리킨다.**
       * §절대 규칙의 *"평면도는 판정하지 않는다"* 위반이고, 「잠겼다」는 조사로
       * 얻어야 할 사실이라 공짜로 주면 안 된다.
       *
       * > 산장은 문에 이름이 있다(방문·정문·후문). **손으로 쓴 사건은 어느 문이
       * > 트릭에 쓰이는지 작가가 알고 균형을 잡을 수 있지만**, 생성은 그 판단을
       * > 할 사람이 없다. 기하만 산장을 따르고 이름표는 안 따른다.
       *
       * ★ 현장 문은 반드시 현장 방의 변 위에 있어야 한다 ★ 검증기 §9-3b 가
       * *"현장에 문이 없다 — 아무도 드나들 수 없는 방이다"* 로 잡는다.
       */
      doors: [
        /**
         * 현장 문 — 현장 방의 오른쪽 변(x=330) 위, **홀 쪽으로** 난다(y 110~190 이
         * 홀 60~230 안이다). 스윙 아크가 그려진다.
         *
         * ⚠ 방 경계를 걸치면 안 된다. 전에 y 200~280 이었는데 딸린 방이 생기며
         * 경계가 230 으로 오는 바람에 **문 하나가 두 방에 걸쳤다.**
         */
        { id: 'd_room', building: 'b_main', x1: xr, y1: 110, x2: xr, y2: 190, hinge: 'p2' as const, swing: -1 },
        // 오른쪽 열 네 방 사이의 열린 통로 셋 — 문짝 없이 선만 끊긴다
        { id: 'd_pass1', building: 'b_main', x1: 400, y1: 230, x2: 480, y2: 230, open: true },
        { id: 'd_pass2', building: 'b_main', x1: 400, y1: 360, x2: 480, y2: 360, open: true },
        { id: 'd_pass3', building: 'b_main', x1: 400, y1: 465, x2: 480, y2: 465, open: true },
        // 외벽. 정문은 별채 쪽으로(홀 안), 후문은 진입로 쪽으로(loc2 안) 난다
        { id: 'd_front', building: 'b_main', x1: 602, y1: 120, x2: 602, y2: 186, hinge: 'p2' as const, swing: -1, ext: true },
        { id: 'd_back', building: 'b_main', x1: 602, y1: 478, x2: 602, y2: 538, hinge: 'p2' as const, swing: -1, ext: true },
        // 별채 문. 건물이 감춰져 있으면 이것도 같이 감춰진다
        { id: 'd_annex', building: 'b_annex', x1: xa, y1: 124, x2: xa, y2: 158, hinge: 'p1' as const, swing: -1, ext: true },
      ],
      /**
       * 창 — **바깥벽에만.** 팔레트가 `noWindow` 라 한 방(암실·지하)은 건너뛴다.
       * 현장은 트릭이 요구하면 `noWindow` 여부와 무관하게 반드시 낸다(§9-3b).
       *
       * 방마다 바깥벽이 다른 쪽이라 좌표를 방별로 적는다 — 현장은 위쪽,
       * 홀도 위쪽, 방1은 오른쪽, 방2는 아래쪽, 별채는 위쪽이다.
       *
       * ⛔ 여기도 이름표 없음 — 위 §문과 같은 이유다.
       */
      windows: (() => {
        /** 방마다 바깥벽이 다른 쪽이라 자리를 방별로 적는다. 키는 방 id 다 */
        const W: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
          room: { x1: 150, y1: 60, x2: 258, y2: 60 },        // 본채 위쪽 바깥벽
          hall: { x1: 410, y1: 60, x2: 518, y2: 60 },        // 본채 위쪽 바깥벽
          r_hallside: { x1: 602, y1: 265, x2: 602, y2: 325 }, // 본채 오른쪽 바깥벽
          loc1: { x1: 602, y1: 385, x2: 602, y2: 440 },      // 본채 오른쪽 바깥벽
          loc2: { x1: 400, y1: 545, x2: 500, y2: 545 },      // 본채 아래쪽 바깥벽
          loc3: { x1: 820, y1: 66, x2: 890, y2: 66 },        // 별채 위쪽
        }
        const all: { id: string; noWindow?: boolean; scene?: boolean; building: string }[] = [
          ...rooms.map((l) => ({ id: l.id, noWindow: l.noWindow, scene: l.scene, building: l.building! })),
          ...SUBROOMS.map((s) => ({ id: s.id, noWindow: s.noWindow, building: s.building })),
        ]
        return all.flatMap((l) => {
          const need = l.scene && t.space?.sceneWindow
          if ((l.noWindow && !need) || !W[l.id]) return []
          return [{ ...W[l.id]!, building: l.building }]
        })
      })(),
      /**
       * 고정물 — **장소마다 하나.** 키가 곧 「고정물 조사」의 대상 id 다
       * (`fixture:<장소>`). 이게 비면 그 조사를 **고를 수가 없다**(§9-3c).
       * 이름은 팔레트가 주면 그것을, 없으면 총칭으로 채운다.
       */
      fixtures: Object.fromEntries([
        ...SITES.map((l) => [l.id, {
          /**
           * ⚠ **방 이름(좌상단)과 「미조사」 칩(우상단) 아래, 그러나 방 안에.**
           *
           * 처음엔 가운데(0.34/0.66)에 놓아 이름과 뒤엉켰고, 다음엔 0.74 로
           * 내렸더니 **이름표가 방 경계에 걸쳤다**(이름표는 점보다 9px 더 아래에
           * 그려진다). 0.56 이 셋 다 피한다.
           */
          x: l.rect.x + Math.floor(l.rect.w / 2),
          y: l.rect.y + Math.floor(l.rect.h * 0.56),
          // 팔레트가 이름을 줬으면 그것을, 아니면 총칭. 섞여도 된다 — 위 §설비 이름 참조
          label: l.fixture ?? `${l.label}의 설비`,
          loc: l.id,          // 없으면 앱이 못 그린다 — types.ts §fixtures 참조
        }]),
        // 부지 밖도 팔레트가 이름을 주면 그것을 쓴다 (2026-07-29 밤 — 전엔 늘 총칭이었다)
        ['away', { x: 826, y: 317, loc: 'away', label: placeFixture.away ?? `${places.away}의 설비` }],
        /**
         * ★ 시신 ★ — 산장의 `body` 와 **같은 id**다. 우연이 아니라 계약이다:
         * 앱 `targetKey(action, targets)` 가 `mode:'none'`(부검)에 대해 **언제나
         * `'body'`** 를 돌려주므로(`App.jsx:1975`), 이 id 여야 부검 조사가 자기
         * 결과문을 찾는다.
         *
         * 여기 없어서 생성 사건의 현장에는 **총칭 설비 하나뿐**이었다 — 산장은
         * 현장에 시신·화로·테이프 셋이 있고 전부 사건의 핵심인데.
         *
         * ⚠ **현장에 고정물이 둘이 되는 것은 누설이 아니다.** 현장은 이미
         * `scene` 으로 붉게 칠해져 있어 플레이어가 아는 곳이다. 누설이 되는 것은
         * **모르는 방**끼리 개수가 갈릴 때다 — 나머지는 정확히 하나씩이다.
         */
        ['body', {
          x: 200, y: 300, loc: 'room', label: '시신', body: true,
        }],
      ]),
      /**
       * 보행선 — **정문에서 별채로, 후문에서 진입로로.** 산장의 「별채 10분 ·
       * 진입로 2분」을 그대로 따른다(`mountain-lodge.yaml` 181·182행).
       *
       * ★ 이 숫자가 알리바이의 재료다 ★ 산장에서는 세라의 *"걸어서 10분"* 이
       * 이 값과 맞아야 한다. 생성 사건에서는 아직 진술이 이 숫자를 인용하지
       * 않는다 — **다음 자리다**(§보행 시간을 진술이 쓰게 하기).
       */
      walks: OUTLYING.map(({ site, y }) => ({
        building: site.building ?? `z_${site.id}`,
        // ★ 장소 쌍을 같이 낸다 ★ 이게 없어서 앱이 도보 시간표를 통째로 비웠다
        from: 'hall', to: site.id, min: site.walkMin,
        x1: 602, y1: y, x2: xa, y2: y,
      })),
    },

    /**
     * 관계 도식 — **노드만 만든다.** (2026-07-29 밤)
     *
     * ★ 없으면 앱이 산장 표를 그대로 그린다 ★ `App.jsx` 의 `GRAPH_NODES` 첫 줄이
     * `{ id: 'victim', ko: '윤다인' }` 이고, `applyCase` 는 사건이 관계 도식을 줄
     * 때만 덮어썼다. 생성 사건은 안 주므로 **관계도에 산장의 피해자 이름이 떴다**
     * (첫 실플레이에서 사용자가 찾았다). 07-29 저녁의 「죽은 배선 셋」과 같은 부류다.
     *
     * ⚠ **선(`edges`)은 비운다 — 저작이다.** 산장은 「마약망 김선생」 노드가 4장에
     * 나타나고 범인과 이어진다. 그런데 **어느 장에서 무엇을 드러낼지가 곧 난이도**라,
     * 기계가 정하면 누설 설계를 기계가 하는 것이 된다. 노드만으로도 알리바이 대조
     * (두 인물 선택)는 그대로 돈다 — 그게 이 화면의 조작이다.
     *
     * 좌표는 산장 배치를 그대로 쓴다(`GRAPH_NODES`). 인물 노드는 `label` 을 안
     * 준다 — `kind: 'person'` 이면 앱이 `people` 에서 이름·색을 읽는다.
     */
    relationGraph: {
      nodes: [
        { id: 'victim', kind: 'victim' as const, label: { ko: victimName }, x: 50, y: 50 },
        ...ids.map((id, i) => ({
          id,
          kind: 'person' as const,
          ...[{ x: 22, y: 22 }, { x: 50, y: 15 }, { x: 80, y: 30 }, { x: 82, y: 72 }, { x: 24, y: 78 }][i]!,
        })),
      ],
      edges: [],
      discoveries: [],
    },

    seedTerms: [tool],
    slots: [
      { id: FIRST, label: slotLabel[FIRST]! },
      ...WIN.map((s) => ({ id: s, label: slotLabel[s]!, isWindow: true })),
      { id: LAST, label: slotLabel[LAST]! },
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
      // 레드 헤링 — **다섯 전원**의 비밀. 수상해 보이지만 사건과 무관하다.
      // `context` 라 유죄 계산에 안 낀다 — 범인이 하나 더 갖는다고 논리는 안 바뀐다.
      // ⚠ 위 §HERRING 과 **같은 순서(`ids`)여야** `e_herring{i}` 짝이 맞는다
      ...ids.map((id, i) => ({
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
          // 발견 시각 = **다시 모인 칸**. 창을 쪼개면 `t2` 가 창 라벨이 된다
          { label: '시각', candidates: 'closed', answer: LAST },
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
          { label: i % 2 === 0 ? '시각' : '장소', candidates: 'closed', answer: i % 2 === 0 ? WIN[0]! : 'hall', particle: '을/를' },
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
