import React from 'react';
// §sPoche — 방들의 합집합에서 건물 외곽선을 뽑는다 (ㄱ자·중정).
// 매니페스토 §2·§3(오픈소스 우선). 재보고 들어갔다 — 합집합이 구멍 링까지 준다.
import { union as polyUnion } from 'martinez-polygon-clipping';

/* ---------- helpers ---------- */
// Parse an inline-CSS string into a React style object (memoized).
const _styleCache = new Map();
export function S(css) {
  if (css == null) return undefined;
  if (typeof css === 'object') return css;
  if (_styleCache.has(css)) return _styleCache.get(css);
  const o = {};
  String(css).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) return;
    if (prop.startsWith('--')) { o[prop] = val; return; }
    o[prop.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = val;
  });
  _styleCache.set(css, o);
  return o;
}
// sc-for used to tolerate undefined lists while streaming; keep that safety.
export const arr = (x) => (Array.isArray(x) ? x : []);

/**
 * ─────────────────────────────────────────────────────────────
 *  `press` — 눌러지는 `<div>` 를 키보드·스크린리더에 보이게 한다 (2026-08-01)
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 있나 ★ 사이드바 열한 항목이 `<div onClick>` 이라 **접근성 트리에서 통째로
 * 빠져 있었다.** 화면에는 「진술 · 현장 · 메모」가 멀쩡히 보이는데 `read_page` 로
 * 훑으면 상단 크롬 여섯 개만 나온다 — 키보드로 탭이 안 가고, 스크린리더가 못 읽고,
 * 자동 도구로도 못 누른다.
 *
 * ⛳ **`<button>` 으로 바꾸지 않는다.** 마크업의 정본은 프로토타입이고
 * (`MEMORY.md` §이식 규칙: 클래스·구조·스타일은 그쪽), `.nav-item` 은 `div` 를
 * 전제로 한 CSS 다. **의도적으로 다르게 가는 것이 아니라 얹는 것**이라
 * 구조는 그대로 두고 역할만 준다 — 이식 규칙 5의 「근거를 대고 적는다」에 해당한다.
 *
 * 키 처리는 네이티브 버튼의 규약을 그대로 따른다: **Enter 와 Space**.
 * Space 는 `preventDefault` 가 필요하다 — 안 막으면 페이지가 같이 스크롤된다.
 *
 * 둘째 인자로 **그 항목의 클래스 문자열을 그대로** 넘긴다. `active` 가 들어 있으면
 * `aria-current="page"` 가 붙는다 — `.nav-item.active` 는 **색으로만** 지금 자리를
 * 말하는데 색은 스크린리더에 없다. 클래스를 그대로 받는 이유는 「지금 어디인가」의
 * 출처를 **하나로** 두기 위해서다(`navCls` 가 이미 그것을 정한다).
 *
 * ★ 셋째 인자 `label` 을 반드시 준다 ★ 이름을 내용에서 계산하게 두면 **배지가
 * 이름에 붙는다** — 항목 안에 안 읽은 표시 점과 `.count` 배지가 같이 살아서
 * 「조사 기록 3」·「진술 ●」로 읽힌다. 넘기는 값은 바로 옆 `<span>` 이 렌더하는
 * **그 변수 그대로**다(`V.ui.navStatements` 등) — 문안을 새로 쓰지 않는다.
 */
export const press = (onClick, cls, label) => ({
  role: 'button',
  tabIndex: 0,
  onClick,
  onKeyDown: (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (onClick) onClick(e);
  },
  ...(label ? { 'aria-label': label } : {}),
  ...(/\bactive\b/.test(String(cls ?? '')) ? { 'aria-current': 'page' } : {}),
});

// Vector Design System components come from the bundle loaded in index.html.
const DS = () => (typeof window !== 'undefined' && window.VectorDesignSystem_490b73) || {};
export function Button(props) { const C = DS().Button; return C ? <C {...props} /> : <button {...props} />; }
export function StatusIcon(props) { const C = DS().StatusIcon; return C ? <C {...props} /> : null; }

/**
 * Nobody Lies / 노바디 라이즈 — main app component.
 *
 * Everything lives here: screens (state.view), game data tables, and the
 * floorplan engine (GEO + buildFloorplan). renderVals() computes every value
 * the UI needs; render() maps that object (V) onto markup. Keeping that split
 * makes the view logic easy to test and mirrors how the design was authored.
 */
export default class App extends React.Component {

  state = {
    lang: 'ko', theme: 'dark', view: 'narrative', stmtMode: 'grid', seenClaims: {},
    viewOpts: { timelineSort: false }, seenClues: [], narrMode: 'prose', verdicts: {},
    annMarks: {}, memos: [], openSent: null, memoFilter: 'all', memoSort: 'recent', memoQuery: '', quotePins: {}, quotePicker: null, editMemoId: null,
    expanded: {}, hls: [], sel: null, mapTime: 't2', openProfile: null, hlLog: null,
    blanks: {}, solved: { s1: false, s2: false, s3: false, s4: false, s5: false }, reopenActive: {}, reopenUsed: {}, secExpand: {},
    openPicker: null, openCell: null, openAids: false,
    evidence: {}, cellMarks: {},
    stage: 'brief', readIdx: 0, readDone: false, readMemos: {}, readHi: {}, interludeQ: [],
    invSel: { action: null, targets: [] }, invLog: [], pendingInv: null, invResult: null,
    route: 'home', started: false, confirmAbandon: false, confirmFinish: false, selectedCase: 1, resultFold: false, openTerm: null,
    // 홈 목록에서 지우려는 만든 사건의 id. 되돌릴 수 없어서 한 번 묻는다 (2026-07-29)
    confirmDelCase: null,
    navHist: ['narrative'], navIdx: 0, moreOpen: false,
    leftOpen: true, rightOpen: false, rightView: 'statements', rightProfileId: 'yena', focusMode: false, settingsOpen: false,
    msg: {}, isNarrow: false,
    /**
     * 평면도 전체화면 (2026-08-05) — 첫 테스터 보고 *"평면도가 모바일에서 뭉개진다"*
     * 에 대한 답이다 (`docs/PLAYTEST.md`).
     *
     * `null` 이면 닫힘. 열리면 `{ s 배율, x·y 이동 }` 이고 그것이 그대로
     * **CSS transform 한 줄**이 된다 — 외부 라이브러리를 안 쓴다.
     *
     * ⛔ **저장하지 않는다** (`SAVED` 에 없다). 보는 동안의 화면 상태이고,
     * 새로고침하면 도면을 다시 여는 것이 맞다.
     */
    planZoom: null,
  };

  DICT = {
    ko: {
      caseTitle: '산장 살인사건', navCase: '사건', navClue: '단서', navTool: '도구', navNarrative: '보고서', navStatements: '진술',
      navReference: '표기 안내', refShort: '안내', navSoon: '곧', navInvestigate: '조사', navMap: '현장',
      navGraph: '관계도', graphHint: '조사로 드러난 인물·사건의 연결', logHint: '수행한 조사와 결과가 여기 누적됩니다', soon: '곧', budget: '잔여 조사', difficulty: '난이도', themeLabel: '테마', language: '언어', settings: '설정', toggleLeft: '사이드바', themeDark: '다크', themeLight: '라이트',
      sidebarNote: '범인만 거짓말을 할 수 있다. 무고한 사람은 거짓말하지 않는다. 다만 자기 비밀은 말하지 않는다.',
      nTitle: '사건 보고서', nSub: '공란을 모두 채우면 장이 완성됩니다 · 마지막에 제출', sTitle: '진술', sSub: '다섯 사람의 원문 진술',
      rTitle: '상태 레퍼런스', rSub: '공란 2상태 · 장 2상태 · 셀 마킹',
      segGrid: '구조 뷰', segOriginal: '진술',
      ovVictimK: '피해자', ovVictimV: '윤다인 (30) · 소설가', ovWhenK: '사망 추정', ovWhenV: '새벽 3시 ~ 오전 8시',
      ovBodyK: '시신', ovBodyV: '외상 없음', ovSceneK: '현장', ovSceneV: '방문·창가 테이프, 화로에 연탄',
      secOpen: '미확정', secSealed: '확정', secLocked: '대기', secLockedHint: '앞 장을 완성하면 열립니다', secLockedShort: '잠김', reopenBtn: '재개봉', reopenUsed: '재개봉 사용됨', reopenAvail: '재개봉 가능', reopenDone: '편집 완료', reopenWarn: '장당 한 번만 다시 열 수 있으며, 닫으면 더 이상 수정할 수 없습니다.',
      secDone: '완성', secTodo: '미완성', secFillHint: '공란을 모두 채우면 완성됩니다', clearBlank: '비우기',
      msgFill: '빈칸을 모두 채우세요.',
      kindPerson: '인물', kindPlace: '장소', kindTime: '시각', kindWeapon: '흉기·수단', kindTrick: '정황', kindMotive: '동기', kindClue: '단서', openCand: '열림', modeProse: '서술', modeList: '목록', listUnrev: '이전 항 확인 후',
      vPerson: '인물', vPlace: '장소', vTime: '시각', vTool: '도구', vMotive: '동기', vIdentity: '정체', vConceal: '은폐수단', vStaging: '위장물', vLastSeen: '마지막목격자', vContact: '접촉수단', vHideout: '은닉처', vCause: '사인', vItem: '물품', vTarget: '협박대상',
      srcClosed: '목록', srcCollected: '확보 단어', revealedBy: '장 완성으로 공개', addedStmt: '추가 진술', windowPrev: '이전 추정', newTargetTitle: '새 조사 대상 공개', winNarrowed: '사망 추정 축소',
      pickList: '후보에서 선택', pickWord: '확보 단어에서 선택',
      bankTitle: '확보 단어', bankHint: '흉기·동기처럼 조사로 발견해야 하는 열린 후보가 여기 모입니다.',
      bankEmpty: '아직 공개된 단어가 없습니다. 장을 확인하면 조사로 드러난 단어가 추가됩니다.',
      termMeaning: '뜻', termFound: '발견', termDesc: '기록', termMemoRef: '이 단어 메모', termQuote: '인용', layerClaimShort: '주장', layerFactShort: '확정', memoSearchPh: '메모 검색…', memoSearchEmpty: '검색 결과가 없습니다.',
      quoteAdded: '인용이 메모에 추가되었습니다', quotePickTitle: '어느 메모에 담을까요?', quotePickNew: '새 메모로', memoPin: '인용 모으기', memoPinOn: '인용 모으는 중', sortRecent: '최신순', sortTarget: '대상순', memoRefN: '메모',
      gridPersonCol: '인물', markFlag: '표시', markConfirm: '확인', markSuspect: '의심', markContradict: '모순', markClear: '지우기', marksOnly: '표시만', fullText: '전체', noMarksHint: '아직 표시한 구절이 없습니다. 진술 원문에서 드래그해 표시하세요.',
      autoTag: '자동', autoTitle: '모순 자동 감지', noClaim: '언급 없음', gridTitle: '주장 대조', newBadge: '신규', layerClaim: '주장 · 미확정', layerFact: '확정 · 물증',
      gridHint: '셀을 눌러 확인·의심·모순을 표시하세요', timelineSort: '시간순 정렬', viewSettings: '보기 설정',
      autoNote: '문세라는 사망 추정 시간대 내내 별채에서 잤다고 주장한다. 별채↔본채는 도보 10분, 추정 구간은 5시간 — 왕복이 물리적으로 가능하다.',
      refIntro: '이 게임에서 쓰는 기호와 상태의 읽는 법입니다. 예시는 실제 사건과 무관한 견본이며, 정답을 담고 있지 않습니다.',
      refBlanks: '공란 상태', refSections: '장 상태', refMarks: '셀 마킹',
      refAnn: '주석 하이라이트', refProfSlot: '프로필 슬롯', refReveals: '장 완성 공개', refNewStates: '추가 화면 상태', refSounds: '사운드 지점',
      rvConfirmT: '장 완성 직후', rvConfirmD: '장을 완성하면 관련 정보가 영구 공개된다. 토스트로 사라지지 않는다.',
      rvStmtT: '추가 진술', rvStmtD: '용의자 진술에 문단이 추가되고, 어느 장에서 나왔는지 표시된다. 자기 비밀은 다루지 않는다.',
      rvWinT: '시간축 축소', rvWinD: '사망 추정 구간이 좁혀지고, 이전 범위가 함께 표시된다.',
      rvTargetT: '조사 대상 추가', rvTargetD: '조사 패널에 새 대상이 배너로 공개된다.',
      psEmptyT: '미확인', psEmptyD: '조사로 아직 채우지 못한 슬롯. 점선으로만 표시.', psFillT: '확인', psFillD: '조사로 확보한 단서가 슬롯을 채움. 신규는 배지로 표시.',
      briefTitle: '사건 브리핑', briefSub: '읽기 전 확인', startRead: '진술 읽기 시작', briefNote: '5명의 진술을 먼저 읽습니다. 다 읽으면 1장이 열립니다.',
      skipRead: '건너뛰기', memoLabel: '메모', memoPh: '이 진술에서 눈에 띄는 점\u2026', prev: '이전', next: '다음', openNarrative: '보고서 열기',
      actBelong: '소지품 검사', actSearch: '장소 수색', actPhone: '통화내역 조회', actAlibi: '알리바이 대조', actAutopsy: '시신 정밀 검사', actFixture: '고정물 조사',
      invRemaining: '잔여 조사', invExec: '조사 실행', invLogTitle: '조사 기록', invEmptyLog: '아직 수행한 조사가 없습니다. 왼쪽에서 행동을 골라 실행하세요.', sealRecord: '장 완성',
      invPickAction: '행동을 선택하세요', invPickPerson: '인물 선택', invPickPlace: '장소 선택', invPickPair: '두 인물 선택', invNoTarget: '대상 없음',
      reasonBudget: '잔여 부족', reasonUsed: '이미 사용함', resSolution: '결정적 단서', resRed: '무고한 자의 비밀', resExcl: '용의자 배제', resEmpty: '아무것도 없음', resEmptyTag: '배제 정보',
      cost: '비용', invHint: '조사는 되돌릴 수 없다. 같은 대상은 한 번만 조사한다.', invDone: '조사 완료',
      homeTitle: '사건 파일', resume: '이어하기', campaign: '캠페인', daily: '오늘의 사건', workshop: '워크샵', coop: '협동',
      locked: '잠김', cleared: '클리어', inProgress: '진행 중', unplayed: '미플레이', start: '시작', review: '다시 보기', abandon: '포기', cancel: '취소', quit: '포기하기',
      detailBack: '사건 목록', budgetLabel: '조사 예산', estTime: '예상 소요', estTimeVal: '40\u201360분', suspects: '용의자', suspectsVal: '5명', clearedLabel: '클리어', more: '더 보기',
      notPlayedYet: '아직 플레이하지 않은 사건입니다. 시작하면 프롤로그부터 진행됩니다.', dailyDesc: '매일 새 사건 · 순위표', prologContinue: '계속',
      abandonConfirmT: '사건을 포기할까요?', abandonConfirmD: '진행 상황과 점수가 사라지고 처음부터 시작됩니다.', goHome: '홈',
      planTapHint: '도면을 눌러 크게 보기', planZoomHint: '손가락 두 개로 확대 · 끌어서 이동', planZoomClose: '닫기',
      mapModePlan: '평면도', mapModeGrid: '도식', navProfile: '용의자', mapHint: '평면도에서 시간대별 주장 위치를, 도식 탭에서 주장 대조표를 봅니다 · 둘은 같은 주장을 시각화·구조화한 것',      finishReport: '보고서 제출', finishConfirmT: '이대로 사건을 종결할까요?', finishConfirmD: '제출 후에는 되돌릴 수 없습니다. 완성된 보고서가 사건의 전말이 됩니다.', submit: '제출', resultStory: '사건의 전말', endMine: '내가 재구성한 것', endReal: '실제', resultStuck: '조사 예산을 모두 소진했지만 사건을 종결하지 못했습니다.', backHome: '홈으로', pClaim: '본인 주장', pClues: '발견된 단서', pUnknown: '미확인', slotMotive: '동기', slotOpportunity: '기회', slotMeans: '수단', pNew: '신규', pNoClues: '아직 조사로 확보한 단서가 없습니다.', pNoMemos: '이 인물에 대한 메모가 아직 없습니다.', verdictLabel: '심증', vdCleared: '제외', vdWatching: '주목', vdPrime: '유력', vdNone: '미정', verdictHint: '내 판단일 뿐 · 점수 무관', pGuilt: '유죄 요건', pViewSource: '출처 보기',
      gameTitle: '노바디 라이즈', gameTagline: '모든 진술을 의심하라', soonPrep: '준비 중', playSolo: '혼자 시작', createRoom: '방 만들기', joinRoom: '방 참가', demoOnly: '이 사건은 데모에 포함되지 않았습니다.', narrProg: '진행',
      navOverview: '사건 개요', ovBrief: '사건 브리핑',
      navMemo: '메모', memoTitle: '메모장', quoteMemo: '인용 메모', copyText: '복사', annHint: '문장을 눌러 표시하거나 인용하세요', crossRef: '나란히 보기', focusMode: '집중 모드', navBack: '뒤로', navFwd: '앞으로',
      expandStmt: '진술 펼치기', collapseStmt: '접기', tapExpand: '눌러 펼침', selectHint: '텍스트를 드래그해 표시·인용하세요', depoLabel: '진 술 조 서', relLabel: '관계', fSexAge: '성별·연령', fJob: '직업',
      tgtAll: '전체', tgtNone: '없음', tgtPerson: '인물', tgtStatement: '진술', tgtEvidence: '물증',
      memoEmpty: '아직 메모가 없습니다. 진술 원문에서 문장을 눌러 인용하거나, 새 메모를 추가하세요.', memoNew: '새 메모', memoPh2: '메모 내용…', pMemos: '내 메모', memoSaved: '저장됨', memoEdit: '편집', memoDone: '완료', memoDelete: '삭제', quotedFrom: '인용', memoTarget: '대상',
      bsEmptyT: '비어 있음', bsEmptyD: '미입력. 후보 유형만 힌트로 표시.',
      bsFillT: '채움', bsFillD: '값을 입력함. 최종 제출 전까지 자유롭게 지우거나 바꿀 수 있음.',
      mkConfirmD: '진술이 물증과 일치.', mkSuspectD: '검토 필요.', mkContradictD: '진술이 물증과 충돌.',
      roleFirst: '최초 발견자', roleKeeper: '산장지기', roleSinger: '가수', roleIdol: '아이돌', roleTrainee: '',
    },
    en: {
      caseTitle: 'The Mountain Lodge Case', navCase: 'Case', navClue: 'Clues', navTool: 'Tools', navNarrative: 'Report', navStatements: 'Statements',
      navReference: 'How to read', refShort: 'Guide', navSoon: 'Soon', navInvestigate: 'Investigate', navMap: 'Scene',
      navGraph: 'Graph', graphHint: 'Connections between people and events, revealed by investigation', logHint: 'Investigations and their results accumulate here', soon: 'soon', budget: 'Left', difficulty: 'Difficulty', themeLabel: 'Theme', language: 'Language', settings: 'Settings', toggleLeft: 'Sidebar', themeDark: 'Dark', themeLight: 'Light',
      sidebarNote: 'Only the culprit can lie. The innocent do not lie. They only keep their own secrets.',
      nTitle: 'Case report', nSub: 'Fill every blank to complete a section · submit when ready', sTitle: 'Statements', sSub: 'The five statements, verbatim',
      rTitle: 'State reference', rSub: '2 blank states · 2 section states · cell marks',
      segGrid: 'Structure', segOriginal: 'Statements',
      ovVictimK: 'Victim', ovVictimV: 'Kim Chae-won (30) · Novelist', ovWhenK: 'Est. death', ovWhenV: '03:00 – 08:00',
      ovBodyK: 'Body', ovBodyV: 'No external wounds', ovSceneK: 'Scene', ovSceneV: 'Taped door & window, briquette in brazier',
      secOpen: 'Open', secSealed: 'Confirmed', secLocked: 'Pending', secLockedHint: 'Opens when the previous section is completed', secLockedShort: 'Locked', reopenBtn: 'Reopen', reopenUsed: 'Reopen used', reopenAvail: 'Reopen available', reopenDone: 'Done editing', reopenWarn: 'A section can be reopened only once; once closed it can no longer be edited.',
      secDone: 'Complete', secTodo: 'Incomplete', secFillHint: 'Fill every blank to complete', clearBlank: 'Clear',
      msgFill: 'Fill every blank first.',
      kindPerson: 'Person', kindPlace: 'Place', kindTime: 'Time', kindWeapon: 'Means', kindTrick: 'Circumstance', kindMotive: 'Motive', kindClue: 'Clue', openCand: 'Open', modeProse: 'Prose', modeList: 'List', listUnrev: 'After previous section',
      vPerson: 'Person', vPlace: 'Place', vTime: 'Time', vTool: 'Tool', vMotive: 'Motive', vIdentity: 'Identity', vConceal: 'Concealment', vStaging: 'Staging', vLastSeen: 'Last seen by', vContact: 'Contact', vHideout: 'Hideout', vCause: 'Cause', vItem: 'Item', vTarget: 'Blackmail target',
      srcClosed: 'List', srcCollected: 'Collected', revealedBy: 'revealed on complete', addedStmt: 'Added statement', windowPrev: 'was', newTargetTitle: 'New investigation target', winNarrowed: 'Death window narrowed',
      pickList: 'Choose a candidate', pickWord: 'Pick from collected terms',
      bankTitle: 'Collected terms', bankHint: 'Open candidates you must discover through investigation — means, motive — collect here.',
      bankEmpty: 'No words revealed yet. Confirming a section adds words surfaced by investigation.',
      termMeaning: 'Meaning', termFound: 'Found', termDesc: 'Notes', termMemoRef: 'Notes on this', termQuote: 'Quote', layerClaimShort: 'Claim', layerFactShort: 'Confirmed', memoSearchPh: 'Search notes…', memoSearchEmpty: 'No matching notes.',
      quoteAdded: 'Quote added to the note', quotePickTitle: 'Add to which note?', quotePickNew: 'New note', memoPin: 'Collect quotes', memoPinOn: 'Collecting quotes', sortRecent: 'Recent', sortTarget: 'By target', memoRefN: 'Notes',
      gridPersonCol: 'Person', markFlag: 'Flag', markConfirm: 'Verified', markSuspect: 'Doubtful', markContradict: 'Contradiction', markClear: 'Clear', marksOnly: 'Marked only', fullText: 'Full text', noMarksHint: 'No marked passages yet. Drag in the statement to mark.',
      autoTag: 'auto', autoTitle: 'Auto-detected contradiction', noClaim: 'Not mentioned', gridTitle: 'Claim grid', newBadge: 'New', layerClaim: 'Claim · unverified', layerFact: 'Confirmed · evidence',
      gridHint: 'Click a cell to mark verified · doubtful · contradiction', timelineSort: 'Sort by time', viewSettings: 'View',
      autoNote: 'Sakura claims she slept in the annex through the whole death window. The annex is a 10-min walk from the main house and the window is ~5 hours — a round trip is physically possible.',
      refIntro: 'How to read the symbols and states used in this game. Examples are generic samples unrelated to any case — they contain no answers.',
      refBlanks: 'Blank states', refSections: 'Section states', refMarks: 'Cell marks',
      refAnn: 'Sentence marks', refProfSlot: 'Profile slots', refReveals: 'On-complete reveals', refNewStates: 'Additional states', refSounds: 'Sound cues',
      rvConfirmT: 'On complete', rvConfirmD: 'Completing a section reveals related info permanently — never as a disappearing toast.',
      rvStmtT: 'Added statement', rvStmtD: 'A paragraph is appended to a deposition, tagged with the section that revealed it. Never a self-secret.',
      rvWinT: 'Narrowed window', rvWinD: 'The estimated death window tightens, with the previous range shown.',
      rvTargetT: 'New target', rvTargetD: 'A new investigation target appears as a banner in the panel.',
      psEmptyT: 'Unconfirmed', psEmptyD: 'A slot not yet filled by investigation. Shown as a dashed line only.', psFillT: 'Confirmed', psFillD: 'A clue from investigation fills the slot. New ones carry a badge.',
      briefTitle: 'Case briefing', briefSub: 'Before you read', startRead: 'Start reading statements', briefNote: 'Read all five statements first. The first section opens once you finish.',
      skipRead: 'Skip', memoLabel: 'Memo', memoPh: 'Anything that stands out\u2026', prev: 'Back', next: 'Next', openNarrative: 'Open report',
      actBelong: 'Inspect belongings', actSearch: 'Search a place', actPhone: 'Pull phone records', actAlibi: 'Cross-check alibis', actAutopsy: 'Detailed autopsy', actFixture: 'Examine fixture',
      invRemaining: 'Investigations left', invExec: 'Run', invLogTitle: 'Investigation log', invEmptyLog: 'No investigations yet. Pick an action on the left and run it.', sealRecord: 'Section complete',
      invPickAction: 'Select an action', invPickPerson: 'Pick a person', invPickPlace: 'Pick a place', invPickPair: 'Pick two people', invNoTarget: 'No target needed',
      reasonBudget: 'Not enough left', reasonUsed: 'Already used', resSolution: 'Decisive clue', resRed: "An innocent's secret", resExcl: 'Suspect ruled out', resEmpty: 'Nothing found', resEmptyTag: 'exclusion',
      cost: 'Cost', invHint: 'Investigations cannot be undone. Each target can be investigated once.', invDone: 'Investigated',
      homeTitle: 'Case files', resume: 'Continue', campaign: 'Campaign', daily: 'Daily case', workshop: 'Workshop', coop: 'Co-op',
      locked: 'Locked', cleared: 'Cleared', inProgress: 'In progress', unplayed: 'Not played', start: 'Start', review: 'Review', abandon: 'Abandon', cancel: 'Cancel', quit: 'Abandon',
      detailBack: 'Cases', budgetLabel: 'Budget', estTime: 'Est. time', estTimeVal: '40\u201360 min', suspects: 'Suspects', suspectsVal: '5', clearedLabel: 'cleared', more: 'More',
      notPlayedYet: 'Not played yet. Starting begins from the prologue.', dailyDesc: 'New case daily · leaderboard', prologContinue: 'Continue',
      abandonConfirmT: 'Abandon this case?', abandonConfirmD: 'Your progress and score are lost and the case resets.', goHome: 'Home',
      planTapHint: 'Tap the plan to enlarge', planZoomHint: 'Pinch to zoom · drag to pan', planZoomClose: 'Close',
      mapModePlan: 'Plan', mapModeGrid: 'Diagram', navProfile: 'Suspects', mapHint: 'Compare claimed positions by time on the plan; see the claim grid in the Diagram tab · both are the same claims, visualized and structured',      finishReport: 'Submit report', finishConfirmT: 'Close the case as is?', finishConfirmD: 'This cannot be undone. The completed report becomes the full account.', submit: 'Submit', resultStory: 'The full account', endMine: 'My reconstruction', endReal: 'Actual', resultStuck: 'Budget exhausted before the case could be closed.', backHome: 'Home', pClaim: 'Own claim', pClues: 'Found clues', pUnknown: 'Unconfirmed', slotMotive: 'Motive', slotOpportunity: 'Opportunity', slotMeans: 'Means', pNew: 'New', pNoClues: 'No clues secured through investigation yet.', pNoMemos: 'No notes about this person yet.', verdictLabel: 'Verdict', vdCleared: 'Cleared', vdWatching: 'Watching', vdPrime: 'Prime', vdNone: 'Undecided', verdictHint: 'Your call only · no score effect', pGuilt: 'Guilt criteria', pViewSource: 'View source',
      gameTitle: 'NOBODY LIES', gameTagline: 'Doubt every statement', soonPrep: 'Coming soon', playSolo: 'Start solo', createRoom: 'Create room', joinRoom: 'Join room', demoOnly: 'This case is not part of the demo.', narrProg: 'Progress',
      navOverview: 'Case overview', ovBrief: 'Case briefing',
      navMemo: 'Notes', memoTitle: 'Notebook', quoteMemo: 'Quote to note', copyText: 'Copy', annHint: 'Click a sentence to mark or quote it', crossRef: 'Side-by-side', focusMode: 'Focus mode', navBack: 'Back', navFwd: 'Forward',
      expandStmt: 'Expand', collapseStmt: 'Collapse', tapExpand: 'tap to open', selectHint: 'Drag over text to mark or quote it', depoLabel: 'D E P O S I T I O N', relLabel: 'Relation', fSexAge: 'Sex·Age', fJob: 'Job',
      tgtAll: 'All', tgtNone: 'None', tgtPerson: 'Person', tgtStatement: 'Statement', tgtEvidence: 'Evidence',
      memoEmpty: 'No notes yet. Click a sentence in a transcript to quote it, or add a new note.', memoNew: 'New note', memoPh2: 'Note…', pMemos: 'My notes', memoSaved: 'Saved', memoEdit: 'Edit', memoDone: 'Done', memoDelete: 'Delete', quotedFrom: 'Quote', memoTarget: 'Target',
      bsEmptyT: 'Empty', bsEmptyD: 'No input. Only the candidate type is hinted.',
      bsFillT: 'Filled', bsFillD: 'A value is entered. Freely cleared or changed until final submission.',
      mkConfirmD: 'Claim matches the evidence.', mkSuspectD: 'Needs review.', mkContradictD: 'Claim conflicts with evidence.',
      roleFirst: 'First on scene', roleKeeper: 'Lodge keeper', roleSinger: 'Singer', roleIdol: 'Idol', roleTrainee: '',
    },
  };

  PEOPLE = [
    { id: 'yena', name: '서지안', age: 31, sexKo: '여', sexEn: 'F', role: 'roleFirst', relKo: '아침 도착', relEn: 'Arrived AM', jobKo: '댄스 강사', jobEn: 'Dance instructor', claimKo: '오전에 도착해 가장 먼저 연기를 발견했다고 진술.', ini: '지', color: '#4C8DFF', c1: '#4C8DFF', c2: '#2D9CDB' },
    { id: 'yujin', name: '한유빈', age: 27, sexKo: '여', sexEn: 'F', role: 'roleFirst', relKo: '아침 도착', relEn: 'Arrived AM', jobKo: '아이돌', jobEn: 'Idol', claimKo: '요리를 도우러 일찍 도착, 지안과 함께 발견했다고 진술.', ini: '유', color: '#BB6BD9', c1: '#BB6BD9', c2: '#4C8DFF' },
    { id: 'sakura', name: '문세라', age: 32, sexKo: '여', sexEn: 'F', role: 'roleKeeper', relKo: '산장 거주', relEn: 'Lives on-site', jobKo: '산장지기', jobEn: 'Lodge keeper', claimKo: '전날 밤 본채에서 음주 후 별채에서 잤고, 오전까지 계속 잤다고 진술.', ini: '세', color: '#F2994A', c1: '#F2994A', c2: '#EB5757' },
    { id: 'yuri', name: '오나경', age: 29, sexKo: '여', sexEn: 'F', role: 'roleSinger', relKo: '아침 도착', relEn: 'Arrived AM', jobKo: '가수', jobEn: 'Singer', claimKo: '장을 보고 유빈과 함께 뒤늦게 도착했다고 진술.', ini: '나', color: '#4CB782', c1: '#4CB782', c2: '#2D9CDB' },
    { id: 'wonyoung', name: '백리원', age: 26, sexKo: '여', sexEn: 'F', role: 'roleIdol', relKo: '불참·늦게 출발', relEn: 'Absent, left late', jobKo: '아이돌', jobEn: 'Idol', claimKo: '새벽 3시 피해자의 전화를 받고 늦잠 후 늦게 출발했다고 진술.', ini: '리', color: '#F2C94C', c1: '#F2C94C', c2: '#F2994A' },
  ];
  /**
   * 프로필 단서. **`applyCase` 가 엔진 `action.clues` 에서 다시 만든다** —
   * 이 값은 사건 데이터가 없을 때의 기본값이다. 2026-07-27 이관 당시 도출값이
   * 이것과 **정확히 같음을 실측했다**(9키 · 12항목).
   */
  CLUE_MAP = {
    'search:annex': [{ p: 'sakura', slot: 'motive', ko: '마약 유통망 \u2018김선생\u2019 거래 기록 (별채 대포폰)' }],
    'belongings:sakura': [{ p: 'sakura', slot: 'means', ko: '위장용 유서 초안·금고 열쇠' }],
    'belongings:wonyoung': [{ p: 'wonyoung', slot: 'motive', ko: '\u2018김선생\u2019 추적 정황' }, { p: 'sakura', slot: 'motive', ko: '추적 중이던 번호와 일치하는 연락처' }],
    'phone:wonyoung': [{ p: 'wonyoung', slot: 'opportunity', ko: '새벽 3시 통화·기지국상 원거리' }],
    'alibi:yujin+yuri': [{ p: 'yuri', slot: 'opportunity', ko: '동선 일치 \u2014 사망 시간대 접근 불가' }, { p: 'yujin', slot: 'opportunity', ko: '지안·나경과 동선 일치' }],
    'alibi:yena+yujin': [{ p: 'yena', slot: 'opportunity', ko: '도착 시각 상호 일치' }, { p: 'yujin', slot: 'opportunity', ko: '지안과 도착 시각 일치' }],
    'belongings:yuri': [{ p: 'yuri', slot: 'motive', ko: '약물 투약 흔적 (협박 정황)' }],
    'belongings:yena': [{ p: 'yena', slot: 'motive', ko: '유통 경로 추적 메모' }],
    'belongings:yujin': [{ p: 'yujin', slot: 'motive', ko: '다인 의심 메모' }],
  };

  TIMES = [
    { id: 't0', ko: '전날 밤', en: 'Night before', subKo: '~새벽', subEn: 'to dawn' },
    { id: 't1', ko: '새벽 3시', en: '03:00', subKo: '', subEn: '' },
    { id: 't2', ko: '새벽 3–8시', en: '03:00–08:00', subKo: '사망 추정', subEn: 'death window', window: true },
    { id: 't3', ko: '오전', en: 'Morning', subKo: '발견', subEn: 'discovery' },
  ];

  CLAIMS = {
    yena: { t3: { ko: '본채 · 도착·발견', en: 'Main · arrived' } },
    yujin: { t3: { ko: '본채 · 일찍 도착', en: 'Main · early' } },
    sakura: { t0: { ko: '본채 · 음주', en: 'Main · drinking' }, t1: { ko: '별채', en: 'Annex' }, t2: { ko: '별채 · 수면', en: 'Annex · asleep' }, t3: { ko: '별채 · 수면', en: 'Annex · asleep' } },
    yuri: { t3: { ko: '본채 · 장보기 후', en: 'Main · after shopping' } },
    wonyoung: { t1: { ko: '자택 · 전화 수신', en: 'Home · call' }, t2: { ko: '자택 · 늦잠', en: 'Home · overslept' }, t3: { ko: '이동 중 · 늦게 출발', en: 'En route · late' } },
  };
  /**
   * ⛔ `AUTO = { 'sakura-t2': true }` 를 지웠다 (2026-07-30).
   *
   * **읽는 곳이 하나도 없었다** — 정의 1회, 사용 0회. 프로토타입에도 같은 꼴로
   * 죽어 있다(1449행). 폐기된 「모순 자동 감지」 설계의 잔해다(§절대 규칙이
   * 금지하는 그 기능이라 되살릴 것도 아니다). 격자의 `auto` 는 표기 안내의
   * `auto: false` 리터럴이 먹이므로 이 상수와 무관하다 — 확인했다.
   *
   * 「살아 보이는 것」의 재발이라 지운다 — `COLLECTED_POOL` decoy 셋 ·
   * `REVEALS[].yield` · `statements[].y` · `WALK` 과 같은 부류. 아이콘과 문안까지
   * 갖춘 채 죽어 있으면 다음 사람이 **살아 있는 줄 알고 배선을 찾는다.**
   */
  LOCATIONS = [
    { id: 'main', ko: '본채', en: 'Main house', x: 30, y: 30, w: 44, h: 44 },
    { id: 'room', ko: '다인의 방', en: "Chae-won's room", x: 42, y: 44, w: 26, h: 24, scene: true },
    { id: 'annex', ko: '별채', en: 'Annex', x: 80, y: 16, w: 16, h: 18, gated: 's1' },
    { id: 'approach', ko: '진입로', en: 'Approach', x: 30, y: 82, w: 26, h: 12 },
    { id: 'home', ko: '자택 (현장 밖)', en: 'Home (off-site)', x: 4, y: 6, w: 24, h: 15, offsite: true },
  ];
  FIXTURES = [
    { id: 'hearth', ko: '화로', en: 'Brazier', loc: 'room', x: 46, y: 52, icon: '연탄' },
    { id: 'window', ko: '테이프', en: 'Tape', loc: 'room', x: 62, y: 47, icon: '테이프' },
    { id: 'safe', ko: '금고', en: 'Safe', loc: 'main', x: 34, y: 62, icon: '유서' },
    { id: 'body', ko: '시신', en: 'Body', loc: 'room', x: 54, y: 60, icon: '', body: true },
  ];
  WALK = [{ a: 'main', b: 'annex', min: 10 }, { a: 'main', b: 'approach', min: 2 }];
  CLAIM_LOC = {
    yena: { t3: 'main' }, yujin: { t3: 'main' },
    sakura: { t0: 'main', t1: 'annex', t2: 'annex', t3: 'annex' },
    yuri: { t3: 'main' },
    wonyoung: { t1: 'home', t2: 'home', t3: 'approach' },
  };

  BLANKS = {
    b1: { kind: 'vPerson', src: 'person', ans: '한유빈', par: '이/가' },
    b2: { kind: 'vPerson', src: 'person', ans: '서지안', par: '과/와' },
    b3: { kind: 'vPlace', src: 'place', ans: '다인의 방', par: null },
    b4: { kind: 'vConceal', src: 'collected', ans: '테이프', par: '(으)로' },
    b5: { kind: 'vCause', src: 'collected', ans: '일산화탄소 중독', par: null },
    b6: { kind: 'vTool', src: 'collected', ans: '연탄', par: '을/를' },
    b7: { kind: 'vConceal', src: 'collected', ans: '테이프', par: '(으)로' },
    b8: { kind: 'vStaging', src: 'collected', ans: '유서', par: '을/를' },
    b9: { kind: 'vLastSeen', src: 'person', ans: '문세라', par: null },
    b10: { kind: 'vTime', src: 'time', ans: '새벽 3시', par: null },
    b11: { kind: 'vPlace', src: 'place', ans: '본채', par: null },
    b12: { kind: 'vPerson', src: 'person', ans: '백리원', par: '은/는' },
    b13: { kind: 'vItem', src: 'collected', ans: '마약', par: '이/가' },
    b14: { kind: 'vIdentity', src: 'collected', ans: '김선생', par: null },
    b15: { kind: 'vTarget', src: 'person', ans: '오나경', par: null },
    b16: { kind: 'vPerson', src: 'person', ans: '백리원', par: '이/가' },
    b17: { kind: 'vPerson', src: 'person', ans: '문세라', par: null, nominate: true },
    b18: { kind: 'vMotive', src: 'collected', ans: '폭로 임박', par: '(으)로' },
    b19: { kind: 'vHideout', src: 'collected', ans: '별채 대포폰', par: null },
    b20: { kind: 'vPerson', src: 'person', ans: '문세라', par: null },
  };
  SEC_BLANKS = { s1: ['b1', 'b2', 'b3', 'b4'], s2: ['b5', 'b6', 'b7', 'b8'], s3: ['b9', 'b10', 'b11', 'b12'], s4: ['b13', 'b14', 'b15', 'b16', 'b20'], s5: ['b17', 'b18', 'b19'] };

  SECTIONS = [
    { id: 's1', num: 1, tKo: '도착과 발견', tEn: 'Arrival & discovery', parts: [
      { text: '사건 당일 아침, 요리를 돕기로 한 ' }, { b: 'b1' }, { text: ' 남들보다 일찍 산장에 도착했다. 뒤이어 도착한 ' }, { b: 'b2' }, { text: ' 함께, 두 사람은 ' }, { b: 'b3' }, { text: '에서 새어 나오는 연기를 발견했다. 방문은 안에서 ' }, { b: 'b4' }, { text: ' 막혀 있어 쉽게 열리지 않았다.' },
    ] },
    { id: 's3', num: 2, tKo: '마지막 정황', tEn: 'Last known circumstances', parts: [
      { text: '생전의 윤다인을 마지막으로 본 사람은 ' }, { b: 'b9' }, { text: '였다. ' }, { b: 'b10' }, { text: '까지 두 사람은 ' }, { b: 'b11' }, { text: '에서 함께 술을 마셨다. 한편 ' }, { b: 'b12' }, { text: ' 같은 시각 피해자의 전화를 받았다고 진술했다.' },
    ] },
    { id: 's2', num: 3, tKo: '사인과 현장', tEn: 'Cause & scene', parts: [
      { text: '부검 결과 직접 사인은 ' }, { b: 'b5' }, { text: '으로 확인됐다. 범인은 화로에 ' }, { b: 'b6' }, { text: ' 피워 방을 채우고, 문과 창을 ' }, { b: 'b7' }, { text: ' 밀폐했다. 그리고 자살로 위장하기 위해 현장에 ' }, { b: 'b8' }, { text: ' 놓아두었다.' },
    ] },
    { id: 's4', num: 4, tKo: '감춰진 사건', tEn: 'The hidden crime', parts: [
      { text: '산장에 흘러들던 ' }, { b: 'b13' }, { text: ' 사건의 이면을 드러냈다. 그것은 마약 유통망 ' }, { b: 'b14' }, { text: '의 것이었다. 조직은 ' }, { b: 'b15' }, { text: ' 약물로 붙들어 두고 있었고, 며칠 전 ' }, { b: 'b16' }, { text: ' 그 실체를 캐묻기 시작한 참이었다.' }, { text: ' 그리고 그 이름의 주인은 ' }, { b: 'b20' }, { text: '였다.' },
    ] },
    { id: 's5', num: 5, tKo: '범인과 동기', tEn: 'Culprit & motive', parts: [
      { text: '모든 정황이 한 사람을 가리켰다. 진범은 ' }, { b: 'b17' }, { text: '. 그는 조직이 드러나는 것을 막으려는 ' }, { b: 'b18' }, { text: ' 윤다인을 살해했고, 증거를 ' }, { b: 'b19' }, { text: '에 감췄다.' },
    ] },
  ];

  CAND = { person: ['서지안', '한유빈', '문세라', '오나경', '백리원', '윤다인'], place: ['본채', '다인의 방', '별채', '진입로'], time: ['전날 밤', '새벽 3시', '새벽 3~8시', '오전'] };
  /**
   * 확보 단어 풀. **`applyCase` 가 엔진 `terms` 순서로 다시 만든다** — 이 값은
   * 사건 데이터가 없을 때의 기본값이다.
   *
   * 2026-07-27 에 `수면제`·`둔기`·`유산 상속` 셋을 뺐다. **어느 경로로도 공개되지
   * 않는 단어였다** — 공개하는 곳은 `SEED_TERMS`(2) · `TERM_MAP`(7) ·
   * `REVEALS[].terms`(0, `terms` 를 가진 항목이 없다) 셋뿐이고, 이 배열을 읽는
   * 일곱 곳이 **전부** `revealedTerms()` 로 거른다. 후보에 든 적이 없으므로
   * 난이도에 영향이 0이다.
   */
  COLLECTED_POOL = ['테이프', '연탄', '일산화탄소 중독', '유서', '김선생', '마약', '폭로 임박', '별채 대포폰', '치정'];
  SEED_TERMS = ['테이프', '연탄'];
  ICONS = {
    '테이프': 'M3 6h10v4H3z M5 6l6 4',
    '연탄': 'M4 4h8v8H4z M6.5 4v8 M9.5 4v8 M4 6.5h8 M4 9.5h8',
    '일산화탄소 중독': 'M8 13c3 0 4-2 4-4 0-3-4-6-4-6S4 6 4 9c0 2 1 4 4 4z',
    '유서': 'M4 2.5h6l2.5 2.5v9H4z M9.5 2.5v3H12 M6 8h4 M6 10.5h4',
    '대포폰': 'M5 2.5h6v11H5z M7 12h2',
    '김선생': 'M8 8.5a2 2 0 100-4 2 2 0 000 4z M4 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5',
    '입막음': 'M4 8h8 M4 8c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5',
    '마약': 'M6 4h4v2l-1 5H7L6 6z M6.5 6h3',
    '폭로 임박': 'M8 2v6 M8 11v.5 M2.5 13l5.5-9 5.5 9z',
    '별채 대포폰': 'M5 2.5h6v11H5z M7 12h2 M3 5l1-1',
    '별채': 'M3 7l5-4 5 4v6H3z',
    '치정': 'M8 13S3 9.5 3 6.2A2.2 2.2 0 018 5a2.2 2.2 0 015 1.2C13 9.5 8 13 8 13z',
    '화로': 'M3.5 8h9 M4.5 8c.5 2.5 1.8 3.5 3.5 3.5s3-1 3.5-3.5 M5.5 11.5l-1 1.5 M10.5 11.5l1 1.5 M8 3c1.3 1.4 1.3 2.8 0 4.2C6.7 5.8 6.7 4.4 8 3z',
    '창문': 'M3 3h10v10H3z M8 3v10 M3 8h10',
    '금고': 'M3 3h10v10H3z M10 8a2 2 0 11-4 0 2 2 0 014 0z M11 5.5v.1M11 10.5v.1',
    '책상': 'M2.5 5.5h11 M4 5.5v7 M12 5.5v7 M2.5 9h11',
    '문': 'M4 2.5h8v11H4z M9.5 8v1',
    '침대': 'M2.5 6h11v5 M2.5 8.5h11 M2.5 6v5 M13.5 8.5v2.5 M4.5 6V5h4v1',
    '서랍': 'M3 4h10v8H3z M3 8h10 M6.5 6h3 M6.5 10h3',
    '칼': 'M3 12l6-6 2 2-6 6z M9 6l3-3',
    '영수증': 'M4 2h8v11l-1.3-1-1.3 1-1.3-1-1.3 1-1.3-1L4 13z M6 5h4 M6 7.5h4',
    '열쇠': 'M6 6a2 2 0 104 0 2 2 0 00-4 0z M9.5 7.5l3 3 M11 9l1.5 1.5',
    '병': 'M6.5 2h3v2l1 2v7h-5V6l1-2z M6 8h4',
    '지갑': 'M3 4.5h10v7H3z M10 7.5h3v2h-3z',
    '편지': 'M3 4h10v8H3z M3 5l5 4 5-4',
    '사진': 'M3 3.5h10v9H3z M5.5 7a1 1 0 100-2 1 1 0 000 2z M3 11l3-3 2 2 3-3 2 2',
  };
  TERM_INFO = {
    '테이프': { fk: '다인의 방 · 방문·창가', dk: '문틈과 창문 가장자리가 안쪽에서 발라져 있었다.', fe: "Chae-won's room · door & window", de: 'The door and window edges were taped over from the inside.' },
    '연탄': { fk: '다인의 방 · 화로', dk: '방 안 화로에서 타고 있었다.', fe: "Chae-won's room · brazier", de: 'It was burning in a brazier inside the room.' },
    '일산화탄소 중독': { fk: '시신 정밀 검사', dk: '외상은 없고, 혈중 일산화탄소 농도가 높았다.', fe: 'Detailed autopsy', de: 'No external wounds; blood carbon-monoxide levels were high.' },
    '유서': { fk: '소지품 검사 · 문세라', dk: '완성되지 않은 초안이었고, 필체가 원고와 달랐다.', fe: 'Belongings · Sakura', de: 'An unfinished draft; the handwriting differed from the manuscript.' },
    '김선생': { fk: '별채 수색 · 소지품 검사', dk: '여러 기록에 반복 등장하는 호칭이었다.', fe: 'Annex search · belongings', de: 'A name that recurs across several records.' },
    '마약': { fk: '소지품 검사', dk: '작은 봉지 여러 개로 나뉘어 있었다.', fe: 'Belongings search', de: 'Divided into several small bags.' },
    '폭로 임박': { fk: '별채 수색 · 소지품 검사', dk: '기록에 남은 메시지가 같은 시점을 가리켰다.', fe: 'Annex search · belongings', de: 'Messages in the records pointed to the same moment.' },
    '별채 대포폰': { fk: '별채 수색', dk: '가입자 정보가 없었고, 저장된 번호는 하나뿐이었다.', fe: 'Annex search', de: 'No subscriber on record; only one number was saved.' },
    '치정': { fk: '진술 정황', dk: '진술에 관련 정황이 있었다.', fe: 'Statement context', de: 'Related context appeared in statements.' },
  };
  termIconPath(w) { return this.ICONS[w] || 'M4 4h8v8H4z'; }
  /**
   * 어느 조사가 어느 단어를 주는가. **`applyCase` 가 엔진에서 다시 만든다**
   * (조사 → `gives` → 물증 → `yieldsTerms`) — 이 값은 사건 데이터가 없을 때의
   * 기본값이다. 2026-07-27 이관 당시 도출값이 이것과 **정확히 같음을 실측했다.**
   */
  TERM_MAP = { 'autopsy:body': ['일산화탄소 중독'], 'search:annex': ['별채 대포폰', '김선생', '폭로 임박'], 'belongings:sakura': ['유서'], 'belongings:wonyoung': ['김선생', '마약', '폭로 임박'], 'belongings:yuri': ['마약', '치정'] };
  PLACES = [{ id: 'main', ko: '본채', en: 'Main house' }, { id: 'room', ko: '다인의 방', en: "Chae-won's room" }, { id: 'annex', ko: '별채', en: 'Annex' }, { id: 'approach', ko: '진입로', en: 'Approach' }];
  /**
   * 조사 예산. 엔진 `Case.budget` 과 같아야 한다.
   *
   * **DC export 는 5 로 왔다** — 2026-07-24 난이도 재조정 이전 값이다. 검증기가
   * 기대 조사 6회를 계산하므로 5 면 완주가 막힌다. 여기저기 흩어져 있던 하드코딩
   * 8곳을 이 상수로 모았다 — 두 벌이면 반드시 갈라진다.
   */
  BUDGET = 6;

  /**
   * 난이도 배지. 기본값은 산장이다 — 사건 파일이 `_difficulty` 를 실어 오면 덮인다.
   *
   * ⚠ **전에는 이 값이 JSX 안에 `hard` 리터럴로 박혀 있었다** (2026-07-31 발견).
   * 사건 넷 중 셋이 우연히 hard 라 안 걸렸고 `pipe-organ-workshop`(normal)에서 드러났다.
   * 앱에서 다시 계산하지 않는다 — `verify` 가 계산해 `export-case` 가 실어 보낸다.
   */
  DIFF = 'hard';

  /** 지금 열려 있는 사건의 id. `applyCase` 가 채운다 */
  CASE_ID = 'mountain-lodge';

  /**
   * ★ 홈 목록을 파일에서 받는다 ★ (2026-07-31)
   *
   * 아래 `CASES` 여섯 줄은 **하드코딩**이고 산장 하나만 `real: true` 다. 커밋된
   * 캠페인이 넷이 돼도 **홈에는 산장 하나만 뜨고 나머지는 「준비 중」 껍데기**였다 —
   * 테스터가 한 판 끝내고 홈으로 돌아오면 더 놀 것이 없다.
   *
   * `export-case` 가 `cases/index.json` 을 방출하고 `main.jsx` 가 받아 넘긴다.
   * **못 받으면 아래 내장 목록으로 돈다** — 사건 파일이 없어도 게임이 열리는 것과
   * 같은 규약이다.
   *
   * ⚠ 오늘 같은 부류를 세 곳에서 잡았다(`bundle-single` 의 `CASES` · `export-case` 의
   * 기본 인자 · 여기). **목록을 사람이 손으로 늘리게 두면 사람이 잊는다.**
   */
  applyCatalog(list) {
    if (!Array.isArray(list) || !list.length) return
    const est = (n) => (n <= 3 ? ['20–30분', '20–30 min']
      : n === 4 ? ['30–40분', '30–40 min']
        : ['40–60분', '40–60 min'])
    this.CASES = list.map((e, i) => {
      const [ko, en] = est(e.chapters || 5)
      return {
        n: i + 1, id: e.id, real: true,
        // 생성 사건은 영문 제목이 없다 — 한국어를 그대로 쓴다(빈 칸보다 낫다)
        titleKo: e.title, titleEn: e.title,
        diff: e.diff, estKo: ko, estEn: en,
        /**
         * ★ 장 수와 공란 총수를 남긴다 ★ (2026-08-01) — 전에는 `chapters` 로 `est` 를
         * 계산하고 **버렸다.** 그래서 홈이 「이 사건을 끝냈나」를 물을 수 없었고,
         * 저장 키만 보고 전부 **「진행 중」**으로 찍었다(§otherStatus).
         */
        chapters: e.chapters, blanks: e.blanks,
      }
    })
  }

  INV_ACTIONS = [{ id: 'belongings', k: 'actBelong', cost: 1, mode: 'person' }, { id: 'search', k: 'actSearch', cost: 1, mode: 'place' }, { id: 'phone', k: 'actPhone', cost: 1, mode: 'person' }, { id: 'alibi', k: 'actAlibi', cost: 1, mode: 'pair' }, { id: 'autopsy', k: 'actAutopsy', cost: 1, mode: 'none' }, { id: 'fixture', k: 'actFixture', cost: 1, mode: 'fixture' }];
  PROLOG = ['산길 끝에 산장이 하나 있다. 윤다인은 그곳에서 넉 달째 지내고 있었다. 소설을 쓰기 위해서였지만, 최근 그녀가 완성한 원고는 없었다.', '분위기를 바꿔보려 했는지, 다인은 오랜만에 옛 지인들을 불러 모았다. 초대장은 전날 밤에 돌았고, 다섯 사람이 답했다.', '그날 아침, 가장 먼저 도착한 두 사람이 창밖으로 새어 나오는 연기를 보았다. 방문은 잠겨 있지 않았는데도 열리지 않았다.', '문이 열렸을 때, 윤다인은 이미 숨을 쉬지 않았다.'];
  CASES = [
    { n: 1, real: true, titleKo: '산장 살인사건', titleEn: 'The Mountain Lodge', diff: 'hard', estKo: '40\u201360분', estEn: '40\u201360 min' },
    { n: 2, titleKo: '사건 02', titleEn: 'Case 02', diff: 'normal', estKo: '30\u201340분', estEn: '30\u201340 min' },
    { n: 3, titleKo: '사건 03', titleEn: 'Case 03', diff: 'hard', estKo: '40\u201360분', estEn: '40\u201360 min' },
    { n: 4, titleKo: '사건 04', titleEn: 'Case 04', diff: 'easy', estKo: '20\u201330분', estEn: '20\u201330 min' },
    { n: 5, titleKo: '사건 05', titleEn: 'Case 05', diff: 'normal', estKo: '30\u201340분', estEn: '30\u201340 min' },
    { n: 6, titleKo: '사건 06', titleEn: 'Case 06', diff: 'hard', estKo: '40\u201360분', estEn: '40\u201360 min' },
  ];

  STMT = {
    yena: [
      '요즘에는 소속사에서 춤 레슨을 하고있어요. 다인이가 오랜만에 지인들 모은다길래 초대 받아서 왔어요. 제가 도착했을때에 딱 마침 유빈이도 도착해서 오랜만에 인사를 나누고 있었는데, 창밖으로 무슨 연기같은게 나오고 있더라구요. 저는 또 다인이가 워낙 요리도 못하고 하니까 뭐 태워먹었나 싶었는데. 이게 방에서 나오고 있는거에요? 그래서 급하게 방문을 열려고 했는데. 문이 잠겨있지는 않았는데 이게 안에서 테이프 같은거라도 붙어있는지 아무리 밀고 당겨도 열리지가 않아서 유빈이랑 같이 문을 미니까 그제서야 열렸어요.',
      '문 열자마자 보인건 화로 같은데 피워져있는 연탄이랑 자욱한 연기.. 그리고 창가에도 붙어있는 테이프가 보이더라구요. 유빈이랑 마음이 통했는지 서로 들어가는걸 말리게 됐어요. 그대로 들어가면 위험할 것 같아서 숨참고 들어가서 내가 창문을 열테니까 유빈이보고 다인이를 들처업고 나오라고 지시했어요.',
      '하지만 다인이는 이미.. 숨을 쉬고 있지 않았어요. 몸도 싸늘하게 식어있는걸 보니까 죽은지 좀 된 것 같더라구요.',
    ],
    yujin: [
      '저는 아직도 아이돌을 하고있어요. 리원이는 얼마전에 다인언니랑 싸워서 가기 싫다고 해서 안왔구요. 나경언니가 다인언니 요리 못믿겠다면서 자기가 장을 봐올테니까 조금일찍와서 음식 준비하는거 도와달라고 해서 일찍 도착하게되었어요. 그 이후는 지안언니가 말한 그대로에요. 지안언니가 확실히 예전에 저처럼 추리 프로그램을 해서 그런지 상황 파악이 빠르더라구요.',
      '그런데 좀 이상하긴 해요. 자살할 생각인 사람이 우리를 왜 불렀을까요? 산장이라 너무 늦게발견될까봐 걱정됐던걸까요? 그리고 연탄도.. 좀 이상하고.',
    ],
    sakura: [
      '저는 지금 아이돌 하다가 망하고 공적인 일을 하고 싶지 않아서 다인이 글쓰는거 도와주면서 지내고 있어요. 말이 산장지기지 그냥 다인이가 어질러둔거 좀 치워주고. 먹을꺼 정도 챙겨주는 정도만 하면되는데. 다인이가 벌어둔게 많아서 페이를 많이 챙겨줘서 지낼만 했죠. 그 이외에는 제가 좋아하는 게임 하면서 지내면 되니까 이만큼 좋은 직장이 있을까요?',
      '다인이가 같은 공간에서 지내는거 별로 안좋아해서 전 별채에서 지내고 있어요. 여기서 그다지 멀지 않은데.. 한 걸어서 10분거리 정도?',
      '어제 새벽까지 둘이 술 마시다가 뭐 영감이 왔다 어쩐다 하면서 내쫒길래 저는 별채에 돌아와서 잠들었어요. 오랜만에 많이 마셔서 그런지 잠이 잘 오더라구요. 경찰들이 올때까지 저는 계속 자고있었습니다.',
    ],
    yuri: [
      '저는 아직 가수생활을 하고있어요. 다인언니가 불렀을때부터 요리는 제가 대신해야겠다 생각하고있었죠. 세라언니가 옆에 있는거 알긴하는데 어차피 둘 요리실력이 거기서 거기니까.. 기왕 놀러가는김에 맛있는거 먹으면 좋잖아요?',
      '멤버들 몇명이나 올지 몰라서 준비하려면 꽤 여유있게 준비해야하니까 유빈이한테 도와달라고 연락 미리해놓고.. 장봐와서 도착했는데 이게 도대체 무슨일이에요..?',
    ],
    wonyoung: [
      '새벽3시쯤에 다인언니한테 전화가 왔어요. 자기는 정말 모르는 일인데 너무 미안하다고. 자기도 세라언니한테 받은거였다고. 그래서 어차피 언니 둘 다 여기있고. 오랜만에 다들 모이니까 다 있는데서 사실을 확인하려고 왔어요. 그... 그런 소문 모르세요? 요즘 연예계에 마약이 돌고있다는 소문이요. 저도 당할뻔 했거든요 그거.',
      '유빈언니가 출발할때 원래 슬쩍 같이 타고 오려고 했는데, 새벽에 다인언니 때문에 깨서그런가 피곤해서 늦잠을 자버렸지 뭐에요. 그래서 급하게 준비하고 출발했는데...',
    ],
  };
  HLWORDS = ['별채', '본채', '방', '새벽', '연탄', '테이프', '10분', '자고있', '잠들', '창문', '화로', '전화'];
  STMT_GESTURE = {
    yena: { pre: '지안은 팔짱을 낀 채 담담하게 말했다.', post: '그러고는 잠시 말을 골랐다.' },
    yujin: { pre: '유빈은 손끝으로 탁자를 두어 번 두드리며 입을 열었다.', post: '말끝이 조금 흐려졌다.' },
    sakura: { pre: '세라는 빈 잔을 만지작거렸다.', post: '그러고는 잠깐, 창밖으로 시선을 돌렸다.' },
    yuri: { pre: '나경은 장바구니를 아직 내려놓지 못한 채였다.', post: '되묻는 목소리에 물기가 배어 있었다.' },
    wonyoung: { pre: '리원은 휴대폰을 두 손으로 감싸 쥐었다.', post: '화면을 몇 번 더 확인했다.' },
  };

  /**
   * ─────────────────────────────────────────────────────────────────
   *  사건 파일이 정본인 것들
   * ─────────────────────────────────────────────────────────────────
   *
   * 층은 둘로 가른다 (`docs/NEXT-ACTION.md`):
   *
   *   숫자 · 사실 · 어휘 · **사건 산문**        → 엔진
   *   클래스 · 구조 · 스타일 · **UI 문구**      → 프로토타입(이 파일)
   *
   * 그래서 표를 통째로 갈아끼우지 않고 **필드 단위로** 덮어쓴다. 앱 표는
   * 엔진의 상위집합이다 — 평면도 좌표·영문·역할 라벨은 엔진에 없다.
   * 통째로 바꾸면 그것들이 사라지고, 안 바꾸면 사건이 두 벌이 된다.
   *
   * ★ 덮어쓰는 것만 적는다 ★ 여기 없는 표(조사·확보 단어 후보)는 아직
   * 앱이 정본이다. 조사는 모델이 다르고(앱 6동사×대상 ↔ 엔진 23구체),
   * 후보 풀은 decoy 셋이 앱에만 있다 — 둘 다 결정이 필요하다.
   */
  applyCase(c) {
    if (!c) return
    const ko = (t) => (t && typeof t === 'object' ? t.ko : t) || ''

    /**
     * ★ 저장 키에 사건 id 를 넣는다 ★ (2026-07-29)
     *
     * `nobody-lies:mountain-lodge` 하드코딩이었다. 사건이 하나뿐일 때는 맞았지만
     * **사건을 갈아끼우면 다른 사건의 진행을 덮어쓴다** — 생성 사건을 한 번
     * 플레이하면 산장 사건에서 채운 공란과 상황판이 전부 사라진다.
     *
     * 산장 사건은 `c.id` 가 `mountain-lodge` 라 키가 그대로다 — 저장된 진행이
     * 그대로 열린다.
     */
    if (c.id) this.SAVE_KEY = `nobody-lies:${c.id}`
    // 홈 목록이 「지금 열려 있는 것이 어느 사건인가」를 알아야 상태 칩을 바로 단다
    if (c.id) this.CASE_ID = c.id

    /**
     * 기본 캠페인(산장) 말고 다른 사건인가. `componentDidMount` 가 이걸 보고
     * **바로 시작**한다 — 홈 목록과 사건 상세는 산장 전용 하드코딩이라
     * 다른 사건은 들어갈 문이 없다.
     */
    this._foreignCase = Boolean(c.id) && c.id !== 'mountain-lodge'

    if (typeof c.budget === 'number') this.BUDGET = c.budget
    // 난이도는 `verify` 가 계산해 `export-case` 가 실어 보낸다 — 앱은 받아 쓰기만 한다
    if (c._difficulty) this.DIFF = c._difficulty
    if (c.prologue?.length) this.PROLOG = c.prologue.map(ko)

    /**
     * 사건 제목. **한 번 이으면 이후 모든 사건이 자기 제목으로 뜬다** — 사건마다
     * 손댈 자리가 아니다. `DICT` 의 「산장 살인사건」은 이제 **사건 파일이 없을
     * 때의 폴백**이다(앱이 다른 값에 쓰는 방식 그대로).
     *
     * 안 이어져 있어서 2026-07-29에 드러났다: 레지던시 팔레트로 만든 사건을
     * 열었더니 장소·조사는 전부 그 세계인데 **사이드바 머리만 「산장 살인사건」**
     * 이었다. 박물관 팔레트 때는 생성 제목이 「산장 사건 45035」라 안 보였다 —
     * **세계가 진짜로 바뀌니까 드러났다.**
     *
     * `DICT` 는 클래스 필드라 인스턴스마다 새 객체다. 여기서 고쳐도 다른 사건에
     * 안 새어 나간다.
     */
    if (c.title) {
      const t = typeof c.title === 'object' ? c.title : { ko: c.title }
      this.DICT.ko.caseTitle = t.ko || this.DICT.ko.caseTitle
      /**
       * 영문은 **사건이 줄 때만** 덮어쓴다. 안 그러면 산장의 영문 제목
       * (`The Mountain Lodge Case`)이 한국어로 뭉개진다 — 사건 파일에 `en` 이
       * 없어서다. 앱 표는 엔진의 상위집합이고 **영문은 엔진에 없다.**
       *
       * 다만 **다른 사건**인데 영문이 없으면 한국어를 쓴다. 산장의 영문 제목이
       * 남아 엉뚱한 세계를 가리키는 것보다 낫다.
       */
      if (t.en) this.DICT.en.caseTitle = t.en
      else if (this._foreignCase && t.ko) this.DICT.en.caseTitle = t.ko
    }

    /**
     * ─────────────────────────────────────────────────────────────
     *  사건 브리핑 — **넷 중 셋이 산장 값이었다** (2026-07-30)
     * ─────────────────────────────────────────────────────────────
     *
     * 「사건 개요」의 브리핑 네 줄 가운데 피해자만 도출되고 나머지 셋은
     * `DICT` 의 산장 문자열을 그대로 꽂고 있었다(`renderVals` 의 `overview`).
     * 레지던시 사건에서 눌러서 봤다:
     *
     * ```
     * 사망 추정   새벽 3시 ~ 오전 8시            ← 이 사건 시간대는 「저녁 모임 직후」·「이튿날 조식」
     * 시신        외상 없음                     ← 엔진이 말한 적 없다
     * 현장        방문·창가 테이프, 화로에 연탄   ← ★ 산장 트릭 그 자체 ★
     * ```
     *
     * ★ **또 「이미 있는데 배선만 없다」였다** ★ 산장 YAML 이 `body_state`·
     * `scene_state` 를 **이미 갖고 있고**(26~28행) `schema.ts` 가 파싱하고
     * `to-yaml.ts` 가 왕복시키고 **검증기 §9-2 가 지키기까지 한다**(현장 서술이
     * 조사로 얻을 단어를 말하면 오류). 스키마·타입·왕복·검증이 다 있는데
     * **앱과 생성기 양 끝만** 몰랐다.
     *
     * ⚠ **없으면 줄을 지운다 — 산장 것으로 메우지 않는다.** 생성기는 아직
     * `bodyState`·`sceneState` 를 내지 않는다. 「외상 없음」은 트릭에 따라 거짓일
     * 수 있고(`staged_suicide` 는 도구 자국이 남는다) 현장 서술은 §9-2 때문에
     * **씨앗 단어로만** 쓸 수 있어서, 기계가 지어내면 없는 사실을 만드는 것이다.
     * **두 줄이 비는 브리핑이 거짓인 브리핑보다 낫다.**
     *
     * 사망 추정은 다르다 — **창 슬롯이 곧 그 값이다.** 도출한다.
     */
    if (this._foreignCase) {
      const winSlots = (c.slots ?? []).filter((s) => s.isWindow)
      if (winSlots.length) {
        const first = winSlots[0].label, last = winSlots[winSlots.length - 1].label
        const span = winSlots.length > 1 ? `${first} ~ ${last}` : String(first)
        this.DICT.ko.ovWhenV = span
        this.DICT.en.ovWhenV = span
      }
      // 엔진이 말한 것만 쓴다. 빈 문자열이면 `buildDetail` 이 그 줄을 안 그린다
      const bs = c.incident?.bodyState, ss = c.incident?.sceneState
      const pick = (v) => (typeof v === 'object' ? v?.ko : v) || ''
      this.DICT.ko.ovBodyV = pick(bs)
      this.DICT.en.ovBodyV = (bs && bs.en) || pick(bs)
      this.DICT.ko.ovSceneV = pick(ss)
      this.DICT.en.ovSceneV = (ss && ss.en) || pick(ss)
    }

    /**
     * ★ 사망 구간 축소도 산장 것이 새고 있었다 ★ (2026-07-30)
     *
     * `deathNarrowed()` 가 **「아무 부검이나 했으면 참」**이었고, 좁혀진 라벨은
     * `'새벽 3~5시'` 가 **두 자리에 글자로** 박혀 있었다(격자 열 머리 · 브리핑).
     * 그래서 박물관 사건에서 부검을 실행하면 창 열 이름이 「야간 순찰 시간」에서
     * **「새벽 3~5시」로 바뀌었다.**
     *
     * ⚠ **나는 이걸 화면에서 보고 지나쳤다.** 오늘 아침 `FLOOR_CLUES` 를 고치며
     * 뽑은 격자 출력에 이미 `"새벽 3~5시"` 가 있었고, **「축소가 작동한다」고
     * 읽었다.** 같은 부류를 고치는 중에도 같은 부류를 놓쳤다.
     *
     * **축소는 사건 파일이 선언한다** — 산장은 `reveals` 에 `narrows_window: [t1, t2]`
     * 가 있고(YAML 1077행) `schema.ts` 가 `narrowsWindow` 로 파싱한다. 선언이
     * 없으면 좁혀지지 않는다. 생성기는 아직 안 내므로 생성 사건은 **창 이름이
     * 그대로 남는다** — 그게 사실이다.
     *
     * 🎯 **남은 것**: `deathCells` ≥ 2 면 생성기가 축소를 낼 수 있다(창 셋 → 둘).
     * 좁혀진 라벨도 **남은 칸의 이름표에서 도출**되므로 저작이 필요 없다.
     * 이번 세션에서는 안 했다 — 누설을 막는 것과 기능을 더하는 것은 다른 일이다.
     */
    this._narrowSlots = (() => {
      const r = (c.reveals ?? []).find((x) => x?.narrowsWindow?.length)
      return r ? r.narrowsWindow.slice() : null
    })()

    /**
     * 씨앗 단어 — 진술 정독만으로 확보되는 것. 조사가 필요 없다.
     *
     * 앱 하드코딩(`테이프`·`연탄`)이 남아 있어서 **생성 사건이 산장 사건의 씨앗을
     * 들고 시작했다.** 1장이 조사 없이 확정되려면 이 단어들이 맞아야 한다.
     */
    if (c.seedTerms?.length) this.SEED_TERMS = c.seedTerms

    /**
     * ─────────────────────────────────────────────────────────────
     *  구조 이관 (2026-07-29) — 인물 · 진술 · 시간 · 장소
     * ─────────────────────────────────────────────────────────────
     *
     * 여기까지 오기 전에는 **사건 파일을 갈아끼워도 앱이 산장 사건을 렌더했다.**
     * 이름·나이·직업·진술이 전부 이 파일에 하드코딩돼 있었기 때문이다.
     * 검증기를 통과한 생성 사건이 「검증 통과 + 렌더 불가」였던 이유가 이것이다.
     *
     * ★ 앱 표는 엔진의 상위집합이다 ★ 색·이니셜·아바타·영문·역할 라벨은 엔진에
     * 없다. 그래서 통째로 갈지 않고 **엔진이 가진 필드만** 덮어쓰고 나머지는 같은
     * 자리의 앱 값을 물려받는다 — `COLLECTED_POOL` 이 쓴 방식과 같다.
     *
     * ★ 용의자는 언제나 5명이다 ★ (`SYSTEM-DECISIONS.md` §3) 그래서 자리 수가
     * 이미 맞고, 인원을 맞추는 코드가 필요 없다. 어긋나면 경고를 남긴다.
     */
    if (c.people?.length) {
      const slots = this.PEOPLE
      if (c.people.length !== slots.length && typeof console !== 'undefined') {
        console.warn(
          `[case] 엔진 인물 ${c.people.length}명 · 앱 자리 ${slots.length}칸 — 용의자는 5명이어야 한다`,
        )
      }

      /**
       * ★ 자리는 인덱스가 아니라 `id` 로 맞춘다 ★
       *
       * 엔진 인물 순서와 앱 자리 순서가 다르다(엔진은 `sakura` 가 먼저, 앱은
       * `yena` 가 먼저). 인덱스로 물려받으면 **같은 인물의 색이 뒤바뀌고**
       * 「같은 인물인가」 판정이 전부 거짓이 되어 **영문이 통째로 버려진다** —
       * 2026-07-27 에 확보 단어에서 잡았던 그 결함과 같은 부류다.
       *
       * 그리고 **앱 자리 순서를 유지한다.** 진술 정독 순서는 저작이지 데이터가
       * 아니다 — 엔진 순서로 재배열하면 범인이 첫 번째로 읽히게 된다.
       */
      const engineById = new Map(c.people.map((p) => [p.id, p]))
      const matched = slots.filter((s) => engineById.has(s.id))
      const freeSlots = slots.filter((s) => !engineById.has(s.id))
      const newcomers = c.people.filter((p) => !slots.some((s) => s.id === p.id))

      /**
       * **같은 인물이면 앱 문안을 물려받고 새 인물이면 버린다.**
       * 남기면 생성 사건의 인물에 「산장 거주」 같은 거짓 라벨이 붙는다 —
       * 엔진에 대응 필드가 없는 것(`relKo`·영문)은 지우는 쪽이 맞다.
       */
      const merge = (slot, p, same) => {
        const nm = p.name || slot.name || ''
        return {
          ...slot,
          id: p.id,
          name: nm,
          age: p.age ?? slot.age,
          // 이니셜은 이름 둘째 글자다 (서지안 → 지 · 문세라 → 세)
          ini: nm.slice(1, 2) || nm.slice(0, 1) || slot.ini,
          jobKo: p.job || (same ? slot.jobKo : ''),
          jobEn: same ? slot.jobEn : '',
          sexKo: p.sex || (same ? slot.sexKo : ''),
          sexEn: same ? slot.sexEn : '',
          claimKo: ko(p.claimSummary) || (same ? slot.claimKo : ''),
          relKo: same ? slot.relKo : '',
          relEn: same ? slot.relEn : '',
          /**
           * ⚠ **역할 라벨은 물려주지 않는다** (2026-07-29).
           *
           * `role` 은 `...slot` 으로 딸려오는데 그 값이 **산장 사건의 사실**이다 —
           * `roleKeeper`(산장지기) · `roleIdol`(아이돌) · `roleSinger`(가수) ·
           * `roleFirst`(최초 발견자). 엔진은 `role` 을 아예 주지 않는다.
           *
           * 그래서 레지던시 사건의 진술 정독에 **「명지수 · 산장지기」·「배도현 ·
           * 아이돌」**이 떴다(첫 산문 왕복에서 잡았다). 제목·프롤로그·피해자·브리핑과
           * **같은 부류** — 앱 표가 엔진의 상위집합이라 안 지우면 옛 세계가 남는다.
           *
           * `relKo`·`jobEn` 과 같은 규칙으로 **새 인물이면 버린다.** 대신
           * `buildReadCard` 가 비었을 때 직업으로 떨어진다.
           */
          role: same ? slot.role : '',
        }
      }

      this.PEOPLE = [
        ...matched.map((s) => merge(s, engineById.get(s.id), true)),
        ...newcomers.map((p, i) => merge(freeSlots[i] || slots[slots.length - 1] || {}, p, false)),
      ]

      /**
       * 진술 원문과 지문. **전원분이 있을 때만 갈아끼운다** — 일부만 덮어쓰면
       * 새 사건의 인물과 산장 사건의 진술이 한 화면에 섞인다. 부분은 경고로 남긴다
       * (조용한 탈락이 2026-07-27 에 영문 결함을 살려뒀다).
       */
      const stmt = {}
      const gest = {}
      for (const p of c.people) {
        if (p.statement?.paragraphs?.length) stmt[p.id] = p.statement.paragraphs.map(ko)
        const g = p.statement?.gesture
        if (g && (g.pre || g.post)) gest[p.id] = { pre: ko(g.pre), post: ko(g.post) }
      }
      const full = (m) => Object.keys(m).length === c.people.length
      if (full(stmt)) this.STMT = stmt
      else if (Object.keys(stmt).length && typeof console !== 'undefined') {
        console.warn(`[case] 진술 원문이 ${Object.keys(stmt).length}/${c.people.length}명분뿐이라 갈아끼우지 않았다`)
      }
      if (full(gest)) this.STMT_GESTURE = gest
      else if (Object.keys(gest).length && typeof console !== 'undefined') {
        console.warn(`[case] 지문이 ${Object.keys(gest).length}/${c.people.length}명분뿐이라 갈아끼우지 않았다`)
      }

      /**
       * ★ 평면도의 인물 마커 — **주장한 위치** ★ (2026-07-29 신설)
       *
       * `CLAIM_LOC` 이 산장 인물(`sakura`·`wonyoung`)과 산장 장소(`annex`·`home`)로
       * 굳어 있었다. 생성 사건은 인물이 `p1..p5` 라 **한 명도 안 맞아** 마커가
       * 전부 `shown:false` 로 떨어졌다 — 도면이 *"시간대를 넘기면 각 인물이
       * '주장한' 위치로 이동합니다"* 라고 적어놓고 **아무도 안 움직였다.**
       * `applyCase` 가 안 덮어쓰던 것 하나가 더 있었던 셈이다.
       *
       * ⚠ **`presence` 가 아니라 「말한 것」이다.** 범인은 `claim`(거짓말), 무고한
       * 사람은 `claim` 이 없으니 `presence` 가 곧 주장이다 — 엔진 §statementOf 와
       * **같은 입력**을 써야 진술과 도면이 어긋나지 않는다. 진실을 그리면 그게
       * 곧 정답 누설이고 §절대 규칙의 「평면도는 판정하지 않는다」 위반이다.
       */
      const claimLoc = {}
      for (const p of c.people) {
        const cells = p.claim?.length ? p.claim : p.presence
        if (!cells?.length) continue
        const m = {}
        for (const x of cells) if (x.slot && x.location) m[x.slot] = x.location
        if (Object.keys(m).length) claimLoc[p.id] = m
      }
      if (Object.keys(claimLoc).length === c.people.length) this.CLAIM_LOC = claimLoc
      else if (Object.keys(claimLoc).length && typeof console !== 'undefined') {
        console.warn(`[case] 주장 위치가 ${Object.keys(claimLoc).length}/${c.people.length}명분뿐이라 갈아끼우지 않았다`)
      }
    }

    /**
     * 시간 축. 격자의 열이고 개수가 사건마다 다를 수 있다 —
     * 산장은 넷(`t0~t3`), 생성 사건은 셋이다.
     *
     * `window`(사망 추정 구간)를 **매번 다시 만든다.** `...old` 로 물려받으면
     * 엔진이 옮긴 사망 구간이 옛 열에 그대로 남아 두 곳이 된다.
     */
    if (c.slots?.length) {
      const prev = {}
      for (const t of this.TIMES) prev[t.id] = t
      this.TIMES = c.slots.map((s) => {
        const old = prev[s.id] || {}
        /**
         * ★ 부제(`subKo`)를 물려받으면 안 된다 — 산장 슬롯 순서로 새고 있었다 ★
         * (2026-07-30 실측, 3칸 사건 격자)
         *
         * `prev` 가 **슬롯 id 로** 키잉돼 있어서 산장의 `t2='사망 추정'`·`t3='발견'`
         * 이 생성 사건의 **중반·후반 칸**에 그대로 얹혔다:
         *
         *     전날 밤[~새벽] │ 새벽(전반) │ 새벽(중반)[사망 추정] │ 새벽(후반)[발견] │ 아침[]
         *                                                        ↑ 발견이 사망 구간 한복판
         *
         * 07-30에 걷어낸 다섯(`FLOOR_CLUES`·`CLAIMS`·`AUTO`·브리핑·축소 라벨)과
         * **같은 부류의 여섯째**이고, 게이트 7단은 그때도 초록이었다.
         *
         * 부제는 **`isWindow` 에서 도출한다** — 엔진이 말한 것만 쓴다. 「발견」은
         * 엔진이 어느 칸에서 발견됐다고 말한 적이 없으므로 **안 만든다**(빈 칸).
         * 산장은 저작된 표를 그대로 쓴다 — `_foreignCase` 가 아니면 불변.
         */
        const sub = this._foreignCase
          ? (s.isWindow ? { subKo: '사망 추정', subEn: 'death window' } : { subKo: '', subEn: '' })
          : { subKo: old.subKo || '', subEn: old.subEn || '' }
        return {
          id: s.id,
          ko: s.label || old.ko || s.id,
          en: old.en || '',
          ...sub,
          ...(s.isWindow ? { window: true } : {}),
        }
      })
    }

    /**
     * 장소는 **이름표만** 받는다. 좌표·건물·해치는 평면도이고 엔진에 없다.
     *
     * ⚠ 그래서 **앱 도면에 없는 장소는 아직 갈 수 없다.** 생성 사건의
     * `hall`·`away` 가 여기 걸린다 — 좌표 생성은 다음 단계다. 조용히 버리지
     * 않고 콘솔에 남긴다.
     */
    if (c.locations?.length) {
      const known = new Map(this.LOCATIONS.map((l) => [l.id, l]))
      const missing = c.locations.filter((l) => !known.has(l.id))

      if (!missing.length) {
        /**
         * 앱이 이 사건의 장소를 전부 안다 — 이름표만 받고 좌표는 그대로 둔다.
         * 손으로 맞춘 도면을 엔진 좌표로 덮으면 눈으로 확인할 수 없는 변화가 된다.
         *
         * ⚠ **앱 이름이 엔진 이름으로 시작하면 앱 쪽을 남긴다.**
         * `자택` ← 엔진(어휘) · `자택 (현장 밖)` ← 앱(UI 설명). 엔진 것으로
         * 덮으면 평면도 구역은 「자택 (현장 밖)」인데 다른 화면은 「자택」이 되어
         * **한 사건이 두 이름을 갖는다.** 층 구분대로 어휘는 엔진, 덧붙인 설명은 앱이다.
         */
        this.LOCATIONS = c.locations.map((e) => {
          const prev = known.get(e.id)
          const keep = e.label && prev.ko && prev.ko.startsWith(e.label) ? prev.ko : (e.label || prev.ko)
          return { ...prev, ko: keep }
        })
      } else {
        /**
         * 모르는 장소가 있다 — **도면을 통째로 엔진 좌표로 다시 만든다.**
         *
         * ★ 좌표계를 섞지 않는다 ★ 아는 것은 앱 백분율, 모르는 것은 엔진
         * viewBox 로 두면 두 자가 한 도면에 섞여 겹치고 어긋난다. 전부 한쪽에서
         * 온 좌표여야 배치가 성립한다.
         *
         * 조사 화면이 곧 도면이라 **좌표가 없으면 그 장소에 갈 수가 없다.**
         * 생성 사건이 여기 걸려 있었다(2026-07-29).
         */
        const fp = c.floorPlan
        if (!fp?.viewBox?.w) {
          if (typeof console !== 'undefined') {
            console.warn(
              '[case] 엔진 장소가 앱 도면에 없는데 floor_plan 도 없다 — 갈 수 없다:',
              missing.map((l) => l.label || l.id).join(' · '),
            )
          }
        } else {
          const boxes = [...(fp.rooms ?? []), ...(fp.zones ?? [])]
          const pct = (v, total) => Math.round((v / total) * 1000) / 10
          const built = []
          for (const e of c.locations) {
            const b = boxes.find((x) => x.loc === e.id)
            const prev = known.get(e.id)
            if (!b) {
              if (prev) built.push({ ...prev, ko: e.label || prev.ko })
              else if (typeof console !== 'undefined') {
                console.warn(`[case] 장소 '${e.label || e.id}' 가 floor_plan 에 없어 갈 수 없다`)
              }
              continue
            }
            built.push({
              id: e.id,
              ko: e.label || b.label || e.id,
              en: prev?.en ?? '',
              x: pct(b.x, fp.viewBox.w), y: pct(b.y, fp.viewBox.h),
              w: pct(b.w, fp.viewBox.w), h: pct(b.h, fp.viewBox.h),
              ...(b.scene ? { scene: true } : {}),
              ...(e.atLodge === false ? { offsite: true } : {}),
            })
          }
          if (built.length) this.LOCATIONS = built

          /**
           * **`GEO` 가 진짜 평면도다.** 조사 화면이 이것을 그린다.
           *
           * 엔진 `floor_plan` 과 **모양도 값도 같다** — `vb`·`scale`·`buildings`·
           * `rooms`·`zones`·`doors`·`windows`·`walks`, 그리고 산장 사건의 좌표가
           * 글자까지 일치한다. 엔진이 정본으로 쓰라고 만들어둔 자리인데 배선만
           * 안 돼 있었다. 이름만 다르다(`b`↔`building` · `ko`↔`label`).
           *
           * 영문(`en`)은 엔진에 없다 — 같은 id 가 앱에 있으면 물려받는다.
           */
          const prevBy = (arr) => new Map((arr ?? []).map((x) => [x.id, x]))
          const oldRooms = prevBy(this.GEO?.rooms)
          const oldZones = prevBy(this.GEO?.zones)
          const oldDoors = prevBy(this.GEO?.doors)
          const box = (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })

          this.GEO = {
            vb: { w: fp.viewBox.w, h: fp.viewBox.h },
            ...(fp.scale ? { scale: fp.scale } : {}),
            buildings: (fp.buildings ?? []).map((b) => ({
              id: b.id, ...box(b),
              ...(b.poche ? { poche: b.poche } : {}),
              ...(b.revealedAfter !== undefined ? { revealedAfter: b.revealedAfter } : {}),
            })),
            rooms: (fp.rooms ?? []).map((r) => ({
              ...oldRooms.get(r.id), id: r.id, ...box(r),
              ...(r.building ? { b: r.building } : {}),
              ...(r.loc ? { loc: r.loc } : {}),
              ko: r.label ?? r.id,
              en: oldRooms.get(r.id)?.en ?? '',
              ...(r.scene ? { scene: true } : {}),
              ...(r.tint ? { tint: r.tint } : {}),
              ...(r.primary ? { primary: true } : {}),
            })),
            zones: (fp.zones ?? []).map((z) => ({
              ...oldZones.get(z.id), id: z.id, ...box(z),
              ...(z.loc ? { loc: z.loc } : {}),
              ko: z.label ?? z.id,
              en: oldZones.get(z.id)?.en ?? '',
              ...(z.hatch ? { hatch: true } : {}),
              ...(z.offsite ? { offsite: true } : {}),
              ...(z.primary ? { primary: true } : {}),
            })),
            doors: (fp.doors ?? []).map((d) => ({
              ...oldDoors.get(d.id), id: d.id,
              x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
              ...(d.hinge ? { hinge: d.hinge } : {}),
              ...(d.swing !== undefined ? { swing: d.swing } : {}),
              ...(d.open ? { open: true } : {}),
              ...(d.ext ? { ext: true } : {}),
              ...(d.building ? { building: d.building } : {}),
              ...(d.label ? { ko: d.label } : {}),
              ...(d.lx !== undefined ? { lx: d.lx, ly: d.ly } : {}),
            })),
            windows: (fp.windows ?? []).map((w) => ({
              x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
              ...(w.building ? { building: w.building } : {}),
              ...(w.label ? { ko: w.label } : {}),
              ...(w.lx !== undefined ? { lx: w.lx, ly: w.ly } : {}),
            })),
            walks: (fp.walks ?? []).map((w) => ({
              x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
              ...(w.building ? { b: w.building } : {}),
              ...(w.min !== undefined ? { min: w.min } : {}),
            })),
            /**
             * ⚠ **설비 좌표 map 을 같이 만든다** (2026-07-29).
             *
             * 도면 렌더가 `GEO.fixtures[f.id]` 로 좌표를 찾는데, 다시 만든 `GEO`
             * 에는 이 칸이 없었다. 전에는 생성 사건의 `FIXTURES` 가 **비어 있어서**
             * 그 반복문이 한 번도 안 돌아 드러나지 않았다 — 엔진이 고정물을 내기
             * 시작하자 첫 렌더에서 죽었다. 「없는 것이 다른 없는 것을 가리고 있었다」
             */
            fixtures: Object.fromEntries(
              Object.entries(fp.fixtures ?? {}).map(([id, f]) => [id, { x: f.x, y: f.y }]),
            ),
          }

          // 고정물은 이 사건 것만 남긴다 — 안 비우면 이전 사건의 화로·테이프가
          // 새 도면에 남아 누를 수 있는 지점으로 뜬다
          /**
           * ⚠ **`loc` 을 빠뜨리면 좌표가 있어도 안 그려진다** (2026-07-29).
           *
           * 도면이 고정물을 `revealedLocs[f.loc]` 로 거른다 — 그 장소가 공개됐을
           * 때만 점을 찍는다. 여기서 `loc` 을 안 담아서 `undefined` 가 되고,
           * 생성 사건의 고정물이 **전부 사라졌다.** 앱 표(산장)에는 `loc` 이
           * 박혀 있어서 이 구멍이 안 보였다.
           *
           * 엔진이 `loc` 을 주면 그것을, 안 주면 **키를 장소 id 로 본다** —
           * 생성기가 `fixture:<장소>` 로 키잉하므로 그게 곧 장소다.
           */
          this.FIXTURES = Object.entries(fp.fixtures ?? {}).map(([id, f]) => ({
            id, ko: f.label ?? id, en: '', x: f.x, y: f.y, icon: '', loc: f.loc ?? id,
            /**
             * ⚠ **`body` 를 안 넘기고 있었다.** 아래 §buildFloorplan 이 이 플래그로
             * 시신을 가른다 — 붉게 · 아이콘 없이 그리고, 누르면 `fixture` 가 아니라
             * `autopsy` 를 돌린다. 안 넘어오면 시신이 **다른 설비와 똑같이 생기고
             * 「고정물 조사」로 실행**된다.
             */
            ...(f.body ? { body: true } : {}),
          }))

          /**
           * 도보 시간표. 항목이 **장소 쌍**(`{a, b, min}`)이다.
           *
           * ★ 여기 `this.WALK = []` 이 있었다 ★ 근거는 *"엔진 `walks` 는 좌표
           * 선분이라 쌍을 도출할 수 없다. 지어내느니 비우는 쪽이 맞다"* 였고,
           * **그때는 맞았다.** 이제 엔진이 `from`·`to` 를 장소로 준다
           * (`types.ts` §walks) — 지어내지 않고 **읽어서** 채운다.
           *
           * 비어 있던 대가는 조용했다: 아래 §도보 시간 join 이 크기가 안 맞아
           * 생성 사건마다 *"엔진과 다르다 — 이 표는 앱 값을 쓴다"* 를 찍었는데,
           * **앱 값도 없어서**(빈 배열) 아무것도 안 쓰고 있었다.
           */
          this.WALK = (fp.walks ?? [])
            .filter((w) => w.from && w.to && w.min !== undefined)
            .map((w) => ({ a: w.from, b: w.to, min: w.min }))

          if (typeof console !== 'undefined') {
            console.info(
              `[case] 평면도를 엔진 좌표로 다시 만들었다 — 장소 ${built.length}곳 · ` +
                `방 ${this.GEO.rooms.length} · 구역 ${this.GEO.zones.length} · 고정물 ${this.FIXTURES.length}`,
            )
          }
        }
      }
    }

    /**
     * 확보 단어 — 출처·기록·**풀 자체**가 엔진 정본이다. 2026-07-26 대조에서
     * 엔진 쪽 네 문장이 쉼표에서 잘려 있던 것을 잡아 고쳤다
     * (`scripts/yaml-comma-check.mjs`).
     *
     * **영문도 함께 받는다 (2026-07-27).** 예전엔 `ko` 만 덮어써서 엔진이 써둔
     * `en` 이 버려지고 앱의 낡은 값이 영문 모드에 그대로 렌더됐다 — `테이프`·
     * `연탄` 의 출처가 **피해자 옛 이름** `"Chae-won's room"` 이었다.
     * `GRAPH_NODES` 에서 같은 부류를 잡은 바로 그날 이쪽은 살아 있었다.
     *
     * **풀은 엔진 순서로 다시 만든다.** 단 앱에 표시 정보(`TERM_INFO`)가 없는
     * 단어는 넣지 않는다 — 지금은 `영수증`·`물자국` 둘이고, 엔진에서는 트릭의
     * 핵심(`e_receipt` 시각 · `e_dryice` 가짜 연기)인데 앱에 대응 화면이 없다.
     * **조용히 버리지 않고 콘솔에 남긴다** — 이 침묵이 위 영문 결함을 살려뒀다.
     */
    const en = (t) => (t && typeof t === 'object' ? t.en : '') || ''
    const pool = []
    const dropped = []
    for (const t of c.terms ?? []) {
      /**
       * **앱에 없는 단어는 만들어 넣는다** (2026-07-29 뒤집음).
       *
       * 전에는 표시 정보(`TERM_INFO`)가 없으면 버렸다. 산장 사건에서는 `영수증`·
       * `물자국` 둘뿐이라 괜찮았지만, **생성 사건은 단어가 전부 새것이라 풀이
       * 통째로 안 채워졌다** — 확보 단어 은행이 산장 단어로 남고 `discovered`
       * 공란의 후보가 틀렸다.
       *
       * 출처·설명은 엔진이 준다. 앱에만 있는 것은 아이콘인데
       * `termIconPath()` 에 폴백이 있어서 없어도 렌더된다.
       */
      let cur = this.TERM_INFO[t.word]
      if (!cur) {
        cur = this.TERM_INFO[t.word] = { fk: '', dk: '', fe: '', de: '' }
        if (!this.ICONS[t.word]) dropped.push(t.word)
      }
      if (t.source) {
        cur.fk = ko(t.source)
        if (en(t.source)) cur.fe = en(t.source)
      }
      if (t.note) {
        cur.dk = ko(t.note)
        if (en(t.note)) cur.de = en(t.note)
      }
      pool.push(t.word)
    }
    if (pool.length) this.COLLECTED_POOL = pool
    if (dropped.length && typeof console !== 'undefined') {
      console.info('[case] 확보 단어 아이콘이 없어 기본 도형으로 그린다:', dropped.join(' · '))
    }

    /**
     * 어느 조사가 어느 단어를 주는가 (`TERM_MAP`). 2026-07-27 이관.
     *
     * 경로는 **조사 → `gives` → 물증 → `yieldsTerms`** 다. 앱 키는
     * `verb:target.id` 이고 그 `verb` 가 2026-07-27 에 엔진에 생겼다 —
     * 그전에는 동사가 `label` 산문 접두에만 있어 이을 수가 없었다.
     *
     * 거르는 것 둘:
     * - **풀에 없는 단어** — `영수증`·`물자국`. 엔진 전용 물증이고 앱에 표시
     *   정보가 없다. 넣어도 읽는 쪽이 전부 풀로 거르므로 죽은 값이 된다
     * - **씨앗 단어**(`SEED_TERMS`) — 진술 정독으로 이미 무조건 주어진다.
     *   여기 적으면 조사 기록에 **「발견」 배지만 거짓으로 뜬다**(이미 가진
     *   단어를 새로 찾았다고 말하는 것이다)
     *
     * 두 필터를 거치면 결과가 **앱 하드코딩과 정확히 같다** — 이관이지
     * 동작 변경이 아니다. 실측으로 확인했다.
     */
    /**
     * 도면 표식은 **엔진이 조사를 안 줘도 산장 것을 남기지 않는다.**
     *
     * 아래에서 엔진 것으로 다시 만드는데, 그 블록은 `actions`·`evidence` 가 둘 다
     * 있어야 돈다. 앱의 `INV_ACTIONS` 여섯은 **사건과 무관하게 하드코딩**이라
     * 엔진 조사가 없어도 부검은 실행되고, 그러면 `autopsy:body` 가 다시 산장 표에
     * 맞아버린다. **빈 표가 옳다** — 엔진이 말하지 않은 자리에는 표식이 없다.
     */
    if (this._foreignCase) this.FLOOR_CLUES = []
    if (c.actions?.length && c.evidence?.length) {
      const yields = {}
      for (const e of c.evidence) if (e.yieldsTerms?.length) yields[e.id] = e.yieldsTerms
      const inPool = new Set(this.COLLECTED_POOL)
      const seeds = new Set(this.SEED_TERMS || [])
      const map = {}
      const skipped = new Set()
      /**
       * 앱 키(`verb:대상`) → 엔진 조사. `resultFor` 폴백과 조사 대상 목록이 읽는다.
       * 키를 만들 수 없는 조사(`target` 도 `pair` 도 없는 것)는 **앱이 지목할 수
       * 없다** — 검증기가 2026-07-27부터 경고한다.
       */
      const byKey = {}
      for (const a of c.actions) {
        if (!a.verb) continue
        const k = a.pair
          ? a.verb + ':' + a.pair.slice().sort().join('+')
          : a.target ? a.verb + ':' + a.target.id : null
        if (!k) continue
        byKey[k] = a
        const words = []
        for (const eid of a.gives ?? []) {
          for (const w of yields[eid] ?? []) {
            if (!inPool.has(w)) { skipped.add(w); continue }
            if (seeds.has(w)) continue
            if (!words.includes(w)) words.push(w)
          }
        }
        if (words.length) map[k] = words
      }
      if (Object.keys(map).length) this.TERM_MAP = map
      if (skipped.size && typeof console !== 'undefined') {
        console.warn('[case] 조사가 주는 단어가 풀에 없어 빠졌다:', [...skipped].join(' · '))
      }
      this.CASE_ACTIONS = byKey

      /**
       * ★ 도면 표식(`FLOOR_CLUES`)을 엔진에서 다시 만든다 ★ (2026-07-30)
       *
       * 앱 표는 **산장의 저작 데이터**인데 `logKey` 가 사건과 무관하게 생겨서
       * 생성 사건이 그대로 물려받고 있었다. `targetKey()` 가 `mode:'none'` 에
       * `'body'` 를 **글자로 박고**(2056행) 현장은 언제나 `room` 이라
       * `{ logKey:'autopsy:body', loc:'room', ko:'일산화탄소' }` 가 **언제나 맞는다.**
       *
       * **눌러서 재현했다** (2026-07-30, 박물관 사건 `gen-87494`): 부검을 실행하면
       * 결과문은 박물관 것(「같은 폭의 자국」)인데 도면의 「특별 전시실」에
       * **「물증 · 일산화탄소」**가 붙었다. 화로도 연탄도 없는 자연사 박물관에.
       *
       * 07-29 저녁의 `resultFor` · 같은 날 밤의 `relationGraph` 와 **같은 부류이고
       * 같은 근거**다: *"앱에 있는 것은 앱 것을 쓴다"* 는 **사건이 하나뿐일 때**
       * 옳았다. 그 둘을 고칠 때 이 표는 같이 안 봤다 — 부검은 `resultFor` 를
       * 가르면서 **바로 그 조사**였는데도.
       *
       * **새 엔진 필드는 필요 없다.** 위 `map`(조사 → 확보 단어)과 `byKey` 가 이미
       * 있고 자리는 `target` 에서 나온다. `fixture` 는 도면에서 `loc` 을 찾고
       * (`body` → `room`), `location` 은 대상이 곧 자리다.
       *
       * ★ 사람 대상은 뺀다 ★ 산장의 `belongings:sakura → annex` 는 「사쿠라의 짐이
       * 별채에 있었다」는 **저작된 사실**이다. 엔진은 누구 짐이 어디 있는지 말하지
       * 않으므로 자리를 지어내면 **없는 사실을 만드는 것**이다 — `sexKo` 를 이름에서
       * 도출하지 않기로 한 것과 같은 판단.
       *
       * ★ `yield` 로 가르지 않는다 ★ 결정적 단서와 레드 헤링이 완전히 같게 생겨야
       * 한다(§절대 규칙 「유용도 시각 구분」). `map` 은 이미 `yield` 를 안 보고
       * 「단어를 주는가」만 보므로 그 규칙이 공짜로 지켜진다.
       *
       * **산장은 한 글자도 안 바뀐다** — `_foreignCase` 가 아니면 앱 표 그대로다.
       */
      if (this._foreignCase) {
        const fx = c.floorPlan?.fixtures ?? {}
        const clues = []
        for (const k of Object.keys(map)) {
          const tg = byKey[k]?.target
          if (!tg || tg.kind === 'person') continue
          const loc = tg.kind === 'fixture' ? (fx[tg.id]?.loc ?? tg.id) : tg.id
          const ko = map[k][0]
          if (!loc || !ko) continue
          // 영문은 한국어로 떨어진다 — 방 이름·관계도 노드와 같은 처지(로마자 미결)
          clues.push({ logKey: k, loc, ko, en: ko })
        }
        this.FLOOR_CLUES = clues
      }

      /**
       * 프로필 단서 (`CLUE_MAP`). 2026-07-27 이관.
       *
       * 엔진 `action.clues` → `{ 앱키: [{p, slot, ko}] }`. 이 표는 오래
       * **「모델이 달라 못 옮긴다」**로 남아 있었는데, 그건 `facts` 로 옮기려
       * 했기 때문이다. `facts` 는 검증기가 유죄를 따지는 **논리 명제**이고
       * 이 표는 **화면에 뜨는 문장**이라 층이 다르다 — 한 조사가 물증은 하나
       * 주면서 프로필에는 두 사람 몫을 남기기도 한다. 그래서 `facts` 에
       * 얹지 않고 조사에 **별도 필드**로 달았다.
       *
       * 영문은 아직 없다(원래 `ko` 만 있던 표다). 스키마는 `Text` 라 번역이
       * 들어오면 그대로 채워진다.
       */
      const clueMap = {}
      for (const [k, a] of Object.entries(byKey)) {
        if (!a.clues?.length) continue
        clueMap[k] = a.clues.map((cl) => ({ p: cl.person, slot: cl.slot, ko: ko(cl.text) }))
      }
      if (Object.keys(clueMap).length) this.CLUE_MAP = clueMap

      /**
       * 장 완성 공개 (`REVEALS` · `CLAIM_REVEALS`). 2026-07-27 이관.
       *
       * ⚠ **장 번호 → 절 id 는 `SECTIONS` 배열 순서다.** `SECTIONS` 가
       * `s1,s3,s2,s4,s5` 순이므로 **2장은 `s3`, 3장은 `s2`** 다. id 숫자로
       * 이으면 2·3장이 통째로 뒤바뀐다 — 공란 이관 때와 같은 함정이다.
       *
       * `addClaims` 가 두 표면으로 갈린다:
       * - `target: 'statement'` → `REVEALS[].statements` (진술에 문단 추가)
       * - `target: 'grid'` → `CLAIM_REVEALS[]` (격자 칸 · `slot` 이 열)
       *
       * `narrow` 는 **좁히기가 아니라 배지 라우팅**이다(`deathNarrowed()` 는
       * `invLog` 의 `autopsy` 를 따로 본다). 엔진 `surface` 가 그 용도로
       * 문서화돼 있어 그대로 쓴다 — `overview` 로 도착하면 배지를 띄운다.
       */
      const idToKey = {}
      for (const [k, a] of Object.entries(byKey)) idToKey[a.id] = k
      const revs = {}
      const claimRevs = {}
      for (const r of c.reveals ?? []) {
        if (r.trigger?.on !== 'chapterComplete') continue
        const sid = this.SECTIONS[r.trigger.chapterOrder - 1]?.id
        if (!sid) continue
        const statements = []
        for (const cl of r.addClaims ?? []) {
          if (cl.target === 'grid') {
            if (!cl.slot) continue
            ;(claimRevs[sid] = claimRevs[sid] || []).push({
              pid: cl.speaker, tid: cl.slot, ko: cl.content, en: cl.content,
            })
          } else {
            statements.push({ pid: cl.speaker, text: cl.content })
          }
        }
        const targets = (r.actions ?? []).map((id) => idToKey[id]).filter(Boolean)
        const entry = {}
        if (r.surface === 'overview') entry.narrow = true
        if (targets.length) entry.targets = targets
        if (statements.length) entry.statements = statements
        // 장 인터루드의 원천 (2026-07-29). **이 값이 여기서 버려지고 있었다** —
        // 엔진이 산장 5건·생성 전건에 서사를 써두는데 앱이 담지 않아서,
        // 「데이터는 다 찼고 남은 것은 화면뿐」이 실제로는 배선도 없는 상태였다
        if (r.narration) entry.narration = ko(r.narration)
        if (Object.keys(entry).length) revs[sid] = entry
      }
      /**
       * ⚠ **사건이 공개를 선언하면 둘 다 통째로 간다 — 빈 것도 간다.**
       *
       * 전에는 각각 `if (Object.keys(x).length)` 였다. 그래서 **격자 칸 공개가
       * 없는 사건**(생성 사건이 전부 그렇다)은 산장의 `CLAIM_REVEALS` 를
       * 그대로 물려받았다 — 레지던시 사건에서 2장을 완성하면 격자에
       * 오나경(`yuri`)의 「통화 중 (본인 주장)」이 붙을 자리가 남아 있었다(실측).
       * 지금은 인물 id 가 안 맞아 아무 데도 안 뜨지만, **조용히 사라지는 것에
       * 기대는 것이 곧 다음 결함**이다. 진술 원문·지문이 「전원분일 때만
       * 갈아끼운다」로 막아둔 것과 같은 부류다.
       */
      if ((c.reveals ?? []).length) {
        this.REVEALS = revs
        this.CLAIM_REVEALS = claimRevs
      }

      /**
       * **피해자를 조사 대상으로 세운다** (2026-07-27).
       *
       * 앱의 인물 대상은 `PEOPLE`(용의자 5)뿐이었다. 엔진 `a_victim_bel` 이
       * 피해자를 겨누는데 앱에 그 칸이 없어서 **트릭 허점이 심긴 두 자리 중
       * 하나(`e_victim_phone`)가 막혀 있었다.**
       *
       * `PEOPLE` 에 넣지 않는다 — 그 배열은 용의자 카드·격자·관계도가 전부
       * 읽는다. 피해자가 거기 들어가면 **용의자로 보인다.** 조사 대상 목록에만
       * 세운다.
       */
      if (c.victim && c.victimProfile?.name) {
        this.VICTIM_TARGET = { id: c.victim, name: c.victimProfile.name }
      }

      /**
       * ★ 피해자 표시줄도 사건에서 읽는다 ★ (2026-07-29)
       *
       * `VICTIM_TARGET`(조사 대상)만 잇고 **화면에 뜨는 「대상」 줄은 하드코딩으로
       * 남아 있었다** — 레지던시 사건을 열었는데 보고서 머리가 `윤다인 (30) · 소설가`
       * 였다. 사건 파일의 피해자는 `구민아 (33) · 전시 기획자`인데도(실측).
       * **07-28 「제목만 안 읽었다」와 같은 부류다** — 옆의 것은 이었는데 이건 놓쳤다.
       *
       * ⚠ **영문은 제목과 똑같은 세 갈래로 가른다** (위 §제목 참조). 처음에
       * `en: vp.en ?? line` 로 썼는데, 그러면 산장의 `Kim Chae-won (30) · Novelist`
       * 가 한국어로 뭉개진다 — 사건 파일에 `en` 이 없어서다. **07-28에 제목으로
       * 물린 바로 그 자리를 그대로 다시 밟을 뻔했다.**
       *
       *   사건이 영문을 주면 → 그것
       *   없는데 **다른 사건**이면 → 한국어 (산장 영문이 남아 엉뚱한 사람을 가리키는 것보다 낫다)
       *   없는데 **산장**이면 → 손대지 않는다 (앱 값이 산다)
       */
      const vp = c.victimProfile
      if (vp?.name) {
        const line = `${vp.name}${vp.age ? ` (${vp.age})` : ''}${vp.job ? ` · ${vp.job}` : ''}`
        const en = vp.en ?? (this._foreignCase ? line : null)
        this.VICTIM_LINE = { ko: line, en }
      }
    }

    // 인물 — **표시 속성(색·이니셜·역할·좌표)은 건드리지 않는다**
    for (const e of c.people ?? []) {
      const p = this.PEOPLE.find((x) => x.id === e.id)
      if (!p) continue
      if (e.name) p.name = e.name
      if (e.age != null) p.age = e.age
      if (e.job) p.jobKo = e.job
      if (e.claimSummary) p.claimKo = ko(e.claimSummary)
      // 진술 원문과 지문 — 사건 산문이므로 엔진이 정본이다
      const st = e.statement
      if (st?.paragraphs?.length) this.STMT[e.id] = st.paragraphs.map(ko)
      if (st?.gesture) {
        this.STMT_GESTURE[e.id] = {
          pre: ko(st.gesture.pre) || this.STMT_GESTURE[e.id]?.pre || '',
          post: ko(st.gesture.post) || this.STMT_GESTURE[e.id]?.post || '',
        }
      }
    }

    /**
     * 공란의 답과 조사. 2026-07-26 대조에서 20개가 답·조사까지 1:1 로 맞는 것을
     * 확인했다. **엔진은 id 로 적고 앱은 표시 이름으로 적으므로** 사람·장소·
     * 시각은 이름으로 옮긴다.
     *
     * ⚠ **`b1..b20` 순서로 맞추면 안 된다.** 앱의 `SECTIONS` 배열은
     * `s1, s3, s2, s4, s5` 순이다 — 공란 id 는 s 번호를 따르는데 **화면에
     * 보이는 장 순서는 배열 순서**라, `s2` 가 3장(사인과 현장)이고 `s3` 이
     * 2장(마지막 정황)이다. id 순으로 이으면 2장과 3장의 답이 뒤바뀐다.
     * 그래서 `SECTIONS` 배열 순서 ↔ 엔진 `chapters` 순서로 잇는다.
     */
    const nameOf = (label, id) => {
      if (label === '장소') return c.locations?.find((l) => l.id === id)?.label ?? id
      if (label === '시각') return c.slots?.find((s) => s.id === id)?.label ?? id
      return c.people?.find((p) => p.id === id)?.name
        ?? (c.victim === id ? c.victimProfile?.name : null) ?? id
    }
    /**
     * ─────────────────────────────────────────────────────────────
     *  보고서를 엔진 `chapters` 에서 **다시 만든다** (2026-07-29)
     * ─────────────────────────────────────────────────────────────
     *
     * 전에는 「공란 수가 같은 장만 덮어쓰고 다르면 경고」였다. 산장 사건에서는
     * 늘 같아서 문제가 없었지만, **장 수가 다른 사건은 반쪽이 됐다** — 2장짜리
     * 생성 사건을 물리니 1장만 새 사건이고 2~5장은 산장 사건이 남았다.
     *
     * ★ 장 수가 데이터가 된다 ★ 5장 고정이 풀린다. 규모 표의 「심화 6장」도,
     * 더 긴 사건도 이제 사건 파일이 정한다.
     *
     * ── 어긋남을 다루는 방식 ────────────────────────────────
     * **id 는 앱 자리에서 물려받는다.** 앱 정적 데이터가 장 id 를 참조하기
     * 때문이다(`LOCATIONS[].gated: 's1'`). 자리보다 장이 많으면 `s6`·`s7` 로
     * 새로 만들고, 적으면 남는 자리는 버린다. 공란 id 도 같은 규칙이라
     * **산장 사건은 id 가 하나도 안 바뀐다** — 저장된 진행이 그대로 열린다.
     */
    if (c.chapters?.length) {
      // 앱 `catL`(채점 화면)의 역방향이다. 14개 고정 어휘가 1:1 로 대응한다
      const KIND_OF = {
        인물: 'vPerson', 장소: 'vPlace', 시각: 'vTime', 도구: 'vTool', 동기: 'vMotive',
        정체: 'vIdentity', 은폐수단: 'vConceal', 위장물: 'vStaging', 마지막목격자: 'vLastSeen',
        접촉수단: 'vContact', 은닉처: 'vHideout', 사인: 'vCause', 물품: 'vItem', 협박대상: 'vTarget',
      }
      // 후보를 어디서 고르나. `discovered` 는 확보 단어, `closed` 는 라벨이 정한다
      const srcOf = (label, candidates) =>
        candidates === 'discovered' ? 'collected'
          : label === '장소' ? 'place'
            : label === '시각' ? 'time'
              : 'person'

      const oldSecs = this.SECTIONS
      const oldBlanks = this.BLANKS
      let mintedSec = oldSecs.length
      let mintedBlank = Object.keys(oldBlanks).length

      const sections = []
      const secBlanks = {}
      const blanks = {}

      c.chapters.forEach((ch, i) => {
        const slot = oldSecs[i]
        const sid = slot?.id ?? `s${++mintedSec}`
        const slotBids = (slot && this.SEC_BLANKS[slot.id]) || []

        const bids = (ch.blanks ?? []).map((b, n) => {
          const bid = slotBids[n] ?? `b${++mintedBlank}`
          const old = oldBlanks[bid] ?? {}
          blanks[bid] = {
            ...old,
            kind: KIND_OF[b.label] ?? old.kind ?? 'vPerson',
            src: srcOf(b.label, b.candidates),
            ans: nameOf(b.label, b.answer),
            par: b.particle ?? null,
            // 지목 공란은 사건 전체에 하나다 — 검증기가 강제한다
            ...(b.isAccusation ? { nominate: true } : {}),
          }
          if (!b.isAccusation) delete blanks[bid].nominate
          return bid
        })

        secBlanks[sid] = bids
        sections.push({
          ...(slot ?? {}),
          id: sid,
          num: i + 1,
          tKo: ch.title ?? slot?.tKo ?? `${i + 1}장`,
          tEn: slot?.tEn ?? '',
          // 서술문이 없으면 공란만 늘어놓는다 — 앱 값을 쓰면 없는 공란을 가리킨다
          parts: ch.report?.length
            ? ch.report.map((p) => (p.text != null ? { text: p.text } : { b: bids[p.blank] }))
            : bids.map((b) => ({ b })),
          // 결말 재배열 순서. 없으면 장 순서를 쓴다
          epOrder: ch.epilogueOrder ?? i + 1,
        })
        // ⚠ `ch.opening`(장 도입 한 줄)은 **일부러 안 가져온다.** 프로토타입의
        // SECTIONS 에 그 자리가 없다 — 넣어도 아무도 렌더하지 않는 죽은 데이터가
        // 되고, 렌더할 자리를 새로 만들면 그건 이식이 아니라 발명이다.
      })

      if (oldSecs.length !== sections.length && typeof console !== 'undefined') {
        console.info(`[case] 보고서 ${oldSecs.length}장 → ${sections.length}장`)
      }
      this.SECTIONS = sections
      this.SEC_BLANKS = secBlanks
      this.BLANKS = blanks
    }

    /**
     * 관계 도식. 라벨·공개 게이트·위험 표시는 사건의 의미이므로 엔진이 정본이다.
     * 좌표·`kind`·`logKey` 는 앱 것을 둔다 — 인물과 같은 이유(표시 속성)다.
     *
     * ⚠ **위치로 잇지 않는다.** 엔진 `discoveries` 는 `a_yuri · a_ph_wy · a_annex ·
     * a_sakura` 순이고 앱 `GRAPH_EVIDENCE` 는 `yuri · annex · sakura · wonyoung`
     * 순이다. 순서로 이으면 「소지」와 「새벽 통화 확인」이 뒤바뀐다 — `SECTIONS`
     * 가 `s1,s3,s2` 였던 것과 같은 함정이다.
     *
     * 잇는 열쇠는 노드가 `id`, 간선이 `from|to` 다. 조사 id ↔ `logKey` 대응
     * (`a_yuri` ↔ `belongings:yuri`)은 **일부러 쓰지 않는다** — 그 대응이 곧
     * `INV_ACTIONS` 모델 충돌(앱 6동사×대상 ↔ 엔진 23구체)이고 아직 결정되지
     * 않았다. `(from,to)` 네 쌍이 전부 유일하므로 그것 없이 이어진다.
     */
    // 엔진 `revealedAfter` 는 **장 순서**, 앱 `gate` 는 **절 id** 다.
    // `SECTIONS` 배열 순서가 장 순서라서 (s1,s3,s2,s4,s5 ↔ 1..5) 이렇게 잇는다
    const gateOf = (order) => this.SECTIONS[order - 1]?.id
    const pair = (a, b) => a + '|' + b
    /** 관계 도식 라벨은 `{ko,en}` 이다 */
    const lbl = (dst, src) => {
      if (src?.ko) dst.ko = src.ko
      if (src?.en) dst.en = src.en
    }
    /**
     * 평면도 라벨은 **한국어 문자열 하나**다 — 엔진에 영문이 없다.
     * 그래서 `en` 은 앱 것을 그대로 둔다(`"Chae-won's room"` 처럼 낡은 것도 남는다.
     * 로마자 표기가 결정되면 엔진에 넣고 여기서 같이 받는다)
     */
    const koOnly = (dst, s) => { if (s) dst.ko = String(s) }
    // 개수가 어긋나거나 짝을 못 찾으면 **그 표는 통째로 앱 값을 쓴다.**
    // 반쯤 덮어쓴 표는 틀린 사건을 조용히 보여준다
    const join = (name, appRows, engRows, keyApp, keyEng) => {
      const m = new Map((engRows ?? []).map((e) => [keyEng(e), e]))
      if (m.size !== appRows.length || appRows.some((r) => !m.has(keyApp(r)))) {
        // 조사를 붙이지 않는다 — `노드가`·`간선이` 로 갈리는 자리다. 이 프로젝트는
        // 문장틀이 조사를 하드코딩해서 「테이프으로」를 만든 전례가 있다
        console.warn(`[nobody-lies] ${name}: 엔진과 다르다 — 이 표는 앱 값을 쓴다`)
        return null
      }
      return m
    }

    const g = c.relationGraph
    /**
     * ★ 다른 사건이면 표를 **다시 만든다 — 꾸미지 않는다** ★ (2026-07-29 밤)
     *
     * 아래 `join` 은 앱 표를 **꾸미는** 도구다(라벨·게이트만 덮어쓴다). 사건이
     * 산장 하나일 때는 맞는 말이었는데, **생성 사건은 인물 id 자체가 다르다**
     * (`p1..p5` ↔ `yena·yujin…`). 개수도 짝도 어긋나므로 `join` 이 `null` 을 내고
     * — 그 자체는 설계대로다(*"반쯤 덮어쓴 표는 틀린 사건을 조용히 보여준다"*) —
     * **산장 표가 통째로 살아남는다.** 그래서 관계도에 **「윤다인」**이 떴다.
     *
     * 07-29 저녁 §죽은 배선 셋의 ②와 **같은 근거·같은 결말**이다: *"앱에 있는 것은
     * 앱 것을 쓴다"* 는 **사건이 하나뿐일 때** 옳았고, 생성 사건이 생기며 전제가
     * 깨졌는데 코드가 안 따라왔다. 거기서 쓴 `_foreignCase` 로 똑같이 가른다.
     *
     * **산장은 한 줄도 안 바뀐다** — 아래 `join` 경로를 그대로 탄다.
     */
    if (g && this._foreignCase) {
      this.GRAPH_NODES = g.nodes.map((n) => ({
        id: n.id, kind: n.kind, x: n.x, y: n.y,
        // `person` 노드는 라벨이 없다 — `buildGraph` 가 `PEOPLE` 에서 이름·색을 읽는다
        ko: ko(n.label) || '', en: n.label?.en || ko(n.label) || '',
        ...(n.revealedAfter != null ? { gate: gateOf(n.revealedAfter) } : {}),
      }))
      this.GRAPH_EDGES = (g.edges ?? []).map((e) => ({
        a: e.from, b: e.to, ko: ko(e.label) || '', en: e.label?.en || ko(e.label) || '',
        danger: !!e.danger,
        ...(e.revealedAfter != null ? { gate: gateOf(e.revealedAfter) } : {}),
      }))
      /**
       * 조사로 열리는 간선은 **비운다.** 엔진은 `action` id 로 말하는데 앱은
       * `logKey`(`동사:대상`)로 말하고, 그 대응이 곧 `INV_ACTIONS` 모델 충돌이라
       * 아직 결정되지 않았다(위 §위치로 잇지 않는다 주석과 같은 이유).
       * 산장 것을 남기면 `belongings:yuri` 같은 남의 열쇠가 그대로 산다.
       */
      this.GRAPH_EVIDENCE = []
    } else if (g) {
      const nodes = join('관계 도식 노드', this.GRAPH_NODES, g.nodes, (n) => n.id, (e) => e.id)
      if (nodes) for (const n of this.GRAPH_NODES) {
        const e = nodes.get(n.id)
        lbl(n, e.label)
        if (e.revealedAfter != null) n.gate = gateOf(e.revealedAfter) ?? n.gate
      }

      const edges = join('관계 도식 간선', this.GRAPH_EDGES, g.edges,
        (r) => pair(r.a, r.b), (e) => pair(e.from, e.to))
      if (edges) for (const r of this.GRAPH_EDGES) {
        const e = edges.get(pair(r.a, r.b))
        lbl(r, e.label)
        r.danger = !!e.danger
        if (e.revealedAfter != null) r.gate = gateOf(e.revealedAfter) ?? r.gate
      }

      const disc = join('관계 도식 조사 간선', this.GRAPH_EVIDENCE, g.discoveries,
        (r) => pair(r.a, r.b), (e) => pair(e.from, e.to))
      if (disc) for (const r of this.GRAPH_EVIDENCE) {
        const e = disc.get(pair(r.a, r.b))
        lbl(r, e.label)
        r.danger = !!e.danger
        if (r.node && e.node) lbl(r.node, e.node.label)
      }
    }

    /**
     * 현장 평면도. 엔진 `floor_plan` 이 프로토타입 `GEO` 를 그대로 받아 적은 것이라
     * **좌표가 양쪽에서 이미 같다** — 좌표는 앱 것을 둔다(인물·관계 도식과 같은 이유).
     * 엔진이 정본이 되는 것은 **한국어 라벨 · 도보 시간 · 별채 공개 게이트 ·
     * 축척 라벨 · 설비 좌표**다.
     *
     * ⚠ **창은 `id` 가 없다** — 양쪽 다 없다. 좌표 네 값으로 잇는다(셋 다 유일).
     *
     * 앱 `FIXTURES`(화로·테이프·금고·시신) 중 **한국어 이름표는 엔진이 정본이다**
     * (2026-07-27 `floor_plan.fixtures[].label` 신설). 사건마다 다른 어휘이고
     * 사건 2번의 고정물은 이름이 다르다 — `doors`·`windows` 의 `label` 과 같은
     * 규약이다.
     *
     * **영문과 아이콘은 앱에 남는다.** 영문은 평면도 로마자 표기가 미결이라
     * 방 이름(`"Chae-won's room"`)과 같은 처지이고, 아이콘은 어느 글리프를
     * 쓰느냐라서 인물의 색·이니셜과 같은 표시 속성이다.
     */
    const fp = c.floorPlan
    if (fp) {
      const G = this.GEO
      if (fp.viewBox?.w && fp.viewBox?.h) G.vb = { w: fp.viewBox.w, h: fp.viewBox.h }
      // 축척 라벨은 앱이 `'0 ─ 5m'` 로 **문자열에 박아** 두고 있었다. 값만 받는다
      if (fp.scale?.label) G.scale.label = String(fp.scale.label)

      const bld = join('평면도 건물', G.buildings, fp.buildings, (r) => r.id, (e) => e.id)
      if (bld) for (const r of G.buildings) {
        const e = bld.get(r.id)
        // 별채는 1장을 완성해야 도면에 나타난다. 조건만 데이터로 받는다 —
        // **어느 건물이 가려지는지는 아직 렌더가 `'annex'` 로 하드코딩한다**
        if (e.revealedAfter != null) r.gate = gateOf(e.revealedAfter) ?? r.gate
      }

      const rms = join('평면도 방', G.rooms, fp.rooms, (r) => r.id, (e) => e.id)
      if (rms) for (const r of G.rooms) koOnly(r, rms.get(r.id).label)

      const zns = join('평면도 구역', G.zones, fp.zones, (r) => r.id, (e) => e.id)
      if (zns) for (const r of G.zones) koOnly(r, zns.get(r.id).label)

      const drs = join('평면도 문', G.doors, fp.doors, (r) => r.id, (e) => e.id)
      if (drs) for (const r of G.doors) koOnly(r, drs.get(r.id).label)

      const seg = (o) => [o.x1, o.y1, o.x2, o.y2].join(',')
      const wins = join('평면도 창', G.windows, fp.windows, seg, seg)
      if (wins) for (const r of G.windows) koOnly(r, wins.get(seg(r)).label)

      // 도보 시간은 사건의 사실이다 — 「본채에서 별채까지 10분」이 알리바이를 가른다
      const wks = join('평면도 동선', G.walks, fp.walks, (r) => r.b, (e) => e.building)
      if (wks) for (const r of G.walks) {
        const e = wks.get(r.b)
        if (e.min != null) r.min = e.min
      }
      /**
       * 같은 값을 읽는 두 번째 표.
       *
       * ⚠ **여기 *"`WALK` 는 알리바이 대조가 쓴다"* 고 적혀 있었는데 거짓이었다**
       * (2026-07-29 확인). `WALK` 를 읽는 코드가 이 파일에 **하나도 없다** —
       * 정의·비우기·이 동기화가 전부다. **프로토타입에서도 같다**(정의 1회,
       * 사용 0회)라서 덜 옮긴 것이 아니라 **원본부터 죽은 표**다
       * (`REVEALS[].yield`·`statements[].y` 와 같은 부류).
       *
       * 그리고 알리바이 대조는 **계산이 아니라 저작된 결과**다(`INV_RESULTS`
       * `alibi:*`). 도보 시간으로 왕복 가능 여부를 앱이 판정하면 그게 곧
       * §절대 규칙의 「자동 분석 일체 금지」 위반이다 — **그 판단은 플레이어 몫**이고,
       * 재료는 도면의 「10분」과 진술의 *"걸어서 10분 거리입니다"* 로 준다.
       *
       * 그래서 **소비자를 새로 만들지 않고** 표만 참으로 유지한다. 키는 도착
       * 장소(`to`)다 — `building` 으로 맞추면 산장(건물 id = 장소 id)만 맞고
       * 생성 사건은 영영 어긋난다.
       */
      const wk2 = join('도보 시간', this.WALK, fp.walks, (r) => r.b, (e) => e.to)
      if (wk2) for (const r of this.WALK) {
        const e = wk2.get(r.b)
        if (e.min != null) r.min = e.min
      }

      /**
       * 설비 좌표·이름표는 표가 아니라 map 이다. 키 집합이 같을 때만 받는다.
       *
       * ⚠ **`G.fixtures` 가 없을 수 있다** (2026-07-29). 도면을 엔진 좌표로 통째
       * 다시 만든 경우(생성 사건) `GEO` 에 `fixtures` 가 없다. 전에는 생성 사건이
       * `fp.fixtures` 를 **아예 안 줘서** 이 분기가 돌지 않았고, 엔진이 고정물을
       * 내기 시작한 순간 `Object.keys(undefined)` 로 **앱이 통째로 죽었다.**
       * 위쪽 경로가 이미 `FIXTURES` 를 엔진에서 다시 만들었으므로 여기서는 건너뛴다.
       */
      if (fp.fixtures && G.fixtures) {
        const ak = Object.keys(G.fixtures).sort().join(','), ek = Object.keys(fp.fixtures).sort().join(',')
        if (ak !== ek) console.warn('[nobody-lies] 평면도 설비: 엔진과 키가 다르다 — 앱 값을 쓴다')
        else for (const k of Object.keys(G.fixtures)) {
          const e = fp.fixtures[k]
          if (e.x != null && e.y != null) G.fixtures[k] = { x: e.x, y: e.y }
          // 이름표는 사건 어휘다 — 사건 2번의 고정물은 이름이 다르다.
          // 영문·아이콘은 앱이 계속 정본이다 (로마자 표기 미결 · 표시 속성)
          if (e.label) {
            const f = this.FIXTURES.find((x) => x.id === k)
            if (f) f.ko = String(e.label)
          }
        }
      }
    }

    /**
     * ★ 진술 격자(도식 탭)를 `CLAIM_LOC` 에서 만든다 ★ (2026-07-30)
     *
     * `CLAIMS` 가 산장 인물 id(`yena`·`sakura`…)로 키잉돼 있어서 생성 사건에서는
     * `this.CLAIMS['p1']` 이 `undefined` 였다 — **격자가 통째로 비었다.** 누설은
     * 아니지만(빈 칸은 「언급 없음」으로 읽힌다) 「주장 대조표」라고 적어놓고
     * 대조할 것이 하나도 없는 **죽은 화면**이다. `applyCase` 전수 감사(07-29 밤)가
     * `FLOOR_CLUES` 와 함께 뽑아낸 셋 중 둘째다.
     *
     * ★ 값을 다시 도출하지 않는다 ★ 같은 것을 두 벌 계산하면 갈라진다
     * (§같은 계산 두 벌 금지). `CLAIM_LOC` 이 이미 07-29에 `claim`(없으면
     * `presence`)에서 **정본으로** 도출돼 있으므로 여기서는 **자리 id 에 이름만
     * 붙인다.** 평면도 마커와 격자가 같은 표를 보므로 어긋날 수가 없다.
     *
     * ⚠ **`LOCATIONS` 가 확정된 뒤여야 한다** — 도면을 엔진 좌표로 다시 만드는
     * 경로가 `this.LOCATIONS` 를 갈아끼운다. 그래서 `applyCase` 의 **맨 끝**이다.
     *
     * ★ 산장의 「본채 · 도착·발견」 같은 꼬리말은 안 만든다 ★ 그 descriptor 는
     * **저작이다**(엔진 `PresenceCell` 은 `{slot, location}` 뿐이다). 지어내면
     * 없는 사실을 만드는 것이고, 다섯 중 하나만 꼬리말이 붙으면 그 불규칙이
     * 곧 신호가 된다 — §절대 규칙의 「유용도 시각 구분」이 걸리는 자리다.
     */
    if (this._foreignCase) {
      const nameOf = {}
      for (const l of this.LOCATIONS) nameOf[l.id] = { ko: l.ko, en: l.en || l.ko }
      /**
       * ⚠ **이 사건의 인물만 본다.** `CLAIM_LOC` 은 5명분이 다 도출됐을 때만
       * 갈아끼워진다(위 §주장 위치). 부분 도출이면 산장 표가 남아 있는데, 장소
       * id 는 `room`·`approach` 처럼 **우연히 겹치는 것이 있어서** 그대로 돌리면
       * 「산장 인물 + 이 사건 장소 이름」이라는 없는 값이 만들어진다. 읽는 쪽이
       * `PEOPLE` 로 찾으므로 죽은 값이지만, **죽은 채 그럴듯한 것**이 이 저장소가
       * 반복해서 데인 자리다. 안 맞으면 빈 격자로 둔다 — 그것이 사실이다.
       */
      const mine = new Set(this.PEOPLE.map((p) => p.id))
      const claims = {}
      for (const pid of Object.keys(this.CLAIM_LOC)) {
        if (!mine.has(pid)) continue
        const m = {}
        for (const slot of Object.keys(this.CLAIM_LOC[pid])) {
          const n = nameOf[this.CLAIM_LOC[pid][slot]]
          if (n) m[slot] = { ko: n.ko, en: n.en }
        }
        if (Object.keys(m).length) claims[pid] = m
      }
      this.CLAIMS = claims
    }
  }

  constructor(props) {
    super(props)
    this.applyCase(props?.caseData)
    // 홈 목록은 사건과 **따로** 온다 — 사건 하나가 없어도 목록은 살고, 반대도 같다
    this.applyCatalog(props?.catalog)
  }

  /**
   * ─────────────────────────────────────────────────────────────────
   *  진행 저장
   * ─────────────────────────────────────────────────────────────────
   *
   * DC export 에는 저장이 **한 줄도 없었다.** 프로토타입은 원래 그래도 되지만
   * 새로고침 한 번에 전부 날아가는 것을 플레이테스터에게 줄 수는 없다.
   *
   * ★ 저장 목록은 화이트리스트다 ★
   * 상태를 통째로 저장하면 열려 있던 모달·드래그 중이던 좌표까지 되살아나서
   * **깨진 화면으로 복귀한다.** 무엇을 저장할지 고르는 순간 상태가 갈래로
   * 나뉘고, 그 구분이 곧 엔진 재분리의 절반이다:
   *
   *   진행   게임이 어디까지 갔나        — 나중에 `CaseProgress`
   *   주석   플레이어가 무엇을 적었나    — 나중에 `PlayerAnnotations`
   *   설정   어떻게 보고 있나
   *   (나머지는 전부 휘발 — 열린 메뉴·선택·드래그·라우트)
   *
   * `route` 는 일부러 저장하지 않는다. 새로고침하면 홈으로 나오고 「이어하기」로
   * 돌아간다 — `caseStatus()` 가 `started`·`solved` 만 보므로 그것으로 충분하다.
   */
  SAVE_KEY = 'nobody-lies:mountain-lodge';
  /** 구조를 바꾸면 올린다. 옛 저장은 조용히 버려진다 — 깨진 채 복구하는 것보다 낫다 */
  SAVE_VERSION = 3;   // 3: 상황판 삭제 — `pb` 키를 안 쓴다. v1·v2 는 `loadSave` 가 받아 올린다

  SAVED = {
    progress: ['blanks', 'solved', 'reopenActive', 'reopenUsed', 'evidence', 'invLog',
      'readDone', 'readIdx', 'started', 'stage', 'seenClaims', 'seenClues',
      // `stage` 와 **같이** 저장한다 — 인터루드 도중에 새로고침하면 stage 만 남아
      // 빈 인터루드에 갇힌다. 둘은 한 벌이다
      'interludeQ'],
    annotations: ['memos', 'readMemos', 'hls', 'annMarks', 'cellMarks', 'verdicts', 'quotePins'],
    prefs: ['lang', 'theme', 'narrMode', 'stmtMode', 'viewOpts'],
  };
  /**
   * 읽을 수 있는 판. **v1·v2 는 상황판(`pb`)이 있던 판**이고 상황판은 v3 에서
   * 제품에서 빠졌다. 진행·주석·설정은 구조가 그대로이므로 **버리지 않고 읽고
   * `pb` 만 떨군다.**
   *
   * ⛔ **버전을 안 올리고 `pb` 만 빼면 안 된다** — 「v2인데 pb 있는 저장」과
   * 「v2인데 pb 없는 저장」이 **같은 번호로 공존**해서 다음 마이그레이션
   * 작성자를 속인다. 그래서 판을 올리고 옛 판을 여기 명시한다.
   *
   * ⚠ `otherStatus`(홈 목록)가 **이 배열을 같이 본다.** 눈이 갈리면 홈은
   * 「진행 중」인데 눌러보면 프롤로그가 뜬다.
   */
  SAVE_READABLE = [1, 2, 3];

  loadSave() {
    let raw;
    try { raw = localStorage.getItem(this.SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || this.SAVE_READABLE.indexOf(data.v) < 0) return null;
    const next = {};
    for (const group of Object.values(this.SAVED))
      for (const k of group) if (k in data) next[k] = data[k];
    /**
     * v1·v2 → v3. 상황판 배치는 **작업물 정리**지 사건 정보 손실이 아니다 —
     * 공란·조사·메모·표시는 위에서 그대로 실려 온다. 그래도 **조용히 버리지
     * 않는다.** 사라진 것이 있으면 사라졌다고 말한다.
     */
    if (data.pb) {
      try { console.info('상황판 데이터 v' + data.v + '→v' + this.SAVE_VERSION + ' 정리: pb 키 폐기'); } catch (e) {}
    }
    return next;
  }

  save() {
    const s = this.state;
    const out = { v: this.SAVE_VERSION };
    for (const group of Object.values(this.SAVED)) for (const k of group) out[k] = s[k];
    try { localStorage.setItem(this.SAVE_KEY, JSON.stringify(out)); } catch (e) { /* 용량 초과 등 — 게임을 막지 않는다 */ }
  }

  /** 메모 타이핑마다 쓰지 않도록 묶는다 */
  scheduleSave() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.save(), 400);
  }

  /**
   * 「포기」는 따로 지우지 않는다 — `abandon()` 이 상태를 되돌리면
   * 그 되돌린 상태가 그대로 저장된다. 지우는 경로를 따로 두면 둘이 갈라진다.
   */
  componentDidUpdate() { this.scheduleSave(); }

  componentDidMount() {
    const saved = this.loadSave();
    if (saved) this.setState(saved, () => this.applyTheme());
    this.applyTheme();

    /**
     * ★ 기본 사건이 아니면 바로 시작한다 ★ (2026-07-29)
     *
     * 홈의 캠페인 목록(`CASES` 01~06)과 사건 상세는 **산장 사건 전용으로 하드코딩**돼
     * 있다. 그래서 `?case=` 로 다른 사건을 열면 데이터는 갈리는데 **화면은 홈에
     * 머물러 아무 일도 안 일어난 것처럼 보인다** — 생성 사건을 눌렀을 때 실제로
     * 그랬다.
     *
     * 목록에 자리를 만드는 대신 **누른 순간 그 사건으로 들어간다.** 이미 고른
     * 사건이므로 상세 화면을 한 번 더 거칠 이유가 없다.
     *
     * 진행이 저장돼 있으면 이어하고(`resumeCase`), 없으면 처음부터(`startCase`).
     */
    if (this._foreignCase) {
      if (saved && saved.started) this.resumeCase();
      else this.startCase();
    }
    this._onResize = () => { const el = this._root && this._root.closest ? this._root.closest('.app') : null; const w = (el && el.clientWidth) || document.documentElement.clientWidth || window.innerWidth; const n = w < 820; if (n !== this.state.isNarrow) this.setState({ isNarrow: n }); };
    this._root = document.querySelector('.app');
    this._onResize(); window.addEventListener('resize', this._onResize);
    if (window.ResizeObserver && this._root) { this._ro = new ResizeObserver(() => this._onResize()); this._ro.observe(this._root); }
    this._onDocClick = (e) => {
      const t = e.target;
      if (t.closest && (t.closest('.g-picker') || t.closest('.g-blank-trigger') || t.closest('.g-cell') || t.closest('.g-aids-btn') || t.closest('.g-settings') || t.closest('.g-seltoolbar') || t.closest('.g-stmt-para'))) return;
      if (this.state.openPicker || this.state.openCell || this.state.openAids || this.state.openSent || this.state.settingsOpen || this.state.sel) this.setState({ openPicker: null, openCell: null, openAids: false, openSent: null, settingsOpen: false, sel: null });
    };
    document.addEventListener('click', this._onDocClick, true);
  }
  componentWillUnmount() { clearTimeout(this._saveT); this.save(); window.removeEventListener('resize', this._onResize); if (this._ro) this._ro.disconnect(); document.removeEventListener('click', this._onDocClick, true); }

  applyTheme() { try { document.documentElement.setAttribute('data-theme', this.state.theme === 'light' ? 'light' : 'dark'); } catch (e) {} }

  batchim(w) { if (!w) return false; const c = w.charCodeAt(w.length - 1); if (c < 0xAC00 || c > 0xD7A3) return false; return (c - 0xAC00) % 28 !== 0; }
  jong(w) { if (!w) return 0; const c = w.charCodeAt(w.length - 1); return (c >= 0xAC00 && c <= 0xD7A3) ? (c - 0xAC00) % 28 : 0; }
  particle(w, type) {
    if (!type) return '';
    const b = this.batchim(w);
    if (type === '이/가') return b ? '이' : '가';
    if (type === '을/를') return b ? '을' : '를';
    if (type === '은/는') return b ? '은' : '는';
    if (type === '과/와') return b ? '과' : '와';
    if (type === '(으)로') return (!b || this.jong(w) === 8) ? '로' : '으로';
    return '';
  }

  T() { return Object.assign({}, this.DICT.ko, this.DICT[this.state.lang]); }
  setLang(l) { this.setState({ lang: l }); }
  toggleTheme() { this.setState({ theme: this.state.theme === 'dark' ? 'light' : 'dark' }, () => this.applyTheme()); }
  setView(v, noPush) { if (this.state.view === 'map' && v !== 'map') this.markClaimsSeen(); if (this.state.unread && this.state.unread[v]) { const ur = Object.assign({}, this.state.unread); delete ur[v]; this.setState({ unread: ur }); } if (this.state.view === 'profile' && v !== 'profile') this.markProfileSeen(); if (!noPush && v !== this.state.view) { const hist = (this.state.navHist || []).slice(0, (this.state.navIdx ?? -1) + 1); hist.push(v); this.setState({ navHist: hist, navIdx: hist.length - 1 }); } this.setState({ view: v, openPicker: null, openCell: null, openAids: false }); }
  navBack() { const i = this.state.navIdx ?? -1; if (i > 0) { const v = this.state.navHist[i - 1]; this.setState({ navIdx: i - 1 }); this.setView(v, true); } }
  navForward() { const i = this.state.navIdx ?? -1, h = this.state.navHist || []; if (i < h.length - 1) { const v = h[i + 1]; this.setState({ navIdx: i + 1 }); this.setView(v, true); } }
  ICO(name) {
    const I = {
      report: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3M6 8h4M6 10.5h4"/>',
      depo: '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M6.5 6.5V13M10 6.5V13"/>',
      invest: '<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>',
      suspect: '<circle cx="8" cy="5.5" r="2.5"/><path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/>',
      more: '<circle cx="4" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/>',
      overview: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.2v3.2M8 5.4v.1"/>',
      memo: '<path d="M3 2.5h10v11H3z"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/>',
      map: '<path d="M2.5 4.5L6 3l4 1.5L13.5 3v9L10 13.5 6 12 2.5 13.5z"/><path d="M6 3v9M10 4.5v9"/>',
      guide: '<rect x="2.5" y="2.5" width="11" height="4" rx="1"/><rect x="2.5" y="9.5" width="11" height="4" rx="1"/>',
      graph: '<circle cx="4" cy="5" r="2"/><circle cx="12" cy="4" r="1.6"/><circle cx="11" cy="12" r="2"/><path d="M5.7 6.3l4 4.3M5.7 4.6l4.8-.4"/>',
    };
    return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, dangerouslySetInnerHTML: { __html: I[name] || '' } });
  }
  bottomItem(view, cur, key, label, icon, onClick) {
    const active = view === cur;
    return { label, icon: this.ICO(icon), onClick, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '7px 2px 8px', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--fg-3)', background: active ? 'var(--accent-soft)' : 'transparent' } };
  }
  buildBottomNav(view) {
    const t = this.T();
    // 칩은 「시트 안의 화면을 보고 있을 때」 켜진다 — 목록은 MORE_ITEMS 하나뿐이다
    const inMore = this.MORE_ITEMS().some((m) => m.v === view);
    return [
      this.bottomItem(view, 'narrative', 'n', t.navNarrative, 'report', () => this.setView('narrative')),
      this.bottomItem(view, 'statements', 's', t.navStatements, 'depo', () => this.setView('statements')),
      this.bottomItem(view, 'map', 'm', t.navMap, 'map', () => this.setView('map')),
      this.bottomItem(view, 'profile', 'p', t.navProfile, 'suspect', () => this.setView('profile')),
      { label: t.more || '더보기', icon: this.ICO('more'), onClick: () => this.setState({ moreOpen: true }), style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '7px 2px 8px', cursor: 'pointer', color: inMore ? 'var(--accent)' : 'var(--fg-3)', background: inMore ? 'var(--accent-soft)' : 'transparent' } },
    ];
  }
  /**
   * 「더 보기」 시트에 든 화면들 — **시트 내용과 칩의 활성 판정이 이 한 목록에서 난다.**
   *
   * ⛔ **둘이 갈라져 있었다** (2026-08-05 감사 #7): 칩의 활성 목록이
   * `['overview','memo','map','reference']` 였는데 `map` 은 **직접 탭**이고
   * `graph` 는 **시트 안**이라, 칩이 엉뚱한 화면에서 켜지고 정작 자기 화면에서 꺼졌다.
   * 목록이 둘이면 한쪽만 고치는 일이 또 난다 — 그래서 **자리를 하나로 합쳤다.**
   *
   * ★ `log`(조사 기록)가 여기 **맨 앞**에 있다 (감사 #1). 그전까지 `buildBottomNav`
   * 넷에도 이 시트에도 없었고 사이드바는 `isNarrow` 에서 숨으므로,
   * **좁은 폭에서 조사 기록으로 가는 길이 아예 없었다.**
   */
  MORE_ITEMS() {
    const t = this.T();
    return [
      { v: 'log', label: t.invLogTitle, icon: 'invest' },
      { v: 'overview', label: t.navOverview, icon: 'overview' },
      { v: 'memo', label: t.navMemo, icon: 'memo' },
      { v: 'graph', label: t.navGraph, icon: 'graph' },
      { v: 'reference', label: t.navReference, icon: 'guide' },
    ];
  }
  buildMoreNav(view) {
    return this.MORE_ITEMS().map((m) => ({ label: m.label, icon: this.ICO(m.icon), onClick: () => this.setState({ moreOpen: false }, () => this.setView(m.v)), style: { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', color: view === m.v ? 'var(--accent)' : 'var(--fg-2)' } }));
  }
  markProfileSeen() { const seen = (this.state.seenClues || []).slice(); (this.state.invLog || []).forEach(e => { const arr = this.CLUE_MAP[e.action + ':' + e.key]; if (!arr) return; arr.forEach(c => { const k = e.action + ':' + e.key + '|' + c.p + '|' + c.slot; if (seen.indexOf(k) < 0) seen.push(k); }); }); this.setState({ seenClues: seen }); }
  openProfileDetail(pid) { this.setState({ openProfile: pid }); }
  closeProfileDetail() { this.setState({ openProfile: null }); }
  setVerdict(pid, v) { const cur = this.state.verdicts || {}; const nv = Object.assign({}, cur); if (cur[pid] === v) delete nv[pid]; else nv[pid] = v; this.setState({ verdicts: nv }); }
  verdictMeta(v) {
    const t = this.T();
    const M = { cleared: { label: t.vdCleared, color: 'var(--fg-4)' }, watching: { label: t.vdWatching, color: 'var(--status-progress)' }, prime: { label: t.vdPrime, color: 'var(--label-red)' } };
    return M[v] || { label: t.vdNone, color: 'var(--fg-4)' };
  }
  addMemoForPerson(pid) { const id = 'm' + Date.now(); this.setState({ memos: (this.state.memos || []).concat([Object.assign({ id, quote: '', quotePid: null, content: '', targetType: 'person', targetId: pid }, this.memoMeta())]), editMemoId: id }); }
  buildProfiles() {
    const t = this.T(), ln = this.state.lang, log = this.state.invLog || [], seen = this.state.seenClues || [];
    const per = {}; this.PEOPLE.forEach(p => { per[p.id] = { slots: { motive: null, opportunity: null, means: null }, clues: [] }; });
    log.forEach(e => { const arr = this.CLUE_MAP[e.action + ':' + e.key]; if (!arr) return; arr.forEach(c => { if (!per[c.p]) return; const k = e.action + ':' + e.key + '|' + c.p + '|' + c.slot; const isNew = seen.indexOf(k) < 0; const logKey = e.action + ':' + e.key; if (!per[c.p].slots[c.slot]) per[c.p].slots[c.slot] = { text: c.ko, isNew, logKey }; per[c.p].clues.push({ text: c.ko, action: e.actionLabel, isNew, logKey }); }); });
    const sd = [{ k: 'motive', l: t.slotMotive }, { k: 'opportunity', l: t.slotOpportunity }, { k: 'means', l: t.slotMeans }];
    const narrBy = {}; log.forEach(e => { if (e.desc && (e.action === 'belongings' || e.action === 'phone') && per[e.key]) { (narrBy[e.key] = narrBy[e.key] || []).push({ title: e.title, desc: e.desc, actionLabel: e.actionLabel, barColor: e.type === 'empty' ? 'var(--fg-4)' : e.type === 'solution' ? 'var(--g-confirm)' : e.type === 'redherring' ? 'var(--status-progress)' : 'var(--accent)' }); } });
    return this.PEOPLE.map(p => { const d = per[p.id]; const memos = (this.state.memos || []).filter(m => m.targetType === 'person' && m.targetId === p.id);
      /**
       * ★ 「관계」가 없으면 **구분자까지** 없앤다 ★ (2026-07-29 밤)
       *
       * 마크업이 `{age} · {job} · {rel}` 로 ` · ` 를 **글자로** 박아뒀다. 생성
       * 인물은 `relKo` 가 비므로(위 §relStyle 과 같은 이유) **「· 30 · 주방 조리사 ·」**
       * 처럼 꼬리 점이 남았다 — 첫 실플레이에서 사용자가 찾았다.
       *
       * 구분자를 값이 갖게 하고 마크업의 것을 뺀다. **갈래가 안 늘어서**
       * `port-check` 는 그대로다(그 대조기는 `sc-if`·`sc-for` 이름만 본다).
       * 산장은 `relKo` 가 언제나 있으므로 **한 글자도 안 바뀐다.**
       */
      const relV = ln === 'ko' ? p.relKo : p.relEn;
      return { id: p.id, name: p.name, color: p.color, ini: p.ini, avStyle: this.avStyle(p, 30), job: ln === 'ko' ? p.jobKo : p.jobEn, age: this.sexAgeOf(p), rel: relV ? ' · ' + relV : '', claim: p.claimKo, clues: d.clues.map(c => ({ text: c.text, action: c.action, isNew: c.isNew, onJump: () => this.goToLog(c.logKey) })), hasClues: d.clues.length > 0, noClues: d.clues.length === 0,
      narr: narrBy[p.id] || [], hasNarr: !!(narrBy[p.id] || []).length,
      memos: memos.map(m => ({ quote: m.quote, hasQuote: !!m.quote, content: m.content })), hasMemos: memos.length > 0, noMemos: memos.length === 0, memoCount: memos.length,
      onOpen: () => this.openProfileDetail(p.id), onAddMemo: () => this.addMemoForPerson(p.id),
      verdict: this.state.verdicts[p.id] || null, verdictLabel: this.verdictMeta(this.state.verdicts[p.id]).label, verdictColor: this.verdictMeta(this.state.verdicts[p.id]).color, hasVerdict: !!this.state.verdicts[p.id],
      verdictOpts: ['cleared', 'watching', 'prime'].map(v => { const m = this.verdictMeta(v); const on = this.state.verdicts[p.id] === v; return { key: v, label: m.label, onPick: () => this.setVerdict(p.id, v), chipStyle: { display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 11px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (on ? m.color : 'var(--border-strong)'), background: on ? 'var(--bg-active)' : 'transparent', color: on ? m.color : 'var(--fg-3)', cursor: 'pointer', fontSize: '12px', fontWeight: on ? 600 : 500 }, dot: { width: '8px', height: '8px', borderRadius: '50%', background: m.color, flex: 'none' } }; }),
      avRingStyle: this.avStyle(p, 30, this.state.verdicts[p.id]),
      stopProp: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      invActions: [{ id: 'belongings', k: 'actBelong' }, { id: 'phone', k: 'actPhone' }].map(act => { const st = this.invStatusFor(act.id, [p.id]); const a = this.INV_ACTIONS.find(x => x.id === act.id);
        return { label: t[act.k], cost: a.cost, status: st, disabled: st !== 'ok', done: st === 'used',
          hint: st === 'used' ? t.invDone : st === 'nobudget' ? t.reasonBudget : (t.cost + ' ' + a.cost),
          onRun: st === 'ok' ? (() => this.askInvestigate(act.id, [p.id])) : (() => {}),
          style: { display: 'flex', alignItems: 'center', gap: '7px', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid ' + (st === 'used' ? 'var(--g-confirm)' : 'var(--border-strong)'), background: st === 'used' ? 'rgba(76,183,130,.08)' : (st === 'ok' ? 'var(--bg-elevated)' : 'transparent'), color: st === 'ok' ? 'var(--fg)' : 'var(--fg-4)', cursor: st === 'ok' ? 'pointer' : 'default', font: '500 12px var(--font-sans)' } }; }),
      slots: sd.map(s => { const f = d.slots[s.k]; return { label: s.l, filled: !!f, empty: !f, text: f ? f.text : '', isNew: f ? f.isNew : false, onJump: f ? (() => this.goToLog(f.logKey)) : (() => {}) }; }) }; });
  }
  goToLog(logKey) { this.setState({ view: 'investigate', openProfile: null, hlLog: logKey || null }); if (logKey) { clearTimeout(this._hlT); this._hlT = setTimeout(() => { if (this.state.hlLog === logKey) this.setState({ hlLog: null }); }, 2200); } }
  setMode(m) { this.setState({ stmtMode: m, openCell: null }); }
  /**
   * 인터루드를 하나 닫는다. 줄이 비면 게임으로 돌아간다.
   *
   * **건너뛰기가 없다** (`MEMORY.md` §건너뛰기는 없앤다). 인터루드는 새 정보가
   * 도착했다는 것을 나르는 화면이라 건너뛰면 못 보고 지나간다.
   */
  interludeNext() {
    const q = (this.state.interludeQ || []).slice(1);
    this.setState({ interludeQ: q, stage: q.length ? 'interlude' : 'free' });
  }
  /**
   * 인터루드 화면 데이터. **도착물의 「내용」은 담지 않는다** —
   * `MEMORY.md` §안전 규칙 1: *"도착한 사건을 말하고, 내용은 말하지 않는다."*
   * 내용은 각 화면(진술·현장·개요)에 영구히 남아 있고, 여기서는 어디를 보라는
   * 것만 알린다. 그래서 새 진술 문안·물증 기록을 여기로 가져오지 않는다.
   */
  buildInterlude() {
    const sid = (this.state.interludeQ || [])[0];
    if (!sid) return { open: false };
    const s = this.SECTIONS.find(x => x.id === sid);
    const r = this.REVEALS[sid] || {};
    const t = this.T(), ln = this.state.lang;
    const dest = [];
    if (r.statements) dest.push(t.navStatements);
    if (r.targets) dest.push(t.navMap);
    if (r.narrow) dest.push(t.navOverview);
    return {
      open: true,
      chapter: (ln === 'ko' ? (s ? s.num + '장 완성' : '') : (s ? 'Chapter ' + s.num + ' complete' : '')),
      paras: String(r.narration || '').split('\n').filter(Boolean).map(x => ({ text: x })),
      // 「무엇이 어디에 도착했는가」만. 내용은 그 화면에 있다
      hasDest: dest.length > 0,
      dest: (ln === 'ko' ? '새 정보 · ' : 'New information · ') + dest.join(' · '),
      onNext: () => this.interludeNext(),
    };
  }
  startRead() { this.setState({ stage: 'read', readIdx: 0 }); }
  readNext() { if (this.state.readIdx < this.PEOPLE.length - 1) this.setState({ readIdx: this.state.readIdx + 1 }); else this.finishRead(); }
  readPrev() { if (this.state.readIdx > 0) this.setState({ readIdx: this.state.readIdx - 1 }); }
  gotoRead(i) { this.setState({ readIdx: i }); }
  finishRead() { this.setState({ stage: 'free', readDone: true, view: 'narrative' }); }
  skipRead() { this.finishRead(); }
  toggleHi(key) { const h = Object.assign({}, this.state.readHi); h[key] = !h[key]; this.setState({ readHi: h }); }
  setMemo(pid, v) { const m = Object.assign({}, this.state.readMemos); m[pid] = v; this.setState({ readMemos: m }); }
  /**
   * 정독 카드가 **설 수 없을 때** 돌려주는 빈 자리. 모양은 `buildReadCard` 와 같다 —
   * 키가 하나라도 빠지면 `stageRead` 가 참인 순간 템플릿이 `undefined` 를 읽는다.
   */
  emptyReadCard() {
    return { idx: 0, total: (this.PEOPLE || []).length, name: '', ini: '', avStyle: {}, meta: '',
      gesturePre: '', gesturePost: '', hasPre: false, hasPost: false, gestureStyle: {}, gesturePostStyle: {},
      paras: [], memo: '', onMemo: () => {}, isLast: true, notLast: false,
      onNext: () => {}, onPrev: () => {}, onSkip: () => this.skipRead(), prevStyle: {}, dots: [] };
  }
  /**
   * ⛔ **`renderVals` 가 화면과 무관하게 매번 부른다**(호출부 `readCard:` 한 줄).
   * `stageRead` 가 아니어도 여기까지 오므로 `PEOPLE` 이 비었거나 `readIdx` 가 범위
   * 밖이면 `p.id` 에서 **앱이 통째로 죽는다** — 정독 화면 하나가 아니라 **전 화면**이다.
   * 2026-08-05 기본 디자인 감사 중 실제로 재현됐다.
   *
   * ★ **가드가 호출부가 아니라 여기 있는 이유** — 호출부에 걸면 다음 호출부가
   * 생길 때 같은 자리에서 다시 죽는다. 죽는 곳이 막아야 한다.
   */
  buildReadCard() {
    const p = (this.PEOPLE || [])[this.state.readIdx];
    if (!p || !this.STMT || !this.STMT[p.id]) return this.emptyReadCard();
    const t = this.T(), ln = this.state.lang;
    const paras = this.STMT[p.id].map((par, i) => { const key = p.id + '-' + i; const hi = !!this.state.readHi[key];
      return { text: par, onClick: () => this.toggleHi(key), style: { margin: '0 -8px 10px', padding: '3px 8px', borderRadius: '6px', fontSize: '15px', lineHeight: '1.85', color: 'var(--fg-2)', cursor: 'pointer', background: hi ? 'var(--accent-soft)' : 'transparent', boxShadow: hi ? 'inset 3px 0 0 var(--accent)' : 'none', textWrap: 'pretty' } }; });
    const last = this.state.readIdx === this.PEOPLE.length - 1;
    const g = this.STMT_GESTURE[p.id] || {};
    return { idx: this.state.readIdx + 1, total: this.PEOPLE.length, name: p.name, ini: p.ini, avStyle: this.avStyle(p, 30),
      gesturePre: ln === 'ko' ? (g.pre || '') : '', gesturePost: ln === 'ko' ? (g.post || '') : '', hasPre: !!(ln === 'ko' && g.pre), hasPost: !!(ln === 'ko' && g.post),
      gestureStyle: { fontSize: '14px', lineHeight: '1.7', color: 'var(--fg-4)', fontStyle: 'italic', margin: '0 0 12px', textWrap: 'pretty' },
      gesturePostStyle: { fontSize: '14px', lineHeight: '1.7', color: 'var(--fg-4)', fontStyle: 'italic', margin: '12px 0 0', textWrap: 'pretty' },
      meta: (ln === 'ko' ? (p.age + '\uc138') : ('' + p.age)) + (this.roleOrJob(p) ? ' \u00b7 ' + this.roleOrJob(p) : ''),
      paras, memo: this.state.readMemos[p.id] || '', onMemo: (e) => this.setMemo(p.id, e.target.value),
      isLast: last, notLast: !last, onNext: () => this.readNext(), onPrev: () => this.readPrev(), onSkip: () => this.skipRead(),
      prevStyle: { opacity: this.state.readIdx > 0 ? 1 : 0.35, pointerEvents: this.state.readIdx > 0 ? 'auto' : 'none' },
      dots: this.PEOPLE.map((pp, i) => ({ onClick: () => this.gotoRead(i), style: { width: '8px', height: '8px', borderRadius: '50%', cursor: 'pointer', background: i === this.state.readIdx ? 'var(--accent)' : (i < this.state.readIdx ? 'var(--fg-3)' : 'var(--border-strong)') } })) };
  }
  // 피해자는 `PEOPLE` 에 없다(용의자 배열이다). 여기서만 이름을 붙인다 —
  // 조사 기록·결과 카드·우측 패널이 전부 이 함수를 지나므로 한 자리면 된다.
  // 빠뜨리면 화면에 `chaewon` 이 그대로 찍힌다 (2026-07-27에 실제로 그랬다)
  /**
   * 피해자 표시줄. 사건이 주면 그것, 없으면 앱의 산장 값.
   *
   * 세 자리가 같은 문자열을 쓴다 — 개요 · 브리핑 · 보고서 머리. 하나만 고치면
   * 나머지 둘에 옛 이름이 남는다(07-27 확보 단어 영문이 정확히 그렇게 남았다).
   */
  victimLine(ln) {
    const v = this.VICTIM_LINE
    if (!v) return this.T().ovVictimV
    if (ln === 'ko') return v.ko
    // 영문이 없으면 앱 값을 지킨다 — 산장이 그 경우다 (위 `applyCase` §피해자 표시줄)
    return v.en || this.T().ovVictimV
  }
  pname(id) { const p = this.PEOPLE.find(x => x.id === id); if (p) return p.name; const v = this.VICTIM_TARGET; if (v && v.id === id) return v.name; const pl = this.PLACES.find(x => x.id === id); if (pl) return this.state.lang === 'ko' ? pl.ko : pl.en; const fx = (this.FIXTURES || []).find(x => x.id === id); if (fx) return this.state.lang === 'ko' ? fx.ko : fx.en; return id; }
  selectAction(id) { this.setState({ invSel: { action: id, targets: [] } }); }
  onGraphNode(id) { const p = this.PEOPLE.find(x => x.id === id); if (!p) return; let sel = (this.state.graphSel || []).slice(); const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else { sel.push(id); if (sel.length > 2) sel.shift(); } this.setState({ graphSel: sel }); }
  toggleTarget(id) { const s = this.state.invSel; if (!s.action) return; const a = this.INV_ACTIONS.find(x => x.id === s.action); let tg = s.targets.slice(); if (a.mode === 'pair') { const i = tg.indexOf(id); if (i >= 0) tg.splice(i, 1); else if (tg.length < 2) tg.push(id); } else tg = [id]; this.setState({ invSel: { action: s.action, targets: tg } }); }
  invSpent() { return (this.state.invLog || []).reduce((n, e) => n + e.cost, 0); }
  targetKey(action, targets) { const a = this.INV_ACTIONS.find(x => x.id === action); if (a.mode === 'none') return 'body'; if (a.mode === 'pair') return targets.slice().sort().join('+'); return targets[0]; }
  resultFor(a, k) {
    const M = {
      'search:annex': { type: 'solution', tKo: '대포폰 발견', tEn: 'Burner phone', dKo: '별채 게임기 뒤에서 발신 전용 대포폰.\u2018김선생\u2019 명의 거래 메시지가 남아 있다.', dEn: 'A burner phone behind the annex game console, with dealing messages under the alias \u201cKim.\u201d', ev: 'annexPhone' },
      'belongings:sakura': { type: 'solution', tKo: '유서 초안과 금고 열쇠', tEn: 'Draft note & safe key', dKo: '세라의 짐에서 윤다인 명의 유서 초안과 금고 열쇠가 나왔다. 위장에 쓰인 물건이다.', dEn: 'A forged draft note in Chae-won\u2019s name and a safe key, found in Sakura\u2019s things.' },
      'autopsy:body': { type: 'solution', tKo: '일산화탄소 중독 확정', tEn: 'CO poisoning confirmed', dKo: '사인은 일산화탄소 중독. 외상과 약물 반응은 없다. 사망 추정이 새벽 3~5시로 좁혀졌다.', dEn: 'Cause of death is CO poisoning; no wounds or drugs. The window narrows to 03:00\u201305:00.' },
      'belongings:wonyoung': { type: 'solution', tKo: '\u2018김선생\u2019 추적 메모', tEn: 'Trace on \u201cKim\u201d', dKo: '리원의 폰에 유통망 우두머리를 추적한 정황과 김선생 번호가 남아 있다.', dEn: 'Won-young\u2019s phone holds a trace on the ring\u2019s head and Kim\u2019s number.', ev: 'annexPhone' },
      'phone:wonyoung': { type: 'exclusion', tKo: '새벽 3시 통화 확인', tEn: '03:00 call verified', dKo: '리원은 새벽 3시 윤다인과 통화했다. 기지국 기록상 산장에서 멀리 떨어져 있었다.', dEn: 'Won-young called Chae-won at 03:00; cell records place him far from the lodge.' },
      'alibi:yujin+yuri': { type: 'exclusion', tKo: '나경 동선 일치', tEn: 'Yuri\u2019s route checks out', dKo: '나경은 장을 보고 유빈과 함께 도착했다. 사망 추정 시간대 현장 접근이 불가능하다.', dEn: 'Yuri shopped and arrived with Yujin \u2014 no access during the window.' },
      'alibi:yena+yujin': { type: 'exclusion', tKo: '지안 동선 일치', tEn: 'Yena\u2019s route checks out', dKo: '지안과 유빈의 도착 시각이 서로 일치한다. 두 사람 모두 오전에야 도착했다.', dEn: 'Yena and Yujin\u2019s arrival times corroborate \u2014 both arrived only in the morning.' },
      'belongings:yuri': { type: 'redherring', tKo: '약물 투약 흔적', tEn: 'Traces of drug use', dKo: '나경의 소지품에서 약물 흔적이 나왔다. 부끄러운 비밀이지만 살인과는 무관하다.', dEn: 'Signs of drug use in Yuri\u2019s things \u2014 a shameful secret, unrelated to the murder.' },
      'belongings:yena': { type: 'redherring', tKo: '출처 추적 메모', tEn: 'Source-tracing notes', dKo: '지안이 유통 경로를 캐던 메모. 수상해 보이지만 범행과는 무관하다.', dEn: 'Yena\u2019s notes tracing the supply chain \u2014 suspicious-looking but unrelated.' },
      'belongings:yujin': { type: 'redherring', tKo: '의심 메모', tEn: 'Suspicion notes', dKo: '유빈이 파스 출처로 다인을 의심한 메모. 개인적 의심일 뿐이다.', dEn: 'Yujin\u2019s notes suspecting Chae-won \u2014 a private hunch, nothing more.' },
      'phone:sakura': { type: 'empty', tKo: '개인폰 깨끗함', tEn: 'Personal phone is clean', dKo: '세라의 개인 명의 폰에는 특이사항이 없다. 개인폰만으로는 아무것도 드러나지 않는다.', dEn: 'Nothing on Sakura\u2019s registered phone \u2014 the personal line alone reveals nothing.' },
      'search:room': { type: 'empty', tKo: '이미 아는 것뿐', tEn: 'Nothing new', dKo: '화로와 연탄은 이미 알려진 사실. 방에서 새 단서는 나오지 않는다.', dEn: 'The brazier and briquette are already known; the room adds nothing new.' },
      'fixture:hearth': { type: 'solution', tKo: '화로 · 연탄 확인', tEn: 'Brazier · briquette', dKo: '화로에 남은 연탄이 사인의 근원으로 확인됐다.', dEn: 'The briquette in the brazier is confirmed as the source of death.', ev: null },
      'fixture:window': { type: 'solution', tKo: '창문 밀폐 테이프', tEn: 'Window taped shut', dKo: '창틀에 안쪽에서 붙인 테이프. 밀폐 위장 장치다.', dEn: 'Tape applied from inside the window frame — a sealing device.' },
      'fixture:safe': { type: 'solution', tKo: '금고 속 위장 유서', tEn: 'Fake note in safe', dKo: '금고에서 윤다인 명의 위장 유서 초안이 나왔다.', dEn: 'A forged draft note in Chae-won\u2019s name, found in the safe.' },
    };
    /**
     * 앱에 문안이 없으면 **엔진의 `action.result` 로 떨어진다** (2026-07-27).
     *
     * 조사 결과문은 사건 산문이므로 층 규칙상 엔진이 정본이다. 다만 기존 키의
     * 문안을 지금 갈아끼우면 **이식이 아니라 동작 변경**이 되므로(문장이 달라진다)
     * 덮어쓰지 않고 **폴백으로만** 둔다 — 앱에 있는 것은 앱 것을 쓴다.
     *
     * 이게 없으면 앱 표에 없는 조사가 `resultFor` 에서 `undefined` 를 받아
     * **공통 「빈손」 폴백으로 떨어진다.** 물증을 주는 조사가 빈손으로 보이는 것이
     * 제일 나쁘다 — `a_victim_bel` 이 정확히 그 상태였다.
     */
    /**
     * ★ `M` 은 **산장 사건일 때만** 본다 ★ (2026-07-29 오후)
     *
     * 위 주석의 *"앱에 있는 것은 앱 것을 쓴다"* 는 **사건이 하나뿐일 때 맞는
     * 말이었다.** `M` 은 산장의 저작 문안인데 키(`autopsy:body` 같은 것)가
     * 사건과 무관하게 생겨서, **생성 사건이 그대로 물려받고 있었다.**
     *
     * 실측(2026-07-29): 박물관·레지던시 사건에서 부검을 하면
     * *"사인은 일산화탄소 중독 … 사망 추정이 새벽 3~5시로 좁혀졌다"* 가 떴다.
     * 그 사건에 화로도 연탄도 없고 시간대 이름도 다른데. **「박물관 사건을
     * 열었는데 산장 프롤로그가 나온다」와 같은 부류**이고, 이쪽은 없는 사망
     * 시각까지 지어내 말한다.
     *
     * `_foreignCase` 로 가르면 산장은 **문안도 `ev` 플래그도 한 글자 안 바뀐다**
     * (위 이식 결정 유지) — 엔진에 없는 `fixture:safe`·`search:room` 둘도 그대로.
     */
    const hit = this._foreignCase ? undefined : M[a + ':' + k]
    if (hit) return hit
    const eng = this.CASE_ACTIONS?.[a + ':' + k]
    if (!eng?.result) return undefined
    const TYPE = { solution: 'solution', redherring: 'redherring', exclusion: 'exclusion', empty: 'empty' }
    return {
      type: TYPE[eng.yield] || 'empty',
      tKo: eng.result.title?.ko || '', tEn: eng.result.title?.en || eng.result.title?.ko || '',
      dKo: eng.result.body?.ko || '', dEn: eng.result.body?.en || eng.result.body?.ko || '',
    }
  }
  askInvestigate(actionId, targets) {
    const a = this.INV_ACTIONS.find(x => x.id === actionId); if (!a) return;
    if (this.invStatusFor(actionId, targets) !== 'ok') return;
    this.setState({ pendingInv: { action: actionId, targets: targets } });
  }
  cancelInvestigate() { this.setState({ pendingInv: null }); }
  confirmInvestigate() { const p = this.state.pendingInv; if (!p) return; const entry = this.doInvestigate(p.action, p.targets); this.setState({ pendingInv: null, invResult: entry || null }); }
  closeInvResult() { this.setState({ invResult: null }); }
  doInvestigate(actionId, targets) {
    const a = this.INV_ACTIONS.find(x => x.id === actionId); if (!a) return false;
    const need = a.mode === 'none' ? 0 : a.mode === 'pair' ? 2 : 1;
    if (a.mode !== 'none' && targets.length !== need) return false;
    const key = this.targetKey(actionId, targets), remaining = this.BUDGET - this.invSpent();
    if (a.cost > remaining) return false;
    if ((this.state.invLog || []).some(e => e.action === actionId && e.key === key)) return false;
    const r = this.resultFor(actionId, key) || { type: 'empty' }, ln = this.state.lang, t = this.T();
    const label = a.mode === 'none' ? '' : a.mode === 'pair' ? targets.map(id => this.pname(id)).join(' \u00b7 ') : this.pname(key);
    const entry = { action: actionId, key, actionLabel: t[a.k], targetLabel: label, cost: a.cost, type: r.type,
      title: r.tKo ? (ln === 'ko' ? r.tKo : r.tEn) : (ln === 'ko' ? '아무것도 없음' : 'Nothing found'),
      desc: r.dKo ? (ln === 'ko' ? r.dKo : r.dEn) : (ln === 'ko' ? '여기서는 새로운 단서가 나오지 않았다. 이 대상은 배제해도 좋다.' : 'No new clue here \u2014 this option can be ruled out.') };
    const ev = Object.assign({}, this.state.evidence); if (r.ev) ev[r.ev] = true;
    this.setState({ invLog: (this.state.invLog || []).concat([entry]), evidence: ev, invSel: { action: null, targets: [] } });
    return entry;
  }
  invStatusFor(actionId, targets) {
    const a = this.INV_ACTIONS.find(x => x.id === actionId); if (!a) return 'na';
    const key = this.targetKey(actionId, targets);
    if ((this.state.invLog || []).some(e => e.action === actionId && e.key === key)) return 'used';
    if (a.cost > (this.BUDGET - this.invSpent())) return 'nobudget';
    return 'ok';
  }
  runInvestigation() {
    const s = this.state.invSel; if (!s.action) return;
    this.doInvestigate(s.action, s.targets);
  }
  buildInvConfirm() {
    const p = this.state.pendingInv, t = this.T(), ln = this.state.lang; if (!p) return { open: false };
    const a = this.INV_ACTIONS.find(x => x.id === p.action); const remaining = this.BUDGET - this.invSpent();
    const label = a.mode === 'none' ? '' : a.mode === 'pair' ? p.targets.map(id => this.pname(id)).join(' · ') : this.pname(this.targetKey(p.action, p.targets));
    return { open: true, title: t[a.k] + (label ? ' · ' + label : ''),
      body: ln === 'ko' ? ('잔여 조사가 ' + a.cost + ' 차감됩니다. 남은 조사 ' + remaining + ' → ' + (remaining - a.cost) + '. 되돌릴 수 없습니다.') : ('Costs ' + a.cost + ' investigation' + (a.cost > 1 ? 's' : '') + '. ' + remaining + ' → ' + (remaining - a.cost) + '. This cannot be undone.'),
      onCancel: () => this.cancelInvestigate(), onRun: () => this.confirmInvestigate() };
  }
  buildInvResult() {
    const e = this.state.invResult, t = this.T(); if (!e) return { open: false };
    const tm = { solution: { lab: t.resSolution, c: 'var(--g-confirm)' }, redherring: { lab: t.resRed, c: 'var(--status-progress)' }, exclusion: { lab: t.resExcl, c: 'var(--accent)' }, empty: { lab: t.resEmpty, c: 'var(--fg-4)' } };
    const m = tm[e.type] || tm.empty;
    return { open: true, accent: m.c, typeLabel: m.lab, target: [e.actionLabel, e.targetLabel].filter(Boolean).join(' · '), title: e.title, body: e.desc,
      badgeStyle: { fontSize: '10px', fontWeight: 700, color: e.type === 'empty' ? 'var(--fg-3)' : '#0A0A0B', background: e.type === 'empty' ? 'var(--bg-elevated-2)' : m.c, borderRadius: 'var(--r-pill)', padding: '2px 8px' },
      onClose: () => this.closeInvResult(), saveLabel: this.state.lang === 'ko' ? '조사 기록에 보관' : 'Save to log' };
  }
  buildInvestigation() {
    const t = this.T(), ln = this.state.lang, s = this.state.invSel, spent = this.invSpent(), remaining = this.BUDGET - spent;
    const actions = this.INV_ACTIONS.map(a => ({ id: a.id, label: t[a.k], cost: a.cost, onSelect: () => this.selectAction(a.id),
      style: { display: 'flex', alignItems: 'center', gap: '10px', height: '40px', padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid ' + (s.action === a.id ? 'var(--accent)' : 'var(--border-strong)'), background: s.action === a.id ? 'var(--accent-soft)' : 'transparent', color: s.action === a.id ? 'var(--fg)' : 'var(--fg-2)', cursor: 'pointer' } }));
    const a = s.action ? this.INV_ACTIONS.find(x => x.id === s.action) : null, mode = a ? a.mode : null;
    let targets = [];
    if (mode === 'person' || mode === 'pair') {
      targets = this.PEOPLE.map(p => this.targetChip(p.id, p.name, s.targets));
      /**
       * 피해자는 **소지품 검사에만** 붙는다. 엔진에 `belongings:피해자` 조사가
       * 있을 때만이고(`CASE_ACTIONS` 로 확인), 알리바이 대조(`pair`)에는 절대
       * 안 붙인다 — 죽은 사람과 동선을 맞출 수는 없다. 통화내역도 엔진에 없다.
       */
      const v = this.VICTIM_TARGET;
      if (v && mode === 'person' && this.CASE_ACTIONS?.[s.action + ':' + v.id]) {
        targets = targets.concat([this.targetChip(v.id, v.name, s.targets)]);
      }
    }
    else if (mode === 'place') targets = this.PLACES.map(p => this.targetChip(p.id, ln === 'ko' ? p.ko : p.en, s.targets));
    const need = mode === 'none' ? 0 : mode === 'pair' ? 2 : 1;
    let reason = '', can = false;
    if (!a) reason = t.invPickAction;
    else if (mode !== 'none' && s.targets.length !== need) reason = mode === 'place' ? t.invPickPlace : mode === 'pair' ? t.invPickPair : t.invPickPerson;
    else { const key = this.targetKey(s.action, s.targets); if ((this.state.invLog || []).some(e => e.action === s.action && e.key === key)) reason = t.reasonUsed; else if (a.cost > remaining) reason = t.reasonBudget; else can = true; }
    const tm = { solution: { lab: t.resSolution, c: 'var(--g-confirm)' }, redherring: { lab: t.resRed, c: 'var(--status-progress)' }, exclusion: { lab: t.resExcl, c: 'var(--accent)' }, empty: { lab: t.resEmpty, c: 'var(--fg-4)' }, sealed: { lab: t.sealRecord, c: 'var(--g-lock-mark)' } };
    const log = (this.state.invLog || []).slice().reverse().map(e => { const terms = this.TERM_MAP[e.action + ':' + e.key] || []; const hasTerm = terms.length > 0; return ({ title: e.title, desc: e.desc, actionLabel: e.actionLabel, targetLabel: e.targetLabel, hasTarget: !!e.targetLabel, hasTerm: hasTerm, onOpen: hasTerm ? (() => this.openTerm(terms[0])) : (() => {}), typeLabel: tm[e.type].lab, isEmpty: e.type === 'empty', emptyTag: t.resEmptyTag,
      badgeStyle: e.type === 'empty' ? { fontSize: '10px', fontWeight: 700, color: 'var(--fg-3)', background: 'var(--bg-elevated-2)', borderRadius: 'var(--r-pill)', padding: '2px 8px' } : { fontSize: '10px', fontWeight: 700, color: '#0A0A0B', background: tm[e.type].c, borderRadius: 'var(--r-pill)', padding: '2px 8px' },
      barStyle: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: tm[e.type].c, borderRadius: 'var(--r-md) 0 0 var(--r-md)' },
      cardStyle: { position: 'relative', border: '1px solid ' + (this.state.hlLog === (e.action + ':' + e.key) ? 'var(--accent)' : 'var(--border)'), borderRadius: 'var(--r-md)', padding: '12px 14px 12px 16px', marginBottom: '8px', background: this.state.hlLog === (e.action + ':' + e.key) ? 'var(--accent-soft)' : 'transparent', cursor: hasTerm ? 'pointer' : 'default', transition: 'background .2s, border-color .2s' } }); });
    return { remaining, budget: this.BUDGET, actions, mode, targets, showTargets: mode === 'person' || mode === 'place' || mode === 'pair', noneTarget: mode === 'none',
      targetLabelHead: mode === 'place' ? t.invPickPlace : mode === 'pair' ? t.invPickPair : t.invPickPerson,
      canExec: can, showReason: !can, execReason: reason, onExec: () => this.runInvestigation(),
      execStyle: { opacity: can ? 1 : 0.45, pointerEvents: can ? 'auto' : 'none', width: '100%', justifyContent: 'center' },
      execLabel: a ? (t.invExec + ' \u00b7 ' + t.cost + ' ' + a.cost) : t.invExec,
      pips: [0, 1, 2, 3, 4].map(i => ({ style: { flex: 1, height: '6px', borderRadius: '3px', background: i < remaining ? 'var(--accent)' : 'var(--bg-elevated-2)' } })),
      log, emptyLog: log.length === 0,
      targetNotes: Object.keys(this.revealedTargets()).map(k => ({ label: (this.REVEAL_TARGET_LABELS[k] ? (ln === 'ko' ? this.REVEAL_TARGET_LABELS[k].ko : this.REVEAL_TARGET_LABELS[k].en) : k), secNum: this.revealedTargets()[k].secNum })) };
  }
  REVEAL_TARGET_LABELS = { 'search:annex': { ko: '별채 수색', en: 'Search the annex' } };
  targetChip(id, label, sel) { const on = sel.indexOf(id) >= 0; return { id, label, onToggle: () => this.toggleTarget(id), style: { display: 'inline-flex', alignItems: 'center', height: '28px', padding: '0 12px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'), background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--fg-2)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 } }; }
  caseStatus() { const s = this.state; if (this.allSealed()) return 'clear'; if (s.started) return 'inProgress'; return 'unplayed'; }
  allSealed() { return this.SECTIONS.every(x => this.secComplete(x.id)); }
  finishReport() { this.setState({ view: 'result', confirmFinish: false }); }
  reviewCase() { this.setState({ route: 'play', stage: 'free', view: 'result' }); }
  goHome() { this.setState({ route: 'home', confirmAbandon: false }); }
  openDetail(n) { this.setState({ route: 'detail', selectedCase: n }); }
  startCase() { this.setState({ route: 'play', stage: 'prologue', started: true, view: 'narrative' }); }
  resumeCase() { this.setState({ route: 'play' }); }
  reviewCaseOLD() { this.setState({ route: 'play', stage: 'free' }); }
  abandon() { this.setState({ route: 'home', confirmAbandon: false, started: false, stage: 'brief', readDone: false, readIdx: 0, solved: { s1: false, s2: false, s3: false, s4: false, s5: false }, blanks: {}, invLog: [], invSel: { action: null, targets: [] }, evidence: {}, cellMarks: {}, msg: {}, view: 'narrative' }); }
  statusChip(st) { const t = this.T(); const m = { clear: t.cleared, inProgress: t.inProgress, unplayed: t.unplayed, locked: t.locked }[st] || ''; const c = st === 'clear' ? 'var(--g-lock-mark)' : st === 'inProgress' ? 'var(--status-progress)' : 'var(--fg-3)'; const bg = st === 'clear' ? 'var(--g-lock-bg)' : st === 'inProgress' ? 'rgba(242,201,76,.14)' : 'var(--bg-elevated-2)'; return { label: m, style: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', color: c, background: bg } }; }
  buildHome() {
    const t = this.T(), ln = this.state.lang, status = this.caseStatus();
    /**
     * ⚠ **`s1·s2·s3` 만 세고 있었다** (2026-08-01 수정). 아래 §이어하기가 이 값을
     * `solved + '/' + this.SECTIONS.length` 로 찍는데, 5장 사건에서 4장을 봉해도
     * **「3/5」에서 멈춘다.** 장 수가 3으로 굳어 있던 시절의 잔재다 —
     * `SECTIONS` 는 사건마다 길이가 달라진다(§보고서를 엔진 chapters 에서 다시 만든다).
     */
    const solved = this.SECTIONS.filter(x => this.state.solved[x.id]).length;
    /**
     * ★ 다른 사건의 진행 상태 ★ (2026-07-31)
     *
     * `caseStatus()` 는 **지금 열려 있는 사건**의 것이다 — `allSealed()` 가 그 사건의
     * `SECTIONS` 를 세기 때문에 다른 사건에는 못 쓴다. 그래서 목록의 나머지는
     * **저장 키가 있나**로만 가른다.
     *
     * ✅ **~~끝낸 사건도 「진행 중」으로 보인다~~ — 닫혔다** (2026-08-01).
     *
     * *"정확히 하려면 저장에 완료 표시를 넣어야 하고, 그건 저장 형식 변경"* 이라고
     * 적어뒀는데 **형식을 안 바꿔도 됐다.** 저장에 이미 `blanks`(채운 공란)가 있고,
     * 사건의 공란 **총수**는 `cases/index.json` 이 실어 보낸다.
     *
     * ★ **`solved` 가 아니라 `blanks` 로 센다** ★ 둘은 다른 값이다:
     * ```
     * solved[sid]   computeReveals 가 장을 봉할 때 켜고 **끄지 않는다**  「한 번 봉했나」
     * blanks        clearBlank 가 지운다                              「지금 채워져 있나」
     * ```
     * 지금 열려 있는 사건의 `caseStatus()` 는 `allSealed()`, 곧 **공란**을 본다.
     * `solved` 로 세면 다 채우고 하나를 지운 사람에게 홈은 「클리어」인데 열어보면
     * 「작성 중」이 된다 — **한 화면이 두 말을 한다.** 같은 것을 세게 맞춘다.
     *
     * ⚠ **판(version)을 `loadSave` 와 같은 눈으로 본다.** 못 읽는 판이면 그 사건은
     * 열 때 **처음부터** 시작되므로(그쪽이 `null` 을 돌려준다) 여기서도 「미플레이」다.
     * 안 맞추면 홈은 「진행 중」인데 눌러보면 프롤로그가 뜬다.
     *
     * ⛳ 공란 총수를 모르는 경우(내장 폴백 목록)는 **예전대로 「진행 중」**이다 —
     * 셀 수가 없을 때 「클리어」라고 말하는 것이 「진행 중」보다 나쁘다.
     */
    const otherStatus = (c) => {
      try {
        const raw = localStorage.getItem('nobody-lies:' + c.id)
        if (!raw) return 'unplayed'
        const d = JSON.parse(raw)
        if (!d || this.SAVE_READABLE.indexOf(d.v) < 0) return 'unplayed'
        if (!c.blanks) return 'inProgress'
        const filled = Object.keys(d.blanks || {}).length
        return filled >= c.blanks ? 'clear' : 'inProgress'
      } catch (e) { return 'unplayed' }
    }
    const cases = this.CASES.map(c => {
      const mine = c.id && c.id === this.CASE_ID;
      const st = !c.real ? 'soon' : mine ? status : c.id ? otherStatus(c) : status;
      const chip = this.statusChip(st === 'soon' ? 'unplayed' : st);
      return { num: ('0' + c.n).slice(-2), title: ln === 'ko' ? c.titleKo : (c.titleEn || c.titleKo), diff: c.diff, est: ln === 'ko' ? c.estKo : c.estEn,
        chipLabel: st === 'soon' ? t.soonPrep : chip.label, chipStyle: chip.style,
        diffStyle: { background: 'var(--bg-elevated-2)', color: 'var(--fg-3)' },
        /**
         * 지금 열려 있는 사건이면 **상세 화면**으로(이어하기·포기가 거기 있다).
         * 다른 사건이면 **주소를 바꾼다** — 앱은 사건 하나만 들고 있어서
         * `main.jsx` 가 `key` 로 다시 마운트해야 표가 갈린다. 생성 사건이 이미
         * 그 길로 열린다(§만든 사건들의 `goRoute`).
         */
        onClick: () => (mine || !c.id ? this.openDetail(c.n) : this.goRoute('case=' + encodeURIComponent(c.id))),
        cardStyle: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' } }; });

    /**
     * ─────────────────────────────────────────────────────────────
     *  캠페인 생성기 입구 · 만들어진 사건 (2026-07-29)
     * ─────────────────────────────────────────────────────────────
     *
     * **행 렌더를 그대로 재사용한다.** 새 분기(`sc-if`/`sc-for`)를 만들지 않으므로
     * `port-check` 의 대조 대상이 늘지 않는다 — 프로토타입에 없는 화면을 여기에
     * 그리는 대신 **목록에 줄을 더하는 것**으로 끝낸다.
     *
     * 생성기 자체는 `Generator.jsx` 로 이 파일 밖에 있다.
     */
    const card = { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' };
    const dim = { background: 'var(--bg-elevated-2)', color: 'var(--fg-3)' };

    // 만든 사건들. 브라우저에 저장돼 있어서 이 기계에서만 보인다
    let mine = {};
    try { mine = JSON.parse(localStorage.getItem('nobody-lies:generated') || '{}'); } catch (e) { mine = {}; }
    /**
     * **지울 수 있는 것은 만든 사건뿐이다.** 앱 제공 사건(산장)은 아래 두 값을
     * 아예 안 달고 나가므로 행에 지울 자리가 생기지 않는다 — 막는 코드가 따로 없다.
     *
     * 되돌릴 수 없어서 **한 번 묻는다.** 생성기(`Generator.jsx`)는 맨 `×` 하나로
     * 지우는데 여기서 다르게 가는 근거는 둘이다: 홈의 행은 **누르면 사건이 열리는
     * 자리**라 오조작이 곧 소실이고, 만든 사건은 seed 가 무작위라 **같은 것을 다시
     * 만들 수 없다.** 물음은 행 안에 남는다 — 떴다 사라지는 문구가 아니다.
     */
    const ask = this.state.confirmDelCase;
    Object.values(mine).forEach((g, i) => {
      const asking = ask === g.id;
      const stop = (e) => { if (e && e.stopPropagation) e.stopPropagation(); };
      cases.push({
        num: 'G' + (i + 1), title: g.title, diff: g._difficulty || '', est: (g.chapters ? g.chapters.length : 0) + (ln === 'ko' ? '장' : ' ch'),
        chipLabel: ln === 'ko' ? '내가 만듦' : 'Generated',
        chipStyle: { background: 'var(--accent-soft)', color: 'var(--accent)' },
        diffStyle: dim,
        canDel: !asking, confirmDel: asking,
        delTitle: ln === 'ko' ? '이 사건 지우기' : 'Delete this case',
        askLabel: ln === 'ko' ? '지울까? 진행도 같이 사라진다' : 'Delete? progress goes too',
        yesLabel: ln === 'ko' ? '지운다' : 'Delete', noLabel: ln === 'ko' ? '취소' : 'Cancel',
        onDel: (e) => { stop(e); this.setState({ confirmDelCase: g.id }); },
        onDelYes: (e) => { stop(e); this.deleteGenerated(g.id); },
        onDelNo: (e) => { stop(e); this.setState({ confirmDelCase: null }); },
        delStyle: { fontSize: '11px', color: 'var(--fg-4)', cursor: 'pointer', flex: 'none', padding: '0 2px' },
        askStyle: { fontSize: '11px', color: 'var(--fg-3)', flex: 'none' },
        yesStyle: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '22px', padding: '0 8px', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--label-red)', cursor: 'pointer', font: '600 11px var(--font-sans)', flex: 'none' },
        noStyle: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '22px', padding: '0 8px', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--fg-3)', cursor: 'pointer', font: '600 11px var(--font-sans)', flex: 'none' },
        // 묻는 중에는 행을 눌러도 사건이 열리지 않는다 — 물음을 무르는 자리가 된다
        onClick: asking ? (() => this.setState({ confirmDelCase: null }))
          : (() => this.goRoute('case=local:' + encodeURIComponent(g.id))),
        cardStyle: card,
      });
    });

    cases.push({
      num: '＋', title: ln === 'ko' ? '캠페인 생성' : 'Generate a campaign',
      diff: '', est: ln === 'ko' ? '챗봇에게 세계를 받아온다' : 'bring a world from your chatbot',
      chipLabel: ln === 'ko' ? '새로 만들기' : 'New',
      chipStyle: { background: 'var(--accent)', color: '#fff' },
      diffStyle: dim,
      onClick: () => this.goRoute('generate'),
      cardStyle: Object.assign({}, card, { borderStyle: 'dashed', borderColor: 'var(--accent)' }),
    });

    // 「이어하기」는 **지금 열려 있는 사건**의 진행이다 — 제목도 그 사건 것이어야 한다
    return { resumeShow: status === 'inProgress', resumeTitle: this.T().caseTitle, resumeProgress: solved + '/' + this.SECTIONS.length, resumeBudget: this.BUDGET - this.invSpent(), onResume: () => this.resumeCase(), cases };
  }
  /**
   * 화면 이동. **경로를 새로 만들지 않고 해시만 바꾼다.**
   *
   * `/?generate` 로 가던 것을 두 번 고쳤다. `/` 는 `file://` 에서 파일시스템
   * 루트라 죽었고, `location.pathname + '?generate'` 는 안드로이드가 다운로드
   * 파일을 여는 `content://…/external_files/…` 에서 죽었다 — 그 공급자는 쿼리가
   * 붙은 URL 을 못 찾아 **「파일에 액세스할 수 없음」**이 뜬다(2026-07-29 실측).
   *
   * 해시는 URL 해석에 안 들어가므로 `http`·`file`·`content` 셋 다 산다.
   * `main.jsx` 가 `hashchange` 를 듣고 다시 그린다 — **문서를 다시 받지 않는다.**
   */
  goRoute(q) {
    window.location.hash = q;
  }

  /**
   * 만든 사건 하나를 지운다 — **진행 저장도 같이.** 저장 키가 `nobody-lies:<사건 id>`
   * 라서 안 지우면 같은 id 로 다시 만들었을 때 옛 진행이 되살아난다
   * (`Generator.jsx` 의 `forget` 과 같은 이유·같은 키다).
   *
   * 여기 오는 id 는 `nobody-lies:generated` 에 있는 것뿐이다. 앱 제공 사건은
   * 애초에 지울 자리가 렌더되지 않으므로 이 함수에 닿지 않는다.
   */
  deleteGenerated(id) {
    try {
      const all = JSON.parse(localStorage.getItem('nobody-lies:generated') || '{}');
      delete all[id];
      localStorage.setItem('nobody-lies:generated', JSON.stringify(all));
      localStorage.removeItem(`nobody-lies:${id}`);
    } catch (e) { /* 저장소를 못 쓰는 브라우저 — 화면만 되돌린다 */ }
    this.setState({ confirmDelCase: null });
  }

  buildDetail() {
    const t = this.T(), ln = this.state.lang, c = this.CASES[(this.state.selectedCase || 1) - 1] || this.CASES[0];
    const real = !!c.real, status = real ? this.caseStatus() : 'soon', chip = this.statusChip(status === 'soon' ? 'unplayed' : status);
    // 배지도 `rows` 의 난이도와 **같은 값**을 쓴다 — 전에는 배지만 `hard` 리터럴이었다
    return { title: ln === 'ko' ? c.titleKo : (c.titleEn || c.titleKo), real, diff: c.diff, chipLabel: real ? chip.label : t.soonPrep, chipStyle: chip.style,
      rows: [{ k: t.difficulty, v: c.diff }, { k: t.budgetLabel, v: real ? String(this.BUDGET) : '\u2014' }, { k: t.estTime, v: ln === 'ko' ? c.estKo : c.estEn }, { k: t.suspects, v: real ? t.suspectsVal : '\u2014' }].map((r, i, a) => ({ k: r.k, v: r.v, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < a.length - 1 ? '1px solid var(--border)' : 'none' } })),
      notPlayedNote: !real ? t.demoOnly : (status === 'unplayed' ? t.notPlayedYet : ''),
      primaryLabel: !real ? t.playSolo : status === 'clear' ? t.review : status === 'inProgress' ? t.resume : t.playSolo,
      onPrimary: !real ? (() => {}) : status === 'clear' ? (() => this.reviewCase()) : status === 'inProgress' ? (() => this.resumeCase()) : (() => this.startCase()),
      primaryStyle: { flex: '1 1 auto', justifyContent: 'center', opacity: real ? 1 : 0.4, pointerEvents: real ? 'auto' : 'none' },
      showAbandon: real && status === 'inProgress', onBack: () => this.goHome() };
  }

  secState(sid) {
    const s = this.state, idx = this.SECTIONS.findIndex(x => x.id === sid);
    if (s.reopenActive && s.reopenActive[sid]) return 'open';
    if (s.solved[sid]) return 'complete';
    if (idx === 0) return 'open';
    return s.solved[this.SECTIONS[idx - 1].id] ? 'open' : 'locked';
  }
  toggleSecExpand(sid) { const e = Object.assign({}, this.state.secExpand || {}); e[sid] = !e[sid]; this.setState({ secExpand: e }); }
  reopenSection(sid) { const ra = Object.assign({}, this.state.reopenActive || {}), ru = Object.assign({}, this.state.reopenUsed || {}); ra[sid] = true; ru[sid] = true; this.setState({ reopenActive: ra, reopenUsed: ru, openPicker: null }); }
  closeReopen(sid) { const ra = Object.assign({}, this.state.reopenActive || {}), e = Object.assign({}, this.state.secExpand || {}); delete ra[sid]; delete e[sid]; this.setState({ reopenActive: ra, secExpand: e, openPicker: null }); }
  /**
   * 장 완성 공개. **`applyCase` 가 엔진 `reveals` 에서 다시 만든다** — 이 값은
   * 사건 데이터가 없을 때의 기본값이다 (2026-07-27 이관).
   *
   * `yield` 와 `statements[].y` 는 **어디서도 읽지 않는다**(죽은 필드).
   * `terms` 는 분기가 있는데 가진 항목이 하나도 없다. 그래서 도출에서 뺐다.
   */
  REVEALS = {
    s1: { narrow: true, yield: 'narrow', targets: ['search:annex'], statements: [{ pid: 'yujin', y: 'flavor', text: '자살할 사람이 우리를 왜 불렀을까요? 초대장은 전날 밤에야 급하게 돌았어요.' }] },
    s3: { yield: 'decoy', statements: [{ pid: 'wonyoung', y: 'path', text: '유빈 언니가 출발할 때 같이 타려 했는데, 새벽에 깨서 그런지 늦잠을 자버렸어요.' }, { pid: 'yuri', y: 'decoy', text: '아 맞다, 저 그날 새벽에 잠깐 통화한 데가 있긴 한데… 그건 이 일이랑 상관없어요.' }] },
    s4: { yield: 'path', statements: [{ pid: 'yuri', y: 'path', text: '그 소문… 저도 어디서 흘러나온 건지 알 것 같아요. 세라 언니 쪽이었죠.' }] },
  };
  /**
   * 격자 칸 주장 공개. **엔진 `reveals[].addClaims` 의 `target: 'grid'` 에서
   * 나온다** (2026-07-27). 이 값은 사건 데이터가 없을 때의 기본값이다.
   */
  CLAIM_REVEALS = {
    s3: [{ pid: 'yuri', tid: 't1', ko: '통화 중 (본인 주장)', en: 'On a call (claim)' }],
  };
  revealedTerms() {
    const set = {};
    if (this.state.readDone) (this.SEED_TERMS || []).forEach(w => set[w] = 1);
    (this.state.invLog || []).forEach(e => { const a = this.TERM_MAP[e.action + ':' + e.key]; if (a) a.forEach(w => set[w] = 1); });
    this.SECTIONS.forEach(s => { if (this.state.solved[s.id]) { const r = this.REVEALS[s.id]; if (r && r.terms) r.terms.forEach(w => set[w] = 1); } });
    return set;
  }
  /**
   * 사망 구간이 좁혀졌나. **사건 파일이 축소를 선언했을 때만 참이다** (2026-07-30).
   *
   * 전에는 `invLog` 에 부검만 있으면 참이었다 — 산장에서는 그것이 곧 `narrows_window`
   * 를 가진 조사라 우연히 맞았지만, 생성 사건은 축소를 선언하지 않는데도 참이 되어
   * **창 이름이 산장의 「새벽 3~5시」로 바뀌었다.** 위 §applyCase 의 `_narrowSlots` 참조.
   */
  deathNarrowed() {
    if (!this._narrowSlots) return false;
    return (this.state.invLog || []).some(e => e.action === 'autopsy');
  }
  /**
   * 좁혀진 구간의 이름표. **두 자리가 같은 문자열을 글자로 갖고 있었다**
   * (격자 열 머리 · 브리핑) — 같은 계산 두 벌 금지에 걸리는 자리라 하나로 모았다.
   *
   * 산장은 `'새벽 3~5시'` 가 **저작된 문안**이다 — `narrows_window: [t1, t2]` 의 두
   * 슬롯 이름(「새벽 3시」·「새벽 3–8시」)으로는 이 글자가 안 나온다. 그래서 산장은
   * 앱 문안을 쓰고, **다른 사건은 남은 칸의 이름표에서 도출**한다.
   */
  narrowedLabel(ln) {
    if (!this._foreignCase) return ln === 'ko' ? '새벽 3~5시' : '03:00–05:00';
    const ids = this._narrowSlots || [];
    const lab = (id) => { const t = this.TIMES.find(x => x.id === id); return t ? (ln === 'ko' ? t.ko : t.en) : id; };
    if (!ids.length) return '';
    // 범위의 양 끝이 같은 칸이면 이름 하나다 — `[t1, t1]` 이 「전반 ~ 전반」으로 나오던 자리
    const first = lab(ids[0]), last = lab(ids[ids.length - 1]);
    return first === last ? first : `${first} ~ ${last}`;
  }
  revealedClaims() {
    const out = {}, seen = this.state.seenClaims || {};
    this.SECTIONS.forEach(s => { if (this.state.solved[s.id]) { const arr = this.CLAIM_REVEALS[s.id]; if (arr) arr.forEach(c => { out[c.pid] = out[c.pid] || {}; out[c.pid][c.tid] = { ko: c.ko, en: c.en, isNew: !seen[s.id + ':' + c.pid + ':' + c.tid] }; }); } });
    return out;
  }
  markClaimsSeen() { const seen = Object.assign({}, this.state.seenClaims || {}); this.SECTIONS.forEach(s => { if (this.state.solved[s.id]) { const arr = this.CLAIM_REVEALS[s.id]; if (arr) arr.forEach(c => { seen[s.id + ':' + c.pid + ':' + c.tid] = 1; }); } }); this.setState({ seenClaims: seen }); }
  addedStatements(pid) {
    const out = [], sel = this.state.sel;
    this.SECTIONS.forEach(s => { if (this.state.solved[s.id]) { const r = this.REVEALS[s.id]; if (r && r.statements) r.statements.forEach((st, i) => { if (st.pid === pid) { const pi = 'a' + s.id + i; out.push({ text: st.text, secNum: s.num, secTitle: this.state.lang === 'ko' ? s.tKo : s.tEn, onSelect: (ev) => this.onStmtSelect(pid, pi, ev), showTb: !!sel && sel.pid === pid && sel.pi === pi, tbStyle: sel ? { position: 'absolute', left: sel.left + 'px', top: sel.top + 'px', transform: 'translate(-50%,-100%)', marginTop: '-6px', zIndex: 41 } : {} }); } }); } });
    return out;
  }
  revealedTargets() {
    const out = {};
    this.SECTIONS.forEach(s => { if (this.state.solved[s.id]) { const r = this.REVEALS[s.id]; if (r && r.targets) r.targets.forEach(tk => out[tk] = { secNum: s.num }); } });
    return out;
  }

  openBlank(id) { this.setState({ openPicker: this.state.openPicker === id ? null : id, openCell: null, openAids: false }); }
  openTerm(w) { this.setState({ openTerm: w }); }
  buildTermDlg() {
    const w = this.state.openTerm; if (!w) return { open: false };
    const ln = this.state.lang, info = this.TERM_INFO[w] || {};
    const mc = (this.state.memos || []).filter(m => m.targetType === 'evidence' && m.targetId === w).length;
    return { open: true, label: w, iconPath: this.termIconPath(w),
      found: (ln === 'ko' ? info.fk : info.fe) || '—',
      desc: (ln === 'ko' ? info.dk : info.de) || '—',
      onClose: () => this.setState({ openTerm: null }), onQuote: () => this.quoteTermToMemo(w),
      memoCount: mc, hasMemos: mc > 0 };
  }
  pickBlank(id, val) { const b = Object.assign({}, this.state.blanks); b[id] = val; this.setState(Object.assign({ blanks: b, openPicker: null }, this.computeReveals(b))); }
  clearBlank(id) { const b = Object.assign({}, this.state.blanks); delete b[id]; this.setState({ blanks: b, openPicker: null }); }
  blankSection(bid) { for (const sid in this.SEC_BLANKS) if (this.SEC_BLANKS[sid].indexOf(bid) >= 0) return sid; return null; }
  secComplete(sid) { return this.SEC_BLANKS[sid].every(id => this.state.blanks[id] != null); }
  computeReveals(b) {
    const sv = Object.assign({}, this.state.solved); const newLog = []; let changed = false;
    this.SECTIONS.forEach((s, idx) => {
      const complete = this.SEC_BLANKS[s.id].every(id => b[id] != null);
      if (complete && !sv[s.id]) {
        sv[s.id] = true; changed = true;
        newLog.push({ action: 'seal', key: s.id, actionLabel: this.T().sealRecord, targetLabel: this.state.lang === 'ko' ? s.tKo : s.tEn, cost: 0, type: 'sealed', title: (this.state.lang === 'ko' ? (s.num + '장 완성') : ('Chapter ' + s.num + ' complete')), desc: this.sealSummaryFor(s.id, b) });
      }
    });
    if (!changed) return {};
    const unread = Object.assign({}, this.state.unread || {}); const dests = {};
    newLog.forEach(l => { const r = this.REVEALS[l.key]; if (!r) return; if (r.statements) { unread.statements = true; dests.statements = 1; } if (r.targets) { unread.map = true; dests.map = 1; } if (r.terms) { unread.narrative = true; dests.narrative = 1; } if (r.narrow) { unread.overview = true; unread.statements = true; dests.overview = 1; } });
    const nm = { statements: this.T().navStatements, map: this.T().navMap, narrative: this.T().navNarrative, overview: this.T().navOverview };
    const where = Object.keys(dests).map(k => nm[k]).filter(Boolean).join(' · ');
    const patch = { solved: sv, invLog: (this.state.invLog || []).concat(newLog), newReveal: (this.state.newReveal || []).concat(newLog.map(l => l.key)), unread: unread };
    /**
     * 장 인터루드 (2026-07-29). **장을 완성하면 전체화면 서술이 뜬다.**
     * `MEMORY.md` §장 인터루드 (F) 의 확정 설계이고, `Reveal.narration` 의 첫 소비자다.
     *
     * **줄로 쌓는다** — 한 번에 두 장이 완성될 수 있다(마지막 공란 하나가 두 장을
     * 동시에 닫는 경우는 없지만, 이어하기·되돌리기로 상태가 한꺼번에 움직일 수 있다).
     * 하나씩 보여주고 비면 게임으로 돌아간다.
     *
     * ⚠ **토스트와 겹치지 않게 한다.** 「한 번 보여주고 사라지는 텍스트는 버그다」가
     * 절대 규칙이라 토스트는 *어디에* 새 것이 생겼는지만 말하고, 내용은 원래 화면에
     * 영구히 남는다. 인터루드는 그 사이에 끼어 **도착 사실만** 전한다 — 도착물 자체는
     * 여전히 각 화면에 남아 있다.
     */
    const q = newLog.map(l => l.key).filter(k => this.REVEALS[k] && this.REVEALS[k].narration);
    if (q.length) { patch.interludeQ = (this.state.interludeQ || []).concat(q); patch.stage = 'interlude'; }
    if (where) { patch.toast = (this.state.lang === 'ko' ? '새 정보가 공개되었습니다 · ' : 'New information · ') + where; clearTimeout(this._toastT); this._toastT = setTimeout(() => this.setState({ toast: null }), 4600); }
    return patch;
  }
  sealSummaryFor(sid, b) { return this.SEC_BLANKS[sid].map(id => (b[id] || '') + this.particle(b[id] || '', this.BLANKS[id].par)).join(' · '); }
  sealSummary(sid) { const ln = this.state.lang; return this.SEC_BLANKS[sid].map(id => this.BLANKS[id].ans + this.particle(this.BLANKS[id].ans, this.BLANKS[id].par)).join(' · '); }

  markCell(key) { this.setState({ openCell: this.state.openCell === key ? null : key, openPicker: null, openAids: false }); }
  setMark(key, v) { const c = Object.assign({}, this.state.cellMarks || {}); if (v) c[key] = v; else delete c[key]; this.setState({ cellMarks: c, openCell: null }); }

  /**
   * 인물 카드의 두 번째 칸. **역할이 있으면 역할, 없으면 직업.**
   *
   * 산장 사건은 `role`(산장지기·아이돌·최초 발견자…)이 사건의 사실이라 그대로 쓴다.
   * 생성 사건은 엔진이 `role` 을 안 주고 `applyCase` 가 물려주지도 않으므로
   * 비는데, 그때 칸이 통째로 사라지면 나이만 남아 허전하다 — 엔진이 주는
   * **직업**으로 떨어진다. 세 화면(정독·격자·용의자)이 같은 칸을 쓰므로 한곳에 둔다.
   */
  roleOrJob(p) {
    const ln = this.state.lang, t = this.T();
    return t[p.role] || (ln === 'ko' ? (p.jobKo || '') : (p.jobEn || ''));
  }
  avStyle(p, size, verdict) {
    size = size || 24;
    const base = { width: size + 'px', height: size + 'px', borderRadius: '6px', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '600 ' + Math.round(size * 0.42) + 'px var(--font-sans)', color: '#0A0A0B', background: 'linear-gradient(135deg,' + p.c1 + ',' + p.c2 + ')' };
    if (verdict) { const vc = { cleared: 'var(--fg-4)', watching: 'var(--status-progress)', prime: 'var(--label-red)' }[verdict]; base.boxShadow = '0 0 0 2px var(--bg-app), 0 0 0 4px ' + vc; if (verdict === 'cleared') base.opacity = 0.55; }
    return base;
  }

  buildBlank(bid) {
    const t = this.T(), def = this.BLANKS[bid], sid = this.blankSection(bid);
    const editable = this.secState(sid) === 'open';
    const val = this.state.blanks[bid] != null ? this.state.blanks[bid] : null;
    const isEmpty = editable && val == null;
    const isFilled = editable && val != null;
    const isLocked = !editable && val != null;
    const disp = val != null ? (val + this.particle(val, def.par)) : '';
    const emptyStyle = { display: 'inline-block', minWidth: '58px', textAlign: 'center', borderBottom: '1.5px dashed var(--g-empty-line)', color: 'var(--fg-4)', padding: '0 9px 2px', margin: '0 1px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, borderRadius: '4px 4px 0 0' };
    const fillStyle = { display: 'inline-block', background: 'var(--g-fill-bg)', color: 'var(--g-fill-fg)', fontWeight: 600, padding: '1px 9px', margin: '0 1px', borderRadius: 'var(--r-sm)', cursor: 'pointer', border: '1px solid transparent' };
    const lockStyle = { display: 'inline-block', background: 'var(--bg-elevated-2)', color: 'var(--fg)', fontWeight: 600, padding: '1px 9px', margin: '0 1px', borderRadius: 'var(--r-sm)' };
    let options = [], isWord = false, optionsEmpty = false, pickHead = t.pickList;
    if (def.src === 'collected') {
      isWord = true; pickHead = t.pickWord;
      const rev = this.revealedTerms();
      options = this.COLLECTED_POOL.filter(w => rev[w]).map(c => ({ label: c, onPick: () => this.pickBlank(bid, c) }));
      optionsEmpty = options.length === 0;
    } else {
      options = this.CAND[def.src].map(c => ({ label: c, onPick: () => this.pickBlank(bid, c) }));
    }
    return {
      isEmpty, isFilled, isLocked, disp, hint: t[def.kind], lockStyle, fillStyle, emptyStyle,
      onOpen: () => { if (editable) this.openBlank(bid); }, pickerOpen: this.state.openPicker === bid,
      options, optionsEmpty, isWord, pickHead, canClear: val != null, onClear: () => this.clearBlank(bid),
    };
  }

  buildSections() {
    const t = this.T(), s = this.state;
    return this.SECTIONS.map(sec => {
      const st = this.secState(sec.id);
      const locked = st === 'locked', complete = st === 'complete', open = st === 'open';
      const reopenActive = !!(s.reopenActive && s.reopenActive[sec.id]);
      const reopenUsed = !!(s.reopenUsed && s.reopenUsed[sec.id]);
      const expanded = complete && !!(s.secExpand && s.secExpand[sec.id]);
      const collapsed = complete && !expanded;
      const filled = this.SEC_BLANKS[sec.id].filter(id => s.blanks[id] != null).length;
      const total = this.SEC_BLANKS[sec.id].length;
      const chipStyle = { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated-2)', color: 'var(--fg-4)' };
      const card = { border: '1px solid ' + (locked || complete ? 'var(--border)' : 'var(--border-strong)'), borderRadius: 'var(--r-md)', padding: (locked || collapsed) ? '13px 18px' : '18px 20px', marginBottom: '10px', background: 'transparent', opacity: locked ? 0.6 : 1, transition: 'background .3s var(--ease)' };
      return {
        id: sec.id, locked: locked, notLocked: !locked, complete: complete, open: open, reopenActive: reopenActive,
        expanded: expanded, collapsed: collapsed, showChevron: complete, chevronDown: expanded,
        showStatusIcon: open, showChip: open, showCollapsedRight: collapsed,
        reopenStatusLabel: reopenUsed ? t.reopenUsed : t.reopenAvail,
        headerCursor: complete ? 'pointer' : 'default',
        onToggle: complete ? (() => this.toggleSecExpand(sec.id)) : (() => {}),
        showBody: open || (complete && expanded),
        showReopenBtn: complete && expanded && !reopenUsed, showCloseReopen: reopenActive && this.secComplete(sec.id),
        onReopen: () => this.reopenSection(sec.id), onCloseReopen: () => this.closeReopen(sec.id),
        reopenLabel: t.reopenBtn, closeReopenLabel: t.reopenDone, lockedHint: t.secLockedHint, reopenWarn: t.reopenWarn,
        numLabel: (s.lang === 'ko' ? (sec.num + '장') : ('Chapter ' + sec.num)),
        title: s.lang === 'ko' ? sec.tKo : sec.tEn, statusKey: 'progress',
        stateLabel: t.secTodo, stateChipStyle: chipStyle, cardStyle: card,
        progressLabel: filled + ' / ' + total, listBlanks: [], filledCount: filled, totalBlanks: total,
        parts: sec.parts.map(p => p.b
          ? { isText: false, isBlank: true, blank: this.buildBlank(p.b) }
          : { isText: true, isBlank: false, text: p.text }),
      };
    });
  }

  buildResult() {
    const t = this.T(), ln = this.state.lang;
    const total = Object.keys(this.BLANKS).length;
    const correct = Object.keys(this.BLANKS).filter(id => this.state.blanks[id] === this.BLANKS[id].ans).length;
    const done = this.allSealed();
    const spent = this.invSpent(), remaining = this.BUDGET - spent;
    const stuck = !done && remaining <= 0;
    const story = this.SECTIONS.map(s => ({ num: s.num, title: ln === 'ko' ? s.tKo : s.tEn, sealed: this.secComplete(s.id), sealedOpacity: this.secComplete(s.id) ? 1 : 0.45,
      text: this.SEC_BLANKS[s.id].map(id => this.BLANKS[id].ans + this.particle(this.BLANKS[id].ans, this.BLANKS[id].par)).join(' · ') }));
    const CAT = { vTool: 'evi', vConceal: 'evi', vStaging: 'evi', vItem: 'evi', vHideout: 'evi', vCause: 'evi', vContact: 'evi', vPerson: 'circ', vPlace: 'circ', vTime: 'circ', vLastSeen: 'circ', vMotive: 'susp', vIdentity: 'susp', vTarget: 'susp' };
    const catMeta = { evi: ln === 'ko' ? '물증' : 'Evidence', circ: ln === 'ko' ? '정황' : 'Circumstance', susp: ln === 'ko' ? '심증' : 'Conviction' };
    const catAgg = { evi: [0, 0], circ: [0, 0], susp: [0, 0] };
    Object.keys(this.BLANKS).forEach(id => { const d = this.BLANKS[id]; if (d.nominate) return; const c = CAT[d.kind] || 'circ'; catAgg[c][1]++; if (this.state.blanks[id] === d.ans) catAgg[c][0]++; });
    const catScores = ['evi', 'circ', 'susp'].map(c => ({ label: catMeta[c], correct: catAgg[c][0], total: catAgg[c][1], pct: catAgg[c][1] ? Math.round(catAgg[c][0] / catAgg[c][1] * 100) : 0, barStyle: { width: (catAgg[c][1] ? (catAgg[c][0] / catAgg[c][1] * 100) : 0) + '%', height: '100%', background: 'var(--accent)', borderRadius: '3px' } }));
    const nomId = Object.keys(this.BLANKS).find(id => this.BLANKS[id].nominate);
    const nomOk = nomId && this.state.blanks[nomId] === this.BLANKS[nomId].ans;
    const pColor = {}; this.PEOPLE.forEach(p => { pColor[p.name] = p.c1; });
    /**
     * 결말 조각의 재배열 순서. 사건 시간순은 장 순서와 다르다.
     *
     * **`['s1','s3','s2','s4','s5']` 하드코딩이었다** — 5장 고정 시절의 값이다.
     * 장 수가 사건 파일에서 오게 되면서(2026-07-29) 6장부터는 뒤가 잘렸다.
     * `epilogue_order` 로 계산한다. 산장 사건은 결과가 옛 하드코딩과 같다(실측).
     */
    const ORDER = this.SECTIONS.slice()
      .sort((a, b) => (a.epOrder ?? a.num) - (b.epOrder ?? b.num))
      .map(s => s.id);
    const catL = { vTool: '도구', vConceal: '은폐수단', vStaging: '위장물', vItem: '물품', vHideout: '은닉처', vCause: '사인', vContact: '접촉수단', vPerson: '인물', vPlace: '장소', vTime: '시각', vLastSeen: '마지막목격자', vMotive: '동기', vIdentity: '정체', vTarget: '협박대상' };
    const corrections = [];
    const mkNarr = (mode) => ORDER.map(sid => { const s = this.SECTIONS.find(x => x.id === sid); if (!s) return null;
      const runs = s.parts.map(part => { if (!part.b) return { isText: true, text: part.text };
        const def = this.BLANKS[part.b], mine = this.state.blanks[part.b], right = def.ans, ok = mine === right;
        const val = mode === 'real' ? right : (mine || right);
        const disp = val + this.particle(val, def.par);
        const color = mode === 'mine' && !ok ? 'var(--g-contradict)' : (pColor[val] || 'var(--accent)');
        return { isText: false, isBlank: true, disp, style: { fontWeight: 600, color } };
      });
      return { runs };
    }).filter(Boolean);
    const narrMine = mkNarr('mine'), narrReal = mkNarr('real');
    Object.keys(this.BLANKS).forEach(id => { const d = this.BLANKS[id]; const mine = this.state.blanks[id]; if (mine !== d.ans) corrections.push({ label: (ln === 'ko' ? (catL[d.kind] || '') : d.kind), mine: mine || (ln === 'ko' ? '미입력' : 'blank'), right: d.ans }); });
    const anyWrong = corrections.length > 0;
    return { done, stuck, correct, total, spent, narrMine, narrReal, anyWrong, allCorrect: !anyWrong, corrections, nomId,
      foldOpen: this.state.resultFold, onToggleFold: () => this.setState({ resultFold: !this.state.resultFold }),
      foldLabel: (this.state.resultFold ? (ln === 'ko' ? '바로잡기 접기' : 'Hide corrections') : (ln === 'ko' ? ('바로잡기 ' + corrections.length + '곳') : (corrections.length + ' corrections'))), foldChevron: this.state.resultFold ? '▾' : '▸',
      mineLabel: ln === 'ko' ? '내가 재구성한 이야기' : 'My reconstruction', realLabel: ln === 'ko' ? '실제' : 'Actual',
      endTitle: nomOk ? (ln === 'ko' ? '사건의 전말' : 'What really happened') : (ln === 'ko' ? '미완의 조서' : 'An unfinished file'),
      catScores, nomLabel: ln === 'ko' ? '범인 특정' : 'Culprit', nomOk, nomResult: nomOk ? (ln === 'ko' ? '성공' : 'Correct') : (ln === 'ko' ? '실패' : 'Missed'),
      nomStyle: { fontSize: '12px', fontWeight: 700, color: nomOk ? 'var(--g-confirm)' : 'var(--g-contradict)' },
      titleLabel: done ? (ln === 'ko' ? '사건 종결' : 'Case closed') : (ln === 'ko' ? '미결' : 'Unresolved'),
      metrics: [
        { k: ln === 'ko' ? '사용한 조사' : 'Investigations', v: spent + ' / ' + this.BUDGET },
        { k: ln === 'ko' ? '정확도' : 'Accuracy', v: correct + ' / ' + total },
        { k: ln === 'ko' ? '소요 시간' : 'Time', v: '—' },
      ],
      onHome: () => this.goHome() };
  }
  GRAPH_NODES = [
    { id: 'victim', kind: 'victim', ko: '윤다인', en: 'Kim Chae-won', x: 50, y: 50 },
    { id: 'yena', kind: 'person', x: 22, y: 22 },
    { id: 'yujin', kind: 'person', x: 50, y: 15 },
    { id: 'sakura', kind: 'person', x: 80, y: 30 },
    { id: 'yuri', kind: 'person', x: 82, y: 72 },
    { id: 'wonyoung', kind: 'person', x: 24, y: 78 },
    { id: 'ring', kind: 'secret', ko: "마약망 '김선생'", en: "Ring 'Kim'", x: 62, y: 88, gate: 's4' },
  ];
  GRAPH_EDGES = [
    { a: 'sakura', b: 'ring', ko: '정체', en: 'Is', gate: 's4', danger: true },
    { a: 'ring', b: 'victim', ko: '폭로 임박', en: 'Exposure', gate: 's5', danger: true },
    { a: 'wonyoung', b: 'ring', ko: '추적', en: 'Tracing', gate: 's4' },
  ];
  GRAPH_EVIDENCE = [
    { logKey: 'belongings:yuri', node: null, a: 'yuri', b: 'ring', ko: '약물 정황', en: 'Drug link', danger: false },
    { logKey: 'search:annex', node: { id: 'burner', ko: '대포폰', en: 'Burner', x: 88, y: 62 }, a: 'burner', b: 'sakura', ko: '소지', en: 'Owned by', danger: true },
    { logKey: 'belongings:sakura', node: { id: 'note', ko: '위장 유서', en: 'Fake note', x: 62, y: 40 }, a: 'note', b: 'sakura', ko: '작성', en: 'Written by', danger: true },
    { logKey: 'phone:wonyoung', node: null, a: 'wonyoung', b: 'victim', ko: '새벽 통화 확인', en: 'Call verified', danger: false },
  ];
  buildGraph() {
    const ln = this.state.lang, t = this.T(), byId = {}, secured = {}, sel = this.state.graphSel || [];
    (this.state.invLog || []).forEach(e => { secured[e.action + ':' + e.key] = true; });
    const extraNodes = this.GRAPH_EVIDENCE.filter(g => secured[g.logKey] && g.node).map(g => ({ id: g.node.id, kind: 'evidence', ko: g.node.ko, en: g.node.en, x: g.node.x, y: g.node.y }));
    const allNodes = this.GRAPH_NODES.concat(extraNodes);
    const nodes = allNodes.filter(n => !n.gate || this.state.solved[n.gate]).map(n => {
      const p = this.PEOPLE.find(x => x.id === n.id);
      const label = p ? p.name : (ln === 'ko' ? n.ko : n.en);
      const color = p ? p.color : (n.kind === 'victim' ? 'var(--fg-2)' : n.kind === 'evidence' ? 'var(--accent)' : 'var(--g-contradict)');
      const isSel = sel.indexOf(n.id) >= 0;
      const o = { id: n.id, kind: n.kind, label, color, x: n.x, y: n.y, selectable: !!p, onClick: p ? () => this.onGraphNode(n.id) : null,
        dotStyle: { position: 'absolute', left: n.x + '%', top: n.y + '%', transform: 'translate(-50%,-50%)', width: n.kind === 'victim' ? '18px' : '14px', height: n.kind === 'victim' ? '18px' : '14px', borderRadius: (n.kind === 'secret' || n.kind === 'evidence') ? '3px' : '50%', background: color, border: '2px solid var(--bg-app)', boxShadow: isSel ? '0 0 0 3px var(--accent)' : (n.kind === 'victim' ? '0 0 0 3px var(--border-strong)' : 'none'), cursor: p ? 'pointer' : 'default' },
        labelStyle: { position: 'absolute', left: n.x + '%', top: 'calc(' + n.y + '% + 12px)', transform: 'translate(-50%,0)', fontSize: '11px', fontWeight: 500, color: p ? color : 'var(--fg-3)', whiteSpace: 'nowrap', pointerEvents: 'none' } };
      byId[n.id] = n; return o;
    });
    const evEdges = this.GRAPH_EVIDENCE.filter(g => secured[g.logKey]).map(g => ({ a: g.a, b: g.b, ko: g.ko, en: g.en, danger: g.danger, supersede: true }));
    const combined = this.GRAPH_EDGES.concat(evEdges).filter(e => (!e.gate || this.state.solved[e.gate]) && byId[e.a] && byId[e.b]);
    const pairHasEv = {}; combined.forEach(e => { if (e.supersede) pairHasEv[[e.a, e.b].sort().join('|')] = true; });
    const seen = {};
    const edges = combined.filter(e => { const k = [e.a, e.b].sort().join('|'); if (!e.supersede && pairHasEv[k]) return false; return true; }).map(e => {
      const a = byId[e.a], b = byId[e.b]; const k = [e.a, e.b].sort().join('|'); const dup = (seen[k] || 0); seen[k] = dup + 1; const off = dup * 5;
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 + off,
        label: ln === 'ko' ? e.ko : e.en, danger: !!e.danger, labelColor: e.danger ? 'var(--g-contradict)' : 'var(--fg-3)',
        stroke: e.danger ? 'var(--g-contradict)' : 'var(--border-strong)', width: e.danger ? 0.5 : 0.35 };
    });
    let alibi = { show: false };
    if (sel.length === 2) { const status = this.invStatusFor('alibi', sel); alibi = { show: true, names: sel.map(id => this.pname(id)).join(' · '), status: status, disabled: status !== 'ok', hint: status === 'used' ? t.invDone : status === 'nobudget' ? t.reasonBudget : '', onRun: () => this.askInvestigate('alibi', sel), onClear: () => this.setState({ graphSel: [] }), runStyle: { display: 'inline-flex', alignItems: 'center', height: '30px', padding: '0 14px', borderRadius: 'var(--r-sm)', border: 'none', cursor: status === 'ok' ? 'pointer' : 'not-allowed', font: '600 12px var(--font-sans)', background: status === 'ok' ? 'var(--accent)' : 'var(--bg-elevated-2)', color: status === 'ok' ? '#0A0A0B' : 'var(--fg-4)' } }; }
    return { nodes, edges, alibi, legendPerson: ln === 'ko' ? '용의자' : 'Suspects', legendSecret: ln === 'ko' ? '드러난 사건' : 'Revealed', legendEvidence: ln === 'ko' ? '확보 물증' : 'Evidence', hint: ln === 'ko' ? '두 용의자를 선택해 알리바이를 대조하세요. 조사·항 완성으로 관계가 드러납니다.' : 'Select two suspects to cross-check alibis. Relationships surface as you investigate.', selCount: sel.length };
  }
  segTab(active) { return { flex: 1, textAlign: 'center', padding: '7px 4px', fontSize: '12px', fontWeight: active ? 600 : 500, color: active ? 'var(--fg)' : 'var(--fg-3)', background: active ? 'var(--bg-active)' : 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer' }; }
  GEO = {
    vb: { w: 1000, h: 625 },
    scale: { x: 96, len: 90, y: 585 },
    buildings: [
      { id: 'main', x: 70, y: 60, w: 532, h: 485, poche: 'var(--fg-3)' },
      { id: 'annex', x: 712, y: 66, w: 228, h: 150, poche: 'var(--accent)' },
    ],
    rooms: [
      { id: 'vroom', b: 'main', loc: 'room', x: 70, y: 60, w: 260, h: 485, ko: '다인의 방', en: "Chae-won's room", scene: true, tint: 'rgba(235,87,87,.10)', primary: true },
      { id: 'living', b: 'main', loc: 'main', x: 330, y: 60, w: 272, h: 270, ko: '거실', en: 'Living', primary: true },
      { id: 'kitchen', b: 'main', loc: 'main', x: 330, y: 330, w: 272, h: 215, ko: '부엌', en: 'Kitchen' },
      { id: 'annexRoom', b: 'annex', loc: 'annex', x: 712, y: 66, w: 228, h: 150, ko: '별채', en: 'Annex', primary: true },
    ],
    zones: [
      { id: 'approachZ', loc: 'approach', x: 712, y: 430, w: 228, h: 140, ko: '진입로', en: 'Approach', hatch: true, primary: true },
      { id: 'homeZ', loc: 'home', x: 712, y: 250, w: 228, h: 120, ko: '자택 (현장 밖)', en: 'Home (off-site)', offsite: true, primary: true },
    ],
    doors: [
      { id: 'roomdoor', x1: 330, y1: 200, x2: 330, y2: 280, hinge: 'p2', swing: -1, ko: '방문', en: 'Room', lx: 370, ly: 240 },
      { id: 'ldoor', x1: 430, y1: 330, x2: 510, y2: 330, open: true },
      { id: 'front', x1: 602, y1: 150, x2: 602, y2: 216, hinge: 'p2', swing: -1, ext: true, ko: '정문', en: 'Front', lx: 566, ly: 183 },
      { id: 'back', x1: 602, y1: 430, x2: 602, y2: 496, hinge: 'p2', swing: -1, ext: true, ko: '후문', en: 'Back', lx: 566, ly: 463 },
      { id: 'annexdoor', x1: 712, y1: 124, x2: 712, y2: 158, hinge: 'p1', swing: -1, ext: true, building: 'annex', ko: '문', en: 'Door', lx: 700, ly: 182 },
    ],
    windows: [
      { x1: 150, y1: 60, x2: 258, y2: 60, ko: '창문', en: 'Window', lx: 204, ly: 51 },
      { x1: 410, y1: 60, x2: 518, y2: 60, ko: '창문', en: 'Window', lx: 464, ly: 51 },
      { x1: 820, y1: 66, x2: 890, y2: 66, building: 'annex', ko: '창문', en: 'Window', lx: 855, ly: 61 },
    ],
    walks: [
      { b: 'annex', x1: 602, y1: 140, x2: 712, y2: 140, min: 10 },
      { b: 'approach', x1: 602, y1: 500, x2: 712, y2: 500, min: 2 },
    ],
    fixtures: { hearth: { x: 200, y: 415 }, window: { x: 204, y: 76 }, safe: { x: 466, y: 205 }, body: { x: 200, y: 300 } },
  };

  buildFloorplan() {
    const ln = this.state.lang, tsel = this.state.mapTime;
    const G = this.GEO, VW = G.vb.w, VH = G.vb.h;
    const px = v => (v / VW * 100), py = v => (v / VH * 100);
    /**
     * 가려진 건물의 **조건**은 엔진이 준다(`floor_plan.buildings[].revealed_after`).
     *
     * ★ 여기 있던 문자열 `'annex'` 일곱 개가 사라졌다 (2026-07-29 오후) ★
     * 산장 별채의 이름이었다. 조건은 이미 데이터(`b.gate`)로 읽고 있었는데
     * **무엇을 가릴지만 이름으로 찾고 있어서**, 건물을 `b_annex` 로 짓고 방을
     * `loc3` 으로 부르는 생성 사건은 **어느 필터에도 안 걸려 별채가 0장부터
     * 통째로 보였다** — 건물 외곽선·방·문·창·보행선 전부. 「1장 완성 후 공개」가
     * 조용히 죽어 있었고, `types.ts` 가 *"흐리게 두지 않고 아예 감춘다"* 며
     * 막아둔 누설이 그대로 났다.
     *
     * 바로 위 주석이 *"다른 건물을 가리는 사건이 오면 그때 필터를 데이터로
     * 돌려야 한다"* 고 예고해둔 자리다. 그 사건이 왔다.
     */
    const gatedB = G.buildings.find(b => b.gate);
    const annexOn = !gatedB || !!this.state.solved[gatedB.gate];
    const gateB = gatedB ? gatedB.id : null;
    // 가려질 수 있는 건물에 속한 방들의 `loc`. 열렸는지와 무관하게 모아둔다 —
    // 「N장 완성으로 공개」 배지가 **열린 뒤에** 이 집합을 쓴다
    const gateLoc = {};
    if (gateB) G.rooms.forEach(r => { if (r.b === gateB) gateLoc[r.loc] = true; });
    /** 아직 안 열렸으면 감춘다. 인자는 「이것이 가려진 건물의 것인가」 */
    const hid = x => !annexOn && !!x;
    const eps = 0.6;

    const secured = {}; (this.state.invLog || []).forEach(e => { secured[e.action + ':' + e.key] = true; });
    const cluesByLoc = {}; this.FLOOR_CLUES.forEach(c => { if (secured[c.logKey]) { (cluesByLoc[c.loc] = cluesByLoc[c.loc] || []).push({ label: ln === 'ko' ? c.ko : c.en, iconPath: this.termIconPath(c.ko) }); } });

    const areas = G.rooms.concat(G.zones).filter(a => !hid(gateLoc[a.loc]));
    const anchorByLoc = {}; areas.forEach(a => { if (a.primary && anchorByLoc[a.loc] === undefined) anchorByLoc[a.loc] = a; });

    const sRoomFills = [], sHatch = [], sOffsite = [];
    areas.forEach(a => {
      if (a.hatch) { sHatch.push({ x: a.x, y: a.y, w: a.w, h: a.h }); return; }
      if (a.offsite) sOffsite.push({ x: a.x, y: a.y, w: a.w, h: a.h });
      const searched = !!secured['search:' + a.loc], found = (cluesByLoc[a.loc] || []).length > 0;
      let fill = null;
      if (a.tint) fill = a.tint; else if (found) fill = 'var(--accent-soft)'; else if (searched) fill = 'rgba(76,183,130,.10)';
      if (fill) sRoomFills.push({ x: a.x, y: a.y, w: a.w, h: a.h, fill });
    });

    const rooms = G.rooms.filter(r => !hid(r.b === gateB));
    /**
     * ⚠ `building` 은 **선택 필드**라 `r.b` 가 빌 수 있다(§rooms 매핑이 있을 때만
     * 넣는다). 검증기 `bOf()` 처럼 **첫 건물로 메운다** — 안 메우면 건물이 둘인
     * 사건에서 **서로 다른 건물의 방이 한 무리로 묶인다.**
     */
    const MAIN_B = (G.buildings[0] || {}).id;
    const bOf = r => r.b || MAIN_B;
    const roomsBy = {}; rooms.forEach(r => (roomsBy[bOf(r)] = roomsBy[bOf(r)] || []).push(r));

    /**
     * ─────────────────────────────────────────────────────────────
     *  §sPoche — 건물 외곽선. **직사각형이 아닐 수 있다** (2026-07-31 개정)
     * ─────────────────────────────────────────────────────────────
     *
     * 전에는 언제나 `b.x,b.y,b.w,b.h` **직사각형 하나**였다. 그래서 ㄱ자·중정이
     * 불가능했다 — 빈 자리의 바깥 변까지 건물인 양 그렸다.
     *
     * 방이 봉투를 **빈틈 없이 채우면 합집합이 곧 그 직사각형**이므로 **전과 똑같이**
     * 그린다(직사각형 + 안쪽 3 헤어라인). 커밋된 5건이 전부 이쪽이라 **무변화**다.
     *
     * 빈틈이 있으면 **방들의 합집합**을 외곽선으로 쓴다(`martinez`). 중정은 구멍
     * 링으로 나오므로 같은 path 의 둘째 subpath 가 된다 — `fill="none"` 이라 그대로
     * 테두리로 그려진다.
     *
     * ⚠ 안쪽 헤어라인은 그때 생략한다. 임의 직교 다각형의 **내부 오프셋**은 이
     * 자리에서 풀 문제가 아니고(불리언이지 오프셋이 아니다), 없다고 도면이 덜
     * 읽히지 않는다. 필요해지면 그때 짓는다.
     */
    const sPoche = [];
    G.buildings.filter(b => !hid(b.id === gateB)).forEach(b => {
      const rs = roomsBy[b.id] || [];
      const sum = rs.reduce((a, r) => a + r.w * r.h, 0);
      // 검증기 §9-3i ⓒ 와 같은 판정 — 겹침이 0인 상태에서 면적 합이 같으면 빈틈도 0
      if (!rs.length || Math.abs(sum - b.w * b.h) <= 1) {
        sPoche.push({ d: 'M' + b.x + ' ' + b.y + ' H' + (b.x + b.w) + ' V' + (b.y + b.h) + ' H' + b.x + ' Z', color: b.poche, width: 6 });
        sPoche.push({ d: 'M' + (b.x + 3) + ' ' + (b.y + 3) + ' H' + (b.x + b.w - 3) + ' V' + (b.y + b.h - 3) + ' H' + (b.x + 3) + ' Z', color: 'var(--border)', width: 1 });
        return;
      }
      const mp = rs.reduce((acc, r) => {
        const p = [[[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h], [r.x, r.y]]];
        return acc ? polyUnion(acc, p) : p;
      }, null);
      const d = (mp || []).map(poly => poly.map(ring => 'M' + ring.map(pt => pt[0] + ' ' + pt[1]).join(' L') + ' Z').join(' ')).join(' ');
      if (d) sPoche.push({ d: d, color: b.poche, width: 6 });
    });

    /**
     * ─────────────────────────────────────────────────────────────
     *  §sWalls — **방의 테두리를 그린다** (2026-07-31 개정)
     * ─────────────────────────────────────────────────────────────
     *
     * 전에는 **방끼리 맞닿은 변**에서만 벽이 났다. 그래서 방이 봉투를 빈틈 없이
     * 채우지 않으면 **빈 자리에 선이 하나도 안 그려져 방이 허공으로 번졌다.**
     * 그것이 중정·ㄱ자를 못 만들던 이유다.
     *
     * ★ 막고 있던 것이 이 함수였다 ★ 검증기 §9-3i ⓒ 는 빈 자리를 **오류가 아니라
     * 경고**로 뒀다 — *"오류로 걸면 저작자가 중정 있는 건물을 그리려는 순간 게이트가
     * 막는다"*. 즉 **데이터·검증기는 이미 허락하고 있었고 렌더러만 못 그렸다.**
     *
     * 이제 **방마다 네 변을 전부** 내고, **양쪽에 방이 있는 구간만** 내벽으로 그린다.
     *
     * ```
     * 같은 자리를 방 둘이 쓴다  →  내벽 (얇다 4.5)   ← 여기
     * 한 방만 쓴다             →  외벽 (두껍다 6)   ← sPoche 몫. 봉투든 중정이든
     * ```
     *
     * ★ **덮인 횟수만 세면 된다** ★ 기하 판정도, 봉투와의 대조도 필요 없다.
     * 봉투 위의 변은 저절로 1회라 빠지고(전과 같다), 중정·노치 테두리도 1회라
     * **외벽으로 넘어간다** — 안 그러면 poche 6 위에 벽 4.5 가 겹쳐 그려진다
     * (실측으로 확인하고 고쳤다. 색이 같아 안 보였을 뿐 별채처럼 `poche` 색이
     * 다르면 드러난다).
     *
     * 이 규칙 덕에 **봉투를 빈틈 없이 채우는 기존 사건은 화면이 안 바뀐다** —
     * 맞닿은 변은 언제나 2회다.
     *
     * (`rooms`·`bOf` 는 §sPoche 앞에서 이미 잡았다 — 둘이 같은 것을 쓴다.)
     */
    const edges = [];
    rooms.forEach(r => {
      const put = (o, c, a, b) => edges.push({ k: bOf(r) + '|' + o, o: o, c: c, a: a, b: b });
      put('v', r.x,       r.y, r.y + r.h);
      put('v', r.x + r.w, r.y, r.y + r.h);
      put('h', r.y,       r.x, r.x + r.w);
      put('h', r.y + r.h, r.x, r.x + r.w);
    });
    const raw = [], lanes = {};
    edges.forEach(e => (lanes[e.k] = lanes[e.k] || []).push(e));
    Object.keys(lanes).forEach(k => {
      const es = lanes[k].slice().sort((p, q) => p.c - q.c || p.a - q.a);
      for (let i = 0; i < es.length;) {
        // 같은 직선 위(좌표 차 < eps)를 한 묶음으로
        let j = i; while (j < es.length && es[j].c - es[i].c < eps) j++;
        const o = es[i].o, c = es[i].c;
        // 구간 끝점을 훑으며 덮인 횟수를 센다 — 2 이상인 동안이 내벽이다
        const ev = [];
        es.slice(i, j).forEach(e => { ev.push([e.a, 1]); ev.push([e.b, -1]); });
        ev.sort((p, q) => p[0] - q[0] || q[1] - p[1]);
        let depth = 0, from = null;
        ev.forEach(([t, d]) => {
          const was = depth; depth += d;
          if (was < 2 && depth >= 2) from = t;
          else if (was >= 2 && depth < 2) { if (t - from > eps) raw.push({ o: o, c: c, a: from, b: t }); from = null; }
        });
        i = j;
      }
    });
    const intDoors = G.doors.filter(d => !d.ext).map(d => { const o = Math.abs(d.x1 - d.x2) < eps ? 'v' : 'h'; return { o: o, c: o === 'v' ? d.x1 : d.y1, a: o === 'v' ? Math.min(d.y1, d.y2) : Math.min(d.x1, d.x2), b: o === 'v' ? Math.max(d.y1, d.y2) : Math.max(d.x1, d.x2) }; });
    const sWalls = [];
    raw.forEach(s => {
      let parts = [[s.a, s.b]];
      intDoors.forEach(dr => { if (dr.o === s.o && Math.abs(dr.c - s.c) < eps) { const np = []; parts.forEach(p => { const a = p[0], b = p[1]; if (dr.b <= a + eps || dr.a >= b - eps) { np.push([a, b]); } else { if (a < dr.a - eps) np.push([a, dr.a]); if (dr.b < b - eps) np.push([dr.b, b]); } }); parts = np; } });
      parts.forEach(p => { if (p[1] - p[0] > eps) sWalls.push(s.o === 'v' ? { x1: s.c, y1: p[0], x2: s.c, y2: p[1] } : { x1: p[0], y1: s.c, x2: p[1], y2: s.c }); });
    });

    const sDoorErase = [], sDoorLeaf = [], sDoorArc = [], doorLabels = [];
    G.doors.filter(d => !hid(d.building === gateB)).forEach(d => {
      if (d.open) return;
      const p1 = { x: d.x1, y: d.y1 }, p2 = { x: d.x2, y: d.y2 };
      const hinge = d.hinge === 'p1' ? p1 : p2, free = d.hinge === 'p1' ? p2 : p1;
      const dvx = free.x - hinge.x, dvy = free.y - hinge.y, R = Math.hypot(dvx, dvy);
      const open = { x: hinge.x + d.swing * (-dvy), y: hinge.y + d.swing * (dvx) };
      const aF = Math.atan2(free.y - hinge.y, free.x - hinge.x), aO = Math.atan2(open.y - hinge.y, open.x - hinge.x);
      let dd = aO - aF; while (dd <= -Math.PI) dd += 2 * Math.PI; while (dd > Math.PI) dd -= 2 * Math.PI;
      const sweep = dd > 0 ? 1 : 0;
      if (d.ext) sDoorErase.push({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 });
      sDoorLeaf.push({ x1: hinge.x, y1: hinge.y, x2: free.x, y2: free.y });
      sDoorArc.push({ d: 'M' + free.x + ' ' + free.y + ' A' + R + ' ' + R + ' 0 0 ' + sweep + ' ' + open.x + ' ' + open.y });
      if (d.ko) doorLabels.push({ left: px(d.lx), top: py(d.ly), label: ln === 'ko' ? d.ko : d.en });
    });

    const sWin = [], winLabels = [];
    G.windows.filter(w => !hid(w.building === gateB)).forEach(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      [-3, 0, 3].forEach(o => sWin.push({ x1: w.x1 + nx * o, y1: w.y1 + ny * o, x2: w.x2 + nx * o, y2: w.y2 + ny * o }));
      if (w.ko) winLabels.push({ left: px(w.lx), top: py(w.ly), label: ln === 'ko' ? w.ko : w.en });
    });

    const sWalk = G.walks.filter(w => !hid(w.b === gateB)).map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, mx: px((w.x1 + w.x2) / 2), my: py((w.y1 + w.y2) / 2), label: w.min + (ln === 'ko' ? '분' : ' min') }));

    const locs = areas.map(a => {
      const st = this.invStatusFor('search', [a.loc]);
      const searched = !!secured['search:' + a.loc], found = (cluesByLoc[a.loc] || []).length > 0, searchable = st === 'ok';
      const col = found ? 'var(--accent)' : searched ? 'var(--g-confirm)' : a.scene ? 'var(--g-contradict)' : 'var(--fg-3)';
      const gatedNew = !!gateLoc[a.loc] && annexOn;
      return {
        id: a.id, primary: !!a.primary, name: ln === 'ko' ? a.ko : a.en,
        nameColor: a.scene ? 'var(--g-contradict)' : a.offsite ? 'var(--fg-4)' : 'var(--fg-2)',
        onSearch: searchable ? (() => this.askInvestigate('search', [a.loc])) : (() => {}),
        isNew: !!gatedNew, revealNote: gatedNew ? (ln === 'ko' ? '1장 완성으로 공개' : 'Revealed · sec 1') : '',
        statusLabel: found ? (ln === 'ko' ? '물증' : 'Found') : searched ? (ln === 'ko' ? '빈손' : 'Empty') : (ln === 'ko' ? '미조사' : 'Unsearched'),
        statusStyle: { fontSize: '9px', fontWeight: 700, color: col, background: 'var(--bg-app)', border: '1px solid ' + col, borderRadius: 'var(--r-pill)', padding: '0 5px' },
        clues: cluesByLoc[a.loc] || [], hasClues: (cluesByLoc[a.loc] || []).length > 0,
        boxStyle: { position: 'absolute', left: px(a.x) + '%', top: py(a.y) + '%', width: px(a.w) + '%', height: py(a.h) + '%', boxSizing: 'border-box', padding: '8px 10px', display: 'flex', flexDirection: 'column', cursor: searchable ? 'pointer' : 'default', zIndex: 2 },
      };
    });

    const revealedLocs = {}; areas.forEach(a => revealedLocs[a.loc] = true);
    const fixtures = this.FIXTURES.filter(f => revealedLocs[f.loc]).map(f => {
      const pos = G.fixtures[f.id] || { x: 500, y: 312 };
      const actId = f.body ? 'autopsy' : 'fixture';
      const st = this.invStatusFor(actId, f.body ? [] : [f.id]);
      const done = st === 'used', okc = st === 'ok';
      const col = f.body ? 'var(--g-contradict)' : done ? 'var(--g-confirm)' : okc ? 'var(--accent)' : 'var(--fg-4)';
      return { id: f.id, name: ln === 'ko' ? f.ko : f.en, body: !!f.body, done, iconPath: f.body ? '' : this.termIconPath(f.icon),
        onRun: okc ? (() => this.askInvestigate(actId, f.body ? [] : [f.id])) : (() => {}),
        markStyle: { position: 'absolute', left: px(pos.x) + '%', top: py(pos.y) + '%', transform: 'translate(-50%,-50%)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: col, cursor: okc ? 'pointer' : 'default', background: 'transparent', border: 'none', zIndex: 3 },
        labelStyle: { position: 'absolute', left: px(pos.x) + '%', top: 'calc(' + py(pos.y) + '% + 9px)', transform: 'translate(-50%,0)', fontSize: '9px', color: col, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 3 } };
    });

    const idxInLoc = {};
    const personMarkers = this.PEOPLE.map(p => {
      const lid = (this.CLAIM_LOC[p.id] || {})[tsel]; const a = lid ? anchorByLoc[lid] : null;
      const shown = !!a;
      let cx = VW / 2, cy = VH / 2;
      if (shown) { const n = (idxInLoc[lid] = (idxInLoc[lid] || 0) + 1) - 1; const col = n % 3, row = Math.floor(n / 3); cx = a.x + a.w / 2 + (col - 1) * a.w * 0.18; cy = a.y + a.h * 0.6 + row * a.h * 0.12; }
      return { id: p.id, name: p.name, shown,
        style: { position: 'absolute', left: px(cx) + '%', top: py(cy) + '%', transform: 'translate(-50%,-50%)', width: '15px', height: '15px', borderRadius: '50%', background: p.color, border: '2px solid var(--bg-app)', boxShadow: '0 1px 3px rgba(0,0,0,.4)', opacity: shown ? 1 : 0, transition: 'left .45s var(--ease), top .45s var(--ease), opacity .3s', zIndex: 4, pointerEvents: 'none' },
        labelStyle: { position: 'absolute', left: px(cx) + '%', top: 'calc(' + py(cy) + '% + 11px)', transform: 'translate(-50%,0)', fontSize: '9px', fontWeight: 600, color: p.color, whiteSpace: 'nowrap', opacity: shown ? 1 : 0, transition: 'left .45s var(--ease), top .45s var(--ease), opacity .3s', zIndex: 4, pointerEvents: 'none' } };
    });

    const times = this.TIMES.map(tm => ({ id: tm.id, label: ln === 'ko' ? tm.ko : tm.en, active: tm.id === tsel, onClick: () => this.setState({ mapTime: tm.id }),
      style: { flex: 1, textAlign: 'center', padding: '7px 4px', fontSize: '12px', fontWeight: tm.id === tsel ? 600 : 500, color: tm.id === tsel ? 'var(--fg)' : 'var(--fg-3)', background: tm.id === tsel ? 'var(--bg-active)' : 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer' } }));
    const dotLegend = this.PEOPLE.map(p => ({ name: p.name, color: p.color }));
    const hasAnyClue = Object.keys(cluesByLoc).length > 0;
    const scrubHint = ln === 'ko' ? '시간대를 넘기면 각 인물이 ‘주장한’ 위치로 이동합니다. 지도는 판정하지 않습니다.' : 'Scrub time to move each person to their claimed position. The map does not judge.';
    const fixLoc = {}; this.FIXTURES.forEach(f => { fixLoc[f.id] = f.loc; });
    const locNameById = {}; this.LOCATIONS.forEach(l => locNameById[l.id] = ln === 'ko' ? l.ko : l.en);
    const narrations = (this.state.invLog || []).filter(e => e.desc && (e.action === 'search' || e.action === 'fixture' || e.action === 'autopsy')).map(e => {
      let lid = e.action === 'search' ? e.key : e.action === 'autopsy' ? 'room' : fixLoc[e.key];
      return { locName: locNameById[lid] || '', title: e.title, desc: e.desc, empty: e.type === 'empty',
        barColor: e.type === 'empty' ? 'var(--fg-4)' : e.type === 'solution' ? 'var(--g-confirm)' : e.type === 'redherring' ? 'var(--status-progress)' : 'var(--accent)' };
    });
    const scb = G.scale, scale = { x: scb.x, x2: scb.x + scb.len, y: scb.y, yt1: scb.y - 4, yt2: scb.y + 4 };
    const scaleLabel = { left: px(scb.x), top: py(scb.y + 18) };

    return { locs, sRoomFills, sHatch, sOffsite, sPoche, sWalls, sDoorErase, sDoorLeaf, sDoorArc, sWin, sWalk, doorLabels, winLabels, fixtures, personMarkers, times, dotLegend, scrubHint, hasClueMarks: hasAnyClue, clueLegend: ln === 'ko' ? '확보 물증' : 'Evidence', scale, scaleLabel, scaleText: '0 ─ ' + (G.scale.label || '5m'), narrations, hasNarr: narrations.length > 0, narrTitle: ln === 'ko' ? '현장 조사 기록' : 'Scene findings' };
  }
  FLOOR_CLUES = [
    { logKey: 'search:annex', loc: 'annex', ko: '대포폰', en: 'Burner' },
    { logKey: 'belongings:sakura', loc: 'annex', ko: '위장 유서', en: 'Fake note' },
    { logKey: 'autopsy:body', loc: 'room', ko: '일산화탄소', en: 'CO' },
  ];
  buildListBlank(bid) {
    const t = this.T(), def = this.BLANKS[bid], val = this.state.blanks[bid];
    const candType = def.src === 'collected' ? t.srcCollected : t.srcClosed;
    const base = { label: t[def.kind], candType };
    const b = this.buildBlank(bid), filled = val != null, disp = filled ? (val + this.particle(val, def.par)) : '';
    return Object.assign(base, { open: true, filled, triggerText: filled ? disp : t.listFill,
      triggerStyle: { cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: filled ? 'var(--g-fill-fg)' : 'var(--fg-4)', background: filled ? 'var(--g-fill-bg)' : 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: '3px 12px', minWidth: '84px', textAlign: 'center' },
      onOpen: b.onOpen, pickerOpen: b.pickerOpen, options: b.options, optionsEmpty: b.optionsEmpty, pickHead: b.pickHead, canClear: b.canClear, onClear: b.onClear });
  }
  buildBank() {
    const rev = this.revealedTerms();
    const words = this.COLLECTED_POOL.filter(w => rev[w]);
    const used = w => Object.values(this.state.blanks).indexOf(w) >= 0;
    return {
      showEmpty: words.length === 0,
      words: words.map(w => ({ label: w, iconPath: this.termIconPath(w), onOpen: () => this.openTerm(w), style: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', height: '26px', padding: '0 11px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
        border: '1px solid var(--border-strong)', fontSize: '12px', fontWeight: 500,
        background: used(w) ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        color: used(w) ? 'var(--accent)' : 'var(--fg-2)',
      } })),
    };
  }

  buildGrid() {
    const t = this.T(), ln = this.state.lang, sort = false, marks = this.state.cellMarks || {};
    const markColor = { confirm: 'var(--g-confirm)', suspect: 'var(--g-suspect)', contradict: 'var(--g-contradict)' };
    const markGlyph = { confirm: '\u2713', suspect: '?', contradict: '\u2260' };
    const narrowed = this.deathNarrowed();
    const tsel = this.state.mapTime;
    const revClaims = this.revealedClaims();
    /**
     * ★ 축소는 「이름 갈아끼우기」가 아니라 「칸을 사망 구간에서 빼는 것」이다 ★
     *
     * 전에는 `tm.window && narrowed` 로 **창 칸 전부**를 좁힌 이름으로 덮었다.
     * **산장은 창 슬롯이 `t2` 하나뿐이라 우연히 맞았다** — `deathCells` 가 2~3이면
     * 창이 여럿이라 **세 열이 전부 같은 이름**이 된다.
     *
     * `narrowsWindow` 는 `[from, to]` **범위**다(산장 `[t1, t2]`). 슬롯 순서로 잘라
     * 남는 창 칸을 구한다. 범위 밖 창 칸은 **사망 구간에서 빠진다** — 그게 부검이
     * 사는 값이다.
     *
     *   남은 칸 1개  → 그 칸이 좁혀진 이름을 갖는다   (산장 「새벽 3~5시」 · 불변)
     *   남은 칸 2개+ → 각자 제 이름을 지킨다          (같은 글자 중복을 안 만든다)
     */
    const inNarrow = (() => {
      if (!narrowed) return null;
      const ids = this._narrowSlots || [];
      const order = this.TIMES.map(x => x.id);
      const a = order.indexOf(ids[0]), b = order.indexOf(ids[ids.length - 1]);
      if (a < 0 || b < 0) return null;
      const set = new Set(this.TIMES.slice(Math.min(a, b), Math.max(a, b) + 1).filter(x => x.window).map(x => x.id));
      return set.size ? set : null;
    })();
    const stillWindow = (tm) => !!tm.window && (!inNarrow || inNarrow.has(tm.id));
    const soleWindow = !!inNarrow && inNarrow.size === 1;
    /** 좁혀지기 **전**의 구간 이름 — 산장은 저작된 문안, 그 밖은 창 칸 양 끝에서 도출 */
    const prevWin = (() => {
      const ws = this.TIMES.filter(x => x.window);
      if (!ws.length) return '';
      const f = ln === 'ko' ? ws[0].ko : ws[0].en, l = ln === 'ko' ? ws[ws.length - 1].ko : ws[ws.length - 1].en;
      return f === l ? f : `${f} ~ ${l}`;
    })();
    const winSub = () => this._foreignCase
      ? (ln === 'ko' ? `사망 추정 · 이전 ${prevWin}` : `death · was ${prevWin}`)
      : (ln === 'ko' ? '사망 추정 · 이전 3~8시' : 'death · was 03–08');
    const times = this.TIMES.map(tm => { const active = tm.id === tsel; return ({
      label: (stillWindow(tm) && narrowed && soleWindow) ? this.narrowedLabel(ln) : (ln === 'ko' ? tm.ko : tm.en),
      sub: !narrowed ? (ln === 'ko' ? tm.subKo : tm.subEn)
        : stillWindow(tm) ? winSub()
        : tm.window ? ''
        : (ln === 'ko' ? tm.subKo : tm.subEn),
      narrowed: stillWindow(tm) && narrowed,
      onClick: () => this.setState({ mapTime: tm.id }),
      labelStyle: { color: 'var(--fg-2)', fontWeight: 600 },
      // 빠진 칸은 강조도 같이 빠진다 — 산장은 창이 하나뿐이라 `stillWindow` = `tm.window`
      headStyle: { flex: 1, minWidth: '130px', padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--border)', background: stillWindow(tm) ? 'rgba(255,255,255,.02)' : 'transparent' },
    }); });
    const rows = this.PEOPLE.map(p => {
      const cells = this.TIMES.map((tm, ti) => {
        const pickerRight = ti >= this.TIMES.length - 2;
        const key = p.id + '-' + tm.id;
        const rc = (revClaims[p.id] || {})[tm.id];
        const claim = rc || (this.CLAIMS[p.id] || {})[tm.id];
        const has = !!claim;
        const isNew = rc ? rc.isNew : false;
        const mk = marks[key] || null;
        const autoShow = false;
        const base = { position: 'relative', flex: 1, minWidth: '130px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--border)', minHeight: '46px', cursor: has ? 'pointer' : 'default' };
        if (tm.window) base.background = sort ? 'rgba(76,141,255,.06)' : 'var(--bg-subtle)';
        if (mk) { base.background = mk === 'confirm' ? 'rgba(76,183,130,.16)' : mk === 'suspect' ? 'rgba(242,201,76,.16)' : 'rgba(235,87,87,.16)'; }
        const stackStyle = Object.assign({}, base, { flex: 1, minWidth: 0, borderLeft: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', minHeight: '36px' });
        return {
          key, hasClaim: has, empty: !has, isNew,
          label: has ? (ln === 'ko' ? claim.ko : claim.en) : '',
          timeLabel: ln === 'ko' ? tm.ko : tm.en,
          style: base, stackStyle,
          marked: !!mk, markDotStyle: { width: '8px', height: '8px', borderRadius: '50%', flex: 'none', marginLeft: 'auto', background: mk ? markColor[mk] : 'transparent' },
          labelStyle: { fontSize: '12.5px', color: 'var(--fg-2)', fontWeight: 500 },
          autoShow,
          onClick: has ? (() => this.markCell(key)) : (() => {}),
          pickerOpen: this.state.openCell === key,
          pickerStyle: Object.assign({ position: 'absolute', top: 'calc(100% - 2px)', zIndex: 41, display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-popover)', padding: '4px' }, pickerRight ? { right: '8px' } : { left: '8px' }),
          opts: [
            { label: t.markConfirm, dot: this.chipDot('var(--g-confirm)'), chipStyle: this.chipBtn(), onPick: () => this.setMark(key, 'confirm') },
            { label: t.markSuspect, dot: this.chipDot('var(--g-suspect)'), chipStyle: this.chipBtn(), onPick: () => this.setMark(key, 'suspect') },
            { label: t.markContradict, dot: this.chipDot('var(--g-contradict)'), chipStyle: this.chipBtn(), onPick: () => this.setMark(key, 'contradict') },
            { label: t.markClear, dot: this.chipDot('transparent'), chipStyle: this.chipBtn(true), onPick: () => this.setMark(key, null) },
          ],
        };
      });
      return { p: { name: p.name, ini: p.ini, color: p.color, meta: (ln === 'ko' ? (p.age + '세') : (p.age)) + (this.roleOrJob(p) ? ' · ' + this.roleOrJob(p) : ''), avStyle: this.avStyle(p, 24) }, cells };
    });
    return { times, rows };
  }
  dot(c) { return { width: '9px', height: '9px', borderRadius: '3px', background: c, flex: 'none' }; }
  chipDot(c) { return { width: '13px', height: '13px', borderRadius: '4px', background: c, flex: 'none', border: c === 'transparent' ? '1.5px solid var(--fg-4)' : 'none' }; }
  chipBtn(clear) { return { display: 'inline-flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', cursor: 'pointer' }; }

  splitSentences(text) { const p = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean); return p.length ? p : [text]; }
  toggleExpand(pid) { const e = Object.assign({}, this.state.expanded); e[pid] = !e[pid]; this.setState({ expanded: e, sel: null }); }
  onStmtSelect(pid, pi, ev) {
    const el = ev.currentTarget;
    setTimeout(() => this._readSel(pid, pi, el), 0);
  }
  _readSel(pid, pi, el) {
    const s = window.getSelection && window.getSelection();
    if (!s || s.isCollapsed || !String(s).trim()) { if (this.state.sel) this.setState({ sel: null }); return; }
    if (!el || !el.isConnected) return;
    if (!el.contains(s.anchorNode) || !el.contains(s.focusNode)) return;
    const off = (node, o) => { const r = document.createRange(); r.selectNodeContents(el); r.setEnd(node, o); return r.toString().length; };
    let a = off(s.anchorNode, s.anchorOffset), b = off(s.focusNode, s.focusOffset);
    const start = Math.min(a, b), end = Math.max(a, b);
    if (end <= start) { if (this.state.sel) this.setState({ sel: null }); return; }
    let rect, pr = el.getBoundingClientRect();
    try { rect = s.getRangeAt(0).getBoundingClientRect(); } catch (e) { rect = pr; }
    this.setState({ sel: { pid, pi, start, end, text: String(s), left: rect.left - pr.left + rect.width / 2, top: rect.top - pr.top } });
  }
  applyHl(mark) {
    const sel = this.state.sel; if (!sel) return;
    let hls = (this.state.hls || []).filter(h => !(h.pid === sel.pid && h.pi === sel.pi && h.start < sel.end && h.end > sel.start));
    if (mark) hls = hls.concat([{ pid: sel.pid, pi: sel.pi, start: sel.start, end: sel.end, mark }]);
    this.setState({ hls, sel: null });
    try { window.getSelection().removeAllRanges(); } catch (e) {}
  }
  quotePinIds() { const p = this.state.quotePins || {}; return (this.state.memos || []).filter(m => p[m.id]).map(m => m.id); }
  routeQuote(payload) { const pins = this.quotePinIds(); if (pins.length >= 2) { this.setState({ quotePicker: payload, sel: null, openTerm: null }); try { window.getSelection().removeAllRanges(); } catch (e) {} return; } if (pins.length === 1) { this.appendQuote(pins[0], payload); return; } this.newMemoFromQuote(payload); }
  appendQuote(memoId, payload) { const t = this.T(); const memos = (this.state.memos || []).map(m => m.id === memoId ? Object.assign({}, m, { content: (m.content ? m.content + '\n\n' : '') + payload.line }) : m); clearTimeout(this._toastT); this._toastT = setTimeout(() => this.setState({ toast: null }), 2600); this.setState({ memos, sel: null, openTerm: null, quotePicker: null, toast: t.quoteAdded }); try { window.getSelection().removeAllRanges(); } catch (e) {} }
  newMemoFromQuote(payload) { const id = 'm' + Date.now(); const memos = (this.state.memos || []).concat([Object.assign({ id, quote: payload.quote, quotePid: payload.pid, content: '', targetType: payload.targetType, targetId: payload.targetId, layer: payload.layer }, this.memoMeta())]); this.setState({ memos, sel: null, openTerm: null, quotePicker: null, view: 'memo', memoFilter: 'all', editMemoId: id }); try { window.getSelection().removeAllRanges(); } catch (e) {} }
  quoteSelToMemo() { const sel = this.state.sel; if (!sel) return; const who = sel.pid ? ((this.PEOPLE.find(x => x.id === sel.pid) || {}).name || '') : ''; const line = '\u201c' + sel.text + '\u201d' + (who ? ' \u2014 ' + who : ''); this.routeQuote({ line, quote: sel.text, pid: sel.pid, targetType: 'statement', targetId: sel.pid, layer: 'claim' }); }
  quoteTermToMemo(w) { const ln = this.state.lang, info = this.TERM_INFO[w] || {}; const quote = (ln === 'ko' ? info.dk : info.de) || w; this.routeQuote({ line: '\u201c' + quote + '\u201d', quote: quote, pid: null, targetType: 'evidence', targetId: w, layer: 'fact' }); }
  setMemoQuery(v) { this.setState({ memoQuery: v }); }
  copySel() { const sel = this.state.sel; if (!sel) return; try { navigator.clipboard.writeText(sel.text); } catch (e) {} this.setState({ sel: null }); }
  segsFor(pid, pi, text) {
    const mbg = { flag: 'rgba(76,141,255,.30)', confirm: 'rgba(76,183,130,.30)', suspect: 'rgba(242,201,76,.32)', contradict: 'rgba(235,87,87,.30)' };
    const mc = { flag: 'var(--accent)', confirm: 'var(--g-confirm)', suspect: 'var(--g-suspect)', contradict: 'var(--g-contradict)' };
    const marks = (this.state.hls || []).filter(h => h.pid === pid && h.pi === pi).sort((a, b) => a.start - b.start);
    if (!marks.length) return [{ text, style: {} }];
    const out = []; let cur = 0;
    marks.forEach(m => { const s = Math.max(cur, m.start); if (s > cur) out.push({ text: text.slice(cur, s), style: {} }); if (m.end > s) out.push({ text: text.slice(s, m.end), style: { background: mbg[m.mark], boxShadow: 'inset 0 -2px 0 ' + mc[m.mark], borderRadius: '2px', padding: '0.5px 0' } }); cur = Math.max(cur, m.end); });
    if (cur < text.length) out.push({ text: text.slice(cur), style: {} });
    return out;
  }
  /**
   * 「성별 · 나이」. **성별이 없으면 구분자도 없앤다.** (2026-07-29 밤)
   *
   * 생성 인물은 `sexKo` 가 빈다 — 엔진이 `sex` 를 안 내고, `applyCase:551` 이
   * **같은 인물일 때만** 앱 값을 물려준다(`relKo` 와 같은 규칙). 그래서 세 자리에서
   * **「· 31 · 도예가」**처럼 앞에 점이 남았다.
   *
   * ⚠ **엔진이 `sex` 를 내게 하지 않는다** — 팔레트는 이름만 주므로 성별을 만들려면
   * **이름에서 도출**해야 하고 그건 없는 사실을 만드는 것이다(그리고 틀린다).
   * 비는 쪽이 맞고, 비었을 때 안 그리는 것이 이쪽 일이다.
   *
   * 세 자리(용의자 카드 · 상황판 카드 · 진술 행)가 같은 꼴을 쓰고 있었으므로
   * 하나로 모았다 — 셋 중 하나만 고치면 다음에 또 물린다.
   */
  sexAgeOf(p) {
    const s = this.state.lang === 'ko' ? p.sexKo : p.sexEn;
    return (s ? s + ' · ' : '') + p.age;
  }
  /**
   * 관계 칩 3종.
   *
   * **`S()` 로 감싼다** — DC 변환이 여기 하나를 빠뜨려서 CSS **문자열**이
   * `style={st.relStyle}` 로 그대로 들어갔고, React 가
   * *"The `style` prop expects a mapping … not a string"* 로 던지면서
   * **진술 화면을 열면 앱이 통째로 언마운트됐다.** 콘솔에는 `<span>` 에서
   * 에러가 났다는 경고만 찍혀서 빈 화면 말고는 단서가 없다.
   */
  relChip(kind) {
    const base = 'display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;border-radius:var(--r-pill);padding:5px 12px;flex:none;white-space:nowrap;';
    if (kind === 'onsite') return S(base + 'color:#F2994A;background:rgba(242,153,74,.16);border:1px solid rgba(242,153,74,.4)');
    if (kind === 'absent') return S(base + 'color:var(--fg-3);background:transparent;border:1px dashed var(--border-strong)');
    return S(base + 'color:var(--fg-2);background:transparent;border:1px solid var(--border-strong)');
  }
  buildStatements() {
    const t = this.T(), sel = this.state.sel, ln = this.state.lang;
    return this.PEOPLE.map(p => {
      const expanded = !!this.state.expanded[p.id];
      const firstSent = this.splitSentences(this.STMT[p.id][0])[0] || '';
      return {
        pid: p.id, name: p.name, ini: p.ini, avStyle: this.avStyle(p, 34), color: p.color,
        /**
         * ★ 값이 없으면 칩을 그리지 않는다 ★ (2026-07-29 밤)
         *
         * 「관계」는 산장 인물의 앱 전용 필드다(`아침 도착`·`산장 거주`·`불참`).
         * 엔진에 대응 필드가 없어서 `applyCase:554` 가 **생성 인물에게는 의도적으로
         * 비운다** — 안 비우면 온천 여관 사람에게 「산장 거주」가 붙는다. **그 판단은
         * 옳다.** 그런데 **안 그리게는 안 해서** 테두리만 남은 빈 알약이 떴다
         * (첫 실플레이에서 사용자가 찾았다).
         *
         * **지우는 것과 안 그리는 것은 다른 일이었다.** 마크업을 안 건드리고
         * 스타일로 끈다 — `relStyle` 이 이미 VM 에서 오므로 갈래가 안 늘고
         * `port-check` 도 그대로다.
         */
        relStyle: p.relKo
          ? this.relChip(p.relKo === '산장 거주' ? 'onsite' : (p.relKo.indexOf('불참') >= 0 ? 'absent' : 'arrive'))
          : S('display:none'),
        railLine: { width: '2px', alignSelf: 'stretch', background: p.color, borderRadius: '1px', flex: 'none' },
        sexAge: this.sexAgeOf(p),
        job: ln === 'ko' ? p.jobKo : p.jobEn,
        relation: ln === 'ko' ? p.relKo : p.relEn,
        meta: (ln === 'ko' ? (p.age + '세') : ('' + p.age)) + (this.roleOrJob(p) ? ' · ' + this.roleOrJob(p) : ''),
        expanded, collapsed: !expanded, onToggle: () => this.toggleExpand(p.id), chevronRot: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        railNameColor: expanded ? p.color : 'var(--fg)',
        railRowStyle: { display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: expanded ? 'var(--bg-active)' : 'transparent' },
        preview: firstSent.length > 42 ? firstSent.slice(0, 42) + '…' : firstSent,
        paras: this.STMT[p.id].map((par, pi) => ({
          pi, segs: this.segsFor(p.id, pi, par),
          onSelect: (ev) => this.onStmtSelect(p.id, pi, ev),
          showTb: !!sel && sel.pid === p.id && sel.pi === pi,
          tbStyle: sel ? { position: 'absolute', left: sel.left + 'px', top: sel.top + 'px', transform: 'translate(-50%,-100%)', marginTop: '-6px', zIndex: 41 } : {},
        })),
        added: this.addedStatements(p.id),
      };
    });
  }
  quoteBriefToMemo(text) { const t = this.T(); const id = 'm' + Date.now(); const memos = (this.state.memos || []).concat([Object.assign({ id, quote: text, quotePid: null, content: '', targetType: 'none', targetId: null, layer: 'fact' }, this.memoMeta())]); clearTimeout(this._toastT); this._toastT = setTimeout(() => this.setState({ toast: null }), 2600); this.setState({ memos, view: 'memo', memoFilter: 'all', editMemoId: id, toast: t.quoteAdded }); }
  memoMeta() { const d = new Date(); const hh = d.getHours(), mm = ('0' + d.getMinutes()).slice(-2); const ap = hh < 12 ? '오전' : '오후'; const h12 = ((hh + 11) % 12) + 1; const timeKo = ap + ' ' + h12 + ':' + mm; const timeEn = h12 + ':' + mm + (hh < 12 ? ' AM' : ' PM'); const t = this.T(); const v = this.state.view; const ctxMap = { narrative: t.nTitle, statements: t.sTitle, investigate: t.navInvestigate, profile: t.navProfile, overview: t.navOverview, map: t.navMap, memo: t.memoTitle, reference: t.navReference }; let ctx = ctxMap[v] || ''; if (v === 'map') { const tm = this.TIMES.find(x => x.id === this.state.mapTime); if (tm) ctx += ' · ' + (this.state.lang === 'ko' ? tm.ko : tm.en); } return { createdAt: Date.now(), ymd: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), mon: d.getMonth() + 1, day: d.getDate(), timeKo, timeEn, ctx }; }
  memoWhen(m) { if (!m.timeKo && !m.ctx) return ''; const time = this.state.lang === 'ko' ? m.timeKo : m.timeEn; if (!time) return ''; const now = new Date(); const today = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate(); if (m.ymd && m.ymd !== today && m.mon) { const date = this.state.lang === 'ko' ? (m.mon + '월 ' + m.day + '일') : (m.mon + '/' + m.day); return date + ' · ' + time; } return time; }
  newMemo() { const id = 'm' + Date.now(); this.setState({ memos: (this.state.memos || []).concat([Object.assign({ id, quote: '', quotePid: null, content: '', targetType: 'none', targetId: null }, this.memoMeta())]), memoFilter: 'all', editMemoId: id }); }
  editMemo(id) { this.setState({ editMemoId: id }); }
  lockMemo(id) { this.setState({ editMemoId: null }); }
  setMemoContent(id, v) { this.setState({ memos: (this.state.memos || []).map(m => m.id === id ? Object.assign({}, m, { content: v }) : m) }); }
  setMemoTarget(id, type, tid) { this.setState({ memos: (this.state.memos || []).map(m => m.id === id ? Object.assign({}, m, { targetType: type, targetId: tid || null }) : m) }); }
  delMemo(id) { const pp = Object.assign({}, this.state.quotePins || {}); delete pp[id]; this.setState({ memos: (this.state.memos || []).filter(m => m.id !== id), quotePins: pp }); }
  setMemoSort(v) { this.setState({ memoSort: v }); }
  setMemoFilter(f) { this.setState({ memoFilter: f }); }
  toggleLeft() { this.setState({ leftOpen: !this.state.leftOpen }); }
  toggleRight() { this.setState({ rightOpen: !this.state.rightOpen }); }
  setRightView(v) { this.setState({ rightOpen: true, rightView: v }); }
  toggleFocus() { const f = !this.state.focusMode; this.setState({ focusMode: f, leftOpen: !f }); }

  /**
   * ─────────────────────────────────────────────────────────────
   *  평면도 탭-확대 (2026-08-05) — **좁은 화면 전용**
   * ─────────────────────────────────────────────────────────────
   *
   * ★ 왜 있나 ★ 첫 테스터 데이터 셋 중 하나가 *"평면도가 모바일에서 뭉개진다"*
   * 였다 (`docs/PLAYTEST.md`). 375px 에서 도면 폭이 ~343px 이라 방 이름·문
   * 라벨·인물 마커가 서로 겹친다.
   *
   * ★ 뭉개짐의 정체는 **해상도가 아니라 밀도**다 ★ 도면은 SVG(`viewBox 0 0
   * 1000 625`) + 퍼센트 좌표의 HTML 라벨이라 **래스터가 한 장도 없다.** 그래서
   * 확대하면 선도 글자도 그대로 또렷하다 — CSS 로 고칠 수 있는 부류다.
   * (원본 해상도 문제였다면 CSS 범위 밖이라 여기서 멈췄어야 한다.)
   *
   * ⛳ **`isNarrow` 를 그대로 쓴다** — `w < 820` 판정이 이미 여덟 곳의 단일
   * 출처다. 여기에 `isMobile`·`userAgent` 를 새로 만들면 **같은 판정이 두 벌**이
   * 되고, 두 벌은 반드시 갈라진다 (`styles.css` §읽는 화면의 자 의 그 규칙).
   *
   * ⛔ **외부 라이브러리를 안 쓴다.** 배율·이동은 `transform` 한 줄이고,
   * 제스처는 포인터 이벤트 셋이 전부다.
   */
  PLAN_ZOOM_MIN = 1;
  PLAN_ZOOM_MAX = 4;

  /**
   * ⚠ **1배로 열면 목적을 못 채운다 — 재서 알았다.** 375px 화면에서 미리보기가
   * 327px, 전체화면이 375px 라 **고작 +15%** 다. 도면은 16:10 가로인데 폰은
   * 세로라 폭에 갇히고, 무대 높이 711px 중 234px 만 쓴다.
   *
   * 그래서 **높이를 채우는 배율로 열고**(375×812 에서 ~2.9배) 거기서 손가락으로
   * 조절하게 한다. 오므리면 `PLAN_ZOOM_MIN` 이 1 이라 **전체 도면으로 언제든
   * 돌아온다** — 잃는 것이 없다.
   *
   * ⛳ **비율을 JS 에 다시 적지 않는다.** `aspect-ratio:16/10` 은 도면 마크업에
   * 있고, 여기서 1.6 을 또 쓰면 **한 값이 두 곳**이 된다(이 저장소가 하루에
   * 여섯 번 밟은 부류). 그래서 배율 1 로 먼저 그린 뒤 **실측**한다.
   */
  openPlanZoom() {
    this._ptrs = new Map();
    this.setState({ planZoom: { s: 1, x: 0, y: 0 } }, () => {
      const st = this._planStage, fig = this._planFig;
      if (!st || !fig) return;
      const ph = fig.getBoundingClientRect().height;
      if (!ph) return;
      const s = Math.max(this.PLAN_ZOOM_MIN, Math.min(this.PLAN_ZOOM_MAX, (st.clientHeight * 0.95) / ph));
      if (s > 1.01) this.setState({ planZoom: this.planClamp({ s, x: 0, y: 0 }) });
    });
  }
  closePlanZoom() { this._ptrs = null; this.setState({ planZoom: null }); }

  /** 지금 화면에 닿아 있는 손가락들의 중심과 벌어진 거리. 하나면 거리는 0(=이동만) */
  planGesture() {
    const ps = [...(this._ptrs || new Map()).values()];
    if (!ps.length) return null;
    const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length;
    const cy = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    return { cx, cy, d: ps.length >= 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0, n: ps.length };
  }
  /** 손가락이 늘거나 줄면 기준을 다시 잡는다 — 안 하면 그 순간 도면이 튄다 */
  planRebase(g) { this._planStart = g; this._planBase = Object.assign({ s: 1, x: 0, y: 0 }, this.state.planZoom); }

  /**
   * 배율은 1~4 로, 이동은 **도면이 무대 밖으로 넘친 만큼**으로 가둔다.
   * 안 가두면 도면을 화면 밖으로 밀어버리고 돌아올 길이 없다.
   *
   * ⚠ **무대 크기로 재면 안 된다 — 눌러보고 알았다.** 도면은 16:10 가로라
   * 세로 화면에서 폭에 갇힌다(375 무대에 375×234). 무대 기준으로 세면 세로 여백을
   * `(711×2.88−711)/2 = 668px` 로 **없는 여백을 만들어내서** 도면이 화면 밖으로
   * 사라진다. 실제로 넘치는 것은 **도면**이므로 도면을 잰다.
   *
   * `offsetWidth/Height` 는 **transform 을 안 탄** 배치 크기다 — 여기에 배율을
   * 곱해야 지금 화면에 뜬 크기가 된다. `getBoundingClientRect` 를 쓰면 이미
   * 확대된 값이 다시 곱해져 두 배로 어긋난다.
   */
  planClamp(z) {
    const s = Math.max(this.PLAN_ZOOM_MIN, Math.min(this.PLAN_ZOOM_MAX, z.s));
    const el = this._planStage, fig = this._planFig;
    const sw = (el && el.clientWidth) || 0, sh = (el && el.clientHeight) || 0;
    const pw = (fig && fig.offsetWidth) || sw, ph = (fig && fig.offsetHeight) || sh;
    const mx = Math.max(0, (pw * s - sw) / 2), my = Math.max(0, (ph * s - sh) / 2);
    return { s, x: Math.max(-mx, Math.min(mx, z.x)), y: Math.max(-my, Math.min(my, z.y)) };
  }

  planDown(e) {
    if (!this._ptrs) this._ptrs = new Map();
    this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    this.planRebase(this.planGesture());
  }
  planMove(e) {
    if (!this._ptrs || !this._ptrs.has(e.pointerId) || !this.state.planZoom) return;
    this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = this.planGesture(), st = this._planStart, base = this._planBase;
    if (!now || !st || !base || now.n !== st.n) { this.planRebase(now); return; }
    const el = this._planStage; if (!el) return;
    const r = el.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const k = (st.d > 1 && now.d > 1) ? (now.d / st.d) : 1;
    const s = Math.max(this.PLAN_ZOOM_MIN, Math.min(this.PLAN_ZOOM_MAX, base.s * k));
    /**
     * 손가락 **아래에 있던 지점이 제자리에 남게** 이동을 다시 푼다.
     * 배율만 바꾸면 도면이 손에서 미끄러져 「확대가 엉뚱한 데를 본다」가 된다.
     */
    const px = ((st.cx - ox) - base.x) / base.s, py = ((st.cy - oy) - base.y) / base.s;
    this.setState({ planZoom: this.planClamp({ s, x: (now.cx - ox) - px * s, y: (now.cy - oy) - py * s }) });
  }
  planUp(e) {
    if (this._ptrs) this._ptrs.delete(e.pointerId);
    this.planRebase(this.planGesture());
  }
  buildRightPanel() {
    const t = this.T(), ln = this.state.lang, v = this.state.rightView;
    const tab = (id) => ({ active: v === id, onClick: () => this.setRightView(id), style: { flex: 1, textAlign: 'center', padding: '7px 4px', fontSize: '11px', fontWeight: v === id ? 600 : 500, color: v === id ? 'var(--fg)' : 'var(--fg-3)', borderBottom: '2px solid ' + (v === id ? 'var(--accent)' : 'transparent'), cursor: 'pointer' } });
    const ro = this.state.rightStmtOpen || {};
    const mcMap = { flag: 'var(--accent)', confirm: 'var(--g-confirm)', suspect: 'var(--g-suspect)', contradict: 'var(--g-contradict)' };
    const marksOnly = this.state.rightMarksOnly !== false;
    const stmts = this.PEOPLE.map(p => { const open = !!ro[p.id]; const first = this.STMT[p.id][0] || ''; const marks = (this.state.hls || []).filter(h => h.pid === p.id).sort((a, b) => (a.pi - b.pi) || (a.start - b.start)).map(h => ({ t: this.STMT[p.id][h.pi].slice(h.start, h.end), color: mcMap[h.mark] })); return { name: p.name, ini: p.ini, color: p.color, avStyle: this.avStyle(p, 20), open, collapsed: !open, rot: open ? 'rotate(180deg)' : 'rotate(0deg)', preview: first.length > 30 ? first.slice(0, 30) + '…' : first, onToggle: () => { const o = Object.assign({}, ro); if (o[p.id]) delete o[p.id]; else o[p.id] = true; this.setState({ rightStmtOpen: o }); }, marks, hasMarks: marks.length > 0, noMarks: marks.length === 0, paras: this.STMT[p.id].map((par, pi) => ({ segs: this.segsFor(p.id, pi, par) })) }; });
    const inv = this.buildInvestigation(), memo = this.buildMemos();
    return { statements: stmts, invLog: inv.log, invEmpty: inv.emptyLog, memoRows: memo.rows, memoEmpty: memo.empty, onAddMemo: () => this.newMemo(),
      marksOnly, fullText: !marksOnly, onToggleMarksOnly: () => this.setState({ rightMarksOnly: !marksOnly }),
      marksToggleLabel: marksOnly ? t.marksOnly : t.fullText,
      marksToggleStyle: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--r-pill)', cursor: 'pointer', color: marksOnly ? 'var(--accent)' : 'var(--fg-3)', background: marksOnly ? 'var(--accent-soft)' : 'transparent', border: '1px solid ' + (marksOnly ? 'transparent' : 'var(--border-strong)') },
      tabs: { statements: tab('statements'), invlog: tab('invlog'), memo: tab('memo') },
      showStatements: v === 'statements', showInvlog: v === 'invlog', showMemo: v === 'memo',
      labels: { statements: t.segOriginal, invlog: t.invLogTitle, memo: t.navMemo } };
  }
  buildMemos() {
    const t = this.T(), f = this.state.memoFilter || 'all', all = this.state.memos || [];
    const tmeta = { none: t.tgtNone, person: t.tgtPerson, statement: t.tgtStatement, evidence: t.tgtEvidence };
    const tc = { none: 'var(--fg-4)', person: 'var(--accent)', statement: 'var(--status-progress)', evidence: 'var(--g-confirm)' };
    const chip = (active, color) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (active ? (color || 'var(--accent)') : 'var(--border-strong)'), background: active ? 'var(--accent-soft)' : 'transparent', color: active ? (color || 'var(--accent)') : 'var(--fg-3)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 });
    const numOf = {}; all.forEach((m, i) => { numOf[m.id] = i + 1; });
    const layerMeta = { claim: { label: t.layerClaimShort, color: 'var(--status-progress)' }, fact: { label: t.layerFactShort, color: 'var(--g-confirm)' } };
    const q = (this.state.memoQuery || '').trim().toLowerCase();
    const sortMode = this.state.memoSort || 'recent';
    let base = all.filter(m => f === 'all' || m.targetType === f);
    if (q) base = base.filter(m => (((m.content || '') + ' ' + (m.quote || '')).toLowerCase().indexOf(q) >= 0));
    base = base.slice().reverse();
    if (sortMode === 'target') { const ord = { person: 0, statement: 1, evidence: 2, none: 3 }; base = base.slice().sort((a, b) => (ord[a.targetType] == null ? 9 : ord[a.targetType]) - (ord[b.targetType] == null ? 9 : ord[b.targetType])); }
    const rows = base.map(m => {
      const who = m.quotePid ? this.PEOPLE.find(x => x.id === m.quotePid) : null;
      const editing = this.state.editMemoId === m.id;
      const pchip = (active, color) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '24px', padding: '0 9px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (active ? color : 'var(--border-strong)'), background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--fg)' : 'var(--fg-3)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 });
      return { id: m.id, num: numOf[m.id], numLabel: '#' + numOf[m.id], quote: m.quote, hasQuote: !!m.quote, quoteWho: who ? who.name : '', content: m.content, hasContent: !!(m.content && m.content.trim()),
        editing, readMode: !editing, onEdit: () => this.editMemo(m.id), onLock: () => this.lockMemo(m.id),
        onContent: (e) => this.setMemoContent(m.id, e.target.value), onDel: () => this.delMemo(m.id), accent: tc[m.targetType] || 'var(--fg-4)',
        isPerson: m.targetType === 'person', isStatement: m.targetType === 'statement', isEvidence: m.targetType === 'evidence',
        saved: !!(m.content && m.content.trim()), savedLabel: t.memoSaved,
        hasLayer: !!layerMeta[m.layer], layerLabel: (layerMeta[m.layer] || {}).label, layerStyle: { fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: 'var(--r-pill)', border: '1px solid ' + ((layerMeta[m.layer] || {}).color || 'var(--border-strong)'), color: (layerMeta[m.layer] || {}).color || 'var(--fg-4)' },
        pinned: !!((this.state.quotePins || {})[m.id]), onPin: () => { const pp = Object.assign({}, this.state.quotePins || {}); if (pp[m.id]) delete pp[m.id]; else pp[m.id] = true; this.setState({ quotePins: pp }); },
        pinLabel: (this.state.quotePins || {})[m.id] ? t.memoPinOn : t.memoPin,
        pinStyle: { color: (this.state.quotePins || {})[m.id] ? 'var(--accent)' : 'var(--fg-4)', fontSize: '12px', marginRight: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' },
        hasMeta: !!(m.timeKo || m.ctx), showMetaOnly: !(m.content && m.content.trim()) && !!(m.timeKo || m.ctx), metaText: [this.memoWhen(m), m.ctx].filter(Boolean).join(' · '),
        personChips: this.PEOPLE.map(p => ({ label: p.name, dot: { width: '8px', height: '8px', borderRadius: '2px', background: p.color, flex: 'none' }, onClick: () => this.setMemoTarget(m.id, 'person', p.id), style: pchip(m.targetId === p.id, p.color) })),
        stmtChips: this.PEOPLE.map(p => ({ label: p.name, dot: { width: '8px', height: '8px', borderRadius: '2px', background: p.color, flex: 'none' }, onClick: () => this.setMemoTarget(m.id, 'statement', p.id), style: pchip(m.targetId === p.id, 'var(--status-progress)') })),
        eviChips: this.COLLECTED_POOL.filter(w => this.revealedTerms()[w]).map(w => ({ label: w, dot: { width: '8px', height: '8px', borderRadius: '2px', background: 'var(--g-confirm)', flex: 'none' }, onClick: () => this.setMemoTarget(m.id, 'evidence', w), style: pchip(m.targetId === w, 'var(--g-confirm)') })),
        eviEmpty: this.COLLECTED_POOL.filter(w => this.revealedTerms()[w]).length === 0,
        targets: ['none', 'person', 'statement', 'evidence'].map(tt => ({ label: tmeta[tt], onClick: () => this.setMemoTarget(m.id, tt, tt === 'person' || tt === 'statement' ? (m.quotePid || m.targetId || this.PEOPLE[0].id) : null), style: chip(m.targetType === tt, tc[tt]) })) };
    });
    const filters = ['all', 'person', 'statement', 'evidence', 'none'].map(ff => ({ label: (ff === 'all' ? t.tgtAll : tmeta[ff]) + ' ' + all.filter(m => ff === 'all' || m.targetType === ff).length, onClick: () => this.setMemoFilter(ff), style: chip(f === ff) }));
    const sortOpts = [['recent', t.sortRecent], ['target', t.sortTarget]].map(([k, lbl]) => ({ label: lbl, onClick: () => this.setMemoSort(k), style: chip(sortMode === k) }));
    return { filters, sortOpts, rows, empty: rows.length === 0 && !q, searchEmpty: rows.length === 0 && !!q, query: this.state.memoQuery || '', onQuery: (e) => this.setMemoQuery(e.target.value), onNew: () => this.newMemo() };
  }

  buildRef() {
    const t = this.T(), ln = this.state.lang;
    const empty = { display: 'inline-block', minWidth: '58px', textAlign: 'center', borderBottom: '1.5px dashed var(--g-empty-line)', color: 'var(--fg-4)', padding: '0 9px 2px', fontSize: '12px', fontWeight: 500 };
    const fill = { display: 'inline-block', background: 'var(--g-fill-bg)', color: 'var(--g-fill-fg)', fontWeight: 600, padding: '1px 9px', borderRadius: 'var(--r-sm)' };
    const lock = { display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--g-lock-bg)', color: 'var(--g-lock-fg)', fontWeight: 600, padding: '1px 9px 1px 7px', borderRadius: 'var(--r-sm)' };
    const mc = { confirm: 'var(--g-confirm)', suspect: 'var(--g-suspect)', contradict: 'var(--g-contradict)' };
    const cellBase = (c) => ({ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 12px', background: c ? (c === 'confirm' ? 'rgba(76,183,130,.1)' : c === 'suspect' ? 'rgba(242,201,76,.1)' : 'rgba(235,87,87,.1)') : 'var(--bg-subtle)', boxShadow: c ? 'inset 3px 0 0 ' + mc[c] : 'none', borderBottom: '1px solid var(--border)' });
    return {
      blanks: [
        { pre: '증인은 ', word: t.kindPlace, post: '에서', style: empty, check: false, title: t.bsEmptyT, desc: t.bsEmptyD },
        { pre: '함께 온 ', word: '증인 A와', post: '', style: fill, check: false, title: t.bsFillT, desc: t.bsFillD },
      ],
      sections: [
        { statusKey: 'backlog', title: ln === 'ko' ? '잠김' : 'Locked', chipLabel: t.secLockedShort, chip: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated-2)', color: 'var(--fg-4)' }, desc: (ln === 'ko' ? '앞 항을 완성해야 열린다. 항 번호만 보이고 제목·공란 라벨·본문은 가려진다.' : 'Opens only after the previous section is completed. Only the number shows; title, blank labels and prose are hidden.'), card: { border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px', opacity: 0.7 } },
        { statusKey: 'progress', title: ln === 'ko' ? '열림' : 'Open', chipLabel: t.secTodo, chip: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated-2)', color: 'var(--fg-4)' }, desc: (ln === 'ko' ? '현재 채우는 항. 공란을 눌러 입력하며, 완성 전까지 자유롭게 수정한다.' : 'The section being filled. Click a blank to enter; freely editable until complete.'), card: { border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '16px' } },
        { statusKey: 'done', title: ln === 'ko' ? '완성' : 'Complete', chipLabel: t.secDone, chip: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: 'var(--g-lock-bg)', color: 'var(--g-lock-mark)' }, desc: (ln === 'ko' ? '공란을 모두 채우면 자동으로 완성·잠기고 접힌다. 정답 여부는 알리지 않으며, 연동 정보가 공개된다. 항당 1회 재개봉해 다시 편집할 수 있고, 이미 공개된 정보는 회수되지 않는다.' : 'Auto-completes, locks and collapses when every blank is filled. Correctness is never revealed; linked info unlocks. Each section can be reopened once; revealed info is never taken back.'), card: { border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px', background: 'rgba(76,183,130,.04)' } },
      ],
      marks: [
        { icon: '\u2713', iconStyle: { color: mc.confirm, fontWeight: 700, fontSize: '13px' }, sample: ln === 'ko' ? '장소 갑 · 도착' : 'Place A · arrived', cell: cellBase('confirm'), title: t.markConfirm, desc: t.mkConfirmD, auto: false },
        { icon: '?', iconStyle: { color: mc.suspect, fontWeight: 700, fontSize: '13px' }, sample: ln === 'ko' ? '장소 을 · 미상' : 'Place B · unclear', cell: cellBase('suspect'), title: t.markSuspect, desc: t.mkSuspectD, auto: false },
        { icon: '\u2260', iconStyle: { color: mc.contradict, fontWeight: 700, fontSize: '13px' }, sample: ln === 'ko' ? '장소 병 · 모순' : 'Place C · conflict', cell: cellBase('contradict'), title: t.markContradict, desc: t.mkContradictD, auto: false },
      ],
      annotations: [
        { sample: ln === 'ko' ? '“…계속 그 자리에 있었습니다.”' : '“…stayed there the whole time.”', sampleStyle: { background: 'rgba(76,183,130,.16)', boxShadow: 'inset 0 -1.5px 0 ' + mc.confirm, borderRadius: '3px', padding: '2px 4px' }, title: t.markConfirm, desc: t.mkConfirmD },
        { sample: ln === 'ko' ? '“아마 몇 분 거리였을 거예요.”' : '“…a few minutes away, I think.”', sampleStyle: { background: 'rgba(242,201,76,.16)', boxShadow: 'inset 0 -1.5px 0 ' + mc.suspect, borderRadius: '3px', padding: '2px 4px' }, title: t.markSuspect, desc: t.mkSuspectD },
        { sample: ln === 'ko' ? '“돌아와서 바로 잠들었어요.”' : '“…went back and fell asleep.”', sampleStyle: { background: 'rgba(235,87,87,.16)', boxShadow: 'inset 0 -1.5px 0 ' + mc.contradict, borderRadius: '3px', padding: '2px 4px' }, title: t.markContradict, desc: t.mkContradictD },
      ],
      profileSlots: [
        { title: t.psEmptyT, desc: t.psEmptyD, filled: false, empty: true },
        { title: t.psFillT, desc: t.psFillD, filled: true, empty: false, text: ln === 'ko' ? '표본 항목' : 'Sample item' },
      ],
      reveals: [
        { title: t.rvConfirmT, desc: t.rvConfirmD }, { title: t.rvStmtT, desc: t.rvStmtD },
        { title: t.rvWinT, desc: t.rvWinD }, { title: t.rvTargetT, desc: t.rvTargetD },
      ],
      newStates: [
        { title: ln === 'ko' ? '정보 층위 · 확정' : 'Layer · confirmed', desc: ln === 'ko' ? '브리핑·확보 물증. 반박 불가한 사실. 실선·채움, 초록 실선 바로 표시. 모순 판정의 유일한 기준.' : 'Briefing and secured evidence. Irrefutable fact. Solid fill, green bar. The only basis for contradiction.' },
        { title: ln === 'ko' ? '정보 층위 · 주장' : 'Layer · claim', desc: ln === 'ko' ? '용의자 진술. 참일 수도 거짓일 수도. 따옴표·기울임·인물색 바로 표시. 미확정.' : 'Suspect statements. May be true or false. Quote, italic, person-color bar. Unverified.' },
        { title: ln === 'ko' ? '정보 층위 · 판단' : 'Layer · judgment', desc: ln === 'ko' ? '내가 채운 공란. 입력 필드로 표시. 최종 제출 전까지 자유 수정.' : 'Blanks I fill. Shown as input fields. Freely editable until final submission.' },
        { title: ln === 'ko' ? '장 · 자동 완성' : 'Section · auto-complete', desc: ln === 'ko' ? '장 확인 버튼 없음. 공란을 모두 채우면 자동 완성되고 연동 정보가 공개됨. 채점은 하지 않음.' : 'No confirm button. Filling all blanks auto-completes and unlocks linked info. No grading.' },
        { title: ln === 'ko' ? '최종 제출 · 확인' : 'Final submit · confirm', desc: ln === 'ko' ? '아무 때나 제출 가능. 제출 후에만 채점되며 되돌릴 수 없음. 미채움 공란 개수를 경고.' : 'Submit anytime. Graded only after submission, irreversible. Warns of unfilled blanks.' },
        { title: ln === 'ko' ? '도착 신호 · 안 읽음' : 'Arrival · unread', desc: ln === 'ko' ? '새 정보가 공개되면 토스트로 위치만 알리고, 사이드바 항목에 안 읽음 점이 남음. 방문하면 사라짐.' : 'New info shows a toast pointing to where, and leaves an unread dot on the sidebar item; cleared on visit.' },
        { title: ln === 'ko' ? '관계도 · 알리바이 대조' : 'Graph · alibi cross-check', desc: ln === 'ko' ? '두 용의자 노드를 선택하면 대조 바가 뜨고, 실행하면 조사 1회로 관계가 드러남.' : 'Selecting two suspect nodes shows a cross-check bar; running it spends one investigation to reveal a link.' },
        { title: ln === 'ko' ? '평면도 · 시간대별' : 'Floor plan · by time', desc: ln === 'ko' ? '시간대를 바꾸면 각 인물의 주장 위치가 점으로 이동. 판정하지 않음.' : 'Switching times moves each person’s claimed position. No judgment.' },
        { title: ln === 'ko' ? '평면도 · 미공개 장소' : 'Floor plan · hidden place', desc: ln === 'ko' ? '별채는 1장 완성 전까지 지도에 나타나지 않음.' : 'The annex does not appear until section 1 is complete.' },
        { title: ln === 'ko' ? '정독 · 하이라이트' : 'Reading · highlight', desc: ln === 'ko' ? '드래그 선택 → 확인·의심·모순 색 적용. 인용·복사 가능.' : 'Drag-select → apply verified/doubtful/contradiction. Quote or copy.' },
        { title: ln === 'ko' ? '현장 · 공간 조사' : 'Scene · search states', desc: ln === 'ko' ? '공간·고정물·시신을 눌러 조사. 미조사(회색)/빈손(초록 테두리)/물증 발견(청록)으로 구분.' : 'Click a space, fixture, or body to investigate. Unsearched (gray) / empty (green outline) / evidence found (accent).' },
        { title: ln === 'ko' ? '용의자 · 조사 버튼' : 'Suspect · investigate', desc: ln === 'ko' ? '카드에서 소지품 검사·통화내역 실행. 사용 가능 / 잔여 부족 / 조사 완료 3상태.' : 'Run belongings/phone from the card. Available / no budget / done.' },
        { title: ln === 'ko' ? '관계도 · 재구성' : 'Graph · reconstruction', desc: ln === 'ko' ? '빈 상태에서 시작해 조사·장 완성으로 숨은 관계가 드러남. 추측 관계는 그리지 않음.' : 'Starts empty; hidden relationships surface via investigation and section completions. No speculative edges.' },
      ],
      sounds: [
        { title: ln === 'ko' ? '장 완성' : 'Complete section', desc: ln === 'ko' ? '장이 완성될 때 확정음.' : 'Tone when a section completes.' },
        { title: ln === 'ko' ? '조사 실행' : 'Run investigation', desc: ln === 'ko' ? '예산 차감과 함께.' : 'With budget spend.' },
        { title: ln === 'ko' ? '단서 발견' : 'Clue found', desc: ln === 'ko' ? '결정적·무고 구분 없이 동일음.' : 'Same tone regardless of usefulness.' },
        { title: ln === 'ko' ? '공란 확정' : 'Blank filled', desc: ln === 'ko' ? '카드 배치·입력 시.' : 'On placing a card or entry.' },
      ],
    };
  }

  renderVals() {
    const t = this.T(), s = this.state, ln = s.lang;
    const view = s.view, isNarr = view === 'narrative', isStmt = view === 'statements', isRef = view === 'reference', isInv = view === 'investigate';
    const route = s.route, isHome = route === 'home', isDetail = route === 'detail';
    const isProfile = view === 'profile', isOverview = view === 'overview', isMemo = view === 'memo', isMap = view === 'map', isGraph = view === 'graph', isLog = view === 'log';
    const solvedCount = this.SECTIONS.filter(x => this.SEC_BLANKS[x.id].every(id => s.blanks[id] != null)).length;
    const filledBlanks = Object.keys(s.blanks).filter(k => s.blanks[k] != null).length;
    const navCls = (v) => 'nav-item' + (view === v ? ' active' : '');
    const segCls = (on) => 'seg' + (on ? ' active' : '');
    const ovNarrowed = this.deathNarrowed();
    const overview = [
      { k: t.ovVictimK, v: this.victimLine(ln) }, { k: t.ovWhenK, v: ovNarrowed ? this.narrowedLabel(ln) : t.ovWhenV, prev: ovNarrowed ? t.ovWhenV : '', badge: ovNarrowed ? (ln === 'ko' ? '1항 완성으로 갱신' : 'Updated · sec 1') : '' },
      { k: t.ovBodyK, v: t.ovBodyV }, { k: t.ovSceneK, v: t.ovSceneV },
    /**
     * ⚠ **값이 없는 줄은 안 그린다.** 엔진이 `body_state`·`scene_state` 를 안 주면
     * `applyCase` 가 빈 문자열로 두는데, 그대로 그리면 「시신」 옆이 비어 있는
     * 줄이 남는다 — 07-29 밤에 사용자가 눌러서 찾은 **빈 알약·빈 「본인 주장」**
     * 과 정확히 같은 모양이다(*"지우는 것과 안 그리는 것은 다른 일"*).
     */
    ].filter((o) => o.v).map((o, i, a) => ({ k: o.k, v: o.v, prev: o.prev || '', hasPrev: !!o.prev, badge: o.badge || '', hasBadge: !!o.badge, onQuote: () => this.quoteBriefToMemo(o.v), onCopy: () => { try { navigator.clipboard.writeText(o.v); } catch (e) {} }, style: { display: 'flex', gap: '12px', padding: '12px 16px', alignItems: 'baseline', borderBottom: i < a.length - 1 ? '1px solid var(--border)' : 'none' } }));;

    const result = this.buildResult();
    return {
      ui: Object.assign({}, t, {
        viewTitle: isNarr ? t.nTitle : isStmt ? t.sTitle : isInv ? t.navInvestigate : isProfile ? t.navProfile : isOverview ? t.navOverview : isMemo ? t.memoTitle : isMap ? t.navMap : isGraph ? t.navGraph : isLog ? t.invLogTitle : (view === 'result') ? result.endTitle : t.rTitle,
        viewSub: isNarr ? t.nSub : isStmt ? t.sSub : isInv ? t.invHint : isMemo ? t.annHint : isMap ? t.mapHint : isGraph ? t.graphHint : isLog ? t.logHint : (isProfile || isOverview || view === 'result') ? '' : t.rSub,
      }),
      isIntro: route === 'play' && s.stage !== 'free', isFree: route === 'play' && s.stage === 'free', stageProlog: s.stage === 'prologue', stageBrief: s.stage === 'brief', stageRead: s.stage === 'read', stageInterlude: s.stage === 'interlude',
      isHome: isHome, isDetail: isDetail, home: this.buildHome(), detail: this.buildDetail(),
      prologParas: this.PROLOG.map((p, pi) => ({ text: p })), onPrologContinue: () => this.setState({ stage: 'brief' }),
      interlude: this.buildInterlude(),
      ovQuote: { onSelect: (ev) => this.onStmtSelect('__prolog', 0, ev), showTb: !!s.sel && s.sel.pid === '__prolog', tbStyle: s.sel ? { position: 'absolute', left: s.sel.left + 'px', top: s.sel.top + 'px', transform: 'translate(-50%,-100%)', marginTop: '-6px', zIndex: 41 } : {} },
      ovProse: this.PROLOG.map((par, pi) => ({ pi, segs: this.segsFor('__prolog', pi, par), onSelect: (ev) => this.onStmtSelect('__prolog', pi, ev), showTb: !!s.sel && s.sel.pid === '__prolog' && s.sel.pi === pi, tbStyle: s.sel ? { position: 'absolute', left: s.sel.left + 'px', top: s.sel.top + 'px', transform: 'translate(-50%,-100%)', marginTop: '-6px', zIndex: 41 } : {} })),
      confirmAbandon: s.confirmAbandon, onAbandon: () => this.abandon(), onCancelAbandon: () => this.setState({ confirmAbandon: false }), onGoHome: () => this.goHome(), onAbandonReq: () => this.setState({ confirmAbandon: true }),
      dangerBtnStyle: { background: 'var(--label-red)', borderColor: 'transparent', color: '#fff', fontWeight: 600 },
      roomBtnStyle: { flex: '0 0 auto', opacity: 0.4, pointerEvents: 'none' },
      /**
       * ⚠ **여기도 빈 줄을 걸러야 한다** (2026-07-30 · 사용자가 눌러서 찾음)
       *
       * 07-30에 `buildDetail`(사건 개요)에만 `.filter(o => o.v)` 를 넣었다. **같은
       * `DICT` 값을 읽는 화면이 둘인데 한 곳만 고쳤다** — 브리핑(읽기 전 확인)은
       * 네 줄을 그대로 그려서 **「시신」·「현장」 옆이 빈 채로** 나왔다.
       * `applyCase` 주석의 *"빈 문자열이면 그 줄을 안 그린다"* 가 이 화면에서는
       * 거짓이었다.
       *
       * ★ 오늘 같은 부류가 셋째다 ★ 서식 문단 규격(본문↔생성기 보충)도, 주석↔코드
       * (감추는 문장)도 같은 모양이다 — **한 값을 두 곳이 쓰는데 한 곳만 고쳤다.**
       */
      briefRows: [{ k: t.ovVictimK, v: this.victimLine(ln) }, { k: t.ovWhenK, v: t.ovWhenV }, { k: t.ovBodyK, v: t.ovBodyV }, { k: t.ovSceneK, v: t.ovSceneV }].filter((o) => o.v).map((o, i, a) => ({ k: o.k, v: o.v, style: { display: 'flex', gap: '12px', padding: '12px 16px', alignItems: 'baseline', borderBottom: i < a.length - 1 ? '1px solid var(--border)' : 'none' } })),
      readCard: this.buildReadCard(), briefBtnStyle: { width: '100%', justifyContent: 'center' }, onStartRead: () => this.startRead(),
      isWide: !s.isNarrow, isNarrow: s.isNarrow,
      isNarrative: isNarr, isStatements: isStmt, isReference: isRef,
      showOriginal: isStmt,
      nav: {
        narrCls: navCls('narrative'), stmtCls: navCls('statements'), refCls: navCls('reference'), invCls: navCls('investigate'), profileCls: navCls('profile'),
        narrSeg: segCls(isNarr), stmtSeg: segCls(isStmt), refSeg: segCls(isRef), invSeg: segCls(isInv), profileSeg: segCls(isProfile),
        onNarr: () => this.setView('narrative'), onStmt: () => this.setView('statements'), onRef: () => this.setView('reference'), onInv: () => this.setView('investigate'), onProfile: () => this.setView('profile'),
        overviewCls: navCls('overview'), overviewSeg: segCls(isOverview), onOverview: () => this.setView('overview'),
        narrUnread: !!(s.unread && s.unread.narrative), stmtUnread: !!(s.unread && s.unread.statements), mapUnread: !!(s.unread && s.unread.map), overviewUnread: !!(s.unread && s.unread.overview),
        memoCls: navCls('memo'), memoSeg: segCls(isMemo), onMemo: () => this.setView('memo'), memoBadge: (s.memos || []).length ? ('' + (s.memos || []).length) : '',
        mapCls: navCls('map'), mapSeg: segCls(isMap), onMap: () => this.setView('map'),
        graphCls: navCls('graph'), graphSeg: segCls(isGraph), onGraph: () => this.setView('graph'),
        logCls: navCls('log'), logSeg: segCls(isLog), onLog: () => this.setView('log'), logBadge: (s.invLog || []).length ? ('' + (s.invLog || []).length) : '',
        narrProgress: solvedCount + '/' + this.SECTIONS.length + (ln === 'ko' ? '장 · ' : ' · ') + filledBlanks + '/' + Object.keys(this.BLANKS).length, invBadge: '' + (this.BUDGET - this.invSpent()),
      },
      bottomNav: this.buildBottomNav(view),
      moreNav: this.buildMoreNav(view),
      moreOpen: s.moreOpen, onCloseMore: () => this.setState({ moreOpen: false }), stop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      stmt: { gridCls: segCls(s.stmtMode === 'grid'), origCls: segCls(s.stmtMode === 'original'), onGrid: () => this.setMode('grid'), onOriginal: () => this.setMode('original') },
      overview,
      narrLayoutStyle: { display: 'flex', gap: '22px', padding: '22px 24px', flexDirection: s.isNarrow ? 'column' : 'row', alignItems: 'flex-start', justifyContent: 'center', maxWidth: '1120px', margin: '0 auto' },
      bankStyle: { width: s.isNarrow ? '100%' : '292px', flex: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px', position: s.isNarrow ? 'static' : 'sticky', top: '0', background: 'var(--bg-subtle)' },
      sections: this.buildSections(),
      narrProse: s.narrMode === 'prose', narrList: s.narrMode === 'list',
      narrShowBank: s.narrMode === 'prose',
      preventDefault: (e) => { if (e && e.preventDefault) e.preventDefault(); },
      reportHead: {
        caseNo: 'CASE-001', subject: ln === 'ko' ? '윤다인 (30)' : 'Kim Chae-won (30)',
        author: ln === 'ko' ? '담당 수사관' : 'Lead investigator',
        statusLabel: solvedCount === this.SECTIONS.length ? (ln === 'ko' ? '작성 완료' : 'Complete') : (ln === 'ko' ? '작성 중' : 'In progress'),
        statusDone: solvedCount === this.SECTIONS.length,
        statusChipStyle: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: solvedCount === this.SECTIONS.length ? 'var(--g-lock-bg)' : 'var(--bg-elevated-2)', color: solvedCount === this.SECTIONS.length ? 'var(--g-lock-mark)' : 'var(--fg-3)' },
        fields: [
          { k: ln === 'ko' ? '사건번호' : 'Case no.', v: 'CASE-001' },
          { k: ln === 'ko' ? '대상' : 'Subject', v: this.VICTIM_LINE ? (ln === 'ko' ? this.VICTIM_LINE.ko : this.VICTIM_LINE.en) : (ln === 'ko' ? '윤다인 (30) · 소설가' : 'Kim Chae-won (30) · Novelist') },
          { k: ln === 'ko' ? '작성' : 'Prepared by', v: ln === 'ko' ? '담당 수사관' : 'Lead investigator' },
        ],
      },
      bank: this.buildBank(),
      termDlg: this.buildTermDlg(),
      grid: this.buildGrid(),
      isInvestigate: isInv, inv: this.buildInvestigation(),
      isProfile: isProfile, profiles: this.buildProfiles(), isOverview: isOverview,
      profileDetail: s.openProfile ? (this.buildProfiles().find(p => p.id === s.openProfile)) : null,
      profileOpen: !!s.openProfile, onCloseProfile: () => this.closeProfileDetail(),
      isMemo: isMemo, memo: this.buildMemos(),
      isMap: isMap, floor: this.buildFloorplan(),
      /**
       * 평면도 탭-확대. **데스크톱에서는 `tapToZoom` 이 거짓이라 아래 값이 하나도
       * 안 읽히고, 마크업도 옛것 그대로 렌더된다** — 무변경이 조건이었다.
       */
      plan: (() => {
        const z = s.planZoom;
        return {
          tapToZoom: s.isNarrow,
          onOpen: () => this.openPlanZoom(),
          zoomOpen: !!z,
          onClose: () => this.closePlanZoom(),
          // 미리보기는 「눌러진다」는 것만 말한다 — 도면 자체는 그대로 둔다
          previewStyle: { cursor: 'zoom-in', position: 'relative' },
          stageRef: (el) => { this._planStage = el; },
          figRef: (el) => { this._planFig = el; },
          // ⛔ touch-action:none 이 없으면 브라우저가 먼저 스크롤·확대를 가져간다
          stageStyle: { position: 'absolute', inset: '0', overflow: 'hidden', touchAction: 'none', overscrollBehavior: 'contain', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          figStyle: z
            ? { width: '100%', transform: `translate(${Math.round(z.x)}px, ${Math.round(z.y)}px) scale(${z.s})`, transformOrigin: 'center center' }
            : { width: '100%' },
          zoomLabel: z ? Math.round(z.s * 100) + '%' : '100%',
          onDown: (e) => this.planDown(e), onMove: (e) => this.planMove(e),
          onUp: (e) => this.planUp(e), onCancel: (e) => this.planUp(e),
        };
      })(),
      mapPlanMode: (s.mapMode || 'plan') === 'plan', mapGridMode: (s.mapMode || 'plan') === 'grid', onMapPlan: () => this.setState({ mapMode: 'plan' }), onMapGrid: () => this.setState({ mapMode: 'grid' }), mapPlanStyle: this.segTab((s.mapMode || 'plan') === 'plan'), mapGridStyle: this.segTab((s.mapMode || 'plan') === 'grid'),
      isGraph: isGraph, graph: this.buildGraph(),
      isLog: isLog, logView: this.buildInvestigation(),
      invConfirm: this.buildInvConfirm(), invResultCard: this.buildInvResult(),
      isResult: view === 'result', result: result,
      finishCTA: { show: view === 'narrative' && s.started, onFinish: () => this.setState({ confirmFinish: true }) },
      toast: s.toast,
      confirmFinish: s.confirmFinish, onDoFinish: () => this.finishReport(), onCancelFinish: () => this.setState({ confirmFinish: false }),
      finishUnfilled: (() => { const n = Object.keys(this.BLANKS).length - Object.keys(s.blanks).filter(k => s.blanks[k] != null).length; return n > 0 ? ((this.state.lang === 'ko' ? '아직 채우지 않은 공란 ' : 'Unfilled blanks: ') + n + (this.state.lang === 'ko' ? '개' : '')) : ''; })(),
      shell: {
        showLeft: !s.isNarrow && s.leftOpen && !s.focusMode,
        leftClosed: !(!s.isNarrow && s.leftOpen && !s.focusMode),
        showRight: s.rightOpen && !s.focusMode,
        rightPanelStyle: s.isNarrow
          ? { position: 'absolute', left: 0, right: 0, bottom: 0, top: '38%', zIndex: 60, borderTop: '1px solid var(--border-strong)', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-modal)' }
          : { width: '340px', flex: 'none', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-subtle)' },
        rowPad: '', contentPad: '',
        focusMode: s.focusMode,
        onToggleLeft: () => this.toggleLeft(), onToggleRight: () => this.toggleRight(),
        onToggleFocus: () => this.toggleFocus(),
        leftStyle: s.leftOpen ? { background: 'var(--bg-active)', color: 'var(--fg)', borderColor: 'var(--border-strong)' } : {},
        rightStyle: s.rightOpen ? { background: 'var(--bg-active)', color: 'var(--fg)', borderColor: 'var(--border-strong)' } : {},
        focusStyle: s.focusMode ? { background: 'var(--bg-active)', color: 'var(--fg)', borderColor: 'var(--border-strong)' } : {},
        onSettings: () => this.setState({ settingsOpen: !s.settingsOpen, openPicker: null, openCell: null, openSent: null }),
        settingsOpen: s.settingsOpen,
        canBack: (s.navIdx ?? 0) > 0, canFwd: (s.navIdx ?? 0) < ((s.navHist || []).length - 1),
        onBack: () => this.navBack(), onFwd: () => this.navForward(),
        backStyle: (s.navIdx ?? 0) > 0 ? {} : { opacity: 0.35, pointerEvents: 'none' },
        fwdStyle: (s.navIdx ?? 0) < ((s.navHist || []).length - 1) ? {} : { opacity: 0.35, pointerEvents: 'none' },
      },
      right: this.buildRightPanel(),
      invLayoutStyle: { display: 'flex', gap: '20px', padding: '20px 24px', flexDirection: s.isNarrow ? 'column' : 'row', alignItems: 'flex-start' },
      invLeftStyle: { width: s.isNarrow ? '100%' : '360px', flex: 'none' },
      invRightStyle: { flex: 1, minWidth: 0, width: s.isNarrow ? '100%' : 'auto' },
      stmtCols: s.isNarrow ? '1fr' : 'repeat(2, 1fr)',
      statements: this.buildStatements(),
      selTb: { onFlag: () => this.applyHl('flag'), onConfirm: () => this.applyHl('confirm'), onSuspect: () => this.applyHl('suspect'), onContradict: () => this.applyHl('contradict'), onClear: () => this.applyHl(null), onQuote: () => this.quoteSelToMemo(), onCopy: () => this.copySel() },
      ref: this.buildRef(),
      quotePickerOpen: !!s.quotePicker, quotePicker: (() => { const p = s.quotePins || {}; const ms = s.memos || []; const numOf = {}; ms.forEach((m, i) => { numOf[m.id] = i + 1; }); return ms.filter(m => p[m.id]).map(m => ({ num: '#' + numOf[m.id], excerpt: (((m.content || m.quote || '').split('\n')[0]) || ('메모 ' + numOf[m.id])).slice(0, 40), onPick: () => this.appendQuote(m.id, s.quotePicker) })); })(),
      onQuotePickNew: () => this.newMemoFromQuote(s.quotePicker), onQuotePickCancel: () => this.setState({ quotePicker: null }), stopModal: (e) => { try { e.stopPropagation(); } catch (x) {} },
      status: { budget: (this.BUDGET - this.invSpent()) + ' / ' + this.BUDGET, diff: this.DIFF },
      gridSort: { on: false, onToggle: () => {}, chipStyle: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '26px', padding: '0 10px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (s.viewOpts.timelineSort ? 'var(--accent)' : 'var(--border-strong)'), background: s.viewOpts.timelineSort ? 'var(--accent-soft)' : 'transparent', color: s.viewOpts.timelineSort ? 'var(--accent)' : 'var(--fg-3)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 } },
      langSeg: { koCls: 'seg' + (ln === 'ko' ? ' active' : ''), enCls: 'seg' + (ln === 'en' ? ' active' : ''), stKo: 'st' + (ln === 'ko' ? ' active' : ''), stEn: 'st' + (ln === 'en' ? ' active' : ''), onKo: () => this.setLang('ko'), onEn: () => this.setLang('en') },
      themeSeg: { stDark: 'st' + (s.theme === 'dark' ? ' active' : ''), stLight: 'st' + (s.theme === 'light' ? ' active' : ''), onDark: () => { if (s.theme !== 'dark') this.toggleTheme(); }, onLight: () => { if (s.theme !== 'light') this.toggleTheme(); } },
      onToggleTheme: () => this.toggleTheme(), themeGlyph: s.theme === 'dark' ? '\u25D1' : '\u25D0',
    };
  }

  /**
   * 현장 평면도 도면 — 컨테이너 · SVG · 절대배치 오버레이 한 벌.
   *
   * 현장 화면과 **탭-확대 오버레이**가 같은 것을 그린다. 두 자리에서 쓰므로 뺐다.
   * (2026-08-05 정정: 둘째 자리는 원래 상황판 배경 판이었는데 상황판이 제품에서
   *  빠졌다. 같은 날 탭-확대가 그 자리를 채웠다 — 우연이고, 하나가 됐다면 합칠
   *  자리였다.)
   * 블록은 **한 글자도 바꾸지 않고** 그대로 옮겼다 — 들여쓰기가 깊은 채로 남아
   * 있는 것은 그 때문이다. 이식된 마크업이라 읽기 좋게 고치는 것보다 같은 것이 낫다.
   *
   * ⚠ **인자 이름 `V` 는 규약이다.** `scripts/port-check.mjs` 가 조건부 렌더와
   *   반복 렌더에서 **참조 이름만** 뽑아 프로토타입과 비교한다. 여기서 `F` 로 받으면
   *   `floor.sWalls` 가 `F.sWalls` 로 보여 **있던 갈래가 사라진 것처럼** 잡힌다.
   *
   *   대조기는 주석과 코드를 가리지 않는다 — 이 주석에 그 두 패턴을 문자 그대로
   *   적었다가 이름 하나가 늘어 대조가 깨졌다. 그래서 여기선 말로만 쓴다.
   */
  renderPlanFigure(V) {
    return (
                  <div style={S("position:relative;width:100%;aspect-ratio:16/10;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-subtle);overflow:hidden")}>
                    <svg viewBox="0 0 1000 625" style={S("position:absolute;inset:0;width:100%;height:100%;pointer-events:none")}>
                      <defs><pattern id="fpHatch" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="9" stroke="var(--border)" strokeWidth="1"></line></pattern></defs>
                      {arr(V.floor.sRoomFills).map((r,$index)=>(<React.Fragment key={$index}><rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill}></rect></React.Fragment>))}
                      {arr(V.floor.sHatch).map((r,$index)=>(<React.Fragment key={$index}><rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#fpHatch)" stroke="var(--border)" strokeWidth="1" rx="4"></rect></React.Fragment>))}
                      {arr(V.floor.sOffsite).map((r,$index)=>(<React.Fragment key={$index}><rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="var(--border-strong)" strokeWidth="1.2" strokeDasharray="6 5" rx="6"></rect></React.Fragment>))}
                      {arr(V.floor.sWalk).map((w,$index)=>(<React.Fragment key={$index}><line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--border-strong)" strokeWidth="1.4" strokeDasharray="6 5"></line></React.Fragment>))}
                      {arr(V.floor.sPoche).map((p,$index)=>(<React.Fragment key={$index}><path d={p.d} fill="none" stroke={p.color} strokeWidth={p.width} strokeLinejoin="miter"></path></React.Fragment>))}
                      {arr(V.floor.sWalls).map((w,$index)=>(<React.Fragment key={$index}><line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--fg-3)" strokeWidth="4.5"></line></React.Fragment>))}
                      {arr(V.floor.sDoorErase).map((d,$index)=>(<React.Fragment key={$index}><line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="var(--bg-subtle)" strokeWidth="7"></line></React.Fragment>))}
                      {arr(V.floor.sDoorLeaf).map((d,$index)=>(<React.Fragment key={$index}><line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="var(--fg-3)" strokeWidth="1.4"></line></React.Fragment>))}
                      {arr(V.floor.sDoorArc).map((d,$index)=>(<React.Fragment key={$index}><path d={d.d} fill="none" stroke="var(--fg-4)" strokeWidth="1.3"></path></React.Fragment>))}
                      {arr(V.floor.sWin).map((w,$index)=>(<React.Fragment key={$index}><line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--accent)" strokeWidth="1.8"></line></React.Fragment>))}
                      <g stroke="var(--fg-4)" strokeWidth="1.4"><line x1={V.floor.scale.x} y1={V.floor.scale.y} x2={V.floor.scale.x2} y2={V.floor.scale.y}></line><line x1={V.floor.scale.x} y1={V.floor.scale.yt1} x2={V.floor.scale.x} y2={V.floor.scale.yt2}></line><line x1={V.floor.scale.x2} y1={V.floor.scale.yt1} x2={V.floor.scale.x2} y2={V.floor.scale.yt2}></line></g>
                    </svg>
                    {arr(V.floor.sWalk).map((w,$index)=>(<React.Fragment key={$index}><span style={S(`position:absolute;left:${w.mx}%;top:${w.my}%;transform:translate(-50%,-50%);font-size:10px;color:var(--fg-4);background:var(--bg-subtle);padding:0 4px`)}>{w.label}</span></React.Fragment>))}
                    {arr(V.floor.locs).map((l,$index)=>(<React.Fragment key={$index}><div style={l.boxStyle} onClick={l.onSearch}>
                      <div style={S("display:flex;align-items:center;gap:6px")}><span style={S(`font-size:11px;color:${l.nameColor}`)}>{l.name}</span>{(l.isNew)?(<><span style={S("font-size:8px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:1px 5px")}>{l.revealNote}</span></>):null}<span style={S("flex:1")}></span>{(l.primary)?(<><span style={l.statusStyle}>{l.statusLabel}</span></>):null}</div>
                      {(l.hasClues)?(<><div style={S("display:flex;flex-wrap:wrap;gap:4px;margin-top:6px")}>{arr(l.clues).map((c,$index)=>(<React.Fragment key={$index}><span style={S("display:inline-flex;align-items:center;gap:4px;height:19px;padding:0 7px;border-radius:var(--r-pill);background:var(--accent-soft);border:1px solid var(--accent);font-size:10px;color:var(--accent)")}><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d={c.iconPath}></path></svg>{c.label}</span></React.Fragment>))}</div></>):null}
                    </div></React.Fragment>))}
                    {arr(V.floor.fixtures).map((f,$index)=>(<React.Fragment key={$index}><span onClick={f.onRun} style={f.markStyle}>{(f.body)?(<><svg width="26" height="26" viewBox="0 0 26 26"><path d="M7 7 L19 19 M19 7 L7 19" stroke="var(--g-contradict)" strokeWidth="3" strokeLinecap="round"></path></svg></>):null}{(f.iconPath)?(<><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d={f.iconPath}></path></svg></>):null}</span></React.Fragment>))}
                    {arr(V.floor.fixtures).map((f,$index)=>(<React.Fragment key={$index}><span style={f.labelStyle}>{f.name}</span></React.Fragment>))}
                    {arr(V.floor.personMarkers).map((pm,$index)=>(<React.Fragment key={$index}><span title={pm.name} style={pm.style}></span></React.Fragment>))}
                    {arr(V.floor.personMarkers).map((pm,$index)=>(<React.Fragment key={$index}><span style={pm.labelStyle}>{pm.name}</span></React.Fragment>))}
                    {arr(V.floor.doorLabels).map((dr,$index)=>(<React.Fragment key={$index}><span style={S(`position:absolute;left:${dr.left}%;top:${dr.top}%;transform:translate(-50%,-50%);font-size:9px;font-weight:600;color:var(--fg-3);background:var(--bg-subtle);padding:0 3px;z-index:5`)}>{dr.label}</span></React.Fragment>))}
                    {arr(V.floor.winLabels).map((wl,$index)=>(<React.Fragment key={$index}><span style={S(`position:absolute;left:${wl.left}%;top:${wl.top}%;transform:translate(-50%,-50%);font-size:9px;font-weight:600;color:var(--accent);background:var(--bg-subtle);padding:0 3px;z-index:5`)}>{wl.label}</span></React.Fragment>))}
                    <span style={S(`position:absolute;left:${V.floor.scaleLabel.left}%;top:${V.floor.scaleLabel.top}%;font-size:10px;color:var(--fg-4);z-index:5`)}>{V.floor.scaleText}</span>
                  </div>
    )
  }

  /**
   * 주장 대조표(도식) — 인물 × 시간대 격자 한 벌.
   *
   * ⛳ **지금은 한 자리에서만 쓴다** (2026-08-05 정정). 둘째 자리가 상황판 배경
   * 판이었는데 상황판이 제품에서 빠졌다. 그래도 **되돌려 넣지 않는다** — 뺀
   * 이유(같은 것을 두 곳이 각자 그리면 갈라진다)는 자리 수와 무관하다.
   * 블록은 **한 글자도 바꾸지 않고** 옮겼다 — 깊은 들여쓰기가 남은 것은 그 때문이다.
   *
   * ⚠ 인자 이름 `V` 는 규약이다. `renderPlanFigure` 머리 주석 참조.
   */
  renderClaimGridFigure(V) {
    return (
                    <div style={S("overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-md)")}>
                      <div style={S("display:flex;min-width:720px;background:var(--bg-subtle);border-bottom:1px solid var(--border)")}>
                        <div style={S("width:184px;flex:none;padding:9px 14px;position:sticky;left:0;background:var(--bg-subtle);z-index:3;border-right:1px solid var(--border)")}><span className="v-meta" style={S("color:var(--fg-4)")}>{V.ui.gridPersonCol}</span></div>
                        {arr(V.grid.times).map((tm,$index)=>(<React.Fragment key={$index}><div style={tm.headStyle}><span className="v-ui" style={tm.labelStyle}>{tm.label}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{tm.sub}</span></div></React.Fragment>))}
                      </div>
                      {arr(V.grid.rows).map((row,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;min-width:720px;border-bottom:1px solid var(--border)")}>
                        <div style={S("width:184px;flex:none;display:flex;align-items:center;gap:9px;padding:0 14px;position:sticky;left:0;background:var(--bg-app);z-index:2;border-right:1px solid var(--border)")}><span style={S(`width:3px;align-self:stretch;background:${row.p.color};flex:none`)}></span>
                          <span style={row.p.avStyle}>{row.p.ini}</span>
                          <span style={S("display:flex;flex-direction:column;min-width:0")}><span className="v-ui" style={S("color:var(--fg);white-space:nowrap")}>{row.p.name}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{row.p.meta}</span></span>
                        </div>
                        {arr(row.cells).map((cell,$index)=>(<React.Fragment key={$index}><div className="g-cell" style={cell.style} onClick={cell.onClick}>
                          {(cell.hasClaim)?(<><span className="g-cell-hoverable" style={cell.labelStyle}>{cell.label}</span>{(cell.isNew)?(<><span style={S("font-size:8px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:1px 5px;margin-left:auto")}>{V.ui.newBadge}</span></>):null}{(cell.marked)?(<><span style={cell.markDotStyle}></span></>):null}</>):null}
                          {(cell.empty)?(<><span style={S("color:var(--fg-4)")}>{V.ui.noClaim}</span></>):null}
                          {(cell.pickerOpen)?(<><div className="g-picker" style={cell.pickerStyle}>{arr(cell.opts).map((mo,$index)=>(<React.Fragment key={$index}><span onClick={mo.onPick} title={mo.label} style={mo.chipStyle}><span style={mo.dot}></span></span></React.Fragment>))}</div></>):null}
                        </div></React.Fragment>))}
                      </div></React.Fragment>))}
                    </div>
    )
  }

  /**
   * 관계도 도면 — 컨테이너 · SVG · 노드/간선 오버레이 한 벌.
   *
   * ⛳ **지금은 한 자리에서만 쓴다** (2026-08-05 정정 · `renderClaimGridFigure`
   * 머리 주석과 같은 이유). 둘째 자리가 상황판 배경 판이었다.
   * 블록은 **한 글자도 바꾸지 않고** 옮겼다 — 깊은 들여쓰기가 남은 것은 그 때문이다.
   *
   * ⚠ 인자 이름 `V` 는 규약이다. `renderPlanFigure` 머리 주석 참조.
   */
  renderGraphFigure(V) {
    return (
                  <div style={S("position:relative;width:100%;aspect-ratio:16/11;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-subtle);overflow:hidden")}>
                    <svg style={S("position:absolute;inset:0;width:100%;height:100%;pointer-events:none")} viewBox="0 0 100 100" preserveAspectRatio="none">
                      {arr(V.graph.edges).map((e,$index)=>(<React.Fragment key={$index}><line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.stroke} strokeWidth={e.width}></line></React.Fragment>))}
                    </svg>
                    {arr(V.graph.edges).map((e,$index)=>(<React.Fragment key={$index}><span style={S(`position:absolute;left:${e.mx}%;top:${e.my}%;transform:translate(-50%,-50%);font-size:10px;font-weight:500;color:${e.labelColor};background:var(--bg-subtle);padding:0 4px;white-space:nowrap`)}>{e.label}</span></React.Fragment>))}
                    {arr(V.graph.nodes).map((n,$index)=>(<React.Fragment key={$index}><span onClick={n.onClick} style={n.dotStyle}></span></React.Fragment>))}
                    {arr(V.graph.nodes).map((n,$index)=>(<React.Fragment key={$index}><span style={n.labelStyle}>{n.label}</span></React.Fragment>))}
                  </div>
    )
  }

  /**
   * 시간대 전환 띠 — 현장 화면과 **탭-확대 오버레이**가 같이 쓴다.
   *
   * ★ **교훈은 상황판보다 오래 산다** ★ 원래 둘째 자리는 상황판 바닥이었고,
   * 처음 거기에 도면만 옮기고 이 띠를 빼먹었더니 **판 위 평면도가 현장에서
   * 마지막에 고른 시간대로 굳어 있었다** (사용자가 「시간이 왜 안 따라오지」로
   * 잡았다, 2026-07-26). 상황판은 2026-08-05에 빠졌지만 **같은 함정이 확대
   * 오버레이에 그대로 있어서** 거기서도 이 띠를 같이 렌더한다.
   *
   * `mapTime` 은 순수 화면 상태라 확대하고 시간대를 바꿔도 예산이 안 깎이고
   * 아무것도 공개되지 않는다.
   *
   * ⚠ 인자 이름 `V` 는 규약이다. `renderPlanFigure` 머리 주석 참조.
   */
  renderPlanTimes(V) {
    return (
                  <div className="segmented" style={S("margin-bottom:16px")}>{arr(V.floor.times).map((tm,$index)=>(<React.Fragment key={$index}><div onClick={tm.onClick} style={tm.style}>{tm.label}</div></React.Fragment>))}</div>
    )
  }

  render() {
    const V = this.renderVals();
    return (
      <>

        <div className="app" data-surface="vector">
          {(V.shell.showLeft)?(<>
            <div className="sidebar">
              <div className="ws-row">
                <div className="ws-switch">
                  <span className="ws-name">{V.ui.caseTitle}</span>
                </div>
                <span style={S("flex:1")}></span>
                <button className="iconbtn" onClick={V.shell.onToggleLeft} title={V.ui.toggleLeft}><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" /><line x1="7" y1="3.6" x2="7" y2="14.4" stroke="currentColor" strokeWidth="1.6" /><rect x="2.8" y="3.8" width="4" height="10.4" rx="2.4" fill="currentColor" opacity="0.18" /></svg></button>
              </div>
              <div className="nav">
                <div className="nav-item" {...press(V.onGoHome, null, V.ui.goHome)}><svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 7l5-4 5 4v6H3z" /></svg><span>{V.ui.goHome}</span></div>
                <div className="nav-caption">{V.ui.navCase}</div>
                <div className={V.nav.overviewCls} {...press(V.nav.onOverview, V.nav.overviewCls, V.ui.navOverview)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="5.5" /><path d="M8 7.2v3.2M8 5.4v.1" /></svg>
                  <span>{V.ui.navOverview}</span>{(V.nav.overviewUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}
                </div>
                <div className={V.nav.narrCls} {...press(V.nav.onNarr, V.nav.narrCls, V.ui.navNarrative)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 10.5h4" /></svg>
                  <span>{V.ui.navNarrative}</span>{(V.nav.narrUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}<span className="count">{V.nav.narrProgress}</span>
                </div>
                <div className="nav-caption" style={S("margin-top:6px")}>{V.ui.navClue}</div>
                <div className={V.nav.stmtCls} {...press(V.nav.onStmt, V.nav.stmtCls, V.ui.navStatements)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M6.5 6.5V13M10 6.5V13" /></svg>
                  <span>{V.ui.navStatements}</span>{(V.nav.stmtUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}
                </div>
                <div className={V.nav.profileCls} {...press(V.nav.onProfile, V.nav.profileCls, V.ui.navProfile)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="5.5" r="2.5" /><path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /></svg>
                  <span>{V.ui.navProfile}</span>
                </div>
                <div className={V.nav.mapCls} {...press(V.nav.onMap, V.nav.mapCls, V.ui.navMap)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 4.5L6 3l4 1.5L13.5 3v9L10 13.5 6 12 2.5 13.5z" /><path d="M6 3v9M10 4.5v9" /></svg>
                  <span>{V.ui.navMap}</span>{(V.nav.mapUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}
                </div>
                <div className={V.nav.graphCls} {...press(V.nav.onGraph, V.nav.graphCls, V.ui.navGraph)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="4" cy="5" r="2" /><circle cx="12" cy="4" r="1.6" /><circle cx="11" cy="12" r="2" /><path d="M5.7 6.3l4 4.3M5.7 4.6l4.8-.4" /></svg>
                  <span>{V.ui.navGraph}</span>
                </div>
                <div className="nav-caption" style={S("margin-top:6px")}>{V.ui.navTool}</div>
                <div className={V.nav.logCls} {...press(V.nav.onLog, V.nav.logCls, V.ui.invLogTitle)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></svg>
                  <span>{V.ui.invLogTitle}</span><span className="count">{V.nav.logBadge}</span>
                </div>
                <div className={V.nav.memoCls} {...press(V.nav.onMemo, V.nav.memoCls, V.ui.navMemo)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 2.5h10v11H3z" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" /></svg>
                  <span>{V.ui.navMemo}</span><span className="count">{V.nav.memoBadge}</span>
                </div>
                <div className={V.nav.refCls} {...press(V.nav.onRef, V.nav.refCls, V.ui.navReference)}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="2.5" width="11" height="4" rx="1" /><rect x="2.5" y="9.5" width="11" height="4" rx="1" /></svg>
                  <span>{V.ui.navReference}</span>
                </div>
              </div>
              <div style={S("margin-top:auto;padding:12px 8px 4px;border-top:1px solid var(--border)")}>
                <div style={S("display:flex;align-items:center;gap:8px")}>
                  <span className="pr-badge" style={S("background:var(--accent-soft);color:var(--accent)")}>{V.status.diff}</span>
                  <span className="v-meta">{V.ui.budget} · <b className="v-num" style={S("color:var(--fg-2)")}>{V.status.budget}</b></span>
                </div>
                <div className="v-micro" style={S("margin-top:10px;line-height:1.55;color:var(--fg-4)")}>{V.ui.sidebarNote}</div>
                <div className="linklike" {...press(V.onAbandonReq, null, V.ui.abandon)} style={S("margin-top:10px;padding-left:0;color:var(--label-red);font-size:12px")}>{V.ui.abandon}</div>
              </div>
            </div>
          </>):null}

          <div className="main" style={S("position:relative")}>
            {(V.isNarrow)?(<>
              <div className="tabbar" style={S("justify-content:space-between;padding:0 10px;gap:8px")}>
                <div style={S("display:flex;align-items:center;gap:4px;min-width:0")}>
                  <button className="iconbtn" onClick={V.shell.onBack} title={V.ui.navBack} style={S(`${V.shell.backStyle};flex:none`)}><svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg></button>
                  <span className="v-ui" style={S("color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{V.ui.viewTitle}</span>
                </div>
                <div style={S("display:flex;align-items:center;gap:4px;flex:none")}>
                  <span className="v-num" style={S("font-size:12px;color:var(--fg-3);margin-right:2px;white-space:nowrap")}>{V.status.budget}</span>
                  <button className="iconbtn" onClick={V.shell.onToggleRight} title={V.ui.crossRef} style={V.shell.rightStyle}><svg width="15" height="15" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" /><line x1="11" y1="3.6" x2="11" y2="14.4" stroke="currentColor" strokeWidth="1.6" /></svg></button>
                  <span className="g-settings" style={S("position:relative")}><button className="iconbtn" onClick={V.shell.onSettings} title={V.ui.settings}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg></button>
                  {(V.shell.settingsOpen)?(<><div className="panel" style={S("position:absolute;right:0;top:36px;width:220px;z-index:60")}><div className="panel-caption">{V.ui.language}</div><div className="seg-toggle"><span className={V.langSeg.stKo} onClick={V.langSeg.onKo}>한국어</span><span className={V.langSeg.stEn} onClick={V.langSeg.onEn}>EN</span></div><div className="panel-sep"></div><div className="panel-caption">{V.ui.themeLabel}</div><div className="seg-toggle"><span className={V.themeSeg.stDark} onClick={V.themeSeg.onDark}>{V.ui.themeDark}</span><span className={V.themeSeg.stLight} onClick={V.themeSeg.onLight}>{V.ui.themeLight}</span></div><div className="panel-sep"></div><div className="v-menu-item" onClick={V.onGoHome}>{V.ui.goHome}</div><div className="v-menu-item" onClick={V.onAbandonReq} style={S("color:var(--label-red)")}>{V.ui.abandon}</div></div></>):null}</span>
                </div>
              </div>
            </>):null}

            <div className="viewheader">
              {(V.isWide)?(<><span style={S("display:inline-flex;align-items:center;gap:2px;margin-right:8px")}>{(V.shell.leftClosed)?(<><button className="iconbtn" onClick={V.shell.onToggleLeft} title={V.ui.toggleLeft}><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" /><line x1="7" y1="3.6" x2="7" y2="14.4" stroke="currentColor" strokeWidth="1.6" /><rect x="2.8" y="3.8" width="4" height="10.4" rx="2.4" fill="currentColor" opacity="0.18" /></svg></button></>):null}<button className="iconbtn" onClick={V.shell.onBack} title={V.ui.navBack} style={V.shell.backStyle}><svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg></button><button className="iconbtn" onClick={V.shell.onFwd} title={V.ui.navFwd} style={V.shell.fwdStyle}><svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3.5L10.5 8 6 12.5" /></svg></button></span></>):null}
              <div className="viewtitle"><h1>{V.ui.viewTitle}</h1><span className="v-meta" style={S("margin-left:6px;color:var(--fg-4)")}>{V.ui.viewSub}</span></div>
              <span className="spacer"></span>
              <span className="toolbar-icons g-settings" style={S("position:relative")}>
                {(V.isWide)?(<><button className="iconbtn" onClick={V.shell.onToggleRight} title={V.ui.crossRef} style={V.shell.rightStyle}><svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" /><line x1="11" y1="3.6" x2="11" y2="14.4" stroke="currentColor" strokeWidth="1.6" /><rect x="11.2" y="3.8" width="4" height="10.4" rx="2.4" fill="currentColor" opacity="0.18" /></svg></button></>):null}
                <button className="iconbtn" onClick={V.shell.onSettings} title={V.ui.settings}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg></button>
                {(V.shell.settingsOpen)?(<>
                  <div className="panel" style={S("position:absolute;right:0;top:36px;width:220px;z-index:60")}>
                    <div className="panel-caption">{V.ui.language}</div>
                    <div className="seg-toggle"><span className={V.langSeg.stKo} onClick={V.langSeg.onKo}>한국어</span><span className={V.langSeg.stEn} onClick={V.langSeg.onEn}>EN</span></div>
                    <div className="panel-sep"></div>
                    <div className="panel-caption">{V.ui.themeLabel}</div>
                    <div className="seg-toggle"><span className={V.themeSeg.stDark} onClick={V.themeSeg.onDark}>{V.ui.themeDark}</span><span className={V.themeSeg.stLight} onClick={V.themeSeg.onLight}>{V.ui.themeLight}</span></div>
                  </div>
                </>):null}
              </span>
            </div>

            <div style={S("flex:1;min-height:0;display:flex")}>
            <div className="content">
              
              {(V.isNarrative)?(<>
                <div style={V.narrLayoutStyle}>
                  <div style={S("flex:1;min-width:0;max-width:780px")}>
                    <div style={S("border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;margin-bottom:18px")}>
                      <div style={S("display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border);background:var(--bg-subtle)")}>
                        <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /></svg>
                        <span className="v-ui" style={S("color:var(--fg);letter-spacing:.02em")}>{V.ui.nTitle}</span>
                        <span className="v-num" style={S("color:var(--fg-4);font-size:12px")}>{V.reportHead.caseNo}</span>
                        <span style={S("flex:1")}></span>
                        <span style={V.reportHead.statusChipStyle}>{V.reportHead.statusLabel}</span>
                      </div>
                      <div style={S("display:flex;flex-wrap:wrap")}>
                        {arr(V.reportHead.fields).map((f,$index)=>(<React.Fragment key={$index}><div style={S("flex:1 1 33%;min-width:150px;padding:9px 16px;border-right:1px solid var(--border)")}><div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px")}>{f.k}</div><div className="v-meta" style={S("color:var(--fg-2)")}>{f.v}</div></div></React.Fragment>))}
                      </div>
                    </div>
                    {(V.finishCTA.show)?(<><div style={S("margin-bottom:16px")}><Button variant="primary" onClick={V.finishCTA.onFinish}>{V.ui.finishReport}</Button></div></>):null}
                    {(V.narrProse)?(<>
                    {arr(V.sections).map((sec,$index)=>(<React.Fragment key={$index}>
                      <div style={sec.cardStyle}>
                        {(sec.locked)?(<>
                          <div style={S("display:flex;align-items:center;gap:10px")}>
                            <span className="v-meta" style={S("color:var(--fg-4);font-variant-numeric:tabular-nums;min-width:30px")}>{sec.numLabel}</span>
                            <span className="v-meta" style={S("color:var(--fg-4)")}>{sec.lockedHint}</span>
                            <span style={S("flex:1")}></span>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.4"><rect x="3.5" y="7" width="9" height="6" rx="1"></rect><path d="M5.5 7V5a2.5 2.5 0 015 0v2"></path></svg>
                          </div>
                        </>):null}
                        {(sec.notLocked)?(<>
                          <div onClick={sec.onToggle} style={S(`display:flex;align-items:center;gap:10px;cursor:${sec.headerCursor}`)}>
                            {(sec.collapsed)?(<><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" style={S("flex:none")}><path d="M6 4l4 4-4 4"></path></svg></>):null}
                            {(sec.expanded)?(<><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" style={S("flex:none")}><path d="M4 6l4 4 4-4"></path></svg></>):null}
                            {(sec.showStatusIcon)?(<><StatusIcon status={sec.statusKey} size="16"></StatusIcon></>):null}
                            <span className="v-meta" style={S("color:var(--fg-4);font-variant-numeric:tabular-nums")}>{sec.numLabel}</span>
                            <span className="v-h3">{sec.title}</span>
                            <span style={S("flex:1")}></span>
                            {(sec.showCollapsedRight)?(<><span className="v-meta" style={S("color:var(--fg-4)")}>{sec.reopenStatusLabel}</span></>):null}
                            {(sec.showChip)?(<><span style={sec.stateChipStyle}>{sec.stateLabel}</span></>):null}
                          </div>
                          {(sec.showBody)?(<>
                            <div style={S("font-size:15px;line-height:2.25;color:var(--fg-2);margin:16px 0 0;text-wrap:pretty")}>
                              {arr(sec.parts).map((part,$index)=>(<React.Fragment key={$index}>
                                {(part.isText)?(<><span>{part.text}</span></>):null}
                                {(part.isBlank)?(<><span className="g-blank-wrap" style={S("position:relative;display:inline-block;vertical-align:baseline")}>
                                  {(part.blank.isLocked)?(<><span style={part.blank.lockStyle}>{part.blank.disp}</span></>):null}
                                  {(part.blank.isFilled)?(<><span className="g-blank-trigger" onClick={part.blank.onOpen} style={part.blank.fillStyle}>{part.blank.disp}</span></>):null}
                                  {(part.blank.isEmpty)?(<><span className="g-blank-trigger" onClick={part.blank.onOpen} style={part.blank.emptyStyle}>{part.blank.hint}</span></>):null}
                                  {(part.blank.pickerOpen)?(<><div className="v-menu g-picker" style={S("position:absolute;left:0;top:calc(100% + 4px);z-index:41;min-width:170px;max-height:260px;overflow:auto")}>
                                    <div className="v-caption" style={S("padding:4px 8px 6px;color:var(--fg-4)")}>{part.blank.pickHead}</div>
                                    {arr(part.blank.options).map((opt,$index)=>(<React.Fragment key={$index}><div className="v-menu-item" onClick={opt.onPick}>{opt.label}</div></React.Fragment>))}
                                    {(part.blank.optionsEmpty)?(<><div className="v-meta" style={S("padding:8px;color:var(--fg-4);line-height:1.5")}>{V.ui.bankEmpty}</div></>):null}
                                    {(part.blank.canClear)?(<><div className="v-menu-item" onClick={part.blank.onClear} style={S("color:var(--fg-4);border-top:1px solid var(--border);margin-top:2px")}>{V.ui.clearBlank}</div></>):null}
                                  </div></>):null}
                                </span></>):null}
                              </React.Fragment>))}
                            </div>
                            {(sec.open)?(<>
                              <div style={S("display:flex;align-items:center;gap:8px;margin-top:16px;color:var(--fg-4)")}>
                                <span className="v-meta" style={S("font-variant-numeric:tabular-nums")}>{sec.progressLabel}</span>
                                <span className="v-meta">{V.ui.secFillHint}</span>
                              </div>
                            </>):null}
                            {(sec.showReopenBtn)?(<><div style={S("margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap")}><span className="linklike" onClick={sec.onReopen} style={S("display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--fg-2);border:1px solid var(--border-strong);border-radius:var(--r-sm);padding:5px 11px;cursor:pointer")}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 8a5 5 0 11-1.5-3.5M13 2v3h-3"></path></svg>{sec.reopenLabel}</span><span className="v-micro" style={S("color:var(--fg-4);line-height:1.5")}>{sec.reopenWarn}</span></div></>):null}
                            {(sec.showCloseReopen)?(<><div style={S("margin-top:16px")}><span className="linklike" onClick={sec.onCloseReopen} style={S("display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--accent);cursor:pointer")}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 8.5l3 3 6-7"></path></svg>{sec.closeReopenLabel}</span></div></>):null}
                          </>):null}
                        </>):null}
                      </div>
                    </React.Fragment>))}
                    </>):null}
                    {(V.narrList)?(<>
                    {arr(V.sections).map((sec,$index)=>(<React.Fragment key={$index}>
                      <div style={sec.cardStyle}>
                        <div style={S("display:flex;align-items:center;gap:10px")}>
                          <StatusIcon status={sec.statusKey} size="16"></StatusIcon>
                          <span className="v-meta" style={S("color:var(--fg-4);font-variant-numeric:tabular-nums")}>{sec.numLabel}</span>
                          <span className="v-h3">{sec.title}</span>
                          <span style={S("flex:1")}></span>
                          <span style={sec.stateChipStyle}>{sec.stateLabel}</span>
                        </div>
                        <div style={S("display:flex;flex-direction:column;gap:6px;margin-top:14px")}>
                          {arr(sec.listBlanks).map((lb,$index)=>(<React.Fragment key={$index}>
                            <div style={S("display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);position:relative")}>
                              <span className="v-title" style={S("color:var(--fg-2);flex:1;min-width:0")}>{lb.label}</span>
                              <span className="v-micro" style={S("color:var(--fg-4);flex:none")}>{lb.candType}</span>
                              {(lb.locked)?(<><span style={S("display:inline-flex;align-items:center;gap:4px;color:var(--g-lock-mark);font-weight:600;font-size:13px")}><span>✓</span>{lb.disp}</span></>):null}
                              {(lb.open)?(<><span className="g-blank-trigger" onClick={lb.onOpen} style={lb.triggerStyle}>{lb.triggerText}</span></>):null}
                              {(lb.unrevealed)?(<><span className="v-meta" style={S("color:var(--fg-4)")}>{V.ui.listUnrev}</span></>):null}
                              {(lb.pickerOpen)?(<><div className="v-menu g-picker" style={S("position:absolute;right:8px;top:calc(100% - 2px);z-index:41;min-width:150px;max-height:240px;overflow:auto")}><div className="v-caption" style={S("padding:4px 8px 6px;color:var(--fg-4)")}>{lb.pickHead}</div>{arr(lb.options).map((opt,$index)=>(<React.Fragment key={$index}><div className="v-menu-item" onClick={opt.onPick}>{opt.label}</div></React.Fragment>))}{(lb.optionsEmpty)?(<><div className="v-meta" style={S("padding:8px;color:var(--fg-4)")}>{V.ui.bankEmpty}</div></>):null}{(lb.canClear)?(<><div className="v-menu-item" onClick={lb.onClear} style={S("color:var(--fg-4);border-top:1px solid var(--border);margin-top:2px")}>{V.ui.clearBlank}</div></>):null}</div></>):null}
                            </div>
                          </React.Fragment>))}
                        </div>
                        {(sec.open)?(<>
                          <div style={S("display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--fg-4)")}>
                            <span className="v-meta" style={S("font-variant-numeric:tabular-nums")}>{sec.progressLabel}</span>
                            <span className="v-meta">{V.ui.secFillHint}</span>
                          </div>
                        </>):null}
                      </div>
                    </React.Fragment>))}
                    </>):null}
                  </div>

                  {(V.narrShowBank)?(<><div style={V.bankStyle}>
                    <div style={S("display:flex;align-items:center;gap:6px;margin-bottom:6px")}>
                      <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4"><rect x="2.5" y="4" width="11" height="8.5" rx="1.2" /><path d="M2.5 6.5h11" /></svg>
                      <span className="v-caption" style={S("color:var(--fg-2)")}>{V.ui.bankTitle}</span>
                    </div>
                    <div className="v-micro" style={S("margin-bottom:14px;line-height:1.55;color:var(--fg-4)")}>{V.ui.bankHint}</div>
                    {(V.bank.showEmpty)?(<><div style={S("border:1px dashed var(--border-strong);border-radius:var(--r-sm);padding:16px;color:var(--fg-4);font-size:12px;line-height:1.6;text-align:center")}>{V.ui.bankEmpty}</div></>):null}
                    <div style={S("display:flex;flex-wrap:wrap;gap:7px")}>
                      {arr(V.bank.words).map((w,$index)=>(<React.Fragment key={$index}><span className="g-word" onClick={w.onOpen} style={w.style}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={S("flex:none;opacity:.7")}><path d={w.iconPath}></path></svg>{w.label}</span></React.Fragment>))}
                    </div>
                  </div></>):null}
                </div>
              </>):null}

              
              {(V.showOriginal)?(<>
                <div style={S("display:flex;gap:20px;padding:8px 24px 40px;max-width:1000px;margin:0 auto;align-items:flex-start")}>
                  <div style={S("width:172px;flex:none;position:sticky;top:8px;display:flex;flex-direction:column;gap:2px")}>
                    <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.05em;padding:2px 8px 8px")}>{V.ui.navStatements} · {V.ui.tapExpand}</div>
                    {arr(V.statements).map((st,$index)=>(<React.Fragment key={$index}><div onClick={st.onToggle} style={st.railRowStyle}>
                      <span style={S(`width:3px;align-self:stretch;background:${st.color};border-radius:2px;flex:none`)}></span>
                      <div style={S("flex:1;min-width:0")}><div style={S(`font-size:14.5px;font-weight:600;color:${st.railNameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{st.name}</div><div style={S("font-size:12px;color:var(--fg-4);margin-top:2px")}>{st.relation}</div></div>
                      {(st.expanded)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none")}></span></>):null}
                    </div></React.Fragment>))}
                    <div className="v-micro" style={S("color:var(--fg-4);margin-top:12px;padding:0 8px;display:flex;align-items:center;gap:6px;line-height:1.5")}><svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={S("flex:none")}><path d="M2.5 5h7M2.5 8h11M2.5 11h9" /></svg>{V.ui.selectHint}</div>
                  </div>
                  <div style={S("flex:1;min-width:0")}>
                    {arr(V.statements).map((st,$index)=>(<React.Fragment key={$index}><div style={S("border-top:1px solid var(--border)")}>
                      <div onClick={st.onToggle} style={S("display:flex;align-items:center;gap:13px;padding:15px 4px;cursor:pointer")}>
                        <span style={S(`width:3px;height:34px;background:${st.color};border-radius:2px;flex:none`)}></span>
                        <span style={st.avStyle}>{st.ini}</span>
                        <div style={S("display:flex;flex-direction:column;gap:3px;min-width:150px;flex:none")}><span style={S("font-size:15px;font-weight:600;color:var(--fg)")}>{st.name}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{st.sexAge} · {st.job}</span></div>
                        <span style={st.relStyle}>{st.relation}</span>
                        {(st.collapsed)?(<><span className="v-meta" style={S("color:var(--fg-4);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{st.preview}</span></>):null}
                        <span style={S("flex:1")}></span>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" style={S(`flex:none;transform:${st.chevronRot}`)}><path d="M5 6.5L8 9.5l3-3" /></svg>
                      </div>
                      {(st.expanded)?(<><div style={S("padding:0 4px 22px 42px;max-width:52ch")}>
                        {arr(st.paras).map((para,$index)=>(<React.Fragment key={$index}><div style={S("position:relative")}>
                          <p className="g-stmt-para" onMouseUp={para.onSelect} style={S("margin:0 0 1.4em;font-size:16px;line-height:1.85;color:var(--fg-2);text-wrap:pretty;cursor:text")}>{arr(para.segs).map((seg,$index)=>(<React.Fragment key={$index}><span style={seg.style}>{seg.text}</span></React.Fragment>))}</p>
                          {(para.showTb)?(<><span className="g-seltoolbar" style={para.tbStyle}><span style={S("display:inline-flex;align-items:center;gap:2px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--r-md);box-shadow:var(--shadow-popover);padding:4px;white-space:nowrap")}>
                            <span onClick={V.selTb.onFlag} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--accent)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--accent)")}></span>{V.ui.markFlag}</span>
                            <span onClick={V.selTb.onConfirm} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--g-confirm)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--g-confirm)")}></span>{V.ui.markConfirm}</span>
                            <span onClick={V.selTb.onSuspect} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--g-suspect)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--g-suspect)")}></span>{V.ui.markSuspect}</span>
                            <span onClick={V.selTb.onContradict} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--g-contradict)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--g-contradict)")}></span>{V.ui.markContradict}</span>
                            <span onClick={V.selTb.onClear} title={V.ui.markClear} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-4);font-size:12px")}>✕</span>
                            <span style={S("width:1px;height:18px;background:var(--border-strong);margin:0 2px")}></span>
                            <span onClick={V.selTb.onQuote} title={V.ui.quoteMemo} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5" /></svg></span>
                            <span onClick={V.selTb.onCopy} title={V.ui.copyText} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M3 10V3h7" /></svg></span>
                          </span></span></>):null}
                        </div></React.Fragment>))}
                        {arr(st.added).map((ad,$index)=>(<React.Fragment key={$index}><div style={S("margin-top:6px;padding:12px 14px;border-left:2px solid var(--accent);background:var(--accent-soft);border-radius:0 var(--r-sm) var(--r-sm) 0;position:relative")}>
                          <div style={S("display:flex;align-items:center;gap:6px;margin-bottom:5px")}><span style={S("font-size:9px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em")}>{V.ui.addedStmt}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{ad.secNum}{V.ui.navCase} {ad.secTitle} · {V.ui.revealedBy}</span></div>
                          <p className="g-stmt-para" onMouseUp={ad.onSelect} style={S("margin:0;font-size:16px;line-height:1.85;color:var(--fg-2);text-wrap:pretty;cursor:text")}>{ad.text}</p>
                          {(ad.showTb)?(<><span className="g-seltoolbar" style={ad.tbStyle}><span style={S("display:inline-flex;align-items:center;gap:2px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--r-sm);padding:3px;box-shadow:var(--shadow-popover)")}>
                            <span onClick={V.selTb.onFlag} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--accent)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--accent)")}></span>{V.ui.markFlag}</span>
                            <span onClick={V.selTb.onConfirm} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--g-confirm)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--g-confirm)")}></span>{V.ui.markConfirm}</span>
                            <span onClick={V.selTb.onSuspect} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--g-suspect)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--g-suspect)")}></span>{V.ui.markSuspect}</span>
                            <span onClick={V.selTb.onContradict} style={S("display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:var(--r-sm);cursor:pointer;font:600 12px var(--font-sans);color:var(--g-contradict)")}><span style={S("width:9px;height:9px;border-radius:3px;background:var(--g-contradict)")}></span>{V.ui.markContradict}</span>
                            <span onClick={V.selTb.onClear} title={V.ui.markClear} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-4);font-size:12px")}>✕</span>
                            <span style={S("width:1px;height:18px;background:var(--border-strong);margin:0 2px")}></span>
                            <span onClick={V.selTb.onQuote} title={V.ui.quoteMemo} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5" /></svg></span>
                            <span onClick={V.selTb.onCopy} title={V.ui.copyText} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M3 10V3h7" /></svg></span>
                          </span></span></>):null}
                        </div></React.Fragment>))}
                      </div></>):null}
                    </div></React.Fragment>))}
                  </div>
                </div>
              </>):null}

              
              {(V.isMemo)?(<>
                <div style={S("padding:18px 20px;max-width:960px;margin:0 auto")}>
                  <div style={S("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px")}>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>{arr(V.memo.filters).map((fl,$index)=>(<React.Fragment key={$index}><span onClick={fl.onClick} style={fl.style}>{fl.label}</span></React.Fragment>))}</div>
                    <span style={S("flex:1")}></span>
                    <div style={S("display:flex;gap:6px")}>{arr(V.memo.sortOpts).map((so,$index)=>(<React.Fragment key={$index}><span onClick={so.onClick} style={so.style}>{so.label}</span></React.Fragment>))}</div>
                    <Button variant="ghost" onClick={V.memo.onNew}>＋ {V.ui.memoNew}</Button>
                  </div>
                  <div style={S("position:relative;margin-bottom:14px")}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.4" style={S("position:absolute;left:11px;top:50%;transform:translateY(-50%)")}><circle cx="7" cy="7" r="4.5"></circle><path d="M10.5 10.5l3 3"></path></svg>
                    <input value={V.memo.query} onInput={V.memo.onQuery} placeholder={V.ui.memoSearchPh} style={S("width:100%;box-sizing:border-box;height:34px;padding:0 12px 0 33px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--fg);font:400 13px var(--font-sans);outline:none")} />
                  </div>
                  {(V.memo.searchEmpty)?(<><div style={S("border:1px dashed var(--border-strong);border-radius:var(--r-md);padding:26px;text-align:center;color:var(--fg-4);font-size:12px")}>{V.ui.memoSearchEmpty}</div></>):null}
                  {(V.memo.empty)?(<><div style={S("border:1px dashed var(--border-strong);border-radius:var(--r-md);padding:26px;text-align:center;color:var(--fg-4);font-size:12px;line-height:1.6")}>{V.ui.memoEmpty}</div></>):null}
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;align-items:start")}>
                    {arr(V.memo.rows).map((mo,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;position:relative")}>
                      <div style={S(`position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:var(--r-md) 0 0 var(--r-md);background:${mo.accent}`)}></div>
                      <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:8px")}><span className="v-num" style={S("color:var(--fg-4);font-size:12px;font-weight:600")}>{mo.numLabel}</span>{(mo.hasLayer)?(<><span style={mo.layerStyle}>{mo.layerLabel}</span></>):null}<span style={S("flex:1")}></span>{(mo.readMode)?(<><span className="linklike" onClick={mo.onEdit} style={S("color:var(--fg-3);font-size:12px;display:inline-flex;align-items:center;gap:4px")}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" /><path d="M9.4 3.4l2.4 2.4" /></svg>{V.ui.memoEdit}</span></>):null}{(mo.editing)?(<><span className="linklike" onClick={mo.onPin} style={mo.pinStyle}><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v6 M5 5l3-3 3 3 M4 13h8" /></svg>{mo.pinLabel}</span><span className="linklike" onClick={mo.onLock} style={S("color:var(--accent);font-size:12px;display:inline-flex;align-items:center;gap:4px")}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 8.5l3 3 6-7" /></svg>{V.ui.memoDone}</span><span className="linklike" onClick={mo.onDel} style={S("color:var(--label-red);font-size:12px;margin-left:6px")}>{V.ui.memoDelete}</span></>):null}</div>
                      {(mo.hasQuote)?(<><div style={S("display:flex;gap:8px;margin-bottom:10px")}><span style={S("color:var(--fg-4);font-size:18px;line-height:1")}>“</span><div style={S("min-width:0")}><div className="v-meta" style={S("color:var(--fg-2);font-style:italic;line-height:1.6")}>{mo.quote}</div>{(mo.quoteWho)?(<><div className="v-micro" style={S("color:var(--fg-4);margin-top:3px")}>— {mo.quoteWho} · {V.ui.quotedFrom}</div></>):null}</div></div></>):null}
                      {(mo.editing)?(<>
                        <textarea value={mo.content} onChange={mo.onContent} placeholder={V.ui.memoPh2} style={S("width:100%;min-height:46px;resize:vertical;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 10px;color:var(--fg);font:400 13px var(--font-sans);outline:none;box-sizing:border-box")}></textarea>
                        <div style={S("display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap")}>
                          <span className="v-micro" style={S("color:var(--fg-4);margin-right:2px")}>{V.ui.memoTarget}</span>
                          {arr(mo.targets).map((tg,$index)=>(<React.Fragment key={$index}><span onClick={tg.onClick} style={tg.style}>{tg.label}</span></React.Fragment>))}
                        </div>
                        {(mo.isPerson)?(<><div style={S("display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)")}>{arr(mo.personChips).map((pc,$index)=>(<React.Fragment key={$index}><span onClick={pc.onClick} style={pc.style}><span style={pc.dot}></span>{pc.label}</span></React.Fragment>))}</div></>):null}
                        {(mo.isStatement)?(<><div style={S("display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)")}>{arr(mo.stmtChips).map((pc,$index)=>(<React.Fragment key={$index}><span onClick={pc.onClick} style={pc.style}><span style={pc.dot}></span>{pc.label}</span></React.Fragment>))}</div></>):null}
                        {(mo.isEvidence)?(<><div style={S("display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)")}>{(mo.eviEmpty)?(<><span className="v-micro" style={S("color:var(--fg-4)")}>{V.ui.bankEmpty}</span></>):null}{arr(mo.eviChips).map((pc,$index)=>(<React.Fragment key={$index}><span onClick={pc.onClick} style={pc.style}><span style={pc.dot}></span>{pc.label}</span></React.Fragment>))}</div></>):null}
                      </>):null}
                      {(mo.readMode)?(<>
                        {(mo.hasContent)?(<><div className="v-body" style={S("color:var(--fg-2);line-height:1.6;white-space:pre-wrap")}>{mo.content}</div></>):null}
                        <div style={S("display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--fg-4);font-size:11px")}>{(mo.saved)?(<><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--g-confirm)" strokeWidth="1.6"><path d="M3.5 8.5l3 3 6-7" /></svg><span style={S("color:var(--g-confirm)")}>{mo.savedLabel}</span></>):null}{(mo.hasMeta)?(<><span>· {mo.metaText}</span></>):null}</div>
                      </>):null}
                    </div></React.Fragment>))}
                  </div>
                </div>
              </>):null}

              
              {(V.isResult)?(<>
                <div style={S("padding:var(--read-pad-y) var(--read-pad-x) 60px;max-width:var(--read-measure);margin:0 auto")}>
                  <div style={S("display:flex;align-items:center;gap:10px;margin-bottom:22px")}>
                    <span className="v-h1">{V.result.endTitle}</span>
                    {(V.result.stuck)?(<><span style={S("font-size:11px;font-weight:600;padding:2px 9px;border-radius:var(--r-pill);background:rgba(235,87,87,.14);color:var(--g-contradict)")}>{V.ui.difficulty}</span></>):null}
                  </div>
                  {(V.result.stuck)?(<><div className="v-body" style={S("color:var(--fg-3);margin-bottom:22px;line-height:1.7")}>{V.ui.resultStuck}</div></>):null}

                  {(V.result.anyWrong)?(<>
                    <div style={S("margin-bottom:22px")}>
                      <div className="v-micro" style={S("color:var(--g-contradict);text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px")}>{V.result.mineLabel}</div>
                      <div style={S("display:flex;flex-direction:column;gap:16px")}>
                        {arr(V.result.narrMine).map((sec,$index)=>(<React.Fragment key={$index}><p style={S("margin:0;font-size:var(--read-fs);line-height:1.9;color:var(--fg-3);text-wrap:pretty")}>{arr(sec.runs).map((r,$index)=>(<React.Fragment key={$index}>{(r.isText)?(<><span>{r.text}</span></>):null}{(r.isBlank)?(<><span style={r.style}>{r.disp}</span></>):null}</React.Fragment>))}</p></React.Fragment>))}
                      </div>
                    </div>
                    <div style={S("border-top:1px solid var(--border);padding-top:20px;margin-bottom:8px")}>
                      <div className="v-micro" style={S("color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px")}>{V.result.realLabel}</div>
                      <div style={S("display:flex;flex-direction:column;gap:16px")}>
                        {arr(V.result.narrReal).map((sec,$index)=>(<React.Fragment key={$index}><p style={S("margin:0;font-size:var(--read-fs);line-height:1.9;color:var(--fg-2);text-wrap:pretty")}>{arr(sec.runs).map((r,$index)=>(<React.Fragment key={$index}>{(r.isText)?(<><span>{r.text}</span></>):null}{(r.isBlank)?(<><span style={r.style}>{r.disp}</span></>):null}</React.Fragment>))}</p></React.Fragment>))}
                      </div>
                      <div style={S("margin-top:16px")}>
                        <div onClick={V.result.onToggleFold} style={S("display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none")}>
                          <span style={S("color:var(--fg-4);font-size:11px")}>{V.result.foldChevron}</span>
                          <span className="v-micro" style={S("color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em")}>{V.result.foldLabel}</span>
                        </div>
                        {(V.result.foldOpen)?(<><div style={S("display:flex;flex-direction:column;gap:7px;margin-top:12px")}>
                          {arr(V.result.corrections).map((c,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:center;gap:10px;font-size:13px")}>
                            <span className="v-micro" style={S("color:var(--fg-4);width:70px;flex:none")}>{c.label}</span>
                            <span style={S("font-weight:600;color:var(--g-contradict);text-decoration:line-through;text-decoration-color:var(--g-contradict)")}>{c.mine}</span>
                            <span style={S("color:var(--fg-4)")}>→</span>
                            <span style={S("font-weight:600;color:var(--accent)")}>{c.right}</span>
                          </div></React.Fragment>))}
                        </div></>):null}
                      </div>
                    </div>
                  </>):null}
                  {(V.result.allCorrect)?(<>
                    <div style={S("display:flex;flex-direction:column;gap:20px;margin-bottom:34px")}>
                      {arr(V.result.narrReal).map((sec,$index)=>(<React.Fragment key={$index}><p style={S("margin:0;font-size:var(--read-fs);line-height:1.9;color:var(--fg-2);text-wrap:pretty")}>{arr(sec.runs).map((r,$index)=>(<React.Fragment key={$index}>{(r.isText)?(<><span>{r.text}</span></>):null}{(r.isBlank)?(<><span style={r.style}>{r.disp}</span></>):null}</React.Fragment>))}</p></React.Fragment>))}
                    </div>
                  </>):null}

                  <div style={S("border-top:1px solid var(--border);padding-top:22px")}>
                    <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:16px")}><span className="v-ui" style={S("color:var(--fg);flex:1")}>{V.result.nomLabel}</span><span style={V.result.nomStyle}>{V.result.nomResult}</span></div>
                    <div style={S("display:flex;flex-direction:column;gap:10px;margin-bottom:20px")}>
                      {arr(V.result.catScores).map((c,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:center;gap:12px")}>
                        <span className="v-meta" style={S("color:var(--fg-3);width:44px;flex:none")}>{c.label}</span>
                        <span style={S("flex:1;height:6px;background:var(--bg-elevated-2);border-radius:3px;overflow:hidden")}><span style={c.barStyle}></span></span>
                        <span className="v-num" style={S("color:var(--fg-2);width:44px;flex:none;text-align:right;font-variant-numeric:tabular-nums")}>{c.correct}/{c.total}</span>
                      </div></React.Fragment>))}
                    </div>
                    <div style={S("display:flex;gap:10px;margin-bottom:22px")}>
                      {arr(V.result.metrics).map((m,$index)=>(<React.Fragment key={$index}><div style={S("flex:1;border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px")}><div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px")}>{m.k}</div><div className="v-num" style={S("font-size:18px;font-weight:600;color:var(--fg)")}>{m.v}</div></div></React.Fragment>))}
                    </div>
                    <Button variant="ghost" onClick={V.result.onHome}>{V.ui.backHome}</Button>
                  </div>
                </div>
              </>):null}

              
              {(V.isMap)?(<>
                <div style={S("padding:18px 24px;max-width:1100px")}>
                  <div className="segmented" style={S("margin-bottom:16px")}><div onClick={V.onMapPlan} style={V.mapPlanStyle}>{V.ui.mapModePlan}</div><div onClick={V.onMapGrid} style={V.mapGridStyle}>{V.ui.mapModeGrid}</div></div>
                  {(V.mapPlanMode)?(<>
                  {this.renderPlanTimes(V)}
                  {(V.plan.tapToZoom)?(<>
                    <div onClick={V.plan.onOpen} style={V.plan.previewStyle} {...press(V.plan.onOpen, null, V.ui.planTapHint)}>
                      {this.renderPlanFigure(V)}
                    </div>
                    <div className="v-micro" style={S("color:var(--fg-4);margin-top:6px;display:flex;align-items:center;gap:5px")}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={S("flex:none")}><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2L13.5 13.5M5.4 7h3.2M7 5.4v3.2" /></svg>
                      {V.ui.planTapHint}
                    </div>
                  </>):(<>{this.renderPlanFigure(V)}</>)}
                  <div style={S("display:flex;flex-wrap:wrap;gap:12px;margin-top:12px")}>
                    {arr(V.floor.dotLegend).map((lg,$index)=>(<React.Fragment key={$index}><span style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg-3)")}><span style={S(`width:10px;height:10px;border-radius:50%;background:${lg.color}`)}></span>{lg.name}</span></React.Fragment>))}
                    {(V.floor.hasClueMarks)?(<><span style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg-3)")}><span style={S("width:10px;height:10px;border-radius:3px;background:var(--accent)")}></span>{V.floor.clueLegend}</span></>):null}
                  </div>
                  <div className="v-meta" style={S("color:var(--fg-4);margin:8px 0 0;line-height:1.5")}>{V.floor.scrubHint}</div>
                  </>):null}

                  {(V.mapGridMode)?(<>
                  <div style={S("margin-top:2px")}>
                    <div style={S("display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px")}>
                      <span className="v-caption" style={S("color:var(--fg-2)")}>{V.ui.gridTitle}</span>
                      <div style={S("display:flex;align-items:center;gap:14px")}>
                        <span style={S("display:inline-flex;align-items:center;gap:6px")} className="v-meta"><span style={S("width:10px;height:10px;border-radius:3px;background:var(--g-confirm)")}></span>{V.ui.markConfirm}</span>
                        <span style={S("display:inline-flex;align-items:center;gap:6px")} className="v-meta"><span style={S("width:10px;height:10px;border-radius:3px;background:var(--g-suspect)")}></span>{V.ui.markSuspect}</span>
                        <span style={S("display:inline-flex;align-items:center;gap:6px")} className="v-meta"><span style={S("width:10px;height:10px;border-radius:3px;background:var(--g-contradict)")}></span>{V.ui.markContradict}</span>
                      </div>
                      <span className="v-meta" style={S("color:var(--fg-4)")}>{V.ui.gridHint}</span>
                    </div>
                    {this.renderClaimGridFigure(V)}
                  </div>
                  </>):null}
                  {(V.mapPlanMode)?(<>{(V.floor.hasNarr)?(<><div style={S("margin-top:22px")}>
                    <div className="v-caption" style={S("color:var(--fg-2);margin-bottom:12px;display:block")}>{V.floor.narrTitle}</div>
                    <div style={S("display:flex;flex-direction:column;gap:12px")}>
                      {arr(V.floor.narrations).map((n,$index)=>(<React.Fragment key={$index}><div style={S("position:relative;border:1px solid var(--border);border-radius:var(--r-md);padding:13px 16px 13px 18px")}>
                        <div style={S(`position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:var(--r-md) 0 0 var(--r-md);background:${n.barColor}`)}></div>
                        <div style={S("display:flex;align-items:baseline;gap:8px;margin-bottom:5px")}><span className="v-ui" style={S("color:var(--fg)")}>{n.title}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{n.locName}</span></div>
                        <div style={S("font-size:16px;line-height:1.7;color:var(--fg-2);text-wrap:pretty")}>{n.desc}</div>
                      </div></React.Fragment>))}
                    </div>
                  </div></>):null}</>):null}
                </div>
              </>):null}

              
              {(V.isLog)?(<>
                <div style={S("padding:18px 24px;max-width:720px;margin:0 auto")}>
                  {(V.logView.emptyLog)?(<><div style={S("border:1px dashed var(--border-strong);border-radius:var(--r-md);padding:26px;text-align:center;color:var(--fg-4);font-size:12px;line-height:1.6")}>{V.ui.invEmptyLog}</div></>):null}
                  <div style={S("display:flex;flex-direction:column;gap:10px")}>
                    {arr(V.logView.log).map((e,$index)=>(<React.Fragment key={$index}><div onClick={e.onOpen} style={e.cardStyle}>
                      <div style={e.barStyle}></div>
                      <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:6px")}><span style={e.badgeStyle}>{e.typeLabel}</span>{(e.isEmpty)?(<><span className="v-micro" style={S("color:var(--fg-4)")}>{e.emptyTag}</span></>):null}<span style={S("flex:1")}></span>{(e.hasTerm)?(<><span className="v-micro" style={S("color:var(--fg-4);display:inline-flex;align-items:center;gap:3px")}><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 4l4 4-4 4"></path></svg>{V.ui.termFound}</span></>):null}<span className="v-micro" style={S("color:var(--fg-4)")}>{e.actionLabel}{(e.hasTarget)?(<> · {e.targetLabel}</>):null}</span></div>
                      <div className="v-title" style={S("color:var(--fg);margin-bottom:3px")}>{e.title}</div>
                      <div style={S("font-size:14px;line-height:1.8;color:var(--fg-2);text-wrap:pretty")}>{e.desc}</div>
                    </div></React.Fragment>))}
                  </div>
                </div>
              </>):null}

              
              {(V.isGraph)?(<>
                <div style={S("padding:18px 24px;max-width:1100px")}>
                  {this.renderGraphFigure(V)}
                  <div style={S("display:flex;flex-wrap:wrap;gap:14px;margin-top:12px")}>
                    <span style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg-3)")}><span style={S("width:10px;height:10px;border-radius:50%;background:var(--fg-2);box-shadow:0 0 0 2px var(--border-strong)")}></span>{V.graph.legendPerson}</span>
                    <span style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg-3)")}><span style={S("width:10px;height:10px;border-radius:3px;background:var(--accent)")}></span>{V.graph.legendEvidence}</span>
                    <span style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg-3)")}><span style={S("width:10px;height:10px;border-radius:3px;background:var(--g-contradict)")}></span>{V.graph.legendSecret}</span>
                  </div>
                  <div className="v-meta" style={S("color:var(--fg-4);margin-top:10px;line-height:1.6")}>{V.graph.hint}</div>
                  {(V.graph.alibi.show)?(<><div style={S("margin-top:12px;display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border-strong);border-radius:var(--r-md);background:var(--bg-elevated)")}>
                    <span className="v-title" style={S("color:var(--fg)")}>{V.graph.alibi.names}</span>
                    <span style={S("flex:1")}></span>
                    {(V.graph.alibi.hint)?(<><span className="v-meta" style={S("color:var(--fg-4)")}>{V.graph.alibi.hint}</span></>):null}
                    <span className="linklike" onClick={V.graph.alibi.onClear} style={S("color:var(--fg-3);font-size:12px")}>{V.ui.cancel}</span>
                    <button onClick={V.graph.alibi.onRun} style={V.graph.alibi.runStyle}>{V.ui.actAlibi}</button>
                  </div></>):null}
                </div>
              </>):null}

              
              {(V.isReference)?(<>
                <div style={S("padding:22px 24px;max-width:920px;margin:0 auto")}>
                  <div className="v-body" style={S("color:var(--fg-3);margin-bottom:22px;line-height:1.6")}>{V.ui.refIntro}</div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:8px 0 12px;display:block")}>{V.ui.refBlanks}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:28px")}>
                    {arr(V.ref.blanks).map((rb,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:16px")}>
                      <div style={S("font-size:15px;line-height:2;color:var(--fg-2);margin-bottom:12px")}>{rb.pre}<span style={rb.style}>{(rb.check)?(<><span style={S("color:var(--g-lock-mark);font-weight:700")}>✓</span></>):null}{rb.word}</span>{rb.post}</div>
                      <div className="v-ui" style={S("color:var(--fg)")}>{rb.title}</div>
                      <div className="v-meta" style={S("color:var(--fg-4);margin-top:3px;line-height:1.5")}>{rb.desc}</div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:8px 0 12px;display:block")}>{V.ui.refSections}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:28px")}>
                    {arr(V.ref.sections).map((rs,$index)=>(<React.Fragment key={$index}><div style={rs.card}>
                      <div style={S("display:flex;align-items:center;gap:9px;margin-bottom:10px")}>
                        <StatusIcon status={rs.statusKey} size="16"></StatusIcon>
                        <span className="v-ui" style={S("color:var(--fg)")}>{rs.title}</span>
                        <span className="spacer" style={S("flex:1")}></span>
                        <span style={rs.chip}>{rs.chipLabel}</span>
                      </div>
                      <div className="v-meta" style={S("color:var(--fg-4);line-height:1.55")}>{rs.desc}</div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:8px 0 12px;display:block")}>{V.ui.refMarks}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px")}>
                    {arr(V.ref.marks).map((rm,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:0;overflow:hidden")}>
                      <div style={rm.cell}><span style={rm.iconStyle}>{rm.icon}</span><span style={S("color:var(--fg-2);font-size:13px")}>{rm.sample}</span>{(rm.auto)?(<><span style={S("font-size:9px;font-weight:700;color:var(--g-contradict);border:1px solid var(--g-contradict);border-radius:3px;padding:0 3px;margin-left:auto")}>{V.ui.autoTag}</span></>):null}</div>
                      <div style={S("padding:10px 12px")}><div className="v-ui" style={S("color:var(--fg)")}>{rm.title}</div><div className="v-meta" style={S("color:var(--fg-4);margin-top:2px;line-height:1.5")}>{rm.desc}</div></div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:22px 0 12px;display:block")}>{V.ui.refAnn}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px")}>
                    {arr(V.ref.annotations).map((an,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px")}>
                      <div style={S("font-size:14px;line-height:1.7;color:var(--fg-2);margin-bottom:10px")}><span style={an.sampleStyle}>{an.sample}</span></div>
                      <div className="v-ui" style={S("color:var(--fg)")}>{an.title}</div><div className="v-meta" style={S("color:var(--fg-4);margin-top:2px;line-height:1.5")}>{an.desc}</div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:22px 0 12px;display:block")}>{V.ui.refProfSlot}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px")}>
                    {arr(V.ref.profileSlots).map((ps,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px")}>
                      <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:10px")}>
                        <span className="v-meta" style={S("color:var(--fg-4);width:40px;flex:none")}>{V.ui.slotMotive}</span>
                        {(ps.filled)?(<><span className="v-meta" style={S("color:var(--fg-2);flex:1")}>{ps.text}</span><span style={S("font-size:9px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:0 5px")}>{V.ui.pNew}</span></>):null}
                        {(ps.empty)?(<><span style={S("flex:1;border-bottom:1.5px dashed var(--border-strong)")}></span><span className="v-micro" style={S("color:var(--fg-4)")}>{V.ui.pUnknown}</span></>):null}
                      </div>
                      <div className="v-ui" style={S("color:var(--fg)")}>{ps.title}</div><div className="v-meta" style={S("color:var(--fg-4);margin-top:2px;line-height:1.5")}>{ps.desc}</div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:22px 0 12px;display:block")}>{V.ui.refReveals}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px")}>
                    {arr(V.ref.reveals).map((rv,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;border-left:2px solid var(--accent)")}>
                      <div className="v-ui" style={S("color:var(--fg)")}>{rv.title}</div><div className="v-meta" style={S("color:var(--fg-4);margin-top:3px;line-height:1.5")}>{rv.desc}</div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:22px 0 12px;display:block")}>{V.ui.refNewStates}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px")}>
                    {arr(V.ref.newStates).map((ns,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px")}>
                      <div className="v-ui" style={S("color:var(--fg)")}>{ns.title}</div><div className="v-meta" style={S("color:var(--fg-4);margin-top:3px;line-height:1.5")}>{ns.desc}</div>
                    </div></React.Fragment>))}
                  </div>

                  <div className="v-caption" style={S("color:var(--fg-2);margin:22px 0 12px;display:block")}>{V.ui.refSounds}</div>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px")}>
                    {arr(V.ref.sounds).map((sd,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;display:flex;gap:10px;align-items:flex-start")}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4" style={S("flex:none;margin-top:1px")}><path d="M4 6H2v4h2l3 2.5v-9L4 6z" /><path d="M9.5 6a2.5 2.5 0 010 4M11.5 4a5 5 0 010 8" /></svg>
                      <div style={S("min-width:0")}><div className="v-ui" style={S("color:var(--fg)")}>{sd.title}</div><div className="v-meta" style={S("color:var(--fg-4);margin-top:2px;line-height:1.5")}>{sd.desc}</div></div>
                    </div></React.Fragment>))}
                  </div>
                </div>
              </>):null}
              
              {(V.isOverview)?(<>
                <div style={S("max-width:var(--read-measure);margin:0 auto;padding:var(--read-pad-y) var(--read-pad-x) 60px")}>
                  <div className="v-caption" style={S("color:var(--fg-4);letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px;display:block")}>{V.ui.caseTitle}</div>
                  <div style={S("position:relative")} onMouseUp={V.ovQuote.onSelect}>{arr(V.prologParas).map((pp,$index)=>(<React.Fragment key={$index}><p className="g-stmt-para" style={S("font-size:var(--read-fs);line-height:1.9;color:var(--fg-2);margin:0 0 18px;text-wrap:pretty;cursor:text")}>{pp.text}</p></React.Fragment>))}{(V.ovQuote.showTb)?(<><span className="g-seltoolbar" style={V.ovQuote.tbStyle}><span style={S("display:inline-flex;align-items:center;gap:2px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--r-sm);padding:3px;box-shadow:var(--shadow-popover)")}><span onClick={V.selTb.onQuote} title={V.ui.quoteMemo} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5" /></svg></span><span onClick={V.selTb.onCopy} title={V.ui.copyText} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M3 10V3h7" /></svg></span></span></span></>):null}</div>
                  <div style={S("border-top:1px solid var(--border);margin-top:28px;padding-top:24px")}>
                    <div className="v-caption" style={S("color:var(--fg-2);margin-bottom:12px;display:block")}>{V.ui.ovBrief}</div>
                    <div style={S("border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden")}>
                      {arr(V.overview).map((ov,$index)=>(<React.Fragment key={$index}><div className="g-ovrow" style={ov.style}><span className="v-meta" style={S("color:var(--fg-4);width:96px;flex:none")}>{ov.k}</span><div style={S("flex:1;min-width:0")}><span className="v-body" style={S("color:var(--fg-2)")}>{ov.v}</span>{(ov.hasBadge)?(<><span style={S("font-size:9px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:1px 6px;margin-left:8px;vertical-align:middle")}>{ov.badge}</span></>):null}{(ov.hasPrev)?(<><span className="v-micro" style={S("color:var(--fg-4);margin-left:8px;text-decoration:line-through")}>{V.ui.windowPrev} {ov.prev}</span></>):null}</div><span style={S("display:inline-flex;align-items:center;gap:2px;flex:none")}><span className="g-ovquote" onClick={ov.onQuote} title={V.ui.quoteMemo} style={S("cursor:pointer;color:var(--fg-4);display:inline-flex;align-items:center;padding:3px")}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5"></path></svg></span><span className="g-ovquote" onClick={ov.onCopy} title={V.ui.copyText} style={S("cursor:pointer;color:var(--fg-4);display:inline-flex;align-items:center;padding:3px")}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="5" y="5" width="8" height="8" rx="1"></rect><path d="M3 10V3h7"></path></svg></span></span></div></React.Fragment>))}
                    </div>
                  </div>
                </div>
              </>):null}

              
              {(V.isProfile)?(<>
                <div style={S("padding:18px 20px")}>
                  <div style={S("display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px")}>
                    {arr(V.profiles).map((pf,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px 14px 0;display:flex;gap:0;cursor:pointer")} onClick={pf.onOpen}>
                      <span style={S(`width:3px;align-self:stretch;background:${pf.color};border-radius:2px;flex:none;margin-right:13px`)}></span>
                      <div style={S("flex:1;min-width:0")}>
                      <div style={S("display:flex;align-items:center;gap:10px;margin-bottom:12px")}>
                        <span style={pf.avRingStyle}>{pf.ini}</span>
                        <div style={S("min-width:0;flex:1")}><div className="v-title" style={S("color:var(--fg)")}>{pf.name}</div><div className="v-micro" style={S("color:var(--fg-4)")}>{pf.age} · {pf.job}{pf.rel}</div></div>
                        {(pf.hasMemos)?(<><span style={S("font-size:10px;font-weight:600;padding:2px 7px;border-radius:var(--r-pill);background:var(--bg-elevated-2);color:var(--fg-3);display:inline-flex;align-items:center;gap:3px;flex:none")}><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" /></svg>{pf.memoCount}</span></>):null}
                        {(pf.hasVerdict)?(<><span style={S(`font-size:10px;font-weight:700;padding:2px 8px;border-radius:var(--r-pill);border:1px solid ${pf.verdictColor};color:${pf.verdictColor}`)}>{pf.verdictLabel}</span></>):null}
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" style={S("flex:none")}><path d="M6 4l4 4-4 4" /></svg>
                      </div>
                      <div onClick={pf.stopProp} style={S("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)")}>
                        <span className="v-micro" style={S("color:var(--fg-4);margin-right:2px")}>{V.ui.verdictLabel}</span>
                        {arr(pf.verdictOpts).map((vo,$index)=>(<React.Fragment key={$index}><span onClick={vo.onPick} style={vo.chipStyle}><span style={vo.dot}></span>{vo.label}</span></React.Fragment>))}
                      </div>
                      <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px")}>{V.ui.pClaim}</div>
                      <div className="v-meta" style={S("color:var(--fg-2);line-height:1.55;margin-bottom:14px")}>{pf.claim}</div>
                      <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px")}>{V.ui.pClues}</div>
                      {(pf.hasClues)?(<><div style={S("display:flex;flex-direction:column;gap:6px;margin-bottom:14px")}>{arr(pf.clues).map((cl,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:flex-start;gap:7px")}><span style={S("width:5px;height:5px;border-radius:50%;background:var(--accent);margin-top:6px;flex:none")}></span><div style={S("min-width:0")}><span className="v-meta" style={S("color:var(--fg-2)")}>{cl.text}</span>{(cl.isNew)?(<><span style={S("font-size:9px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:0 5px;margin-left:5px")}>{V.ui.pNew}</span></>):null}<div className="v-micro" style={S("color:var(--fg-4);margin-top:1px")}>{cl.action}</div></div></div></React.Fragment>))}</div></>):null}
                      {(pf.noClues)?(<><div className="v-meta" style={S("color:var(--fg-4);margin-bottom:14px;line-height:1.5")}>{V.ui.pNoClues}</div></>):null}
                      {(pf.hasMemos)?(<><div style={S("border-top:1px solid var(--border);padding-top:12px;margin-bottom:12px")}><div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px")}>{V.ui.pMemos}</div><div style={S("display:flex;flex-direction:column;gap:8px")}>{arr(pf.memos).map((mo,$index)=>(<React.Fragment key={$index}><div style={S("border-left:2px solid var(--accent);padding-left:9px")}>{(mo.hasQuote)?(<><div className="v-meta" style={S("color:var(--fg-3);font-style:italic;line-height:1.5")}>“{mo.quote}”</div></>):null}<div className="v-meta" style={S("color:var(--fg-2);margin-top:2px;line-height:1.5")}>{mo.content}</div></div></React.Fragment>))}</div></div></>):null}
                      <div style={S("display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--border);padding-top:12px")}>
                        {arr(pf.slots).map((sl,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:center;gap:8px")}>
                          <span className="v-meta" style={S("color:var(--fg-4);width:40px;flex:none")}>{sl.label}</span>
                          {(sl.filled)?(<><span className="v-meta" style={S("color:var(--fg-2);flex:1")}>{sl.text}</span>{(sl.isNew)?(<><span style={S("font-size:9px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:0 5px")}>{V.ui.pNew}</span></>):null}</>):null}
                          {(sl.empty)?(<><span style={S("flex:1;border-bottom:1.5px dashed var(--border-strong)")}></span><span className="v-micro" style={S("color:var(--fg-4);flex:none")}>{V.ui.pUnknown}</span></>):null}
                        </div></React.Fragment>))}
                      </div>
                    </div></div></React.Fragment>))}
                  </div>
                </div>
              </>):null}

              
              {(V.isInvestigate)?(<>
                <div style={V.invLayoutStyle}>
                  <div style={V.invLeftStyle}>
                    <div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:16px;margin-bottom:16px")}>
                      <div style={S("display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px")}>
                        <span className="v-caption" style={S("color:var(--fg-3)")}>{V.ui.invRemaining}</span>
                        <span className="v-num" style={S("font-size:22px;font-weight:600;color:var(--fg)")}>{V.inv.remaining} <span style={S("font-size:13px;color:var(--fg-4)")}>/ {V.inv.budget}</span></span>
                      </div>
                      <div style={S("display:flex;gap:4px")}>{arr(V.inv.pips).map((pip,$index)=>(<React.Fragment key={$index}><span style={pip.style}></span></React.Fragment>))}</div>
                      <div className="v-micro" style={S("color:var(--fg-4);margin-top:10px;line-height:1.5")}>{V.ui.invHint}</div>
                    </div>
                    <div style={S("display:flex;flex-direction:column;gap:6px;margin-bottom:14px")}>
                      {arr(V.inv.actions).map((act,$index)=>(<React.Fragment key={$index}><div onClick={act.onSelect} style={act.style}><span className="v-ui" style={S("color:inherit")}>{act.label}</span><span style={S("flex:1")}></span><span className="v-meta" style={S("color:var(--fg-4)")}>{V.ui.cost} {act.cost}</span></div></React.Fragment>))}
                    </div>
                    {(V.inv.showTargets)?(<><div style={S("margin-bottom:14px")}>
                      <div className="v-caption" style={S("color:var(--fg-4);margin-bottom:8px")}>{V.inv.targetLabelHead}</div>
                      <div style={S("display:flex;flex-wrap:wrap;gap:7px")}>{arr(V.inv.targets).map((tg,$index)=>(<React.Fragment key={$index}><span onClick={tg.onToggle} style={tg.style}>{tg.label}</span></React.Fragment>))}</div>
                    </div></>):null}
                    {(V.inv.noneTarget)?(<><div className="v-meta" style={S("color:var(--fg-4);margin-bottom:14px")}>{V.ui.invNoTarget}</div></>):null}
                    <Button variant="primary" onClick={V.inv.onExec} style={V.inv.execStyle}>{V.inv.execLabel}</Button>
                    {(V.inv.showReason)?(<><div className="v-meta" style={S("color:var(--fg-4);text-align:center;margin-top:8px")}>{V.inv.execReason}</div></>):null}
                  </div>
                  <div style={V.invRightStyle}>
                    <div className="v-caption" style={S("color:var(--fg-2);margin-bottom:12px")}>{V.ui.invLogTitle}</div>
                    {arr(V.inv.targetNotes).map((tn,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--accent);background:var(--accent-soft);border-radius:var(--r-md);margin-bottom:8px")}>
                      <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={S("flex:none")}><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></svg>
                      <div style={S("min-width:0")}><div className="v-ui" style={S("color:var(--fg)")}>{tn.label}</div><div className="v-micro" style={S("color:var(--fg-3)")}>{tn.secNum}{V.ui.navCase} {V.ui.revealedBy}</div></div>
                    </div></React.Fragment>))}
                    {(V.inv.emptyLog)?(<><div style={S("border:1px dashed var(--border-strong);border-radius:var(--r-md);padding:22px;text-align:center;color:var(--fg-4);font-size:12px;line-height:1.6")}>{V.ui.invEmptyLog}</div></>):null}
                    {arr(V.inv.log).map((e,$index)=>(<React.Fragment key={$index}><div style={e.cardStyle}>
                      <div style={e.barStyle}></div>
                      <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:6px")}><span style={e.badgeStyle}>{e.typeLabel}</span>{(e.isEmpty)?(<><span className="v-micro" style={S("color:var(--fg-4)")}>{e.emptyTag}</span></>):null}<span style={S("flex:1")}></span><span className="v-micro" style={S("color:var(--fg-4)")}>{e.actionLabel}{(e.hasTarget)?(<> · {e.targetLabel}</>):null}</span></div>
                      <div className="v-title" style={S("color:var(--fg);margin-bottom:3px")}>{e.title}</div>
                      <div className="v-meta" style={S("color:var(--fg-3);line-height:1.55")}>{e.desc}</div>
                    </div></React.Fragment>))}
                  </div>
                </div>
              </>):null}
            </div>

            {(V.shell.showRight)?(<>
              <div style={V.shell.rightPanelStyle}>
                <div style={S("display:flex;align-items:center;border-bottom:1px solid var(--border);flex:none")}>
                  <div onClick={V.right.tabs.statements.onClick} style={V.right.tabs.statements.style}>{V.right.labels.statements}</div>
                  <div onClick={V.right.tabs.invlog.onClick} style={V.right.tabs.invlog.style}>{V.right.labels.invlog}</div>
                  <div onClick={V.right.tabs.memo.onClick} style={V.right.tabs.memo.style}>{V.right.labels.memo}</div>
                  <span className="iconbtn" onClick={V.shell.onToggleRight} style={S("width:24px;height:24px;margin:0 6px;font-size:13px;color:var(--fg-4);flex:none")}>✕</span>
                </div>
                <div style={S("flex:1;overflow:auto;padding:14px")}>
                  {(V.right.showStatements)?(<>
                    <div style={S("display:flex;justify-content:flex-end;margin-bottom:8px")}><span onClick={V.right.onToggleMarksOnly} style={V.right.marksToggleStyle}>{V.right.marksToggleLabel}</span></div>
                    {arr(V.right.statements).map((rst,$index)=>(<React.Fragment key={$index}><div style={S("border-bottom:1px solid var(--border)")}>
                      <div className="acc-head" onClick={rst.onToggle} style={S("display:flex;align-items:center;gap:7px;padding:9px 2px;cursor:pointer")}><span style={S(`width:3px;height:20px;background:${rst.color};border-radius:2px;flex:none`)}></span><span style={rst.avStyle}>{rst.ini}</span><span className="v-ui" style={S("color:var(--fg)")}>{rst.name}</span>{(rst.collapsed)?(<><span className="v-micro" style={S("color:var(--fg-4);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{rst.preview}</span></>):null}<span style={S("flex:1")}></span><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" style={S(`flex:none;transform:${rst.rot}`)}><path d="M5 6.5L8 9.5l3-3" /></svg></div>
                      {(rst.open)?(<><div style={S("padding:2px 2px 12px 20px")}>
                        {(V.right.marksOnly)?(<>
                          {(rst.hasMarks)?(<><div style={S("display:flex;flex-direction:column;gap:9px")}>{arr(rst.marks).map((mk,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;gap:9px;align-items:flex-start")}><span style={S(`width:3px;align-self:stretch;border-radius:2px;flex:none;min-height:18px;background:${mk.color}`)}></span><span style={S("font-size:13px;line-height:1.7;color:var(--fg-2)")}>{mk.t}</span></div></React.Fragment>))}</div></>):null}
                          {(rst.noMarks)?(<><div style={S("font-size:12px;color:var(--fg-4);line-height:1.6")}>{V.ui.noMarksHint}</div></>):null}
                        </>):null}
                        {(V.right.fullText)?(<>{arr(rst.paras).map((rp,$index)=>(<React.Fragment key={$index}><p style={S("margin:0 0 11px;font-size:13.5px;line-height:1.85;color:var(--fg-2);text-wrap:pretty")}>{arr(rp.segs).map((seg,$index)=>(<React.Fragment key={$index}><span style={seg.style}>{seg.text}</span></React.Fragment>))}</p></React.Fragment>))}</>):null}
                      </div></>):null}
                    </div></React.Fragment>))}
                  </>):null}
                  {(V.right.showInvlog)?(<>
                    {(V.right.invEmpty)?(<><div className="v-meta" style={S("color:var(--fg-4);text-align:center;padding:20px;line-height:1.6")}>{V.ui.invEmptyLog}</div></>):null}
                    {arr(V.right.invLog).map((e,$index)=>(<React.Fragment key={$index}><div style={e.cardStyle}><div style={e.barStyle}></div><div style={S("display:flex;align-items:center;gap:6px;margin-bottom:4px")}><span style={e.badgeStyle}>{e.typeLabel}</span><span style={S("flex:1")}></span><span className="v-micro" style={S("color:var(--fg-4)")}>{e.actionLabel}</span></div><div className="v-ui" style={S("color:var(--fg);font-size:12.5px;margin-bottom:2px")}>{e.title}</div><div className="v-micro" style={S("color:var(--fg-3);line-height:1.5")}>{e.desc}</div></div></React.Fragment>))}
                  </>):null}
                  {(V.right.showMemo)?(<>
                    <div style={S("display:flex;justify-content:flex-end;margin-bottom:10px")}><span className="linklike" onClick={V.right.onAddMemo} style={S("color:var(--accent);font-size:12px")}>＋ {V.ui.memoNew}</span></div>
                    {(V.right.memoEmpty)?(<><div className="v-meta" style={S("color:var(--fg-4);text-align:center;padding:20px;line-height:1.6")}>{V.ui.memoEmpty}</div></>):null}
                    {arr(V.right.memoRows).map((mo,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:8px")}>
                      <div style={S("display:flex;align-items:center;gap:6px;margin-bottom:6px")}><span className="v-num" style={S("color:var(--fg-4);font-size:11px;font-weight:600")}>{mo.numLabel}</span><span style={S("flex:1")}></span>{(mo.readMode)?(<><span className="linklike" onClick={mo.onEdit} style={S("color:var(--fg-3);font-size:11px")}>{V.ui.memoEdit}</span></>):null}{(mo.editing)?(<><span className="linklike" onClick={mo.onLock} style={S("color:var(--accent);font-size:11px")}>{V.ui.memoDone}</span><span className="linklike" onClick={mo.onDel} style={S("color:var(--label-red);font-size:11px;margin-left:6px")}>{V.ui.memoDelete}</span></>):null}</div>
                      {(mo.hasQuote)?(<><div className="v-micro" style={S("color:var(--fg-3);font-style:italic;line-height:1.5;margin-bottom:6px")}>“{mo.quote}”</div></>):null}
                      {(mo.editing)?(<><textarea value={mo.content} onChange={mo.onContent} placeholder={V.ui.memoPh2} style={S("width:100%;min-height:44px;resize:vertical;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--r-sm);padding:7px 9px;color:var(--fg);font:400 12.5px var(--font-sans);outline:none;box-sizing:border-box")}></textarea></>):null}
                      {(mo.readMode)?(<>{(mo.hasContent)?(<><div className="v-meta" style={S("color:var(--fg-2);line-height:1.55;white-space:pre-wrap")}>{mo.content}</div></>):null}</>):null}
                      <div style={S("display:flex;align-items:center;gap:5px;margin-top:5px;color:var(--fg-4);font-size:10px")}>{(mo.saved)?(<><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--g-confirm)" strokeWidth="1.6"><path d="M3.5 8.5l3 3 6-7" /></svg><span style={S("color:var(--g-confirm)")}>{mo.savedLabel}</span></>):null}{(mo.hasMeta)?(<><span>· {mo.metaText}</span></>):null}</div>
                    </div></React.Fragment>))}
                  </>):null}
                </div>
              </div>
            </>):null}
            </div>

            {(V.isNarrow)?(<>
              <div style={S("display:flex;align-items:stretch;border-top:1px solid var(--border);background:var(--bg-sidebar);flex:none")}>
                {arr(V.bottomNav).map((b,$index)=>(<React.Fragment key={$index}><div onClick={b.onClick} style={b.style}>
                  <span style={S("line-height:0")}>{b.icon}</span>
                  <span style={S("font-size:10px;font-weight:500")}>{b.label}</span>
                </div></React.Fragment>))}
              </div>
            </>):null}
          </div>

          {(V.plan.zoomOpen)?(<>
            <div style={S("position:fixed;inset:0;z-index:92;background:var(--bg-app);display:flex;flex-direction:column")}>
              <div style={S("display:flex;align-items:center;gap:10px;padding:10px 14px;flex:none;border-bottom:1px solid var(--border)")}>
                <span className="v-ui" style={S("color:var(--fg)")}>{V.ui.navMap}</span>
                <span className="v-micro" style={S("color:var(--fg-4)")}>{V.ui.planZoomHint}</span>
                <span style={S("flex:1")}></span>
                <span className="v-micro" style={S("color:var(--fg-4);font-variant-numeric:tabular-nums")}>{V.plan.zoomLabel}</span>
                <button className="iconbtn" onClick={V.plan.onClose} title={V.ui.planZoomClose}>✕</button>
              </div>
              <div style={S("padding:10px 14px 0;flex:none")}>{this.renderPlanTimes(V)}</div>
              <div style={S("flex:1;position:relative;min-height:0")}>
                <div ref={V.plan.stageRef} style={V.plan.stageStyle} onPointerDown={V.plan.onDown} onPointerMove={V.plan.onMove} onPointerUp={V.plan.onUp} onPointerCancel={V.plan.onCancel}>
                  <div ref={V.plan.figRef} style={V.plan.figStyle}>{this.renderPlanFigure(V)}</div>
                </div>
              </div>
            </div>
          </>):null}

          {(V.moreOpen)?(<>
            <div className="scrim" style={S("z-index:70;align-items:flex-end")} onClick={V.onCloseMore}>
              <div style={S("width:100%;background:var(--bg-elevated);border-radius:12px 12px 0 0;padding:8px 8px 20px")} onClick={V.stop}>
                <div style={S("width:36px;height:4px;border-radius:2px;background:var(--border-strong);margin:8px auto 12px")}></div>
                {arr(V.moreNav).map((m,$index)=>(<React.Fragment key={$index}><div className="v-menu-item" onClick={m.onClick} style={m.style}><span style={S("line-height:0")}>{m.icon}</span>{m.label}</div></React.Fragment>))}
              </div>
            </div>
          </>):null}

          {(V.isIntro)?(<>
            <div style={S("position:fixed;inset:0;z-index:80;background:var(--bg-app);display:flex;flex-direction:column")}>
              <div style={S("display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:12px 16px;flex:none")}>
                <span className="segmented" style={S("padding:0")}><span className={V.langSeg.koCls} onClick={V.langSeg.onKo} style={S("height:24px;font-size:11px")}>한국어</span><span className={V.langSeg.enCls} onClick={V.langSeg.onEn} style={S("height:24px;font-size:11px")}>EN</span></span>
                <span className="iconbtn" onClick={V.onToggleTheme} style={S("width:auto;height:24px;padding:0 8px;font-size:13px")}>{V.themeGlyph}</span>
              </div>

              {(V.stageProlog)?(<>
                <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:var(--read-pad-y) var(--read-pad-x)")}>
                  <div style={S("max-width:var(--read-measure);width:100%")}>
                    <div className="v-caption" style={S("color:var(--fg-4);margin-bottom:26px;letter-spacing:.1em;text-transform:uppercase")}>{V.ui.caseTitle}</div>
                    {arr(V.prologParas).map((pp,$index)=>(<React.Fragment key={$index}><p style={S("font-size:var(--read-fs);line-height:1.95;color:var(--fg-2);margin:0 0 20px;text-wrap:pretty")}>{pp.text}</p></React.Fragment>))}
                    <div style={S("margin-top:24px")}><Button variant="primary" onClick={V.onPrologContinue}>{V.ui.prologContinue}</Button></div>
                  </div>
                </div>
              </>):null}
              {(V.stageInterlude && V.interlude.open)?(<>
                <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:var(--read-pad-y) var(--read-pad-x)")}>
                  <div style={S("max-width:var(--read-measure);width:100%")}>
                    <div className="v-caption" style={S("color:var(--fg-4);margin-bottom:26px;letter-spacing:.1em;text-transform:uppercase")}>{V.interlude.chapter}</div>
                    {arr(V.interlude.paras).map((pp,$index)=>(<React.Fragment key={$index}><p style={S("font-size:var(--read-fs);line-height:1.95;color:var(--fg-2);margin:0 0 20px;text-wrap:pretty")}>{pp.text}</p></React.Fragment>))}
                    {(V.interlude.hasDest)?(<><div className="v-micro" style={S("color:var(--fg-4);margin-top:26px;padding-top:16px;border-top:1px solid var(--border)")}>{V.interlude.dest}</div></>):null}
                    <div style={S("margin-top:24px")}><Button variant="primary" onClick={V.interlude.onNext}>{V.ui.prologContinue}</Button></div>
                  </div>
                </div>
              </>):null}
              {(V.stageBrief)?(<>
                <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;overflow:auto")}>
                  <div style={S("max-width:520px;width:100%")}>
                    <div style={S("display:flex;align-items:center;gap:9px;margin-bottom:20px")}>
                      <span className="ws-av" style={S("width:26px;height:26px;background:linear-gradient(135deg,var(--accent),#2D9CDB)")}>V</span>
                      <span className="v-ui" style={S("color:var(--fg-3)")}>{V.ui.caseTitle}</span>
                    </div>
                    <div className="v-h1" style={S("margin-bottom:6px")}>{V.ui.briefTitle}</div>
                    <div className="v-body" style={S("color:var(--fg-3);margin-bottom:22px")}>{V.ui.briefSub}</div>
                    <div style={S("border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;margin-bottom:22px")}>
                      {arr(V.briefRows).map((br,$index)=>(<React.Fragment key={$index}><div style={br.style}><span className="v-meta" style={S("color:var(--fg-4);width:100px;flex:none")}>{br.k}</span><span className="v-body" style={S("color:var(--fg-2)")}>{br.v}</span></div></React.Fragment>))}
                    </div>
                    <Button variant="primary" onClick={V.onStartRead} style={V.briefBtnStyle}>{V.ui.startRead}</Button>
                    <div className="v-meta" style={S("color:var(--fg-4);margin-top:12px;line-height:1.5")}>{V.ui.briefNote}</div>
                  </div>
                </div>
              </>):null}

              {(V.stageRead)?(<>
                <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto;padding:8px 20px 28px")}>
                  <div style={S("max-width:var(--read-measure);width:100%")}>
                    <div style={S("display:flex;align-items:center;gap:12px;margin-bottom:16px")}>
                      <span className="v-meta" style={S("color:var(--fg-4);font-variant-numeric:tabular-nums")}>{V.readCard.idx} / {V.readCard.total}</span>
                      <span style={S("flex:1")}></span>
                      <span className="linklike" onClick={V.readCard.onSkip}>{V.ui.skipRead}</span>
                    </div>
                    <div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:22px 24px;background:var(--bg-subtle)")}>
                      <div style={S("display:flex;align-items:center;gap:10px;margin-bottom:16px")}>
                        <span style={V.readCard.avStyle}>{V.readCard.ini}</span>
                        <span className="v-h3" style={S("color:var(--fg)")}>{V.readCard.name}</span>
                        <span className="v-meta" style={S("color:var(--fg-4)")}>{V.readCard.meta}</span>
                      </div>
                      {(V.readCard.hasPre)?(<><p style={V.readCard.gestureStyle}>{V.readCard.gesturePre}</p></>):null}
                      {arr(V.readCard.paras).map((para,$index)=>(<React.Fragment key={$index}><p style={para.style} onClick={para.onClick}>{para.text}</p></React.Fragment>))}
                      {(V.readCard.hasPost)?(<><p style={V.readCard.gesturePostStyle}>{V.readCard.gesturePost}</p></>):null}
                      <div style={S("display:flex;align-items:center;gap:6px;margin:16px 0 6px;color:var(--fg-4)")}>
                        <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" /><path d="M9.4 3.4l2.4 2.4" /></svg>
                        <span className="v-meta">{V.ui.memoLabel}</span>
                      </div>
                      <textarea value={V.readCard.memo} onChange={V.readCard.onMemo} placeholder={V.ui.memoPh} style={S("width:100%;min-height:52px;resize:vertical;background:var(--bg-input);border:1px solid var(--border-strong);border-radius:var(--r-sm);padding:9px 11px;color:var(--fg);font:400 13px var(--font-sans);outline:none;box-sizing:border-box")}></textarea>
                    </div>
                    <div style={S("display:flex;align-items:center;gap:14px;margin-top:18px")}>
                      <Button variant="ghost" onClick={V.readCard.onPrev} style={V.readCard.prevStyle}>{V.ui.prev}</Button>
                      <div style={S("display:flex;gap:7px;flex:1;justify-content:center")}>{arr(V.readCard.dots).map((d,$index)=>(<React.Fragment key={$index}><span style={d.style} onClick={d.onClick}></span></React.Fragment>))}</div>
                      {(V.readCard.isLast)?(<><Button variant="primary" onClick={V.readCard.onSkip}>{V.ui.openNarrative}</Button></>):null}
                      {(V.readCard.notLast)?(<><Button variant="primary" onClick={V.readCard.onNext}>{V.ui.next}</Button></>):null}
                    </div>
                  </div>
                </div>
              </>):null}
            </div>
          </>):null}

          {(V.isHome)?(<>
            <div style={S("position:fixed;inset:0;z-index:70;background:var(--bg-app);display:flex;flex-direction:column;overflow:auto")}>
              <svg width="0" height="0" style={S("position:absolute;overflow:hidden")} aria-hidden="true"><defs><linearGradient id="depGun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#aeb6c0" /><stop offset=".45" stopColor="#5a616b" /><stop offset="1" stopColor="#2b2f36" /></linearGradient><clipPath id="depClipD"><path d="M62 34 L62 166 A92 66 0 0 0 62 34 Z" /></clipPath><mask id="depMask"><path d="M62 34 L62 166 A92 66 0 0 0 62 34 Z" fill="#fff" /><g stroke="#000" strokeWidth="10" strokeLinecap="round"><line x1="34" y1="182" x2="152" y2="64" /><line x1="20" y1="150" x2="120" y2="50" /><line x1="12" y1="118" x2="92" y2="38" /></g></mask><symbol id="depMark" viewBox="0 0 200 200"><g transform="rotate(45 100 100)"><rect width="200" height="200" fill="url(#depGun)" mask="url(#depMask)" /><g clipPath="url(#depClipD)" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round"><line x1="40" y1="184" x2="158" y2="66" /><line x1="26" y1="152" x2="126" y2="52" /><line x1="18" y1="120" x2="98" y2="40" /></g></g></symbol></defs></svg>
              <div style={S("display:flex;align-items:center;gap:10px;padding:16px 24px;border-bottom:1px solid var(--border);flex:none")}>
                <span style={S("width:24px;height:24px;border-radius:6px;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;background:radial-gradient(125% 100% at 50% -12%, #1e2024 0%, #0b0c0d 62%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 1px 3px rgba(0,0,0,.5)")}><svg viewBox="0 0 200 200" width="17" height="17"><use href="#depMark" /></svg></span>
                <span className="v-ui" style={S("color:var(--fg-3)")}>{V.ui.gameTitle}</span>
                <span style={S("flex:1")}></span>
                <span className="segmented" style={S("padding:0")}><span className={V.langSeg.koCls} onClick={V.langSeg.onKo} style={S("height:24px;font-size:11px")}>한국어</span><span className={V.langSeg.enCls} onClick={V.langSeg.onEn} style={S("height:24px;font-size:11px")}>EN</span></span>
                <span className="iconbtn" onClick={V.onToggleTheme} style={S("width:auto;height:24px;padding:0 8px;font-size:13px")}>{V.themeGlyph}</span>
              </div>
              <div style={S("max-width:680px;width:100%;margin:0 auto;padding:36px 24px 64px")}>
                <div style={S("margin-bottom:28px;display:flex;align-items:center;gap:16px")}>
                  <span style={S("width:56px;height:56px;border-radius:14px;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;background:radial-gradient(125% 100% at 50% -12%, #1e2024 0%, #0b0c0d 62%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 16px rgba(0,0,0,.5);position:relative")}><div style={S("position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,0) 42%);pointer-events:none")}></div><svg viewBox="0 0 200 200" width="40" height="40" style={S("filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))")}><use href="#depMark" /></svg></span>
                  <div><div style={S("font:700 30px var(--font-sans);letter-spacing:-.02em;color:var(--fg)")}>{V.ui.gameTitle}</div>
                  <div className="v-body" style={S("color:var(--fg-3);margin-top:4px")}>{V.ui.gameTagline}</div></div>
                </div>
                {(V.home.resumeShow)?(<><div onClick={V.home.onResume} style={S("display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--accent);background:var(--accent-soft);border-radius:var(--r-md);cursor:pointer;margin-bottom:26px")}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M5 3.5l7 4.5-7 4.5z" /></svg>
                  <div style={S("flex:1;min-width:0")}><div className="v-ui" style={S("color:var(--fg)")}>{V.ui.resume} · {V.home.resumeTitle}</div><div className="v-meta" style={S("color:var(--fg-3);margin-top:2px")}>{V.ui.narrProg} {V.home.resumeProgress} · {V.ui.budget} {V.home.resumeBudget}</div></div>
                  <span className="v-meta" style={S("color:var(--accent);font-size:16px")}>›</span>
                </div></>):null}
                <div className="v-caption" style={S("color:var(--fg-2);margin:2px 0 12px;display:block")}>{V.ui.campaign}</div>
                <div style={S("display:flex;flex-direction:column;gap:8px")}>
                  {arr(V.home.cases).map((c,$index)=>(<React.Fragment key={$index}><div onClick={c.onClick} style={c.cardStyle}>
                    <span className="v-num" style={S("font-size:13px;color:var(--fg-4);width:22px;flex:none")}>{c.num}</span>
                    <span className="v-title" style={S("color:var(--fg);flex:1;min-width:0")}>{c.title}</span>
                    <span className="v-micro" style={S("color:var(--fg-4);flex:none")}>{c.est}</span>
                    <span className="pr-badge" style={c.diffStyle}>{c.diff}</span>
                    <span style={c.chipStyle}>{c.chipLabel}</span>
                    {(c.canDel)?(<><span onClick={c.onDel} title={c.delTitle} style={c.delStyle}>✕</span></>):null}
                    {(c.confirmDel)?(<><span style={c.askStyle}>{c.askLabel}</span><span onClick={c.onDelYes} style={c.yesStyle}>{c.yesLabel}</span><span onClick={c.onDelNo} style={c.noStyle}>{c.noLabel}</span></>):null}
                  </div></React.Fragment>))}
                </div>
                <div className="v-caption" style={S("color:var(--fg-2);margin:26px 0 12px;display:block")}>{V.ui.daily}</div>
                <div style={S("display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:var(--r-md);opacity:.55")}>
                  <svg className="icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4"><rect x="2.5" y="3" width="11" height="11" rx="1.5" /><path d="M2.5 6h11M6 2v2M10 2v2" /></svg>
                  <span className="v-title" style={S("color:var(--fg-2);flex:1")}>{V.ui.daily}</span><span className="v-meta" style={S("color:var(--fg-4)")}>{V.ui.dailyDesc}</span>
                </div>
                <div className="v-caption" style={S("color:var(--fg-2);margin:26px 0 12px;display:block")}>{V.ui.more}</div>
                <div style={S("display:flex;gap:10px;flex-wrap:wrap")}>
                  <div style={S("flex:1 1 150px;display:flex;align-items:center;gap:10px;padding:13px 16px;border:1px dashed var(--border-strong);border-radius:var(--r-md);opacity:.45")}><span className="v-title" style={S("color:var(--fg-3);flex:1")}>{V.ui.joinRoom}</span><span className="pr-badge" style={S("background:var(--bg-elevated-2);color:var(--fg-4)")}>v2</span></div>
                  <div style={S("flex:1 1 150px;display:flex;align-items:center;gap:10px;padding:13px 16px;border:1px dashed var(--border-strong);border-radius:var(--r-md);opacity:.45")}><span className="v-title" style={S("color:var(--fg-3);flex:1")}>{V.ui.workshop}</span><span className="pr-badge" style={S("background:var(--bg-elevated-2);color:var(--fg-4)")}>v1.5</span></div>
                  <div style={S("flex:1 1 150px;display:flex;align-items:center;gap:10px;padding:13px 16px;border:1px dashed var(--border-strong);border-radius:var(--r-md);opacity:.45")}><span className="v-title" style={S("color:var(--fg-3);flex:1")}>{V.ui.coop}</span><span className="pr-badge" style={S("background:var(--bg-elevated-2);color:var(--fg-4)")}>v2</span></div>
                </div>
              </div>
            </div>
          </>):null}

          {(V.isDetail)?(<>
            <div style={S("position:fixed;inset:0;z-index:72;background:var(--bg-app);display:flex;flex-direction:column;overflow:auto")}>
              <div style={S("display:flex;align-items:center;gap:12px;padding:16px 24px;flex:none")}>
                <span className="linklike" onClick={V.detail.onBack} style={S("display:inline-flex;align-items:center;gap:6px")}><svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>{V.ui.detailBack}</span>
                <span style={S("flex:1")}></span>
                <span className="segmented" style={S("padding:0")}><span className={V.langSeg.koCls} onClick={V.langSeg.onKo} style={S("height:24px;font-size:11px")}>한국어</span><span className={V.langSeg.enCls} onClick={V.langSeg.onEn} style={S("height:24px;font-size:11px")}>EN</span></span>
                <span className="iconbtn" onClick={V.onToggleTheme} style={S("width:auto;height:24px;padding:0 8px;font-size:13px")}>{V.themeGlyph}</span>
              </div>
              <div style={S("flex:1;display:flex;align-items:center;justify-content:center;padding:24px")}>
                <div style={S("max-width:460px;width:100%")}>
                  <div style={S("display:flex;align-items:center;gap:10px;margin-bottom:18px")}>
                    <span className="pr-badge" style={S("background:var(--accent-soft);color:var(--accent)")}>{V.detail.diff}</span>
                    <span style={V.detail.chipStyle}>{V.detail.chipLabel}</span>
                  </div>
                  <div className="v-h1" style={S("margin-bottom:20px")}>{V.detail.title}</div>
                  <div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:2px 16px;margin-bottom:20px")}>
                    {arr(V.detail.rows).map((r,$index)=>(<React.Fragment key={$index}><div style={r.style}><span className="v-meta" style={S("color:var(--fg-4)")}>{r.k}</span><span className="v-ui" style={S("color:var(--fg)")}>{r.v}</span></div></React.Fragment>))}
                  </div>
                  {(V.detail.notPlayedNote)?(<><div className="v-meta" style={S("color:var(--fg-4);line-height:1.6;margin-bottom:20px")}>{V.detail.notPlayedNote}</div></>):null}
                  <div style={S("display:flex;gap:10px")}>
                    <Button variant="primary" onClick={V.detail.onPrimary} style={V.detail.primaryStyle}>{V.detail.primaryLabel}</Button>
                    <Button style={V.roomBtnStyle}>{V.ui.createRoom} · v2</Button>
                  </div>
                  {(V.detail.showAbandon)?(<><div style={S("text-align:center;margin-top:12px")}><span className="linklike" onClick={V.onAbandonReq} style={S("color:var(--label-red)")}>{V.ui.abandon}</span></div></>):null}
                </div>
              </div>
            </div>
          </>):null}

          {(V.termDlg.open)?(<>
            <div className="scrim" style={S("z-index:96;align-items:center;justify-content:center")} onClick={V.termDlg.onClose}>
              <div style={S("width:400px;max-width:92vw;background:var(--bg-app);border:1px solid var(--border-strong);border-radius:var(--r-lg);box-shadow:var(--shadow-modal);overflow:hidden")} onClick={V.stop}>
                <div style={S("display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border)")}>
                  <span style={S("width:34px;height:34px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;background:var(--bg-elevated);flex:none")}><svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="var(--fg-2)" strokeWidth="1.4"><path d={V.termDlg.iconPath}></path></svg></span>
                  <div className="v-ui" style={S("color:var(--fg);font-weight:600;flex:1;min-width:0")}>{V.termDlg.label}</div>
                  {(V.termDlg.hasMemos)?(<><span style={S("font-size:10px;font-weight:600;padding:2px 7px;border-radius:var(--r-pill);background:var(--bg-elevated-2);color:var(--fg-3);display:inline-flex;align-items:center;gap:3px;flex:none;margin-right:6px")}><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" /></svg>{V.termDlg.memoCount}</span></>):null}
                  <span className="iconbtn" onClick={V.termDlg.onClose} style={S("flex:none")}>✕</span>
                </div>
                <div style={S("padding:16px 18px;display:flex;flex-direction:column;gap:14px")}>
                  <div style={S("display:flex;gap:12px")}><div style={S("width:44px;flex:none;font-size:11px;color:var(--fg-4);letter-spacing:.04em;padding-top:2px")}>{V.ui.termFound}</div><div className="v-body" style={S("flex:1;min-width:0;color:var(--fg-2);line-height:1.6")}>{V.termDlg.found}</div></div>
                  <div style={S("display:flex;gap:12px")}><div style={S("width:44px;flex:none;font-size:11px;color:var(--fg-4);letter-spacing:.04em;padding-top:2px")}>{V.ui.termDesc}</div><div className="v-body" style={S("flex:1;min-width:0;color:var(--fg-2);line-height:1.8")}>{V.termDlg.desc}</div></div>
                </div>
                <div style={S("display:flex;justify-content:flex-end;padding:0 18px 16px")}>
                  <span className="linklike" onClick={V.termDlg.onQuote} style={S("display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--accent);cursor:pointer")}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h5v4l-2 -1.2L5 8V4z"></path><path d="M4 12h8"></path></svg>{V.ui.termQuote}</span>
                </div>
              </div>
            </div>
          </>):null}

          {(V.confirmAbandon)?(<>
            <div className="scrim" style={S("z-index:95;align-items:center;padding-top:0")}><div className="modal" style={S("width:400px")}>
              <div style={S("padding:20px 20px 6px")}><div className="v-h3" style={S("color:var(--fg)")}>{V.ui.abandonConfirmT}</div><div className="v-body" style={S("color:var(--fg-3);margin-top:8px;line-height:1.6")}>{V.ui.abandonConfirmD}</div></div>
              <div className="modal-foot" style={S("justify-content:flex-end")}>
                <Button variant="ghost" onClick={V.onCancelAbandon}>{V.ui.cancel}</Button>
                <Button onClick={V.onAbandon} style={V.dangerBtnStyle}>{V.ui.quit}</Button>
              </div>
            </div></div>
          </>):null}

          {(V.profileOpen)?(<>
            <div className="scrim" style={S("z-index:90;align-items:center;justify-content:center")}>
              <div style={S("width:680px;max-width:94vw;max-height:88vh;background:var(--bg-app);border:1px solid var(--border-strong);border-radius:var(--r-lg);box-shadow:var(--shadow-modal);display:flex;flex-direction:column;overflow:hidden")}>
                <div style={S("display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);flex:none")}>
                  <span style={S(`width:3px;height:34px;background:${V.profileDetail.color};border-radius:2px;flex:none`)}></span>
                  <span style={V.profileDetail.avRingStyle}>{V.profileDetail.ini}</span>
                  <div style={S("flex:1;min-width:0")}><div className="v-h3" style={S("color:var(--fg)")}>{V.profileDetail.name}</div><div className="v-micro" style={S("color:var(--fg-4)")}>{V.profileDetail.age} · {V.profileDetail.job}{V.profileDetail.rel}</div></div>
                  {(V.profileDetail.hasVerdict)?(<><span style={S(`font-size:10px;font-weight:700;padding:2px 8px;border-radius:var(--r-pill);border:1px solid ${V.profileDetail.verdictColor};color:${V.profileDetail.verdictColor}`)}>{V.profileDetail.verdictLabel}</span></>):null}
                  <button className="iconbtn" onClick={V.onCloseProfile}><svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
                </div>
                <div style={S("display:flex;flex:1;min-height:0")}>
                  <div style={S("width:300px;flex:none;border-right:1px solid var(--border);padding:18px 20px;overflow:auto")}>
                    <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px")}>{V.ui.verdictLabel}</div>
                    <div style={S("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px")}>{arr(V.profileDetail.verdictOpts).map((vo,$index)=>(<React.Fragment key={$index}><span onClick={vo.onPick} style={vo.chipStyle}><span style={vo.dot}></span>{vo.label}</span></React.Fragment>))}</div>
                    <div className="v-micro" style={S("color:var(--fg-4);margin-bottom:18px")}>{V.ui.verdictHint}</div>
                    <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px")}>{V.ui.pClaim} · <span style={S("color:var(--status-progress)")}>{V.ui.layerClaim}</span></div>
                    <div style={S("display:flex;gap:9px;margin-bottom:20px")}><span style={S(`width:2px;align-self:stretch;background:${V.profileDetail.color};border-radius:2px;flex:none;opacity:.75`)}></span><div className="v-body" style={S("color:var(--fg-3);line-height:1.7;font-style:italic")}>“{V.profileDetail.claim}”</div></div>
                    <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px")}>{V.ui.pGuilt}</div>
                    <div style={S("display:flex;flex-direction:column;gap:11px")}>
                      {arr(V.profileDetail.slots).map((sl,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:flex-start;gap:8px")}>
                        <span className="v-meta" style={S("color:var(--fg-4);width:40px;flex:none;padding-top:1px")}>{sl.label}</span>
                        {(sl.filled)?(<><div style={S("flex:1;min-width:0")}><span className="v-meta" style={S("color:var(--fg-2)")}>{sl.text}</span>{(sl.isNew)?(<><span style={S("font-size:9px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:0 5px;margin-left:5px")}>{V.ui.pNew}</span></>):null}<span className="linklike" onClick={sl.onJump} style={S("display:block;color:var(--accent);font-size:11px;margin-top:1px")}>{V.ui.pViewSource} ↗</span></div></>):null}
                        {(sl.empty)?(<><span style={S("flex:1;border-bottom:1.5px dashed var(--border-strong);margin-top:9px")}></span><span className="v-micro" style={S("color:var(--fg-4);flex:none")}>{V.ui.pUnknown}</span></>):null}
                      </div></React.Fragment>))}
                    </div>
                  </div>
                  <div style={S("flex:1;min-width:0;padding:18px 20px;overflow:auto")}>
                    <div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px")}>{V.ui.pClues} · <span style={S("color:var(--g-confirm)")}>{V.ui.layerFact}</span></div>
                    {(V.profileDetail.hasClues)?(<><div style={S("display:flex;flex-direction:column;gap:8px;margin-bottom:20px")}>{arr(V.profileDetail.clues).map((cl,$index)=>(<React.Fragment key={$index}><div onClick={cl.onJump} style={S("display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--border);border-left:2px solid var(--g-confirm);border-radius:var(--r-sm);cursor:pointer")}><span style={S("width:6px;height:6px;border-radius:2px;background:var(--g-confirm);margin-top:6px;flex:none")}></span><div style={S("min-width:0;flex:1")}><span className="v-meta" style={S("color:var(--fg-2)")}>{cl.text}</span>{(cl.isNew)?(<><span style={S("font-size:9px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:var(--r-pill);padding:0 5px;margin-left:5px")}>{V.ui.pNew}</span></>):null}<div className="v-micro" style={S("color:var(--fg-4);margin-top:2px")}>{cl.action} ↗</div></div></div></React.Fragment>))}</div></>):null}
                    {(V.profileDetail.noClues)?(<><div className="v-meta" style={S("color:var(--fg-4);margin-bottom:20px;line-height:1.5")}>{V.ui.pNoClues}</div></>):null}
                    {(V.profileDetail.hasNarr)?(<><div style={S("display:flex;flex-direction:column;gap:10px;margin-bottom:20px")}>{arr(V.profileDetail.narr).map((n,$index)=>(<React.Fragment key={$index}><div style={S("position:relative;border:1px solid var(--border);border-radius:var(--r-md);padding:11px 14px 11px 16px")}>
                      <div style={S(`position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:var(--r-md) 0 0 var(--r-md);background:${n.barColor}`)}></div>
                      <div style={S("display:flex;align-items:baseline;gap:8px;margin-bottom:4px")}><span className="v-ui" style={S("color:var(--fg)")}>{n.title}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{n.actionLabel}</span></div>
                      <div style={S("font-size:15px;line-height:1.7;color:var(--fg-2);text-wrap:pretty")}>{n.desc}</div>
                    </div></React.Fragment>))}</div></>):null}
                    <div style={S("border-top:1px solid var(--border);padding-top:14px;margin-bottom:8px")}><div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px")}>{V.ui.navInvestigate}</div>
                      <div style={S("display:flex;flex-direction:column;gap:6px")}>{arr(V.profileDetail.invActions).map((ia,$index)=>(<React.Fragment key={$index}><button onClick={ia.onRun} style={ia.style}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={S("flex:none")}><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></svg><span style={S("flex:1")}>{ia.label}</span><span style={S("font-size:11px;color:var(--fg-4)")}>{ia.hint}</span></button></React.Fragment>))}</div>
                    </div>
                    <div style={S("display:flex;align-items:center;gap:8px;border-top:1px solid var(--border);padding-top:16px;margin-bottom:10px")}>
                      <span className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;flex:1")}>{V.ui.pMemos}</span>
                      <span className="linklike" onClick={V.profileDetail.onAddMemo} style={S("color:var(--accent);font-size:12px")}>＋ {V.ui.memoNew}</span>
                    </div>
                    {(V.profileDetail.hasMemos)?(<><div style={S("display:flex;flex-direction:column;gap:8px")}>{arr(V.profileDetail.memos).map((mo,$index)=>(<React.Fragment key={$index}><div style={S("border-left:2px solid var(--accent);padding:2px 0 2px 10px")}>{(mo.hasQuote)?(<><div className="v-meta" style={S("color:var(--fg-3);font-style:italic;line-height:1.5")}>“{mo.quote}”</div></>):null}<div className="v-meta" style={S("color:var(--fg-2);margin-top:2px;line-height:1.5")}>{mo.content}</div></div></React.Fragment>))}</div></>):null}
                    {(V.profileDetail.noMemos)?(<><div className="v-meta" style={S("color:var(--fg-4);line-height:1.5")}>{V.ui.pNoMemos}</div></>):null}
                  </div>
                </div>
              </div>
            </div>
          </>):null}

          {(V.invConfirm.open)?(<>
            <div className="scrim" style={S("z-index:95;align-items:center;padding-top:0")}><div className="modal" style={S("width:380px")}>
              <div style={S("padding:20px 20px 6px")}><div className="v-h3" style={S("color:var(--fg)")}>{V.invConfirm.title}</div><div className="v-body" style={S("color:var(--fg-3);margin-top:8px;line-height:1.6")}>{V.invConfirm.body}</div></div>
              <div className="modal-foot" style={S("justify-content:flex-end")}>
                <Button variant="ghost" onClick={V.invConfirm.onCancel}>{V.ui.cancel}</Button>
                <Button variant="primary" onClick={V.invConfirm.onRun}>{V.ui.navInvestigate}</Button>
              </div>
            </div></div>
          </>):null}

          {(V.invResultCard.open)?(<>
            <div className="scrim" style={S("z-index:96;align-items:center;justify-content:center")}>
              <div style={S("width:520px;max-width:92vw;background:var(--bg-app);border:1px solid var(--border-strong);border-radius:var(--r-lg);box-shadow:var(--shadow-modal);overflow:hidden")}>
                <div style={S(`height:3px;background:${V.invResultCard.accent}`)}></div>
                <div style={S("padding:22px 24px")}>
                  <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:14px")}><span style={V.invResultCard.badgeStyle}>{V.invResultCard.typeLabel}</span><span className="v-micro" style={S("color:var(--fg-4)")}>{V.invResultCard.target}</span></div>
                  <div className="v-h3" style={S("color:var(--fg);margin-bottom:12px")}>{V.invResultCard.title}</div>
                  <div style={S("font-size:var(--read-fs);line-height:1.9;color:var(--fg-2);text-wrap:pretty")}>{V.invResultCard.body}</div>
                  <div style={S("display:flex;justify-content:flex-end;margin-top:20px")}><Button variant="primary" onClick={V.invResultCard.onClose}>{V.invResultCard.saveLabel}</Button></div>
                </div>
              </div>
            </div>
          </>):null}

          {(V.confirmFinish)?(<>
            <div className="scrim" style={S("z-index:95;align-items:center;padding-top:0")}><div className="modal" style={S("width:420px")}>
              <div style={S("padding:20px 20px 6px")}><div className="v-h3" style={S("color:var(--fg)")}>{V.ui.finishConfirmT}</div><div className="v-body" style={S("color:var(--fg-3);margin-top:8px;line-height:1.6")}>{V.ui.finishConfirmD}</div>{(V.finishUnfilled)?(<><div className="v-meta" style={S("color:var(--status-progress);margin-top:10px;font-weight:600")}>{V.finishUnfilled}</div></>):null}</div>
              <div className="modal-foot" style={S("justify-content:flex-end")}>
                <Button variant="ghost" onClick={V.onCancelFinish}>{V.ui.cancel}</Button>
                <Button variant="primary" onClick={V.onDoFinish}>{V.ui.submit}</Button>
              </div>
            </div></div>
          </>):null}
          {(V.toast)?(<><div style={S("position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:120;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--r-pill);box-shadow:var(--shadow-popover);padding:9px 18px;display:flex;align-items:center;gap:9px;font:600 12.5px var(--font-sans);color:var(--fg)")}><span style={S("width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none")}></span>{V.toast}</div></>):null}
        </div>

          {(V.quotePickerOpen)?(<>
            <div className="scrim" style={S("z-index:96;align-items:center")} onClick={V.onQuotePickCancel}><div className="modal" style={S("width:320px")} onClick={V.stopModal}>
              <div style={S("padding:16px 18px 8px")}><div className="v-h3" style={S("color:var(--fg)")}>{V.ui.quotePickTitle}</div></div>
              <div style={S("padding:4px 10px 12px;display:flex;flex-direction:column;gap:2px")}>
                {arr(V.quotePicker).map((qp,$index)=>(<React.Fragment key={$index}><div onClick={qp.onPick} style={S("display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:var(--r-sm);cursor:pointer")} styleHover="background:var(--bg-active)"><span style={S("width:22px;height:22px;border-radius:5px;background:var(--bg-elevated-2);color:var(--fg-3);display:inline-flex;align-items:center;justify-content:center;font:600 11px sans-serif;flex:none")}>{qp.num}</span><span style={S("font-size:13px;color:var(--fg-2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{qp.excerpt}</span></div></React.Fragment>))}
                <div style={S("height:1px;background:var(--border);margin:5px 6px")}></div>
                <div onClick={V.onQuotePickNew} style={S("display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:var(--r-sm);cursor:pointer;color:var(--accent)")} styleHover="background:var(--bg-active)"><span style={S("width:22px;height:22px;border-radius:5px;border:1px dashed var(--accent);display:inline-flex;align-items:center;justify-content:center;flex:none")}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 3v10M3 8h10"></path></svg></span><span style={S("font-size:13px;font-weight:600")}>{V.ui.quotePickNew}</span></div>
              </div>
            </div></div>
          </>):null}
      </>
    );
  }
}
