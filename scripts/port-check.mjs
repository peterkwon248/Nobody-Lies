#!/usr/bin/env node
/**
 * 이식 대조기 — 프로토타입과 앱의 **분기·반복 집합**을 맞춰본다.
 *
 * ## 무엇이 바뀌었나 (2026-07-26)
 *
 * 예전 판은 원본에서 분기를 뽑아 **장부**(`docs/port-ledger.json`)와 대조했다.
 * 앱을 손으로 옮기던 시절엔 이름이 달라져서(`l.clues` ↔ `cluesAt`) 기계가
 * 판정할 수 없었고, 옮겼는지는 사람이 장부에 적어야 했다.
 *
 * **앱이 DC React export 로 바뀌면서 그 전제가 사라졌다.** 기계 변환은 이름을
 * 그대로 쓰므로 두 집합을 직접 비교할 수 있다 — 장부도, 사람의 판정도 없다.
 * 전환 시점에 308 대 308 로 완전히 일치했다.
 *
 * ## 그래서 이게 잡아주는 것
 *
 *   · **재export 가 분기를 빠뜨렸다** — 앱에만 없다
 *   · **재export 가 옛 마스터에서 왔다** — 프로토타입에 없는 분기가 앱에 있다
 *   · **프로토타입 파일만 갱신되고 앱이 안 따라왔다** (또는 그 반대)
 *
 * ## 못 잡는 것 — 이게 중요하다
 *
 * **갈래가 있느냐까지만 본다.** 같은 조건에서 뜨는지, 화면이 원본처럼 보이는지는
 * 재지 못한다. 2026-07-26 에 보고서 장 머리글이 정확히 그렇게 빠져나갔다 —
 * 두 갈래가 다 있는데 조건이 뒤바뀌어 있었다. **초록불은 「덜 옮기지 않았다」는
 * 뜻이지 「맞게 옮겼다」는 뜻이 아니다.**
 *
 * 사용:
 *   node scripts/port-check.mjs           대조. 어긋나면 exit 1
 *   node scripts/port-check.mjs --list    양쪽 목록 출력
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROTO = join(ROOT, 'prototype', '추리게임.dc.html')
const APP = join(ROOT, 'app', 'src', 'App.jsx')

/** 원본 템플릿의 분기(`sc-if`)와 반복(`sc-for`) */
function fromPrototype(src) {
  const out = new Set()
  for (const m of src.matchAll(/sc-if value="\{\{\s*([\w.]+)\s*\}\}"/g)) out.add(m[1])
  for (const m of src.matchAll(/sc-for list="\{\{\s*([\w.]+)\s*\}\}"/g)) out.add(m[1])
  return out
}

/**
 * 변환된 JSX 의 같은 자리.
 *
 * `sc-if`  → `{(V.x)?(<>…</>):null}`
 * `sc-for` → `arr(V.x).map((it,$index)=>…)`
 *
 * `V.` 접두사는 `renderVals()` 가 돌려준 객체를 가리키는 것뿐이라 떼고 비교한다.
 */
