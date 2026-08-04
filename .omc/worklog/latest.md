---
session_date: "2026-08-05 (git 확인)"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kkh94/OneDrive/Desktop/Nobody Lies"
machine: "KWONKYUNGHUN"
---

## Completed Work

**게이트 14단 → 15단 초록(exit 0) · 커밋 일곱 · 트리 깨끗.**

### ★★ 오늘의 줄기 — 「기계적으로 보인다」가 넷 중 넷 틀렸다 ★★

인계는 산장 무검사 공란 다섯을 *"기계적으로 보인다 → `belongingsOwner`"* 로 예단했다.
**서술문을 읽으니 넷이 소지품 소유자를 묻고 있지 않았다.**

```
1장 인물 yujin      「요리를 돕기로 한 · 일찍 도착한 사람」
1장 인물 yena       「함께 연기를 발견하고 방문을 연 사람」
2장 인물 wonyoung   「전화를 받았다고 진술한 사람」   ← e_wy_text 는 4장 물증이다
4장 인물 wonyoung   「가명의 실체를 캐묻기 시작한 사람」
```

**넷 다 소지품 고리가 1:1 이라 `answerOf` 가 우연히 맞는 답을 돌려준다** — 검사는
통과하고 솔버는 틀린 물음 위에서 증명한다. `roleOf` 가 08-04에 두 번 틀린 것과
같은 부류를 **손저작에서 세 번째로** 밟을 자리였다.

★ **그리고 같은 날 정반대 결론이 나왔다** — `practice-room` 인물 셋은 서베이가
`factSubject` 후보로 분류했는데 **정독하니 `belongingsOwner` 가 맞았다**(산문이
*"소지품에서 지워진 목록이 나온 [인물]"* 이라 물건을 말한다). **답만 봤으면 산장은
넣고 여기는 안 넣었을 것이다 — 둘 다 반대로.**

### ① A — 어휘 하나 + 거울 사실 (산문 무수정 · 사용자 결정)

`factSubject(factId)` 하나가 다섯을 덮는다. 물음은 다 다르지만 전부 「그 사실의
주어」로 환원된다. 사실이 없으면 **거울한다 — 파기 중단이지 새 정보 생성이 아니다.**

```
f_wy_call · f_yuri_secret     이미 있다 — 신설 0
f_yujin_early · f_yena_found  거울(무료 · f_no_* 와 같은 부류)
f_wy_trace                    거울(유료 · e_wy_text)
```

⛔ **A-2(산문 수정)는 사용자가 기각했다** — *"구조에 맞추려고 저작된 퍼즐의 의미를
고치는 것은 수리가 아니라 개작"*. 08-01의 식별 고리 전례도 이전 안 된다(생성 산문은
구조에서 방출되니 고리가 공짜지만 산장 산문은 저작된 목소리다).

★ **문안 경계 하나** — 서술문의 「뒤이어 도착한」은 거울하지 **않았다.** 지안이
*"딱 마침 유빈이도 도착해서"* 라고 **동시 도착**을 말한다(`e_mutual` 도 그쪽이다).
두 진술이 함께 말하는 것은 **발견과 개문**이라 그것만 담았다.

### ② B — 피해자 격자 (세계 변수가 아니라 상수 · 사용자 승인)

`lastSeenBy` 가 설 수 없던 이유는 어휘가 아니라 **데이터**였다 — 피해자는 `people`
밖이라 presence 행 자체가 없었다. `victim_presence` 를 신설했다.

**초안 의미론이 산장에서 계산이 안 섰다**: 「`murderCell` 직전 · 현장」이면 직전(t1)에
세라는 별채고 현장은 방이다. 문장이 말하는 목격은 **한 칸 더 앞(t0 · 본채)**이다.
「`murderCell` 이전 슬롯 중 마지막으로 피해자와 같은 칸」으로 고치고 실측:

```
lastSeenBy(진짜) = sakura · lastSeenLoc(진짜) = main   ✓ 저작된 답과 같다
```

★ **산문-격자 모순 의심은 정합으로 판명**됐다 — 세라의 t1=별채는 거짓말이 아니라
진술 그대로다. 술자리는 t0 구간이고 t1 은 그가 돌아간 칸이다.

⚠ **인계의 기대는 반증됐다** — `lastSeenBy` 는 `discriminated` 가 **안 된다.**
375개 세계에서 값이 `{sakura, null}` 이고 `solve()` 는 null 을 `seen` 에 안 넣어
`vacuous` 로 떨어진다. 무고 넷의 격자가 t3 한 칸뿐이라 그렇다.
→ **사용자 지시: 판정을 셋으로 가르는 것을 검토하라**(아래 Notes).

