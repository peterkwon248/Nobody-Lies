---
session_date: "2026-07-31"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kkh94/OneDrive/Desktop/Nobody Lies"
machine: "KWONKYUNGHUN (OneDrive 아래)"
---

## Completed Work

**작업 트리 깨끗 · 게이트 9단 초록(exit 0) · port-check 308/320/12/어긋남 0(불변).**

> ★ **게이트가 7단 → 9단이 됐다** ★
> `typecheck · lint · yaml-check · verify · gen-check · prop-check · tmpl-check · port-check · build`

### 0 — 문서 어긋남 셋을 닫았다 (읽다가 걸린 것)

- `MANIFESTO.md` §남은 일이 **③ 세는 도구를 1번으로** 들고 있었는데 `NEXT-ACTION` 은
  ✅ 닫힘이라 적었다. **이기는 문서 쪽이 낡아 있었다.** 그런데 **반대로도 틀렸다** —
  ③의 범위에 「서식의 손으로 적은 숫자」가 들어 있었고 그건 안 닫혔다.
  `2.46` 을 문서 밖에서 세니 **정확히 열 곳**(PROSE 2 · STATEMENT 5 · voice-check 1 ·
  Generator.jsx 2). **한 항목이 양방향으로 어긋나 있었고 둘 다 고쳤다.**
- `MEMORY.md:123` §절대 규칙의 **「빌드 타임 4곳(진술 산문/프롤로그/번역/UGC 누설 검사)」이 거짓**.
  실물은 넷이지만 **`CASE`·`PALETTE`·`PROSE`·`STATEMENT`** 다(`engine/templates/` 로 확인).
  같은 파일 `1067` 행이 자기를 반박하고 있었다. **틀린 쪽이 매 세션 읽는 절에 있었다.**
- `MEMORY.md:3320` 이 *「지금 막힌 것은 받아온 진술이 0건」* 이라며 **§4 상태 칸**을
  가리키는데, 그 칸은 07-30에 **커밋된 산문 사건 3건**으로 갱신됐다.
  **자기가 가리키는 칸이 자기를 반박하는 꼴** — `345c032` 가 닫은 부류의 재발.

### 1 — 감사 A: `schema.ts` 538줄 전문 · 경계가 새는 것을 **재서** 잡았다

탐침으로 뚫고 → 고치고 → **같은 탐침으로 막힌 걸 확인**했다.

| 망가뜨린 것 | 전 | 후 |
|---|---|---|
| `cost` 삭제 · `cost:'한개'` · `salience` · `budget:'여섯'` | 통과 | **파싱이 문다** |
| id 중복 4종(물증·사실·조사·인물) | 통과 | **파싱이 문다** |
| 장 `order` 중복 | 부수효과로만 | **파싱이 문다** |
| `인물` 공란 답이 어휘 밖 | 통과 | **검증기가 문다** |

★ **가장 큰 것: `cost` 를 지우면 「기대 NaN회」인데 난이도 `easy` · 「검증 통과」였다.**
`types.ts:376` 이 `cost: number` 라고 말하는데 **런타임에 확인하는 코드가 한 줄도 없었다.**
NaN 은 비교가 전부 거짓이라 난이도 사다리를 조용히 맨 아래로 떨어뜨린다 —
**타입이 거짓말하고 게이트가 초록으로 그 거짓말을 인쇄했다.**

★ **id 중복은 아무도 안 보고 있었다.** 처음엔 물리는 것처럼 보였는데, id 를 **덮어써서**
원래 id 가 사라지는 바람에 **엉뚱한 곳의 참조**가 깨진 것이었다. **더해서** 중복을
만들면 파싱·검증기 둘 다 통과했다. **「물었다」를 사유까지 읽어야 한다.**

- `인물` 공란: **시각·장소는 검증기가 무는데 인물만 빠져 있었다**(`verifier.ts:619`).
  답은 인물 **id** 다(`sakura`, 이름 아님). `closed` 일 때만 본다 — `discovered` 는
  확보 단어라 따로 물리고, 여기서 보면 거짓 실패가 된다.
