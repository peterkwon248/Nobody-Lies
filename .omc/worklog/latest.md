---
session_date: "2026-07-29"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kkh94/OneDrive/Desktop/Nobody Lies"
machine: "KWONKYUNGHUN (OneDrive 아래) · 밤 세션"
---

## Completed Work

**작업 트리 깨끗 · 빌드 게이트 7단 초록(exit 0) · 콘솔 에러는 DS 번들 것 하나뿐.**

> ⚠️ **이 워크로그가 두 세션 낡아 있었다.** 07-29 `DESKTOP-JCJTAH8` 세션 둘이
> `docs/` 만 커밋하고 이 파일을 안 건드렸다(`3551d0f` 실측 — `.omc/` 파일 0개,
> gitignore 아님). 그래서 **여기 적힌 「다음 하나」가 이미 닫힌 일**을 가리키고
> 있었다. `after-work.md:27` 이 갱신 대상으로 명시한 파일이다.

### 이번 세션 — 사건이 기계 밖으로 나갔다 · 그리고 첫 실플레이

```
✅ ① 산문을 스키마로
🔨 ② 산문가        ★ 왕복이 처음으로 끝까지 돌았다 (진술5+지문+프롤로그+장서사)
⬜ ③ 검열관        규칙 쪽 §9-3e 추가. LLM 쪽은 여전히 없다
✅ ④ 작가          + 내보내기 · 설비 이름 8/8 · 관계도 노드
```

### 1 — 순서가 틀려 있었다 (사용자가 잡았다)

「산문 왕복」이 1번이었는데 **그 산출물을 꺼낼 길이 없었다.** `app/src/*.jsx` 에
`Blob`·`download` 가 0건, 생성 사건은 `localStorage` 에만, 기계는 넷.

**문서가 두 곳에서 이미 경고했는데**(`NEXT-ACTION` §① 주의 · 표 4번 ⓑ)
**순서에는 반영하지 않았다.** — 「이미 있는데 배선만 없다」의 거울상인
**「이미 적었는데 순서에 없다」**.

### 2 — 내보내기 (⓪ · 닫힘)

사건 행의 **「YAML」**. 엔진과 **같은 코드·같은 옵션**이고 **왕복 대조에 실패하면
안 내려받는다**(엔진이 `exit 1` 로 막는 자리).

- 그러려고 **`schema.ts` 에서 `node:fs` 를 뺐다** → `load-case.ts` 신설.
  `loadCaseFile` 하나 때문에 파싱기 전체가 브라우저에 못 들어갔다
- `vite.config.ts` 의 *"schema.ts 는 번들에 안 들어온다"* 주석도 같이 고쳤다
- ★ **왕복 대조가 넣자마자 결함을 물었다** — `applyProse` 가 지문·프롤로그는
  `{ko}` 로 정규화하면서 **문단만 받은 그대로** 넣고 있었다. `txt()` 가 맨
  문자열에서 `.ko` 를 찾아 **내보낸 YAML 의 문단이 전부 빌 뻔했다**

### 3 — 설비 이름 (① · 닫힘) · 그리고 절대 규칙 위반 하나

`Palette.places` 가 `rooms` 와 **같은 규약**(`string | {name, fixture}`)을 받는다.

**★ 재다가 절대 규칙 위반을 밟았다 ★** 트릭이 만든 고정물 조사는 언제나 물건
이름(`잠금장치 조사`)인데 빈손은 전부 `○○ 설비 확인` 이었다 — **모양이 갈리는
쪽이 정확히 쓸모 있는 쪽.** 44건 중 44건. **골든 케이스가 답을 갖고 있었다**
(`화로 조사`·`원고 조사` — 방이 아니라 물건). 물건 이름으로 통일했다.

**검증기 §9-3e 신설.** ⚠ 오류로 걸었더니 설비 이름 없는 팔레트가 **통과율 0%**
가 됐는데 **서식은 그 칸을 「선택」이라 적어뒀다** → 경고로 내렸다.

