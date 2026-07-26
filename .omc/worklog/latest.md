---
session_date: "2026-07-26 23:40"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/user/Desktop/Nobdy Lies"
---

## Completed Work

**커밋 11개(+3510 / −12642 · 64개 파일). `main` 에 fast-forward 병합됨. 브랜치 정리됨.**

**앱이 바뀌었다 — 손이식을 접고 DC React export 를 앱으로 삼았다.**

### 1. `port-check` 미확인 171 → 0 (`8859692`)
화면 아홉을 원본과 한 벌씩 대조. **실제로 빠져 있던 것 일곱** — 「배제 정보」 태그 ·
「발견」 표시 + 카드→단어 다이얼로그 · 단어 다이얼로그 메모 개수 배지 ·
**우측 패널 조사 기록 탭이 스텁이었다** · 「N장 완성으로 공개」 배지 ·
범례 「확보 물증」 · **완성/진행 장 머리글이 뒤바뀜**.

마지막 것은 갈래가 둘 다 있고 **조건이 틀린** 것이라 장부만으론 통과할 뻔했다.
원본 마크업이 아니라 `buildSections()`(2180행)를 읽어서 잡았다.
상황판이 상단 헤더를 덮던 것도 고쳤다(`.nl-view` 에 `position:relative`).

### 2. 앱을 DC React export 로 교체 (`dfdf878`)
사용자 결정. `app/src/App.jsx` 3116줄 단일 클래스 + `app/public/_ds/`.
옛 TypeScript 앱 50개 파일 삭제(`8859692` 에 남아 있다).

### 3. DC-SYNC 1~7 + 예산 6 재적용 (`565e1e0`)
export 가 옛 마스터에서 뽑혀 전부 되살아나 있었다. 인물명 1:1 검산
(세라 16=쿠라 16 · 다인 36=채원 36 …) · **조사 8건**(changeset 은 지문 2건만
적었다) · 이니셜 4 · 예산 5→6 을 `BUDGET` 상수 하나로.

같은 커밋에서 **진술 화면을 죽이던 `relChip()` 문자열**을 고쳤다.

### 4. 대조기를 앱에 겨눴다 · 장부 폐기 (`82f764a`)
`port-check` 초록불이 **사라진 앱**에 대한 기록이었다. 이제 프로토타입과
`App.jsx` 를 직접 비교한다 — **308 대 308 · 어긋남 0.** 음성 테스트 확인.
`docs/port-ledger.json` 삭제.

### 5. 상태 훑기 (`1a897bb`)
끝까지 밀었다 — 5장 채움 → 제출 → 채점 세 갈래 · 조사 6회 소진 · 화면 열 개.
**놓쳤던 예산 하드코딩 셋**을 더 잡았다(지역변수 `spent` 라 앞선 치환이 못 잡음).

### 6. 진행 저장 (`bde9910`)
export 에 `localStorage` 가 **0줄**이었다. 화이트리스트로 진행/주석/설정/휘발
네 갈래로 갈랐다 — 그 구분이 곧 엔진 재분리의 절반.

### 7. 사건 파일 이관 (`0be9796`, `d93fb4d`)
엔진이 정본이 된 것: 예산 · 프롤로그 · 인물 이름/나이/직업/주장요약 ·
진술 원문 5명 · 지문 · **공란 20의 답과 조사** · 장 제목 5 · **서사 문장틀 5** ·
확보 단어 출처/기록.

### 8. 엔진 YAML 쉼표 절단 4건 + 검사기 (`8e1bc0b`)
`npm run yaml-check` 신설, 빌드에 걸었다.

### 9. 버튼이 브라우저 기본 흰 버튼 (`48cbb03`)
**사용자가 화면으로 잡았다.** DS 번들이 `<head>` 에서 React 보다 먼저 돌았다.

## In Progress

없음. 전부 커밋·병합됨. `main` 빌드 green · 작업 트리 깨끗.

## Remaining Tasks

- [ ] **엔진 재분리 나머지 절반** ← 가장 큼. 아직 `App.jsx` 하드코딩:
      `REVEALS` · `CLAIM_REVEALS` · `TERM_MAP` · `CLUE_MAP` · `FLOOR_CLUES` ·
      `GEO` · `FIXTURES` · `WALK` · `GRAPH_*` · `COLLECTED_POOL`.
      **`REVEALS` 부터** — 장 완성 공개라 사건 진행에 직결
- [ ] `INV_ACTIONS` — **모델이 다르다.** 앱 6동사×대상 ↔ 엔진 23구체.
      `TERM_MAP['search:annex']` ↔ `a_annex`. 판정 로직과 붙어 있어 별도 설계
- [ ] **영문 이름이 옛 이름** — `Kim Chae-won` 13 · `Sakura` 4 · `Yena`/`Yujin`/`Yuri` 3 ·
      `Won-young` 2. **엔진엔 영문 이름 자체가 없다.** 로마자 표기 결정 필요
- [ ] **결말 산문 조사** — 문장틀이 하드코딩(「테이프**으로**」·「서지안**였다**」).
      `particle()` 은 멀쩡하고 문장틀이 안 쓴다. 프로토타입 원래 결함
- [ ] `COLLECTED_POOL` decoy 3(수면제·둔기·유산 상속) vs 엔진 영수증·물자국 —
      갈아끼우면 후보 12→11 로 **난이도가 바뀐다.** 설계 결정
- [ ] DC 마스터에 changeset 반영 — **다음 export 에 1~7 이 또 되살아난다**
- [ ] changeset 9번 표기 안내 (문안 저작)
- [ ] 장 인터루드 · Phase 4 앱 플레이테스트

