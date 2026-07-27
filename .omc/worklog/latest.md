---
session_date: "2026-07-27 오후"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kwonkyunghun/Desktop/Nobody Lies"
machine: "DESKTOP-JCJTAH8 (집)"
---

## Completed Work

**15커밋 전부 `main` 에 푸시됨 (`c282204..e16d94c`). 작업 트리 깨끗 · 빌드 게이트 5단 초록 · 콘솔 에러 0.**

### 이번 세션이 닫은 것 — 엔진 재분리 완주

논리와 **산문이 전부 사건 파일 안에** 들어왔다. 이것이 `docs/MEMORY.md`
§오케스트레이터가 못박은 **자동 생성의 선행 조건**이었다 —
*"산문이 스키마 밖에 있으면 산문가도 검열관도 설 자리가 없다."*

```
✅ ① 산문을 스키마로   TERM_MAP·CLUE_MAP·REVEALS·CLAIM_REVEALS·결과문·고정물·verb
⬜ ② 산문가            ← 서식(PROSE-BRIEF.md)까지 만들었다. 다음은 실사용
⬜ ③ 검열관            ← 첫 조각(검증기 §9-7, 4종)은 이미 있다
⬜ ④ campaign 작가
```

### 항목별

1. **문서 정합성 보정** — NEXT-ACTION 이 MEMORY 와 정면 모순(「DC 가 마스터」 vs
   「App.jsx 정본」). MEMORY 파일 지도가 **삭제된 파일**을 가리켰다(`port-ledger.json`,
   옛 앱 52파일, `nl-` 접두사)
2. **확보 단어 풀** → 엔진. 「decoy 3은 난이도 결정」이 **거짓**이었다 — 셋은 어느
   경로로도 공개되지 않아 난이도 영향 0. 풀 12→9 · `everyPoolWordReachable = true`
3. **고정물 이름표** → 엔진(`fixtures[].label`). ⚠ `schema.ts` 가 필드를 화이트리스트로
   재구성해서 **빌드 초록인데 배포 JSON 엔 없었다** — no-op 를 실을 뻔했다
4. **`INV_ACTIONS` 모델 충돌 해소** — 「6동사 ↔ 23구체」가 실은 **3쌍**. 23→20,
   **난이도 불변**. 진짜 원인은 `verb` 필드 부재 → `ActionVerb` 신설. 앱 키 20, 충돌 0
5. **`TERM_MAP`·`CLUE_MAP`·`REVEALS`·`CLAIM_REVEALS`** 전부 이관. 매번 도출값이
   하드코딩과 같은지 실측(`identical: true`)
6. **산문 ↔ 데이터 정합 검사 신설**(§9-7, 4종). 음성 테스트에서 **유서 버그를 그대로
   재현해 잡는 것** 확인
7. **피해자 조사 연결** — 트릭 허점의 두 자리 중 하나가 앱에서 막혀 있었다
8. **`ds.__errors` 진단 완료** — 우리와 무관(번들이 데모에 `__ds_scope` 구조분해를
   안 넣는다). 경로로 갈라 `debug` 로 접었다 → **콘솔 에러 0**
9. **상황판 기하 실측** — 스크린샷 없이 치수로. 타임라인 띠 56 ↔ 바닥 76, **여유 20px**
10. **`yaml-comma-check` 확장** — 여러 줄 flow mapping 을 못 보고 있었다
11. **`PROSE-BRIEF.md`** — 사람이 Claude 웹에 붙여 넣는 산문 의뢰 서식

## In Progress

없음. 전부 커밋·푸시 완료.

## Remaining Tasks

- [ ] **🎯 산문 템플릿 실사용** — `engine/templates/PROSE-BRIEF.md` 로 `a_ph_yuri`
      결과문부터 받아본다. 서식이 도는지 + 검증기가 무는지 한 번에 확인된다
