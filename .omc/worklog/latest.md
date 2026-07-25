---
session_date: "2026-07-25 16:30"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/user/Desktop/Nobdy Lies"
---

## Completed Work

**1. 병렬 세션 통합** (`bb2760b`) — 2026-07-24에 두 기계가 갈라져 `main` 과
`session/2026-07-24-yaml-orchestrator`(6커밋)가 같은 일을 각각 구현하고 있었다.
`git merge` 를 쓰지 않고(브랜치가 `src/cases/mountain-lodge.ts` 를 삭제 ↔ main 이 계속
수정 → 한쪽이 조용히 사라진다) 파일 단위로 손으로 얹었다.
이름은 main(`slots`·`claim`·`PresenceCell`), 내용물은 브랜치(YAML 정본·트릭 계약·
오케스트레이터·산문 스키마), 장소 어휘와 공범 폐기는 main.

**2. DC 잔여 5건 저장소·배포본 반영** (`be75447`) — "DC 툴이 있어야 한다"던 것이
사실이 아니었다. 전부 단순 문자열 치환이고 대상이 저장소 사본과 3.6MB 배포본 양쪽에
있었다. 공범 라벨 4곳 · 4장 문장틀 · `b15` 조사(`par`) · 별채 대포폰 서술 · 발견 위치 ·
**인물명 6명 전원**(애칭·호칭·영문 포함). 옛 이름 잔존 0건, 치환 전후 출현 수 1:1 확인.

**3. 프로덕션 착수** (`28dfddc` ~ `d8238a1`) — `app/` 신설. Vite + React 19 + TS.
- 진입 흐름: 홈 → 사건 상세 → 프롤로그 → 브리핑 → 진술 정독 5명
- 자유 진행 셸: 사이드바 · 상단 헤더(viewheader) · 우측 디테일 패널(교차 참조)
- 보고서: 5장 · 순차 잠금 · 공란 3상태 · 자동 완성 · 재개봉
- 저장소 3분리(`Case` / `PlayerAnnotations` / `CaseProgress`) — localStorage
- `engine/export-case.ts`: YAML → 정적 JSON. **검증 실패한 사건은 방출하지 않는다**

**4. 스키마 확장 2건 (엔진)**
- `Case.victimProfile` — 피해자는 `people`(용의자)에 못 넣는데 이름 둘 자리가 없어서
  브리핑에 id(`chaewon`)가 그대로 나왔다
- `Chapter.report` + `Blank.particle` — 보고서 서술문 문장틀과 한국어 조사가
  프로토타입에만 있었다. 5장 전부 이관. 검증기에 검사 추가(공란↔참조 1:1),
  음성 테스트 3종 확인
- `app/src/text/josa.ts` — 받침 판정. **공란이 비면 조사를 안 붙인다**(받침 누설 방지)

**5. A-2 진술 원문 이관** (`e788d09`) — 5명 12문단을 `design-brief.md` 에서 사건
파일로. "산문이 스키마 밖에 있으면 산문가도 검열관도 설 자리가 없다"의 첫 조각.

**6. 이식 규칙을 문서에 박음** (`3640cc2`) — 같은 실수를 세 번 해서.

## In Progress

없음. 전부 커밋·푸시됨. 빌드 green.

## Remaining Tasks

- [ ] **우측 디테일 패널 잔여 이식 3건** — 프로토타입 `추리게임.dc.html` 914~975행
  - [ ] **하이라이트 기능** (선행 조건) — 진술 원문 드래그 선택 → 표시/인용.
        `PlayerAnnotations.highlights` 는 스키마에 이미 있다
  - [ ] **표시만 / 전문 토글** — 하이라이트한 구절만 보기. 빈 상태 문구까지 원본에 있다
  - [ ] **메모 탭 제대로** — `＋ 새 메모` · 메모 번호 · 인용구 · 편집/읽기 전환 ·
        저장 표시. 지금은 인물별 한 줄만 나열한다
- [ ] **조사 시스템** ← 게임이 여기서 막힌다. 3장의 `사인`·`위장물`이 유료 조사로만 나온다
  - 현장(평면도) · 용의자 화면 · 예산 차감 · 물증 카드 · 조사 기록 탭
  - `CaseProgress.investigations` 와 `terms` 계산은 이미 물려 있다. 실행 화면만 없다
