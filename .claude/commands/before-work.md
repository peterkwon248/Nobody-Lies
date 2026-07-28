---
description: 세션 시작 — 인계 파일을 읽고 게이트를 돌려 현재 위치를 보고한다
---

세션을 연다. **아래 순서를 지킨다.** 읽기 전에 코드를 건드리지 않는다.

## 1. `git pull` 부터 — 무조건 맨 앞

```
git status && git pull && git log --oneline -5
```

작업 기계가 넷이다. **당기기 전에 읽은 것은 다른 기계의 어제일 수 있다.**
작업 트리가 더러우면 당기기 전에 그것부터 보고한다 — 직전 세션이 안 닫고 간 것이다.

브랜치는 `main`. 이 저장소는 **직접 main 푸시**다 (feature 브랜치·PR 없음).

## 2. 신원과 의존성을 맞춘다

```
git config --local user.name && git config --local user.email
```

비어 있으면 **여기서 건다.** 없으면 세션 끝의 첫 커밋이 `Author identity unknown` 으로
튕긴다. 기존 커밋은 전부 `peterkwon248 <vmfhxhtmwkd7@gmail.com>` 이다 —
**`--local` 로 저장소에만 건다.**

`git pull` 이 `package-lock.json` 을 건드렸거나, `.omc/worklog/latest.md` frontmatter 의
`machine`·`working_directory` 가 지금과 다르면:

```
npm install
```

> ⚠ **`npm install` 이 `package-lock.json` 에 `"peer": true` 표시만 지우는 차분을
> 남긴다.** npm 버전 차이지 의존성 변화가 아니다 — **생긴 자리에서 바로 되돌린다.**
> ```
> git checkout -- package-lock.json
> ```
> 세 기계·새 클론에서 재현했다(2026-07-28). 안 되돌리면 세션 내내 트리가 더러워
> 보이고, 무엇이 내 변경인지 흐려진다.

07-24 이후 `js-yaml` 이 늘어서 `npm install` 을 건너뛰면 `npm run verify` 가
`ERR_MODULE_NOT_FOUND` 로 죽는다.

## 3. 인계 파일을 이 순서로 읽는다

1. `docs/NEXT-ACTION.md` — **§다음 즉시 액션.** 이게 살아 있는 목록의 전부다
2. `.omc/worklog/latest.md` — 직전 세션 핸드오프 (덮어쓰기라 최신 1개만 남는다)
3. `docs/MEMORY.md` — 컨텍스트·우선순위·미해결의 **정본**. 최소한 §절대 규칙과
   §이식 규칙, 그리고 이번에 손댈 영역의 절을 읽는다

> ⚠ `docs/PORT-AUDIT.md` 의 「남은 것」 표는 **2026-07-25 스냅샷**이다. 다섯 줄 중 넷이
> 이미 닫혀 있었다. 살아 있는 목록으로 쓰지 않는다 (파일 머리에 ⏭ 배너가 있다).

## 4. 게이트를 돌려 초록 기준선을 잡는다

```bash
npm run build
```

**7단** — `typecheck · yaml-check · verify · gen-check · tmpl-check · port-check · build`.
**초록의 뜻**: 골든 케이스 통과 + 생성기 100% + 저작 서식 통과 + 이식 회귀 없음.

**실패면 그것이 이번 세션의 첫 일이다.** 내가 아무것도 안 했는데 빨간 것은 직전
세션이 남긴 것이다. 단수가 늘어날 수 있으니 **`package.json` 의 `build` 를 믿는다** —
이 문장이 아니라.

## 5. 보고한다

- **어디까지 왔나** — ①산문을 스키마로 / ②산문가 / ③검열관 / ④campaign 작가 중 지금 위치
- **다음 하나** — NEXT-ACTION §다음 즉시 액션
- **막힌 것** — 워크로그 Blockers
- **게이트 상태** — exit 0 인지

읽다가 **문서끼리 어긋나면 그 자리에서 지적한다.** 닫힌 일이 열린 채 남아 있거나,
낡은 표가 살아 있는 목록인 척하고 있으면 그것부터 말한다 — `b9f49b4` 가 그렇게 걸렸다.
