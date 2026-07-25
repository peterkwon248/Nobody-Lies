---
session_date: "2026-07-24 (1차)"
project: "Nobody Lies (노바디 라이즈)"
working_directory: "C:/Users/user/Desktop/Nobdy Lies"
---

## Completed Work
검증: `npm run build` exit 0 · 골든 케이스 hard · 저작 서식 normal(경고 0) · 생성기 100%.

- **사건이 데이터가 됐다** — `engine/cases/mountain-lodge.yaml` 정본 + `src/schema.ts` 로더(참조 무결성 검사 포함). TS 사본 `src/cases/mountain-lodge.ts` 삭제. deep-equal 로 변환 정확성 확인 후 제거. js-yaml 의존성 추가.
- **트릭이 라벨에서 계약이 됐다** — `TrickType[]`(조합 가능) · `Illusion[]`(kind + brokenBy 필수) · `Exit`(밀실류 필수) · `flaw.plantedIn`(심긴 자리 참조). `ARCHETYPES` 레지스트리 6종, `identity_swap` 은 `unsupported` 표시.
- **오케스트레이터** — `src/generate.ts`(작가, 논리 골격, LLM 없음, 결정론적 seed) + `src/orchestrate.ts`(실험자: 예산 2~8 탐색해 목표 난이도 맞춤 + 생성·검증 루프). `tsx src/cli.ts --generate N`.
- **검증기 5종 → 20종 남짓** — discovered 공란 가용성 게이트, 필수 조사, presence↔claims(무고한 자의 거짓말/범인의 거짓말 부재), 트릭 계약 5종, 결과문↔gives 불일치, 확보 단어 출처, 레드 헤링 회수, 서사 균일성.
- **난이도 공식 수정** — `탐욕×1.5`(이중 계산) → `(오라클+탐욕)/2`. 예산 5→6. impossible → hard.
- **트릭 복원** — 작가의 원래 메커니즘(이른 사망·드라이아이스 가짜 연기·문 뒤 은신·소동 중 이탈·영수증 시각)을 문세라에게 이식. `e_dryice`·`e_receipt` 신설, 화로 조사 solution 승격, presence t3 annex→room.
- **산문 스키마(A-1)** — `Text`(ko/en) · `Person.statement` · `Action.result`(gives 옆) · `Case.prologue` · `Case.terms`. 프롤로그는 이관 완료.
- **저작 서식 재작성** — 빈 양식이 아니라 통과하는 최소 사건(daily 3인·2장·7공란). 오늘 배운 규칙 전부 주석화.
- **문서** — 죽은 절 7개에 `⛔ 폐기` 표시(design-brief 5·SYSTEM-DECISIONS 3·PROTOTYPE-NOTES 1). Claude Design 핸드오프 통합(상황판 인라인 export·평면도 엔진 401줄). 구버전 playtest 삭제.
- **플레이테스트 1차** — 시나리오 작가 1명. 5건 발견, 전부 데이터로 확인.

## In Progress
- **B 지시문 Claude Design 회신 대기** — 유서 버그·관계 그래프 판정어·결말 화면·트릭 변경분·인물명 교체·예산 6·태그라인.

## Remaining Tasks
- [ ] B 회신 수령 후 프로토타입 통합 (핸드오프 통째 교체 방식)
- [ ] A-2 산문 이관 — 진술 원문 5명·조사 결과문 20여개·확보 단어 정보 13개 (B 이후)
- [ ] 플레이테스트 나머지 3명 배포
- [ ] 결말 3·5장 텍스트 확정 (작가 몫. 초안은 MEMORY.md 에 있음)
- [ ] A-3 작가에 구조 변이 — 지금 100% 통과는 템플릿 하나뿐이라 그렇다
- [ ] A-4 통과분을 YAML 로 쓰기 (배포의 첫 조각)
- [ ] 산문가·검열관 (A-2 이후에 설 자리가 생김)

