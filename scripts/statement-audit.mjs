/**
 * ─────────────────────────────────────────────────────────────────────
 *  statement-audit — 진술이 「인물의 말」인가 「격자의 낭독」인가를 잰다
 * ─────────────────────────────────────────────────────────────────────
 *
 * `docs/STATEMENT-MEASUREMENT.md` §1~§3 의 표를 **다시 뽑는 도구**다.
 *
 * ⛔ **왜 새로 짓나** — 그 문서의 수치는 2026-08-06에 손으로/일회용 코드로 쟀고
 * **계수기가 커밋되지 않았다**(`3fbc6f6` 은 docs 두 개뿐이다). 다시 잴 방법이 없으면
 * 수리 뒤 「47% → 몇 %」를 말할 수 없다. §measurement-code-is-suspect —
 * **도구도 커밋한다.**
 *
 * ★ **골든 대조가 이 파일의 신뢰도다** — `--golden` 을 주면 §1 표의 값과 대본다.
 * 내 계수기가 그 표를 재현하지 못하면 **수리 전에 계수기부터 틀린 것**이다.
 *
 * ```
 * node scripts/statement-audit.mjs            전 사건 표
 * node scripts/statement-audit.mjs --golden   §1 표와 대조 (어긋나면 exit 1)
 * node scripts/statement-audit.mjs --full     진술 전문까지 인쇄
 * ```
 *
 * 전제: `app/public/cases/*.json` (= `npm run case` 산출물 · `.gitignore:22`).
 * 없으면 **통과가 아니라 실패**다 — `cand-check` 와 같은 가드다.
 */
import fs from 'node:fs'
import path from 'node:path'

const CASE_DIR = 'app/public/cases'
const GOLDEN_MODE = process.argv.includes('--golden')
const FULL = process.argv.includes('--full')

/**
 * §1 표 (`docs/STATEMENT-MEASUREMENT.md` · 2026-08-06 인쇄값).
 *
 * `gen-*` 은 표가 「gen-1 ~ gen-6 / 15 / 7 / 3~5×」로 묶어놨으므로 범위로 받는다.
 * ⚠ **이 값은 수리 «전» 이다.** 수리 후에는 당연히 어긋난다 — 그때는 `--golden` 을
 * 빼고 돌리고, 새 값을 문서 §after 로 옮긴다.
 */
const GOLDEN = {
  'natural-history-museum': { paras: 15, dup: 7, max: 5 },
  'closing-theater': { paras: 15, dup: 0, max: 1 },
  'mountain-lodge': { paras: 12, dup: 0, max: 1 },
  'pipe-organ-workshop': { paras: 15, dup: 0, max: 1 },
  'practice-room': { paras: 19, dup: 0, max: 1 },
}
const GOLDEN_GEN = { paras: 15, dup: 7, maxMin: 3, maxMax: 5 }

let failed = 0
const fail = (m) => { console.error(`  ⛔ ${m}`); failed++ }

