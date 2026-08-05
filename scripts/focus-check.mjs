/**
 * #3 검증 — 진짜 키보드 탭 순회로 :focus-visible 을 확인한다.
 * JS `.focus()` 로는 :focus-visible 이 안 뜨므로 **실제 키 입력**이어야 한다.
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const SAVE_KEY = 'nobody-lies:mountain-lodge'
const SAVE = {
  v: 3, started: true, stage: 'free', readDone: true, readIdx: 4,
  blanks: {}, solved: { s1: false, s2: false, s3: false, s4: false, s5: false },
  invLog: [], memos: [], seenClues: [], seenClaims: {}, evidence: {},
  reopenActive: {}, reopenUsed: {},
  lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
}

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))

const browser = await chromium.launch({ headless: true, executablePath: exe })

for (const vp of [{ k: 'mobile', w: 375, h: 812 }, { k: 'laptop', w: 1280, h: 800 }]) {
  for (const scheme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: scheme })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE_KEY, SAVE])
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(450)
    // 홈 덮개를 걷는다
    await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      const b = [...document.querySelectorAll('div')].find((e) => /^이어하기/.test((e.innerText || '').split('\n')[0]))
      if (b) { b.click(); await wait(500) }
    })
    await page.waitForTimeout(300)

    const seen = []
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const a = document.activeElement
        if (!a || a === document.body) return { tag: 'body' }
        const cs = getComputedStyle(a); const r = a.getBoundingClientRect()
        return {
          tag: a.tagName, cls: (a.className || '').toString().slice(0, 26),
          label: (a.textContent || a.title || a.getAttribute('aria-label') || '').trim().slice(0, 14),
          fv: a.matches(':focus-visible'),
          ring: cs.boxShadow !== 'none',
          shadow: cs.boxShadow.slice(0, 46),
          x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
          // 링이 묻히는가 — 초점 요소의 배경이 강조색 계열이면 안쪽 1px 이 안 보인다
          bg: (() => { const b = cs.backgroundColor; const m = b.match(/\d+/g); if (!m) return '-'
            const [rr, gg, bb] = m.map(Number)
            return (Math.abs(rr - 76) < 40 && Math.abs(gg - 141) < 40 && Math.abs(bb - 255) < 40) ? 'ACCENT' : '-' })(),
        }
      })
      seen.push(info)
    }
    const withRing = seen.filter((s) => s.fv && s.ring).length
    const fvCount = seen.filter((s) => s.fv).length
    console.log(`\n── ${vp.k} ${vp.w}px · ${scheme} ──`)
    console.log(`  탭 14회 · :focus-visible ${fvCount} · 그중 링 있음 ${withRing}`)
    for (const s of seen) {
      console.log(`   ${s.tag === 'body' ? '(body)' : `${String(s.label || s.cls).padEnd(15)} fv=${s.fv ? 'Y' : 'n'} ring=${s.ring ? 'Y' : 'n'}  y=${String(s.y).padStart(4)} bg=${s.bg}`}`)
    }
    /**
     * 탭 순서가 화면 순서와 어긋나는가 — y 가 크게 되돌아가는 지점.
     * ⛔ **순환 경계를 세면 안 된다.** 마지막 요소에서 처음으로 돌아가는 것은
     * 정상이고, `body`(브라우저 크롬)가 그 사이에 낀다. `body` 를 그냥 빼면
     * 760 → 0 이 「역행」으로 잡혀 **없는 결함이 인쇄된다**(2026-08-06에 그랬다).
     */
    let back = 0
    for (let i = 1; i < seen.length; i++) {
      const a = seen[i - 1], b = seen[i]
      if (a.tag === 'body' || b.tag === 'body') continue   // 순환 경계는 건너뛴다
      if (b.y < a.y - 80) back++
    }
    console.log(`  화면 순서 역행(80px 이상 · 순환 경계 제외): ${back}회`)
    await ctx.close()
  }
}
await browser.close()
