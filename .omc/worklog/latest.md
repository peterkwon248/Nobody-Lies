---
session_date: "2026-07-29"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kwonkyunghun/Desktop/Nobody Lies"
machine: "DESKTOP-JCJTAH8"
---

## Completed Work

**작업 트리 깨끗 · 빌드 게이트 7단 초록(exit 0) · 20커밋 전부 main 에 푸시됨.**

### 이번 세션이 닫은 것 — 생성 사건이 앱에서 열린다

```
✅ ① 산문을 스키마로   (2026-07-27)
🔨 ② 산문가            서식 있음 · 결과문 하나만 받아봤다  ← 다음은 여기
⬜ ③ 검열관            §9-7 4종 + §9-8 2종
✅ ④ 작가              트릭 5종 · 팔레트 · 장 3~8 · 난이도 3갈래 · 평면도 · YAML 방출
```

```
팔레트(LLM 1회) → generateCase(seed, palette) → verify → --emit → /?case=gen-1
                                                       → --emit --yaml → 저작
```

### 항목별

1. **④작가가 섰다** — 트릭 아키타입 5종(계약을 코드가 채운다) · `Palette` 이음매 ·
   장 수 3~8 가변(가닥 구조) · 난이도 3갈래(`--want`) · 평면도 생성 · YAML 방출
2. **앱이 사건 파일에서 구조를 읽는다** — 인물·진술·지문·시간축·장소·**보고서
   (장·공란·정답·서술문)**·**평면도(GEO)**·확보 단어 은행·씨앗 단어·**저장 키**
3. **용의자 5명 고정** — `SYSTEM-DECISIONS §3` 「용의자 수 가변」을 뒤집었다(사용자 결정)
4. **게이트 5단 → 7단** — `gen-check`(생성기 `--min-pass 100`) · `tmpl-check`(저작 서식)
5. **서식 셋** — `CASE-BRIEF.md`(④ 통째 의뢰) · `PALETTE-BRIEF.md`(주력) ·
   `palette-museum.json`(사용자가 받아온 첫 실사용 팔레트)
6. **캠페인 생성기가 앱 안에 들어왔다** — 홈 「＋ 캠페인 생성」 또는 `/?generate`.
   난이도·장 수·개수 → 서식 복사 → 챗봇에서 받아 붙여넣기 → 생성 → 플레이.
   **유저가 알고 한다**(앱이 몰래 안 만든다) · 검증 실패 시 오류 복사 버튼 ·
   엔진은 이식 아니라 참조(`vite.config.ts` `engineResolver` 가 이미 있었다)

### 검증한 것

| | |
|---|---|
| 산장 사건 회귀 | 공란 20의 답 · kind · `SEC_BLANKS` · `ORDER` · `GEO`(방4·구역2·문5·창3·보행선2) · `WALK` · 고정물 4 — **전부 옛값** |
| 생성 | 200/200 통과 · 아키타입 5종 균등 · 상주 경고 0 |
| 장 수 | 3장 오라클 4 · 5장 오라클 6 · 8장 오라클 9 |
| 난이도 | easy·normal·hard 각 10건 100% |
| YAML 방출 | **왕복 대조** — 쓴 파일을 다시 읽어 원본과 같음 |
| 박물관 팔레트 | 앱에서 열림 · 장소 11곳 박물관 어휘 · 조사 34 · 콘솔 에러 0 |

## In Progress

없음.

## Remaining Tasks

- [ ] **🎯 진술 원문을 산문가에게 받는다 (사용자 손 필요)** — `PROSE-BRIEF.md`,
      **한 인물씩** · 짝을 같이. 대상은 박물관 사건(seed 1)
- [ ] **팔레트에 인물 층**(성격·비밀의 결·말투) — 조립 진술 개선.
      **1번 결과를 봐야 어디까지 흉내낼 수 있는지 안다**
