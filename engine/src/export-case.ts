import { writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { loadCaseFile } from './load-case.js'
import { verify } from './verifier.js'
import { emitDerived } from './emit-derived.js'

/**
 * 사건 YAML → 정적 JSON.
 *
 * `Case` 가 불변이라는 것이 이 프로젝트의 인프라 전략 전체를 결정한다
 * (`HANDOFF-TO-CODE.md` §1) — 사건 파일이 정적이므로 서버 없이 CDN 에 올려두면 되고
 * 협동 모드 전까지 서버가 거의 필요 없다. 이 스크립트가 그 첫 조각이다.
 *
 * **검증을 통과하지 못한 사건은 방출하지 않는다.** 앱이 논리적으로 성립하지 않는
 * 사건을 로드하는 일이 없어야 한다 — 빌드에서 막는 것이 런타임에 발견하는 것보다 싸다.
 *
 * tsx src/export-case.ts                    cases/*.yaml **전건**
 * tsx src/export-case.ts <입력.yaml> [출력.json]   하나만
 *
 * ★ 인자가 없으면 전건이다 ★ (2026-07-31)
 *
 * 전에는 기본값이 `cases/mountain-lodge.yaml` **하나로 하드코딩**돼 있었다. 사건이
 * 넷이 된 뒤에도 그대로라 **빌드가 산장만 내보냈다** — `app/public/cases/` 는
 * gitignore 라서 깨끗한 체크아웃에는 그 하나뿐이고, 그래서 **Vercel 배포본에도
 * 산장만 있었다.** 커밋된 캠페인 셋이 있는데 아무도 열 수 없었다.
 *
 * 파일명이 곧 주소다 — `cases/practice-room.yaml` → `#case=practice-room`.
 * (전건 확인함: 네 사건 모두 `id` 가 파일명과 같다)
 */

const CASE_DIR = 'cases'
const OUT_DIR = join('..', 'app', 'public', 'cases')
const outFor = (yamlPath: string) => join(OUT_DIR, `${basename(yamlPath, '.yaml')}.json`)

const argIn = process.argv[2]
const jobs = argIn
  ? [{ input: argIn, output: process.argv[3] ?? outFor(argIn) }]
  : readdirSync(CASE_DIR)
      .filter((f) => f.endsWith('.yaml'))
      .sort()
      .map((f) => ({ input: join(CASE_DIR, f), output: outFor(f) }))

/**
 * 홈 목록이 읽을 목록. 전건 방출일 때만 쓴다.
 *
 * `blanks` 는 **그 사건의 공란 총수**다 (2026-08-01). 홈이 「이 사건을 끝냈나」를
 * 물으려면 대조할 수가 있어야 하는데, 앱의 `allSealed()` 가 세는 것이 정확히
 * 이것이다 — 저장의 `blanks` 는 **채운 것만** 담으므로 둘이 같으면 다 채운 것이다.
 * `chapters` 로는 못 센다. 저장의 `solved` 는 「한 번 봉했나」라 공란을 지워도
 * 안 꺼져서 `allSealed()` 와 어긋난다.
 */
type CatalogEntry = { id: string; title: string; diff: string; chapters: number; blanks: number; oracle: number }
const catalog: CatalogEntry[] = []

let failed = 0
for (const { input, output } of jobs) {
  let c
  try {
    c = loadCaseFile(input)
  } catch (e) {
    console.error(`\n  ${(e as Error).message}\n`)
    failed++
    continue
  }

  // **검증을 통과하지 못한 사건은 방출하지 않는다** — 전건이 되어도 이 규칙은 같다.
  // 다만 하나가 떨어져도 나머지는 계속 내보내고, 마지막에 exit 1 로 빌드를 막는다
  const r = verify(c)
  if (!r.ok) {
    console.error(`\n  ${input} — 검증 실패. 방출하지 않는다.`)
    r.errors.forEach((e) => console.error(`   x ${e}`))
    console.error('')
    failed++
    continue
  }

  /**
   * ★ 난이도를 실어 보낸다 ★ (2026-07-31)
   *
   * 앱이 난이도 배지를 **`hard` 리터럴로** 그리고 있었다(`App.jsx` §sBadge). 사건
   * 넷 중 셋이 우연히 hard 라서 안 걸렸고, `pipe-organ-workshop`(normal)에서 드러났다.
   * **화면이 사건에 대해 거짓을 말하고 있었다.**
   *
   * 난이도는 `verify` 가 예산과 최소 조사 수로 **계산하는 값**이라 사건 파일에 없다.
   * 앱에서 다시 계산하면 같은 규칙이 두 벌이 되므로(2026-07-24에 14곳 어긋난 그 부류)
   * **여기서 계산해 실어 보낸다.**
   *
   * `_` 접두는 이 저장소의 규약이다 — 「앱이 표시용으로 붙인 것이지 사건이 아니다」.
   * `caseYaml` 의 왕복 대조가 `_` 로 시작하는 키를 걷어내므로 **내보내기도 안 깨진다.**
   *
   * ⛳ **2026-08-06에 파생 필드가 넷이 되면서 `emit-derived.ts` 로 옮겼다** —
   * `_difficulty`·`_oracle` 에 `_proof`(증명 사슬)·`_epilogue`(트릭 재구성)가 붙었다.
   * **나가는 문이 둘이라서**다(여기 · `cli.ts --emit`). 여기만 고쳤다가 생성 사건의
   * 해설이 빌 뻔했고 `cand-check §3` 이 잡았다. 근거는 그 파일에 적혀 있다.
   */
  const emitted = emitDerived(c, r)

  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify(emitted, null, 2), 'utf8')

  // `Case['title']` 은 `string` 이다(`types.ts:645`) — `Text`(ko/en) 가 아니다.
  // 처음에 `c.title?.ko` 폴백을 달았다가 **타입체크가 잡았다**(`never` 에는 `.ko` 가 없다).
  // 없는 갈래를 방어하면 코드가 는 게 아니라 거짓이 는다
  catalog.push({
    id: basename(input, '.yaml'),
    title: c.title,
    diff: r.difficulty,
    chapters: c.chapters?.length ?? 0,
    blanks: (c.chapters ?? []).reduce((n, ch) => n + (ch.blanks?.length ?? 0), 0),
    oracle: r.minActions,
  })

  /**
   * ⛔ **`c` 가 아니라 `emitted` 를 잰다** (2026-08-06 정정). 전에는 파생 필드를
   * 붙이기 **전**을 재서, `_proof`·`_epilogue` 를 실어 보낸 뒤에도 인쇄가 옛 숫자를
   * 그대로 냈다(24.6KB ↔ 실물 31.3KB). **나가는 것을 재야 나가는 것을 안다.**
   */
  const bytes = JSON.stringify(emitted).length
  console.log(`  ${input} → ${output}  (${(bytes / 1024).toFixed(1)} KB · ${r.difficulty})`)
  if (r.warnings.length) r.warnings.forEach((w) => console.log(`   ! ${w}`))
}

