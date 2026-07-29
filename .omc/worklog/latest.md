---
session_date: "2026-07-30"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kkh94/OneDrive/Desktop/Nobody Lies"
machine: "KWONKYUNGHUN (OneDrive 아래)"
---

## Completed Work

**작업 트리 깨끗 · 빌드 게이트 7단 초록(exit 0) · port-check 308/320/12/어긋남 0(불변).**

### 이번 세션 — 산장 누설을 다섯 갈래에서 걷어냈다

```
✅ ① 산문을 스키마로
🔨 ② 산문가        왕복은 돌았으나 **두께를 아직 안 쟀다** (사용자 손 · 이번에도 못 했다)
⬜ ③ 검열관        규칙 쪽 §9-3f 추가. LLM 쪽은 여전히 없다
✅ ④ 작가          + 사망 구간 칸 수 손잡이 · 프롤로그 정합 · 조사 처리기
```

닫은 것이 전부 같은 부류다 — **「앱이 산장용으로 그리는데 생성 사건엔 그 데이터가 없다」**.
게이트 7단은 **내내 초록이었다.**

```
FLOOR_CLUES     부검하면 자연사 박물관 전시실에 「일산화탄소」   재현 → applyCase 에서 도출
CLAIMS          도식 탭이 통째로 빔                            CLAIM_LOC 에 이름만 붙인다
AUTO            {'sakura-t2': true} · 참조 0                  지웠다
브리핑 셋        「외상 없음」·「화로에 연탄」·사망 추정          사건 파일에서 읽는다
창 축소 라벨     부검하면 창 이름이 「새벽 3~5시」로 바뀜         narrowsWindow 선언 기반
```

### 1 — `FLOOR_CLUES` (다음 하나였던 것 · 닫힘)

**재현부터 했다.** 07-29 감사가 도출로만 찍어둔 것을 박물관 사건 `gen-87494` 로 눌러서
확인했다 — 도면 「특별 전시실」에 `물증 · 일산화탄소`. 뿌리는 `targetKey()` 가
`mode:'none'` 에 `'body'` 를 **글자로 박는 것** + 현장이 언제나 `room`.

**새 엔진 필드는 필요 없었다** — `TERM_MAP` 을 만드는 `map`·`byKey` 가 이미 있고 자리는
`target` 에서 나온다. 사람 대상은 **뺐다**(엔진이 누구 짐이 어디 있는지 말하지 않는다).
`yield` 로 **안 가른다**(§절대 규칙의 유용도 시각 구분이 공짜로 지켜진다).

### 2 — 사망 구간 칸 수 (`deathCells` 1~3, 기본 1)

슬롯 id 를 **글자에서 자리 계산으로** — `FIRST`·`WIN[]`·`LAST`·`AXIS`.
`TRICKS` 는 3칸 선언 그대로 두고 `expandCells()` 가 축으로 늘린다.

**★ 회귀 0 을 diff 로 증명했다 ★** 코드 건드리기 **전에** 기준선 12건을 뜨고
변경 후 같은 명령으로 다시 떠서 `diff -r` → **차분 0**.

**문서의 비용 추정이 틀렸다** — 「엔진 26 · 앱 11 · 검증기 2」인데 실제 **앱 0 · 검증기 0**.
산장이 애초에 4칸이라 앱은 처음부터 일반적으로 짜여 있었다.

### 3 — 프롤로그 · 조사(助詞)

`delayed_mechanism` 이면 로비에 셋인데 프롤로그가 「다섯」이라 말했다(40건 중 **8건**).
**논리가 아니라 「그곳」의 지시 대상**이었다. 고치다 한 번 **더 나쁘게** 만들었다(피해자가
셈에 포함돼 20% → 100% 거짓). 답은 **인원을 시각에서 떼는 것**이었다.

`topicParticle` 신설 — `${victimName}은` 이 글자로 박혀 「문세라은」이 나왔다.
`subjectParticle`(이/가)이 **이미 옆에 있었는데 은/는 짝이 없어서** 안 쓰였다.

### 4 — 브리핑 · CDN

**「이미 있는데 배선만 없다」가 또 셋** — 산장 YAML 이 `body_state`·`scene_state`·
`narrows_window` 를 이미 갖고 있고 스키마·왕복·검증기(§9-2)가 다 있는데 **앱·생성기 양 끝만**
몰랐다. 생성기가 `bodyState`·`sceneState` 를 내게는 **안 했다**(§9-2 때문에 씨앗 단어로만
쓸 수 있고, 「외상 없음」은 트릭에 따라 거짓이다) → **값 없는 줄은 안 그린다.**

