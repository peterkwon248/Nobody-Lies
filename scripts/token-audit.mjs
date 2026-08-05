/**
 * ─────────────────────────────────────────────────────────────
 *  축5 토큰 규율 — 정적 전수 (2026-08-05)
 * ─────────────────────────────────────────────────────────────
 *
 * `docs/DESIGN-AUDIT-SPEC.md` §1 축5. **파일:줄 단위로 전수**한다.
 *
 * ★ 왜 이 축이 먼저인가 ★ 지시서가 *"이 축이 도시에 스킨의 선행 조건"* 이라고
 * 못박았다 — **하드코딩이 박힌 자리는 `--game-*` 폴백을 끼울 토큰 자리가 없다.**
 * 스킨 지시서 §7 이 「멈추고 물어볼 것」으로 예고한 그 목록을 여기서 미리 만든다.
 *
 *   node scripts/token-audit.mjs            요약
 *   node scripts/token-audit.mjs --full     전체 목록
 *
 * ⛔ 측정만이다. 아무것도 안 고친다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve('app/src')
const FULL = process.argv.includes('--full')
const OUT = resolve('docs/audit-tokens.json')

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
}).filter((p) => /\.(jsx?|css)$/.test(p))

/** 주석 줄은 빼고 센다 — 「설명하려고 적은 hex」를 결함으로 세면 인쇄가 거짓말이 된다 */
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line)

const files = walk(ROOT)
const hits = { hex: [], hexFallback: [], rgba: [], stroke: [], spacing: [], media: [], inline: [] }
let inlineStyleCalls = 0

for (const f of files) {
  const rel = relative(process.cwd(), f).replace(/\\/g, '/')
  const src = readFileSync(f, 'utf8')
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    const n = i + 1
    const at = (extra) => ({ file: rel, line: n, text: line.trim().slice(0, 110), ...extra })
    if (isComment(line)) return

    // 하드코딩 색 — CSS 변수 정의(`--x: #hex`)는 **정당한 토큰 자리**라 뺀다
    const isTokenDef = /^\s*--[\w-]+\s*:/.test(line)
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      if (isTokenDef) continue
      if (/id=|href=|url\(#|fpHatch|#root/.test(line)) continue   // SVG 참조·앵커는 색이 아니다
      /**
       * ⛔ **`var(--토큰, #폴백)` 의 폴백 자리도 뺀다 (2026-08-06).**
       *
       * 이걸 안 빼서 **100건 중 74건을 잘못 셌다.** `Generator.jsx` 가 76건으로
       * 「전체의 76%」를 차지해 **스킨 배치의 범위 판단이 통째로 그 수 위에 서 있었다**
       * (*"Generator 가 개발 도구면 범위가 확 좁아진다"*). 실제로는 정반대다 —
       * 74건이 이미 `var(--fg-3, #8b93a1)` 꼴이라 **앱에서 가장 잘 토큰화된 파일**이고,
       * 진짜 하드코딩은 **2건**이다.
       *
       * ★ 폴백은 **결함이 아니라 방어**다 — 토큰이 안 실렸을 때 화면이 검게 죽지
       *   않게 한다. 그것을 결함으로 세면 **잘 한 일이 벌점이 된다.**
       * ★ 판정: 이 hex 앞에 **닫히지 않은 `var(`** 가 있고 그 안에 콤마가 있으면 폴백이다.
       */
      const before = line.slice(0, m.index)
      const vi = before.lastIndexOf('var(')
      if (vi >= 0) { const seg = before.slice(vi); if (!seg.includes(')') && seg.includes(',')) { hits.hexFallback.push(at({ value: m[0] })); continue } }
      hits.hex.push(at({ value: m[0] }))
    }
    for (const m of line.matchAll(/rgba?\(\s*\d+[^)]*\)/g)) {
      if (isTokenDef) continue
      hits.rgba.push(at({ value: m[0] }))
    }
    // strokeWidth 불일치
    for (const m of line.matchAll(/strokeWidth[=:]\s*["'{]?\s*([\d.]+)/g)) hits.stroke.push(at({ value: m[1] }))
    // 간격 그리드 — px 값 중 4의 배수가 아닌 것 (0·1·2·폰트크기 제외)
    for (const m of line.matchAll(/(?:padding|margin|gap|top|bottom|left|right)[^:;'"]*:\s*([\d]+)px/g)) {
      const v = Number(m[1])
      if (v > 2 && v % 4 !== 0) hits.spacing.push(at({ value: v }))
    }
    // 뷰포트 분기
    for (const m of line.matchAll(/@media[^{]+/g)) hits.media.push(at({ value: m[0].trim().slice(0, 60) }))
    for (const m of line.matchAll(/(?:innerWidth|clientWidth)[^\n]{0,24}?([<>]=?)\s*(\d{3,4})/g)) hits.media.push(at({ value: `JS ${m[1]} ${m[2]}` }))
  })
  inlineStyleCalls += (src.match(/\bS\(/g) || []).length
}

const byFile = (arr) => {
  const m = {}
  for (const h of arr) m[h.file] = (m[h.file] || 0) + 1
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}
const uniq = (arr) => [...new Set(arr.map((h) => h.value))]

const summary = {
  files: files.length,
  hardcodedHex: hits.hex.length,
  hardcodedHexUnique: uniq(hits.hex).length,
  hexAsVarFallback: hits.hexFallback.length,   // 결함이 아니라 방어 — 따로 센다
  rgbaLiteral: hits.rgba.length,
  strokeWidthValues: uniq(hits.stroke).sort((a, b) => a - b),
  strokeWidthCount: hits.stroke.length,
  spacingOffGrid: hits.spacing.length,
  spacingOffGridValues: uniq(hits.spacing).sort((a, b) => a - b),
  breakpoints: uniq(hits.media),
  breakpointCount: hits.media.length,
  inlineStyleCalls,
}

console.log('\n축5 토큰 규율 — 정적 전수\n' + '─'.repeat(52))
console.log(`파일 ${summary.files}개 · 인라인 스타일 호출 S() ${summary.inlineStyleCalls}회`)
console.log(`하드코딩 hex        ${summary.hardcodedHex}건 (고유 ${summary.hardcodedHexUnique})`)
console.log(`  ↳ var() 폴백       ${summary.hexAsVarFallback}건 — 이미 토큰화된 자리다 (위 수에 안 든다)`)
console.log(`rgba() 리터럴       ${summary.rgbaLiteral}건`)
console.log(`strokeWidth 값      ${summary.strokeWidthValues.join(' · ')}  (${summary.strokeWidthCount}회)`)
console.log(`간격 4px 그리드 밖  ${summary.spacingOffGrid}건  값: ${summary.spacingOffGridValues.slice(0, 14).join(' ')}`)
console.log(`뷰포트 분기         ${summary.breakpointCount}건  ${summary.breakpoints.join(' | ') || '(없음)'}`)
console.log('\n하드코딩 hex 가 많은 파일:')
for (const [f, n] of byFile(hits.hex).slice(0, 6)) console.log(`  ${String(n).padStart(4)}  ${f}`)

if (FULL) {
  console.log('\n── 전체 hex ──')
  for (const h of hits.hex) console.log(`  ${h.file}:${h.line}  ${h.value}  ${h.text}`)
}

writeFileSync(OUT, JSON.stringify({ summary, hits: FULL ? hits : { hexTop: hits.hex.slice(0, 60), spacing: hits.spacing.slice(0, 40), media: hits.media } }, null, 1))
console.log(`\n→ ${OUT}`)
