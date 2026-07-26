---
session_date: "2026-07-26 21:30"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/user/Desktop/Nobdy Lies"
---

## Completed Work

**커밋 13개(+6308 / −145 · 33개 파일). 프로토타입의 모든 화면이 앱에 있다.**

`HANDOFF-TO-CODE.md` §8.1 이 남겨둔 미결이 사용자 결정으로 닫혔다 —
*"어쨌든 프로토타입을 전부 이식(디자인)하는 건 잊지 마."*

**1. 이식 4화면** (`1e5e1d4`)
- **메모장** 382~419 + **인용 피커** 1257~1265 (핀 0/1/2+ 세 갈래)
- **채점·결말** 422~477 — 세 갈래 실측(오답/만점/예산 소진)
- **인물 상세 모달** 1171~1218 — 왼쪽 주장 · 오른쪽 확정
- **관계 그래프** 719~742 + 엔진 `RelationGraph`·`Action.pair`·검사 9-5/9-6

**2. 상황판 5층** (`52fd19d`·`d001ad7`·`9b4feb4`·`223d845`·`115a2b3`)
원본 581~717행 + `PB_*` 41개 함수. 캔버스 에디터 한 벌.
판·팬/줌·서랍·조각 3단·드래그·핀·연결선·툴바·미니맵 → ＋생성 메뉴·영역/교집합·
자유 라벨 → 마퀴·묶기(`binds`) → 타임라인 띠·시간 강조 → 상세 팝업·벤 판정.
전부 `PointerEvent` 를 실제로 dispatch 해 좌표를 쟀다.

**3. 표기 안내** (`613564a`) 746~821 — 7절. 마지막 화면.

**4. 지적 두 번으로 잡은 누락** (`40c1cf7`·`6679226`·`73bbad9`·`6533099`)
- 조각 디테일 셋 — 물증 아이콘(빈 동그라미였다) · 왼쪽 연결 포트 · 칩 단 점
- 셸 둘 — **안 읽음 점 4개** · **뒤로/앞으로**(`navHist`/`navIdx`)
- 현장 둘 — 장소별 단서 칩 · 도면 아래 조사 서술
- 용의자 **카드**의 「신규」 배지 (모달엔 있었다)

**5. 이식 대조기** (`3ec4cce`) — `npm run port-check`
원본 분기·반복 **326개**를 `docs/port-ledger.json` 과 대조. ported 130 · skip 25 ·
**미확인 171**.

## In Progress

없음. 전부 커밋됨. 빌드 green · 콘솔 에러 0 · 작업 트리 깨끗.

## Remaining Tasks

- [ ] **`port-check` 미확인 171을 0으로** — 07-25 이전에 옮긴 화면들이다.
      `isMap` 38 · `isInvestigate` 33 · `isNarrative` 32 · `isDetail` 32 ·
      `isIntro` 12 · `showOriginal` 9 · `isLog`·`isOverview` 6 · `isHome` 3.
      **0이 되면 `npm run build` 에 건다**
- [ ] **장 인터루드** — 프로토타입에 없는 유일한 신축. `Reveal.narration` 은 엔진에
      이미 5개 다 쓰여 있다. 설계는 `MEMORY.md` §장 인터루드
- [ ] 데이터 구멍 2 — `narrowsWindow` 좁혀진 라벨 · 조사 결과문 3건 신규 집필
- [ ] DC 마스터에 `DC-SYNC-CHANGESET.md` **9건** 반영 (사용자 · DC 툴)
- [ ] 모바일 레이아웃 — `isNarrow` 141·978~996 + `moreOpen` 988. 반응형 축소가
      아니라 재설계라 그 결정과 함께
- [ ] `connectMode` — 조각을 **클릭해서** 잇는 모드. 원본에도 켜는 버튼이 헤더에
      없어서 도달 경로부터 확인해야 한다
- [ ] Phase 4 플레이테스트 ← 이제 사건이 끝까지 플레이된다

## Key Decisions

- **전부 이식한다** — 관계 그래프·상황판 미결 종료 (사용자, 2026-07-26)
- **보고서 목록·보드 모드는 폐기** (사용자) — 산문만 잇는다
- **`RelationGraph`·`Action.pair` 는 엔진으로** — 평면도 `GEO` 와 같은 판단.
  사건마다 다른 저작 데이터는 `Case` 에 산다. 좌표는 저작이다(자동 배치 금지)
- **조사 대상 목록은 안 옮긴다** — `Action.target` 지점 실행으로 이미 대체.
  옮기면 같은 조사에 실행 경로가 두 벌 생긴다