### 4 — 첫 실플레이에서 다섯이 나왔다 (게이트는 내내 초록)

| | 무엇 | 상태 |
|---|---|---|
| ① | **관계도에 산장의 「윤다인」** | ✅ 고침 |
| ② | 진술 행의 **빈 알약**(`relKo` 칩) | ⬜ 남음 |
| ③ | 용의자 카드의 **빈 「본인 주장」** + 꼬리 점 | ⬜ 남음 |
| ④ | 진술의 **「~다은」** 조사 | ✅ 고침 |
| ⑤ | 서식을 답변 칸에 되붙이면 파서 말만 나옴 | ✅ 고침 |

**①의 뿌리가 둘이었다** — 생성기가 `relationGraph` 를 안 만들고, `applyCase` 의
`join()` 은 **꾸미는** 도구뿐이라 개수·짝이 어긋나면 **산장 표를 통째로 남긴다**
(인물 id 가 `p1..p5` ↔ `yena…` 라 언제나 어긋난다). `_foreignCase` 로 갈라
**다시 만든다.** 산장은 한 글자도 안 바뀐다(실측).

**④⑤ 둘 다 사용자 팔레트/사용자 조작에서 나왔다** — 내장 팔레트만으로 재면
기본값이 우연히 옳아서 안 보인다.

### 5 — 배포(⑤) · 업계 은어(⑥)

- **「`dependencies` 로 옮기거나」는 거짓이었다** — `buildCommand` 가 7단 게이트
  전체라 `tsx`·`typescript`·`vite` 까지 필요한데 넷 다 devDeps. `js-yaml` 만
  옮기면 **다음 줄에서 `tsx` 로 죽는다.** → `installCommand: npm install --include=dev`
- 「저녁 **합평**」 → 「저녁 모임」 · 서식에 **「어디에 두라」** 규칙(은어 금지가 아니라)

### 검증한 것

