import type { Case, PersonId } from './types.js'

/**
 * 작가 — 논리 골격 생성기.
 *
 * **LLM이 없다.** 진실 세계를 조합으로 만들고, 거기서 물증·조사·공란을 도출한다.
 * 순수 함수이므로 기기에서도 돌고, 같은 seed 는 같은 사건을 낸다.
 *
 * 산문(진술·프롤로그·인터루드·에필로그)은 여기서 만들지 않는다.
 * 그것은 빌드 타임 LLM의 몫이고 결과는 파일에 고정된다.
 *
 * 규모는 daily 고정이다 — 3인·2장·6공란·예산 3.
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

const NAMES = ['서지안', '한유빈', '오나경', '백리원', '문세라', '윤다인', '임하늘', '남주원']
const JOBS = ['사진가', '번역가', '조리사', '학예사', '정비사', '약사']
const ITEMS = ['만년필', '손목시계', '열쇠고리', '스카프', '라이터', '수첩']
const MOTIVES = ['채무 관계', '자리 다툼', '오래된 약속', '지분 다툼']

export function generateCase(seed: number): Case {
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

  const ids: PersonId[] = ['p1', 'p2', 'p3']
  const names = shuffled(NAMES).slice(0, 4)
  const culprit = pick(ids)
  const innocents = ids.filter((x) => x !== culprit)

  const tool = pick(ITEMS)
  const motive = pick(MOTIVES)
  const alias = names[3]

  // 진실: 범인만 t1(사망 추정 구간)에 현장에 있었다.
  // 무고한 둘은 t2에 도착했고, 서로를 보증한다 — 자기 진술 하나에만 기대지 않는다.
  const person = (id: PersonId, i: number) => ({
    id,
    name: names[i],
    age: 27 + Math.floor(r() * 12),
    job: pick(JOBS),
    hiddenRole: id === culprit ? ('ringleader' as const) : ('unaware' as const),
    presence:
      id === culprit
        ? [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'room' }, { slot: 't2', location: 'hall' }]
        : [{ slot: 't2', location: 'hall' }],
    // 거짓말은 범인만. 무고한 사람은 claim 을 적지 않는다(= presence 와 같다)
    ...(id === culprit
      ? { claim: [{ slot: 't0', location: 'hall' }, { slot: 't1', location: 'hall' }, { slot: 't2', location: 'hall' }] }
      : {}),
  })

  return {
    id: `gen-${seed}`,
    title: `생성 사건 ${seed}`,
    scale: 'daily',
    budget: 3,
    incident: {
      kind: 'homicide', subject: 'victim', description: '밀실이 아닌 실내에서의 사망',
      scene: 'room',
    },
    prose: { source: 'template' },
    seedTerms: [tool],
    slots: [
      { id: 't0', label: '전날 밤' },
      { id: 't1', label: '새벽', isWindow: true },
      { id: 't2', label: '아침' },
    ],
    // 무고한 둘은 t2에 hall 로 도착한다 — 사망 구간(t1)에 현장(room)에 없다.
    // 이 배치가 곧 배제이고, 검증기가 이것을 검사한다.
    locations: [
      { id: 'hall', label: '홀', atLodge: true },
      { id: 'room', label: '방', atLodge: true },
    ],
    people: ids.map(person),
    victim: 'victim',
    culprit,

    // alibi_fabrication 은 현장이 닫혀 있다고 주장하지 않으므로 exit 이 필요 없다.
    // 아키타입 계약이 요구 부품을 결정한다.
    trick: {
      types: ['alibi_fabrication'],
      props: ['e_tool'],
      staging: [],
      illusions: [
        {
          id: 'il_absent',
          kind: 'absence' as const,
          impression: '범인은 그 시각 현장에 없었다',
          madeBy: [],
          brokenBy: ['e_trace', 'e_log'],
        },
      ],
      flaw: {
        text: '그 시각에 현장에 없었다면 왜 아침에 가장 먼저 알았는가',
        plantedIn: [culprit],
      },
    },

    evidence: [
      { id: 'e_tool', description: tool, foundAt: '방 안', record: '바닥에 떨어져 있었다.', yieldsTerms: [tool] },
      // 핵심 사실은 획득 경로가 둘 이상이어야 한다 — 비평가가 강제한다
      { id: 'e_toolmark', description: '도구가 남긴 자국', record: '같은 폭의 자국이 남아 있었다.', yieldsTerms: [tool] },
      { id: 'e_trace', description: '새벽의 흔적', record: '복도 끝에 젖은 자국이 남아 있었다.' },
      { id: 'e_log', description: '출입 기록', record: '문이 새벽에 한 번 여닫혔다.' },
      { id: 'e_alias', description: `'${alias}' 라는 이름의 기록`, yieldsTerms: [alias] },
      { id: 'e_alias2', description: `'${alias}' 가 적힌 두 번째 기록`, yieldsTerms: [alias] },
      { id: 'e_motive', description: '금전 기록', yieldsTerms: [motive] },
      { id: 'e_mutual', description: '두 사람의 상호 보증' },
      { id: 'e_herring1', description: '개인적인 편지' },
      { id: 'e_herring2', description: '오래된 사진' },
    ],

    facts: [
      { id: 'f_opp', kind: 'opportunity', subject: culprit, content: '새벽에 현장에 있었다', revealedBy: ['e_trace', 'e_log'] },
      // 무고한 사람의 배제는 물증(상호 보증)이 받쳐야 한다.
      // 자기 진술에만 기대면 그 사람을 범인으로 가정했을 때 배제가 사라진다.
      ...innocents.map((id) => ({
        id: `f_no_${id}`, kind: 'no_opportunity' as const, subject: id,
        content: '아침에 함께 도착했다', revealedBy: [] as string[],
      })),
      { id: 'f_identity', kind: 'identity', subject: culprit, content: `${alias} = 범인`, revealedBy: ['e_alias', 'e_alias2'] },
      { id: 'f_means', kind: 'means', subject: culprit, content: '도구를 다룰 수 있었다', revealedBy: ['e_tool', 'e_toolmark'] },
      { id: 'f_motive', kind: 'motive', subject: culprit, content: motive, revealedBy: ['e_motive'], requires: ['f_identity'] },
      { id: 'f_h1', kind: 'context', subject: innocents[0], content: '감추는 것이 있다', revealedBy: ['e_herring1'] },
      { id: 'f_h2', kind: 'context', subject: innocents[1], content: '감추는 것이 있다', revealedBy: ['e_herring2'] },
    ],

    actions: [
      { id: 'a_room', label: '방 수색', cost: 1, gives: ['e_tool'], salience: 0.5, yield: 'solution' },
      { id: 'a_hall', label: '복도 조사', cost: 1, gives: ['e_trace'], salience: 0.4, yield: 'solution' },
      { id: 'a_body', label: '시신 검사', cost: 1, gives: ['e_toolmark'], salience: 0.6, yield: 'solution' },
      { id: 'a_door', label: '출입 기록 조회', cost: 1, gives: ['e_log'], salience: 0.35, yield: 'solution' },
      { id: 'a_papers', label: '서류 조사', cost: 1, gives: ['e_alias', 'e_motive'], salience: 0.3, yield: 'solution' },
      { id: 'a_ledger', label: '장부 조사', cost: 1, gives: ['e_alias2'], salience: 0.3, yield: 'solution' },
      { id: 'a_h1', label: `소지품 검사 · ${names[ids.indexOf(innocents[0])]}`, cost: 1, gives: ['e_herring1'], salience: 0.85, yield: 'redherring' },
      { id: 'a_h2', label: `소지품 검사 · ${names[ids.indexOf(innocents[1])]}`, cost: 1, gives: ['e_herring2'], salience: 0.8, yield: 'redherring' },
      { id: 'a_alibi', label: '알리바이 대조', cost: 1, gives: ['e_mutual'], salience: 0.45, yield: 'exclusion' },
      { id: 'a_kitchen', label: '주방 수색', cost: 1, gives: [], salience: 0.2, yield: 'empty' },
      { id: 'a_yard', label: '마당 수색', cost: 1, gives: [], salience: 0.15, yield: 'empty' },
    ],

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
