import type { Case } from '../types.js'

/**
 * 산장 살인사건 — 골든 케이스
 * 실제 오프라인 플레이 기록: 조사 4~5회로 해결
 */
export const mountainLodge: Case = {
  id: 'mountain-lodge',
  title: '산장 살인사건',
  scale: 'campaign',
  budget: 5,
  incident: {
    kind: 'homicide',
    subject: 'chaewon',
    description: '산장 장기 투숙 중이던 소설가가 위장 자살로 살해됨',
    scene: 'room',
  },
  prose: { source: 'authored' },
  victim: 'chaewon',
  culprit: 'sakura',

  // 시간 슬롯 4개. 프로토타입 격자와 동일 어휘 (정본)
  slots: [
    { id: 't0', label: '전날 밤' },
    { id: 't1', label: '새벽 3시' },
    { id: 't2', label: '새벽 3–8시', isWindow: true },
    { id: 't3', label: '오전' },
  ],

  // 장소. atLodge=false 는 산장 밖 — 사망 시간대 현장 접근 불가
  locations: [
    { id: 'main', label: '본채', atLodge: true },
    { id: 'room', label: '채원의 방', atLodge: true },
    { id: 'annex', label: '별채', atLodge: true },
    { id: 'approach', label: '진입로', atLodge: true },
    { id: 'home', label: '자택', atLodge: false },
  ],

  people: [
    {
      id: 'sakura', name: '미야와키 사쿠라', age: 32, job: '산장지기',
      hiddenRole: 'ringleader',
      // 진실: 새벽까지 본채에서 피해자와 음주 → 사망 시간대에 방(현장) → 별채
      presence: [
        { slot: 't0', location: 'main' },
        { slot: 't1', location: 'main' },
        { slot: 't2', location: 'room' },
        { slot: 't3', location: 'annex' },
      ],
      // 알리바이 거짓말: 새벽부터 별채에서 잤다고 진술한다 (t1·t2 위치 위조)
      claim: [
        { slot: 't0', location: 'main' },
        { slot: 't1', location: 'annex' },
        { slot: 't2', location: 'annex' },
        { slot: 't3', location: 'annex' },
      ],
    },
    // 무고한 넷 — claim 없음. presence 를 그대로 진술한다 (거짓 불가)
    { id: 'yena', name: '최예나', age: 31, job: '댄스 강사', hiddenRole: 'investigator',
      presence: [{ slot: 't3', location: 'main' }] },
    { id: 'yujin', name: '안유진', age: 27, job: '아이돌', hiddenRole: 'investigator',
      presence: [{ slot: 't3', location: 'main' }] },
    { id: 'yuri', name: '조유리', age: 29, job: '가수', hiddenRole: 'coerced',
      presence: [{ slot: 't3', location: 'main' }] },
    { id: 'wonyoung', name: '장원영', age: 26, job: '아이돌', hiddenRole: 'investigator',
      // 자택에서 전화 수신·늦잠 → 늦게 이동 중. 산장 밖이라 기회 없음
      presence: [
        { slot: 't1', location: 'home' },
        { slot: 't2', location: 'home' },
        { slot: 't3', location: 'approach' },
      ] },
  ],

  trick: {
    type: 'staged_suicide',
    props: ['e_briquette', 'e_tape'],
    staging: ['e_note'],
    flaw: '자살할 사람이 왜 그날 손님들을 초대했는가',
  },

  evidence: [
    { id: 'e_burner', description: '별채 대포폰', foundAt: '별채 · 게임기 뒤',
      record: "저장된 번호는 하나. 이름 없이 '선생'이라고만 적혀 있었다.",
      extra: { kind: 'messages', lines: [
        { side: 'in', at: '11월 3일', text: '이번이 마지막이에요' },
        { side: 'out', at: '11월 3일', text: '그건 네가 정하는 게 아니야' },
        { side: 'in', at: '11월 12일', text: '채원 언니한테 다 말할 거예요' },
      ] },
      yieldsTerms: ['별채 대포폰', '김선생'] },
    { id: 'e_safes', description: '별채 금고 두 개' },
    { id: 'e_note', description: '유서', foundAt: '미야와키 사쿠라 소지품',
      record: '한 장짜리 손글씨. 서명은 김채원. 책상의 원고 메모와 필체가 일치하지 않았다.',
      isStaging: true, yieldsTerms: ['유서'] },
    { id: 'e_key', description: '금고 열쇠' },
    { id: 'e_wy_text', description: '원영 문자 — 가명의 정체', yieldsTerms: ['김선생', '마약', '폭로 임박'] },
    { id: 'e_yuri_threat', description: '유리 문자 — 협박', yieldsTerms: ['마약'] },
    { id: 'e_yena_info', description: '예나 소지품 — 연습생 제보' },
    { id: 'e_yujin_patch', description: '파스', foundAt: '안유진 소지품',
      record: '개봉된 어깨용 파스 한 통. 처방전은 없었고 구매처를 묻자 대답하지 않았다.' },
    // 영수증의 값은 '구매자 = 별채 거주자'라는 경로 단서(reveals 로 공개)이지
    // '연탄'이라는 단어가 아니다. 연탄은 현장에서 이미 확보되므로 중복을 뺀다.
    { id: 'e_receipt', description: '연탄 영수증 — 구매자는 별채 거주자' },
    { id: 'e_tape', description: '테이프', foundAt: '채원의 방 · 방문과 창가',
      record: '문틈과 창문 가장자리가 안쪽에서 막혀 있었다. 폭 5cm 청테이프를 두 겹으로 겹쳐 붙였다.',
      atScene: true, yieldsTerms: ['테이프'] },
    { id: 'e_briquette', description: '연탄', foundAt: '채원의 방 · 화로',
      record: '두 장이 완전히 탔고 재만 남았다. 화로는 방 한가운데로 옮겨져 있었다.',
      atScene: true, yieldsTerms: ['연탄'] },
    { id: 'e_time', description: '정밀 사망 시각', yieldsTerms: ['일산화탄소 중독'] },
    { id: 'e_yuri_call', description: '유리 통화내역 — 새벽 피해자와 통화' },
    { id: 'e_wy_call_log', description: '원영 통화내역 — 새벽 3시 수신' },
    { id: 'e_mutual', description: '예나와 유진의 상호 보증' },
    { id: 'e_hearth_cold', description: '화로가 식은 정도' },
    { id: 'e_tape_inside', description: '테이프가 안쪽에서 붙여짐' },
    { id: 'e_victim_phone', description: '피해자 휴대폰 — 초대 메시지 발신 기록' },
  ],

  facts: [
    // 무료 · 진술에서
    { id: 'f_sakura_opp', kind: 'opportunity', subject: 'sakura',
      content: '별채는 도보 10분, 새벽까지 피해자와 동석', revealedBy: [] },
    { id: 'f_yena_no', kind: 'no_opportunity', subject: 'yena', content: '오전 8시 도착', revealedBy: [] },
    { id: 'f_yujin_no', kind: 'no_opportunity', subject: 'yujin', content: '오전 8시 도착', revealedBy: [] },
    { id: 'f_yuri_no', kind: 'no_opportunity', subject: 'yuri', content: '장을 보고 아침 도착', revealedBy: [] },
    { id: 'f_wy_no', kind: 'no_opportunity', subject: 'wonyoung', content: '늦잠, 가장 늦게 도착', revealedBy: [] },
    { id: 'f_last_seen', kind: 'context', subject: 'sakura',
      content: '새벽 3시까지 본채에서 피해자와 음주', revealedBy: [] },
    { id: 'f_wy_call', kind: 'context', subject: 'wonyoung',
      content: '새벽 3시 피해자의 전화를 받음', revealedBy: [] },

    // 1장 확인 후 무료 공개
    { id: 'f_cause', kind: 'context', subject: 'chaewon',
      content: '외상 없음, 일산화탄소 중독', revealedBy: [], availableAfter: 1 },

    // 유료
    { id: 'f_alias_exists', kind: 'context', subject: 'sakura',
      content: '가명을 쓰는 유통책이 존재한다',
      revealedBy: ['e_yuri_threat', 'e_yena_info', 'e_wy_text'] },
    { id: 'f_sakura_is_alias', kind: 'identity', subject: 'sakura',
      content: '사쿠라 = 가명의 주인', revealedBy: ['e_burner', 'e_wy_text'] },
    { id: 'f_sakura_means', kind: 'means', subject: 'sakura',
      content: '유서 위조, 금고 열쇠, 연탄 구매', revealedBy: ['e_note', 'e_key', 'e_receipt'] },
    { id: 'f_sakura_motive', kind: 'motive', subject: 'sakura',
      content: '분배금 다툼 + 폭로 임박', revealedBy: [], requires: ['f_sakura_is_alias'] },

    // 레드 헤링
    { id: 'f_yuri_secret', kind: 'context', subject: 'yuri', content: '협박당하는 중', revealedBy: ['e_yuri_threat'] },
    { id: 'f_yena_secret', kind: 'context', subject: 'yena', content: '출처 추적 중', revealedBy: ['e_yena_info'] },
    { id: 'f_yujin_secret', kind: 'context', subject: 'yujin', content: '피해자를 의심 중', revealedBy: ['e_yujin_patch'] },
  ],

  actions: [
    { id: 'a_yuri', label: '소지품 검사 · 조유리', cost: 1, gives: ['e_yuri_threat'],
      salience: 0.9, yield: 'redherring' },
    { id: 'a_yena', label: '소지품 검사 · 최예나', cost: 1, gives: ['e_yena_info'],
      salience: 0.8, yield: 'redherring' },
    { id: 'a_yujin', label: '소지품 검사 · 안유진', cost: 1, gives: ['e_yujin_patch'],
      salience: 0.75, yield: 'redherring' },
    { id: 'a_autopsy', label: '시신 정밀 검사', cost: 2, gives: ['e_time'],
      salience: 0.7, yield: 'exclusion' },
    { id: 'a_briquette', label: '연탄 수색', cost: 1, gives: ['e_receipt'],
      salience: 0.6, availableAfter: 2, yield: 'solution' },
    { id: 'a_wy', label: '소지품 검사 · 장원영', cost: 1, gives: ['e_wy_text'],
      salience: 0.5, boostedBy: [{ fact: 'f_alias_exists', amount: 0.45 }], yield: 'solution' },
    { id: 'a_sakura', label: '소지품 검사 · 미야와키 사쿠라', cost: 1, gives: ['e_note', 'e_key'],
      salience: 0.35, boostedBy: [{ fact: 'f_sakura_is_alias', amount: 0.5 }], yield: 'solution' },
    { id: 'a_annex', label: '별채 수색', cost: 1, gives: ['e_burner', 'e_safes'],
      salience: 0.3, availableAfter: 1,
      boostedBy: [{ fact: 'f_alias_exists', amount: 0.4 }], yield: 'solution' },

    // 통화내역
    { id: 'a_ph_yuri', label: '통화내역 조회 · 조유리', cost: 1, gives: ['e_yuri_call'],
      salience: 0.5, yield: 'exclusion' },
    { id: 'a_ph_wy', label: '통화내역 조회 · 장원영', cost: 1, gives: ['e_wy_call_log'],
      salience: 0.45, yield: 'exclusion' },
    { id: 'a_ph_sakura', label: '통화내역 조회 · 미야와키 사쿠라', cost: 1, gives: [],
      salience: 0.3, yield: 'empty' },
    { id: 'a_ph_yena', label: '통화내역 조회 · 최예나', cost: 1, gives: [],
      salience: 0.35, yield: 'empty' },
    { id: 'a_ph_yujin', label: '통화내역 조회 · 안유진', cost: 1, gives: [],
      salience: 0.3, yield: 'empty' },

    // 알리바이 대조
    { id: 'a_alibi_yy', label: '알리바이 대조 · 최예나 × 안유진', cost: 1, gives: ['e_mutual'],
      salience: 0.4, yield: 'exclusion' },
    { id: 'a_alibi_yr', label: '알리바이 대조 · 조유리 × 안유진', cost: 1, gives: [],
      salience: 0.3, yield: 'empty' },

    // 장소
    { id: 'a_hearth', label: '화로 조사', cost: 1, gives: ['e_hearth_cold'],
      salience: 0.55, yield: 'exclusion' },
    { id: 'a_window', label: '문틈과 창가 조사', cost: 1, gives: ['e_tape_inside'],
      salience: 0.45, yield: 'exclusion' },
    { id: 'a_kitchen', label: '주방 수색', cost: 1, gives: [],
      salience: 0.2, yield: 'empty' },
    { id: 'a_living', label: '거실 수색', cost: 1, gives: [],
      salience: 0.25, yield: 'empty' },
    { id: 'a_storage', label: '창고 수색', cost: 1, gives: [],
      salience: 0.2, yield: 'empty' },
    { id: 'a_drive', label: '진입로 수색', cost: 1, gives: [],
      salience: 0.15, yield: 'empty' },

    // 피해자
    { id: 'a_victim_bel', label: '소지품 검사 · 피해자', cost: 1, gives: ['e_victim_phone'],
      salience: 0.5, yield: 'exclusion' },
    { id: 'a_manuscript', label: '원고 조사', cost: 1, gives: [],
      salience: 0.25, yield: 'empty' },
  ],

  chapters: [
    {
      order: 1, title: '도착과 발견',
      requiresFacts: ['f_yena_no', 'f_yujin_no', 'f_yuri_no'],
      blanks: [
        { label: '인물', candidates: 'closed', answer: 'yujin' },
        { label: '인물', candidates: 'closed', answer: 'yena' },
        { label: '장소', candidates: 'closed', answer: 'room' },
        { label: '은폐수단', candidates: 'discovered', answer: '테이프' },
      ],
      epilogueOrder: 1,
      epilogue: '그날 아침, 요리를 돕기로 한 사람과 뒤이어 도착한 사람이 채원의 방에서 새어 나오는 연기를 보았다.',
    },
    {
      order: 2, title: '마지막 정황',
      requiresFacts: ['f_last_seen', 'f_wy_call'],
      blanks: [
        { label: '마지막목격자', candidates: 'closed', answer: 'sakura' },
        { label: '시각', candidates: 'closed', answer: 't1' },
        { label: '장소', candidates: 'closed', answer: 'main' },
        { label: '인물', candidates: 'closed', answer: 'wonyoung' },
      ],
      epilogueOrder: 2,
      epilogue: '마지막으로 채원을 본 것은 사쿠라였다. 새벽 3시, 두 사람은 본채에 함께 있었다. 같은 시각, 원영의 전화가 울렸다.',
    },
    {
      order: 3, title: '사인과 현장',
      requiresFacts: ['f_cause', 'f_sakura_means'],
      blanks: [
        { label: '사인', candidates: 'discovered', answer: '일산화탄소 중독' },
        { label: '도구', candidates: 'discovered', answer: '연탄' },
        { label: '은폐수단', candidates: 'discovered', answer: '테이프' },
        { label: '위장물', candidates: 'discovered', answer: '유서' },
      ],
      epilogueOrder: 3,
      epilogue: '사인은 일산화탄소 중독이었다. 화로의 연탄이 방을 채웠고, 문틈의 테이프가 공기를 막았다. 머리맡의 유서는 그럴듯했지만, 그 손으로 쓴 것이 아니었다.',
    },
    {
      order: 4, title: '감춰진 사건',
      // f_sakura_is_alias 는 5장으로 옮겼다. 정체를 알아야 열리는 장에서
      // 그 정체를 답으로 쓰는 구조였고, 범인 지목(5장)이 형식적이 된다.
      requiresFacts: ['f_alias_exists'],
      blanks: [
        { label: '물품', candidates: 'discovered', answer: '마약' },
        { label: '정체', candidates: 'discovered', answer: '김선생' },
        { label: '협박대상', candidates: 'closed', answer: 'yuri' },
        { label: '인물', candidates: 'closed', answer: 'wonyoung' },
      ],
      epilogueOrder: 4,
      epilogue: '그 산장에는 마약이 흐르고 있었다. 유통을 쥔 것은 김선생이라는 이름의 누군가였고, 유리는 그 이름에 붙들려 있었다. 며칠 전, 원영이 그 실체를 캐묻기 시작한 참이었다.',
    },
    {
      order: 5, title: '범인과 동기',
      // 정체 폭로(사쿠라 = 김선생)는 여기가 클라이맥스다.
      requiresFacts: ['f_sakura_is_alias', 'f_sakura_motive', 'f_sakura_opp'],
      blanks: [
        { label: '인물', candidates: 'closed', answer: 'sakura', isAccusation: true },
        { label: '동기', candidates: 'discovered', answer: '폭로 임박' },
        { label: '은닉처', candidates: 'discovered', answer: '별채 대포폰' },
      ],
      epilogueOrder: 5,
      epilogue: '김선생은, 사쿠라였다. 채원이 모든 것을 털어놓으려 하자 사쿠라는 폭로가 임박했음을 알았다. 새벽, 그는 별채에서 연탄을 들고 본채로 향했다. 증거는 별채의 대포폰 안에 잠들어 있었다.',
    },
  ],

  reopenPerChapter: 1,

  reveals: [
    {
      trigger: { on: 'chapterComplete', chapterOrder: 1 },
      yield: 'path',
      facts: ['f_cause'],
      actions: ['a_annex'],
      narration: '도착 정황이 정리됐다. 별채의 존재가 드러나 현장을 넓게 살필 수 있게 됐다.',
      surface: 'map',
    },
    {
      trigger: { on: 'chapterComplete', chapterOrder: 2 },
      yield: 'decoy',
      addClaims: [{ speaker: 'yuri', content: '새벽에 채원 언니가 저한테도 전화를 했었어요', target: 'statement' }],
      narration: '마지막 정황을 정리하자, 조유리가 머뭇거리며 덧붙였다.',
      surface: 'statement',
    },
    {
      trigger: { on: 'action', actionId: 'a_autopsy' },
      yield: 'narrow',
      // 4슬롯 정본에선 window(t2, 3–8시) 내부의 3–5시 축소를 슬롯으로 표현하지 않는다.
      // 축소의 서사는 narration 이 담고, 슬롯은 window 를 가리킨다.
      narrowsWindow: ['t2', 't2'],
      narration: '부검 결과 사망 시각이 새벽 3시에서 5시 사이로 좁혀졌다.',
      surface: 'overview',
    },
    {
      trigger: { on: 'chapterComplete', chapterOrder: 3 },
      yield: 'decoy',
      addClaims: [{ speaker: 'yena', content: '유리 걔가 요즘 돈 문제로 힘들다고 했었어요', target: 'statement' }],
      narration: '현장 정리가 끝나자 최예나가 조심스레 말을 보탰다.',
      surface: 'statement',
    },
    {
      trigger: { on: 'action', actionId: 'a_briquette' },
      yield: 'path',
      narration: '연탄에서 나온 영수증. 구매자는 별채 거주자였다.',
      surface: 'map',
    },
  ]
}
