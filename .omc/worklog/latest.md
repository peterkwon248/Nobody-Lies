---
session_date: "2026-07-28"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kkh94/OneDrive/Desktop/Nobody Lies"
machine: "KWONKYUNGHUN (새 기계 · OneDrive 아래)"
---

## Completed Work

**작업 트리 깨끗 · 빌드 게이트 5단 초록(exit 0) · 콘솔 에러 0 · 난이도 불변.**

### 이번 세션이 닫은 것 — §9-8 검사 둘 + 산문가 서식 첫 실사용

```
✅ ① 산문을 스키마로   (2026-07-27 완주)
🔨 ② 산문가            서식 첫 실사용 완료 — 구멍 셋을 잡아 서식에 반영  ← 지금 여기
⬜ ③ 검열관            §9-7 4종 + §9-8 2종. 반대 방향까지 덮었다
⬜ ④ campaign 작가
```

### 항목별

1. **새 기계 세팅** — `.claude/` 가 있어 `git clone` 이 거부돼 `init`+`fetch` 로 제자리에
   받았다. `npm install` 후 게이트 5단이 **한 번에 초록**. `npm install` 이
   `package-lock.json` 에 `"peer": true` 표시만 지우는 무의미한 차분을 남겨 되돌렸다
2. **§9-8 신설** — 9-7 의 거울상. **(e) 물증을 주는데 `result` 없음 → 오류**
   (6.55 의 정반대이고 피해가 같아 등급도 같다) · **(f) 아무도 안 쓰는 물증 → 경고**
3. **(f)의 「쓰인다」는 넷** — 논리·트릭·어휘·**읽을거리(`record`·`extra`)**.
   마지막 것이 없으면 읽히기만 하는 물증이 전부 걸려 **경보가 소음이 된다**
4. **경고가 셋 나왔다** — 문서는 `e_yuri_call` 하나만 알고 있었다.
   `e_wy_call_log` 는 기록을 붙여 닫고, **`e_safes` 는 일부러 열어뒀다**(아래)
5. **`a_ph_yuri` 결과문 + `e_yuri_call` 기록** — `PROSE-BRIEF.md` 서식으로 받았다.
   짝인 `a_ph_wy` 를 브리프에 넣어 **문장 수·길이를 맞췄다**
6. **서식 구멍 셋 반영** — `evidence[].record` 누락 · 합격 기준이 검증기보다 낡음 ·
   **「같은 온도」의 맞출 대상을 안 줌**

### 검증한 것

| | |
|---|---|
| 배포 JSON 적재 | `schema.ts` 화이트리스트 통과 — 두 필드 다 온전히 실렸다 |
| 쉼표 절단 | 없음 (문장 끝까지 살아 있다) |
| 앱이 집는가 | 키 `phone:yuri` 가 하드코딩 `M` 에 **없어서 엔진 폴백이 실제로 발동** |
| 난이도 | **불변** — 오라클 4 · 기대 6(밴드 4~7) · `hard` |
| 콘솔 | 에러 0 · 의도한 신호 둘(`영수증·물자국`)만 |

## In Progress

없음.

## Remaining Tasks

- [ ] **🎯 산문가를 나머지 산문으로 넓힌다** — 다음 후보는 **진술 원문 5명**(가장 크고
      규칙이 가장 많다: 지문 전원/전무 · 말투 구분 · 불안 편중 금지)과 **장 서사 5**.
      **한 번에 받지 말고 한 인물씩** 받아 검증기에 물린다
- [ ] **`e_safes` 를 무엇으로 만들지** — 9-8f 경고 상주. **의도한 것이다**: 금고가
      ① 잠긴 금고 ② 유서의 두 번째 경로 ③ 다른 것 중 미결이고, **그 전에 기록을 쓰면
      결정을 문장으로 먼저 내려버린다.** YAML 에 주석으로 박아뒀다
- [ ] **`a_ph_yuri` 에 `clues` 를 붙일지** — 짝 `a_ph_wy` 는 프로필 한 줄을 남기는데
      이쪽은 안 남긴다. 대칭으로는 맞지만 **화면 동작 변경**이라 손대지 않았다
- [ ] **색·대비·질감** — 기하는 다 쟀다. **스크린샷이 세 기계째 막혀 있다**
- [ ] **바닥 위 배치 스냅 여부** · **표기 안내 문안**(changeset 9) · **장 인터루드 렌더**

## Blockers / Issues

- ⚠️ **검사를 만들면 아는 것보다 많이 나온다** — (f)가 문서가 아는 1건이 아니라 3건을
  물었다. 07-25 우측 패널 3건이 45건이었던 것과 같은 형태다. **세기 전에는 모른다**
- ⚠️ **서식이 검증기보다 낡는다** — 첫 실사용에서 바로 드러났다. `verifier.ts` 에 검사를
  더하면 `PROSE-BRIEF.md` 합격 기준도 **같이** 고친다
- ⚠️ **「같은 온도로 쓰라」는 맞출 대상이 브리프에 있어야 지켜진다** — 없으면 산문가가
  온도를 혼자 정하고, 한쪽이 길어지는 순간 그게 **유용도 표시**다(절대 규칙 위반)
- ⚠️ **`doInvestigate` 는 저장에 쓴다** — 그래서 브라우저에서 조사를 실행하지 않고
  서빙되는 JSON 과 키 도출을 읽어 확인했다

## Notes for Next Session

- **작업 기계가 넷이 됐다.** 이 기계(`KWONKYUNGHUN`)는 **OneDrive 아래**에 있다
- **기계를 옮기면 `git pull` 다음 `npm install`** (07-24 이후 `js-yaml` 이 늘었다)
- **새 기계는 `git config --local user.name/user.email` 부터 한다.** 없으면 첫 커밋이
  `Author identity unknown` 으로 튕긴다. 기존 커밋은 전부
  `peterkwon248 <vmfhxhtmwkd7@gmail.com>` 이다 — **`--local` 로 저장소에만 건다**
- **살아 있는 목록은 `NEXT-ACTION.md` §다음 즉시 액션 하나뿐이다.** `PORT-AUDIT.md`
  의 「남은 것」 표는 07-25 스냅샷이고 다섯 줄 중 넷이 이미 닫혀 있었다 —
  2026-07-28에 ⏭ 배너를 달았다. **`NEXT-ACTION` 이 그 파일을 가리키고 있어서
  다음 기계가 속을 자리였다**
- **`app/public/cases/mountain-lodge.json` 은 추적 안 된다** — `npm run case` 산출물이고
  `dev`·`build` 둘 다 앞에서 굽는다
- 이 저장소는 **직접 main 푸시** (feature 브랜치·PR 없음)

## Files Modified

- `engine/src/verifier.ts` — **§9-8 신설** (e 오류 · f 경고)
- `engine/cases/mountain-lodge.yaml` — `a_ph_yuri.result` · `e_yuri_call.record` ·
  `e_wy_call_log.record` · `e_safes` 에 「일부러 비워둔다」 주석
- `engine/templates/PROSE-BRIEF.md` — 짝 포함 규칙 · `evidence[].record` · 9-8 합격 기준
- `docs/MEMORY.md` — §반대 방향 신설 · 🔴 미해결 절을 ✅ 로 · 현재 단계 갱신
- `docs/NEXT-ACTION.md` · `docs/SESSION-LOG.md`
- `docs/PORT-AUDIT.md` — 「남은 것」 표에 ⏭ 스냅샷 배너 (넷은 이미 닫혔다)