| | |
|---|---|
| 내보내기 | 조립본·산문본 둘 다 성공 · **고치기 전 모양 재현 → 왕복 실패 → 안 내려받음** |
| 붙여넣기 | 서식 되붙임 → 막힘 · `` ```yaml `` 울타리 → 들어감 · 뼈대 `...` → 막힘 |
| 설비 이름 | 네 세계 × 12건 = **48건 · 384개 · 총칭 0 · 겹침 0 · 모양갈림 0**(전 44/44) |
| 조사 오류 | 사용자 비밀 5개로 재돌림 — **「다은」 0** |
| 관계도 | 생성: 이름 6/6 정상 · 「윤다인」 0 · 산장: 노드 7 · 간선 3 · **불변** |
| 엔진 | `--emit --yaml` 왕복 통과 (schema 분리 후에도) |

## In Progress

없음.

## Remaining Tasks

- [ ] **🎯 진술 행의 빈 알약 · 용의자 카드의 빈 「본인 주장」 (다음 하나)**
      `relKo` 는 **의도적으로 비운다**(안 비우면 생성 인물에 「산장 거주」가 붙는다 —
      그 판단은 옳다). 그런데 **칩을 안 그리게는 안 했다.** `claimSummary` 는
      생성기가 아예 안 낸다. ⚠ 마크업이 `{{ age }} · {{ job }} · {{ rel }}` 로
      **구분자를 글자로 박아둬서** 분기를 더해야 하고, `port-check` 의 `APP_ONLY`
      선언이 붙는다
- [ ] **진술 두께 — 산문 왕복** (사용자 손). 왕복은 돌았으나 **두께를 아직 안 쟀다** —
      산장 279자 대 조립 107자였던 그 숫자. 사용자가 만든 사건이 브라우저에 있다
- [ ] **시간대 구조** — 손잡이는 「슬롯 수」가 아니라 **「사망 구간 칸 수」**(1~3, 기본 1).
      분석은 `NEXT-ACTION` §🟡 에 있다. 비용: 엔진 26군데(그중 TRICKS 10) · 앱 11 · 검증기 2
- [ ] 관계도의 **선** — A(노드만, 지금) / B(마지막 장에 「가명→범인」). 사용자 결정
- [ ] `app` 이 `js-yaml` 을 import 하면서 선언은 안 한다 (`Generator.jsx:2`).
      lock 을 건드려야 해서 미뤘다
- [ ] 인터루드 도착물 화면 4종 · `e_safes`·`a_ph_yuri` 의 `clues` · 색·대비·질감

## Blockers / Issues

- ⚠️ **커밋 없이 `git stash` 를 쓰지 않는다.** 콘솔 에러를 대조하려다 **16파일을
  통째로 걷어냈다.** `stash pop` 으로 되돌리고 게이트로 확인했다. 대조는
  `git diff --name-only | xargs grep -l` 로도 됐다(실제로 그것으로 답이 나왔다)
- ⚠️ **게이트가 JSX 를 안 본다.** 이번 세션에 사용자가 눌러서 찾은 것이 **다섯**이고
  그동안 7단은 내내 초록이었다
- ⚠️ **내장 팔레트만으로 재면 못 잡는 결함이 있다.** 「~다은」도 설비 이름 모양
  갈림도 **사용자 팔레트**에서 나왔다
- ⚠️ **PowerShell 이 standalone `--` 를 삼킨다.** 엔진 CLI 는 Bash 로 돌린다
- ⚠️ **`read_page` 가 0x0 을 준다.** `javascript_tool` 로 DOM·localStorage·React
  fiber 를 직접 읽는다 — 이번에도 그것으로 전부 확인했다
- ⚠️ 콘솔의 `createRoot` 중복 경고는 **DS 번들 것**이다. `main.jsx:77` 이 방어하는
  그 자리이고 **산장에서도 똑같이 뜬다** — 생성 사건과 무관
- ⚠️ **`localStorage.clear()` 금지.** 이번 검증도 `gen-` 접두만 골라 지웠다

## Notes for Next Session

- **`before-work` 순서 그대로.** `git pull` 이 맨 앞
- **게이트는 7단이다** — `package.json` 의 `build` 를 믿는다
- **사용자가 만든 사건이 사용자 브라우저에 산다** — 산문을 입힌 것이 있으면
  행의 **「YAML」**로 꺼내 `engine/cases/` 에 커밋하라고 알린다. 그게 사건 2번이 된다
- **⑤ 배포는 「고쳤다」이지 「나갔다」가 아니다** — push 후 Vercel 이 실제로 도는지
  확인해야 닫힌다
- 이 저장소는 **직접 main 푸시**

## Files Modified

- `engine/src/load-case.ts` — **신설.** `loadCaseFile`(node:fs)을 `schema.ts` 에서 분리
- `engine/src/schema.ts` — `node:fs`·`js-yaml` 제거 → **브라우저에서 돈다**
- `engine/src/cli.ts` · `export-case.ts` — import 경로
- `engine/src/generate.ts` — `PlaceSpec` · `placeFixture` · 고정물 조사 이름 ·
  `secretPhrase`(조사) · **`relationGraph` 신설** · `DEFAULT_PALETTE` 설비 이름
- `engine/src/verifier.ts` — **§9-3e 신설**(경고)
- `engine/templates/PALETTE-BRIEF.md` — `places.fixture` · 겹침 금지 · **업계 은어** 절
- `engine/templates/palette-{residency,museum,example}.json` — `places` 설비 이름 · 합평
- `app/src/Generator.jsx` — **「YAML」 내보내기** · 왕복 대조 · 서식 되붙임 가드 ·
  울타리 벗기기 · 문단 `{ko}` 정규화
- `app/src/App.jsx` — **`_foreignCase` 면 관계 도식을 다시 만든다**
- `app/vite.config.ts` — 낡은 주석 정정
- `vercel.json` — `installCommand: npm install --include=dev`
- `docs/MEMORY.md` · `docs/NEXT-ACTION.md` · `docs/SESSION-LOG.md`
