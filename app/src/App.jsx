import React from 'react';

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

// Vector Design System components come from the bundle loaded in index.html.
const DS = () => (typeof window !== 'undefined' && window.VectorDesignSystem_490b73) || {};
export function Button(props) { const C = DS().Button; return C ? <C {...props} /> : <button {...props} />; }
export function StatusIcon(props) { const C = DS().StatusIcon; return C ? <C {...props} /> : null; }

/**
 * Nobody Lies / 노바디 라이즈 — main app component.
 *
 * Everything lives here: screens (state.view), game data tables, the floorplan
 * engine (GEO + buildFloorplan), and the inlined 상황판 / board (PB_* members,
 * state.pb). renderVals() computes every value the UI needs; render() maps that
 * object (V) onto markup. Keeping that split makes the view logic easy to test
 * and mirrors how the design was authored.
 */
export default class App extends React.Component {

  state = {
    lang: 'ko', theme: 'dark', view: 'narrative', stmtMode: 'grid', seenClaims: {},
    viewOpts: { timelineSort: false }, seenClues: [], narrMode: 'prose', verdicts: {},
    annMarks: {}, memos: [], openSent: null, memoFilter: 'all', memoSort: 'recent', memoQuery: '', quotePins: {}, quotePicker: null, editMemoId: null,
    expanded: {}, hls: [], sel: null, dragCard: null, mapTime: 't2', openProfile: null, hlLog: null,
    blanks: {}, solved: { s1: false, s2: false, s3: false, s4: false, s5: false }, reopenActive: {}, reopenUsed: {}, secExpand: {},
    openPicker: null, openCell: null, openAids: false,
    evidence: {}, cellMarks: {},
    stage: 'brief', readIdx: 0, readDone: false, readMemos: {}, readHi: {},
    invSel: { action: null, targets: [] }, invLog: [], pendingInv: null, invResult: null,
    route: 'home', started: false, confirmAbandon: false, confirmFinish: false, selectedCase: 1, resultFold: false, openTerm: null,
    navHist: ['narrative'], navIdx: 0, moreOpen: false,
    leftOpen: true, rightOpen: false, rightView: 'statements', rightProfileId: 'yena', focusMode: false, settingsOpen: false,
    msg: {}, isNarrow: false,
    pb: {
    dragId:null, dragKind:null, dragOff:{x:0,y:0}, moved:false, sel:null, detailId:null,
    pan:{x:0,y:0}, zoom:1, panning:false, panStart:null, drawShape:null,
    connectDrag:null, connectMode:false, connectFrom:null, pins:{},
    tool:null, addOpen:false, timelineOn:true, hlTimeId:null, drawerOpen:true, axisLock:false, mapLock:false,
    times:[{id:'t1',x:225,label:'전날 밤'},{id:'t2',x:675,label:'새벽 3시'},{id:'t3',x:1125,label:'3–8시'},{id:'t4',x:1575,label:'오전'}],
    placed:{},
    memoText:{},
    memoOrder:[], labels:[],
    strings:[], groups:[], binds:[], relPicker:null, size:{}, progress:1,
    msel:[], marquee:null,
    },
  };

