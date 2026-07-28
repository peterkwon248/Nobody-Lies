---
description: 세션 종료 — 게이트를 통과시키고 인계 파일 넷을 갱신해 main 에 커밋·푸시한다
argument-hint: [커밋 제목에 넣을 한 줄 (생략 가능)]
---

세션을 닫는다. **커밋되지 않은 것은 다음 기계에서 존재하지 않는다.**

## 1. 게이트 — 여기가 커밋 게이트다

```bash
npm run build
```

**exit 0 이 아니면 커밋하지 않는다.** 실패 내용을 보고하고 멈춘다. 고칠 수 있으면
고치고 다시 돌린다. 초록을 못 만들면 그 사실을 워크로그 Blockers 에 적고 **커밋은
사람에게 묻는다.**

## 2. 인계 파일 넷을 **같이** 갱신한다

하나라도 빠지면 다음 기계가 속는다. 워크로그를 빼먹는 것이 이 저장소의 재발 실수다(`6f6dccb`).

| 파일 | 방식 |
|---|---|
| `docs/MEMORY.md` | 정본. 이번 세션이 만든 규칙·발견을 절로 넣는다. **닫힌 절은 지우지 않고 ✅·⛔·⏭ 를 박는다** — 지우면 그날 무엇이 남아 있었는지가 사라진다 |
| `docs/NEXT-ACTION.md` | §다음 즉시 액션을 **하나로** 갱신. 머리말의 마지막 갱신·브랜치·기계 줄도 |
| `docs/SESSION-LOG.md` | append-only, **최신이 위**. 날짜 + 기계명 헤딩 |
| `.omc/worklog/latest.md` | 덮어쓰기 (최신 1개만 산다) |

`.omc/worklog/latest.md` 서식은 유지한다:

```
---
session_date · project · working_directory · machine
---
## Completed Work   (무엇을 닫았나 · 항목별 · 검증한 것)
## In Progress
## Remaining Tasks   (- [ ] 체크박스. 🎯 로 다음 하나를 표시)
## Blockers / Issues (⚠️)
## Notes for Next Session
## Files Modified
```

**닫힌 것을 열린 채로 남기지 않는다.** 갱신하면서 낡은 줄이 보이면 그것도 같이 고치고,
무엇이 낡았었는지를 커밋 본문에 적는다.

## 3. main 에 커밋한다

feature 브랜치·PR 없다. 직접 `main`.

- 산출물은 커밋하지 않는다 — `app/public/cases/` 는 `.gitignore` 에 있고 `dev`·`build`
  둘 다 앞에서 굽는다
- `package-lock.json` 에 `"peer": true` 표시만 지운 차분이 있으면 **되돌린다**
  (npm 버전 차이지 의존성 변화가 아니다)

커밋 메시지는 **한국어**. 제목은 무엇이 바뀌었는지 한 줄(인계 커밋이면 `after-work: ` 접두),
본문은 **왜 그렇게 했는지**와 낡아서 고친 것. 끝에:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

$ARGUMENTS 가 있으면 제목에 반영한다.

## 4. 푸시하고 확인한다

```
git push && git status && git log --oneline -3
```

작업 트리가 깨끗한지 확인하고, **다음 세션이 `before-work` 로 무엇을 읽게 되는지**를
한 문단으로 보고한다.
