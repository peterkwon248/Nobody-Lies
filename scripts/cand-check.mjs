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