  DICT = {
    ko: {
      caseTitle: '산장 살인사건', navCase: '사건', navClue: '단서', navTool: '도구', navNarrative: '보고서', navStatements: '진술',
      navReference: '표기 안내', refShort: '안내', navSoon: '곧', navInvestigate: '조사', navMap: '현장',
      navGraph: '관계 그래프', navBoard: '상황판', graphHint: '조사로 드러난 인물·사건의 연결', logHint: '수행한 조사와 결과가 여기 누적됩니다', soon: '곧', budget: '잔여 조사', difficulty: '난이도', themeLabel: '테마', language: '언어', settings: '설정', toggleLeft: '사이드바', themeDark: '다크', themeLight: '라이트',
      sidebarNote: '범인만 거짓말을 할 수 있다. 무고한 사람은 거짓말하지 않는다. 다만 자기 비밀은 말하지 않는다.',
      nTitle: '사건 보고서', nSub: '공란을 모두 채우면 장이 완성됩니다 · 마지막에 제출', sTitle: '진술', sSub: '다섯 사람의 원문 진술',
      rTitle: '상태 레퍼런스', rSub: '공란 2상태 · 장 2상태 · 셀 마킹',
      segGrid: '구조 뷰', segOriginal: '진술',
      ovVictimK: '피해자', ovVictimV: '윤다인 (30) · 소설가', ovWhenK: '사망 추정', ovWhenV: '새벽 3시 ~ 오전 8시',
      ovBodyK: '시신', ovBodyV: '외상 없음', ovSceneK: '현장', ovSceneV: '방문·창가 테이프, 화로에 연탄',
      secOpen: '미확정', secSealed: '확정', secLocked: '대기', secLockedHint: '앞 장을 완성하면 열립니다', secLockedShort: '잠김', reopenBtn: '재개봉', reopenUsed: '재개봉 사용됨', reopenAvail: '재개봉 가능', reopenDone: '편집 완료', reopenWarn: '장당 한 번만 다시 열 수 있으며, 닫으면 더 이상 수정할 수 없습니다.',
      secDone: '완성', secTodo: '미완성', secFillHint: '공란을 모두 채우면 완성됩니다', clearBlank: '비우기',
      msgFill: '빈칸을 모두 채우세요.',
      kindPerson: '인물', kindPlace: '장소', kindTime: '시각', kindWeapon: '흉기·수단', kindTrick: '정황', kindMotive: '동기', kindClue: '단서', openCand: '열림', modeProse: '서술', modeList: '목록', modeBoard: '보드', listUnrev: '이전 항 확인 후',
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
      mapModePlan: '평면도', mapModeGrid: '도식', navProfile: '용의자', mapHint: '평면도에서 시간대별 주장 위치를, 도식 탭에서 주장 대조표를 봅니다 · 둘은 같은 주장을 시각화·구조화한 것', boardTools: '보드 도구', boardToolsHint: '카드를 위 슬롯으로 끌어 배치하세요.',
      finishReport: '보고서 제출', finishConfirmT: '이대로 사건을 종결할까요?', finishConfirmD: '제출 후에는 되돌릴 수 없습니다. 완성된 보고서가 사건의 전말이 됩니다.', submit: '제출', resultStory: '사건의 전말', endMine: '내가 재구성한 것', endReal: '실제', resultStuck: '조사 예산을 모두 소진했지만 사건을 종결하지 못했습니다.', backHome: '홈으로', pClaim: '본인 주장', pClues: '발견된 단서', pUnknown: '미확인', slotMotive: '동기', slotOpportunity: '기회', slotMeans: '수단', pNew: '신규', pNoClues: '아직 조사로 확보한 단서가 없습니다.', pNoMemos: '이 인물에 대한 메모가 아직 없습니다.', verdictLabel: '심증', vdCleared: '제외', vdWatching: '주목', vdPrime: '유력', vdNone: '미정', verdictHint: '내 판단일 뿐 · 점수 무관', pGuilt: '유죄 요건', pViewSource: '출처 보기',
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
      navGraph: 'Graph', navBoard: 'Board', graphHint: 'Connections between people and events, revealed by investigation', logHint: 'Investigations and their results accumulate here', soon: 'soon', budget: 'Left', difficulty: 'Difficulty', themeLabel: 'Theme', language: 'Language', settings: 'Settings', toggleLeft: 'Sidebar', themeDark: 'Dark', themeLight: 'Light',
      sidebarNote: 'Only the culprit can lie. The innocent do not lie. They only keep their own secrets.',
      nTitle: 'Case report', nSub: 'Fill every blank to complete a section · submit when ready', sTitle: 'Statements', sSub: 'The five statements, verbatim',
      rTitle: 'State reference', rSub: '2 blank states · 2 section states · cell marks',
      segGrid: 'Structure', segOriginal: 'Statements',
      ovVictimK: 'Victim', ovVictimV: 'Kim Chae-won (30) · Novelist', ovWhenK: 'Est. death', ovWhenV: '03:00 – 08:00',
      ovBodyK: 'Body', ovBodyV: 'No external wounds', ovSceneK: 'Scene', ovSceneV: 'Taped door & window, briquette in brazier',
      secOpen: 'Open', secSealed: 'Confirmed', secLocked: 'Pending', secLockedHint: 'Opens when the previous section is completed', secLockedShort: 'Locked', reopenBtn: 'Reopen', reopenUsed: 'Reopen used', reopenAvail: 'Reopen available', reopenDone: 'Done editing', reopenWarn: 'A section can be reopened only once; once closed it can no longer be edited.',
      secDone: 'Complete', secTodo: 'Incomplete', secFillHint: 'Fill every blank to complete', clearBlank: 'Clear',
      msgFill: 'Fill every blank first.',
      kindPerson: 'Person', kindPlace: 'Place', kindTime: 'Time', kindWeapon: 'Means', kindTrick: 'Circumstance', kindMotive: 'Motive', kindClue: 'Clue', openCand: 'Open', modeProse: 'Prose', modeList: 'List', modeBoard: 'Board', listUnrev: 'After previous section',
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
      mapModePlan: 'Plan', mapModeGrid: 'Diagram', navProfile: 'Suspects', mapHint: 'Compare claimed positions by time on the plan; see the claim grid in the Diagram tab · both are the same claims, visualized and structured', boardTools: 'Board tools', boardToolsHint: 'Drag a card onto a slot above.',
      finishReport: 'Submit report', finishConfirmT: 'Close the case as is?', finishConfirmD: 'This cannot be undone. The completed report becomes the full account.', submit: 'Submit', resultStory: 'The full account', endMine: 'My reconstruction', endReal: 'Actual', resultStuck: 'Budget exhausted before the case could be closed.', backHome: 'Home', pClaim: 'Own claim', pClues: 'Found clues', pUnknown: 'Unconfirmed', slotMotive: 'Motive', slotOpportunity: 'Opportunity', slotMeans: 'Means', pNew: 'New', pNoClues: 'No clues secured through investigation yet.', pNoMemos: 'No notes about this person yet.', verdictLabel: 'Verdict', vdCleared: 'Cleared', vdWatching: 'Watching', vdPrime: 'Prime', vdNone: 'Undecided', verdictHint: 'Your call only · no score effect', pGuilt: 'Guilt criteria', pViewSource: 'View source',
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
  AUTO = { 'sakura-t2': true };
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
  COLLECTED_POOL = ['테이프', '연탄', '일산화탄소 중독', '유서', '김선생', '마약', '폭로 임박', '별채 대포폰', '수면제', '둔기', '치정', '유산 상속'];
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
    '수면제': 'M5 8a3 3 0 106 0 3 3 0 00-6 0z M8 5v6',
    '둔기': 'M4 12l5-5 M9 7l3-3 1 1-3 3z',
    '치정': 'M8 13S3 9.5 3 6.2A2.2 2.2 0 018 5a2.2 2.2 0 015 1.2C13 9.5 8 13 8 13z',
    '유산 상속': 'M4 6h8v7H4z M6 6V4h4v2 M6.5 9h3',
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
    '수면제': { fk: '수색 · 소지품', dk: '소지품에서 나온 약물이었다.', fe: 'Search · belongings', de: 'A drug found among belongings.' },
    '둔기': { fk: '현장 주변', dk: '현장 주변에 있던 단단한 물체였다.', fe: 'Around the scene', de: 'A hard object found near the scene.' },
    '치정': { fk: '진술 정황', dk: '진술에 관련 정황이 있었다.', fe: 'Statement context', de: 'Related context appeared in statements.' },
    '유산 상속': { fk: '기록 정황', dk: '기록에 관련 정황이 있었다.', fe: 'Record context', de: 'Related context appeared in records.' },
  };
  termIconPath(w) { return this.ICONS[w] || 'M4 4h8v8H4z'; }
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
  SAVE_VERSION = 1;

  SAVED = {
    progress: ['blanks', 'solved', 'reopenActive', 'reopenUsed', 'evidence', 'invLog',
      'readDone', 'readIdx', 'started', 'stage', 'seenClaims', 'seenClues'],
    annotations: ['memos', 'readMemos', 'hls', 'annMarks', 'cellMarks', 'verdicts', 'quotePins'],
    prefs: ['lang', 'theme', 'narrMode', 'stmtMode', 'viewOpts'],
  };
  /** 상황판에서 저작에 해당하는 것만. `pan`·`zoom`·드래그 중간값은 화면 상태다 */
  SAVED_PB = ['placed', 'memoText', 'memoOrder', 'labels', 'strings', 'groups',
    'binds', 'pins', 'size', 'times'];

  loadSave() {
    let raw;
    try { raw = localStorage.getItem(this.SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || data.v !== this.SAVE_VERSION) return null;
    const next = {};
    for (const group of Object.values(this.SAVED))
      for (const k of group) if (k in data) next[k] = data[k];
    if (data.pb) next.pb = Object.assign({}, this.state.pb, data.pb);
    return next;
  }

  save() {
    const s = this.state;
    const out = { v: this.SAVE_VERSION };
    for (const group of Object.values(this.SAVED)) for (const k of group) out[k] = s[k];
    out.pb = {};
    for (const k of this.SAVED_PB) out.pb[k] = s.pb[k];
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

  PB_REL = { contradict:{label:'모순',color:'var(--label-red)'}, support:{label:'뒷받침',color:'var(--status-review)'}, same:{label:'동일인',color:'var(--accent)'}, timeclash:{label:'시간충돌',color:'var(--status-progress)'}, related:{label:'관련',color:'var(--fg-2)'} };
  PB_LANES = ['전날 밤','새벽 3시','3–8시','오전'];
  PB_CARDS = [
    { id:'sakura', kind:'person', label:'문세라', sub:'산장지기 · 산장 거주', ini:'세', c1:'#F2994A', c2:'#EB5757' },
    { id:'wonyoung', kind:'person', label:'백리원', sub:'아이돌 · 불참', ini:'리', c1:'#F2C94C', c2:'#F2994A' },
    { id:'yuri', kind:'person', label:'오나경', sub:'가수 · 아침 도착', ini:'나', c1:'#4CB782', c2:'#2D9CDB' },
    { id:'burner', kind:'evidence', label:'대포폰', sub:'별채에서 발견', icon:'M5 2.5h6v11H5z M7 12h2' },
    { id:'note', kind:'evidence', label:'위장 유서', sub:'금고 열쇠 동봉', icon:'M4 2.5h6l2.5 2.5v9H4z M9.5 2.5v3H12' },
    { id:'co', kind:'evidence', label:'일산화탄소', sub:'부검 · 직접 사인', icon:'M8 13c3 0 4-2 4-4 0-3-4-6-4-6S4 6 4 9c0 2 1 4 4 4z' },
    { id:'q1', kind:'quote', label:'세라 진술', quote:'"경찰들이 올 때까지 계속 자고 있었습니다."' },
    { id:'q2', kind:'quote', label:'리원 진술', quote:'"새벽 3시쯤 다인 언니한테 전화가 왔어요."' },
    { id:'q3', kind:'quote', label:'세라 진술', quote:'"별채는 걸어서 10분 거리 정도?"' },
  ];
  PB_KINDS = [ {k:'person',title:'인물'}, {k:'evidence',title:'물증'}, {k:'quote',title:'진술'}, {k:'memo',title:'메모'} ];
  get PB_cards(){ const seed=this.buildBoardSeed(); if(seed&&seed.cards&&seed.cards.length) return seed.cards; return this.PB_CARDS; }
  get PB_revEvidence(){ const seed=this.buildBoardSeed(); if(seed&&seed.revealedEvidence) return seed.revealedEvidence; return null; }
  PB_TOOLS = [ {t:'box',label:'박스 (영역)'}, {t:'venn',label:'교집합 (벤다이어그램)'}, {t:'memo',label:'메모'}, {t:'label',label:'텍스트 라벨'} ];
  PB_sizeOf(id){ return this.state.pb.size[id]||'full'; }
  PB_cardW(id){ const z=this.PB_sizeOf(id); return z==='dot'?32:(z==='chip'?128:200); }
  PB_cycleSize(id){ const o={full:'chip',chip:'full'}; this.PB_set({size:Object.assign({},this.state.pb.size,{[id]:o[this.PB_sizeOf(id)]||'chip'})}); }
  PB_centerOf(id){ const p=this.state.pb.placed[id]; return {x:p.x+this.PB_cardW(id)/2, y:p.y+this.PB_cardH(id)/2}; }
  PB_regionMembers(g){ return Object.keys(this.state.pb.placed).filter(id=>{ if(!this.PB_card(id))return false; const c=this.PB_centerOf(id); return c.x>=g.x&&c.x<=g.x+g.w&&c.y>=g.y&&c.y<=g.y+g.h; }); }
  PB_inVennOverlap(g,id){ if(g.shape!=='venn')return false; const c=this.PB_centerOf(id); const rx=g.w*0.32,ry=g.h*0.5,cyv=g.y+g.h/2; const lcx=g.x+g.w*0.32,rcx=g.x+g.w*0.68; const inL=((c.x-lcx)*(c.x-lcx))/(rx*rx)+((c.y-cyv)*(c.y-cyv))/(ry*ry)<=1; const inR=((c.x-rcx)*(c.x-rcx))/(rx*rx)+((c.y-cyv)*(c.y-cyv))/(ry*ry)<=1; return inL&&inR; }
  PB_baseId(id){ return id.split('#')[0]; }
  PB_card(id){ if(this.state.pb.memoText[id]!==undefined) return {id,kind:'memo',label:'메모',text:this.state.pb.memoText[id]}; return this.PB_cards.find(c=>c.id===this.PB_baseId(id)); }
  PB_toWorld(e){ const r=(this._canvas||document.querySelector('[data-canvas]')).getBoundingClientRect(); return {x:(e.clientX-r.left-this.state.pb.pan.x)/this.state.pb.zoom, y:(e.clientY-r.top-this.state.pb.pan.y)/this.state.pb.zoom}; }
  PB_cardH(id){ const z=this.PB_sizeOf(id); if(z==='dot')return 32; if(z==='chip')return 34; const d=this.PB_card(id); return (d&&d.kind==='quote')?96:64; }
  PB_onPieceDown(id,e){ if(this.state.pb.connectMode){ e.stopPropagation(); return; } if(e.shiftKey){ let m=this.state.pb.msel.slice(); if(m.length===0&&this.state.pb.sel&&this.state.pb.sel.kind==='piece'&&this.state.pb.sel.id!==id) m=[this.state.pb.sel.id]; const i=m.indexOf(id); if(i>=0)m.splice(i,1); else m.push(id); this.PB_set({msel:m,sel:null}); e.stopPropagation(); return; } if(this.state.pb.pins&&this.state.pb.pins[id]){ this.PB_set({sel:{kind:'piece',id},dragId:null}); e.stopPropagation(); return; } const bnd=this.PB_bindOf(id); if(bnd){ const w=this.PB_toWorld(e),offs={}; bnd.mem.forEach(mid=>{ if(this.state.pb.placed[mid]) offs[mid]={x:w.x-this.state.pb.placed[mid].x,y:w.y-this.state.pb.placed[mid].y}; }); this.PB_set({dragId:id,dragKind:'multi',multiOff:offs,moved:false,msel:bnd.mem.slice(),sel:{kind:'bind',id:bnd.id}}); e.stopPropagation(); return; } const pos=this.state.pb.placed[id],w=this.PB_toWorld(e); if(this.state.pb.msel.length>1&&this.state.pb.msel.indexOf(id)>=0){ const offs={}; this.state.pb.msel.forEach(mid=>{ if(this.state.pb.placed[mid]) offs[mid]={x:w.x-this.state.pb.placed[mid].x,y:w.y-this.state.pb.placed[mid].y}; }); this.PB_set({dragId:id,dragKind:'multi',multiOff:offs,moved:false}); e.stopPropagation(); return; } this.PB_set({dragId:id,dragKind:'piece',dragOff:{x:w.x-pos.x,y:w.y-pos.y},moved:false,msel:[]}); e.stopPropagation(); }
  PB_onLabelDown(id,e){ if(this.state.pb.pins&&this.state.pb.pins[id]){ this.PB_set({sel:{kind:'label',id},dragId:null}); e.stopPropagation(); return; } const lb=this.state.pb.labels.find(x=>x.id===id),w=this.PB_toWorld(e); this.PB_set({dragId:id,dragKind:'label',dragOff:{x:w.x-lb.x,y:w.y-lb.y},moved:false}); e.stopPropagation(); }
  PB_onGroupMoveDown(id,e){ if(this.state.pb.pins&&this.state.pb.pins[id]){ this.PB_set({sel:{kind:'group',id},dragId:null}); e.stopPropagation(); return; } const g=this.state.pb.groups.find(x=>x.id===id),w=this.PB_toWorld(e); const childG=this.state.pb.groups.filter(x=>x.id!==id&&x.x>=g.x-2&&x.y>=g.y-2&&x.x+x.w<=g.x+g.w+2&&x.y+x.h<=g.y+g.h+2).map(x=>x.id); const mem={}; this.PB_regionMembers(g).forEach(i=>mem[i]=1); childG.forEach(cid=>{ const cg=this.state.pb.groups.find(x=>x.id===cid); this.PB_regionMembers(cg).forEach(i=>mem[i]=1); }); this._carry=Object.keys(mem); this._carryG=childG; this.PB_set({dragId:id,dragKind:'group-move',dragOff:{x:w.x-g.x,y:w.y-g.y},moved:false}); e.stopPropagation(); }
  PB_onGroupResizeDown(id,e){ if(this.state.pb.pins&&this.state.pb.pins[id]){ this.PB_set({sel:{kind:'group',id}}); e.stopPropagation(); return; } this.PB_set({dragId:id,dragKind:'group-resize',moved:true,sel:{kind:'group',id}}); e.stopPropagation(); }
  PB_togglePin(id){ const p=Object.assign({},this.state.pb.pins||{}); if(p[id]) delete p[id]; else p[id]=true; this.PB_set({pins:p}); }
  PB_makeBlock(){ const m=this.state.pb.msel.filter(id=>this.state.pb.placed[id]); if(m.length<2)return; this.PB_set({binds:this.state.pb.binds.concat([{id:'b'+Date.now(),mem:m}]),msel:[],sel:{kind:'bind',id:'b'+Date.now()}}); }
  PB_bindOf(id){ return (this.state.pb.binds||[]).find(b=>b.mem.indexOf(id)>=0); }
  PB_unbind(bid){ this.PB_set({binds:this.state.pb.binds.filter(b=>b.id!==bid),sel:null}); }
  PB_onHandleDown(id,e){ const w=this.PB_toWorld(e); this.PB_set({connectDrag:{from:id,cx:w.x,cy:w.y}}); e.stopPropagation(); }
  PB_onCanvasMove(e){ const s=this.state.pb,w=this.PB_toWorld(e);
    if(s.dragId){ if(!s.moved) this.PB_set({moved:true}); if(s.dragKind==='time'){ this.PB_set({times:s.times.map(x=>x.id===s.dragId?Object.assign({},x,{x:Math.max(40,w.x-s.dragOff.x)}):x)}); } else if(s.dragKind==='multi'){ const np=Object.assign({},s.placed); s.msel.forEach(mid=>{ const o=s.multiOff[mid]; if(o&&np[mid]) np[mid]={x:Math.max(0,w.x-o.x),y:Math.max(0,w.y-o.y)}; }); this.PB_set({placed:np}); } else if(s.dragKind==='label'){ this.PB_set({labels:s.labels.map(x=>x.id===s.dragId?Object.assign({},x,{x:Math.max(0,w.x-s.dragOff.x),y:Math.max(0,w.y-s.dragOff.y)}):x)}); } else if(s.dragKind==='group-move'){ const g=s.groups.find(x=>x.id===s.dragId); const nx=Math.max(0,w.x-s.dragOff.x),ny=Math.max(0,w.y-s.dragOff.y),dx=nx-g.x,dy=ny-g.y; const mem=this._carry||[]; const cg=this._carryG||[]; const np=Object.assign({},s.placed); mem.forEach(id=>{ if(np[id]) np[id]={x:np[id].x+dx,y:np[id].y+dy}; }); this.PB_set({groups:s.groups.map(x=>x.id===s.dragId?Object.assign({},x,{x:nx,y:ny}):(cg.indexOf(x.id)>=0?Object.assign({},x,{x:x.x+dx,y:x.y+dy}):x)),placed:np}); } else if(s.dragKind==='group-resize'){ this.PB_set({groups:s.groups.map(x=>x.id===s.dragId?Object.assign({},x,{w:Math.max(80,w.x-x.x),h:Math.max(60,w.y-x.y)}):x)}); } else { this.PB_set({placed:Object.assign({},s.placed,{[s.dragId]:{x:Math.max(0,w.x-s.dragOff.x),y:Math.max(0,w.y-s.dragOff.y)}})}); } return; }
    if(s.connectDrag){ this.PB_set({connectDrag:Object.assign({},s.connectDrag,{cx:w.x,cy:w.y})}); return; }
    if(s.marquee){ this.PB_set({marquee:Object.assign({},s.marquee,{x2:w.x,y2:w.y})}); return; }
    if(s.panning){ this.PB_set({pan:this.PB_clampPan(e.clientX-s.panStart.x,e.clientY-s.panStart.y)}); return; }
    if(s.drawShape){ this.PB_set({drawShape:Object.assign({},s.drawShape,{x2:w.x,y2:w.y})}); return; }
  }
  PB_onCanvasUp(e){ const s=this.state.pb;
    if(s.dragId){ const wasBind=this.PB_bindOf(s.dragId); if(!s.moved){ const k=s.dragKind==='group-move'?'group':s.dragKind; this.PB_set({sel:wasBind?{kind:'bind',id:wasBind.id}:{kind:k,id:s.dragId},dragId:null,dragKind:null,msel:wasBind?[]:s.msel}); } else this.PB_set({dragId:null,dragKind:null,msel:wasBind?[]:s.msel}); return; }
    if(s.connectDrag){ const w=this.PB_toWorld(e); let hit=null; Object.keys(s.placed).forEach(id=>{ if(id===s.connectDrag.from||!this.PB_card(id))return; const p=s.placed[id]; if(w.x>=p.x&&w.x<=p.x+this.PB_cardW(id)&&w.y>=p.y&&w.y<=p.y+this.PB_cardH(id)) hit=id; }); if(hit){ const from=s.connectDrag.from,pa=s.placed[from],pb=s.placed[hit],rest=s.strings.filter(x=>!((x.a===from&&x.b===hit)||(x.a===hit&&x.b===from))); this.PB_set({connectDrag:null,strings:rest.concat([{a:from,b:hit,rel:'related'}]),relPicker:{a:from,b:hit,x:(pa.x+pb.x)/2+90,y:(pa.y+pb.y)/2+22}}); } else this.PB_set({connectDrag:null}); return; }
    if(s.panning){ this.PB_set({panning:false,panStart:null}); return; }
    if(s.marquee){ const mq=s.marquee,x0=Math.min(mq.x1,mq.x2),y0=Math.min(mq.y1,mq.y2),x1=Math.max(mq.x1,mq.x2),y1=Math.max(mq.y1,mq.y2); const hit=Object.keys(s.placed).filter(id=>{ if(!this.PB_card(id))return false; const p=s.placed[id]; return p.x+this.PB_cardW(id)>=x0&&p.x<=x1&&p.y+this.PB_cardH(id)>=y0&&p.y<=y1; }); this.PB_set({marquee:null,msel:hit,sel:null}); return; }
    if(s.drawShape){ const g=s.drawShape,tl=g.shape==='timeline',x=Math.min(g.x1,g.x2),y=Math.min(g.y1,g.y2),rawW=Math.abs(g.x2-g.x1),rawH=Math.abs(g.y2-g.y1),tiny=rawW<40&&rawH<30,wd=tl?(rawW<200?320:rawW):(tiny?220:rawW),ht=tl?52:(tiny?140:rawH); this.PB_set({groups:s.groups.concat([{id:'g'+Date.now(),x,y,w:wd,h:ht,shape:g.shape,label:g.shape==='venn'?'교집합':(tl?'타임라인':'용의선상'),anchor:null}]), drawShape:null, tool:null, sel:{kind:'group',id:null}}); return; }
  }
  PB_onBgDown(e){ const s=this.state.pb;
    if(s.tool==='box'||s.tool==='venn'||s.tool==='timeline'){ const w=this.PB_toWorld(e); this.PB_set({drawShape:{x1:w.x,y1:w.y,x2:w.x,y2:w.y,shape:s.tool},sel:null}); return; }
    if(s.tool==='memo'){ const w=this.PB_toWorld(e); const id='m'+Date.now(); this.PB_set({memoText:Object.assign({},s.memoText,{[id]:''}),memoOrder:s.memoOrder.concat([id]),placed:Object.assign({},s.placed,{[id]:{x:w.x,y:w.y}}),tool:null,sel:{kind:'piece',id}}); return; }
    if(s.tool==='label'){ const w=this.PB_toWorld(e); const id='l'+Date.now(); this.PB_set({labels:s.labels.concat([{id,x:w.x,y:w.y,text:''}]),tool:null,sel:{kind:'label',id}}); return; }
    if(s.connectMode){ this.PB_set({connectFrom:null,relPicker:null,sel:null}); return; }
    if(e.shiftKey&&!s.mapLock){ const w=this.PB_toWorld(e); this.PB_set({marquee:{x1:w.x,y1:w.y,x2:w.x,y2:w.y},sel:null,msel:[],detailId:null}); return; }
    if(s.mapLock){ this.PB_set({hlTimeId:null,addOpen:false,sel:null,detailId:null,relPicker:null,msel:[]}); return; }
    this.PB_set({panning:true,panStart:{x:e.clientX-s.pan.x,y:e.clientY-s.pan.y},hlTimeId:null,addOpen:false,sel:null,detailId:null,relPicker:null,msel:[]});
  }
  PB_onPieceClick(id){ if(!this.state.pb.connectMode) return; const f=this.state.pb.connectFrom; if(!f){ this.PB_set({connectFrom:id}); return; } if(f===id){ this.PB_set({connectFrom:null}); return; } const pa=this.state.pb.placed[f],pb=this.state.pb.placed[id],rest=this.state.pb.strings.filter(x=>!((x.a===f&&x.b===id)||(x.a===id&&x.b===f))); this.PB_set({strings:rest.concat([{a:f,b:id,rel:'related'}]),relPicker:{a:f,b:id,x:(pa.x+pb.x)/2+90,y:(pa.y+pb.y)/2+22},connectFrom:null}); }
  PB_setRel(rel){ const rp=this.state.pb.relPicker; if(!rp)return; const rest=this.state.pb.strings.filter(s=>!((s.a===rp.a&&s.b===rp.b)||(s.a===rp.b&&s.b===rp.a))); this.PB_set({strings:rest.concat([{a:rp.a,b:rp.b,rel}]),relPicker:null}); }
  PB_delRel(){ const rp=this.state.pb.relPicker; this.PB_set({strings:this.state.pb.strings.filter(s=>!((s.a===rp.a&&s.b===rp.b)||(s.a===rp.b&&s.b===rp.a))),relPicker:null}); }
  PB_freshId(base){ if(!this.state.pb.placed[base]) return base; let n=2; while(this.state.pb.placed[base+'#'+n]) n++; return base+'#'+n; }
  PB_addPiece(id){ const nid=this.PB_freshId(id); this.PB_set({placed:Object.assign({},this.state.pb.placed,{[nid]:{x:300+Math.random()*160,y:180+Math.random()*180}}),sel:{kind:'piece',id:nid}}); }
  PB_dupPiece(id){ const d=this.PB_card(id),p=this.state.pb.placed[id]; if(!p)return; if(d.kind==='memo'){ const nid='m'+Date.now(); this.PB_set({memoText:Object.assign({},this.state.pb.memoText,{[nid]:d.text}),memoOrder:this.state.pb.memoOrder.concat([nid]),placed:Object.assign({},this.state.pb.placed,{[nid]:{x:p.x+24,y:p.y+24}}),sel:{kind:'piece',id:nid}}); return; } const nid=this.PB_freshId(this.PB_baseId(id)); this.PB_set({placed:Object.assign({},this.state.pb.placed,{[nid]:{x:p.x+24,y:p.y+24}}),sel:{kind:'piece',id:nid}}); }
  PB_removePiece(id){ const p=Object.assign({},this.state.pb.placed); delete p[id]; this.PB_set({placed:p,strings:this.state.pb.strings.filter(s=>s.a!==id&&s.b!==id)}); }
  PB_newMemo(){ const id='m'+Date.now(); this.PB_set({memoText:Object.assign({},this.state.pb.memoText,{[id]:''}),memoOrder:this.state.pb.memoOrder.concat([id]),placed:Object.assign({},this.state.pb.placed,{[id]:{x:320+Math.random()*120,y:200+Math.random()*140}}),sel:{kind:'piece',id}}); }
  PB_deleteSel(){ const sel=this.state.pb.sel; if(!sel)return; if(sel.kind==='piece') this.PB_removePiece(sel.id); else if(sel.kind==='label') this.PB_set({labels:this.state.pb.labels.filter(x=>x.id!==sel.id)}); else if(sel.kind==='group') this.PB_set({groups:this.state.pb.groups.filter(x=>x.id!==sel.id)}); this.PB_set({sel:null,detailId:null}); }
  PB_setZoom(z){ if(this.state.pb.mapLock)return; this.PB_set({zoom:Math.max(0.5,Math.min(1.6,z))}); }
  PB_clampPan(x,y){ return { x:Math.min(40,x), y:Math.min(40,y) }; }
  PB_laneIdx(x){ return Math.max(0,Math.min(3,Math.floor(x/450))); }
  PB_bandOf(cx){ const ts=this.state.pb.times.slice().sort((a,b)=>a.x-b.x); if(!ts.length)return null; let owner=ts[0].id; for(const t of ts){ if(cx>=t.x-90) owner=t.id; } return owner; }
  PB_onTimeDown(id,e){ const t=this.state.pb.times.find(x=>x.id===id),w=this.PB_toWorld(e); this.PB_set({dragId:id,dragKind:'time',dragOff:{x:w.x-t.x,y:0},moved:false}); e.stopPropagation(); }
  PB_addTime(){ const xs=this.state.pb.times.map(t=>t.x),nx=(xs.length?Math.max.apply(null,xs):200)+250; const id='t'+Date.now(); this.PB_set({times:this.state.pb.times.concat([{id,x:nx,label:'새 시간'}]),sel:{kind:'time',id}}); }
  PB_delTime(id){ this.PB_set({times:this.state.pb.times.filter(t=>t.id!==id),sel:null,hlTimeId:this.state.pb.hlTimeId===id?null:this.state.pb.hlTimeId}); }
  PB_render(){ this.PB_key();
    const s=this.state.pb;
    const ln=this.state.lang;
    const placedIds=Object.keys(s.placed).filter(id=>this.PB_card(id));
    const cx={},cy={}; placedIds.forEach(id=>{ cx[id]=s.placed[id].x+90; cy[id]=s.placed[id].y+26; });
    const selP=s.sel&&s.sel.kind==='piece'?s.sel.id:null;
    const vennHot={}; s.groups.forEach(g=>{ if(g.shape==='venn') placedIds.forEach(id=>{ if(this.PB_inVennOverlap(g,id)) vennHot[id]=true; }); });
    const _selBind=(s.sel&&s.sel.kind==='bind')?(s.binds||[]).find(x=>x.id===s.sel.id):null; const _bindMem=_selBind?_selBind.mem:[];
    const pieces=placedIds.map(id=>{ const d=this.PB_card(id); if(!d) return null; const pos=s.placed[id],selc=s.connectFrom===id,seld=selP===id; const cxw=pos.x+this.PB_cardW(id)/2; const laned=s.timelineOn&&pos.y<56; const own=laned?this.PB_bandOf(cxw):null; const tmk=own?s.times.find(t=>t.id===own):null; const tl=tmk?tmk.label:''; const hot=s.hlTimeId!==null&&laned&&own===s.hlTimeId; const dim=s.hlTimeId!==null&&laned&&own!==s.hlTimeId; const sz=this.PB_sizeOf(id); const vh=vennHot[id];
      const typeColor=d.kind==='person'?d.c1:(d.kind==='evidence'?'var(--accent)':(d.kind==='memo'?'#F2C94C':(d.kind==='quote'?(d.spk||'var(--fg-3)'):'var(--fg-3)')));
      const inBind=_bindMem.indexOf(id)>=0; const on=selc||seld||hot||vh||inBind||(s.msel.indexOf(id)>=0); const bd=on?'var(--accent)':'var(--border-strong)';
      return { id, tierFull:sz==='full',tierChip:sz==='chip',tierDot:sz==='dot', notPersonChip:d.kind!=='person',
        isPerson:d.kind==='person',isEvidence:d.kind==='evidence',isQuote:d.kind==='quote',isMemo:d.kind==='memo',notMemo:d.kind!=='memo',
        label:d.label,sub:d.sub||'',hasSub:!!d.sub,ini:d.ini||(d.kind==='memo'?'메':(d.kind==='quote'?'\u201C':'')),icon:d.icon,quote:d.quote||'',text:d.text||'',
        typeLabel:d.kind==='person'?'인물':(d.kind==='evidence'?'물증':(d.kind==='memo'?'메모':'진술')),typeColor,laned,timeLabel:tl,
        avStyle:{width:'24px',height:'24px',borderRadius:'5px',flex:'none',display:'inline-flex',alignItems:'center',justifyContent:'center',font:'600 10px var(--font-sans)',color:'#0A0A0B',background:'linear-gradient(135deg,'+d.c1+','+(d.c2||d.c1)+')'},
        chipStyle:{display:'flex',alignItems:'center',gap:'7px',width:'128px',border:'1px solid '+bd,borderLeft:'3px solid '+typeColor,background:'var(--bg-elevated)',borderRadius:'var(--r-md)',padding:'6px 9px',boxShadow:on?'0 0 0 2px var(--accent-soft)':'var(--shadow-card)'},
        chipDot:{width:'16px',height:'16px',borderRadius:d.kind==='person'?'50%':'4px',flex:'none',background:typeColor,color:'#0A0A0B',display:'inline-flex',alignItems:'center',justifyContent:'center',font:'600 9px var(--font-sans)'},
        dotStyle:{width:'28px',height:'28px',borderRadius:d.kind==='person'?'50%':'6px',background:d.kind==='person'?('linear-gradient(135deg,'+d.c1+','+(d.c2||d.c1)+')'):typeColor,border:'2px solid '+(on?'var(--accent)':'var(--bg-app)'),boxShadow:on?'0 0 0 2px var(--accent-soft)':'var(--shadow-card)',display:'flex',alignItems:d.kind==='quote'?'flex-start':'center',justifyContent:'center',font:(d.kind==='quote'?'700 22px':'700 10px')+' var(--font-sans)',lineHeight:d.kind==='quote'?'20px':'1',color:'#0A0A0B'},
        wrapCls:'pb-piece'+((selc||seld)?' pb-sel':''),
        pinned:!!(s.pins&&s.pins[id]),
        wrapStyle:{left:pos.x+'px',top:pos.y+'px',zIndex:(selc||seld)?20:5,cursor:s.connectMode?'crosshair':((s.pins&&s.pins[id])?'default':'grab'),opacity:dim?0.32:1,transition:'opacity .15s'},
        cardStyle:{width:'200px',border:'1px solid '+bd,borderLeft:'3px solid '+typeColor,background:'var(--bg-elevated)',borderRadius:'var(--r-md)',padding:'9px 11px 10px',boxShadow:on?'0 0 0 2px var(--accent-soft)':'var(--shadow-card)'},
        handleStyle:{position:'absolute',right:'2px',top:'calc(50% - 6px)',width:'12px',height:'12px',borderRadius:'50%',background:'var(--accent)',border:'2px solid var(--bg-app)',cursor:'crosshair'},
        portInStyle:{position:'absolute',left:'2px',top:'calc(50% - 6px)',width:'12px',height:'12px',borderRadius:'50%',background:'var(--accent)',border:'2px solid var(--bg-app)',cursor:'crosshair'},
        onPortInDown:(e)=>this.PB_onHandleDown(id,e),
        onDown:(e)=>this.PB_onPieceDown(id,e), onClick:()=>this.PB_onPieceClick(id), onHandleDown:(e)=>this.PB_onHandleDown(id,e),
        onText:(e)=>this.PB_set({memoText:Object.assign({},s.memoText,{[id]:e.target.value})}), stopDown:(e)=>{ if(e.stopPropagation)e.stopPropagation(); } };
    }).filter(Boolean);
    const portR=(id)=>({x:s.placed[id].x+this.PB_cardW(id),y:s.placed[id].y+this.PB_cardH(id)/2}), portL=(id)=>({x:s.placed[id].x,y:s.placed[id].y+this.PB_cardH(id)/2});
    const rp=s.relPicker;
    const strings=s.strings.filter(st=>s.placed[st.a]&&s.placed[st.b]).map(st=>{ const active=rp&&((rp.a===st.a&&rp.b===st.b)||(rp.a===st.b&&rp.b===st.a)); const r=active?{label:this.PB_REL[st.rel].label,color:'var(--accent)'}:(this.PB_REL[st.rel]||this.PB_REL.same); const pa=portR(st.a),pb=portL(st.b); const mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2;
      return { x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y,color:r.color,lineStyle:{stroke:r.color,strokeWidth:1.5,strokeDasharray:'5 4'},relLabel:r.label,labelStyle:{position:'absolute',left:mx+'px',top:my+'px',transform:'translate(-50%,-50%)',zIndex:6,background:'var(--bg-subtle)',border:'1px solid '+r.color,color:r.color,borderRadius:'var(--r-pill)',padding:'1px 8px',fontSize:'10px',fontWeight:600,cursor:'pointer'},onEdit:()=>{ this.PB_set({relPicker:{a:st.a,b:st.b,x:mx,y:my}}); } }; });
    const cd=s.connectDrag; const cdp=cd?portR(cd.from):null; const liveLine={show:!!cd,x1:cdp?cdp.x:0,y1:cdp?cdp.y:0,x2:cd?cd.cx:0,y2:cd?cd.cy:0};
    const placedSet={}; placedIds.forEach(id=>placedSet[id]=1);
    const revEv=this.PB_revEvidence;
    const drawer=this.PB_KINDS.map(kd=>{ let ids=kd.k==='memo'?s.memoOrder.slice():this.PB_cards.filter(c=>c.kind===kd.k).map(c=>c.id);
      if(kd.k==='evidence'&&revEv) ids=ids.filter(id=>revEv[id]);
      const locked=kd.k==='evidence'&&ids.length===0;
      return { title:kd.title, isMemo:kd.k==='memo', onNew:()=>this.PB_newMemo(), locked, lockedHint:'조사 전 · 없음',
        dot:{width:'7px',height:'7px',borderRadius:kd.k==='person'?'50%':'2px',flex:'none',background:kd.k==='person'?'var(--fg-3)':(kd.k==='evidence'?'var(--accent)':(kd.k==='memo'?'#F2C94C':'var(--fg-3)'))},
        items:ids.map(id=>{ const d=this.PB_card(id); const cnt=Object.keys(s.placed).filter(pid=>this.PB_baseId(pid)===id).length; const placed=cnt>0;
          return { label:d.kind==='memo'?((d.text||'빈 메모').slice(0,16)):d.label, placed, count:cnt, onAdd:()=>this.PB_addPiece(id),
            rowStyle:{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',border:'1px solid '+(placed?'var(--accent)':'var(--border-strong)'),borderRadius:'var(--r-sm)',cursor:'pointer',background:placed?'var(--accent-soft)':'transparent'},
            badgeStyle:{fontSize:'10px',fontWeight:700,color:'var(--fg-on-accent)',background:'var(--accent)',borderRadius:'var(--r-pill)',padding:'0 6px',flex:'none'} }; }) }; });
    const ds=s.drawShape,tempGroup={show:!!ds,style:ds?{position:'absolute',left:Math.min(ds.x1,ds.x2)+'px',top:Math.min(ds.y1,ds.y2)+'px',width:Math.abs(ds.x2-ds.x1)+'px',height:Math.abs(ds.y2-ds.y1)+'px',border:'1.5px dashed var(--accent)',borderRadius:ds.shape==='venn'?'var(--r-md)':'var(--r-md)',background:'var(--accent-soft)',zIndex:1}:{}};
    const selG=s.sel&&s.sel.kind==='group'?s.sel.id:null;
    const groups=s.groups.map(g=>{ const isVenn=g.shape==='venn',isTl=g.shape==='timeline'; const sg=selG===g.id; const cbc=sg?'var(--accent)':'var(--border-strong)';
      const boxStyle=isVenn?{position:'absolute',left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px',background:'transparent',zIndex:1}:isTl?{position:'absolute',left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px',borderTop:'1.5px '+(sg?'solid ':'dashed ')+cbc,background:'transparent',zIndex:1}:{position:'absolute',left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px',border:'1.5px '+(sg?'solid ':'dashed ')+cbc,borderRadius:'var(--r-md)',background:'rgba(255,255,255,.02)',zIndex:1};
      const circ={position:'absolute',top:'0',width:'64%',height:'100%',borderRadius:'50%',border:'1.5px dashed '+cbc,background:'rgba(76,141,255,.04)'};
      const an=g.anchor?this.PB_card(g.anchor):null,anColor=an?(an.kind==='person'?an.c1:'var(--accent)'):null;
      const tlTicks=isTl?this.PB_LANES.map((lb,i)=>({label:lb,style:{position:'absolute',left:((i+0.5)/this.PB_LANES.length*100)+'%',top:'2px',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'},tickStyle:{width:'1px',height:'7px',background:'var(--border-strong)'},labelStyle:{color:'var(--fg-4)',fontSize:'10px',whiteSpace:'nowrap'}})):[];
      return { label:g.label, isVenn, isTl, notTl:!isTl, empty:!isTl&&this.PB_regionMembers(g).length===0, boxStyle, circleL:Object.assign({},circ,{left:'0'}), circleR:Object.assign({},circ,{right:'0'}), tlTicks,
        hasAnchor:!!an, anchorIni:an?(an.ini||'"'):'', anchorLabel:an?an.label:'', anchorColor:anColor,
        anchorSlotStyle:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'16px',height:'16px',borderRadius:'4px',border:an?'none':'1px dashed var(--border-strong)',background:an?('linear-gradient(135deg,'+anColor+','+anColor+')'):'transparent',color:'#0A0A0B',font:'700 9px var(--font-sans)',cursor:'pointer',flex:'none'},
        onClearAnchor:()=>this.PB_set({groups:s.groups.map(x=>x.id===g.id?Object.assign({},x,{anchor:null}):x)}),
        labelWrapStyle:{position:'absolute',left:isVenn?'50%':(isTl?'8px':'18px'),top:'-11px',transform:isVenn?'translateX(-50%)':'none',display:'flex',alignItems:'center',gap:'5px',background:'var(--bg-subtle)',padding:'0 4px'},
        labelStyle:{background:'transparent',border:'none',outline:'none',boxShadow:'none',color:an?anColor:'var(--fg-3)',font:'600 11px var(--font-sans)',padding:0,maxWidth:'140px'},
        stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },onLabel:(e)=>this.PB_set({groups:s.groups.map(x=>x.id===g.id?Object.assign({},x,{label:e.target.value}):x)}),onMoveDown:(e)=>this.PB_onGroupMoveDown(g.id,e),onResizeDown:(e)=>this.PB_onGroupResizeDown(g.id,e) }; });
    const selL=s.sel&&s.sel.kind==='label'?s.sel.id:null;
    const labels=s.labels.map(lb=>({text:lb.text,selected:selL===lb.id,onDel:()=>{ this.PB_set({labels:s.labels.filter(x=>x.id!==lb.id),sel:null}); },delStop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },wrapStyle:{left:lb.x+'px',top:lb.y+'px',zIndex:4,display:'flex',alignItems:'center',gap:'4px',cursor:'grab'},inputStyle:{background:selL===lb.id?'var(--accent-soft)':'transparent',pointerEvents:selL===lb.id?'auto':'none'},onDown:(e)=>this.PB_onLabelDown(lb.id,e),stopIfEdit:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },onText:(e)=>this.PB_set({labels:s.labels.map(x=>x.id===lb.id?Object.assign({},x,{text:e.target.value}):x)})}));
    const markers=s.times.slice().sort((a,b)=>a.x-b.x).map(t=>{ const sel=s.sel&&s.sel.kind==='time'&&s.sel.id===t.id; const active=s.hlTimeId===t.id; return { id:t.id, label:t.label, selected:sel,
      onDown:(e)=>this.PB_onTimeDown(t.id,e), onHi:()=>this.PB_set({hlTimeId:active?null:t.id}),
      onLabel:(e)=>this.PB_set({times:s.times.map(x=>x.id===t.id?Object.assign({},x,{label:e.target.value}):x)}),
      onDel:()=>this.PB_delTime(t.id), stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); }, locked:false, notLocked:true,
      wrapStyle:{position:'absolute',left:t.x+'px',top:'8px',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'grab',zIndex:sel?12:6},
      tickStyle:{width:'2px',height:'11px',background:active?'var(--accent)':'var(--border-strong)'},
      inputStyle:{background:sel?'var(--accent-soft)':'transparent',border:'none',outline:'none',textAlign:'center',color:active?'var(--accent)':'var(--fg-3)',font:(active?'600':'500')+' 12px var(--font-sans)',width:'72px',pointerEvents:sel?'auto':'none',borderRadius:'4px'},
      guideStyle:active?{position:'absolute',left:t.x+'px',top:'56px',width:'1px',height:'1544px',background:'var(--accent-soft)',pointerEvents:'none',zIndex:0}:null }; });
    const relPicker={open:!!rp,stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },style:rp?{position:'absolute',left:rp.x+'px',top:rp.y+'px',zIndex:30,minWidth:'150px'}:{},onDelete:()=>this.PB_delRel(),opts:Object.keys(this.PB_REL).map(k=>({label:this.PB_REL[k].label,onPick:()=>this.PB_setRel(k),dot:{width:'9px',height:'9px',borderRadius:'3px',flex:'none',background:this.PB_REL[k].color}}))};
    let toolbar={show:false,style:{},actions:[]};
    if(s.sel){ let ex,ey,acts=[]; const pinned=!!(s.pins&&s.pins[s.sel.id]); const abtn=(label,fn,danger)=>({label,onClick:fn,stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },style:{cursor:'pointer',fontSize:'12px',fontWeight:500,color:danger?'var(--label-red)':'var(--fg-2)',padding:'0 4px'}});
      const pinBtn=abtn(pinned?'고정 해제':'고정',()=>this.PB_togglePin(s.sel.id));
      if(s.sel.kind==='piece'){ const p=s.placed[s.sel.id],d=this.PB_card(s.sel.id); if(p){ ex=p.x; ey=p.y; acts.push(abtn(this.PB_sizeOf(s.sel.id)==='chip'?'크게':'작게',()=>this.PB_cycleSize(s.sel.id))); if(d.kind!=='memo') acts.push(abtn('상세',()=>this.PB_set({detailId:s.sel.id,detailFull:false}))); acts.push(abtn('복제',()=>this.PB_dupPiece(s.sel.id))); acts.push(pinBtn); acts.push(abtn('삭제',()=>this.PB_deleteSel(),true)); } }
      else if(s.sel.kind==='label'){ ex=undefined; }
      else if(s.sel.kind==='group'){ const g=s.groups.find(x=>x.id===s.sel.id); if(g){ ex=g.x; ey=g.y; acts.push(pinBtn); acts.push(abtn('삭제',()=>this.PB_deleteSel(),true)); } }
      if(ex!==undefined) toolbar={show:true,actions:acts,style:{position:'absolute',left:ex+'px',top:(ey-34)+'px',zIndex:25,display:'flex',alignItems:'center',gap:'10px',background:'var(--bg-elevated)',border:'1px solid var(--border-strong)',borderRadius:'var(--r-sm)',boxShadow:'var(--shadow-popover)',padding:'5px 9px'}};
    }
    let detail={open:false,style:{}};
    if(s.detailId&&s.placed[s.detailId]){ const d=this.PB_card(s.detailId),p=s.placed[s.detailId]; const tc=d.kind==='person'?d.c1:(d.kind==='evidence'?'var(--accent)':(d.kind==='memo'?'#F2C94C':'var(--fg-3)'));
      detail={open:true,color:tc,typeLabel:d.kind==='person'?'인물':(d.kind==='evidence'?'물증':(d.kind==='memo'?'메모':'진술')),label:d.label,sub:d.sub||'',hasSub:!!d.sub,body:d.quote||d.text||'',hasBody:!!(d.quote||d.text),claim:d.claim||'',hasClaim:!!d.claim,claimLabel:ln==='ko'?'본인 주장':'Own claim',clues:d.clues||[],hasClues:!!(d.clues&&d.clues.length),cluesLabel:ln==='ko'?'발견된 단서':'Found clues',slots:d.slots||[],hasSlots:!!(d.slots&&d.slots.length),unknownLabel:ln==='ko'?'미확인':'Unknown',hasFull:!!d.fullStmt,fullText:d.fullStmt||'',fullOpen:!!s.detailFull,fullChevron:s.detailFull?'rotate(90deg)':'rotate(0deg)',fullLabel:ln==='ko'?'진술 원문':'Full statement',onToggleFull:()=>this.PB_set({detailFull:!s.detailFull}),onClose:()=>this.PB_set({detailId:null}),stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },style:{position:'absolute',left:(p.x+this.PB_cardW(s.detailId)+10)+'px',top:p.y+'px',zIndex:35,width:'240px',background:'var(--bg-elevated)',border:'1px solid var(--border-strong)',borderRadius:'var(--r-md)',boxShadow:'var(--shadow-modal)',padding:'14px 16px'}}; }
    const scX=150/2600,scY=100/1600,dots=placedIds.map(id=>({style:{position:'absolute',left:(s.placed[id].x*scX)+'px',top:(s.placed[id].y*scY)+'px',width:'5px',height:'5px',borderRadius:'50%',background:this.PB_card(id).kind==='person'?'var(--accent)':'var(--fg-3)'}}));
    const mmMap=(e)=>{ const el=e.currentTarget.getBoundingClientRect(); const mx=(e.clientX-el.left)/scX, my=(e.clientY-el.top)/scY; return this.PB_clampPan(-(mx*s.zoom)+350, -(my*s.zoom)+260); };
    const minimap={dots,onDown:(e)=>{ if(s.mapLock)return; this._mmDrag=true; this.PB_set({pan:mmMap(e)}); },onMove:(e)=>{ if(this._mmDrag&&!s.mapLock) this.PB_set({pan:mmMap(e)}); },onUp:()=>{ this._mmDrag=false; },viewport:{pointerEvents:'none',position:'absolute',left:((-s.pan.x/s.zoom)*scX)+'px',top:((-s.pan.y/s.zoom)*scY)+'px',width:((700/s.zoom)*scX)+'px',height:((520/s.zoom)*scY)+'px',border:'1px solid var(--accent)',background:'var(--accent-soft)'}};
    const tool=s.tool;
    return { drawer,pieces,strings,liveLine,groups,tempGroup,labels,markers,onAddTime:()=>this.PB_addTime(),tlStop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); },relPicker,minimap,toolbar,detail,timelineOn:s.timelineOn,
      worldStyle:{position:'absolute',left:0,top:0,width:'2600px',height:'1600px',transformOrigin:'0 0',transform:'translate('+s.pan.x+'px,'+s.pan.y+'px) scale('+s.zoom+')'},
      tlBandTop: (s.mapLock?0:((-s.pan.y)/s.zoom))+'px',
      canvasCursor: tool?'copy':(s.panning?'grabbing':'default'),
      addChip:'v-chip'+(s.addOpen||tool?' active':''), addOpen:s.addOpen, onToggleAdd:()=>this.PB_set({addOpen:!s.addOpen,tool:null}),
      tools:this.PB_TOOLS.map(t=>({label:t.label,onPick:()=>this.PB_set({tool:t.t,addOpen:false}),dot:{width:'8px',height:'8px',borderRadius:t.t==='venn'?'50%':'2px',flex:'none',background:'var(--fg-3)'}})),
      connChip:'v-chip'+(s.connectMode?' active':''), onToggleConn:()=>this.PB_set({connectMode:!s.connectMode,connectFrom:null,tool:null}),
      tlChip:'v-chip'+(s.timelineOn?' active':''), onToggleTl:()=>this.PB_set({timelineOn:!s.timelineOn,hlTimeId:null}),
      mapLockChip:'v-chip'+(s.mapLock?' active':''), onToggleMapLock:()=>this.PB_set({mapLock:!s.mapLock,panning:false}),
      drawerOpen:s.drawerOpen, drawerClosed:!s.drawerOpen, drawerTitle: ln==='ko'?'자료':'Sources', onToggleDrawer:()=>this.PB_set({drawerOpen:!s.drawerOpen}),
      hint: tool?'클릭/드래그해 배치':(s.connectMode?(s.connectFrom?'이을 두 번째 카드를 누르세요':'연결할 첫 카드를 누르세요'):'클릭=선택 · 드래그=이동 · 우측 점 끌어 연결 · 빈 곳=이동'),
      zoomPct:Math.round(s.zoom*100)+'%',onZoomIn:()=>this.PB_setZoom(s.zoom+0.15),onZoomOut:()=>this.PB_setZoom(s.zoom-0.15),
      onHome:()=>this.PB_set({zoom:1,pan:{x:40,y:40}}),
      onFit:()=>{ const ids=placedIds; if(!ids.length){ this.PB_set({zoom:1,pan:{x:0,y:0}}); return; } let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; ids.forEach(id=>{ const p=s.placed[id]; x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x+this.PB_cardW(id)); y1=Math.max(y1,p.y+this.PB_cardH(id)); }); const pad=60,bw=x1-x0+pad*2,bh=y1-y0+pad*2,z=Math.max(0.5,Math.min(1.3,Math.min(700/bw,520/bh))); this.PB_set({zoom:z,pan:{x:-(x0-pad)*z+40,y:-(y0-pad)*z+40}}); },
      onReset:()=>this.PB_set({placed:{},memoText:{},memoOrder:[],labels:[],groups:[],strings:[],times:this.state.pb.times,sel:null,detailId:null,relPicker:null,pan:{x:0,y:0},zoom:1}),
      onBgDown:(e)=>this.PB_onBgDown(e),onCanvasMove:(e)=>this.PB_onCanvasMove(e),onCanvasUp:(e)=>this.PB_onCanvasUp(e),
      marquee: s.marquee?{ style:{position:'absolute',left:Math.min(s.marquee.x1,s.marquee.x2)+'px',top:Math.min(s.marquee.y1,s.marquee.y2)+'px',width:Math.abs(s.marquee.x2-s.marquee.x1)+'px',height:Math.abs(s.marquee.y2-s.marquee.y1)+'px',border:'1px solid var(--accent)',background:'var(--accent-soft)',zIndex:30,pointerEvents:'none'} }:null,
      bindBox: null,
      mselBar: (s.sel&&s.sel.kind==='bind'&&(this.state.pb.binds||[]).find(b=>b.id===s.sel.id))?{ bind:true, word:'결속', label:'해제', clearLabel:'선택 해제', count:((this.state.pb.binds||[]).find(b=>b.id===s.sel.id)||{mem:[]}).mem.length, onBlock:()=>this.PB_unbind(s.sel.id), onClear:()=>this.PB_set({sel:null}), stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); } } : (s.msel.length>=2?{ word:'선택', label:'묶기', clearLabel:'해제', count:s.msel.length, onBlock:()=>this.PB_makeBlock(), onClear:()=>this.PB_set({msel:[]}), stop:(e)=>{ if(e.stopPropagation)e.stopPropagation(); } }:null) };
  }

  PB_set(patch){ this.setState(s=>({ pb: Object.assign({}, s.pb, patch) })); }
  PB_key(){ if(this._pbKey) return; this._pbKey=(e)=>{ const t=document.activeElement,tag=t&&t.tagName; if(tag==='INPUT'||tag==='TEXTAREA')return; if(this.state.view!=='board')return; if((e.key==='Delete'||e.key==='Backspace')&&this.state.pb&&this.state.pb.sel){ e.preventDefault(); this.PB_deleteSel(); } }; window.addEventListener('keydown',this._pbKey); }

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
      board: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><path d="M7 4.75h2M4.75 7v2"/>',
    };
    return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, dangerouslySetInnerHTML: { __html: I[name] || '' } });
  }
  bottomItem(view, cur, key, label, icon, onClick) {
    const active = view === cur;
    return { label, icon: this.ICO(icon), onClick, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '7px 2px 8px', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--fg-3)', background: active ? 'var(--accent-soft)' : 'transparent' } };
  }
  buildBottomNav(view) {
    const t = this.T();
    return [
      this.bottomItem(view, 'narrative', 'n', t.navNarrative, 'report', () => this.setView('narrative')),
      this.bottomItem(view, 'statements', 's', t.navStatements, 'depo', () => this.setView('statements')),
      this.bottomItem(view, 'map', 'm', t.navMap, 'map', () => this.setView('map')),
      this.bottomItem(view, 'profile', 'p', t.navProfile, 'suspect', () => this.setView('profile')),
      { label: t.more || '더보기', icon: this.ICO('more'), onClick: () => this.setState({ moreOpen: true }), style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '7px 2px 8px', cursor: 'pointer', color: (['overview', 'memo', 'map', 'reference'].indexOf(view) >= 0) ? 'var(--accent)' : 'var(--fg-3)', background: (['overview', 'memo', 'map', 'reference'].indexOf(view) >= 0) ? 'var(--accent-soft)' : 'transparent' } },
    ];
  }
  buildMoreNav(view) {
    const t = this.T();
    const item = (v, label, icon) => ({ label, icon: this.ICO(icon), onClick: () => this.setState({ moreOpen: false }, () => this.setView(v)), style: { display: 'flex', alignItems: 'center', gap: '10px', color: view === v ? 'var(--accent)' : 'var(--fg-2)' } });
    return [ item('overview', t.navOverview, 'overview'), item('memo', t.navMemo, 'memo'), item('graph', t.navGraph, 'graph'), item('board', t.navBoard, 'board'), item('reference', t.navReference, 'guide') ];
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
    return this.PEOPLE.map(p => { const d = per[p.id]; const memos = (this.state.memos || []).filter(m => m.targetType === 'person' && m.targetId === p.id); return { id: p.id, name: p.name, color: p.color, ini: p.ini, color: p.color, avStyle: this.avStyle(p, 30), job: ln === 'ko' ? p.jobKo : p.jobEn, age: (ln === 'ko' ? p.sexKo : p.sexEn) + ' · ' + p.age, rel: ln === 'ko' ? p.relKo : p.relEn, claim: p.claimKo, clues: d.clues.map(c => ({ text: c.text, action: c.action, isNew: c.isNew, onJump: () => this.goToLog(c.logKey) })), hasClues: d.clues.length > 0, noClues: d.clues.length === 0,
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
  boardJump(cardId, target){ const pid=(cardId||'').replace(/^(p_|q_|e_)/,''); if(target==='profile'){ this.setState({ view:'profile', openProfile:pid, sel:null }); } else { const e=Object.assign({},this.state.expanded); e[pid]=true; this.setState({ view:'statements', stmtMode:'original', expanded:e, sel:null }); } }
  goToLog(logKey) { this.setState({ view: 'investigate', openProfile: null, hlLog: logKey || null }); if (logKey) { clearTimeout(this._hlT); this._hlT = setTimeout(() => { if (this.state.hlLog === logKey) this.setState({ hlLog: null }); }, 2200); } }
  setMode(m) { this.setState({ stmtMode: m, openCell: null }); }
  startRead() { this.setState({ stage: 'read', readIdx: 0 }); }
  readNext() { if (this.state.readIdx < this.PEOPLE.length - 1) this.setState({ readIdx: this.state.readIdx + 1 }); else this.finishRead(); }
  readPrev() { if (this.state.readIdx > 0) this.setState({ readIdx: this.state.readIdx - 1 }); }
  gotoRead(i) { this.setState({ readIdx: i }); }
  finishRead() { this.setState({ stage: 'free', readDone: true, view: 'narrative' }); }
  skipRead() { this.finishRead(); }
  toggleHi(key) { const h = Object.assign({}, this.state.readHi); h[key] = !h[key]; this.setState({ readHi: h }); }
  setMemo(pid, v) { const m = Object.assign({}, this.state.readMemos); m[pid] = v; this.setState({ readMemos: m }); }
  buildReadCard() {
    const p = this.PEOPLE[this.state.readIdx], t = this.T(), ln = this.state.lang;
    const paras = this.STMT[p.id].map((par, i) => { const key = p.id + '-' + i; const hi = !!this.state.readHi[key];
      return { text: par, onClick: () => this.toggleHi(key), style: { margin: '0 -8px 10px', padding: '3px 8px', borderRadius: '6px', fontSize: '15px', lineHeight: '1.85', color: 'var(--fg-2)', cursor: 'pointer', background: hi ? 'var(--accent-soft)' : 'transparent', boxShadow: hi ? 'inset 3px 0 0 var(--accent)' : 'none', textWrap: 'pretty' } }; });
    const last = this.state.readIdx === this.PEOPLE.length - 1;
    const g = this.STMT_GESTURE[p.id] || {};
    return { idx: this.state.readIdx + 1, total: this.PEOPLE.length, name: p.name, ini: p.ini, avStyle: this.avStyle(p, 30),
      gesturePre: ln === 'ko' ? (g.pre || '') : '', gesturePost: ln === 'ko' ? (g.post || '') : '', hasPre: !!(ln === 'ko' && g.pre), hasPost: !!(ln === 'ko' && g.post),
      gestureStyle: { fontSize: '14px', lineHeight: '1.7', color: 'var(--fg-4)', fontStyle: 'italic', margin: '0 0 12px', textWrap: 'pretty' },
      gesturePostStyle: { fontSize: '14px', lineHeight: '1.7', color: 'var(--fg-4)', fontStyle: 'italic', margin: '12px 0 0', textWrap: 'pretty' },
      meta: (ln === 'ko' ? (p.age + '\uc138') : ('' + p.age)) + (t[p.role] ? ' \u00b7 ' + t[p.role] : ''),
      paras, memo: this.state.readMemos[p.id] || '', onMemo: (e) => this.setMemo(p.id, e.target.value),
      isLast: last, notLast: !last, onNext: () => this.readNext(), onPrev: () => this.readPrev(), onSkip: () => this.skipRead(),
      prevStyle: { opacity: this.state.readIdx > 0 ? 1 : 0.35, pointerEvents: this.state.readIdx > 0 ? 'auto' : 'none' },
      dots: this.PEOPLE.map((pp, i) => ({ onClick: () => this.gotoRead(i), style: { width: '8px', height: '8px', borderRadius: '50%', cursor: 'pointer', background: i === this.state.readIdx ? 'var(--accent)' : (i < this.state.readIdx ? 'var(--fg-3)' : 'var(--border-strong)') } })) };
  }
  pname(id) { const p = this.PEOPLE.find(x => x.id === id); if (p) return p.name; const pl = this.PLACES.find(x => x.id === id); if (pl) return this.state.lang === 'ko' ? pl.ko : pl.en; const fx = (this.FIXTURES || []).find(x => x.id === id); if (fx) return this.state.lang === 'ko' ? fx.ko : fx.en; return id; }
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
    return M[a + ':' + k];
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
    if (mode === 'person' || mode === 'pair') targets = this.PEOPLE.map(p => this.targetChip(p.id, p.name, s.targets));
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
    const solved = (this.state.solved.s1 ? 1 : 0) + (this.state.solved.s2 ? 1 : 0) + (this.state.solved.s3 ? 1 : 0);
    const cases = this.CASES.map(c => { const st = c.real ? status : 'soon'; const chip = this.statusChip(st === 'soon' ? 'unplayed' : st);
      return { num: ('0' + c.n).slice(-2), title: ln === 'ko' ? c.titleKo : (c.titleEn || c.titleKo), diff: c.diff, est: ln === 'ko' ? c.estKo : c.estEn,
        chipLabel: st === 'soon' ? t.soonPrep : chip.label, chipStyle: chip.style,
        diffStyle: { background: 'var(--bg-elevated-2)', color: 'var(--fg-3)' },
        onClick: () => this.openDetail(c.n),
        cardStyle: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' } }; });
    return { resumeShow: status === 'inProgress', resumeTitle: ln === 'ko' ? '산장 살인사건' : 'The Mountain Lodge', resumeProgress: solved + '/' + this.SECTIONS.length, resumeBudget: this.BUDGET - this.invSpent(), onResume: () => this.resumeCase(), cases };
  }
  buildDetail() {
    const t = this.T(), ln = this.state.lang, c = this.CASES[(this.state.selectedCase || 1) - 1] || this.CASES[0];
    const real = !!c.real, status = real ? this.caseStatus() : 'soon', chip = this.statusChip(status === 'soon' ? 'unplayed' : status);
    return { title: ln === 'ko' ? c.titleKo : (c.titleEn || c.titleKo), real, chipLabel: real ? chip.label : t.soonPrep, chipStyle: chip.style,
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
  REVEALS = {
    s1: { narrow: true, yield: 'narrow', targets: ['search:annex'], statements: [{ pid: 'yujin', y: 'flavor', text: '자살할 사람이 우리를 왜 불렀을까요? 초대장은 전날 밤에야 급하게 돌았어요.' }] },
    s3: { yield: 'decoy', statements: [{ pid: 'wonyoung', y: 'path', text: '유빈 언니가 출발할 때 같이 타려 했는데, 새벽에 깨서 그런지 늦잠을 자버렸어요.' }, { pid: 'yuri', y: 'decoy', text: '아 맞다, 저 그날 새벽에 잠깐 통화한 데가 있긴 한데… 그건 이 일이랑 상관없어요.' }] },
    s4: { yield: 'path', statements: [{ pid: 'yuri', y: 'path', text: '그 소문… 저도 어디서 흘러나온 건지 알 것 같아요. 세라 언니 쪽이었죠.' }] },
  };
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
  deathNarrowed() { return (this.state.invLog || []).some(e => e.action === 'autopsy'); }
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
    const sv = Object.assign({}, this.state.solved); const newLog = []; let changed = false, board = false;
    this.SECTIONS.forEach((s, idx) => {
      const complete = this.SEC_BLANKS[s.id].every(id => b[id] != null);
      if (complete && !sv[s.id]) {
        sv[s.id] = true; changed = true;
        newLog.push({ action: 'seal', key: s.id, actionLabel: this.T().sealRecord, targetLabel: this.state.lang === 'ko' ? s.tKo : s.tEn, cost: 0, type: 'sealed', title: (this.state.lang === 'ko' ? (s.num + '장 완성') : ('Chapter ' + s.num + ' complete')), desc: this.sealSummaryFor(s.id, b) });
        if (idx === this.SECTIONS.length - 2) board = true;
      }
    });
    if (!changed) return {};
    const unread = Object.assign({}, this.state.unread || {}); const dests = {};
    newLog.forEach(l => { const r = this.REVEALS[l.key]; if (!r) return; if (r.statements) { unread.statements = true; dests.statements = 1; } if (r.targets) { unread.map = true; dests.map = 1; } if (r.terms) { unread.narrative = true; dests.narrative = 1; } if (r.narrow) { unread.overview = true; unread.statements = true; dests.overview = 1; } });
    const nm = { statements: this.T().navStatements, map: this.T().navMap, narrative: this.T().navNarrative, overview: this.T().navOverview };
    const where = Object.keys(dests).map(k => nm[k]).filter(Boolean).join(' · ');
    const patch = { solved: sv, invLog: (this.state.invLog || []).concat(newLog), newReveal: (this.state.newReveal || []).concat(newLog.map(l => l.key)), unread: unread };
    if (where) { patch.toast = (this.state.lang === 'ko' ? '새 정보가 공개되었습니다 · ' : 'New information · ') + where; clearTimeout(this._toastT); this._toastT = setTimeout(() => this.setState({ toast: null }), 4600); }
    if (board && false) patch.narrMode = 'board';
    return patch;
  }
  sealSummaryFor(sid, b) { return this.SEC_BLANKS[sid].map(id => (b[id] || '') + this.particle(b[id] || '', this.BLANKS[id].par)).join(' · '); }
  sealSummary(sid) { const ln = this.state.lang; return this.SEC_BLANKS[sid].map(id => this.BLANKS[id].ans + this.particle(this.BLANKS[id].ans, this.BLANKS[id].par)).join(' · '); }

  markCell(key) { this.setState({ openCell: this.state.openCell === key ? null : key, openPicker: null, openAids: false }); }
  setMark(key, v) { const c = Object.assign({}, this.state.cellMarks || {}); if (v) c[key] = v; else delete c[key]; this.setState({ cellMarks: c, openCell: null }); }

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

  onDragCard(kind, value) { this.setState({ dragCard: { kind, value } }); }
  onDropSlot(bid) { const d = this.state.dragCard, def = this.BLANKS[bid]; if (!d) return; const wantPerson = def.src === 'person'; const wantTerm = def.src === 'collected'; if ((wantPerson && d.kind === 'person') || (wantTerm && d.kind === 'term')) { const b = Object.assign({}, this.state.blanks); b[bid] = d.value; this.setState({ blanks: b, dragCard: null }); } else this.setState({ dragCard: null }); }
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
    const ORDER = ['s1', 's3', 's2', 's4', 's5'];
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
  buildBoardSeed() {
    const rev = this.revealedTerms();
    const cards = [];
    const profs = {}; this.buildProfiles().forEach(pf => { profs[pf.id] = pf; });
    this.PEOPLE.forEach(p => { const pf = profs[p.id] || {}; cards.push({ id: 'p_' + p.id, kind: 'person', label: p.name, sub: (this.state.lang === 'ko' ? (p.relKo || '') : (p.relEn || '')), ini: p.ini, c1: p.c1, c2: p.c2,
      claim: (this.state.lang === 'ko' ? (p.claimKo || '') : (p.claimEn || p.claimKo || '')),
      clues: (pf.clues || []).map(c => c.text || c),
      slots: (pf.slots || []).map(s => ({ label: s.label, filled: !!s.filled, empty: !s.filled, text: s.text || '' })), fullStmt: (this.STMT[p.id] || []).join(String.fromCharCode(10,10)) }); });
    this.COLLECTED_POOL.forEach(w => { if (rev[w]) cards.push({ id: 'e_' + w, kind: 'evidence', label: w, sub: '', icon: this.termIconPath(w) }); });
    this.PEOPLE.forEach(p => { const first = (this.STMT[p.id] && this.STMT[p.id][0]) ? this.STMT[p.id][0] : ''; if (first) cards.push({ id: 'q_' + p.id, kind: 'quote', label: p.name + ' 진술', spk: p.c1, fullStmt: (this.STMT[p.id] || []).join(String.fromCharCode(10,10)), quote: '"' + (first.length > 70 ? first.slice(0, 70) + '…' : first) + '"' }); });
    (this.state.memos || []).forEach((m, i) => { if (m.content && m.content.trim()) cards.push({ id: 'mm_' + m.id, kind: 'quote', label: '메모 #' + (i + 1), quote: m.content }); });
    const revealedEvidence = {}; this.COLLECTED_POOL.forEach(w => { if (rev[w]) revealedEvidence['e_' + w] = true; });
    return { cards, revealedEvidence };
  }
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
    const annexOn = !!this.state.solved.s1;
    const eps = 0.6;

    const secured = {}; (this.state.invLog || []).forEach(e => { secured[e.action + ':' + e.key] = true; });
    const cluesByLoc = {}; this.FLOOR_CLUES.forEach(c => { if (secured[c.logKey]) { (cluesByLoc[c.loc] = cluesByLoc[c.loc] || []).push({ label: ln === 'ko' ? c.ko : c.en, iconPath: this.termIconPath(c.ko) }); } });

    const areas = G.rooms.concat(G.zones).filter(a => a.loc !== 'annex' || annexOn);
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

    const sPoche = [];
    G.buildings.filter(b => b.id !== 'annex' || annexOn).forEach(b => {
      sPoche.push({ d: 'M' + b.x + ' ' + b.y + ' H' + (b.x + b.w) + ' V' + (b.y + b.h) + ' H' + b.x + ' Z', color: b.poche, width: 6 });
      sPoche.push({ d: 'M' + (b.x + 3) + ' ' + (b.y + 3) + ' H' + (b.x + b.w - 3) + ' V' + (b.y + b.h - 3) + ' H' + (b.x + 3) + ' Z', color: 'var(--border)', width: 1 });
    });

    const rooms = G.rooms.filter(r => r.b !== 'annex' || annexOn);
    const raw = [], byB = {}; rooms.forEach(r => (byB[r.b] = byB[r.b] || []).push(r));
    Object.keys(byB).forEach(k => { const rs = byB[k];
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const A = rs[i], B = rs[j];
        if (Math.abs(A.x + A.w - B.x) < eps || Math.abs(B.x + B.w - A.x) < eps) {
          const x = Math.abs(A.x + A.w - B.x) < eps ? B.x : A.x;
          const a = Math.max(A.y, B.y), b = Math.min(A.y + A.h, B.y + B.h);
          if (b - a > eps) raw.push({ o: 'v', c: x, a: a, b: b });
        }
        if (Math.abs(A.y + A.h - B.y) < eps || Math.abs(B.y + B.h - A.y) < eps) {
          const y = Math.abs(A.y + A.h - B.y) < eps ? B.y : A.y;
          const a = Math.max(A.x, B.x), b = Math.min(A.x + A.w, B.x + B.w);
          if (b - a > eps) raw.push({ o: 'h', c: y, a: a, b: b });
        }
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
    G.doors.filter(d => d.building !== 'annex' || annexOn).forEach(d => {
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
    G.windows.filter(w => w.building !== 'annex' || annexOn).forEach(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      [-3, 0, 3].forEach(o => sWin.push({ x1: w.x1 + nx * o, y1: w.y1 + ny * o, x2: w.x2 + nx * o, y2: w.y2 + ny * o }));
      if (w.ko) winLabels.push({ left: px(w.lx), top: py(w.ly), label: ln === 'ko' ? w.ko : w.en });
    });

    const sWalk = G.walks.filter(w => w.b !== 'annex' || annexOn).map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, mx: px((w.x1 + w.x2) / 2), my: py((w.y1 + w.y2) / 2), label: w.min + (ln === 'ko' ? '분' : ' min') }));

    const locs = areas.map(a => {
      const st = this.invStatusFor('search', [a.loc]);
      const searched = !!secured['search:' + a.loc], found = (cluesByLoc[a.loc] || []).length > 0, searchable = st === 'ok';
      const col = found ? 'var(--accent)' : searched ? 'var(--g-confirm)' : a.scene ? 'var(--g-contradict)' : 'var(--fg-3)';
      const gatedNew = a.loc === 'annex' && annexOn;
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

    return { locs, sRoomFills, sHatch, sOffsite, sPoche, sWalls, sDoorErase, sDoorLeaf, sDoorArc, sWin, sWalk, doorLabels, winLabels, fixtures, personMarkers, times, dotLegend, scrubHint, hasClueMarks: hasAnyClue, clueLegend: ln === 'ko' ? '확보 물증' : 'Evidence', scale, scaleLabel, scaleText: '0 ─ 5m', narrations, hasNarr: narrations.length > 0, narrTitle: ln === 'ko' ? '현장 조사 기록' : 'Scene findings' };
  }
  FLOOR_CLUES = [
    { logKey: 'search:annex', loc: 'annex', ko: '대포폰', en: 'Burner' },
    { logKey: 'belongings:sakura', loc: 'annex', ko: '위장 유서', en: 'Fake note' },
    { logKey: 'autopsy:body', loc: 'room', ko: '일산화탄소', en: 'CO' },
  ];
  buildBoard() {
    const t = this.T(), ln = this.state.lang;
    const sections = this.SECTIONS.map(s => { const st = this.secState(s.id); return {
      id: s.id, num: s.num, title: ln === 'ko' ? s.tKo : s.tEn, locked: st === 'locked',
      statusKey: st === 'sealed' ? 'done' : st === 'open' ? 'progress' : 'backlog',
      slots: this.SEC_BLANKS[s.id].map(bid => { const def = this.BLANKS[bid], val = this.state.blanks[bid], sealed = st === 'sealed';
        const isPersonVal = val && this.PEOPLE.find(p => p.name === val);
        return { bid, label: t[def.kind], filled: val != null, locked: st === 'locked', value: val,
          color: isPersonVal ? isPersonVal.color : 'var(--accent)',
          onDrop: () => this.onDropSlot(bid), onClear: () => { const b = Object.assign({}, this.state.blanks); delete b[bid]; this.setState({ blanks: b }); },
          slotStyle: { minHeight: '46px', border: '1.5px dashed ' + (val ? 'transparent' : 'var(--border-strong)'), borderRadius: 'var(--r-sm)', background: val ? (isPersonVal ? 'var(--bg-elevated)' : 'var(--accent-soft)') : (st === 'locked' ? 'transparent' : 'var(--bg-subtle)'), display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', opacity: st === 'locked' ? 0.4 : 1, boxShadow: isPersonVal ? 'inset 3px 0 0 ' + isPersonVal.color : 'none' } };
      }) }; });
    const suspects = this.PEOPLE.map(p => ({ kind: 'person', value: p.name, name: p.name, sexAge: (ln === 'ko' ? p.sexKo : p.sexEn) + ' · ' + p.age, color: p.color, onDrag: () => this.onDragCard('person', p.name),
      style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', cursor: 'grab', boxShadow: 'inset 3px 0 0 ' + p.color },
      trayStyle: { display: 'inline-flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 12px 0 9px', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', cursor: 'grab', fontSize: '13px', fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', boxShadow: 'inset 3px 0 0 ' + p.color } }));
    const rev = this.revealedTerms();
    const terms = this.COLLECTED_POOL.filter(w => rev[w]).map(w => ({ kind: 'term', value: w, label: w, iconPath: this.termIconPath(w), onDrag: () => this.onDragCard('term', w),
      style: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', cursor: 'grab', fontSize: '13px', color: 'var(--fg-2)' } }));
    return { sections, suspects, terms, termsEmpty: terms.length === 0 };
  }
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
    const times = this.TIMES.map(tm => { const active = tm.id === tsel; return ({
      label: (tm.window && narrowed) ? (ln === 'ko' ? '새벽 3~5시' : '03:00–05:00') : (ln === 'ko' ? tm.ko : tm.en),
      sub: (tm.window && narrowed) ? (ln === 'ko' ? '사망 추정 · 이전 3~8시' : 'death · was 03–08') : (ln === 'ko' ? tm.subKo : tm.subEn),
      narrowed: tm.window && narrowed,
      onClick: () => this.setState({ mapTime: tm.id }),
      labelStyle: { color: 'var(--fg-2)', fontWeight: 600 },
      headStyle: { flex: 1, minWidth: '130px', padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--border)', background: tm.window ? 'rgba(255,255,255,.02)' : 'transparent' },
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
      return { p: { name: p.name, ini: p.ini, color: p.color, meta: (ln === 'ko' ? (p.age + '세') : (p.age)) + (t[p.role] ? ' · ' + t[p.role] : ''), avStyle: this.avStyle(p, 24) }, cells };
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
        relStyle: this.relChip(p.relKo === '산장 거주' ? 'onsite' : (p.relKo.indexOf('불참') >= 0 ? 'absent' : 'arrive')),
        railLine: { width: '2px', alignSelf: 'stretch', background: p.color, borderRadius: '1px', flex: 'none' },
        sexAge: (ln === 'ko' ? p.sexKo : p.sexEn) + ' · ' + p.age,
        job: ln === 'ko' ? p.jobKo : p.jobEn,
        relation: ln === 'ko' ? p.relKo : p.relEn,
        meta: (ln === 'ko' ? (p.age + '세') : ('' + p.age)) + (t[p.role] ? ' · ' + t[p.role] : ''),
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
        { title: ln === 'ko' ? '관계 그래프 · 알리바이 대조' : 'Graph · alibi cross-check', desc: ln === 'ko' ? '두 용의자 노드를 선택하면 대조 바가 뜨고, 실행하면 조사 1회로 관계가 드러남.' : 'Selecting two suspect nodes shows a cross-check bar; running it spends one investigation to reveal a link.' },
        { title: ln === 'ko' ? '보드 모드 · 심증판' : 'Board mode', desc: ln === 'ko' ? '공란 슬롯에 용의자·확보 단어 카드를 드래그. 5장 도달 시 기본 열림.' : 'Drag suspect/term cards into blank slots. Opens by default at the final section.' },
        { title: ln === 'ko' ? '평면도 · 시간대별' : 'Floor plan · by time', desc: ln === 'ko' ? '시간대를 바꾸면 각 인물의 주장 위치가 점으로 이동. 판정하지 않음.' : 'Switching times moves each person’s claimed position. No judgment.' },
        { title: ln === 'ko' ? '평면도 · 미공개 장소' : 'Floor plan · hidden place', desc: ln === 'ko' ? '별채는 1장 완성 전까지 지도에 나타나지 않음.' : 'The annex does not appear until section 1 is complete.' },
        { title: ln === 'ko' ? '정독 · 하이라이트' : 'Reading · highlight', desc: ln === 'ko' ? '드래그 선택 → 확인·의심·모순 색 적용. 인용·복사 가능.' : 'Drag-select → apply verified/doubtful/contradiction. Quote or copy.' },
        { title: ln === 'ko' ? '현장 · 공간 조사' : 'Scene · search states', desc: ln === 'ko' ? '공간·고정물·시신을 눌러 조사. 미조사(회색)/빈손(초록 테두리)/물증 발견(청록)으로 구분.' : 'Click a space, fixture, or body to investigate. Unsearched (gray) / empty (green outline) / evidence found (accent).' },
        { title: ln === 'ko' ? '용의자 · 조사 버튼' : 'Suspect · investigate', desc: ln === 'ko' ? '카드에서 소지품 검사·통화내역 실행. 사용 가능 / 잔여 부족 / 조사 완료 3상태.' : 'Run belongings/phone from the card. Available / no budget / done.' },
        { title: ln === 'ko' ? '관계 그래프 · 재구성' : 'Graph · reconstruction', desc: ln === 'ko' ? '빈 상태에서 시작해 조사·장 완성으로 숨은 관계가 드러남. 추측 관계는 그리지 않음.' : 'Starts empty; hidden relationships surface via investigation and section completions. No speculative edges.' },
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
    const isProfile = view === 'profile', isOverview = view === 'overview', isMemo = view === 'memo', isMap = view === 'map', isGraph = view === 'graph', isLog = view === 'log', isBoard = view === 'board';
    const solvedCount = this.SECTIONS.filter(x => this.SEC_BLANKS[x.id].every(id => s.blanks[id] != null)).length;
    const filledBlanks = Object.keys(s.blanks).filter(k => s.blanks[k] != null).length;
    const navCls = (v) => 'nav-item' + (view === v ? ' active' : '');
    const segCls = (on) => 'seg' + (on ? ' active' : '');
    const ovNarrowed = this.deathNarrowed();
    const overview = [
      { k: t.ovVictimK, v: t.ovVictimV }, { k: t.ovWhenK, v: ovNarrowed ? (ln === 'ko' ? '새벽 3시 ~ 5시' : '03:00 – 05:00') : t.ovWhenV, prev: ovNarrowed ? t.ovWhenV : '', badge: ovNarrowed ? (ln === 'ko' ? '1항 완성으로 갱신' : 'Updated · sec 1') : '' },
      { k: t.ovBodyK, v: t.ovBodyV }, { k: t.ovSceneK, v: t.ovSceneV },
    ].map((o, i, a) => ({ k: o.k, v: o.v, prev: o.prev || '', hasPrev: !!o.prev, badge: o.badge || '', hasBadge: !!o.badge, onQuote: () => this.quoteBriefToMemo(o.v), onCopy: () => { try { navigator.clipboard.writeText(o.v); } catch (e) {} }, style: { display: 'flex', gap: '12px', padding: '12px 16px', alignItems: 'baseline', borderBottom: i < a.length - 1 ? '1px solid var(--border)' : 'none' } }));;

    const result = this.buildResult();
    return {
      ui: Object.assign({}, t, {
        viewTitle: isNarr ? t.nTitle : isStmt ? t.sTitle : isInv ? t.navInvestigate : isProfile ? t.navProfile : isOverview ? t.navOverview : isMemo ? t.memoTitle : isMap ? t.navMap : isGraph ? t.navGraph : isLog ? t.invLogTitle : (view === 'result') ? result.endTitle : t.rTitle,
        viewSub: isNarr ? t.nSub : isStmt ? t.sSub : isInv ? t.invHint : isMemo ? t.annHint : isMap ? t.mapHint : isGraph ? t.graphHint : isLog ? t.logHint : (isProfile || isOverview || view === 'result') ? '' : t.rSub,
      }),
      isIntro: route === 'play' && s.stage !== 'free', isFree: route === 'play' && s.stage === 'free', stageProlog: s.stage === 'prologue', stageBrief: s.stage === 'brief', stageRead: s.stage === 'read',
      isHome: isHome, isDetail: isDetail, home: this.buildHome(), detail: this.buildDetail(),
      prologParas: this.PROLOG.map((p, pi) => ({ text: p })), onPrologContinue: () => this.setState({ stage: 'brief' }),
      ovQuote: { onSelect: (ev) => this.onStmtSelect('__prolog', 0, ev), showTb: !!s.sel && s.sel.pid === '__prolog', tbStyle: s.sel ? { position: 'absolute', left: s.sel.left + 'px', top: s.sel.top + 'px', transform: 'translate(-50%,-100%)', marginTop: '-6px', zIndex: 41 } : {} },
      ovProse: this.PROLOG.map((par, pi) => ({ pi, segs: this.segsFor('__prolog', pi, par), onSelect: (ev) => this.onStmtSelect('__prolog', pi, ev), showTb: !!s.sel && s.sel.pid === '__prolog' && s.sel.pi === pi, tbStyle: s.sel ? { position: 'absolute', left: s.sel.left + 'px', top: s.sel.top + 'px', transform: 'translate(-50%,-100%)', marginTop: '-6px', zIndex: 41 } : {} })),
      confirmAbandon: s.confirmAbandon, onAbandon: () => this.abandon(), onCancelAbandon: () => this.setState({ confirmAbandon: false }), onGoHome: () => this.goHome(), onAbandonReq: () => this.setState({ confirmAbandon: true }),
      dangerBtnStyle: { background: 'var(--label-red)', borderColor: 'transparent', color: '#fff', fontWeight: 600 },
      roomBtnStyle: { flex: '0 0 auto', opacity: 0.4, pointerEvents: 'none' },
      briefRows: [{ k: t.ovVictimK, v: t.ovVictimV }, { k: t.ovWhenK, v: t.ovWhenV }, { k: t.ovBodyK, v: t.ovBodyV }, { k: t.ovSceneK, v: t.ovSceneV }].map((o, i, a) => ({ k: o.k, v: o.v, style: { display: 'flex', gap: '12px', padding: '12px 16px', alignItems: 'baseline', borderBottom: i < a.length - 1 ? '1px solid var(--border)' : 'none' } })),
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
        boardCls: navCls('board'), boardSeg: segCls(isBoard), onBoard: () => this.setView('board'),
        logCls: navCls('log'), logSeg: segCls(isLog), onLog: () => this.setView('log'), logBadge: (s.invLog || []).length ? ('' + (s.invLog || []).length) : '',
        narrProgress: solvedCount + '/' + this.SECTIONS.length + (ln === 'ko' ? '장 · ' : ' · ') + filledBlanks + '/' + Object.keys(this.BLANKS).length, invBadge: '' + (this.BUDGET - this.invSpent()),
      },
      bottomNav: this.buildBottomNav(view),
      moreNav: this.buildMoreNav(view),
      moreOpen: s.moreOpen, onCloseMore: () => this.setState({ moreOpen: false }), stop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      stmt: { gridCls: segCls(s.stmtMode === 'grid'), origCls: segCls(s.stmtMode === 'original'), onGrid: () => this.setMode('grid'), onOriginal: () => this.setMode('original') },
      overview,
      narrLayoutStyle: { display: 'flex', gap: '22px', padding: '22px 24px', flexDirection: s.isNarrow ? 'column' : 'row', alignItems: 'flex-start', justifyContent: 'center', maxWidth: (s.narrMode === 'board') ? 'none' : '1120px', margin: '0 auto' },
      bankStyle: { width: s.isNarrow ? '100%' : '292px', flex: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px', position: s.isNarrow ? 'static' : 'sticky', top: '0', background: 'var(--bg-subtle)' },
      sections: this.buildSections(),
      narr: { proseCls: segCls(s.narrMode === 'prose'), listCls: segCls(s.narrMode === 'list'), boardCls: segCls(s.narrMode === 'board'), onProse: () => this.setState({ narrMode: 'prose' }), onList: () => this.setState({ narrMode: 'list' }), onBoard: () => this.setState({ narrMode: 'board' }) },
      narrProse: s.narrMode === 'prose', narrList: s.narrMode === 'list', narrBoard: s.narrMode === 'board',
      narrShowBank: s.narrMode === 'prose',
      board: this.buildBoard(),
      preventDefault: (e) => { if (e && e.preventDefault) e.preventDefault(); },
      reportHead: {
        caseNo: 'CASE-001', subject: ln === 'ko' ? '윤다인 (30)' : 'Kim Chae-won (30)',
        author: ln === 'ko' ? '담당 수사관' : 'Lead investigator',
        statusLabel: solvedCount === this.SECTIONS.length ? (ln === 'ko' ? '작성 완료' : 'Complete') : (ln === 'ko' ? '작성 중' : 'In progress'),
        statusDone: solvedCount === this.SECTIONS.length,
        statusChipStyle: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: solvedCount === this.SECTIONS.length ? 'var(--g-lock-bg)' : 'var(--bg-elevated-2)', color: solvedCount === this.SECTIONS.length ? 'var(--g-lock-mark)' : 'var(--fg-3)' },
        fields: [
          { k: ln === 'ko' ? '사건번호' : 'Case no.', v: 'CASE-001' },
          { k: ln === 'ko' ? '대상' : 'Subject', v: ln === 'ko' ? '윤다인 (30) · 소설가' : 'Kim Chae-won (30) · Novelist' },
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
      mapPlanMode: (s.mapMode || 'plan') === 'plan', mapGridMode: (s.mapMode || 'plan') === 'grid', onMapPlan: () => this.setState({ mapMode: 'plan' }), onMapGrid: () => this.setState({ mapMode: 'grid' }), mapPlanStyle: this.segTab((s.mapMode || 'plan') === 'plan'), mapGridStyle: this.segTab((s.mapMode || 'plan') === 'grid'),
      isGraph: isGraph, graph: this.buildGraph(),
      isLog: isLog, logView: this.buildInvestigation(),
      isBoard: isBoard, boardSeed: this.buildBoardSeed(), boardJump: (cardId, target) => this.boardJump(cardId, target), pb: (this.state.view === 'board') ? this.PB_render() : null,
      invConfirm: this.buildInvConfirm(), invResultCard: this.buildInvResult(),
      isResult: view === 'result', result: result,
      finishCTA: { show: view === 'narrative' && s.started, onFinish: () => this.setState({ confirmFinish: true }) },
      toast: s.toast,
      confirmFinish: s.confirmFinish, onDoFinish: () => this.finishReport(), onCancelFinish: () => this.setState({ confirmFinish: false }),
      finishUnfilled: (() => { const n = Object.keys(this.BLANKS).length - Object.keys(s.blanks).filter(k => s.blanks[k] != null).length; return n > 0 ? ((this.state.lang === 'ko' ? '아직 채우지 않은 공란 ' : 'Unfilled blanks: ') + n + (this.state.lang === 'ko' ? '개' : '')) : ''; })(),
      shell: {
        showLeft: !s.isNarrow && s.leftOpen && !s.focusMode,
        leftClosed: !(!s.isNarrow && s.leftOpen && !s.focusMode),
        showRight: s.rightOpen && !s.focusMode && !isBoard,
        rightBoardMode: false, notRightBoard: true,
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
      status: { budget: (this.BUDGET - this.invSpent()) + ' / ' + this.BUDGET },
      gridSort: { on: false, onToggle: () => {}, chipStyle: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '26px', padding: '0 10px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (s.viewOpts.timelineSort ? 'var(--accent)' : 'var(--border-strong)'), background: s.viewOpts.timelineSort ? 'var(--accent-soft)' : 'transparent', color: s.viewOpts.timelineSort ? 'var(--accent)' : 'var(--fg-3)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 } },
      langSeg: { koCls: 'seg' + (ln === 'ko' ? ' active' : ''), enCls: 'seg' + (ln === 'en' ? ' active' : ''), stKo: 'st' + (ln === 'ko' ? ' active' : ''), stEn: 'st' + (ln === 'en' ? ' active' : ''), onKo: () => this.setLang('ko'), onEn: () => this.setLang('en') },
      themeSeg: { stDark: 'st' + (s.theme === 'dark' ? ' active' : ''), stLight: 'st' + (s.theme === 'light' ? ' active' : ''), onDark: () => { if (s.theme !== 'dark') this.toggleTheme(); }, onLight: () => { if (s.theme !== 'light') this.toggleTheme(); } },
      onToggleTheme: () => this.toggleTheme(), themeGlyph: s.theme === 'dark' ? '\u25D1' : '\u25D0',
    };
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
                <div className="nav-item" onClick={V.onGoHome}><svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 7l5-4 5 4v6H3z" /></svg><span>{V.ui.goHome}</span></div>
                <div className="nav-caption">{V.ui.navCase}</div>
                <div className={V.nav.overviewCls} onClick={V.nav.onOverview}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="5.5" /><path d="M8 7.2v3.2M8 5.4v.1" /></svg>
                  <span>{V.ui.navOverview}</span>{(V.nav.overviewUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}
                </div>
                <div className={V.nav.narrCls} onClick={V.nav.onNarr}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 10.5h4" /></svg>
                  <span>{V.ui.navNarrative}</span>{(V.nav.narrUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}<span className="count">{V.nav.narrProgress}</span>
                </div>
                <div className="nav-caption" style={S("margin-top:6px")}>{V.ui.navClue}</div>
                <div className={V.nav.stmtCls} onClick={V.nav.onStmt}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M6.5 6.5V13M10 6.5V13" /></svg>
                  <span>{V.ui.navStatements}</span>{(V.nav.stmtUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}
                </div>
                <div className={V.nav.profileCls} onClick={V.nav.onProfile}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="5.5" r="2.5" /><path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /></svg>
                  <span>{V.ui.navProfile}</span>
                </div>
                <div className={V.nav.mapCls} onClick={V.nav.onMap}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 4.5L6 3l4 1.5L13.5 3v9L10 13.5 6 12 2.5 13.5z" /><path d="M6 3v9M10 4.5v9" /></svg>
                  <span>{V.ui.navMap}</span>{(V.nav.mapUnread)?(<><span style={S("width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:6px;flex:none")}></span></>):null}
                </div>
                <div className={V.nav.graphCls} onClick={V.nav.onGraph}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="4" cy="5" r="2" /><circle cx="12" cy="4" r="1.6" /><circle cx="11" cy="12" r="2" /><path d="M5.7 6.3l4 4.3M5.7 4.6l4.8-.4" /></svg>
                  <span>{V.ui.navGraph}</span>
                </div>
                <div className="nav-caption" style={S("margin-top:6px")}>{V.ui.navTool}</div>
                <div className={V.nav.logCls} onClick={V.nav.onLog}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></svg>
                  <span>{V.ui.invLogTitle}</span><span className="count">{V.nav.logBadge}</span>
                </div>
                <div className={V.nav.boardCls} onClick={V.nav.onBoard}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><path d="M7 4.75h2M4.75 7v2" /></svg>
                  <span>{V.ui.navBoard}</span>
                </div>
                <div className={V.nav.memoCls} onClick={V.nav.onMemo}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 2.5h10v11H3z" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" /></svg>
                  <span>{V.ui.navMemo}</span><span className="count">{V.nav.memoBadge}</span>
                </div>
                <div className={V.nav.refCls} onClick={V.nav.onRef}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="2.5" width="11" height="4" rx="1" /><rect x="2.5" y="9.5" width="11" height="4" rx="1" /></svg>
                  <span>{V.ui.navReference}</span>
                </div>
              </div>
              <div style={S("margin-top:auto;padding:12px 8px 4px;border-top:1px solid var(--border)")}>
                <div style={S("display:flex;align-items:center;gap:8px")}>
                  <span className="pr-badge" style={S("background:var(--accent-soft);color:var(--accent)")}>hard</span>
                  <span className="v-meta">{V.ui.budget} · <b className="v-num" style={S("color:var(--fg-2)")}>{V.status.budget}</b></span>
                </div>
                <div className="v-micro" style={S("margin-top:10px;line-height:1.55;color:var(--fg-4)")}>{V.ui.sidebarNote}</div>
                <div className="linklike" onClick={V.onAbandonReq} style={S("margin-top:10px;padding-left:0;color:var(--label-red);font-size:12px")}>{V.ui.abandon}</div>
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
                    {(V.narrBoard)?(<>
                    <div style={S("display:flex;flex-direction:column;gap:14px")}>
                      {arr(V.board.sections).map((bs,$index)=>(<React.Fragment key={$index}><div style={S("border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px")}>
                        <div style={S("display:flex;align-items:center;gap:9px;margin-bottom:12px")}>
                          <StatusIcon status={bs.statusKey} size="16"></StatusIcon>
                          <span className="v-meta" style={S("color:var(--fg-4);font-variant-numeric:tabular-nums")}>{bs.num}{V.ui.navCase}</span>
                          <span className="v-h3">{bs.title}</span>
                        </div>
                        <div style={S("display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px")}>
                          {arr(bs.slots).map((sl,$index)=>(<React.Fragment key={$index}><div>
                            <div className="v-micro" style={S("color:var(--fg-4);margin-bottom:3px")}>{sl.label}</div>
                            <div onDragOver={V.preventDefault} onDrop={sl.onDrop} style={sl.slotStyle}>
                              {(sl.filled)?(<><span className="v-ui" style={S("color:var(--fg);flex:1;min-width:0")}>{sl.value}</span><span onClick={sl.onClear} style={S("cursor:pointer;color:var(--fg-4);font-size:11px")}>✕</span></>):null}
                              {(sl.locked)?(<><span className="v-micro" style={S("color:var(--fg-4)")}>{V.ui.secLocked}</span></>):null}
                            </div>
                          </div></React.Fragment>))}
                        </div>
                      </div></React.Fragment>))}
                    </div>
                    <div style={S("position:sticky;bottom:0;margin-top:16px;background:var(--bg-subtle);border:1px solid var(--border-strong);border-radius:var(--r-md);padding:10px 12px;box-shadow:0 -6px 18px rgba(0,0,0,.22)")}>
                      <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:9px")}>
                        <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4"><rect x="2.5" y="4" width="11" height="8.5" rx="1.2"></rect><path d="M2.5 6.5h11"></path></svg>
                        <span className="v-caption" style={S("color:var(--fg-2)")}>{V.ui.boardTools}</span>
                        <span className="v-micro" style={S("color:var(--fg-4);margin-left:auto")}>{V.ui.boardToolsHint}</span>
                      </div>
                      <div style={S("display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;max-height:112px;overflow-y:auto;padding-bottom:2px")}>
                        {(V.board.termsEmpty)?(<><span className="v-micro" style={S("color:var(--fg-4);white-space:nowrap")}>{V.ui.bankEmpty}</span></>):null}
                        {arr(V.board.terms).map((tm,$index)=>(<React.Fragment key={$index}><span draggable="true" onDragStart={tm.onDrag} style={tm.style}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4" style={S("flex:none")}><path d={tm.iconPath}></path></svg>{tm.label}</span></React.Fragment>))}
                        {arr(V.board.suspects).map((c,$index)=>(<React.Fragment key={$index}><span style={S("flex:none")}><span draggable="true" onDragStart={c.onDrag} style={c.trayStyle}>{c.name}</span></span></React.Fragment>))}
                      </div>
                    </div>
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
                <div style={S("padding:30px 24px 60px;max-width:600px;margin:0 auto")}>
                  <div style={S("display:flex;align-items:center;gap:10px;margin-bottom:22px")}>
                    <span className="v-h1">{V.result.endTitle}</span>
                    {(V.result.stuck)?(<><span style={S("font-size:11px;font-weight:600;padding:2px 9px;border-radius:var(--r-pill);background:rgba(235,87,87,.14);color:var(--g-contradict)")}>{V.ui.difficulty}</span></>):null}
                  </div>
                  {(V.result.stuck)?(<><div className="v-body" style={S("color:var(--fg-3);margin-bottom:22px;line-height:1.7")}>{V.ui.resultStuck}</div></>):null}

                  {(V.result.anyWrong)?(<>
                    <div style={S("margin-bottom:22px")}>
                      <div className="v-micro" style={S("color:var(--g-contradict);text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px")}>{V.result.mineLabel}</div>
                      <div style={S("display:flex;flex-direction:column;gap:16px")}>
                        {arr(V.result.narrMine).map((sec,$index)=>(<React.Fragment key={$index}><p style={S("margin:0;font-size:16px;line-height:1.9;color:var(--fg-3);text-wrap:pretty")}>{arr(sec.runs).map((r,$index)=>(<React.Fragment key={$index}>{(r.isText)?(<><span>{r.text}</span></>):null}{(r.isBlank)?(<><span style={r.style}>{r.disp}</span></>):null}</React.Fragment>))}</p></React.Fragment>))}
                      </div>
                    </div>
                    <div style={S("border-top:1px solid var(--border);padding-top:20px;margin-bottom:8px")}>
                      <div className="v-micro" style={S("color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px")}>{V.result.realLabel}</div>
                      <div style={S("display:flex;flex-direction:column;gap:16px")}>
                        {arr(V.result.narrReal).map((sec,$index)=>(<React.Fragment key={$index}><p style={S("margin:0;font-size:16px;line-height:1.9;color:var(--fg-2);text-wrap:pretty")}>{arr(sec.runs).map((r,$index)=>(<React.Fragment key={$index}>{(r.isText)?(<><span>{r.text}</span></>):null}{(r.isBlank)?(<><span style={r.style}>{r.disp}</span></>):null}</React.Fragment>))}</p></React.Fragment>))}
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
                      {arr(V.result.narrReal).map((sec,$index)=>(<React.Fragment key={$index}><p style={S("margin:0;font-size:16px;line-height:1.9;color:var(--fg-2);text-wrap:pretty")}>{arr(sec.runs).map((r,$index)=>(<React.Fragment key={$index}>{(r.isText)?(<><span>{r.text}</span></>):null}{(r.isBlank)?(<><span style={r.style}>{r.disp}</span></>):null}</React.Fragment>))}</p></React.Fragment>))}
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
                  <div className="segmented" style={S("margin-bottom:16px")}>{arr(V.floor.times).map((tm,$index)=>(<React.Fragment key={$index}><div onClick={tm.onClick} style={tm.style}>{tm.label}</div></React.Fragment>))}</div>
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

              
              {(V.isBoard)?(<>
                <div style={S("position:absolute;inset:0")}>
        <div data-surface="vector" style={S("height:100vh;background:var(--bg-app);display:flex;flex-direction:column;font-family:var(--font-sans);overflow:hidden")}>
          <div style={S("padding:12px 20px 10px;flex:none;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px")}>
            <div className="v-ui" style={S("color:var(--fg)")}>상황판</div>
            <span className="v-meta" style={S("color:var(--fg-4)")}>{V.pb.hint}</span>
            <span style={S("flex:1")}></span>
            <div style={S("position:relative")}>
              <span className={V.pb.addChip} onClick={V.pb.onToggleAdd} style={S("cursor:pointer")}>＋ 생성</span>
              {(V.pb.addOpen)?(<><div className="v-menu" style={S("position:absolute;right:0;top:30px;z-index:40;min-width:170px")}>
                {arr(V.pb.tools).map((tl,$index)=>(<React.Fragment key={$index}><div className="v-menu-item" onClick={tl.onPick}><span style={tl.dot}></span>{tl.label}</div></React.Fragment>))}
              </div></>):null}
            </div>
            <span className={V.pb.tlChip} onClick={V.pb.onToggleTl} style={S("cursor:pointer")}>타임라인</span>
            <span className={V.pb.mapLockChip} onClick={V.pb.onToggleMapLock} style={S("cursor:pointer")} title="화면 이동·줌 잠금">화면 고정</span>
            <div style={S("display:flex;align-items:center;gap:2px;margin-left:2px")}>
              <button className="iconbtn" onClick={V.pb.onZoomOut}>−</button><span className="v-micro" style={S("color:var(--fg-4);width:36px;text-align:center")}>{V.pb.zoomPct}</span><button className="iconbtn" onClick={V.pb.onZoomIn}>+</button><button className="iconbtn" onClick={V.pb.onFit} style={S("width:auto;padding:0 8px;font-size:11px")}>전체 보기</button><button className="iconbtn" onClick={V.pb.onHome} title="초기 화면" style={S("width:auto;padding:0 8px;font-size:11px")}>홈</button><button className="iconbtn" onClick={V.pb.onReset} title="빈 판으로 초기화" style={S("width:auto;padding:0 8px;font-size:11px;color:var(--label-red)")}>초기화</button>
            </div>
          </div>

          <div className="pb-wrap" style={S("flex:1;display:flex;min-height:0")}>
            {(V.pb.drawerOpen)?(<><div style={S("width:186px;flex:none;border-right:1px solid var(--border);background:var(--bg-sidebar);overflow:auto;padding:0 10px 20px")}>
              <div style={S("position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;padding:9px 2px 8px;background:var(--bg-sidebar);border-bottom:1px solid var(--border);margin-bottom:10px")}>
                <span className="v-micro" style={S("color:var(--fg-3);text-transform:uppercase;letter-spacing:.05em")}>{V.pb.drawerTitle}</span>
                <span style={S("flex:1")}></span>
                <div onClick={V.pb.onToggleDrawer} title="서랍 닫기" style={S("width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-sm);border:1px solid var(--border-strong);background:var(--bg-elevated);color:var(--fg-3);cursor:pointer;font-size:13px;flex:none")}>‹</div>
              </div>
              {arr(V.pb.drawer).map((sec,$index)=>(<React.Fragment key={$index}><div style={S("margin-bottom:14px")}>
                <div style={S("display:flex;align-items:center;gap:6px;margin-bottom:7px")}><span style={sec.dot}></span><span className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em")}>{sec.title}</span><span style={S("flex:1")}></span></div>
                <div style={S("display:flex;flex-direction:column;gap:5px")}>
                  {(sec.locked)?(<><div style={S("padding:8px 10px;border:1px dashed var(--border-strong);border-radius:var(--r-sm);color:var(--fg-4);font-size:11px;line-height:1.5")}>{sec.lockedHint}</div></>):null}
                  {arr(sec.items).map((it,$index)=>(<React.Fragment key={$index}><div className="pb-draw" onClick={it.onAdd} style={it.rowStyle}><span className="v-meta" style={S("color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{it.label}</span><span style={S("flex:1")}></span>{(it.placed)?(<><span style={it.badgeStyle}>{it.count}</span></>):null}</div></React.Fragment>))}
                </div>
              </div></React.Fragment>))}
            </div></>):null}
            {(V.pb.drawerClosed)?(<><div onClick={V.pb.onToggleDrawer} title="서랍 열기" style={S("position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:20;width:16px;height:52px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-strong);border-left:none;border-radius:0 var(--r-sm) var(--r-sm) 0;background:var(--bg-elevated);color:var(--fg-3);cursor:pointer;font-size:13px")}>›</div></>):null}

            <div style={S(`position:relative;flex:1;overflow:hidden;background:var(--bg-subtle);touch-action:none;cursor:${V.pb.canvasCursor}`)} onPointerDown={V.pb.onBgDown} onPointerMove={V.pb.onCanvasMove} onPointerUp={V.pb.onCanvasUp}>
              <div data-canvas style={V.pb.worldStyle}>
                {(V.pb.timelineOn)?(<>
                  <div style={S(`position:absolute;left:0;top:${V.pb.tlBandTop};width:15000px;height:56px;border-bottom:1px dashed var(--border-strong);background:var(--bg-subtle)`)}>
                    <span className="v-micro" style={S("position:absolute;left:10px;top:7px;color:var(--fg-4);text-transform:uppercase;letter-spacing:.05em")}>시간 →</span>
                    <span onClick={V.pb.onAddTime} onPointerDown={V.pb.tlStop} style={S("position:absolute;left:70px;top:6px;font-size:11px;color:var(--accent);cursor:pointer")}>＋시간</span>
                    {arr(V.pb.markers).map((tk,$index)=>(<React.Fragment key={$index}><div style={tk.wrapStyle} onPointerDown={tk.onDown}>
                      <span onClick={tk.onHi} onPointerDown={tk.stop} style={tk.tickStyle} title="시간 강조"></span>
                      <input value={tk.label} onChange={tk.onLabel} onPointerDown={tk.stop} style={tk.inputStyle} />
                      {(tk.selected)?(<>{(tk.locked)?(<><span title="시간축 고정됨" style={S("font-size:10px;color:var(--fg-4)")}>🔒</span></>):null}{(tk.notLocked)?(<><span onClick={tk.onDel} onPointerDown={tk.stop} title="삭제" style={S("font-size:10px;color:var(--label-red);cursor:pointer")}>삭제</span></>):null}</>):null}
                    </div></React.Fragment>))}
                  </div>
                  {arr(V.pb.markers).map((tk,$index)=>(<React.Fragment key={$index}>{(tk.guideStyle)?(<><div style={tk.guideStyle}></div></>):null}</React.Fragment>))}
                </>):null}

                {arr(V.pb.groups).map((g,$index)=>(<React.Fragment key={$index}><div className="pb-box" style={g.boxStyle}>
                  {(g.isVenn)?(<><span style={g.circleL}></span><span style={g.circleR}></span></>):null}
                  {(g.empty)?(<><span style={S("position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font:700 22px var(--font-sans);color:var(--fg);opacity:.07;pointer-events:none")}>비어 있음</span></>):null}
                  {(g.isTl)?(<>{arr(g.tlTicks).map((tk,$index)=>(<React.Fragment key={$index}><div style={tk.style}><span style={tk.tickStyle}></span><span style={tk.labelStyle}>{tk.label}</span></div></React.Fragment>))}</>):null}
                  <span className="pb-grip" onPointerDown={g.onMoveDown} title="이동" style={S("position:absolute;left:-2px;top:-2px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:move;color:var(--fg-4);font-size:10px;z-index:2")}>⠿</span>
                  <div style={g.labelWrapStyle}>
                    <input value={g.label} onChange={g.onLabel} onPointerDown={g.stop} style={g.labelStyle} />
                  </div>
                  <span className="pb-grip" onPointerDown={g.onResizeDown} title="크기" style={S("position:absolute;right:-2px;bottom:-2px;width:18px;height:18px;display:flex;align-items:flex-end;justify-content:flex-end;cursor:nwse-resize;color:var(--fg-4);font-size:11px;z-index:2")}>◢</span>
                </div></React.Fragment>))}
                {(V.pb.tempGroup.show)?(<><div style={V.pb.tempGroup.style}></div></>):null}
                {(V.pb.marquee)?(<><div style={V.pb.marquee.style}></div></>):null}

                <svg width="2600" height="1600" style={S("position:absolute;left:0;top:0;pointer-events:none")}>
                  {arr(V.pb.strings).map((s,$index)=>(<React.Fragment key={$index}><line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} style={s.lineStyle}></line></React.Fragment>))}
                  {(V.pb.liveLine.show)?(<><line x1={V.pb.liveLine.x1} y1={V.pb.liveLine.y1} x2={V.pb.liveLine.x2} y2={V.pb.liveLine.y2} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 3"></line></>):null}
                </svg>
                {arr(V.pb.strings).map((s,$index)=>(<React.Fragment key={$index}><div onClick={s.onEdit} style={s.labelStyle}>{s.relLabel}</div></React.Fragment>))}

                {arr(V.pb.labels).map((lb,$index)=>(<React.Fragment key={$index}><div className="pb-piece" style={lb.wrapStyle} onPointerDown={lb.onDown}>
                  <input value={lb.text} onChange={lb.onText} onPointerDown={lb.stopIfEdit} placeholder="라벨" className="pb-lbl" style={lb.inputStyle} />
                  {(lb.selected)?(<><span onClick={lb.onDel} onPointerDown={lb.delStop} title="삭제" style={S("display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 8px;border-radius:var(--r-sm);background:var(--bg-elevated);border:1px solid var(--border-strong);color:var(--label-red);cursor:pointer;font:600 11px var(--font-sans);flex:none")}>삭제</span></>):null}
                </div></React.Fragment>))}

                {arr(V.pb.pieces).map((p,$index)=>(<React.Fragment key={$index}><div className={p.wrapCls} style={p.wrapStyle} onPointerDown={p.onDown} onClick={p.onClick}>
                  {(p.tierDot)?(<><div className="pb-card" style={p.dotStyle} title={p.label}>{p.ini}</div></>):null}
                  {(p.tierChip)?(<><div className="pb-card" style={p.chipStyle}>
                    {(p.isPerson)?(<><span style={p.avStyle}>{p.ini}</span></>):null}
                    {(p.notPersonChip)?(<><span style={p.chipDot}>{p.ini}</span></>):null}
                    <span className="v-ui" style={S("color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px")}>{p.label}</span>
                  </div></>):null}
                  {(p.tierFull)?(<><div className="pb-card" style={p.cardStyle}>
                    <div style={S("display:flex;align-items:center;gap:6px;margin-bottom:7px")}>
                      <span style={S(`width:7px;height:7px;border-radius:2px;background:${p.typeColor};flex:none`)}></span>
                      <span className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em")}>{p.typeLabel}</span>
                      {(p.laned)?(<><span className="v-micro" style={S("color:var(--accent)")}>· {p.timeLabel}</span></>):null}
                    </div>
                    {(p.isMemo)?(<><textarea value={p.text} onChange={p.onText} onPointerDown={p.stopDown} placeholder="메모…" style={S("width:100%;min-height:40px;resize:none;background:transparent;border:none;outline:none;color:var(--fg);font:500 12px var(--font-sans);line-height:1.5")}></textarea></>):null}
                    {(p.notMemo)?(<><div style={S("display:flex;align-items:center;gap:8px")}>
                      {(p.isPerson)?(<><span style={p.avStyle}>{p.ini}</span></>):null}
                      {(p.isEvidence)?(<><span style={S("width:24px;height:24px;border-radius:5px;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;flex:none")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.4"><path d={p.icon}></path></svg></span></>):null}
                      <div style={S("min-width:0")}><div className="v-ui" style={S("color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{p.label}</div>{(p.hasSub)?(<><div className="v-micro" style={S("color:var(--fg-4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{p.sub}</div></>):null}</div>
                    </div></>):null}
                    {(p.isQuote)?(<><div className="v-meta" style={S("color:var(--fg-2);font-style:italic;line-height:1.55;margin-top:7px")}>{p.quote}</div></>):null}
                  </div></>):null}
                  {(p.pinned)?(<><span title="고정됨" style={S("position:absolute;left:-5px;top:-5px;width:16px;height:16px;border-radius:50%;background:var(--bg-elevated);border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:9px;z-index:9")}>📌</span></>):null}
                  <span className="pb-zone pb-zone-l"><span className="pb-handle" onPointerDown={p.onPortInDown} title="연결 입력" style={p.portInStyle}></span></span>
                  <span className="pb-zone pb-zone-r"><span className="pb-handle" onPointerDown={p.onHandleDown} title="끌어서 연결" style={p.handleStyle}></span></span>
                </div></React.Fragment>))}

                {(V.pb.toolbar.show)?(<><div style={V.pb.toolbar.style}>
                  {arr(V.pb.toolbar.actions).map((a,$index)=>(<React.Fragment key={$index}><span onClick={a.onClick} onPointerDown={a.stop} style={a.style}>{a.label}</span></React.Fragment>))}
                </div></>):null}

                {(V.pb.detail.open)?(<><div style={V.pb.detail.style} onPointerDown={V.pb.detail.stop}>
                  <div style={S("display:flex;align-items:center;gap:8px;margin-bottom:10px")}><span style={S(`width:8px;height:8px;border-radius:2px;background:${V.pb.detail.color};flex:none`)}></span><span className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em")}>{V.pb.detail.typeLabel}</span><span style={S("flex:1")}></span><span onClick={V.pb.detail.onClose} onPointerDown={V.pb.detail.stop} style={S("cursor:pointer;color:var(--fg-4);font-size:12px")}>✕</span></div>
                  <div className="v-title" style={S("color:var(--fg);margin-bottom:4px")}>{V.pb.detail.label}</div>
                  {(V.pb.detail.hasSub)?(<><div className="v-meta" style={S("color:var(--fg-3);margin-bottom:8px")}>{V.pb.detail.sub}</div></>):null}
                  {(V.pb.detail.hasClaim)?(<><div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px")}>{V.pb.detail.claimLabel}</div><div className="v-meta" style={S("color:var(--fg-2);line-height:1.6;margin-bottom:10px")}>{V.pb.detail.claim}</div></>):null}
                  {(V.pb.detail.hasClues)?(<><div className="v-micro" style={S("color:var(--fg-4);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px")}>{V.pb.detail.cluesLabel}</div><div style={S("display:flex;flex-direction:column;gap:4px;margin-bottom:10px")}>{arr(V.pb.detail.clues).map((cl,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;gap:6px")}><span style={S("color:var(--accent);flex:none")}>·</span><span className="v-meta" style={S("color:var(--fg-2)")}>{cl}</span></div></React.Fragment>))}</div></>):null}
                  {(V.pb.detail.hasBody)?(<><div className="v-meta" style={S("color:var(--fg-2);line-height:1.6")}>{V.pb.detail.body}</div></>):null}
                  {(V.pb.detail.hasSlots)?(<><div style={S("display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--border);padding-top:9px;margin-top:2px")}>{arr(V.pb.detail.slots).map((sl,$index)=>(<React.Fragment key={$index}><div style={S("display:flex;align-items:center;gap:8px")}><span className="v-micro" style={S("color:var(--fg-4);width:36px;flex:none")}>{sl.label}</span>{(sl.filled)?(<><span className="v-meta" style={S("color:var(--fg-2)")}>{sl.text}</span></>):null}{(sl.empty)?(<><span style={S("flex:1;border-bottom:1px dashed var(--border-strong)")}></span><span className="v-micro" style={S("color:var(--fg-4);flex:none")}>{V.pb.detail.unknownLabel}</span></>):null}</div></React.Fragment>))}</div></>):null}
                  {(V.pb.detail.hasFull)?(<><div style={S("border-top:1px solid var(--border);margin-top:10px;padding-top:9px")}><div onClick={V.pb.detail.onToggleFull} style={S("display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--fg-3);font-size:12px;font-weight:500")}><span style={S(`display:inline-block;transform:${V.pb.detail.fullChevron};transition:transform .12s`)}>▸</span>{V.pb.detail.fullLabel}</div>{(V.pb.detail.fullOpen)?(<><div className="v-meta" style={S("color:var(--fg-2);line-height:1.7;margin-top:8px;max-height:220px;overflow-y:auto;white-space:pre-wrap")}>{V.pb.detail.fullText}</div></>):null}</div></>):null}
                </div></>):null}

                {(V.pb.relPicker.open)?(<><div className="v-menu" style={V.pb.relPicker.style} onPointerDown={V.pb.relPicker.stop}>
                  {arr(V.pb.relPicker.opts).map((o,$index)=>(<React.Fragment key={$index}><div className="v-menu-item" onClick={o.onPick}><span style={o.dot}></span>{o.label}</div></React.Fragment>))}
                  <div className="panel-sep" style={S("margin:4px 0")}></div><div className="v-menu-item" onClick={V.pb.relPicker.onDelete} style={S("color:var(--label-red)")}>연결 삭제</div>
                </div></>):null}
              </div>

              <div onPointerDown={V.pb.minimap.onDown} onPointerMove={V.pb.minimap.onMove} onPointerUp={V.pb.minimap.onUp} style={S("position:absolute;right:12px;bottom:12px;width:150px;height:100px;border:1px solid var(--border-strong);border-radius:var(--r-sm);background:var(--bg-app);overflow:hidden;touch-action:none;cursor:pointer")}>
                {arr(V.pb.minimap.dots).map((d,$index)=>(<React.Fragment key={$index}><span style={d.style}></span></React.Fragment>))}
                <div style={V.pb.minimap.viewport}></div>
              </div>
              {(V.pb.mselBar)?(<><div onPointerDown={V.pb.mselBar.stop} style={S("position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:8px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--r-pill);box-shadow:var(--shadow-popover);padding:6px 8px 6px 14px")}>
                <span className="v-ui" style={S("color:var(--fg);font-size:12px")}>{V.pb.mselBar.count}개 {V.pb.mselBar.word}</span>
                <span onClick={V.pb.mselBar.onBlock} style={S("display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 12px;border-radius:var(--r-pill);background:var(--accent);color:var(--fg-on-accent);font-size:12px;font-weight:600;cursor:pointer")}>{V.pb.mselBar.label}</span>
              </div></>):null}
            </div>
          </div>
        </div>
                </div>
              </>):null}

              
              {(V.isGraph)?(<>
                <div style={S("padding:18px 24px;max-width:1100px")}>
                  <div style={S("position:relative;width:100%;aspect-ratio:16/11;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-subtle);overflow:hidden")}>
                    <svg style={S("position:absolute;inset:0;width:100%;height:100%;pointer-events:none")} viewBox="0 0 100 100" preserveAspectRatio="none">
                      {arr(V.graph.edges).map((e,$index)=>(<React.Fragment key={$index}><line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.stroke} strokeWidth={e.width}></line></React.Fragment>))}
                    </svg>
                    {arr(V.graph.edges).map((e,$index)=>(<React.Fragment key={$index}><span style={S(`position:absolute;left:${e.mx}%;top:${e.my}%;transform:translate(-50%,-50%);font-size:10px;font-weight:500;color:${e.labelColor};background:var(--bg-subtle);padding:0 4px;white-space:nowrap`)}>{e.label}</span></React.Fragment>))}
                    {arr(V.graph.nodes).map((n,$index)=>(<React.Fragment key={$index}><span onClick={n.onClick} style={n.dotStyle}></span></React.Fragment>))}
                    {arr(V.graph.nodes).map((n,$index)=>(<React.Fragment key={$index}><span style={n.labelStyle}>{n.label}</span></React.Fragment>))}
                  </div>
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
                <div style={S("max-width:640px;margin:0 auto;padding:38px 24px 60px")}>
                  <div className="v-caption" style={S("color:var(--fg-4);letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px;display:block")}>{V.ui.caseTitle}</div>
                  <div style={S("position:relative")} onMouseUp={V.ovQuote.onSelect}>{arr(V.prologParas).map((pp,$index)=>(<React.Fragment key={$index}><p className="g-stmt-para" style={S("font-size:16px;line-height:1.9;color:var(--fg-2);margin:0 0 18px;text-wrap:pretty;cursor:text")}>{pp.text}</p></React.Fragment>))}{(V.ovQuote.showTb)?(<><span className="g-seltoolbar" style={V.ovQuote.tbStyle}><span style={S("display:inline-flex;align-items:center;gap:2px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:var(--r-sm);padding:3px;box-shadow:var(--shadow-popover)")}><span onClick={V.selTb.onQuote} title={V.ui.quoteMemo} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5" /></svg></span><span onClick={V.selTb.onCopy} title={V.ui.copyText} style={S("display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:var(--r-sm);cursor:pointer;color:var(--fg-3)")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M3 10V3h7" /></svg></span></span></span></>):null}</div>
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
                        <div style={S("min-width:0;flex:1")}><div className="v-title" style={S("color:var(--fg)")}>{pf.name}</div><div className="v-micro" style={S("color:var(--fg-4)")}>{pf.age} · {pf.job} · {pf.rel}</div></div>
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
                {(V.shell.rightBoardMode)?(<>
                  <div style={S("display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--border);flex:none")}>
                    <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4"><rect x="2.5" y="4" width="11" height="8.5" rx="1.2" /><path d="M2.5 6.5h11" /></svg>
                    <span className="v-ui" style={S("color:var(--fg)")}>{V.ui.boardTools}</span>
                  </div>
                  <div style={S("flex:1;overflow:auto;padding:14px")}>
                    <div className="v-caption" style={S("color:var(--fg-2);margin-bottom:10px")}>{V.ui.bankTitle}</div>
                    {(V.board.termsEmpty)?(<><div className="v-micro" style={S("color:var(--fg-4);margin-bottom:16px;line-height:1.5")}>{V.ui.bankEmpty}</div></>):null}
                    <div style={S("display:flex;flex-wrap:wrap;gap:7px;margin-bottom:20px")}>
                      {arr(V.board.terms).map((tm,$index)=>(<React.Fragment key={$index}><span draggable="true" onDragStart={tm.onDrag} style={tm.style}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4" style={S("flex:none")}><path d={tm.iconPath}></path></svg>{tm.label}</span></React.Fragment>))}
                    </div>
                    <div className="v-caption" style={S("color:var(--fg-2);margin-bottom:10px")}>{V.ui.navProfile}</div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      {arr(V.board.suspects).map((c,$index)=>(<React.Fragment key={$index}><div draggable="true" onDragStart={c.onDrag} style={c.style}>
                        <div style={S("min-width:0")}><div className="v-ui" style={S("color:var(--fg)")}>{c.name}</div><div className="v-micro" style={S("color:var(--fg-4)")}>{c.sexAge}</div></div>
                      </div></React.Fragment>))}
                    </div>
                    <div className="v-micro" style={S("color:var(--fg-4);margin-top:16px;line-height:1.6")}>{V.ui.boardToolsHint}</div>
                  </div>
                </>):null}
                {(V.shell.notRightBoard)?(<>
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
                </>):null}
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
                <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:40px 24px")}>
                  <div style={S("max-width:600px;width:100%")}>
                    <div className="v-caption" style={S("color:var(--fg-4);margin-bottom:26px;letter-spacing:.1em;text-transform:uppercase")}>{V.ui.caseTitle}</div>
                    {arr(V.prologParas).map((pp,$index)=>(<React.Fragment key={$index}><p style={S("font-size:17px;line-height:1.95;color:var(--fg-2);margin:0 0 20px;text-wrap:pretty")}>{pp.text}</p></React.Fragment>))}
                    <div style={S("margin-top:24px")}><Button variant="primary" onClick={V.onPrologContinue}>{V.ui.prologContinue}</Button></div>
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
                  <div style={S("max-width:640px;width:100%")}>
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
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M5 3.5l7 4.5-7 4.5z" /></svg>
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
                  </div></React.Fragment>))}
                </div>
                <div className="v-caption" style={S("color:var(--fg-2);margin:26px 0 12px;display:block")}>{V.ui.daily}</div>
                <div style={S("display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:var(--r-md);opacity:.55")}>
                  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4"><rect x="2.5" y="3" width="11" height="11" rx="1.5" /><path d="M2.5 6h11M6 2v2M10 2v2" /></svg>
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
                    <span className="pr-badge" style={S("background:var(--accent-soft);color:var(--accent)")}>hard</span>
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
                  <div style={S("flex:1;min-width:0")}><div className="v-h3" style={S("color:var(--fg)")}>{V.profileDetail.name}</div><div className="v-micro" style={S("color:var(--fg-4)")}>{V.profileDetail.age} · {V.profileDetail.job} · {V.profileDetail.rel}</div></div>
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
                  <div style={S("font-size:16px;line-height:1.9;color:var(--fg-2);text-wrap:pretty")}>{V.invResultCard.body}</div>
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
