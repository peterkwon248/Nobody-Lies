---
session_date: "2026-07-27 23:30"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/user/Desktop/Nobdy Lies"
---

## Completed Work

**미커밋 6파일 · +793/−127. 빌드 green · `port-check` 308:308 · 앱 전용 8 · 어긋남 0.**

### 1. 엔진 재분리 두 표 — `relation_graph` · `floor_plan`
`applyCase()` 안. 엔진이 정본이 된 것: **관계 도식** 라벨·게이트·`danger` /
**평면도** 한국어 라벨(방4·구역2·문5·창3)·도보 시간·별채 게이트·축척·설비 좌표.

⚠ **위치로 잇지 않았다.** 엔진 `discoveries` 는 `a_yuri · a_ph_wy · a_annex · a_sakura`
순이고 앱은 `yuri · annex · sakura · wonyoung` 순 — 순서로 이으면 「소지」와
「새벽 통화 확인」이 뒤바뀐다. 열쇠는 노드 `id` · 간선 `(from,to)` · 창 좌표 네 값 ·
동선 `building`. 조사 id ↔ `logKey` 대응은 **일부러 안 썼다**(`INV_ACTIONS` 충돌).

**화면으로 잡은 것**: `GRAPH_NODES` 피해자 `en` 이 `'Kim Chae-won'` 이었고
`PEOPLE` 에 `victim` 이 없어서 **영문 모드에 그 값이 실제로 렌더**되고 있었다.

### 2. DS 번들 자기 마운트 차단 (`main.jsx`)
`_ds_bundle.js:2283` 이 `createRoot(#root).render(<App/>)` — **두 앱이 겹쳐 렌더**되고
우리 앱이 순서 운으로 이기고 있었다. 로드 중에만 전역 `createRoot` 를 빈 루트로 바꿔 삼킴.
번들을 고치면 재생성에 사라지므로 우리 코드에서 막았다.

### 3. 「관계 그래프」 → 「관계도」 (사용자 요청)
3자리(`navGraph` + 표기 안내 2). 영문 `'Graph'` 유지.

### 4. `App.jsx` 가 정본 — export 동결 (사용자 결정)
changeset 12건 전부 「반영 불필요」로 닫음. **9번(표기 안내 문안)만 앱 할 일.**
`app/public/_ds/` 는 예외 — 여전히 export 산물.

### 5. `port-check` 에 앱 전용 선언 장치
`APP_ONLY` + **`staleAllow`**(적어놨는데 코드에 없으면 실패) → 목록이 코드를 따라간다.
출력이 `어긋남` 과 `앱 전용` 을 따로 센다. 실제로 발화했다 — 코드 전에 이름 6개를
미리 적었더니 빌드가 멈췄다.

### 6. 상황판이 탭 여럿 + 탭마다 바닥 도면
도면 4개 메서드 추출(`renderPlanFigure`·`renderClaimGridFigure`·`renderGraphFigure`·
`renderPlanTimes`) — **한 글자도 안 바꾸고** 스크립트로 이동, 인자 이름 `V` 유지해
분기 집합 308:308 그대로.

`get PB()` 병합 읽기 + `PB_set` 라우팅 → **`this.state.pb.` 86곳 정규식 한 번,
호출부 93곳 무변경.** `SAVE_VERSION 1→2` + v1 감싸기 마이그레이션.

## In Progress

없음. 전부 `main` 에 미커밋 상태로 완결. 커밋·푸시가 이 세션의 마지막 단계.

## Remaining Tasks

- [ ] **멀티 페이지의 남은 판단** — 바닥 위 배치를 **스냅하지 않았다**(격자 칸·평면도 방).
      스냅하면 「어느 칸에 들어가는지」를 게임이 정하게 되어 §0.2 자동 분석 경계에 가깝다.
      원하면 별도 논의
- [ ] **평면도 바닥 탭에서 타임라인을 끌지** — 바닥을 y=76 에 둬서 겹침은 피했다
- [ ] **픽셀 검증** — Browser 창이 표시 상태가 아니라 스크린샷 불가. 탭 띠 높이·바닥
      여백·시간띠 위치가 보기 좋은지 확인 못 함. 구조·좌표·레이어·불활성·게이트는 실측
- [ ] **`ds.__errors` 1건 미진단** — `{"path":"ui_kits/app/Panels.jsx","error":"StatusIcon is not defined"}`.
      `ds.StatusIcon` 은 함수로 존재하는데 컴파일 시점엔 없다(번들 내부 순서).
      **무엇이 폴백되는지 확인 안 했다** — 「첫 수정 뒤 다시 안 보기」를 반복하지 않으려면 여기서 시작
- [ ] `REVEALS`/`CLAIM_REVEALS` — **모델 충돌.** 저작 결정 대기 (`docs/NEXT-ACTION.md` 첫 절)
- [ ] `TERM_MAP`·`CLUE_MAP`·`INV_ACTIONS` — 한 덩어리로 묶여 있다
- [ ] `COLLECTED_POOL` — 남은 유일한 「깨끗한」 표지만 decoy 3 이 난이도를 바꾼다
- [ ] **엔진 예산 경고** `기대 6 + 여유 1 > 예산 6` → `slack 0` 이라 `hard` 판정.
      §10 은 「예산 6 = normal」을 의도했다. `verifier.ts:702` 가 「실측 1건」이라 적어둠
- [ ] **§8.2 미완**: 배포 파이프라인 **아무것도 없음**(`vercel.json`·`.github`·`src-tauri` 전무) ·
      저장소 3분리 부분 · 레이아웃·로직 분리 ❌
- [ ] **§9 플레이테스트 4명 중 1명** — 그 결과가 「격자·상황판·관계도를 실제로 쓰는가
      (안 쓰이면 프로덕션에서 제외)」와 난이도 공식을 가른다