- ⚠ **안 막은 것 하나**: `{ en: '...' }` 만 주면 `{ko:''}` 로 조용히 통과한다.

### 2 — 라이브러리 조사·도입 (매니페스토 §2·§3 이행. **린터 0개였다**)

사용자 요청으로 전수 조사. **엔진 런타임 의존성이 0개였다** — 4·5번(직접 구현·SVG)만 쓰고 있었다.

| | 상태 |
|---|---|
| **@biomejs/biome** 2.5.6 | ✅ 배선. **포매터는 껐다** — 켜면 `App.jsx` 를 다시 쓰는데 `port-check` 가 그 파일을 훑는다 |
| **fast-check** 4.9.0 | ✅ 배선 (`prop-check`) |
| zod 4.4.3 · martinez 0.8.1 · d3-hierarchy 3.1.2 · idb-keyval 6.3.0 | ⏸ **설치만. import 0** |
| ~~es-hangul~~ | ❌ **재보고 되돌렸다** |

★ **재본 것이 내 추천을 두 번 뒤집었다** ★

- **es-hangul 은 값이 없다.** 「비한글 이름(`3F`·`7`·`Yuri`)을 풀어준다」고 추천했는데
  **es-hangul 도 똑같이 「받침 없음」으로 떨어뜨린다.** 한글 13/13 은 우리 것과 일치.
  `App.jsx:2081` 의 손수 짠 조사 판별기는 **`(으)로` 의 ㄹ 예외까지 맞다.** 되돌렸다.
- **martinez 는 지금 넣으면 no-op.** 생성 사건의 방 면적 합을 재니 **전부 빈틈 0**
  (완전 타일링) — `union(rooms)` 이 지금 그리는 직사각형과 **같은 도형**이다.
  **「martinez(2번)」와 「squarify(7번)」는 두 일이 아니라 한 일이었다.**

### 3 — 게이트 8·9단째: `lint` · `prop-check`

- **biome 이 첫 실행에 진짜를 찾았다** — `TRICKS` 의 `culprit` 매개변수가
  **다섯 아키타입 전부에서 안 쓰인다**(타입에도 선언돼 있다). 「죽은 배선」 부류.
- **`prop-check` 이 `gen-check` 의 사각을 덮는다** — `gen-check` 은 **장 수 기본값 5**로만
  돌아 옵션 공간을 한 번도 안 밟는다. 이제 씨앗 무작위 × 장 2~8 × 사망칸 1~3 +
  **YAML 왕복 대조**. 왕복 검사가 살아 있는지 심어서 확인했다(예산 하나만 틀어도 잡는다).
- ⚠ **내 첫 속성이 틀렸다** — `generateCase` **날것**을 검증했는데 예산은 실험자(`fit`)가
  정한다. fast-check 이 `seed 1 · chapters 3` 로 줄여준 반례가 **사건의 결함이 아니라
  내가 계약을 잘못 읽은 것**이었다. `run()` 으로 고치니 통과.

### 4 — ★ 결정 실험: 사용자의 오프라인 크라임씬 텍스트가 캠페인이 되나 ★

사용자가 예전에 플레이한 추리 텍스트 10편을 붙여주고 *「이런 일반 텍스트도 캠페인화
가능한가」* 를 물었다. **의견 대신 옮겨봤다** — 「연습실 편」을 손으로 YAML 로.

```
첫 시도 오류 둘 → 고치니 검증 통과
  x 3장 조합 수 20 — 30 미만이면 찍기가 가능하다
  x 2장 완성에는 서사가 없다
```

★★ **둘 다 「원문이 안 맞다」가 아니라 「게임이 덜 만들어졌다」였다.** ★★
**논리 골격은 손도 안 대고 통과했다** — 유일성·기회·트릭 계약·획득 경로 전부.

