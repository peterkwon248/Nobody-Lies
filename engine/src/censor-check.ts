/**
 * ─────────────────────────────────────────────────────────────
 *  검열 배선 검사 — `npm run censor-check`
 * ─────────────────────────────────────────────────────────────
 * (2026-08-02 신설)
 *
 * ## 왜 있나 — **⑤검열관은 게이트에 걸 수 없다**
 *
 * 검열은 **사람의 왕복**이 필요하다(브리프를 챗봇에 붙이고 응답을 받아온다).
 * 그래서 `npm run censor` 자체는 게이트에 못 건다 — `proof-check`·`world-check` 와
 * 같은 자리다.
 *
 * **그런데 그러면 배선이 죽어도 아무도 모른다.** `clue-check ③` 이 정확히 그 문제로
 * 생겼다 — *"①②가 `weakBlanks` 를 직접 부르므로 검증기 쪽 배선을 지워도 초록이었다."*
 *
 * 그래서 **사람 없이 확인할 수 있는 것만** 골라 게이트에서 문다:
 *
 * ```
 * ① 브리프가 나오나          복사 구간이 있고 자리표가 전부 채워지나
 * ② 판정이 진짜를 통과시키나   실물에서 뽑은 인용 → ok
 * ③ 판정이 환각을 기각하나     원문에 없는 문장 → 기각          ← 여기가 §14 의 경계다
 * ④ 판정이 헛것을 기각하나     없는 자리 · 모르는 등급 → 기각
 * ```
 *
 * ⚠ **③이 이 검사의 핵심이다.** 그것이 무너지면 *"LLM 은 규칙을 결정하지 않는다"*
 * (`MANIFESTO §14`)가 **말뿐**이 된다 — 챗봇이 지어낸 경고가 그대로 결함이 된다.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { parseCase } from './schema.js'
import { judge, passages, facts } from './censor.js'
import type { Case } from './types.js'

const fail: string[] = []
const ok: string[] = []

const cases = readdirSync(join('cases'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ name: f, c: parseCase(load(readFileSync(join('cases', f), 'utf8')), f) as Case }))

/** ① 브리프 — 복사 구간이 있고 자리표가 남지 않는다 */
{
  const tpl = readFileSync(new URL('../templates/CENSOR-BRIEF.md', import.meta.url), 'utf8')
  const body = tpl.split('⬇ 여기서부터 복사')[1]?.split('⬆ 여기까지 복사')[0]
  if (!body) fail.push('① CENSOR-BRIEF.md 에 복사 구간(⬇ … ⬆)이 없다')
  else {
    const { c } = cases[0]!
    const filled = body.replace('{{FACTS}}', facts(c).join('\n'))
      .replace('{{PASSAGES}}', passages(c).map((p) => `[${p.where}]\n${p.text}`).join('\n\n'))
    if (filled.includes('{{')) fail.push('① 브리프에 안 채워진 자리표가 남는다')
    else if (!filled.includes(c.people[0]!.name)) fail.push('① 브리프에 사실 표가 안 들어갔다')
    else ok.push(`① 브리프가 나온다 (복사 구간 ${filled.length}자 · 자리표 0)`)
  }
}

/** ②③④ 판정 — 사건마다 진짜 하나와 가짜 셋을 심는다 */
{
  let good = 0, dropped = 0
  for (const { name, c } of cases) {
    const ps = passages(c)
    if (!ps.length) { fail.push(`②  ${name} 에 검열할 산문이 하나도 없다`); continue }
    const p = ps.find((x) => x.text.length > 12) ?? ps[0]!
    const real = p.text.slice(0, 12)

    const v = judge(c, [
      { where: p.where, kind: 'contradiction', quote: real, why: '진짜' },
      { where: p.where, kind: 'leak', quote: '이 문장은 이 사건 어디에도 없다 확실히', why: '환각' },
      { where: 'prologue[9999]', kind: 'leak', quote: real, why: '없는 자리' },
      { where: p.where, kind: '문체', quote: real, why: '모르는 등급' },
    ])
    if (!v[0]!.ok) fail.push(`② ${name}: 실물 인용을 기각했다 — ${(v[0] as { reason: string }).reason}`)
    else good++
    if (v[1]!.ok) fail.push(`③ ${name}: **환각을 통과시켰다** — §14 의 경계가 무너졌다`)
    else dropped++
    if (v[2]!.ok) fail.push(`④ ${name}: 없는 자리를 통과시켰다`)
    if (v[3]!.ok) fail.push(`④ ${name}: 모르는 등급을 통과시켰다`)
  }
  if (good === cases.length) ok.push(`② 실물 인용을 ${good}/${cases.length} 통과시킨다`)
  if (dropped === cases.length) ok.push(`③ 환각을 ${dropped}/${cases.length} 기각한다 (§14 경계)`)
  if (!fail.some((f) => f.startsWith('④'))) ok.push('④ 없는 자리·모르는 등급을 기각한다')
}

console.log(`\n  검열 배선 — 사건 ${cases.length}건`)
for (const s of ok) console.log(`    ✓ ${s}`)
if (fail.length) {
  console.log(`\n  ✗ 배선이 끊겼다 (${fail.length})`)
  for (const s of fail) console.log(`    ${s}`)
  console.log('')
  process.exit(1)
}
console.log('')