## Key Decisions

- **`App.jsx` 가 정본, DC export 동결** (사용자) — 새 기능을 매 export 마다 손복원할 수
  없다. changeset 12건은 한 줄 문자열이라 가능했지만 기능은 종류가 다르다.
  이 미결이 §1 저장소 3분리·§2 레이아웃 분리에서도 걸려 있었다 — **실제 미결은 하나였다**
- **탭 경계**: 메모·타임라인 **공유**, 배치·실·영역·라벨은 **탭별**.
  기준은 「사건에 대한 기록인가, 이 추리에 대한 배치인가」 (사용자)
- **바닥은 고정** — 「상황판 자체가 그 장소」 (사용자)
- **불활성은 선택적** — `mapTime` 은 순수 화면 상태라 살린다. 조사 실행·격자 주장·
  알리바이 대조만 잠근다. **전부 잠근 것이 과잉이었다**
- **스냅 안 한다** — 자유 배치. 스냅은 게임이 판단하는 것에 가깝다
- **`SAVE_VERSION` 은 감쌀 수 있으면 올리고 감싼다** — 키 추가는 버전조차 안 올린다

## Blockers / Issues

- ⚠ **모델을 두 번 잘못 지었다.** 서랍을 「떠 있는 배경 판 셋」으로 지었는데 원하신 것은
  「탭마다 바닥 하나」였다. 사용자가 설명해준 뒤 갈아엎었다 — 드래그 방패·고정 토글·
  크기 손잡이가 버려졌다. **물어보기 전에 지었다**
- ⚠ **드래그 신고 3중 원인** — 기본 고정 · `stopPropagation` 누락(이 저장소 관례를
  안 따랐다) · `clampPan` 이 오른쪽만 자름. 「세로만 된다」는 판이 아니라 세계가
  움직이고 있었다는 뜻이었다. **측정으로 잡았다**
- ⚠ **`count: 0` 이 「평면도 0」으로 찍혔다.** `textContent` 로 잡았다
- ⚠ **내 주석이 대조기를 깼다.** 주석에 분기 패턴을 문자 그대로 적었더니 이름이 늘었다
- ⚠ **날짜를 「2026-07-26 3차」로 적었다** — 오늘은 07-27. 5파일 6곳 수정
- **DS `Panels.jsx` 미진단** (위 참조)

## Notes for Next Session

**`docs/NEXT-ACTION.md` 첫 절이 「`REVEALS` 부터가 거짓이다」로 시작한다.** 앞선
워크로그가 그것을 첫 타로 꼽았는데 `docs/MEMORY.md:739` 가 2026-07-24 에 이미
모델 불일치를 적어놨다. **우선순위 메모가 메모리와 모순돼 있었고 내가 거기 끌려갔다.**

**대조기 초록불의 뜻이 바뀌었다.** export 동결 후로는 「옮긴 것이 안 망가졌다」다.
새 기능은 `APP_ONLY` 에 선언하고, **그 커밋에서** 더한다(미리 적으면 실패한다).

**검증 도구 메모:**
- 이 세션에서 `find` 가 계속 실패했고 스크린샷이 안 됐다. fiber 를 걸어
  인스턴스를 잡고 `PB_render()`·`buildFloorplan()` 출력을 직접 읽는 것으로 대체했다
- `setState` 는 비동기다 — 한 블록에서 호출하고 바로 읽으면 옛 상태가 보인다.
  단계 사이에 `await tick()` 을 넣는다
- **저장은 임시 키에 백업하고 복원한다.** `window` 변수에 두면 새로고침에 사라진다
- 사이드바 클릭 전에 `elementFromPoint` 로 z=70(홈)·72(상세)·80(브리핑) 오버레이가
  덮고 있는지 확인한다. 진행 없는 상태에서는 홈이 덮는다
- `현장`·`진술`·`메모` 는 a11y 트리에 ref 를 못 받는다. `.nav-item` 의 React
  `onClick` 을 직접 부르는 것으로 우회

`npm run dev` → autoPort (3000 이 차면 다른 포트). 빌드 게이트:
`engine typecheck → yaml-check → verify → port-check → vite build`

## Files Modified

- `app/src/App.jsx` — **+633.** 관계 도식·평면도 이관 · 도면 4개 메서드 추출 ·
  `PB_CONTENT`/`get PB()`/`PB_set` 라우팅 · 탭 CRUD · 바닥 · `SAVE_VERSION 2` +
  v1 마이그레이션 · 중복 키 `color` 제거 · 「관계도」 개칭
- `app/src/main.jsx` — DS 번들 자기 마운트 차단(로드 중 전역 `createRoot` 스텁)
- `scripts/port-check.mjs` — `APP_ONLY` + `staleAllow` + 출력 분리. 주석 함정 기록
- `docs/MEMORY.md` — §상황판 탭 · §`App.jsx` 정본 · 정본 목록 갱신 · 결함 표 +2행 ·
  관계 도식·평면도 이관 절
- `docs/NEXT-ACTION.md` — 「`REVEALS` 부터는 거짓」 절 신설 · 낡은 브랜치·행수 수정
- `prototype/DC-SYNC-CHANGESET.md` — **파일 닫음**(12건 반영 불필요) · 10·11·12번 신설 ·
  export 결함 둘 기록
- **LLM Wiki** — `raw/2026-07-27-flat-state-to-tabs-and-inert-copies.md` 신설,
  토픽 4개 확장 + `silent-failures` 인스턴스 3건·축 3개. `2026-07-25-port-vs-repair`
  가 state 에서 누락돼 있던 것도 복구. **컴파일 반영 완료**