```
원문에서 온 것  64   격자 19칸 · 거짓말 4칸 · 진술 15문단 · 인물 6 · 장소 7 · 범인 · 핵심물증 5
지어낸 것      112   조사 21 · 공란 10 · 보고서 23조각 · 레드헤링 20 · 예산·salience 22
                     = 전부 **게임화 층**
```

**그래서 브리프 설계가 바뀐다.** LLM 에게 YAML 전체를 쓰게 하면 112개 중 대부분을
LLM 이 정하게 되는데, 그중 조사 구성·예산·salience·레드헤링 배치는 **매니페스토 §5 가
코드 몫이라고 못박은 「게임 로직」**이다. 바른 모양은:

```
자유 텍스트 → LLM → 진실 세계만 → 코드가 게임화 층을 짓는다 → parseCase+verifier 판정
```

**곁다리 발견 셋:**
- ⚠ **원문이 전부 실존 아이돌 이름을 쓴다.** 서식이 금지하는데(`case-template.yaml:90`)
  **게이트에 그 검사가 없다** — 실명으로 만든 사건이 그냥 통과한다
- ⚠ **편마다 완성도가 다르다.** 「도서실 편」은 *"가능성이 제일 높은 건 손나은이다"* 로
  끝나 **유일성 미달** — 그대로는 떨어진다. 연습실 편은 건반 암호(C+Y)가 있어 통과했다
- 평면도는 일부러 뺐다 — §9-3i 기하 검사가 논리 층을 흐린다. **별도 단계**

### 5 — `generateCase` 1,951줄을 둘로 갈랐다 (회귀 0)

```
전   generateCase                    1,951줄
후   generateCase          2줄  ← buildGameLayer(buildWorld(...))
     buildWorld       1,185줄  진실 세계 · 평면도 · 진술
     buildGameLayer     767줄  물증 · 조사 · 공란 · 예산   ← export
```

**손대기 전에 안전 조건을 기계로 쟀다**: 이음매를 건너는 것 중 `let` **0** · 재대입 **0** ·
그림자 **0** → 구조분해가 원래 바인딩과 같음이 **구조적으로 보장**된다.
타입은 `ReturnType<typeof buildWorld>` 로 **추론시켰다**(43개를 손으로 쓰면 흘린다).

**변환도 스크립트로 했다.** 손으로 767줄을 옮겼으면 못 잡았을 것 둘:
- **`seed` 를 빠뜨렸다** — 매개변수라 `const/let` 훑기에 안 걸렸다. **tsc 가 잡았다**
- **`statementOf` 를 잘못 넣었다** — 게임화 층 **주석에만** 나오는 이름.
  **오늘 들인 biome 이 「구조분해했는데 안 쓴다」로 잡았다** — 내가 새로 만들 뻔한 죽은 배선

★ **이음매 43개가 곧 들여오기의 계약이다** ★

```
진실 세계  21   ids · culprit · innocents · t · person · places · tool · motive …
평면도 기하 11   rooms · SITES · SUBROOMS · DOORS · WINDOWS · WALKS · TL · *Box …
생성기 내부 11   HERRING · secretObject · claimLoc · innocentPresence · r · P · pick …
```

**분리가 답을 준 게 아니라 질문을 정확하게 만들었다** — 1,951줄에 숨어 있던 문제가
43줄 목록이 됐다. 원문이 주는 건 21 쪽이고 **기하 11 + 내부 11 은 여전히 코드 몫이다.**

### 6 — 도구 둘을 저장소에 넣었다 (*커밋 안 하면 다음 기계에 없다*)

- **`npm run lock-fix`** — `package-lock.json` 의 `"peer": true` 만 **제자리에** 되살린다.
  이 세션에만 두 번 났다. **진짜 의존성 추가와 섞이면 `git checkout` 을 못 쓴다**(이번에 막혔다)
- **`npm run gen-baseline -w engine -- save|check`** — 생성 산출물 기준선.
  이번 리팩터를 안전하게 만든 도구이고 평면도 작업 때도 매번 새로 썼다.
  ⛔ **게이트에 안 건다**(기준선 없는 기계에선 실패가 아니라 무의미) · 산출물 2.4MB 라 gitignore