if (!fs.existsSync(CASE_DIR)) {
  console.error(`\n⛔ ${CASE_DIR} 이 없다 — \`npm run case\` 로 먼저 내보낸다\n`)
  process.exit(1)
}
const files = fs.readdirSync(CASE_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()
if (!files.length) {
  console.error(`\n⛔ 사건 파일이 0건 — 검사가 vacuous 하다\n`)
  process.exit(1)
}

/**
 * 「성을 뗀 꼴」 — `proof.ts` R3 이 산문에서 인물을 찾을 때 쓰는 규약과 같게 맞춘다.
 *
 * ⚠ **이 줄이 §3 에서 한 번 0을 인쇄했다.** 이름 정확 일치로만 세면 연습실의
 * 「즈안」·「리솔」(성을 뗀 애칭)을 못 봐서 **손저작도 「타인 언급 0」**이 된다.
 * 실제는 22다. 계수기가 규약을 안 따른 것이었다.
 */
const shortName = (n) => (n.length >= 3 ? n.slice(-2) : n)

const rows = []

for (const f of files) {
  const id = path.basename(f, '.json')
  const c = JSON.parse(fs.readFileSync(path.join(CASE_DIR, f), 'utf8'))
  const people = c.people ?? []
  if (!people.length) { fail(`${id} — people 이 비었다`); continue }

  /** 문단 = §1 의 「문장」 단위다. 축의 칸마다 한 문단이라 5인 × 칸 수가 기본값이다. */
  const paras = []
  for (const p of people) for (const g of p.statement?.paragraphs ?? []) paras.push({ who: p.id, ko: (g.ko ?? '').trim() })

  /** 완전일치 = **다른 사람과 글자까지 같은** 문단. 등장 횟수를 전부 센다(2회면 2). */
  const tally = new Map()
  for (const g of paras) tally.set(g.ko, (tally.get(g.ko) ?? 0) + 1)
  const dup = [...tally.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...tally.values())
  const worst = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]

  /**
   * 분량 — 사람마다 문단 ko 를 이어붙인 글자 수. 지문(gesture)은 뺀다.
   *
   * ⚠ **구분자 없이 잇는다.** 첫 판에서 `join(' ')` 을 썼더니 문서 §2 보다 **정확히
   * +2**(문단 3개 → 공백 2개)가 나왔다 — 최대 514 대 512 · 최소 167 대 165 ·
   * gen-1 이 전부 +2. **작은 어긋남이 계수기를 잡아준 자리다**: 그대로 뒀으면
   * 수리 후 「분량 회복」에 상수 2가 섞여 들어간다.
   */
  const chars = people.map((p) => (p.statement?.paragraphs ?? []).map((g) => g.ko ?? '').join('').length)
  const sorted = [...chars].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0

  const paraCounts = people.map((p) => (p.statement?.paragraphs ?? []).length)
  const voiceFilled = people.filter((p) => p.statement?.voice).length

  /**
   * 타인 언급 — 말하는 사람 자신은 뺀다.
   *
   * ⛳ **문서 §3 의 「22」는 «용의자 또는 피해자» 를 부른 문단의 합집합이다** (실측으로
   * 확정). 용의자만 세면 19, 언급 «개수»로 세면 25, 합집합이 정확히 22 다.
   * 의미로도 그쪽이 맞다 — 산장에서 피해자를 「언니」로 부르는 문단은 좌표가 아니라
   * **관계**를 말하는 문단이다. 그래서 `relParas`(합집합)가 정본 지표고
   * 아래 둘은 갈라 보기용이다.
   */
  const names = people.map((p) => ({ id: p.id, full: p.name, short: shortName(p.name) }))
  const victimName = c.victimProfile?.name
  let othersParas = 0
  let victimParas = 0
  let relParas = 0
  for (const g of paras) {
    const hitsOther = names.some((n) => n.id !== g.who && (g.ko.includes(n.full) || g.ko.includes(n.short)))
    const hitsVictim = !!victimName && (g.ko.includes(victimName) || g.ko.includes(shortName(victimName)))
    if (hitsOther) othersParas++
    if (hitsVictim) victimParas++
    if (hitsOther || hitsVictim) relParas++
  }

  rows.push({ id, paras: paras.length, dup, max, worst, median, min: sorted[0] ?? 0,
    max_chars: sorted[sorted.length - 1] ?? 0, charsAll: chars, paraCounts, voiceFilled,
    n: people.length, othersParas, victimParas, relParas })

  if (FULL) {
    console.log(`\n◆◆ ${id}  (범인 ${c.culprit})`)
    for (const p of people) {
      console.log(`\n  ◆ ${p.name} (${p.age} · ${p.job})${p.id === c.culprit ? '  ← 범인' : ''}`)
      if (p.statement?.voice) console.log(`     voice: ${p.statement.voice}`)
      console.log(`     〔${p.statement?.gesture?.pre?.ko ?? ''}〕`)
      for (const g of p.statement?.paragraphs ?? []) console.log(`     ${g.ko}`)
      console.log(`     〔${p.statement?.gesture?.post?.ko ?? ''}〕`)
    }
  }
}

console.log('\n§1 인물 간 문단 복제')
console.log('  사건                       문단  복제   %   최다반복  voice')
for (const r of rows) {
  const pct = r.paras ? Math.round((r.dup / r.paras) * 100) : 0
  const flag = r.dup === 0 ? '✅' : r.dup / r.paras >= 0.3 ? '⛔' : '⚠ '
  console.log(`  ${flag} ${r.id.padEnd(24)}${String(r.paras).padStart(4)}${String(r.dup).padStart(5)}`
    + `${String(pct + '%').padStart(6)}${String(r.max + '×').padStart(8)}   ${r.voiceFilled}/${r.n}`)
}

