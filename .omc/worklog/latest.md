---
session_date: "2026-07-25 20:30"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/user/Desktop/Nobdy Lies"
---

## Completed Work

**커밋 8개. 이식 부채를 청산하고 조사 시스템까지 붙였다. 게임이 2장 너머로 뚫렸다.**

**1. 이식 전수 대조** (`15176d2`) — 이미 옮긴 7화면을 프로토타입 마크업 **전 범위
(73~1266행)** 와 한 줄씩 대조. **누락 45 · 다름 17.** 우측 패널 3건은 빙산의 일각이었다.
전 과정은 `docs/PORT-AUDIT.md`.

**2. 엔진 스키마 확장 + 검증기가 처음 산문을 읽는다** (`7b0d612`)
- `statement.gesture{pre,post}` 5명 · `incident.body_state`/`scene_state` ·
  `person.sex`/`claim_summary` · `terms` 12 · `action.result` 13 · `action.target` 19 ·
  `floor_plan` · `building.revealed_after`
- 검증기 **9-1~9-4**: 지문 균등성 · 현장 서술 누설 · 도면↔장소 · 조사↔지점.
  음성 테스트 6종 발화·exit 1 확인

**3. 이식 A~I** (`d4a8f53`) — 누락 45·다름 17 반영. 9묶음, 전부 육안 대조
- **B0 게임 토큰** — 원본 `<style>` 30~52행이 앱에 **0건**이었다. `--g-*` 아홉을
  프로토타입이 48곳에서 쓴다(공란 3상태 + 마킹 4색)
- **C 마킹** 드래그 4색 + 인용 + 복사 · **D 진술 화면** D안 조판 재이식 ·
  **E 확보 단어 은행**(보고서 2단) · **F 보고서 잔여** · **G 우측 패널** ·
  **H 모달 인프라** · **I 사건 개요** · **A 잔손질**

**4. 현장 평면도** (`1afda24`) — `GEO` 171줄 + 생성기 135줄. 기하와 게임 상태를 갈랐다
(`app/src/map/geometry.ts`). 벽은 데이터에 없다 — 맞닿은 방에서 계산하고 문이 뚫은
구간을 잘라낸다. 인물 마커는 `claimedLocationAt`(주장) — 진실이 아니다

**5. 조사 결과문 13건** (`2f2da1b`) — `resultFor`(1927행)에 ko/en 다 쓰여 있었는데
사건 파일엔 0건이었다

**6. 조사 시스템** (`e521b51`) — 평면도·용의자 카드에서 실행 → 확인 모달 → 결과 카드
→ 예산 차감 → 조사 기록. **실측: 시신 정밀 검사 → 6/6→5/6 → 확보 단어에
`일산화탄소 중독` 추가**

**7. 용의자 + 도식** (`37212dd`) — 심증(제외/주목/유력) · 동기·기회·수단 ·
주장 대조표(행=인물, 열=시간대, 칸=주장 위치)

**8. 사이드바 이름·구조 바로잡음** (`038ac94`) — 사용자 지적. `현장 평면도`→`현장`,
`조사`→`조사 기록`([도구]). 용의자 카드 조사 버튼 이식

## In Progress

없음. 전부 커밋됨. 빌드 green (경고 1건은 의도된 예산 긴장).

## Remaining Tasks

- [ ] **메모 화면** — 원본 382~420행(39줄). [도구] 그룹. `PlayerAnnotations.notes` 재사용.
      **인용 피커**(1257~1266)가 딸려 온다
- [ ] ⚠ **관계 그래프(138줄) · 상황판(132줄)** — `HANDOFF` §8.1 이 *"안 쓰이면 안 옮긴다"*
      고 지목한 둘. **270줄이 걸린 미결. 옮기기 전에 사용자에게 물을 것**
- [ ] **최종 제출 · 채점 · 결말** — 421~480행. 제출 모달은 이미 있고 지금은 닫히기만 한다
- [ ] **표기 안내** — 745~822행. **맨 마지막.** 완성된 게임 전체의 범례라
      지금 옮기면 절반이 거짓말이 된다
- [ ] **장 인터루드** — 프로토타입에 **없다.** 유일한 신축
- [ ] 데이터 구멍 3: `narrowsWindow` 좁혀진 라벨 · 조사 결과문 3건 신규 집필
- [ ] DC 마스터에 `DC-SYNC-CHANGESET.md` **7건** 반영 (사용자 · DC 툴)

## Key Decisions

- **이식 방식을 바꿨다** — 사용자가 *"그냥 그대로 구현하고 수정할 것만 고치면 되지
  않냐"* 고 물었고 **맞는 말이다.** 이 세션이 아팠던 건 이식이 아니라 **수리**였기
  때문이다(앱이 이미 원본을 안 읽고 지어져 있었다). **남은 화면은 앱에 없으므로
  감사표를 다시 쓰지 않는다** — 원본 구간 하나 읽고 컴포넌트 하나 쓴다
- **층을 둘로 가른다** — 화면(클래스·구조·스타일·UI 문구)은 프로토타입이 정본,
  게임 데이터(숫자·사실·어휘·사건 산문)는 엔진이 정본. 합의된 예외 8개 외엔 판단하지 않는다
- **GEO는 사건 파일에** — 사건마다 도면이 다르고 `Case` 는 불변 사건 정의다.
  앱에 두면 사건이 자기 지도를 못 갖는다. 선택 항목(생성 사건은 도면이 없다)
