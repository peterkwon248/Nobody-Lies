---
session_date: "2026-07-31"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kwonkyunghun/Desktop/Nobody Lies"
machine: "DESKTOP-JCJTAH8"
---

## Completed Work

**게이트 9단 초록(exit 0) · port-check 308/320/12/어긋남 0 · lint 신규 경고 0.**

> ★★ **배포가 한 번도 성공한 적이 없었다** ★★
>
> Vercel 배포 **18건 전부 실패**(ERROR 17 · CANCELED 1 · READY 0). 프로덕션 도메인은
> 트래픽을 낸 적이 없다. 문서는 *"push 하면 자동으로 나간다"* 고 적어놨다 — **거짓.**
> 사용자가 *"푸시하면 vercel이 자동배포한다고??"* 라고 물어서 재보다 걸렸다.
>
> 원인은 **대시보드 설정 둘**, 저장소는 무결(깨끗한 클론 모사로 증명):
> - `Root Directory = app` → 루트 `vercel.json` 무시 → **배포가 9단 게이트를 안 돌았다**
> - `Install Command` Override = `npm install` (`--include=dev` 없음)
>   → `NODE_ENV=production` 이라 devDeps 건너뜀 → engine 의 `js-yaml` 미설치 → 빌드 사망
>
> `"github": { "silent": true }` 가 실패를 커밋에 안 알렸다 → **`false` 로 돌렸다.**

- **문 1 — YAML/JSON 들여오기 UI** (`Generator.jsx`). 문지기 넷(`load` → `parseCase` →
  `verify` → 왕복 대조). id 충돌은 비켜난다. `js-yaml` 5.2.2 안전성을 재고 들어갔다.
- **§9 수정 브리프** — 「오류 복사」 → **완성된 수정 지시서**. 네 자리 모두 첫 줄이
  **유저에게 하는 말**인데 복사 구간에 들어가고 있었다(챗봇이 자기 지시로 읽는다).
- **배달 배선** — `export-case` 전건 + `index.json` · 번들 목록 · 홈 매니페스토.
  커밋된 캠페인 **4건이 전부** 나간다.
- **난이도 배지**가 `hard` 리터럴이었다 — 넷 중 셋이 우연히 hard 라 안 걸렸다.
- **`Generator.jsx` biome 편입**(감시 0인 유일한 파일이었다) · **`voice-ref.json` 단일 출처**
  (`REF.endings` 5→4 거짓 라벨 정정) · **서식 둘의 유저 지시문 제거** ·
  **`@types/js-yaml` 죽은 의존성 제거** · **`biome.jsonc` 의 없는 경로 제거**.

## Next

**배포 로그로 성공을 확인한다** — 이번 push 가 첫 성공이어야 한다.
`list_deployments` → `state: READY` 인가. ERROR 면 `get_deployment_build_logs`.
성공하면 테스터에게 URL (`#case=practice-room` 이 첫 판으로 가장 적합).

★ **진짜 목표는 「정답을 모르는 사람」의 한 판이다** — 플레이테스트가 1명이고
첫 실플레이도 사용자 본인이었다. **사용자는 범인을 알아서 누설을 못 느낀다.**

## Blockers / Watch Out

- ⚠ **`scripts/world-check.mjs` 에 NUL 바이트 2개** → grep·ripgrep 이 파일을 통째로
  건너뛴다. 저장소 전수 검색이 그것만 조용히 빠진다. `'\x1f'` 로 바꾸면 끝. **미해결.**
- ⚠ `closing-theater` 가 홈 02번에 뜬다 — **프롤로그 불일치를 일부러 남긴** 사건이다.
- ⚠ 끝낸 사건도 홈에서 「진행 중」으로 보인다(`allSealed()` 를 다른 사건에 못 쓴다).
- ⚠ 말투 서식 수정의 **효과는 안 쟀다** — 챗봇 왕복이 필요하다.
- ⚠ **대시보드 Override 를 다시 켜지 마라** — `vercel.json` 이 정본이다.