console.log('\n§2 분량 (사람별 문단 글자 수 합)')
console.log('  사건                       중앙   최소   최대   문단수')
for (const r of rows) {
  const uneven = new Set(r.paraCounts).size > 1
  console.log(`  ${uneven ? '⛔' : '  '} ${r.id.padEnd(24)}${String(r.median).padStart(5)}`
    + `${String(r.min).padStart(7)}${String(r.max_chars).padStart(7)}   ${r.paraCounts.join('·')}`
    + (uneven ? '  ← 문단 수가 사람마다 다르다 (§9-9 길이 쏠림)' : ''))
}

console.log('\n§3 진술이 만지는 재료 (관계 = 용의자 ∪ 피해자를 부른 문단)')
console.log('  사건                       관계  ├용의자  └피해자')
for (const r of rows) {
  console.log(`  ${r.relParas ? '  ' : '⛔'} ${r.id.padEnd(24)}${String(r.relParas).padStart(4)}`
    + `${String(r.othersParas).padStart(8)}${String(r.victimParas).padStart(9)}`)
}

/**
 * ⛔ **`natural-history-museum` 은 「생성」쪽이다** — 커밋된 YAML 이지만 **생성기가
 * 만든 첫 사건**이다(`1e95c86` · 씨앋 14). 첫 판에서 「id 가 `gen-N` 이 아니면 손저작」
 * 으로 갈랐더니 **손저작 복제가 7/76 으로 인쇄됐다** — 실제 손저작은 0 이고 그 7은
 * 전부 미술관 것이었다. 문서 §2 도 생성 n=35(= 6×5 + 미술관 5)로 세고 있다.
 * **한 줄 오분류가 「손저작도 복제가 있다」는 거짓을 인쇄할 뻔했다.**
 */
const isGenerated = (id) => /^gen-\d+$/.test(id) || id === 'natural-history-museum'
const gen = rows.filter((r) => isGenerated(r.id))
const hand = rows.filter((r) => !isGenerated(r.id))
/**
 * 중앙값 — **짝수 표본은 가운데 둘의 평균**이다 (그리고 반올림한다).
 *
 * ⚠ 첫 판은 `s[floor(n/2)]` 였고 손저작 n=20 에서 **298** 을 인쇄했다. 문서는 296 이다 —
 * 가운데 둘이 294·298 이라 **평균이 정본**이었다. 생성도 63·64 → 63.5 → 64 로 문서와 맞는다.
 * **한 칸 어긋난 관습이 「분량이 회복됐다」를 2씩 부풀릴 자리였다.**
 */
const med = (a) => {
  const s = [...a].sort((x, y) => x - y)
  if (!s.length) return 0
  const i = s.length / 2
  return s.length % 2 ? s[Math.floor(i)] : Math.round((s[i - 1] + s[i]) / 2)
}
/** 풀링 — 문서 §2 는 «사건별 중앙의 중앙»이 아니라 **진술 전체(n=20 · n=35)의 중앙**이다. */
const pool = (rs) => rs.flatMap((r) => r.charsAll)
const summarize = (label, rs) => {
  const p = pool(rs)
  const s = [...p].sort((a, b) => a - b)
  console.log(`  ${label} ${rs.length}건 · 진술 ${p.length}   복제 ${rs.reduce((a, r) => a + r.dup, 0)}/${rs.reduce((a, r) => a + r.paras, 0)}`
    + `   분량 중앙 ${med(p)} (${s[0] ?? 0}~${s[s.length - 1] ?? 0})`
    + `   voice ${rs.reduce((a, r) => a + r.voiceFilled, 0)}/${rs.reduce((a, r) => a + r.n, 0)}`
    + `   관계언급 ${rs.reduce((a, r) => a + r.relParas, 0)}`)
}
console.log('\n── 결산 ──')
summarize('생성  ', gen)
summarize('  ├gen', gen.filter((r) => /^gen-\d+$/.test(r.id)))
summarize('  └박물', gen.filter((r) => r.id === 'natural-history-museum'))
summarize('손저작', hand)
if (rows.some((r) => r.dup > 0)) {
  const w = rows.filter((r) => r.dup > 0).sort((a, b) => b.max - a.max)[0]
  console.log(`  최악  ${w.id}  「${w.worst[0].slice(0, 44)}」 ${w.worst[1]}×`)
}

