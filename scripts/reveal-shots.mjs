/**
 * 중간 공개 캡처 (2026-08-06). 시안 선택은 끝났다 — **A(rise) 확정**.
 * 카드(중) · 대(전체 화면) · 지목 직전(대 승격) · reduced-motion.
 *
 *   npm run dev  를 띄우고  node scripts/reveal-shots.mjs
 */
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = 'http://localhost:3000'
const OUT = resolve('docs/audit-shots')
const SAVE_KEY = 'nobody-lies:mountain-lodge'
const SAVE = {
  v: 3, started: true, stage: 'free', readDone: true, readIdx: 4,
  blanks: {}, solved: { s1: false, s2: false, s3: false, s4: false, s5: false },
  invLog: [], memos: [], seenClues: [], seenClaims: {}, evidence: {},
  reopenActive: {}, reopenUsed: {}, cardQ: [], interludeQ: [],
  lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
}

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: exe })

const drive = async (page, steps) => page.evaluate(async (steps) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.app')
  let fiber = null
  for (const k in root) if (k.indexOf('__reactFiber$') === 0) fiber = root[k]
  let inst = null, f = fiber
  while (f && !inst) { if (f.stateNode && f.stateNode.doInvestigate) inst = f.stateNode; f = f.return }
  if (!inst) return false
  for (const s of steps) {
    inst.doInvestigate(s.action, [s.key]); await wait(150)
    if (s.closeHeavy && inst.state.stage === 'interlude') { inst.interludeNext(); await wait(120) }
  }
  return true
}, steps)

const shot = async (hash, steps, name, vp, motion) => {
  const ctx = await browser.newContext({
    viewport: vp, colorScheme: 'dark', reducedMotion: motion ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, SAVE])
  await page.goto(BASE + hash, { waitUntil: 'networkidle' })
  await page.waitForTimeout(450)
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const b = [...document.querySelectorAll('div')].find((e) => /^이어하기/.test((e.innerText || '').split('\n')[0]))
    if (b) { b.click(); await wait(500) }
  })
  await page.waitForTimeout(300)
  const ok = await drive(page, steps)
  await page.waitForTimeout(420)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`  ${ok ? '✓' : '⛔'} ${name}.png`)
  await ctx.close()
}

// 첫 균열 → 대(전체 화면). 닫지 않고 그대로 찍는다
await shot('', [{ action: 'belongings', key: 'sakura' }], 'reveal-heavy-mobile', { width: 375, height: 812 }, false)
// 둘째 균열 → 중. 대를 닫고 나서 둘째를 친다
const second = [{ action: 'belongings', key: 'sakura', closeHeavy: true }, { action: 'fixture', key: 'window' }]
await shot('', second, 'reveal-card-mobile', { width: 375, height: 812 }, false)
await shot('', second, 'reveal-card-laptop', { width: 1280, height: 800 }, false)
await shot('', second, 'reveal-card-reducedmotion-mobile', { width: 375, height: 812 }, true)

console.log(`\n→ ${OUT}`)

/** 지목 직전 — 대로 승격한 자리. 제출 확인을 열고 찍는다 */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' })
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
  const opened = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const b = [...document.querySelectorAll('button')].find((x) => /보고서 제출/.test(x.innerText || ''))
    if (!b) return false
    b.click(); await wait(400); return !!document.querySelector('.rv-accuse')
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/reveal-accuse-mobile.png` })
  console.log(`  ${opened ? '✓' : '⛔'} reveal-accuse-mobile.png  (rv-accuse ${opened ? '떴다' : '안 떴다'})`)
  await ctx.close()
}
await browser.close()