## Key Decisions
- **에필로그 분기 안 함** — 진실은 답에 따라 변하지 않는다. 채점 화면이 이미 대비를 만든다. 분기하면 게임이 두 번 말한다.
- **인터루드는 도착물끼리의 관계를 말하지 않는다** — `그래서`·`따라서` 금지. 인물 태도 묘사도 금지(decoy 만 주목하면 역방향 누설).
- **관계 그래프 ↔ 상황판은 통합 대신 가져오기** — 역할 셋 유지, 두 불만 동시 해소.
- **에이전트 다섯** — 작가(구조)·비평가·실험자 + 산문가·검열관. 작가를 둘로 나눈 것이 핵심(코드 vs LLM). 재미 판정 에이전트는 만들 수 없다.
- **트릭 복원은 범인 되돌리기가 아니라 메커니즘 이식** — L1 전체가 세라를 축으로 지어져 있고, 메커니즘이 세라 쪽에서 더 자연스럽다.
- **people = 용의자 목록** — 피해자는 넣지 않는다(guiltTable 이 순회하므로).
- **YAML 은 Case 의 near-1:1** — 이름 변경은 하되 파생은 하지 않는다. 파생 규칙이 끼면 반드시 어긋난다.

## Blockers / Issues
- **인물명 불일치** — 엔진 YAML·문서는 새 이름, 프로토타입은 아직 옛 이름(미야와키 8·최예나 3·조유리 4). PROTOTYPE-NOTES 는 새 이름이라 **문서가 없는 상태를 기술 중**. B 회신 시 해소.
- **REVEALS 불일치** — 장 완성 공개가 엔진 1·2·3장, 프로토타입 1·2·4장. 전환 4번 중 하나는 도착물 0개. 인터루드 전에 확정 필요.
- **저장소는 프로토타입의 사본** — 초기 커밋이 워크스페이스보다 401줄 뒤처져 있었다. 프로토타입은 저장소부터 고치지 말 것.

## Notes for Next Session
- 브랜치 `main`. 빌드 게이트 `npm run build`.
- 사건 정본은 이제 `engine/cases/mountain-lodge.yaml` 하나다. `src/cases/*.ts` 는 없다.
- 새 사건은 `templates/case-template.yaml` 을 복사 — 통과 상태에서 시작해 한 항목씩 고친다.
- 생성 루프 확인: `cd engine && npx tsx src/cli.ts --generate 60`
- LLM Wiki 에 `raw/2026-07-24-label-to-contract-validation.md` 추가함. `/wiki-compile` 필요.
- 상세 맥락은 `docs/MEMORY.md` — 오케스트레이터 역할표·인터루드 규칙·에필로그 결정·태그라인 제안이 전부 거기 있다.

## Files Modified
- `engine/cases/mountain-lodge.yaml` — 신규. 사건 정본
- `engine/src/schema.ts` — 신규. YAML 로더 + 참조 무결성
- `engine/src/generate.ts` — 신규. 작가
- `engine/src/orchestrate.ts` — 신규. 실험자 + 루프
- `engine/src/types.ts` — Text·statement·result·prologue·terms·Trick 계약·ARCHETYPES
- `engine/src/verifier.ts` — 검사 15종 추가, 난이도 공식 수정
- `engine/src/cli.ts` — `--case` · `--generate` 플래그
- `engine/src/cases/mountain-lodge.ts` — 삭제 (YAML 로 이관)
- `engine/templates/case-template.yaml` — 재작성. 통과하는 최소 사건
- `docs/MEMORY.md` — 대폭 갱신
- `docs/design-brief.md` · `docs/SYSTEM-DECISIONS.md` — 죽은 절에 폐기 표시
- `prototype/추리게임.dc.html` · `prototype/PROTOTYPE-NOTES.md` · `prototype/README.md` — 핸드오프 통합
- `prototype/playtest/` — 신규 export 추가, 구버전 삭제