CDN: 바깥 `@import` 를 빼고 **뺐다고 말한다.** 검사를 CSS 로 넓혔다(JS 는 **일부러 안 본다**).
**「CDN 둘」이 하나였다** — 나머지 넷은 주석·placeholder 문자열.

### 검증한 것

| | |
|---|---|
| 게이트 | 7단 exit 0 · port-check **308/320/12/어긋남 0** (불변) |
| 생성 | 1·2·3칸 각 20건 **100% 통과** · 기본값 12건 **diff 0** |
| 네 세계 | 박물관·레지던시·방송국·기본어휘 · 표식 5건씩 · **산장 낱말 0** · 없는 `loc` 0 |
| 산장 | **불변** — `FLOOR_CLUES` 3건 영문(`Burner`·`CO`) · 브리핑 4줄 · 축소 `[t1,t2]` → 「새벽 3~5시」·갱신 배지·이전 값 |
| 조사 | 세 세계 45건 · 모음 끝 이름 12건 · **오결합 0** |
| 검증기 §9-3f | 기계 이름표 **4/4 발화** · `times.window` 준 팔레트 **0** · 1칸이면 아예 안 뜸 |
| 테스터 | 띄워서 **요청 0건**(`performance.getEntriesByType`) · 검사 심으면 **exit 1** |

## In Progress

없음.

## Remaining Tasks

- [ ] **🎯 `deathCells` ≥ 2 면 생성기가 「구간 축소」를 낸다 (다음 하나 · 코드 · 작음)**
      **내가 일부러 뺀 자리를 되살리는 일이다.** 앱의 축소가 산장 라벨을 흘려서
      `narrowsWindow` **선언 기반**으로 바꿨고, 생성기는 안 내므로 **생성 사건은 지금
      축소가 없다.** 저작이 필요 없다 — 창을 「셋 → 둘」로 좁히면 되고 **좁혀진 라벨도
      남은 칸의 이름표에서 도출**된다(앱의 `narrowedLabel()` 이 이미 그렇게 한다).
      ⚠ `deathCells === 1` 이면 내지 않는다(좁힐 데가 없고 기본값이라 회귀 0 유지).
- [ ] **진술 두께 — 산문 왕복** (사용자 손). 왕복은 돌았으나 **두께를 아직 안 쟀다** —
      산장 279자 대 조립 107자. **「산장급」에 남은 최대 격차**이고 세 세션 연속 못 했다
- [ ] 테스터에서 Pretendard 를 쓰려면 woff2 를 받아 `data:` 로 심는다(1.45MB → 약 3MB).
      **폰트 내려받기가 필요해서 안 했다** — 사용자 결정
- [ ] 관계도의 **선** — A(노드만, 지금) / B(마지막 장에 「가명→범인」). 사용자 결정
- [ ] 한 장소에 방이 둘이면 **단서 라벨이 둘 다에 뜬다**(`hall` = 로비+교육실).
      렌더가 loc 단위라 「미조사/물증」 상태 라벨도 **원래 그렇게 겹친다**(산장 `main` 도).
      네 세계 전부 `hall` 한 자리뿐이라 균일하고 규칙 위반 아님 — **디자인 판단**
- [ ] ⑤ 배포 — `installCommand` 는 고쳤으나 **push 후 Vercel 이 실제로 도는지** 봐야 닫힌다
- [ ] `app` 이 `js-yaml` 을 import 하면서 선언은 안 한다 (`Generator.jsx:2`) · lock 을 건드린다
- [ ] 인터루드 도착물 화면 4종 · `e_safes`·`a_ph_yuri` 의 `clues` · 색·대비·질감 · ③ 검열관 LLM

## Blockers / Issues

- ⚠️ **게이트가 JSX 를 안 본다.** 이번에 닫은 다섯 갈래 전부 7단 초록인 채로 살아 있었다
- ⚠️ **출력은 읽는 것이 아니라 대조하는 것이다.** 축소 라벨 「새벽 3~5시」를 이 세션
  **아침에 이미 화면에서 보고** 「축소가 작동한다」로 읽었다. 그 사건의 시간대 이름과
  맞춰봤으면 그 자리에서 걸렸다
