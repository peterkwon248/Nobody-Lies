# 사건 설계 의뢰 서식 (Claude 웹에 붙여 넣는 것)

> **이것은 2단계 중 1단계다.** 여기서 **논리 골격**을 받고, 검증기를 통과하면
> `PROSE-BRIEF.md` 로 **산문**을 받는다. 두 서식은 짝이다.
>
> ```
> ④ 사건 설계자 (이 파일)   논리 골격 YAML  →  npm run build  ←── 관문
> ② 산문가 (PROSE-BRIEF)   통과한 YAML 에 문장만 입힌다  →  npm run build
> ```
>
> **왜 나누나.** 한 번에 시키면 **산문을 쓰는 도중 앞서 정한 시각·물증을 바꾼다.**
> 2026-07-28에 실측했다 — 통째로 시킨 결과물에서 범인만 진술이 짧아졌고(10문단,
> 무고한 넷은 전부 12), 장의 공란이 존재하지 않는 단어를 가리켰다. 논리를 먼저
> **얼리고** 검증기로 잠근 뒤에 문장을 얹어야 그 부류가 사라진다.

## 쓰는 법

```
1. 아래 「⬇ 여기서부터 복사」 이후를 통째로 복사
2. §0 생성 조건을 채움
3. §5 자리에 engine/templates/case-template.yaml 을 통째로 붙여넣음
4. Claude(웹)에 붙여 넣음 → YAML 수령
5. engine/cases/<사건>.yaml 로 저장 → npm run build
6. 반려되면 오류 문구를 그대로 다시 붙여 넣음
7. 통과하면 → PROSE-BRIEF.md 로 산문 의뢰
```

> ⚠️ **§4 고정 어휘와 §7 합격 기준은 코드보다 낡는다.** `types.ts` 의 어휘를
> 늘리거나 `verifier.ts` 에 검사를 더하면 **같은 커밋에서 이 파일도 고친다.**
> 명세가 뒤처지면 설계자가 통과할 수 없는 것을 만들어 온다 — 2026-07-28에
> `PROSE-BRIEF.md` 에서 실제로 발화한 결함이다.

## §6 의 이음매는 실측으로 정했다 (2026-07-29)

「어디까지 비워도 통과하는가」를 **문장으로 정하지 않고 돌려서** 정했다.
`case-template.yaml` 에서 산문을 걷어내고 검증기에 물린 결과다.

| 걷어낸 것 | 결과 |
|---|---|
| 산문 **전부** (`result` 포함) | ❌ **실패** — 「물증을 주는데 결과문이 없다」 ×9 (§9-8e) |
| 산문 전부, **단 `result`·`report` 는 남김** | ✅ **통과** · 난이도 `normal` · 오라클 3 · 기대 5 |

**그래서 `actions[].result` 는 ②가 아니라 ④의 일이다.** 07-28에 넣은 9-8e 가
바로 그 자리를 막는다 — 그리고 그게 맞다. 결과문 없는 조사는 예산만 먹는다.

> 이 이음매를 옮기고 싶으면 방법은 하나다 — `prose.stage` 같은 표식을 신설해
> **논리 단계에서는 산문 검사를 보류**하게 만드는 것. 스키마·검증기 양쪽을
> 건드리는 일이라 지금은 하지 않았다.

---

⬇ 여기서부터 복사

당신은 추리 게임 「노바디 라이즈」의 **사건 설계자**입니다. 사건 하나의 **논리
골격**을 설계해 YAML로 출력하세요.

**이번 단계에서 산문은 쓰지 않습니다.** 진술 원문·조사 결과문·프롤로그·장 서사는
다음 단계에서 다른 의뢰로 받습니다. 지금 문장을 쓰면 논리가 문장에 끌려갑니다.

## 0. 생성 조건

```yaml
scale: {{ daily | campaign }}
setting: {{ 무대 — 예: 심야 라디오 방송국 }}
tone: {{ 현실적 | 고전 추리 | 폐쇄 공간 | 심리극 }}
suspectCount: {{ daily 3 · campaign 5 }}
hiddenCrime: {{ 숨은 범죄 — 비우면 설계자가 정한다 }}
additionalRequests:
  - {{ 원하는 소재 · 금지 소재 }}
```

비어 있으면 기본값:

```yaml
scale: daily
setting: 현대의 제한된 실내 공간
tone: 현실적인 미스터리
suspectCount: 3
```

| `scale` | 장 | 공란 | 예산 | 소요 |
|---|---|---|---|---|
| `daily` | 2 | 6~7 | 3~6 | 10~15분 |
| `campaign` | 5 | 16~19 | 5~6 | 40~60분 |

> `campaign` 은 어렵습니다. 검증 실패율이 높고 서사가 무너지기 쉽습니다.
> **처음 돌릴 때는 `daily` 로 하십시오.**

## 1. 이 게임의 구조 — 이것부터 이해하세요

제목이 곧 규칙입니다 — **무고한 사람은 거짓말하지 않는다. 다만 자기 비밀은
말하지 않는다.** 그리고 제목 자체가 거짓입니다. 한 명은 거짓말을 합니다.

이것이 데이터에서 어떻게 표현되는지가 **이 스키마의 핵심**입니다:

```yaml
people:
  - id: p1
    presence:                      # 실제 동선 (진실)
      - { slot: t1, at: room }
    claim:                         # 진술에서 주장하는 동선
      - { slot: t1, at: hall }     # ← 이 사건의 유일한 거짓말
```

**`claim` 을 적지 않으면 `presence` 와 같습니다.** 즉 「무고한 사람은 거짓말하지
않는다」가 규약이 아니라 **기본값**입니다. **무고한 사람에게는 `claim` 을 절대
적지 마세요** — `presence` 를 복사해 넣는 것도 안 됩니다. 검증기가 「주장이 실제와
완전히 일치하는 범인」을 그 부재로 판별합니다.

**무고한 사람의 비밀은 `claim` 이 아니라 `facts[kind: context]` 로 표현합니다.**
말하지 않을 뿐 거짓을 말하지는 않기 때문입니다.

### 판별자는 동기가 아니라 기회입니다

동기는 여러 명이 가집니다 — 그게 레드 헤링입니다.
**기회는 범인만 가져야 합니다.** 나머지는 거리(`at_lodge: false`)나 시각으로
배제합니다. 유죄 = `motive ∧ opportunity ∧ means` 이고, 검증기가 **성립하는
인물이 정확히 한 명인지** 셉니다.

## 2. 설계 순서 — 거꾸로 하면 반드시 다시 씁니다

```
숨은 범죄  →  동기가 여기서 나온다
트릭      →  물증을 결정한다
인물 배치  →  ★ 기회가 여기서 결정된다. 가장 중요
물증      →  거짓말의 반박 근거
사실      →  검증기의 원자 단위
조사      →  탐색 공간
보고서     →  공란 = 진실 세계의 필드
```

## 3. 스케치 통과 조건 넷 — 하나라도 비면 YAML을 쓰지 마세요

1. **동기가 숨은 범죄에서 나오는가.** 치정·원한만으로 만들면 용의자가 전부
   밋밋해집니다.
2. **용의자 전원이 숨은 범죄에 연루되는가.** 주범 1 · 협박당한 자 1 · 추적자
   1~3. 각자 감출 것이 있어야 전원이 수상해 보입니다.
3. **트릭에 허점이 있는가.** 「자살할 사람이 왜 손님을 불렀나」 같은 것.
   없으면 파고들 지점이 없습니다.
4. **범인이 가장 안 수상해 보이는가.** 동기가 제일 선명한 사람이 범인이면
   5분 만에 끝납니다. `salience` 에서도 이것을 지킵니다 — **범인의 조사는 낮게,
   레드 헤링은 높게.**

## 4. 고정 어휘 — 여기 없는 값은 검증기가 즉시 거부합니다