### ③ proof.ts — 산문만 읽던 모듈이 구조를 읽는다

R1·R3·R6·R7 은 전부 **서술문 문자열**을 뒤진다. 그래서 산장 다섯은 **구조적으로
증명 불가**였다 — 문장에 「파스」가 글자로 없으니 `report.includes` 가 영영 거짓이다.
**근거가 없어서가 아니라 읽을 채널이 없어서**였다.

```
R9  사실의 주어 · 진술   비용 0
R10 사실의 주어 · 조사   비용 = 그 사실을 여는 최소 조사비
R11 마지막 목격          진술 격자 + 선언된 사망 구간 (solver 와 다른 데이터 경로)
```

R9/R10 을 나눈 것은 `isDeclaredPremise` 가 **규칙 id 로** 전제를 가르기 때문이다.

### ④ `poolFor` 가 공란을 조용히 버리고 있었다 — **오늘 최고의 수확**

모르는 라벨은 빈 배열이고, 빈 배열이면 `proveBlanks` 가 그 공란을 **통째로 건너뛴다.**
산장 `협박대상` 이 그 상태였다 — §5-b 도 `proof-check` 도 **한 번도 그 공란을 세지
않았고**, 화면에서 「경고 없음」과 구별되지 않았다. **안 보는 검사는 없는 검사다.**
이제 **선언된 `asks` 가 답의 영역을 정한다**(라벨은 폴백). 폴백을 쓴 수를 인쇄한다 —
**조용한 폴백은 조용한 버림과 같은 병의 다른 증상이다**(사용자).

### ⑤ `solve-check` 배선 — 게이트 15단 · matrix 등록 · 죽은 `PL` 제거

`censor-check` 과 `matrix-check` 사이(SOLVER-SPEC §7 대로). `PL` 상수는 지웠고,
지우면서 *"prose-lock 이 게이트 한 단인데 행렬이 안 센다"* 를 다시 봤는데 **결함이
아니다** — 이 표가 세는 것은 **불변식 덮개**지 게이트 단수가 아니고 `prose-lock` 은
**잠금(회귀 감시)**이다. 린트 오류·경고 0 이 됐다.

⚠ **`matrix-check` 이 나를 잡았다** — 표식 문자열을 소스에 없는 것으로 적었더니
exit 1. 「행렬이 가리키는 검사가 실재함」이 실제로 문다.

⚠ **폴백 계수가 처음에 293 이었고 틀린 수였다** — `discovered` 공란은 후보가 확보
단어 목록으로 정해져 라벨도 `asks` 도 안 보는데 그것까지 라벨 폴백으로 셌다.
`poolSource` 를 셋으로 갈라(`asks`·`label`·`terms`) 다시 세니 **30**.
**세는 것이 틀리면 인쇄가 거짓말이 된다.**

### ⑥ `freeChapter` — 전제를 규칙이 아니라 사건이 진다 (제3안 · 사용자 승인)

R9/R11 을 `PREMISE` 에 넣는 안은 **기각**했다 — 자유 사실을 쓰고 공란이 가리키기만
하면 무엇이든 「정당하게 무료」가 되어 **누설 축이 죽는다.** 전제를 **사건이 지게** 했다.

```
① 장 단위 하나뿐          사실 단위 선언 금지 — 구멍이 선언의 모습으로 부활한다
② 경고를 끄지 않는다       문안만 「무료(설계 선언됨)」로 — 침묵과 선언이 구별돼야 한다
③ 비대칭이 값이다         선언 없는 장의 무료 공란은 **여전히 경고**
```

실측으로 확인했다 — 1장(선언) *"무료(설계 선언됨 · free_chapter)"* · 2장(미선언)
*"전제로 선언된 것이 아니면 누설이다"*.

### ⑦ `asks` 9 → 55/62 · 라벨 폴백 30 → 3

`closing-theater`·`pipe-organ-workshop` 은 **생성기를 거친 사건**이라 `generate.ts`
세 자리의 물음을 **복원**했다(추정이 아니다). 산문이 받쳐준다 — 1장 서술문이
*"소지품에서 개인적인 편지가 나온 것은 [인물]"* 이다. **그래서 ⓑ·ⓒ 중 여섯이
같이 닫혔다**(t1 = 사망 구간 칸 → `murderCell` · hall → `recordPlace`).

## In Progress

**없다. 모든 변경이 커밋됐고 게이트 15단이 초록이다.**

## Remaining Tasks