- **`--g-*` 는 `:root`** — 스코프가 문제였지 값이 아니었다
- **게임에 「실패」가 없다** — 클리어는 다섯 장을 채운 순간이지 제출이 아니다
- **파생 계층 셋** — `score.ts`(채점) · `suspect.ts`(카드+모달) · `board.ts`(카탈로그).
  같은 계산 두 벌 금지
- **인용문은 날것으로 저장하고 화면이 따옴표를 그린다** (원본 401·966행)
- **DC 재export 는 지금 손해** — 게임 데이터 14덩이 하드코딩 + 앱이 고친 9건
  되살아남. 다만 `port-check` 가 그 계산을 바꾼다

## Blockers / Issues

- ⚠ **「완료」를 두 번 틀리게 말했다.** 두 번 다 최상위 화면 블록만 세어보고 한 말.
  실제 누락은 블록 **안**의 분기·반복에 몰려 있었다 — 07-25 의 45건과 같은 층위.
  `port-check` 를 만든 이유다
- ⚠ **미확인 171** — 아직 아무도 대조 안 한 분기가 그만큼 있다
- **발명 셋을 했다** — 필터 칩 순서 · 「실패」 상태 · `dot` 단을 남은 것으로 오인.
  셋 다 원본을 다시 읽고 되돌렸다

## Notes for Next Session

**끝났다고 말하기 전에 `npm run port-check` 를 돌린다.** 이번에 두 번 틀린 이유가
그걸 안 해서다.

**셸 안에서만 확인하지 않는다.** 07-26 최대 결함(`--g-*` 토큰이 셸 밖에서 전부
죽음)은 홈·사건 상세·모달이 `.app` 밖에 살아서 생겼다. 자유 진행 화면만 눌러보면
도달조차 못 한다.

**포인터 인터랙션은 좌표를 재라.** `PointerEvent` 를 실제로 dispatch 해서 저장된
좌표가 정확히 그만큼 움직였는지. 단, **매번 원점으로 되돌린 뒤** 재야 한다 —
한 번은 이전 테스트의 팬이 누적된 상태에서 재서 버그로 오인했다.

`npm run dev` → localhost:3000. `localStorage.clear()` 금지.

원본 위치 색인 (`prototype/추리게임.dc.html`, 마크업 1~1266):
사이드바 74~138 · 헤더 140~176 · 보고서 178~324 · 진술 325~381 · 메모 382~419 ·
채점 422~478 · 평면도 482~564 · 조사 기록 566~578 · **상황판 581~717** ·
**관계 그래프 719~743** · **표기 안내 746~821** · 개요 824~836 · 용의자 838~871 ·
조사 874~977 · 모바일 978~996 · 인트로 997~1064 · 홈 1066~1110 · 상세 1112~1139 ·
모달 1141~1266

## Files Modified

- `app/src/screens/` — **신설 6**: `Memo` · `Result` · `SuspectDetail` · `Relations` ·
  `BoardView` · `Reference`. 수정: `Suspects`·`FloorPlanView`·`Report`·`TermBank`·
  `StatementList`·`InvestigationLog`·`Home`·`CaseDetail`
- `app/src/case/` — **신설 3**: `score.ts`(채점) · `suspect.ts`(용의자 파생) ·
  `board.ts`(상황판 카탈로그). 수정: `catalog.ts`(`statusChip`)
- `app/src/components/QuotePicker.tsx` — 신설
- `app/src/state/stores.ts` — `Board`·`Relation` 타입 · `notes` 확장 · `seenClues` ·
  `unread`
- `app/src/shell/{Shell,DetailPanel}.tsx` · `app/src/App.tsx`
- `app/src/styles/app.css` — `--g-*` 를 `:root` 로 · 신규 화면 전부 (2681 → 3900행대)
- `engine/src/types.ts` — `RelationGraph` · `Action.pair` · `Case.relationGraph`
- `engine/src/schema.ts` · `engine/src/verifier.ts` — 로더 + 검사 9-5·9-6
- `engine/cases/mountain-lodge.yaml` — `relation_graph` · 알리바이 `pair` (23.6 → 24.9 KB)
- `scripts/port-check.mjs` · `docs/port-ledger.json` — **신설.** 이식 대조기
- `docs/MEMORY.md` · `docs/NEXT-ACTION.md` · `prototype/DC-SYNC-CHANGESET.md`(8·9번 추가)
- LLM Wiki `raw/2026-07-26-css-var-scope-and-port-ledger.md` — 신설 (컴파일 대기)