- [ ] **`a_ph_yuri` 가 「아무것도 없음」으로 뜬다** — 물증(`e_yuri_call`)을 주는데
      결과문이 없다. 그 물증을 참조하는 **fact·reveal 이 0건**이라 조사가 예산만 먹는다.
      검사 둘을 더할 자리: ① `gives` 있는데 `result` 없음 ② 아무도 안 쓰는 물증
- [ ] **색·대비·질감** — 기하는 다 쟀다. **스크린샷이 두 기계 다 막혀 있다**
      (창이 표시 상태가 아니면 compositing 이 없다). 창을 띄우면 바로 된다
- [ ] **바닥 위 배치 스냅 여부** — 사용자 결정 대기 (§0.2 자동 분석 경계에 가깝다)
- [ ] **표기 안내 문안**(changeset 9) · **장 인터루드 렌더**(데이터는 다 찼다)

## Blockers / Issues

- ⚠️ **「모델이 다르다」고 세 번 오진했고 세 번 다 틀렸다** — `INV_ACTIONS`(실은 3쌍) ·
  `CLUE_MAP`(얹을 자리를 잘못 고름) · `CLAIM_REVEALS`(`target` 값 하나 모자람).
  **못 옮긴다가 아니라 자리를 잘못 골랐던 것**
- ⚠️ **검사기가 있다고 그 부류가 잡히는 건 아니다** — 쉼표 절단이 07-25·26·27
  **세 번** 나왔고 07-26 에 만든 검사기가 07-27 것을 놓쳤다(여러 줄 flow mapping)
- ⚠️ **`doInvestigate` 는 저장에 쓴다** — 검증 중 저장이 더럽혀져 「고친 코드가
  안 고쳐진 것처럼」 보였다. 상태를 쓰는 함수를 부르면 그 자리에서 원복

## Notes for Next Session

- **기계를 옮기면 `git pull` 다음 `npm install`.** 07-24 이후 `js-yaml` 이 늘어
  `npm run verify` 가 `ERR_MODULE_NOT_FOUND` 로 죽어 있었다
- **`app/public/cases/mountain-lodge.json` 은 추적 안 된다** — `npm run case` 산출물이고
  `dev`·`build` 둘 다 앞에서 굽는다. 새 클론이어도 문제없다
- **Max 구독 ≠ API 과금.** 산문가는 빌드타임이라 비용이 *사건 개수*에 비례
  (Opus 5 기준 사건 1건 ≈ $0.65). **가격보다 검열관 통과율로 모델을 고른다**
- 이 저장소는 **직접 main 푸시** (feature 브랜치·PR 없음)

## Files Modified

- `engine/src/types.ts` — `ActionVerb`·`ProfileSlot`·`ActionClue`·`clues`·
  `fixtures[].label`·`addClaims.target:'grid'`+`slot`
- `engine/src/schema.ts` — 위 필드 전부 파싱·검증 (**화이트리스트라 여기 안 넣으면 죽는다**)
- `engine/src/verifier.ts` — §9-7 산문↔데이터 정합 4종 · 지목 불가 조사 · 허점 도달성
- `engine/cases/mountain-lodge.yaml` — 조사 23→20 · `verb` 20 · `clues` 12 ·
  reveals 내용 이관 · 고정물 라벨 · `a_victim_bel` target+result
- `app/src/App.jsx` — `applyCase` 도출(풀·TERM_MAP·CLUE_MAP·REVEALS·CLAIM_REVEALS·
  `CASE_ACTIONS`·`VICTIM_TARGET`) · `resultFor` 엔진 폴백 · `pname` 피해자
- `app/src/main.jsx` — `reportDsErrors()` 경로 분리
- `scripts/yaml-comma-check.mjs` — 여러 줄 flow mapping
- `engine/templates/PROSE-BRIEF.md` — **신설**
- `docs/MEMORY.md` · `docs/NEXT-ACTION.md` · `docs/SESSION-LOG.md`
