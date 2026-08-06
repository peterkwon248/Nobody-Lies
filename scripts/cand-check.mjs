#!/usr/bin/env node
/**
 * cand-check — 공란 후보가 정답을 담고 있는가 · 사건 데이터 전역이 갈아끼워지는가
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 2026-08-06, 테스터 전찬웅이 배포본에서 잡았다: *"시각 장소 인물 다 잘못들어간듯"*.
 * `App.jsx` 의 `CAND`(닫힌 공란 후보)와 `PLACES`(수색 대상)가 **산장 리터럴인 채로
 * `applyCase` 에 안 잡혀** 있었다. 산장 아닌 사건은 **정답이 드롭다운에 없었다** —
 * 닫힌 공란 99개 중 71개(72%). 세 사건은 10/10·10/10·8/8 로 완주가 불가능했다.
 *
 * ⛔ **게이트 15단이 3주간 초록이었다.** 드롭다운 「내용물」을 재는 검사가 0이었다.
 * 이 파일이 그 자리다.
 *
 * ── 두 갈래인 이유 ────────────────────────────────────────────────────────
 * 한 갈래로는 못 막는다. 둘은 **다른 것이 깨졌을 때** 운다:
 *
 *   §1 정합(데이터)  사건 파일의 정답이 그 사건 데이터에서 도출한 후보에 있나.
 *                    → 사건 파일이 자기 밖을 가리키면 운다. 71 → 0 이 완료 판정.
 *   §2 배선(코드)    사건 데이터성 전역을 `applyCase` 가 전부 갈아끼우나.
 *                    → **`CAND` 부류가 또 생기면 운다.** §1 은 이걸 절대 못 잡는다
 *                      (사건 파일은 멀쩡한 채로 앱이 안 읽는 것이 이번 병이었다).
 *
 * ★ **검사와 수리가 같은 표현을 쓰면 사각도 같다** (`MEMORY.md` §검산) ★
 * 그래서 §2 는 **소스 텍스트**를 읽고 §1 은 **사건 JSON** 을 읽는다. 어느 쪽도
 * `App.jsx` 의 수리 코드를 불러 쓰지 않는다.
 *
 * 사용: node scripts/cand-check.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const CASE_DIR = 'app/public/cases'
const APP = 'app/src/App.jsx'

let failed = 0
const fail = (msg) => { failed++; console.error('  ⛔ ' + msg) }

/* ══════════════════════════════════════════════════════════════════════════
 *  §1 정합 — 닫힌 공란의 정답이 후보 목록에 있는가
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 후보 도출 규칙은 **사건 파일 스키마에서** 온다(앱 코드가 아니다):
 *   인물  people[].name  +  victimProfile.name        ← 피해자는 오답 후보 전용
 *   장소  locations[].label                            ← 앱 이름(`자택 (현장 밖)`)이
 *                                                         아니라 엔진 어휘여야 한다
 *   시각  slots[].label
 *
 * `candidates: 'discovered'` 는 확보 단어 풀이라 이 검사의 대상이 아니다
 * (그쪽은 처음부터 갈아끼워지고 있었다).
 */
const KIND_SRC = { 장소: 'place', 시각: 'time' } // 나머지 라벨은 전부 인물 풀이다

function poolsOf(c) {
  return {
    person: (c.people ?? []).map((p) => p.name),
    place: (c.locations ?? []).map((l) => l.label || l.id),
    time: (c.slots ?? []).map((s) => s.label || s.id),
  }
}

function answerLabel(c, label, id) {
  if (label === '장소') return c.locations?.find((l) => l.id === id)?.label ?? id
  if (label === '시각') return c.slots?.find((s) => s.id === id)?.label ?? id
  return c.people?.find((p) => p.id === id)?.name
    ?? (c.victim === id ? c.victimProfile?.name : null)
    ?? id
}

console.log('§1 정합 — 닫힌 공란의 정답이 후보에 있는가')

