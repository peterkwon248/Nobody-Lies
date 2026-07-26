#!/usr/bin/env node
/**
 * 이식 대조기 — 프로토타입의 **분기와 반복**을 세어 장부와 맞춰본다.
 *
 * 왜 이게 필요한가:
 *   화면 블록이 다 있는 것과 이식이 끝난 것은 다른 말이다. 2026-07-25 에 45건,
 *   07-26 에 7건이 나왔는데 **전부 같은 층위**였다 — 최상위 화면은 옮겨져 있고
 *   그 안의 `sc-if` / `sc-for` 가 통째로 빠져 있었다. 화면을 열면 멀쩡해 보이고
 *   특정 상태가 돼야 드러나므로 눈으로도 잘 안 잡힌다.
 *
 * 이 스크립트는 **판단하지 않는다.** 원본에서 분기·반복을 전부 뽑아 장부
 * (`docs/port-ledger.json`)와 대조하고, 장부에 없거나 `?` 로 남은 것만 알린다.
 * 옮겼는지 안 옮겼는지는 사람이 장부에 적는다 — 이름만으로는 기계가 못 정한다
 * (`l.clues` ↔ `cluesAt`).
 *
 * 그래서 이게 잡아주는 것:
 *   · 옮기면서 못 보고 지나간 분기
 *   · **DC 재export 로 새로 생기거나 바뀐 분기** ← 장부에 없으니 바로 튄다
 *
 * 사용:
 *   node scripts/port-check.mjs           대조. 미확인이 있으면 exit 1
 *   node scripts/port-check.mjs --init    장부 초기 생성 (전부 "?")
 *   node scripts/port-check.mjs --list    화면별 전체 목록 출력
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'prototype', '추리게임.dc.html')
const LEDGER = join(ROOT, 'docs', 'port-ledger.json')

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/)

/**
 * 화면 블록. 최상위 `sc-if value="{{ isX }}"` 가 여는 구간이다.
 * 끝은 다음 블록의 시작 — 정확한 태그 매칭 대신 이 근사로 충분하다.
 * 놓치면 다음 화면 것으로 세어지고, 어차피 둘 다 장부에 있어야 하기 때문이다.
 */
function screens() {
  const starts = []
  lines.forEach((l, i) => {
    const m = l.match(/sc-if value="\{\{\s*(is[A-Z][A-Za-z]*|showOriginal)\s*\}\}"/)
    // 최상위만 — 들여쓰기 6칸 이하 (중첩 sc-if 는 더 깊다)
    if (m && /^ {0,8}<sc-if/.test(l)) starts.push({ name: m[1], from: i + 1 })
  })
  // 마크업은 `<script type="text/x-dc">` 앞에서 끝난다. 그 뒤는 DCLogic 이라
  // 마지막 화면이 1680줄을 통째로 삼키지 않도록 여기서 자른다
  const endOfMarkup = lines.findIndex((l) => l.includes('type="text/x-dc"'))
  const last = endOfMarkup > 0 ? endOfMarkup : lines.length
  return starts.map((s, i) => ({
    ...s,
    to: i + 1 < starts.length ? starts[i + 1].from - 1 : last,
  }))
}

/** 그 구간의 분기·반복 이름들 */
function bindings(from, to) {
  const found = new Set()
  for (let i = from - 1; i < to; i++) {
    for (const m of lines[i].matchAll(/sc-if value="\{\{\s*([\w.]+)\s*\}\}"/g)) found.add(m[1])
    for (const m of lines[i].matchAll(/sc-for list="\{\{\s*([\w.]+)\s*\}\}"/g)) found.add(m[1])
  }
  return [...found].sort()
}

/** `as="rb"` 로 도는 반복 안의 항목 참조(`rb.foo`)는 그 반복에 딸린 것이라 접는다 */
const roll = (names) => {
  const heads = new Set(names.filter((n) => !n.includes('.')))
  return names.filter((n) => !n.includes('.') || !heads.has(n.split('.')[0]) || true)
}

/**
 * 같은 이름의 블록은 합친다 — `isNarrow`(141·978) · `isWide`(157·161)처럼
 * 한 화면 개념이 원본에서 여러 자리에 나뉘어 있는 경우가 있다.
 */
const inventory = [...screens().reduce((m, s) => {
  const cur = m.get(s.name) ?? { screen: s.name, at: [], items: new Set() }
  cur.at.push(`${s.from}~${s.to}`)
  for (const it of roll(bindings(s.from, s.to))) cur.items.add(it)
  return m.set(s.name, cur)
}, new Map()).values()].map((s) => ({ ...s, items: [...s.items].sort() }))

const total = inventory.reduce((n, s) => n + s.items.length, 0)

if (process.argv.includes('--list')) {
  for (const s of inventory) {
    console.log(`\n${s.screen}  ${s.at.join(' · ')}  (${s.items.length})`)
    console.log('  ' + s.items.join(' '))
  }
  console.log(`\n총 ${inventory.length}화면 · 분기/반복 ${total}개`)
  process.exit(0)
}

if (process.argv.includes('--init') || !existsSync(LEDGER)) {
  const led = {}
  for (const s of inventory) {
    led[s.screen] = {}
    for (const it of s.items) led[s.screen][it] = '?'
  }
  writeFileSync(LEDGER, JSON.stringify(led, null, 2) + '\n', 'utf8')
  console.log(`장부를 만들었다: docs/port-ledger.json (${total}개, 전부 "?")`)
  console.log('각 항목에 상태를 적어라 — "ported" 또는 "skip: <이유>"')
  process.exit(0)
}

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
const unknown = []   // 장부에 "?" 로 남은 것
const missing = []   // 장부에 아예 없는 것 = 재export 로 새로 생긴 것
const stale = []     // 장부에 있는데 원본에 없는 것 = 재export 로 사라진 것

for (const s of inventory) {
  const book = ledger[s.screen] ?? {}
  for (const it of s.items) {
    if (!(it in book)) missing.push(`${s.screen}.${it}`)
    else if (book[it] === '?') unknown.push(`${s.screen}.${it}`)
  }
  for (const it of Object.keys(book)) if (!s.items.includes(it)) stale.push(`${s.screen}.${it}`)
}
for (const name of Object.keys(ledger))
  if (!inventory.some((s) => s.screen === name)) stale.push(`${name} (화면 통째)`)

const say = (title, arr) => {
  if (!arr.length) return
  console.log(`\n${title} (${arr.length})`)
  for (const x of arr) console.log(`  ${x}`)
}

say('❗ 장부에 없다 — 원본이 바뀌었다 (재export?)', missing)
say('❓ 미확인 — 옮겼는지 아직 안 적혔다', unknown)
say('🗑  원본에 없다 — 장부에서 지워도 된다', stale)

const ok = missing.length === 0 && unknown.length === 0
console.log(
  `\n${ok ? '✓' : '✗'} ${inventory.length}화면 · 분기/반복 ${total}개 · `
  + `미확인 ${unknown.length} · 새로 생김 ${missing.length} · 사라짐 ${stale.length}`,
)
process.exit(ok ? 0 : 1)
