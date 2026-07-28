---
session_date: "2026-07-28"
project: "노바디 라이즈 (Nobody Lies)"
working_directory: "C:/Users/kkh94/OneDrive/Desktop/Nobody Lies"
machine: "KWONKYUNGHUN (OneDrive 아래)"
---

## Completed Work

**작업 트리 깨끗 · 빌드 게이트 7단 초록(exit 0) · 콘솔 에러 0.**

### 이번 세션이 닫은 것 — 앱이 기계 밖으로 나갔다

```
✅ ① 산문을 스키마로
🔨 ② 산문가            서식 있음 · 브리프 준비됨 · 아직 안 받았다  ← 다음은 여기
⬜ ③ 검열관
✅ ④ 작가
```

### 항목별

1. **🎯 홈에서 생성 사건 삭제** (닫음) — `✕` → 「지울까? 진행도 같이 사라진다」 →
   지운다/취소. 생성기의 맨 `×` 와 다르게 **한 번 묻는다**: 홈의 행은 누르면 사건이
   열리는 자리라 오조작이 곧 소실이고, seed 가 무작위라 **같은 것을 다시 못 만든다**.
   앱 제공 사건은 `canDel` 을 아예 안 달고 나가 지울 자리가 렌더되지 않는다
2. **테스터용 단일 HTML** (`npm run tester` → `out/nobody-lies-tester.html` 1.32 MB) —
   더블클릭하면 도는 게임. 서버·인터넷 없음
3. **라우팅을 쿼리에서 해시로** — 아래 §안드로이드 참조. 두 번 죽고 세 번째에 섰다
4. **사건 제목 배선** — `applyCase` 가 제목만 안 읽어오고 있었다. 한 번 이어서 끝
5. **복사 폴백 3단** — 클립보드 API → `execCommand` → **화면에 펼쳐 직접 복사**
6. **`before-work`/`after-work` 를 저장소에 넣었다** — `.claude/commands/`. 사용자
   레벨에만 있어서 이 기계에 안 따라왔던 것이다. 이제 커밋돼서 네 기계가 다 받는다
7. **레지던시 팔레트** (`engine/templates/palette-residency.json`) — 사용자가
   받아온 두 번째 세계. 3/3 통과 · 트릭 3종

### 검증한 것

| | |
|---|---|
| 삭제 | 행 10개 전수 — 앱 제공 6 + ＋ 에는 지울 자리 없음 · 생성 사건에만 있음 |
| 삭제 실행 | 사건 + **진행 저장 키** 같이 삭제 · 산장 진행은 무사 · URL 안 바뀜 |
| 단일 HTML | `file://` 에서 프롤로그→브리핑 진행 · **진행 저장됨**(768 B) · DS 적재 · 폰트·토큰 dev 서버와 동일 |
| 해시 라우팅 | `#generate` · `#case=local:…` · ←홈 — **문서 재요청 없이** 전환 |
| 제목 | 산장 ko/en · 레지던시 ko/en **네 조합 실측** |
| 복사 폴백 | 클립보드 제거 + `execCommand` 실패 조건에서 **서식 1989자 펼쳐짐** |
| 레지던시 | 장소 11곳 전부 그 세계 · **산장 기본 어휘 0** · 빈손 조사까지 |

## In Progress

없음.

## Remaining Tasks

- [ ] **🎯 진술 원문을 받는다 (사용자 손 필요)** — 세계를 **레지던시로 갈아탄다**
      (사용자가 직접 가져온 것 · `--generate 1` 이 seed 1 결정론). 브리프를 그쪽으로
      다시 써야 한다. 박물관용 초안이 `out/PROSE-REQUEST-gen-1.md` 에 있다
- [ ] **레지던시 팔레트에 `records` 8개** (사용자 손 필요) — 챗봇이 빼먹었다.
      지금 확보 단어 셋이 기본값(`출입 기록·통화 내역·남겨진 쪽지`)이라 **세계의 맛이 없다**