```
scale              daily | campaign
incident.kind      homicide | theft | leak | forgery | disappearance | sabotage | audit
prose.source       authored | template | llm
hidden_role        ringleader | accomplice | coerced | investigator | unaware
facts[].kind       identity | opportunity | no_opportunity | motive | means | contradiction | context
actions[].yield    solution | redherring | exclusion | empty
actions[].verb     belongings | search | phone | alibi | autopsy | fixture      (게임이 주는 조사 갈래. 사건이 바뀌어도 이 여섯)
clues[].slot       motive | means | opportunity
trick.types        staged_suicide | locked_room | alibi_fabrication | body_moved | delayed_mechanism
                   ⛔ identity_swap 은 아직 쓸 수 없습니다
illusions[].kind   death | time | place | absence | identity
blanks[].label     인물 · 장소 · 시각 · 도구 · 동기 · 정체 · 은폐수단 · 위장물
                   마지막목격자 · 접촉수단 · 은닉처 · 사인 · 물품 · 협박대상
                   ⛔ 「공범」은 폐기됐습니다 — 라벨의 존재만으로 「한 명 더 있다」가 조사 0회에 풀립니다
blanks[].candidates  closed | discovered
blanks[].particle    이/가 | 을/를 | 은/는 | 과/와 | (으)로
reveals[].yield    path | narrow | decoy | flavor
reveals[].surface  statement | map | graph | suspect | overview
add_claims[].target  statement | grid          (grid 는 slot 이 필수)
```

### 트릭은 이름표가 아니라 계약입니다

아키타입마다 요구하는 부품이 다르고 **검증기가 강제합니다.**

| 아키타입 | 주장 | 필수 부품 |
|---|---|---|
| `staged_suicide` | 스스로 목숨을 끊었다 | `exit` · `death` 인상 |
| `locked_room` | 아무도 드나들 수 없었다 | `exit` |
| `alibi_fabrication` | 그 시각 그 자리에 없었다 | `time` 또는 `absence` 인상 |
| `body_moved` | 발견된 곳에서 죽었다 | `place` 인상 |
| `delayed_mechanism` | 범인이 있을 때 벌어졌다 | `time` 인상 |

`types` 에 여럿 적으면 계약이 **전부** 적용됩니다. 실제 추리물의 트릭은 대개 조합입니다.

### ⛔ 이 스키마에 **없는** 필드 — 지어내면 적재 단계에서 죽습니다

자주 발명되는 것들입니다. 오른쪽이 실제 자리입니다.

| 지어낸 것 | 실제 |
|---|---|
| `people[].role: culprit` | 최상위 `culprit: <id>` **하나뿐** |
| `people[].lies` · `people[].facts` | `claim` (범인만) · 최상위 `facts[]` |
| `people[].hiddenFacts` | `facts[{ kind: context }]` |
| `solution:` 블록 | 없습니다. 답은 `culprit` + `chapters[].blanks[].answer` |
| `locations[].seedFacts` | 최상위 `seed_terms: [단어]` — **사건 전체에 하나** |
| `slots: { culprit: ..., means: ... }` | **`slots` 는 시간 축입니다** (`t0`·`t1`·`t2`). 유죄 칸이 아닙니다 |
| `budget` 누락 | **필수입니다.** 예산이 없으면 난이도가 없습니다 |

필수 최상위: `id` · `title` · `scale` · `budget` · `victim` · `culprit` ·
`incident.kind` · `slots` · `locations`.
`victim` 은 **`people` 에 넣지 않습니다** — `people` 은 용의자 목록이고, 넣으면
피해자의 유죄를 계산하게 됩니다. **실존 인물명을 쓰지 마세요.**

## 5. 통과하는 최소 사건 — 이것을 개작하세요

아래는 **그대로 검증을 통과하는 사건**입니다. 빈 양식이 아닙니다.
**백지에서 쓰지 말고 이것을 고쳐 쓰세요** — 빈 양식을 채우면 오류를 한꺼번에
200개 만나고, 통과하는 상태에서 한 항목씩 바꾸면 그런 일이 없습니다.
주석은 규칙이니 읽고, 출력에서는 지우세요.

```yaml
{{ 여기에 engine/templates/case-template.yaml 을 통째로 붙여넣기 }}
```

## 6. 이번 단계에서 채우는 것 / 비우는 것

**채웁니다 (논리)**

```
id · title · scale · budget · incident · prose{source: llm} · seed_terms
slots · locations · people{presence, claim, hidden_role, statement.voice}
victim · culprit · trick{types, props, staging, illusions, exit, flaw}
evidence{id, description, found_at, yields_terms}
facts · actions{id, label, cost, gives, salience, yield, verb, target}
chapters{order, title, requires_facts, blanks, report, epilogue_order}
reveals{trigger, yield, surface, facts, actions, add_claims, narrows_window}
reopen_per_chapter
```