/**
 * ★ 홈 목록을 파일에서 자라게 한다 ★ (2026-07-31)
 *
 * `App.jsx` 의 홈 목록이 **여섯 줄 하드코딩**이었다 — 산장 하나만 `real: true` 이고
 * 나머지 다섯은 `사건 02`·「준비 중」 껍데기다. 그래서 커밋된 캠페인이 넷이 돼도
 * **테스터는 홈에서 산장 하나만 본다.** 오늘 `bundle-single.mjs` 에서 잡은 것과
 * **같은 부류**다: 목록을 사람이 손으로 늘리게 두면 사람이 잊는다.
 *
 * ⚠ **하나만 내보낼 때는 안 쓴다.** 그러면 1건짜리 목록이 전건 목록을 덮어써서
 * 홈에서 나머지가 사라진다 — 「부분 산출물이 전체를 덮는다」 부류를 만들지 않는다.
 *
 * 정렬은 **장 수 오름차순 · 동률이면 id**. 짧은 사건이 먼저 오는 것이 처음 노는
 * 사람에게 낫다(3장은 최소 4회 조사, 8장은 9회). 규칙이지 취향이 아니게 하려고
 * 적어둔다 — 바꾸려면 여기 한 줄이다.
 */
if (!argIn) {
  catalog.sort((a, b) => a.chapters - b.chapters || (a.id < b.id ? -1 : 1))
  const index = join(OUT_DIR, 'index.json')
  writeFileSync(index, JSON.stringify(catalog, null, 2), 'utf8')
  console.log(`\n  ${index}  — 홈 목록 ${catalog.length}건 · ${catalog.map((c) => c.id).join(' · ')}`)
}

if (failed) process.exit(1)