- [ ] 🎯 **다음 하나 — `Fact.value` + `asks: factValue` 를 짓는다 (사용자 승인)**
      **다섯이 한 어휘로 닫힌다**: 산장 4장 물품(마약) · 4장 정체(김선생) ·
      5장 동기(폭로 임박) · 5장 은닉처(별채 대포폰) · **2장 시각(t1)**.
      네 곳 한 벌(`types + schema + to-yaml + generate`) · 손저작만 손으로 채운다.
      ⛔ **`culpritAlias`·`culpritMotive`·`strandTerm`·`murderWeapon` 은 안 건드린다** —
      생성분은 물증이 1:1 이라 지금 구현이 맞다. 손저작만 카드 하나가 단어 셋을 준다.
      ```
      측정 결과 (③ 「기존 사실에서 읽는다」가 왜 그대로는 안 되나)
        f_sakura_is_alias  content "세라 = 가명의 주인"   ← 답 「김선생」이 문안에도 없다
        f_sakura_motive    content "분배금 다툼 + 폭로 임박" ← 산문에 묻혀 있다
        4장 물품 · 5장 은닉처                              ← 받칠 사실 자체가 없다
      Fact 필드: id·kind·subject·content·revealedBy·requires·availableAfter — 값 필드가 없다
      ```
      ★★ **문안 규칙 — `value` 는 답의 사본이 아니라 사실의 값이다** ★★ (사용자)
      **이것을 안 적으면 다음 세션이 「②(asks 에 term 을 적는다)랑 뭐가 다른가」에서
      한 바퀴 돈다.** 다르다:
      ```
      ② 기각    asks 가 답을 품는다        → answerOf 가 asks 를 읽어 돌려준다 = 항진명제
      factValue  Fact 가 값을 갖는다        → asks 는 그 사실을 **가리킬 뿐**이다
      ```
      `value` 는 **사실이라는 저작물의 속성**이다(「가명의 정체는 김선생이다」).
      그 사실에 `revealedBy` 로 **도달 가능한가**는 별도로 검증되고, **대조의 실질이
      그쪽으로 옮겨간다**(`proof`/`weakBlanks`). `belongingsOwner` 의 1:1 과 같은 자리다.
- [ ] **`practice-room` 시각 둘 — asks 붙이기가 아니라 결함 수리다 (사용자 판단)**
      ★ **오늘 처음으로 `asks` 작업이 사건 데이터의 오류를 잡았다.** 그렇게 기록한다.
      ```
      1장 서술문  "[t2], [piano]에서 피해자가 **발견됐다**"   답 t2
      슬롯        t0 정오 · t1 오후 · t2 네 시 반 이후(window) · t3 다섯 시(마지막)
      ```
      **답이 원문 주석(*"원문 사망추정시각 4시반~5시"* = t2)을 따라가다 문장과 어긋난
      것으로 예단한다.** 발견은 **t3** 일 개연성이 높다. `discoveryTime` 은 t3 를
      돌려주므로 **지금 답으로는 틀린다.**
      ⛔ **지금 추론으로 확정하지 않는다 — 이식 출처(원문·초안 YAML)와 대조해서 정한다.**
      갈래는 둘뿐:
      ```
      ⓐ 문장이 정본 → 답을 t3 로 고치고 discoveryTime
      ⓑ 원문이 정본 → 서술문이 사망 시각을 물어야 했던 것 = **이식 오류**
      ```
- [ ] **`practice-room` 2장 장소 `cvs` — 어휘 신설 보류. 순서만 지킨다 (사용자)**
      *"한 사람은 [cvs]로 향했고 왕복 사십 분이 걸린다"* — 알리바이 행선지.
      **「알리바이 행선지」 하나 때문에 어휘를 늘리는 것이 어휘가 사건마다 자라는 길의
      입구다.** `lastSeenLoc` 을 지을 때처럼 순서대로 잰다:
      ```
      ① 격자에서 도출되나  그 인물의 t_k 칸이 곧 답인가 → 그렇다면 personAt(person, slot)
                          같은 **격자 읽기 어휘**로 lastSeen 계열과 묶인다
      ② 산문에만 있나      → factValue 로 덮이는지 본다
      ③ 둘 다 아니면       그때 신설
      ```
- [ ] **`pointsAt` 방어 검사** — 손저작이 `pointsAt: hall` 을 적고 record 에는 별채를
      가리키는 문장을 쓰면 **솔버가 틀린 사실 위에서 증명한다.** 검열관 ⓐ(인용 실재)와
      같은 모양이라 싸다. ★ **`recordPlace` 를 손저작에 처음 적는 일과 같은 배치가
      자연스럽다**(사용자) — 값을 처음 손으로 적는 순간 방어가 같이 서야 한다.
- [ ] 🔴 **테스터 피드백 0건** (사용자 결정으로 접어둠) · **용의자 프로필 채널 43/44 빔**
- [ ] **⑤검열관을 실제로 한 번 돌린다** — 배선은 살아 있고(`censor-check`) **흠을 잡나**는
      아직 안 돌렸다. `closing-theater` 가 프롤로그 불일치를 일부러 남긴 사건이다.