const files = fs.existsSync(CASE_DIR)
  ? fs.readdirSync(CASE_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()
  : []

/**
 * ⛔ **없으면 운다 — 이 세 줄이 배포를 한 번 죽였고 그게 옳았다** (2026-08-06)
 *
 * `app/public/cases/` 는 `.gitignore` 에 있고 `npm run case`(export-case)가 만든다.
 * **로컬에는 늘 있고 깨끗한 클론에는 없다** — Vercel 첫 빌드에서 0건이 됐다.
 * 게이트 순서를 고쳐(`npm run case && npm run cand-check`) 전제를 명시했다.
 *
 * ★ **이 가드가 없었으면 배포가 초록으로 지나갔다** — 검사가 0건을 재고 「통과」를
 * 인쇄했을 것이다. 이 저장소가 가장 비싸게 데인 부류(§초록인데 아무것도 안 문다)라
 * **셀 것이 없으면 통과가 아니라 실패다.**
 */
if (!files.length) {
  fail(`사건 파일이 없다 (${CASE_DIR}) — 검사가 vacuous 하다`
    + '\n       → `npm run case` 로 먼저 내보낸다 (이 디렉터리는 gitignore 산출물이다)')
}

let closedTotal = 0
let missTotal = 0

for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(CASE_DIR, f), 'utf8'))
  const pools = poolsOf(c)
  let closed = 0
  let miss = 0

  for (const ch of c.chapters ?? []) {
    for (const b of ch.blanks ?? []) {
      if (b.candidates === 'discovered') continue
      closed++
      const src = KIND_SRC[b.label] ?? 'person'
      const ans = answerLabel(c, b.label, b.answer)
      if (!pools[src].includes(ans)) {
        miss++
        fail(`${f}  ${ch.title ?? ''} [${b.label}] 정답 「${ans}」 이 ${src} 후보에 없다`
          + `\n       후보: ${pools[src].join(' · ') || '(빔)'}`)
      }
    }
  }
  /**
   * ⛔ **피해자는 인물 후보에 없어야 한다** (2026-08-06 · 경훈 확정)
   *
   * 「처음 문을 연 것은 [인물]」에 죽은 사람이 떠 있었다. 실측상 피해자가 정답인
   * 인물 공란은 **전 사건 0개**이고 오답 후보로서도 값이 0이다(누구나 즉시 배제).
   *
   * ★ **이 줄이 「규칙을 다시 열 때까지」의 계약이다** ★ 엔진은 피해자를 인물 답으로
   * 허용한다(`verifier.ts` §answerPersonIds). 그러니 앱이 안 쓰는 것은 **선언이어야
   * 하고 침묵이면 안 된다** — 되돌아오면 여기서 운다. 정말 필요해지면 위 §1 정합이
   * 먼저 exit 1 로 서므로, 그때 이 줄과 함께 연다.
   */
  if (c.victimProfile?.name && pools.person.includes(c.victimProfile.name)) {
    fail(`${f}  피해자 「${c.victimProfile.name}」 이 인물 후보에 들어 있다`
      + '\n       → 죽은 사람은 답이 될 수 없다. 여는 것이 옳다고 판단되면 이 검사도 같이 연다')
  }

  closedTotal += closed
  missTotal += miss
  console.log(`  ${miss === 0 ? '✅' : '⛔'} ${f.replace('.json', '').padEnd(22)}`
    + `닫힌 공란 ${String(closed).padStart(3)} · 정답 누락 ${miss}`
    + `   후보 ${pools.person.length}/${pools.place.length}/${pools.time.length}`)
}

console.log(`  ── 합계: 정답 누락 ${missTotal} / 닫힌 공란 ${closedTotal}`)

/* ══════════════════════════════════════════════════════════════════════════
 *  §3 관측 표면 — 파생 채널이 실제로 실려 나가나 (2026-08-06)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 테스터: *"보고서 공란을 풀 수 없다"* · *"정답을 봐도 트릭·동기 납득 안 감"*.
 * 둘 다 엔진이 **이미 계산하는데** 앱에 안 가던 것이었다 — `proveBlanks` 는
 * `proof-check` 안에서만 살고 끝났고 에필로그는 아무도 낸 적이 없다.
 *
 * ★ **값과 방어를 같이 넣는다** (§defense-ships-with-the-value) ★ `export-case` 가
 * 파생 필드를 붙이는 것은 **한 줄**이라 조용히 빠지기 쉽다. 빠지면 화면이 그냥
 * 비고, 그 비어 있음은 「데이터가 없는 사건」과 구별되지 않는다 —
 * 이 저장소가 반복해서 데인 그 모양이다.
 */
console.log('\n§3 관측 표면 — 파생 채널이 실려 나가나')

/**
 * 1막 동기 비트가 **폴백 한 줄**로 나가는 사건. 결함이 아니라 **저작 큐**다 —
 * 세 칸이 아직 안 쓰인 사건이라는 뜻이라 실패시키지 않고 **센다.**
 * ⛳ 세지 않으면 「전부 인과로 나간다」와 구별이 안 된다.
 */
const act1Fallback = []

