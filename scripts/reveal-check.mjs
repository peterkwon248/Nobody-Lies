/**
 * 중간 공개 3단계 검증 (2026-08-06) — `DESIGN-NOTES.md` §확정 결정 2·3.
 *
 * ★ **순서를 바꿔 두 번 돌린다** — 어느 물증을 먼저 찾아도 **첫 것이 대, 둘째가
 *   중**이어야 한다. 한 순서만 보면 「우연히 맞는 구현」을 못 가른다.
 *
 *   npm run dev  를 띄우고
 *   node scripts/reveal-check.mjs
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const SAVE_KEY = 'nobody-lies:mountain-lodge'
const SAVE = {
  v: 3, started: true, stage: 'free', readDone: true, readIdx: 4,
  blanks: {}, solved: { s1: false, s2: false, s3: false, s4: false, s5: false },
  invLog: [], memos: [], seenClues: [], seenClaims: {}, evidence: {},
  reopenActive: {}, reopenUsed: {}, cardQ: [], interludeQ: [],
  lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
}

/** il_suicide 를 깨는 둘 — 순서를 바꿔가며 돌린다 */
const PAIR = [
  { action: 'belongings', key: 'sakura', ev: 'e_note' },
  { action: 'fixture', key: 'window', ev: 'e_tape_inside' },
]

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
const browser = await chromium.launch({ headless: true, executablePath: exe })

/** 앱 인스턴스를 잡아 doInvestigate 를 직접 부른다 — UI 경로를 타면 예산·잠금에 걸린다 */
const RUN = async (page, steps) => page.evaluate(async (steps) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.app')
  let fiber = null
  for (const k in root) if (k.indexOf('__reactFiber$') === 0) fiber = root[k]
  let inst = null, f = fiber
  while (f && !inst) { if (f.stateNode && f.stateNode.doInvestigate) inst = f.stateNode; f = f.return }
  if (!inst) return { error: '앱 인스턴스를 못 찾았다' }
  const out = []
  for (const s of steps) {
    inst.doInvestigate(s.action, [s.key])
    await wait(120)
    out.push({
      step: s.ev,
      interludeQ: (inst.state.interludeQ || []).slice(),
      cardQ: (inst.state.cardQ || []).slice(),
      stage: inst.state.stage,
    })
    // 다음 단계를 위해 연출을 닫는다
    if (inst.state.stage === 'interlude') { inst.interludeNext(); await wait(80) }
    if ((inst.state.cardQ || []).length) { inst.cardNext(); await wait(80) }
  }
  return { out }
}, steps)

for (const order of [[0, 1], [1, 0]]) {
  const steps = order.map((i) => PAIR[i])
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, SAVE])
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(450)
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const b = [...document.querySelectorAll('div')].find((e) => /^이어하기/.test((e.innerText || '').split('\n')[0]))
    if (b) { b.click(); await wait(500) }
  })
  await page.waitForTimeout(300)

  const res = await RUN(page, steps)
  console.log(`\n── 순서: ${steps.map((s) => s.ev).join(' → ')} ──`)
  if (res.error) { console.log('  ⛔ ' + res.error); await ctx.close(); continue }
  res.out.forEach((r, i) => {
    const heavy = r.interludeQ.length > 0
    const light = r.cardQ.length > 0
    console.log(`  ${i + 1}. ${r.step.padEnd(15)} 대=${heavy ? 'Y' : 'n'} 중=${light ? 'Y' : 'n'}  (interludeQ=${JSON.stringify(r.interludeQ)} cardQ=${JSON.stringify(r.cardQ)})`)
  })
  const ok = res.out[0] && res.out[0].interludeQ.length === 1 && res.out[0].cardQ.length === 0
    && res.out[1] && res.out[1].interludeQ.length === 0 && res.out[1].cardQ.length === 1
  console.log(`  ⇒ 첫=대 · 둘째=중 : ${ok ? '✅ 맞다' : '⛔ 어긋난다'}`)
  await ctx.close()
}

/** 겹침 — a_hearth 하나가 두 인상(il_time · il_absent)을 건드린다 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, SAVE])
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(450)
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const b = [...document.querySelectorAll('div')].find((e) => /^이어하기/.test((e.innerText || '').split('\n')[0]))
    if (b) { b.click(); await wait(500) }
  })
  await page.waitForTimeout(300)
  const res = await RUN(page, [{ action: 'fixture', key: 'hearth', ev: 'e_hearth_cold + e_receipt (두 인상)' }])
  console.log('\n── 겹침: 한 조사가 두 인상을 건드린다 ──')
  if (res.error) console.log('  ⛔ ' + res.error)
  else {
    const r = res.out[0]
    console.log(`  대 ${r.interludeQ.length}개 · 중 ${r.cardQ.length}개  ${JSON.stringify(r.interludeQ)} ${JSON.stringify(r.cardQ)}`)
    console.log(`  ⇒ 대는 1회로 합쳐졌나 : ${r.interludeQ.length === 1 ? '✅ 맞다' : '⛔ 어긋난다'}`)
    console.log(`  ⇒ 나머지는 중으로 내려갔나 : ${r.cardQ.length === 1 ? '✅ 맞다 (삼키지 않았다)' : '⛔ 어긋난다'}`)
  }
  await ctx.close()
}

await browser.close()