**비웁니다 (다음 단계)** — 항목 자체를 넣지 마세요. 빈 문자열도 안 됩니다.

```
people[].statement.paragraphs      진술 원문
people[].statement.gesture         지문
actions[].clues                    프로필 카드 한 줄
evidence[].record · extra          물증 카드 기록
terms                              확보 단어 사전 (word 는 blanks 의 answer 로만 존재)
reveals[].narration                장 서사
chapters[].opening · epilogue      장 열림·결말 조각
prologue                           프롤로그
```

> **비우는 것이 안전한 이유**: 이 항목들은 전부 **「전부 쓰거나 전부 비우거나」**
> 규칙이 걸려 있고, 검증기는 **전무**를 통과시킵니다. 일부만 채우면 그 유무가
> 곧 유용도 신호가 되어 오류입니다.

### 예외 둘 — 이 둘은 산문이지만 **지금** 씁니다

**하나. `actions[].result` — `gives` 가 있는 조사는 전부 필수입니다.**
검증기 §9-8e 가 *「물증을 주는데 결과문이 없다 — 플레이어는 예산을 쓰고 공통
「아무것도 없음」을 본다」* 로 **오류**를 냅니다. 비워두면 빌드가 멈춥니다(실측).

결과문은 **그 조사가 실제로 주는 것만** 말합니다. 그리고 **같은 온도로 씁니다** —
`yield: solution` 인 조사와 `yield: redherring` 인 조사의 결과문이 길이도 어조도
같아야 합니다. **결정적 단서를 길게 쓰면 그게 정답 누설입니다.** 다 쓴 뒤 길이를
세어보고, 한쪽이 길면 고치세요.

```yaml
result:
  title: 이름 하나가 반복된다
  body: 여러 장에 같은 이름이 적혀 있었다.
```

판정하지 마세요 — 「따라서」·「수상한」·「결정적인」 금지. 결론이 박힌 명사도
금지입니다(`위조`·`가명`·`밀폐`·`위장`). **「필체가 원고와 달랐다」는 되고
「위조된 유서」는 안 됩니다.**

**둘. `report` — 공란이 문장 안에 박혀야 합니다.**
검증기가 **공란 ↔ 참조 1:1** 을 강제하므로 `report` 없이는 `blanks` 를 검증할 수
없습니다. 연결어만 쓰고 사건을 서술하지 마세요.

```yaml
report:
  - "그날 아침 "
  - { blank: 0 }
  - " 가장 먼저 도착했다. "
  - { blank: 2 }
  - "에서 "
  - { blank: 3 }
  - " 발견됐다."
```

> ⚠️ `였다`·`이었다` 처럼 **받침에 따라 갈리는 어미**를 텍스트 조각에 쓰지 마세요.
> 조사(`particle`)만 자동 처리됩니다.

**평면도(`floor_plan`)와 관계도(`relation_graph`)는 만들지 마세요.** 좌표 기하이고
별도 단계입니다.

**대신 `actions[].target` 은 조사마다 반드시 붙이세요.** 없으면 *「조사를 지목할 수
없다 — 화면에 걸리지 않는다」* 경고가 조사 수만큼 뜨고, **경보가 소음이 되어 진짜
경고가 묻힙니다.** 도면을 만들지 않으므로 `kind` 는 `location` 또는 `person` 만
쓰고 **`fixture` 는 쓰지 마세요** — 가리킬 곳이 없습니다.

```yaml
- { id: a_room, label: 방 수색, cost: 1, gives: [e_tool], salience: 0.5,
    yield: solution, verb: search, target: { kind: location, id: room } }
```

장소가 없는 조사(알리바이 대조 같은 것)는 `target` 대신 `pair: [p2, p3]` 로
두 인물을 지정합니다.

## 7. 합격 기준 — 검증기가 실제로 무는 것

**오류 (하나라도 있으면 빌드가 멈춥니다)**