- [ ] **생성 사건을 기계 사이로 옮기는 길** — 지금은 `localStorage` 라 그 브라우저에만
      있다. 팔레트를 다시 돌리거나 `--emit --yaml` 로 뽑아 `engine/cases/` 에 커밋한다
- [ ] `e_safes` · `a_ph_yuri` 의 `clues` · 색·대비·질감 · 배치 스냅 · 표기 안내 문안

## Blockers / Issues

- ⚠️ **「없는 것이 표시가 된다」 — 하루에 두 번.** 진술 문단 수 · 소지품 검사.
  절대 규칙이 금지한 것은 「강조」인데 **부재도 강조다**
- ⚠️ **「초록불의 뜻」 — 하루에 네 번.** 게이트에 없던 생성기·저작 서식,
  리포트에 없던 아키타입 분포·상주 경고. **통과는 「오류가 없다」일 뿐이다**
- ⚠️ **엔진에 이미 있는데 배선만 없던 것이 다섯.** 생성기·저작 서식·확보 단어·
  보고서·평면도. **새로 만들기 전에 엔진을 본다**
- ⚠️ **대입(`this.X =`)만 찾으면 이관 여부를 못 판단한다** — `applyCase` 에
  제자리 변경이 있다. 그래서 「보고서는 앱 하드코딩」이라고 한 번 틀리게 말했다
- ⚠️ **어휘가 논리를 흔들면 결함이다.** 팔레트 배열 길이가 rng 를 밀어 트릭이
  5→3종이 됐다. 초기 상태를 흩고 트릭을 독립 줄기로 옮겨 해소
- ⚠️ **스크린샷이 네 기계째 막힌다.** React fiber 를 훑어 런타임 상태를 직접 읽는
  방식으로 대체했다 — 이번 세션 실측이 거의 다 그 방식이다

## Notes for Next Session

- **직전 머신은 `DESKTOP-JCJTAH8`.** 07-28은 `KWONKYUNGHUN`(OneDrive 아래)이었다.
  ⚠ 머신 이름 `KWONKYUNGHUN` 과 이 기계의 **사용자명** `kwonkyunghun` 이 겹친다 —
  `$env:COMPUTERNAME` 과 경로를 같이 봐야 오진하지 않는다
- **기계를 옮기면 `git pull` 다음 `npm install`**
- `app/public/cases/` 와 `out/` 은 추적 안 된다 — `--emit` 산출물이고 언제든 다시 만든다
- 이 저장소는 **직접 main 푸시** (feature 브랜치·PR 없음)
- **`docs/CONTEXT.md`·`docs/TODO.md` 는 의도적으로 없다** — MEMORY.md 단일 체제

## Files Modified

- `engine/src/generate.ts` — 트릭 5종 · `Palette` · 장 수 가변 · 가닥 · 평면도 ·
  진술 도출 · 장소 11 · 키 배정기 · rng 탈상관
- `engine/src/orchestrate.ts` — `fit()` 재작성(19회 → 2회) · 상주 경고 표시 · `RunOptions`
- `engine/src/cli.ts` — `--palette` · `--want` · `--chapters` · `--emit` · `--yaml` · `--min-pass`
- `engine/src/to-yaml.ts` — **신설**. `parseCase` 의 역함수
- `engine/templates/` — `CASE-BRIEF.md` · `PALETTE-BRIEF.md` · `palette-example.json` ·
  `palette-museum.json` **신설** · `case-template.yaml` 5인 복구 · `README.md`
- `app/src/App.jsx` — `applyCase` 구조 이관(인물·진술·시간·장소·보고서·평면도·
  확보 단어·씨앗·저장 키)
- `app/src/main.jsx` — `?case=` 선택 · **에러 경계**
- `package.json` — `gen-check` · `tmpl-check`
- `docs/` — `MEMORY.md` · `NEXT-ACTION.md` · `SESSION-LOG.md` · `SYSTEM-DECISIONS.md`