- ⚠️ **PowerShell 작업 디렉터리가 남는다.** `engine/` 에서 `npm run build` 를 돌려
  `Missing script: "build"` 로 게이트가 실패했다 — 내 변경 탓으로 오진할 뻔했다.
  **`Set-Location <루트>` 를 앞에 붙인다**
- ⚠️ **PowerShell 이 standalone `--` 를 삼킨다.** 엔진 CLI 는 Bash 로 돌린다
- ⚠️ **`python3` 가 없다.** YAML 을 뜯을 때는 engine 디렉터리에서
  `node --input-type=module -e` + `await import('js-yaml')` (워크스페이스 밖에서는 해석 실패)
- ⚠️ **`read_page` 가 앱을 못 본다.** `javascript_tool` 로 DOM·localStorage·React fiber 를 읽는다.
  React 제어 input 은 네이티브 setter + `dispatchEvent(new Event('input',{bubbles:true}))`
- ⚠️ **스크린샷이 막혀 있다**(Browser pane 미표시). `getBoundingClientRect`·`innerText` 로 잰다
- ⚠️ **`file://` 은 정적 스냅샷으로만 열린다** — 단일 HTML 을 실제로 재려면
  gitignore 안쪽(`app/public/cases/`)에 두고 dev 서버로 띄운다. 끝나면 지운다
- ⚠️ **커밋 없이 `git stash` 를 쓰지 않는다** · **`localStorage.clear()` 금지**
- ⚠️ 콘솔의 `createRoot` 중복 경고는 **DS 번들 것**이다 — 산장에서도 똑같이 뜬다

## Notes for Next Session

- **`before-work` 순서 그대로.** `git pull` 이 맨 앞. 이 저장소는 **직접 main 푸시**
- **게이트는 7단이다** — `package.json` 의 `build` 를 믿는다
- **다음 하나는 축소다** — 위 🎯. 앱은 `narrowedLabel()` 로 **이미 준비돼 있다**
- **사용자가 만든 사건이 사용자 브라우저에 산다** — 산문을 입힌 것이 있으면 행의
  **「YAML」**로 꺼내 `engine/cases/` 에 커밋하라고 알린다. 그게 사건 2번이 된다
- **이 브라우저(in-app)에 시험용 생성 사건이 여럿 남아 있다**(`gen-*`). 유용한 고정물이라
  안 지웠다 — `gen-88291`(레지던시 · 모음 끝 이름) · `gen-60221`(박물관 2칸)
- **테스터 글꼴이 배포본과 다르다** — 조립기가 말해주지만 처음 보면 놀랄 수 있다

## Files Modified

- `engine/src/generate.ts` — **슬롯 자리 계산**(`FIRST`·`WIN[]`·`LAST`·`AXIS`) ·
  `deathCells` · `expandCells()` · 무고한 셋 **회전 배정** · `statementOf` 축 순회 ·
  `claimSummaryOf` 창 전체 · `slots` 방출 · **프롤로그 지시 대상** · **`topicParticle` 신설** ·
  `Palette.times.window`
- `engine/src/verifier.ts` — **§9-3f 신설**(쪼갠 창의 기계 이름표 · 경고)
- `engine/src/cli.ts` · `orchestrate.ts` — `--death-cells` · `RunOptions.deathCells`
- `engine/templates/PALETTE-BRIEF.md` — `times.window` · `times` 가 **가장 비싼 어휘 자리**
- `app/src/App.jsx` — `FLOOR_CLUES` 도출 · `AUTO` 삭제 · `CLAIMS` 도출 ·
  **브리핑을 사건 파일에서**(`bodyState`·`sceneState`·창 슬롯) · `_narrowSlots` ·
  `deathNarrowed()` 선언 기반 · **`narrowedLabel()` 신설**(두 자리 통합) · 빈 줄 안 그림
- `app/src/Generator.jsx` — **「사망 구간 칸 수」 손잡이**(1~3) · 요약 줄
- `scripts/bundle-single.mjs` — 바깥 `@import` **제거 + 보고** · 누수 검사를 **CSS 로 확장**
- `docs/MEMORY.md` · `docs/NEXT-ACTION.md` · `docs/SESSION-LOG.md` · `.omc/worklog/latest.md`