```
· 유죄가 성립하는 인물이 0명 또는 2명 이상          ← 정답이 유일해야 한다
· 검증 결과 범인이 culprit 설정과 다르다
· 트릭에 허점이 없다 / 허점이 심긴 자리가 실재하지 않는다
· 인상(illusion)이 하나도 없다
· 인상을 깨는 물증이 없다 / 그 물증을 얻을 조사가 없다   ← 영영 빠져나올 수 없다
· 아키타입이 요구하는 부품이 없다 (exit · 특정 kind 인상)
· 핵심 사실의 획득 경로가 1개                        ← 최소 2개
· 조사 없이 확정할 수 있는 장이 없다                   ← 시작하자마자 막힌다
· is_accusation 공란을 가진 장이 0개 또는 2개 이상      ← 정확히 1개
· 지목 공란의 답이 culprit 와 다르다
· 조사 없이 확정 가능한 장이 범인을 지목한다            ← 찍기가 가능하다
· decoy 공개가 fact 를 준다                          ← 함정이 아니라 필수가 된다
· yield: empty 인데 물증을 준다
· 확보 단어에 설명이 있는데 주는 물증이 없다
· 필수 조사 비용 > 예산                              ← 클리어 불가
· 공란이 서술문에 없다 / 두 번 나온다
· 장 열림 문구·서사·서술문이 일부 장에만 있다           ← 유무가 신호가 된다
· 무고한 사람이 사망 시간대에 현장에 있다               ← 기회가 생겨 유일성이 무너진다
· 물증을 주는데 결과문이 없다                          (9-8e)
· 지문이 일부 인물에게만 있다                          (9-1)
· 현장 서술·프롤로그가 씨앗 밖 단어를 말한다             (9-2 · 9-7)
· 슬롯·장소·물증·사실·조사 id 참조가 깨져 있다
```

**경고 (멈추지는 않지만 읽어야 합니다)**

```
· 매력적인 함정(redherring 조사)이 3개 미만
· 장의 후보가 전부 closed — 조사 없이 시도할 수 있다
· 아무도 쓰지 않는 물증                                (9-8f)
· 부문(물증·정황·심증) 중 공란이 0인 것이 있다
· 사망 시간대(window: true) 슬롯이 없다
· 기대 회차 + 여유 > 예산                              ← 좌절 위험
```

**통과 후 보는 숫자**: `오라클 회차 + 1 ≤ 예산`.
여유가 0이면 한 번의 헛발질로 클리어가 불가능해집니다.
그리고 **조사 대상은 예산의 3배 이상**이어야 선택이 소거가 아니라 판단이 됩니다.

## 8. 출력 형식

**YAML 하나만** 주세요. 설명·서론·설계 과정·자체 평가 없이 바로 코드블록으로.

⚠️ **flow mapping(`{ }`) 안에 쉼표가 들어가는 값은 반드시 따옴표로 감싸세요.**

```yaml
# 잘못 — 여기서 잘립니다. 파서는 아무 말도 하지 않습니다
- { id: f_x, kind: motive, content: 외상은 없고, 농도가 높았다 }

# 옳게
- { id: f_x, kind: motive, content: "외상은 없고, 농도가 높았다" }
```

이 결함은 이 프로젝트에서 세 번 나왔습니다. `npm run build` 의 `yaml-check` 가
잡지만, 잡히기 전까지는 문장이 조용히 반토막 납니다.

새 필드를 임의로 추가하지 마세요. id 참조의 철자를 바꾸지 마세요.

⬆ 여기까지 복사

---

## 받은 뒤 할 일

```bash
# 1. engine/cases/<사건>.yaml 로 저장 → 검사
npm run build

# 2. 반려되면 오류 문구를 프롬프트 끝에 그대로 붙여 다시 요청
# 3. 통과하면 산문 단계로
#    → PROSE-BRIEF.md 를 열고, 통과한 이 YAML 을 「논리 부분」에 붙여넣는다
```

`npm run build` 의 `verify` 단계가 **오라클·기대 회차·난이도·부문 분포**를 표로
찍는다. 난이도는 **선언하는 것이 아니라 계산되는 것**이다 — 생성 조건에
`difficulty` 가 없는 이유다. 원하는 난이도가 안 나오면 **예산을 고치거나 조사를
더한다.**

> **검사기가 잡지 못하는 것**: 재미, 인물이 살아 있는가, 트릭이 놀라운가,
> 다섯 진술이 머리에 들어오는가. 그건 사람이 읽어야 한다.
> `docs/MEMORY.md` §오케스트레이터 — *"「재미있는가」를 판정하는 에이전트는 없다."*
