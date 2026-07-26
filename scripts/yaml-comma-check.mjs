#!/usr/bin/env node
/**
 * YAML flow mapping 쉼표 절단 검사기.
 *
 * ## 왜 있나
 *
 * ```yaml
 * note: { ko: 외상은 없고, 혈중 일산화탄소 농도가 높았다., en: "No external wounds..." }
 * ```
 *
 * `{ }` 안에서 쉼표는 **항목 구분자**다. 따옴표를 안 씌우면 `ko` 는
 * 「외상은 없고」에서 끊기고 뒷문장은 통째로 사라진다. **파서는 아무 말도
 * 하지 않는다** — 문법상 올바른 YAML 이기 때문이다.
 *
 * 2026-07-25 에 한 번 나왔고(`docs/MEMORY.md`), 2026-07-26 에 **네 건이 아직
 * 살아 있는 것을 발견했다.** 앱을 엔진 데이터로 옮기며 문장을 나란히 놓고서야
 * 보였다 — 검증기는 참조 무결성만 보지 문장이 잘렸는지는 모른다.
 *
 * ## 판정
 *
 * flow mapping 안의 `키: 따옴표없는값` 을 잡고, 값 바로 뒤가 쉼표인데
 * **그 쉼표 뒤가 `식별자:` 가 아니면** 잘린 것이다. 다음 항목이 아니라
 * 같은 문장의 뒷부분이라는 뜻이다.
 *
 * `}` 앞의 후행 쉼표(`{ a: 1, }`)는 뒤가 비어 있으므로 걸리지 않는다.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CASES = join(ROOT, 'engine', 'cases')

const KEY_VALUE = /([A-Za-z_][A-Za-z0-9_]*):[ ]+([^"'[{][^,}]*)/g
const NEXT_KEY = /^,\s*[A-Za-z_][A-Za-z0-9_]*:/

let bad = 0
for (const file of readdirSync(CASES).filter((f) => f.endsWith('.yaml'))) {
  const lines = readFileSync(join(CASES, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!line.includes('{')) return
    for (const m of line.matchAll(KEY_VALUE)) {
      const after = line.slice(m.index + m[0].length)
      if (!after.startsWith(',')) continue
      if (NEXT_KEY.test(after)) continue
      const tail = after.slice(1).trim()
      if (!tail) continue          // `}` 앞 후행 쉼표 — 무해
      bad++
      console.log(`\n  ${file}:${i + 1}  ${m[1]}`)
      console.log(`    읽힌 값 「${m[2].trim()}」`)
      console.log(`    잘린 뒤 「${tail.slice(0, 50)}」`)
      console.log('    → 값을 따옴표로 감싸라')
    }
  })
}

console.log(bad
  ? `\n✗ 쉼표에서 잘린 값 ${bad}건`
  : '✓ flow mapping 쉼표 절단 없음')
process.exit(bad ? 1 : 0)