- [ ] **🎯 생성기에 「산문 단계」** — 1번 뒤에. ⓐ 논리를 브리프용으로 꺼내기
      ⓑ YAML 되붙이기 (ⓒ 재검증은 이미 된다)
- [ ] **`?generate` 대신 `#generate` 를 문서에 반영** — `NEXT-ACTION` 이 아직 `/?generate` 로 안내한다(쿼리 읽기는 살아 있어서 동작은 한다)
- [ ] `e_safes` · `a_ph_yuri` 의 `clues` · 색·대비·질감 · 배치 스냅 · 표기 안내 문안

## Blockers / Issues

- ⚠️ **「열리는 방식」마다 다른 것이 막힌다.** `http` 에서 되던 것이 `file://` 에서
  죽고, 거기서 되던 것이 안드로이드 `content://` 에서 또 죽었다. **경로를 새로 만드는
  행위**가 공통 원인이었다 — 지금은 만들지 않는다(해시). 클립보드는 **보안 컨텍스트**가
  없어서 막혔다. 테스터에게 보내는 것은 **폰에서 한 번 열어보기 전에는 모른다**
- ⚠️ **고치다 회귀를 두 번 냈고 둘 다 되짚어서 잡았다.** ① 리로드를 없앴더니 사건이
  안 바뀌었다(React 가 갱신만 해서 생성자가 안 돔 → `key` 로 재마운트) ② 제목 `en` 을
  무조건 덮어써서 산장 영문 제목이 뭉개졌다. **②는 07-27에 문서가 적어둔 결함의 거울상이다**
- ⚠️ **미리보기 창이 로컬 파일을 새로 안 읽는다.** 옛 스냅샷을 계속 줘서 고친 것을
  확인하려다 헛다리를 짚었다. **디스크 파일을 직접 세서** 알았다. `file://` 확인은
  dev 서버로 대신했다(라우팅 코드는 같은 소스)
- ⚠️ **문서 날짜가 하루 앞서 적혀 있었다.** 직전 세션이 「2026-07-29」로 적었는데
  **git 커밋은 전부 07-28 17시대**다. 시계 차이가 아니라 오기다. MEMORY 의
  「(2026-07-29)」 절 제목들도 같은 날이다

## Notes for Next Session

- **`before-work`/`after-work` 가 이제 슬래시 명령이다** (`.claude/commands/`).
  새 세션에서 잡힌다 — 안 잡히면 세션을 새로 연다
- **`npm run tester`** 가 테스터용 단일 HTML 을 굽는다. 항상 `out/nobody-lies-tester.html`
- **게이트는 7단이다** — `npm run build` 하나로 다 돈다
- **팔레트가 세계다.** 남는 것은 `engine/templates/palette-*.json` 이고 생성 사건은
  안 남는다. 레지던시는 `--generate N --palette templates/palette-residency.json`
- 이 저장소는 **직접 main 푸시** (feature 브랜치·PR 없음)

## Files Modified

- `app/src/App.jsx` — 홈 삭제(확인 2단) · `goRoute` 해시 · **사건 제목 배선** · 이어하기 제목
- `app/src/main.jsx` — `routeParams()`(쿼리+해시) · `hashchange` 재렌더 · **`key` 로 재마운트**
- `app/src/Generator.jsx` — 복사 폴백 3단 + 직접 복사 칸 · 「시도할 사건」 문구 · ←홈 해시
- `app/vite.single.config.ts` · `scripts/bundle-single.mjs` — **신설**. 단일 HTML 빌드
- `scripts/port-check.mjs` — `c.canDel` · `c.confirmDel` 을 `APP_ONLY` 에
- `package.json` · `app/package.json` — `tester` · `build:single`
- `.claude/commands/before-work.md` · `after-work.md` — **신설**
- `engine/templates/palette-residency.json` — **신설**
- `.gitignore` — `app/dist-single/`