### 검증한 것

| | |
|---|---|
| 게이트 | **9단 exit 0** · 40/40 · 속성 50건 · port 308/320/12/어긋남 0 (불변) |
| 리팩터 회귀 | **0** — 씨앗 40 + 장 6종 + 사망칸 2종 = **64건이 기준선과 완전히 같다** |
| 경계 구멍 | 탐침 8종을 **전·후로** 돌려 일곱 부류가 닫힌 것을 확인 |
| 조사 판별기 | 한글 13/13 · es-hangul 과 대조 |
| 크라임씬 이식 | 연습실 편 **검증 통과** (스크래치패드 `practice-room.yaml`) |

## In Progress

없음.

## Remaining Tasks

- [ ] **🎯 다음 하나 — 문 1: YAML/JSON 들여오기 UI** (작고 독립적이다)
      `<input type=file>` + **YAML 붙여넣기 칸**(§8 이 이미 복붙 문화다) →
      `parseCase` 가 문지기(**오늘 일곱 군데 조였다**) → 왕복 대조(`out.same`) →
      `idb-keyval` 로 저장(설치돼 있다) → `?case=local:<id>` 로 연결.
      **`Generator.jsx` 는 프로토타입에 없어 `port-check` 대상이 아니다** — 위험이 낮다.
      ⚠ 들어가기 전에 `js-yaml` 의 `load` 가 남의 파일에 안전한지 **재본다**
      ⚠ 거절 경로 시험물이 이미 있다 — 스크래치패드의 mutant YAML 들
- [ ] **IMPORT-BRIEF (문 2)** — LLM 이 **진실 세계 21만** 채우게. 그 전에 **설계 결정 하나**:
      기하 11 · 내부 11 을 코드가 어떻게 지을지 (지금은 `buildWorld` 안에서 씨앗과 함께 난다)
- [ ] **평면도 = martinez + squarify를 한 일로** — 봉투를 비직사각형으로 여는 순간
      생성기 계약 · 검증기 §9-3i · 앱 렌더가 **동시에** 바뀐다. **온전한 한 세션**
- [ ] **미배선 의존성 넷** — `zod`·`martinez`·`d3-hierarchy`·`idb-keyval`.
      쓸 자리가 정해져 있지만 **지금은 죽은 배선**이다. 안 쓸 거면 빼는 게 깨끗하다
- [ ] **감사 A 나머지** — `generate.ts` 는 **구조는 알게 됐지만**(1,951줄 지도) 전문은 안 읽었다.
      `cli` 계열 652 · `schema.ts` 538 은 **끝**
- [ ] 감사 B (`applyCase` 1166 · `Generator.jsx` 1323) · 감사 C (`App.jsx` 3756 · scripts)
- [ ] **실존 인물명 검사가 없다** — 서식은 금지하는데 게이트가 안 본다. UGC 라 급소
- [ ] `text()` 가 `{en}` 만 받으면 `{ko:''}` 로 조용히 통과
- [ ] `TRICKS` 의 `culprit` 매개변수 5개 미사용 (biome 경고)
- [ ] **① `Fact.basis` 도출** · **`applyCase` 감시** · **⑤ 검열관** · **§9 수정 브리프**
- [ ] EN 토글 반쪽 · 서식의 `2.46` **열 곳** · `voice-check.mjs:36` `REF.endings: 5`(잰 값 4)
- [ ] `brief-check`(게이트 10단째) · 죽은 필드 · ⑤ 배포 확인 · 관계도의 선 · 색·대비·질감

## Blockers / Issues

- ⚠️ **들여오기 입구가 아직 없다.** 오늘은 가르기까지다 — `buildWorld` 의 반환 43필드가
  그 입구의 계약이라고 파일에 적어뒀다