for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(CASE_DIR, f), 'utf8'))
  const name = f.replace('.json', '')
  const problems = []

  if (!Array.isArray(c._proof) || !c._proof.length) problems.push('_proof 가 비었다')
  else {
    const closed = (c.chapters ?? []).flatMap((ch) => ch.blanks ?? []).length
    // 사슬이 걸음 없이 통째로 비면 화면에 「왜 이 답인가」가 한 줄도 안 뜬다
    if (!c._proof.some((p) => (p.steps ?? []).length)) problems.push('_proof 에 걸음이 하나도 없다')
    if (c._proof.length > closed) problems.push(`_proof ${c._proof.length} > 공란 ${closed}`)
  }

  const e = c._epilogue
  if (!e) problems.push('_epilogue 가 없다')
  else {
    if (!e.culprit?.name) problems.push('_epilogue.culprit 이 빔')
    if (!e.scene?.label) problems.push('_epilogue.scene 이 빔')
    // 인상이 하나도 없으면 「무슨 일이 있었나」가 동선 한 줄로 끝난다
    if (!(e.illusions ?? []).length && !e.exit) problems.push('_epilogue 에 트릭 재구성이 없다')
    // ⛳ 참조가 있는데 대상이 비는 부류를 여기서 문다 (이 저장소의 재발 결함)
    const dangling = [
      ...(e.illusions ?? []).flatMap((il) => [...(il.madeBy ?? []), ...(il.brokenBy ?? [])]),
      ...(e.exit ? [...(e.exit.enabledBy ?? []), ...(e.exit.brokenBy ?? [])] : []),
      ...(e.facts ?? []).flatMap((x) => x.revealedBy ?? []),
    ].filter((r) => !r.description || r.description === r.id)
    if (dangling.length) problems.push(`물증 참조 ${dangling.length}개가 이름을 못 찾았다 (${dangling.slice(0, 3).map((x) => x.id).join(' · ')})`)

    /**
     * 1막 — 그날의 재구성 (2026-08-06 · 테스터 4차 *"답만 알려주고 띡"*).
     * 문장틀이 값을 못 받으면 **빈 자리가 남은 문장**이 화면에 나간다 — 그것이
     * 가장 나쁜 꼴이라(틀렸다는 것도 안 보인다) 여기서 문다.
     */
    const a1 = e.act1
    if (!a1 || !(a1.lines ?? []).length) problems.push('_epilogue.act1 이 비었다')
    else {
      const empty = a1.lines.filter((l) => !l.ko || !l.en)
      if (empty.length) problems.push(`act1 문장 ${empty.length}개가 비었다`)
      const holes = a1.lines.filter((l) => /\{\w+/.test(l.ko) || /\{\w+/.test(l.en))
      if (holes.length) problems.push(`act1 문장 ${holes.length}개에 치환 안 된 자리가 남았다 (${holes[0].ko.slice(0, 40)})`)
      /**
       * 현장이 재구성에서 통째로 빠지면 「어디서 일어났나」를 안 말하는 해설이 된다.
       * ⛳ **두 갈래를 다 받는다** — 범인이 발견 장소에 간 사건은 `scene`,
       * 안 간 사건(`body_moved` — 시신을 옮겼다)은 `sceneMoved`. 첫 판에서 한쪽만
       * 물었다가 `gen-4` 를 거짓 실패로 잡았다. **검사가 사건 종류를 몰랐다.**
       * (2026-08-06 비트 틀 교체로 이름이 `atScene`·`moved` 에서 바뀌었다)
       */
      if (!a1.lines.some((l) => l.kind === 'scene' || l.kind === 'sceneMoved')) {
        problems.push('act1 에 현장 줄이 없다 (scene · sceneMoved 둘 다 없음)')
      }
      /**
       * ★ **범행 문장은 한 번뿐이어야 한다** ★ (2026-08-06 신설 · 실패 사례가 있다)
       *
       * 옛 틀은 범인이 현장에 머무는 **칸마다** 「사건은 여기서 일어났다」를 붙였고,
       * 산장이 두 칸 머물러서 **두 번** 말했다(`ACT1-MEASUREMENT.md` §1). 범행 시각은
       * 거짓말이 난 칸 하나다. 새 틀은 비트4 안에서 한 번만 내는데, **그 성질을
       * 검사가 물지 않으면 다음 개편에서 조용히 돌아온다.**
       */
      const murders = a1.lines.filter((l) => l.kind === 'murder' || l.kind === 'murderMoved').length
      if (murders > 1) problems.push(`act1 범행 문장이 ${murders}번 — lie.slot 한 칸이어야 한다`)
      /**
       * 동기 비트가 통째로 빠지면 코다가 없다. 세 칸이 있든(`motive`) 없든
       * (`motiveShort`) **둘 중 하나는 나가야 한다** — `f_motive` 는 14/14 다.
       */
      if (!a1.lines.some((l) => l.kind === 'motive' || l.kind === 'motiveShort')) {
        problems.push('act1 에 동기 줄이 없다 (motive · motiveShort 둘 다 없음)')
      }
      if (a1.lines.some((l) => l.kind === 'motiveShort')) act1Fallback.push(name)
    }
  }

  /**
   * 3막 — 모범 수사 경로 (`_oraclePath`).
   *
   * ⛔ **`simulate()` 로 만들면 안 된다** — 그쪽은 salience 내림차순 탐욕 플레이어라
   * 미끼를 먼저 밟는다. 여기서 무는 것은 **조사 수가 오라클(`_oracle`)과 같은가**다:
   * 다르면 다른 경로를 「모범」이라 부르고 있다는 뜻이다.
   */
  const op = c._oraclePath
  if (!op) problems.push('_oraclePath 가 없다')
  else if (op.size >= 0) {
    const acted = (op.stages ?? []).reduce((n, s) => n + (s.actions ?? []).length, 0)
    if (!acted) problems.push('_oraclePath 에 조사가 하나도 없다')
    if (typeof c._oracle === 'number' && op.size !== c._oracle) {
      problems.push(`_oraclePath.size(${op.size}) 가 _oracle(${c._oracle}) 과 다르다 — 다른 경로를 모범이라 부르고 있다`)
    }
  }

  if (problems.length) for (const p of problems) fail(`${f}  ${p}`)
  else {
    console.log(`  ✅ ${name.padEnd(22)}_proof ${String(c._proof.length).padStart(2)}건`
      + ` · 걸음 ${c._proof.reduce((n, p) => n + (p.steps?.length ?? 0), 0)}`
      + ` · 인상 ${(e.illusions ?? []).length} · 사실 ${(e.facts ?? []).length}`
      + ` · 거짓말 ${e.lie ? e.lie.slotLabel : '(없음)'}`)
  }
}

console.log(`  ── 1막 동기: 인과 ${files.length - act1Fallback.length}건 · 폴백 ${act1Fallback.length}건`
  + (act1Fallback.length ? `  (${act1Fallback.join(' · ')} — 세 칸 미저작)` : ''))

/* ══════════════════════════════════════════════════════════════════════════
 *  §2 배선 — 사건 데이터성 전역을 `applyCase` 가 갈아끼우나
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `App.jsx` 의 대문자 클래스 필드를 전부 세고, `applyCase` 안에서 다시 만들어지지
 * 않는 것을 고른다. 그 차집합은 **아래 목록에 이유와 함께 등재돼야 한다.**
 *
 * ⛳ **목록에 없으면 exit 1 이다** — 새 전역을 사건 데이터로 채우면서 `applyCase`
 * 를 안 고치면 여기서 걸린다. 그것이 2026-07-26부터 3주를 산 병이었다.
 * `port-check` 의 REMOVED 목록과 같은 규약이다(침묵이 아니라 선언).
 */
const CASE_INDEPENDENT = {
  DICT: 'i18n 사전. 사건과 무관하다',
  ICONS: '단어 아이콘 경로. 사건과 무관하다',
  INV_ACTIONS: '조사 종류(소지품·수색·통화…)의 구조. 값은 사건이 안 정한다',
  CASES: '홈 캠페인 목록 자체. `applyCatalog` 가 index.json 에서 따로 만든다',
  SAVE_VERSION: '저장 스키마 버전',
  SAVED: '저장 필드 목록',
  SAVE_READABLE: '읽을 수 있는 저장 버전',
  PLAN_ZOOM_MIN: '평면도 확대 하한 상수',
  PLAN_ZOOM_MAX: '평면도 확대 상한 상수',
  // ── 판정해서 남긴 것 둘 (2026-08-06 전수 감사) ──────────────────────────
  HLWORDS:
    '⚠ 산장 어휘인데 **읽는 곳이 0이다**(전수 grep). 죽은 값이라 누설이 불가능해 '
    + 'CAND 부류가 아니다. 삭제는 이번 P0 범위 밖 — 백로그',
  REVEAL_TARGET_LABELS:
    '⚠ 산장 키 하나(`search:annex`)뿐이고 다른 사건은 **원본 키로 폴백**한다'
    + '(화면에 `search:piano` 가 뜬다). 어긋남이지만 정답을 막지 않아 P0 아님 — 백로그',
}

console.log('\n§2 배선 — 사건 데이터성 전역을 applyCase 가 갈아끼우는가')

const src = fs.readFileSync(APP, 'utf8')
const L = src.split('\n')

const start = L.findIndex((l) => /^ {2}applyCase\(/.test(l))
if (start < 0) fail('`applyCase` 를 못 찾았다 — 이 검사가 vacuous 하다')

let depth = 0
let end = -1
for (let i = start; i < L.length && start >= 0; i++) {
  const s = L[i]
    .replace(/'(\\.|[^'\\])*'/g, "''")
    .replace(/"(\\.|[^"\\])*"/g, '""')
    .replace(/`(\\.|[^`\\])*`/g, '``')
    .replace(/\/\/.*$/, '')
  for (const ch of s) {
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end >= 0) break
}
if (end < 0) fail('`applyCase` 의 끝을 못 찾았다 — 이 검사가 vacuous 하다')

const body = L.slice(start, end + 1).join('\n')
/**
 * 대입(`this.X =`)과 **속성 채우기**(`this.X[k] =`) 둘 다 「다시 만든다」로 센다.
 * `TERM_INFO` 가 후자다 — 대입만 세면 멀쩡한 것을 결함으로 부른다.
 *
 * ⛔ **`this.X[` 까지만 보면 안 된다 — 읽기가 섞인다.** 첫 판에서 그렇게 썼더니
 * `this.ICONS[t.word]`(읽기)가 「다시 만듦」으로 세어져 `ICONS` 가 목록에서 사라졌다.
 * 그 규칙이면 **`this.CAND[def.src]` 같은 읽기 한 줄이 이 검사를 통째로 무력화한다.**
 * 뒤에 `=` 가 붙은 것만 센다. (내 계수기도 시험 대상이다 — §measurement-code-is-suspect)
 */
const rebuilt = new Set()
for (const m of body.matchAll(/this\.([A-Z][A-Z_0-9]*)\s*(?:=(?!=)|\[[^\]]*\]\s*=(?!=))/g)) {
  rebuilt.add(m[1])
}

const declared = []
for (let i = 0; i < L.length; i++) {
  if (start >= 0 && i >= start && i <= end) continue
  const m = L[i].match(/^ {2}([A-Z][A-Z_0-9]*)\s*=(?!=)/)
  if (m) declared.push({ name: m[1], line: i + 1 })
}

const unrebuilt = declared.filter((d) => !rebuilt.has(d.name))
const undeclaredExempt = Object.keys(CASE_INDEPENDENT)
  .filter((n) => !declared.some((d) => d.name === n))

console.log(`  대문자 필드 ${declared.length} · applyCase 가 다시 만드는 것 ${rebuilt.size}`)

for (const d of unrebuilt) {
  if (CASE_INDEPENDENT[d.name]) {
    console.log(`  ▫ ${d.name.padEnd(22)}면제 — ${CASE_INDEPENDENT[d.name].slice(0, 60)}`)
  } else {
    fail(`${APP}:${d.line}  \`${d.name}\` 이 applyCase 에서 안 갈아끼워지는데 면제 목록에도 없다`
      + '\n       → 사건 데이터면 applyCase 끝에서 다시 만들고, 아니면 CASE_INDEPENDENT 에 이유를 적는다')
  }
}

// 목록이 낡는 것도 침묵이다 — 없어진 이름이 면제 목록에 남아 있으면 운다
for (const n of undeclaredExempt) {
  fail(`면제 목록의 \`${n}\` 이 ${APP} 에 없다 — 사라진 전역이 목록에 남았다`)
}

// ★ 이번에 고친 둘은 이름으로 못 박는다. 면제 목록으로 「해결」될 수 없게 한다
for (const n of ['CAND', 'PLACES']) {
  if (!rebuilt.has(n)) {
    fail(`\`${n}\` 이 applyCase 에서 다시 만들어지지 않는다`
      + ' — 2026-08-06 에 고친 자리다(테스터가 잡은 그 병). 되돌리면 안 된다')
  }
  if (CASE_INDEPENDENT[n]) fail(`\`${n}\` 은 면제 대상이 아니다 — 사건 데이터다`)
}

console.log('')
if (failed) {
  console.error(`⛔ cand-check 실패 — ${failed}건`)
  process.exit(1)
}
console.log(`✅ cand-check 통과 — 정합 ${closedTotal}/${closedTotal} · 배선 CAND·PLACES 확인`)