- [ ] 조사 기록 · 표기 안내 화면
- [ ] 관계 그래프 · 상황판
- [ ] 최종 제출 · 채점 · 결말
- [ ] 장 인터루드 (장 완성이 실제로 일어나므로 이제 트리거할 자리가 있다)
- [ ] DC 마스터에 `DC-SYNC-CHANGESET.md` 5건 반영 (사용자 · DC 툴)

## Key Decisions

- **프로덕션을 플레이테스트보다 먼저** — 테스터가 1명으로 좁혀졌고 큰 결함은 1차에서
  이미 나왔다. 인터루드도 프로덕션에서 만든다(DC에 만들면 두 번 만든다)
- **판정 로직은 이식이 아니라 참조** — `app` 이 `engine` 을 import 한다.
  HANDOFF §4는 이식이라 했지만 같은 로직 두 벌은 반드시 갈라진다(2026-07-24에 14곳).
  vite 플러그인이 엔진 안의 `.js` import 만 `.ts` 로 되돌린다
- **태그라인은 프로토타입 그대로** — 「모든 진술을 의심하라」. 규칙 문장으로 바꿨다가
  되돌렸다. 캐치프레이즈이고 제목과의 반어가 후크다. 규칙은 게임 안에서 전달
- **조사 예산은 `Case.budget`** — 프로토타입 하드코딩 5는 낡은 값(엔진 6)
- **인트로에도 홈 복귀 버튼** — 프로토타입은 갇히는데 그건 이식할 성질이 아니다
- **앱 클래스는 `nl-` 접두사** — Vector 가 `.detail`·`.chip` 을 이미 점유한다
- **재개봉은 완성을 되돌리지 않는다** — `solved` 에서 빼면 공란 하나 지울 때 뒷장이
  다시 잠긴다 = 이미 공개된 정보를 회수하는 셈

## Blockers / Issues

- **조사 시스템이 없어 2장까지만 플레이된다.** 다음 세션 최우선
- **하이라이트가 우측 패널의 병목** — 표시만 토글과 메모 인용구가 둘 다 여기 매달려 있다
- DC 워크스페이스는 여전히 옛 상태. 재export 하면 5건이 사라진다

## Notes for Next Session

**이식 규칙을 지킬 것** (`HANDOFF-TO-CODE.md` §8.1). 이번 세션에서 세 번 어겼다.
1. 안 읽고 새로 그림 (홈·사건 상세, 보고서)
2. 읽다가 멈춤 (사이드바만 읽고 `.main` 을 안 봐서 상단 헤더·우측 패널 누락)
3. 저작 결정을 결함으로 오판 (태그라인)

그리고 **덜 옮기고 완성이라 말한 것** — 표시만 토글·메모 탭. 100% 이식이 원칙이다.

`npm run dev` → localhost:3000. 진행은 localStorage 에 남으므로 처음부터 보려면
`localStorage.clear()`.

원본 위치 색인: 보고서 185~270 · 사이드바 75~135 · 상단 헤더 140~168 ·
우측 패널 914~975 · 홈 1066~ (`prototype/추리게임.dc.html`)

## Files Modified

- `engine/src/types.ts` — `victimProfile` · `Chapter.report` · `Blank.particle` · 트릭 계약 통합
- `engine/src/verifier.ts` — 트릭 계약 검사 · 도달가능성 · 무고한 자 현장 부재 · 서술문 1:1
- `engine/src/schema.ts` — YAML 로더. `slots`·`locations`·`scene`·`at_scene`·`report`·`particle`
- `engine/src/{deriver,generate,orchestrate,cli,export-case}.ts`
- `engine/cases/mountain-lodge.yaml` — 사건 정본. 진술 5명 · 서술문 5장 · 15.5 KB
- `engine/templates/case-template.yaml` — 저작 서식
- `app/**` — 프로덕션 앱 전체 (신설)
- `prototype/**` — DC export 채택 + 데이터 수정 5건 적용
- `docs/{MEMORY,NEXT-ACTION,HANDOFF-TO-CODE,SYSTEM-DECISIONS,design-brief}.md`
- `prototype/DC-SYNC-CHANGESET.md` — 실제 export 확인해 재작성