function fromApp(src) {
  const out = new Set()
  for (const m of src.matchAll(/\{\((?:V\.)?([A-Za-z_][\w.]*)\)\?/g)) out.add(m[1])
  for (const m of src.matchAll(/arr\((?:V\.)?([A-Za-z_][\w.]*)\)\.map/g)) out.add(m[1])
  return out
}

/**
 * 앱 전용 — 프로토타입에 없어도 되는 분기.
 *
 * 2026-07-27에 `App.jsx` 가 정본이 되고 export 가 동결됐다. 그 뒤로 새로 짓는
 * 기능은 프로토타입에 없다 — 그건 어긋남이 아니다. **여기 적힌 것만** 예외로 두고
 * 나머지 `extra` 는 계속 실패로 본다(옛 마스터에서 온 export 를 잡는 장치가 그것이다).
 *
 * ★ 여기 적는 것은 「프로토타입에 없는 새 기능이다」라는 선언이다. ★
 *   이식된 화면을 고치다 생긴 어긋남을 여기 적어 넘기면 **대조기가 죽는다.**
 *   적을 때 무엇을 새로 지었는지 한 줄로 남긴다.
 *
 * 렌더를 메서드로 추출할 때는 **인자 이름을 `V` 로 유지한다** — 위 정규식이
 * `V.` 접두사를 떼고 이름만 보므로, `renderPlan(F)` 로 바꾸면 `floor.hasNarr` 가
 * `F.hasNarr` 로 보이면서 있던 갈래가 사라진 것처럼 잡힌다.
 *
 * ⚠ **이 대조기는 주석과 코드를 가리지 않는다.** 파일 전체를 정규식으로 훑는다.
 *   `App.jsx` 주석에 위 두 패턴을 예시로 적었다가 이름 하나가 늘어 대조가 깨졌다
 *   (2026-07-27). 패턴을 문서에 적을 일이 있으면 **말로 쓴다.**
 */
const APP_ONLY = new Set([
  // 새 기능을 지을 때 **그 커밋에서** 여기 이름을 더한다 — 미리 적어두면
  // 아래 `staleAllow` 가 잡는다(그게 이 목록이 안 썩는 이유다)

  // ⛳ 상황판 탭 여덟 갈래가 여기 있었다 (2026-07-27 신설 → 2026-08-05 삭제).
  // 상황판이 제품에서 빠지면서 **앱 전용이 아니라 존재하지 않는 것**이 됐다.
  // 프로토타입에도 없으므로 `REMOVED` 가 아니라 여기서 **지우는** 것이 맞다 —
  // 남겨두면 `staleAllow` 가 여덟을 물고 게이트가 빨간 채로 상주한다

  // 평면도 탭-확대 (2026-08-05) — 좁은 화면에서 도면이 뭉개진다는 첫 테스터
  // 보고(`docs/PLAYTEST.md`)에 대한 답. 프로토타입은 데스크톱 폭만 상정해서
  // 이 갈래가 없다. `tapToZoom` 은 `isNarrow` 에서 곧장 나오므로 데스크톱에서는
  // 거짓이고 **옛 마크업이 그대로** 렌더된다(무변경이 조건이었다)
  'plan.tapToZoom', 'plan.zoomOpen',

  // 중간 공개 3단계 (2026-08-06) — `DESIGN-NOTES.md` §확정 결정 2·3.
  // 프로토타입은 공개 무게가 **한 겹**(토스트)이라 이 갈래가 통째로 없다.
  //   card.open           중 — 반화면 카드. 트릭 인상 붕괴의 후속 균열
  //   interlude.isProvisional  대 — 트릭 붕괴 문안이 **잠정**임을 화면에 표기한다
  //                            (저작 문안이 오면 이 갈래는 사라진다)
  'card.open', 'interlude.isProvisional',

  // 관측 표면 수리 (2026-08-06) — 테스터 전찬웅 3차 *"내부가 텅텅 비었다"*.
  // 프로토타입에는 **조사 진입구가 상세에만** 있고 프로필 빈 상태도 한 갈래다.
  //   pf.invActions  발견성 수리 — 목록 카드에서 바로 소지품·통화를 실행한다.
  //                  수단은 원래 있었고 **상세 2단계 깊이에 숨어** 있었다
  //                  (`표기 안내` 는 이미 「카드에서 실행」이라고 약속하고 있었다)
  //   pf.hasNarr / pf.narr
  //                  「발견된 단서」가 사건 넷 중 **산장에만** 데이터가 있다
  //                  (`CLUE_MAP` 0/37 · 산장 9/20). 나머지는 조사해도 영영
  //                  안 채워지는 **빈 약속**이라, 그 인물 대상 조사 결과문을
  //                  임시로 물린다. ⛳ clues 저작이 끝나면 이 둘은 걷어낸다
  //
  // ⛔ `pf.noClues` 를 여기 적었다가 뺐다 — **이식된 갈래**라 앱 전용이 아니다.
  //    조건을 마크업에서 `pf.noClues && !pf.hasNarr` 로 바꿨더니 이름이 달라져
  //    「앱에 없다」로 잡혔다. 판정을 **빌더로 옮기고 마크업은 원형대로** 뒀다 —
  //    그것이 이 대조기가 지키려는 것이다.
  'pf.invActions', 'pf.hasNarr', 'pf.narr',

  // 해설 화면 「무슨 일이 있었나」 (2026-08-06) — 테스터 *"정답을 봐도 트릭·동기
  // 납득 안 감"*. 프로토타입의 채점 화면은 **답과 바로잡기까지**이고 해설이 없다.
  // 엔진이 계산한 `_epilogue`(트릭 재구성)와 `_proof`(공란별 증명 사슬)를 편다 —
  // **새 산문이 아니라 파기 중단**이다.
  // ⛳ 갈래가 열일곱인 것은 **없는 절을 안 그리기** 위해서다. 데이터가 비면 제목만
  //    남기는 편이 쉽지만, 그러면 「있는데 비었다」로 읽힌다(이 저장소의 재발 부류).
  'result.hasEpi',
  'result.epi.hasScene', 'result.epi.hasLie',
  'result.epi.hasIllusions', 'result.epi.illusions', 'il.hasMade', 'il.hasBroken',
  'result.epi.hasExit', 'result.epi.exit.hasBroken', 'result.epi.hasFlaw',
  'result.epi.hasFacts', 'result.epi.facts', 'f.hasFrom',
  'result.epi.hasChains', 'result.epi.chains', 'ch.steps', 'st.hasElim',

  // 홈 목록에서 만든 사건을 지운다 (2026-07-29) — 캠페인 생성기가 생기기 전에는
  // 지울 것이 없었다. `canDel` 은 만든 사건 행에만 달리고(앱 제공 사건은 안 달린다),
  // `confirmDel` 은 그 행이 「지울까?」를 묻는 동안의 갈래다
  'c.canDel', 'c.confirmDel',

  // 장 인터루드 (2026-07-29) — 프로토타입에 **없는 유일한 신축 화면**이다.
  // `NEXT-ACTION` §④ 가 *"유일하게 신축이다. Reveal.narration 이 엔진에 이미 있고
  // 5개 다 쓰여 있는데 프로토타입이 한 번도 렌더하지 않는다"* 라고 적어둔 그것이고,
  // 설계는 `MEMORY.md` §장 인터루드 (F) 에 확정돼 있다. 프롤로그 화면의 조판을
  // 그대로 쓰므로 새 표현은 안 만들었다 — 갈래만 둘 는다
  'interlude.paras', 'interlude.hasDest',
])

/**
 * 제거됨 — **프로토타입에 있으나 제품에서 빼기로 결정한 갈래.** (2026-08-05 신설)
 *
 * ## ⛔ `APP_ONLY` 와 부류가 다르다 — 섞으면 안 된다
 *
 * 위 `APP_ONLY` 주석이 *"이식된 화면을 고치다 생긴 어긋남을 여기 적어 넘기면
 * 대조기가 죽는다"* 고 경고한다. 그 경고는 **의도 없는 드리프트**를 말한다 —
 * 목록에 적는 순간 대조기가 무력화되는 부류다.
 *
 * **이쪽은 반대다. 의도의 기록이다.**
 *
 * ```
 * APP_ONLY   앱에 있고 프로토타입에 없다   「새로 지었다」는 선언
 * REMOVED    프로토타입에 있고 앱에 없다   「제품에서 뺐다」는 선언
 * 어긋남      설명이 없다                 ← 둘 중 어디에도 안 적힌 것
 * ```
 *
 * `inShipGate` 가 태그가 아니라 규칙이듯, **「제품에서 뺀 것」도 침묵이 아니라
 * 선언이어야 한다**(2026-08-05 사용자 확정). 침묵으로 두면 `missing` 이 쌓여
 * 게이트가 빨간 채로 상주하고, 그러면 사람이 게이트를 안 보게 된다.
 *
 * ## 역방향 검사 **둘**이 이 목록의 본체다
 *
 * ```
 * revived       여기 적혔는데 App.jsx 에 있다   → 뺀다고 해놓고 되살아났다
 * staleRemoved  여기 적혔는데 프로토타입에 없다  → 목록이 낡았다
 * ```
 *
 * 이것이 없으면 REMOVED 는 **「안 보기로 한 목록」**일 뿐이다. `staleAllow` 가
 * `APP_ONLY` 를 안 썩게 하는 것과 같은 장치이고, **그래야 목록이 계약이 된다.**
 *
 * ⛳ **항목마다 결정 출처를 한 줄 남긴다** — 목록이 커지는 미래에 「이건 왜 뺐더라」를
 * 코드가 답하게. 값은 그 근거 문자열이다.
 */
const WHY_BOARD = '상황판 삭제 · 2026-08-05 사용자 확정 · docs/PLAYTEST.md(모바일에서 못 쓴다)'
const WHY_NARR = '보고서 「보드」 모드 동반 삭제 · 상황판과 한 벌 · 자동 전환은 이미 죽어 있었다'
const WHY_RIGHT = '오른쪽 보드 도구 패널 · rightBoardMode 가 상수 false 라 이미 죽어 있었다'

/** 항목 → 근거. 세 무리이고 무리마다 결정 출처가 다르다 */
const REMOVED = new Map([
  // ① 상황판 화면 자체 (view === 'board') — PB_* 멤버 322줄 + JSX 160줄
  ...['isBoard', 'it.placed', 'lb.selected', 'sec.items',
    'g.empty', 'g.isTl', 'g.isVenn', 'g.tlTicks',
    'p.hasSub', 'p.isEvidence', 'p.isMemo', 'p.isPerson', 'p.isQuote', 'p.laned',
    'p.notMemo', 'p.notPersonChip', 'p.pinned', 'p.tierChip', 'p.tierDot', 'p.tierFull',
    'pb.addOpen', 'pb.drawer', 'pb.drawerClosed', 'pb.drawerOpen', 'pb.groups', 'pb.labels',
    'pb.liveLine.show', 'pb.markers', 'pb.marquee', 'pb.minimap.dots', 'pb.mselBar', 'pb.pieces',
    'pb.strings', 'pb.timelineOn', 'pb.tools', 'pb.tempGroup.show',
    'pb.detail.clues', 'pb.detail.fullOpen', 'pb.detail.hasBody', 'pb.detail.hasClaim',
    'pb.detail.hasClues', 'pb.detail.hasFull', 'pb.detail.hasSlots', 'pb.detail.hasSub',
    'pb.detail.open', 'pb.detail.slots',
    'pb.relPicker.open', 'pb.relPicker.opts', 'pb.toolbar.actions', 'pb.toolbar.show',
    'tk.guideStyle', 'tk.locked', 'tk.notLocked', 'tk.selected',
  ].map((k) => [k, WHY_BOARD]),

  // ② 보고서 보드 모드 (narrMode === 'board') — 공란 슬롯 드래그 배치
  ...['board.sections', 'board.suspects', 'board.terms', 'board.termsEmpty',
    'bs.slots', 'narrBoard', 'sl.locked',
  ].map((k) => [k, WHY_NARR]),

  // ③ 오른쪽 패널의 보드 도구
  ...['shell.rightBoardMode', 'shell.notRightBoard'].map((k) => [k, WHY_RIGHT]),
])

const P = fromPrototype(readFileSync(PROTO, 'utf8'))
const A = fromApp(readFileSync(APP, 'utf8'))

// 제거 선언된 것은 `missing` 에서 뺀다 — 대신 아래 역방향 둘이 그 선언을 감시한다
const missing = [...P].filter((x) => !A.has(x) && !REMOVED.has(x)).sort()   // 앱이 빠뜨렸다
/** 뺐다고 적어놓고 앱에 살아 있다 — 선언과 실물이 어긋났다 */
const revived = [...REMOVED.keys()].filter((x) => A.has(x)).sort()
/** 뺐다고 적어놓았는데 프로토타입에도 없다 — 목록이 낡았다(동결 원본이 바뀌었거나 오타) */
const staleRemoved = [...REMOVED.keys()].filter((x) => !P.has(x)).sort()
const newFeat = [...A].filter((x) => !P.has(x) && APP_ONLY.has(x)).sort()      // 새로 지은 것
const extra = [...A].filter((x) => !P.has(x) && !APP_ONLY.has(x)).sort()       // 설명 안 되는 것
// 적어뒀는데 실제로 없는 이름 — 기능을 지웠거나 이름을 바꿨다. 목록이 썩는 것을 막는다
const staleAllow = [...APP_ONLY].filter((x) => !A.has(x)).sort()

if (process.argv.includes('--list')) {
  console.log(`\n프로토타입 (${P.size})\n  ${[...P].sort().join(' ')}`)
  console.log(`\n앱 (${A.size})\n  ${[...A].sort().join(' ')}`)
  process.exit(0)
}

const say = (title, arr, hint) => {
  if (!arr.length) return
  console.log(`\n${title} (${arr.length})\n  ${hint}`)
  for (const x of arr) console.log(`    ${x}`)
}

say('❗ 앱에 없다', missing, '재export 가 빠뜨렸거나, 프로토타입만 갱신됐다')
say('❗ 프로토타입에 없다', extra, '앱이 옛 마스터에서 왔거나, 앱만 갱신됐다')
say('❗ 앱 전용 목록이 낡았다', staleAllow, 'APP_ONLY 에 적혀 있는데 앱에 없다 — 지웠거나 이름이 바뀌었다')
say('❗ 뺐다고 해놓고 살아 있다', revived, 'REMOVED 에 적혀 있는데 App.jsx 에 있다 — 되살아났거나 선언이 틀렸다')
say('❗ 제거 목록이 낡았다', staleRemoved, 'REMOVED 에 적혀 있는데 프로토타입에도 없다 — 오타이거나 동결 원본이 바뀌었다')
say('· 앱 전용 (프로토타입에 없는 새 기능)', newFeat, 'APP_ONLY 에 선언됨 — 어긋남으로 세지 않는다')
say('· 제거됨 (제품에서 빼기로 결정)', [...REMOVED.keys()].sort(), 'REMOVED 에 선언됨 — 어긋남으로 세지 않는다')

const ok = !missing.length && !extra.length && !staleAllow.length && !revived.length && !staleRemoved.length
console.log(
  `\n${ok ? '✓' : '✗'} 프로토타입 ${P.size} · 앱 ${A.size} · `
  + `공통 ${[...P].filter((x) => A.has(x)).length} · 앱 전용 ${newFeat.length} · `
  + `제거됨 ${REMOVED.size} · `
  + `어긋남 ${missing.length + extra.length + staleAllow.length + revived.length + staleRemoved.length}`,
)
if (ok) console.log('  (갈래가 있느냐까지만 본다 — 같은 조건에서 뜨는지는 눈으로 본다)')
process.exit(ok ? 0 : 1)