- **기하는 게임 상태를 모른다** — 알면 도면이 「여기를 조사했다」를 선 굵기로 말하기 시작한다
- **확보 단어는 조사 때 손대지 않는다** — `deriveTerms` 가 다시 계산한다. 같은 계산 두 벌 금지
- **재개봉은 두 상태** — `reopensUsed`(영구) ↔ `reopensOpen`(지금 열림).
  하나로 뭉쳐 있어서 「편집 완료」가 성립하지 않았다
- **심증은 플레이어 것** — `verdicts` 는 게임의 판정이 아니라 자기 메모. 점수 무관.
  같은 값 다시 누르면 해제(되돌릴 수 없는 표시는 판정처럼 느껴진다)
- **표기 안내는 맨 뒤** — 설명 대상 화면이 다 서야 참이 된다.
  `autoTag`(자동)는 폐기된 「모순 경고」 잔해라 **이식하지 않는다**

## Blockers / Issues

- ⚠ **관계 그래프·상황판 270줄이 미결이다.** 플레이테스트 전에 옮기면 헛수고가 될 수 있다
- **사용자 저장 데이터를 날렸다.** 검증 중 `localStorage.clear()` 를 썼는데 포트 3000이
  개발 세션과 같은 origin이었다. `solved:[0]` · 답 4개 · 메모 3개 소실.
  진행 상태는 덤프가 있어 복구 가능하다고 알렸고 사용자는 답하지 않았다.
  **앞으로 이 origin에서 clear 금지** — `NEXT-ACTION.md` 살아있는 결정 10번에 박음
- DC 워크스페이스는 여전히 옛 상태. changeset이 5건 → **7건**으로 늘었다

## Notes for Next Session

**화면을 눈으로 볼 것.** 이번에 빌드·타입체크·검증기를 전부 통과한 채 살아 있던
결함이 셋이었다:
1. `<style>` 토큰 블록 통째 누락 (48곳에서 쓰이는데 0건 이식)
2. **YAML flow mapping 쉼표** — `{ ko: 방문·창가 테이프, 화로에 연탄 }` 에서 쉼표가
   키 구분자로 먹혀 뒷부분이 조용히 잘렸다
3. **용의자 슬롯이 범인을 가리켰다** — 무료 사실까지 넣어서 조사 0회에 세라만 두 칸이
   찼다. 절대 규칙 「프로필의 유죄 판정 금지」 위반

**발명이 필요하면 덜 옮긴 것이다.** 사이드바 「조사」 항목이 그랬다 — 용의자 카드의
조사 버튼을 안 옮겨서 인물 조사가 갈 곳이 없었기 때문이었다.

**프로토타입 결함 다섯이 같은 뿌리다** — 인물명 교체 때 파생물(조사·이니셜·요약)이
안 따라갔다. `DC-SYNC-CHANGESET.md` 6·7번.

`npm run dev` → localhost:3000. `localStorage.clear()` 금지.

원본 위치 색인 (`prototype/추리게임.dc.html`):
사이드바 74~138 · 상단 헤더 140~176 · 보고서 177~324 · 진술 325~381 ·
**메모 382~420** · 채점·결말 421~480 · 평면도 481~564 · 조사 기록 565~579 ·
상황판 583~714 · **관계 그래프 580~717** · **표기 안내 745~822** · 개요 823~836 ·
용의자 837~872 · 조사 873~985 · 인트로 997~1064 · 홈 1066~1110 · 상세 1112~1139 ·
모달 1141~1266

## Files Modified

- `docs/PORT-AUDIT.md` — **신설.** 전수 대조 결과 + 합의된 예외 8 + 작업 순서표
- `docs/MEMORY.md` — 전수 대조 절 · 검증기 9-1~9-4 · 스키마 확장표 · 진행 상황 갱신
- `docs/NEXT-ACTION.md` — 전면 재작성. 이식 방식 전환 · 남은 화면 · 데이터 구멍 3
- `prototype/DC-SYNC-CHANGESET.md` — 6(지문 조사) · 7(아바타 이니셜) 추가
- `engine/src/types.ts` — gesture · bodyState/sceneState · sex/claimSummary ·
  FloorPlan · Action.target
- `engine/src/schema.ts` — 위 전부의 로더 + `floorPlan()`
- `engine/src/verifier.ts` — 검사 9-1~9-4 (산문·도면·조사 정합)
- `engine/cases/mountain-lodge.yaml` — 지문 5 · 브리핑 사실 2 · terms 12 ·
  result 13 · target 19 · floor_plan · claim_summary 5. 15.5 KB → 23.6 KB
- `app/src/marks/{marks.ts,MarkedText.tsx}` — **신설.** 4색 마킹
- `app/src/map/geometry.ts` — **신설.** 평면도 기하 생성기
- `app/src/screens/{TermBank,FloorPlanView,ClaimGrid,Suspects,Investigate,InvestigationLog}.tsx` — 신설
- `app/src/components/{StatusIcon,Confirm}.tsx` · `app/src/case/people.ts` — 신설
- `app/src/screens/{Home,CaseDetail,Briefing,Statements,StatementList,Overview,Report}.tsx` — 재이식
- `app/src/shell/{Shell,DetailPanel}.tsx` · `app/src/App.tsx` · `app/src/state/stores.ts`
- `app/src/styles/app.css` — 게임 토큰 블록 + 신규 화면 전부
- `app/vite.config.ts` · `.claude/launch.json` — PORT 존중 · autoPort