if (GOLDEN_MODE) {
  console.log('\n── §1 골든 대조 (수리 «전» 값이다) ──')
  for (const r of rows) {
    const g = /^gen-\d+$/.test(r.id) ? null : GOLDEN[r.id]
    if (g) {
      if (r.paras !== g.paras) fail(`${r.id} 문단 ${r.paras} ≠ 골든 ${g.paras}`)
      if (r.dup !== g.dup) fail(`${r.id} 복제 ${r.dup} ≠ 골든 ${g.dup}`)
      if (r.max !== g.max) fail(`${r.id} 최다반복 ${r.max} ≠ 골든 ${g.max}`)
    } else if (/^gen-\d+$/.test(r.id)) {
      if (r.paras !== GOLDEN_GEN.paras) fail(`${r.id} 문단 ${r.paras} ≠ 골든 ${GOLDEN_GEN.paras}`)
      if (r.dup !== GOLDEN_GEN.dup) fail(`${r.id} 복제 ${r.dup} ≠ 골든 ${GOLDEN_GEN.dup}`)
      if (r.max < GOLDEN_GEN.maxMin || r.max > GOLDEN_GEN.maxMax) {
        fail(`${r.id} 최다반복 ${r.max} 이 골든 범위 ${GOLDEN_GEN.maxMin}~${GOLDEN_GEN.maxMax} 밖`)
      }
    } else {
      console.log(`  ▫ ${r.id} — 골든에 없다 (새 사건). 대조 생략`)
    }
  }
  /**
   * §2 풀링 골든 — **여기가 계수기를 잡은 자리다.** `join(' ')` 이었을 때 넷이 전부
   * +2 로 어긋났고, 그 어긋남이 구분자를 알려줬다. 그러니 이 대조를 남겨둔다.
   */
  /**
   * ⛔ **문서 §2 의 「생성 n=35」 행은 실은 gen-1~6 (n=30) 만 잰 값이다** (실측 확정).
   * `52 · 83 · 64` 는 gen-only 와 **글자까지 맞고**, 미술관 5편은 **80~110** 이라
   * 넣었으면 최대가 110 이 된다. 문서가 *"natural-history-museum (같은 대역)"* 이라
   * 적은 것도 틀렸다 — 슬롯 라벨이 길고(「다음 날 개관 직전」) `far` 꼬리가 붙어
   * **이미 gen 보다 ~30% 길다.** 그래서 골든을 **gen-only 로 걸고** 미술관은 따로 잰다.
   */
  const G2 = {
    gen: { n: 30, median: 64, min: 52, max: 83 },
    손저작: { n: 20, median: 296, min: 165, max: 512 },
  }
  const genOnly = gen.filter((r) => /^gen-\d+$/.test(r.id))
  for (const [label, rs] of [['gen', genOnly], ['손저작', hand]]) {
    const p = pool(rs)
    const s = [...p].sort((a, b) => a - b)
    const g = G2[label]
    if (p.length !== g.n) fail(`§2 ${label} 진술 수 ${p.length} ≠ 골든 ${g.n}`)
    if (med(p) !== g.median) fail(`§2 ${label} 분량 중앙 ${med(p)} ≠ 골든 ${g.median}`)
    if ((s[0] ?? 0) !== g.min) fail(`§2 ${label} 최소 ${s[0]} ≠ 골든 ${g.min}`)
    if ((s[s.length - 1] ?? 0) !== g.max) fail(`§2 ${label} 최대 ${s[s.length - 1]} ≠ 골든 ${g.max}`)
  }
  /** §3 — 관계 언급(용의자 ∪ 피해자). 「성 뗀 꼴」을 안 보면 손저작이 0 으로 인쇄된다. */
  const g3 = { 생성: 0, 손저작: 22 }
  for (const [label, rs] of [['생성', gen], ['손저작', hand]]) {
    const got = rs.reduce((a, r) => a + r.relParas, 0)
    if (got !== g3[label]) fail(`§3 ${label} 관계 언급 ${got} ≠ 골든 ${g3[label]}`)
  }
  if (!failed) console.log('  ✅ §1·§2·§3 표를 재현했다 — 계수기가 문서와 같은 것을 센다')
}

if (failed) { console.error(`\n⛔ statement-audit — ${failed}건 어긋남\n`); process.exit(1) }
console.log('')