## Key Decisions

- **손이식 폐기 → DC React export 가 앱** (사용자, 2026-07-26). 대가는 엔진이
  정본이 아니게 된 것 · 저장소 3분리·사건 파일 외부화도 함께 사라졌다
- **`--g-*` 를 `:root` 로 올리지 않는다** — 이 export 는 전부 한 트리 안이라
  문제가 없다(홈 z=70 · 상세 z=72 · 모달 z=90 실측). 올리면 재export 가 되돌린다
- **decoy 3 은 그대로** — 지우면 난이도가 바뀐다
- **`chapters[].opening` 은 안 가져온다** — 렌더할 자리가 없으면 죽은 데이터,
  자리를 만들면 이식이 아니라 발명
- **저장 목록은 화이트리스트** — 통째 저장하면 깨진 화면으로 복귀
- **표는 통째로 안 갈아끼운다. 필드 단위로.** 앱 표가 상위집합이다
  (평면도 좌표·영문·역할 라벨은 엔진에 없다)
- **장부 폐기** — 손이식이 이름을 바꿔서 있던 것. 기계 변환은 이름을 보존한다

## Blockers / Issues

- ⚠ **`window.React` 를 심고 끝냈다가 절반만 고쳤다.** `StatusIcon`(함수 안 참조)은
  살고 `Button`(모듈 최상단)은 죽는데 앞의 것만 보고 종료했다. **사용자가 화면으로
  잡았다.** `ds.__errors` 가 처음부터 적어두고 있었는데 첫 수정 뒤 다시 안 봤다
- ⚠ **커밋 `0be9796` 제목이 과장이다** — 「사건 파일이 정본이 됐다」인데 실제로는
  여섯 항목만 옮겼다. 열 개가 남아 있었다
- ⚠ **기계 변환의 새 결함 부류** — 변환은 완전한데 그 환경에서 안 돈다. 셋 다
  에러를 안 던졌다(흰 버튼 · 빈 화면 · 잘린 문장)
- **DC 마스터는 여전히 옛 상태**

## Notes for Next Session

**대조기 초록불을 「맞게 옮겼다」로 읽지 않는다.** 갈래가 있느냐까지만 본다.
장 머리글이 정확히 그렇게 빠져나갔다 — 두 갈래가 다 있고 조건이 뒤바뀌어 있었다.

**옮기기 전에 값을 센다.** 이번에 세 번 값을 했다 —
① 앱 `SECTIONS` 배열이 `s1,s3,s2,s4,s5` 순이라 `b1..b20` 순차로 이으면 2장·3장
답이 뒤바뀐다 ② 엔진 네 문장이 쉼표에서 잘려 있었다 ③ 4장 조각 수 7 vs 6 은
**오진**(인접 text 가 합쳐진 것 — 이어붙이면 같다).
**조각 수로 재면 오진이 난다. 이어붙인 문장 + 공란 순서/답으로 재라.**

**개수가 어긋나면 그 단위는 아예 건드리지 않는다.** 반쯤 덮어쓴 상태가 제일 나쁘다.

**기계 변환본은 「전 화면 열기」로 검수한다.** 에러 리스너를 걸고 라우트를
순회하되, 조용한 시각 결함(흰 버튼)은 그것으로도 안 잡히고 사람이 봐야 했다.

`npm run dev` → localhost:3000 (`.claude/launch.json` autoPort).
`localStorage.clear()` 금지 — 단 저장 키는 이제 `nobody-lies:mountain-lodge` 하나다.

빌드 게이트 순서: `engine typecheck` → **`yaml-check`** → `verify` →
**`port-check`** → `vite build`.

원본 위치 색인은 `docs/NEXT-ACTION.md` 참조. `App.jsx` 쪽 색인은 아직 없다 —
`grep -n "^  [A-Z_]\+ = " app/src/App.jsx` 로 표 목록이 나온다.

## Files Modified

- `app/src/App.jsx` — **신설(3116줄).** DC React export + changeset 재적용 +
  `applyCase()` + 진행 저장 + `BUDGET` 상수
- `app/src/main.jsx` — 신설. React 전역 심기 → **DS 번들 직접 로드** → 사건 파일 fetch
- `app/src/styles.css` — 신설. `app/src/styles/app.css`(4729줄) 삭제
- `app/index.html` — DS CSS 링크 · `<script>` 제거(로드 순서 문제)
- `app/public/_ds/` — Vector 번들 이동
- **삭제 50개** — `app/src/{screens,components,shell,case,marks,map,state,text}/` 전부
- `engine/cases/mountain-lodge.yaml` — `terms[].note.ko` 4건 따옴표
- `scripts/port-check.mjs` — 프로토타입 ↔ `App.jsx` 직접 비교로 재작성
- `scripts/yaml-comma-check.mjs` — **신설.** 쉼표 절단 검사기
- `docs/port-ledger.json` — **삭제**
- `package.json` · `app/package.json` — `yaml-check` 추가 · `tsc` 제거
- `docs/MEMORY.md` — §앱 교체 · §진행 저장 · §사건 파일 이관 신설
- `docs/NEXT-ACTION.md` — 교체 헤더 + 거짓이 된 결정 6개 수정
- `prototype/DC-SYNC-CHANGESET.md` — 재적용 기록 · 8번 종료
- LLM Wiki — `raw/2026-07-26-machine-conversion-and-global-bundles.md` 신설,
  토픽 4개 확장 + `silent-failures` 인스턴스 3건. **컴파일 반영 완료**