- ⚠️ **모순 검사가 0개다.** 산문 검사 넷이 전부 `text.includes(w)` — **문장이 참인지는 안 묻는다**
- ⚠️ **`applyCase` 1166줄·표 21개에 감시가 0** · **게이트가 JSX·서식을 안 읽는다**
- ⚠️ **`npm install`/`uninstall` 이 `peer` 표시를 지운다 — 이제 `npm run lock-fix`**
- ⚠️ **PowerShell 이 파이프라인을 끊는다** — `Out-String` 으로 받는다
- ⚠️ **PowerShell 작업 디렉터리가 남는다** — `Set-Location <루트>` 를 앞에
- ⚠️ **PowerShell 이 standalone `--` 를 삼킨다.** 엔진 CLI 는 **Bash**
- ⚠️ **Bash 의 `/c/...` · `/tmp` 가 node 에 그대로 가면 깨진다.** `C:/Users/...` 로 준다
- ⚠️ **`new URL(...).pathname` 금지** — 저장소 경로에 **공백**(`Nobody Lies`)이 있어
  `%20` 이 안 풀린 채 `fs` 로 간다. **`fileURLToPath`** 를 쓴다 (2026-07-31 재현)
- ⚠️ **스크래치패드에서 엔진을 import 하려면** `.mts` + `file:///…%20…` URL 이어야 한다
- ⚠️ **`python3` 없음** · **`read_page` 가 앱을 못 본다** · **스크린샷 막혀 있다**
- ⚠️ **커밋 없이 `git stash` 금지** · **`localStorage.clear()` 금지**

## Notes for Next Session

- **`before-work` 순서 그대로.** `git pull` 이 맨 앞 · **직접 main 푸시**
- ★ **읽기 0번이 `docs/MANIFESTO.md`.** API 를 붙일까 **묻지 않는다**(§8)
- ★ **게이트가 9단이다.** `package.json` 의 `build` 를 믿는다 — 문서가 아니라
- ★ **「재보니 달랐다」가 이 세션에 네 번이다** — es-hangul · martinez · 내 속성 ·
  「id 중복이 물린다」. **출력은 읽는 것이 아니라 대조하는 것이다**를 또 확인했다
- ★ **린터와 컴파일러가 리팩터를 두 번 구했다**(`seed` 누락 · `statementOf` 오포함).
  큰 변환은 **손이 아니라 스크립트로** 하고 도구에게 검사시킨다
- **크라임씬 실험 산출물이 스크래치패드에 있다**(`practice-room.yaml`, 검증 통과).
  세션이 끝나면 사라진다 — **필요하면 `engine/cases/` 로 옮긴다**
  (`closing-theater.yaml` 을 ⑤검열관 재현 테스트로 남긴 것과 같은 이유)
- **이 브라우저에 시험용 생성 사건이 남아 있다**(`gen-*`). 유용한 고정물이라 안 지웠다

## Files Modified

- `engine/src/generate.ts` — **`generateCase` 1,951줄 → `buildWorld` + `buildGameLayer`.**
  이음매 43필드 · 회귀 0
- `engine/src/schema.ts` — `reqNum`·`uniqueIds` 신설 · budget/cost/salience/order 숫자 검사 ·
  id 중복 6곳 · 장 order 중복
- `engine/src/verifier.ts` — 인물 계열 공란(`인물`·`마지막목격자`·`협박대상`) 답 검사
- `engine/src/prop-check.ts` — **신설.** fast-check 속성 검사
- `engine/src/gen-baseline.ts` — **신설.** 리팩터 회귀 대조기
- `scripts/lock-peer-restore.mjs` — **신설.** `npm run lock-fix`
- `biome.jsonc` — **신설.** 린터 전용(포매터 off) · correctness 만
- `package.json` · `engine/package.json` · `app/package.json` · `package-lock.json` — 의존성·스크립트
- `.gitignore` — `engine/.gen-baseline.json`
- `docs/MANIFESTO.md` · `docs/MEMORY.md` · `docs/NEXT-ACTION.md` · `docs/SESSION-LOG.md` ·
  `.omc/worklog/latest.md`
