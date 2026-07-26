#!/usr/bin/env node
/**
 * 이식 대조기 — 프로토타입과 앱의 **분기·반복 집합**을 맞춰본다.
 *
 * ## 무엇이 바뀌었나 (2026-07-26)
 *
 * 예전 판은 원본에서 분기를 뽑아 **장부**(`docs/port-ledger.json`)와 대조했다.
 * 앱을 손으로 옮기던 시절엔 이름이 달라져서(`l.clues` ↔ `cluesAt`) 기계가
 * 판정할 수 없었고, 옮겼는지는 사람이 장부에 적어야 했다.
 *
 * **앱이 DC React export 로 바뀌면서 그 전제가 사라졌다.** 기계 변환은 이름을
 * 그대로 쓰므로 두 집합을 직접 비교할 수 있다 — 장부도, 사람의 판정도 없다.
 * 전환 시점에 308 대 308 로 완전히 일치했다.
 *
 * ## 그래서 이게 잡아주는 것
 *
 *   · **재export 가 분기를 빠뜨렸다** — 앱에만 없다
 *   · **재export 가 옛 마스터에서 왔다** — 프로토타입에 없는 분기가 앱에 있다
 *   · **프로토타입 파일만 갱신되고 앱이 안 따라왔다** (또는 그 반대)
 *
 * ## 못 잡는 것 — 이게 중요하다
 *
 * **갈래가 있느냐까지만 본다.** 같은 조건에서 뜨는지, 화면이 원본처럼 보이는지는
 * 재지 못한다. 2026-07-26 에 보고서 장 머리글이 정확히 그렇게 빠져나갔다 —
 * 두 갈래가 다 있는데 조건이 뒤바뀌어 있었다. **초록불은 「덜 옮기지 않았다」는
 * 뜻이지 「맞게 옮겼다」는 뜻이 아니다.**
 *
 * 사용:
 *   node scripts/port-check.mjs           대조. 어긋나면 exit 1
 *   node scripts/port-check.mjs --list    양쪽 목록 출력
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROTO = join(ROOT, 'prototype', '추리게임.dc.html')
const APP = join(ROOT, 'app', 'src', 'App.jsx')

/** 원본 템플릿의 분기(`sc-if`)와 반복(`sc-for`) */
function fromPrototype(src) {
  const out = new Set()
  for (const m of src.matchAll(/sc-if value="\{\{\s*([\w.]+)\s*\}\}"/g)) out.add(m[1])
  for (const m of src.matchAll(/sc-for list="\{\{\s*([\w.]+)\s*\}\}"/g)) out.add(m[1])
  return out
}

/**
 * 변환된 JSX 의 같은 자리.
 *
 * `sc-if`  → `{(V.x)?(<>…</>):null}`
 * `sc-for` → `arr(V.x).map((it,$index)=>…)`
 *
 * `V.` 접두사는 `renderVals()` 가 돌려준 객체를 가리키는 것뿐이라 떼고 비교한다.
 */
function fromApp(src) {
  const out = new Set()
  for (const m of src.matchAll(/\{\((?:V\.)?([A-Za-z_][\w.]*)\)\?/g)) out.add(m[1])
  for (const m of src.matchAll(/arr\((?:V\.)?([A-Za-z_][\w.]*)\)\.map/g)) out.add(m[1])
  return out
}

const P = fromPrototype(readFileSync(PROTO, 'utf8'))
const A = fromApp(readFileSync(APP, 'utf8'))

const missing = [...P].filter((x) => !A.has(x)).sort()   // 앱이 빠뜨렸다
const extra = [...A].filter((x) => !P.has(x)).sort()     // 프로토타입에 없다

if (process.argv.includes('--list')) {
  console.log(`\n프로토타입 (${P.size})\n  ${[...P].sort().join(' ')}`)
  console.log(`\n앱 (${A.size})\n  ${[...A].sort().join(' ')}`)
  process.exit(0)
}

const say = (title, arr, hint) => {
  if (!arr.length) return
  console.log(`\n${title} (${arr.length})\n  ${hint}`)
  for (const x of arr) console.log(`    ${x}`)
}

say('❗ 앱에 없다', missing, '재export 가 빠뜨렸거나, 프로토타입만 갱신됐다')
say('❗ 프로토타입에 없다', extra, '앱이 옛 마스터에서 왔거나, 앱만 갱신됐다')

const ok = !missing.length && !extra.length
console.log(
  `\n${ok ? '✓' : '✗'} 프로토타입 ${P.size} · 앱 ${A.size} · `
  + `공통 ${[...P].filter((x) => A.has(x)).length} · 어긋남 ${missing.length + extra.length}`,
)
if (ok) console.log('  (갈래가 있느냐까지만 본다 — 같은 조건에서 뜨는지는 눈으로 본다)')
process.exit(ok ? 0 : 1)