- [ ] 동선 모양 경고 둘 · `prose-lock` 「아침의 정황」 · 여덟째 아키타입 · `es-hangul`
- [ ] 별건 둘 — DS 번들 `createRoot` 충돌 · 사이드바 밖 클릭 요소 137곳

## Blockers / Issues

- ⚠️ **막힌 것 없음.** 08-04의 블로커 셋이 전부 닫혔다:
  `solve-check` 미배선(→ 15단) · 죽은 `PL` 상수(→ 제거) · 무검사 공란 7(→ 0).
- ⚠️ **산장 §5-b 경고 다섯은 결함이 아니다** — 찍기(guess)는 **0**이고 전부 무료(free)다.
  1장 둘은 `free_chapter` 로 **선언됐고**(문안이 다르다), 2장 셋은 미선언이라 경고로 남는다.
  **2장을 선언할지는 저작 판단이라 안 했다** — 정황은 있다(1·2장 `requires_facts` 가
  전부 `revealed_by: []` 이고 **3장부터 유료**다). `MEMORY §이식 규칙 6`.
- ⚠️ **날짜 라벨** — 이번 세션은 git 과 라벨이 같다(**2026-08-05**).
- ⚠️ **대시보드 Override 를 다시 켜지 마라** — `vercel.json` 이 정본이다.

## Notes for Next Session

- ★★ **「짓기 전에 잰다」가 오늘도 값을 했다** ★★ 53개에 `asks` 를 바로 붙이는 대신
  **먼저 서베이를 돌려** 세 갈래로 갈랐고, 그 덕에 **결정을 안 기다려도 되는 38을 먼저**
  넣어 폴백을 30 → 3 으로 떨어뜨렸다. 막힌 7만 남겨 표로 올렸다.
- ★ **`solve()` 의 판정을 셋으로 가르는 것을 검토하라** (사용자 제안 · 지금 당장은 아님)
  ```
  전 세계 동일        vacuous
  값 갈림             discriminated
  값 하나 + null 다수  semi-discriminated  ← 물음의 성립 자체가 세계를 가른다
  ```
  `lastSeenBy` 가 그 상태다. null 인 374개 세계는 **「이 물음에 답이 없는 세계」**고,
  플레이어가 *"마지막 목격자가 존재한다"* 를 아는 순간(2장 서술문이 전제한다) **그
  세계들은 죽는다.** 지금은 `vacuous` 로 뭉뚱그려 **§6 다섯째 줄이 proof 관할로 넘기는데
  실은 솔버가 절반을 변별하고 있다.** 분류표가 또 한 번 거칠게 세어진 자리일 수 있다.
- ★ **오늘 검사가 나를 두 번 잡았다** — `matrix-check`(없는 표식) · 내 폴백 계수(293).
  **둘 다 게이트와 인쇄가 없었으면 조용히 지나갔다.**
- ⛔ **`generateCase` 에서 throw 하지 마라** — 브라우저가 부른다. `solver.ts` 도 같은 규약.
- ⛔ **새 필드는 `types + generate + to-yaml + schema` 네 곳이 한 벌이다** (08-04 교훈).
  오늘 `victimPresence`·`freeChapter` 둘 다 그 규약으로 넣어 `prop-check` 왕복을 통과했다.

## Files Modified

```
engine/cases/mountain-lodge.yaml       거울 사실 셋 · victim_presence · free_chapter · asks 15
engine/cases/closing-theater.yaml      asks 16 (생성기 유래 복원)
engine/cases/pipe-organ-workshop.yaml  asks 16 (생성기 유래 복원)
engine/cases/practice-room.yaml        asks 8
engine/src/types.ts       Asks 셋(factSubject·lastSeenBy·lastSeenLoc) · victimPresence · freeChapter
engine/src/solver.ts      answerOf 셋 · lastSighting
engine/src/proof.ts       R9·R10·R11 · poolFor(asks 우선) · poolSource
engine/src/clues.ts       Weakness.kind 에 freeDeclared
engine/src/verifier.ts    weaknessWarning 세 갈래
engine/src/schema.ts · to-yaml.ts   victim_presence · free_chapter 왕복
engine/src/solve-check.ts 라벨 폴백 인쇄
engine/src/matrix.ts      SC 표식 등록 · 죽은 PL 제거
package.json · engine/package.json   solve-check 배선 (게이트 15단)
docs/MEMORY.md · NEXT-ACTION.md · SESSION-LOG.md · .claude/commands/{before,after}-work.md
.omc/worklog/latest.md    이 파일
```
