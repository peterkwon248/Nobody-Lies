/**
 * ─────────────────────────────────────────────────────────────
 *  기본 디자인 감사 — 4폭 캡처 + computed style 크롤 (2026-08-05)
 * ─────────────────────────────────────────────────────────────
 *
 * `docs/DESIGN-AUDIT-SPEC.md` §0·§1 의 측정 도구다. **재실행 가능**한 것이
 * 이 스크립트의 존재 이유고, **수리 후 같은 스크립트로 전후를 비교하는 것까지가
 * 수명**이다 (지시서 §0).
 *
 * ★ **눈이 아니라 코드로 잰다** ★ 축1~4 는 전부 `getComputedStyle` 전수 수집이다.
 * 스크린샷은 사람이 보는 물증이지 측정값이 아니다.
 *
 * ## 쓰는 법
 *
 *   npm run dev            # 다른 터미널에서 (기본 http://localhost:3000)
 *   node scripts/design-audit.mjs
 *   node scripts/design-audit.mjs --url http://localhost:5173 --no-shots
 *
 * ⛳ **브라우저를 새로 안 받는다.** `playwright-core` 로 **이미 깔린 Chrome/Edge**
 * 를 몬다. 감사 도구가 300MB 를 끌고 오면 그것부터가 규율 위반이다.
 *
 * ## 산출
 *
 *   docs/audit-shots/{화면}-{상태}-{뷰포트}.png   지시서 §0 의 캡처 키 (gitignore)
 *   docs/audit-data.json                          집계 (커밋 — 전후 비교의 기준선)
 *
 * ⛔ **이 스크립트는 아무것도 고치지 않는다.** 감사는 측정만이다 (지시서 §3).
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const BASE = arg('--url', 'http://localhost:3000')
const SHOTS = !process.argv.includes('--no-shots')
const SHOT_DIR = resolve('docs/audit-shots')
const OUT = resolve('docs/audit-data.json')

/** 지시서 §0 — 4폭 고정 */
const VIEWPORTS = [
  { key: 'mobile', w: 375, h: 812 },
  { key: 'tablet', w: 768, h: 1024 },
  { key: 'laptop', w: 1280, h: 800 },
  { key: 'desktop', w: 1536, h: 960 },
]

const SAVE_KEY = 'nobody-lies:mountain-lodge'
const B = (n) => Array.from({ length: n }, (_, i) => 'b' + (i + 1))
const FILL = ['한유빈', '서지안', '문세라', '백리원', '오나경', '본채', '별채', '거실',
  '전날 밤', '새벽 3시', '연탄', '테이프', '마약', '치정', '위장 유서', '대포폰',
  '금고', '알약', '통화', '유서']

/**
 * 저장 상태 셋. 지시서 §0 이 *"라우트가 아니라 상태로 갈리는 화면도 각각"* 이라
 * 못박았다 — 빈 상태 · 진행 중 · 완료가 이 셋이다.
 *
 * ⚠ 「완료」는 **시각적 완료**다. 값이 정답인지는 감사의 관심이 아니다
 *    (채점은 게이트의 일이고, 여기서 재는 것은 화면이다).
 */
const STATES = {
  /**
   * ⚠ `readIdx` 는 **`PEOPLE.length - 1` 을 넘지 못한다** — `finishRead()` 가
   * 인덱스를 그대로 두고 stage 만 바꾸기 때문이다. 5를 넣었더니 `buildReadCard`
   * 가 `PEOPLE[5].name` 을 읽어 **앱 전체가 「렌더 실패」로 죽었다.**
   * (그 무가드 접근 자체는 감사 표의 §구조 백로그로 넘긴다 — 수리는 여기 일이 아니다.)
   */
  empty: {
    v: 3, started: true, stage: 'free', readDone: true, readIdx: 4,
    blanks: {}, solved: { s1: false, s2: false, s3: false, s4: false, s5: false },
    invLog: [], memos: [], seenClues: [], seenClaims: {}, evidence: {},
    reopenActive: {}, reopenUsed: {},
    lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
  },
  mid: {
    v: 3, started: true, stage: 'free', readDone: true, readIdx: 4,
    blanks: Object.fromEntries(B(6).map((k, i) => [k, FILL[i]])),
    solved: { s1: true, s2: false, s3: false, s4: false, s5: false },
    invLog: [{ action: 'belongings', key: 'yuri', actionLabel: '소지품 검사', targetLabel: '유리', cost: 1, type: 'redherring', title: '빈 약통', desc: '라벨이 지워진 약통이 하나 나왔다.' }],
    memos: [{ id: 'm1', quote: '', quotePid: null, content: '알리바이가 겹친다', targetType: 'person', targetId: 'yuri' }],
    seenClues: [], seenClaims: {}, evidence: {}, reopenActive: {}, reopenUsed: {},
    lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
  },
  done: {
    v: 3, started: true, stage: 'free', readDone: true, readIdx: 4,
    blanks: Object.fromEntries(B(20).map((k, i) => [k, FILL[i % FILL.length]])),
    solved: { s1: true, s2: true, s3: true, s4: true, s5: true },
    invLog: B(4).map((_, i) => ({ action: 'belongings', key: 'p' + i, actionLabel: '소지품 검사', targetLabel: '대상 ' + i, cost: 1, type: i % 2 ? 'solution' : 'empty', title: '결과 ' + i, desc: '조사 결과 서술문이 여기 온다.' })),
    memos: [], seenClues: [], seenClaims: {}, evidence: {}, reopenActive: {}, reopenUsed: {},
    lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
  },
}

/** 화면 — 라벨은 nav 에 뜨는 그 글자다 (사이드바·하단탭·더보기가 같은 글자를 쓴다) */
const SCREENS = [
  { key: 'report', nav: '보고서', states: ['empty', 'mid', 'done'] },
  { key: 'statements', nav: '진술', states: ['mid'] },
  { key: 'map-plan', nav: '현장', states: ['mid'] },
  { key: 'investigate', nav: '조사', states: ['mid'], optional: true },
  /**
   * ⚠ **좁은 폭(375·768)에서 도달 경로가 없다 — 감사의 발견이다.**
   * `buildBottomNav` 는 narrative·statements·map·profile 넷이고 `buildMoreNav` 는
   * overview·memo·graph·reference 넷이다. **`log` 는 어느 쪽에도 없다.**
   * 못 잰 것이 아니라 **닿을 수 없는 것**이므로 표에 「깨짐」으로 올린다.
   */
  { key: 'log', nav: '조사 기록', states: ['empty', 'mid'] },
  { key: 'suspects', nav: '용의자', states: ['mid'] },
  { key: 'overview', nav: '사건 개요', states: ['mid'] },
  { key: 'memo', nav: '메모', states: ['empty', 'mid'] },
  { key: 'graph', nav: '관계도', states: ['mid'] },
  { key: 'reference', nav: '표기 안내', states: ['mid'] },
]

/**
 * 페이지 안에서 도는 측정기. 축1~4 를 한 번에 훑는다.
 * ⛳ 반환은 **집계**다 — 요소 전체를 내보내면 파일이 커져 전후 비교를 못 한다.
 */
const CRAWL = () => {
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const all = [...document.querySelectorAll('body *')].filter(vis)

  // ── 축1 타이포 위계 ──────────────────────────────────────────
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
  const typo = {}
  for (const el of all) {
    if (!hasText(el)) continue
    const s = getComputedStyle(el)
    const k = [px(s.fontSize), s.fontWeight, s.lineHeight === 'normal' ? 'normal' : px(s.lineHeight), s.letterSpacing === 'normal' ? '0' : s.letterSpacing].join('|')
    if (!typo[k]) typo[k] = { n: 0, sample: (el.className || el.tagName).toString().slice(0, 40), text: el.textContent.trim().slice(0, 24) }
    typo[k].n++
  }
  const tiny = Object.entries(typo).filter(([k]) => { const f = parseFloat(k); return f > 0 && f < 14 })
    .map(([k, v]) => ({ combo: k, n: v.n, sample: v.sample, text: v.text }))

  // ── 축2 밀도 ────────────────────────────────────────────────
  const overflow = all.filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
    .map((el) => ({ cls: (el.className || el.tagName).toString().slice(0, 48), scroll: el.scrollWidth, client: el.clientWidth }))
    .slice(0, 30)
  const bodyOverflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  const pads = {}
  for (const el of all) {
    const s = getComputedStyle(el)
    const p = [px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft)].join(',')
    if (p !== '0,0,0,0') pads[p] = (pads[p] || 0) + 1
  }

  // ── 축3 상태의 문법 ─────────────────────────────────────────
  const INTERACTIVE = 'button,a,input,select,textarea,[role="button"],[onclick],.nav-item,.seg,.v-chip,.iconbtn,.linklike,.v-menu-item,.g-blank-trigger,.g-word,.g-cell'
  const inter = [...document.querySelectorAll(INTERACTIVE)].filter(vis)
  /**
   * ⚠ **「하나라도 44 미만」으로 세면 100% 가 나온다 — 처음에 그렇게 재고 놀랐다.**
   * 사이드바 행처럼 **넓고 낮은 것**이 전부 걸리기 때문이다. 그건 손가락이
   * 빗나가는 부류가 아니다. 그래서 셋으로 가른다:
   *   both  가로·세로 **둘 다** 44 미만  ← 진짜 못 누르는 것
   *   short 낮기만 하다 (세로 < 44)      ← 세로 여백만 늘리면 되는 것
   *   narrow 좁기만 하다
   */
  const boxes = inter.map((el) => { const r = el.getBoundingClientRect(); return { cls: (el.className || el.tagName).toString().slice(0, 44), w: Math.round(r.width), h: Math.round(r.height), label: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 20) } })
  const both = boxes.filter((t) => t.w < 44 && t.h < 44)
  const shortOnly = boxes.filter((t) => t.h < 44 && t.w >= 44)
  const narrowOnly = boxes.filter((t) => t.w < 44 && t.h >= 44)
  const smallTargets = both
  // CSS 규칙에서 상태 선택자가 정의돼 있나 (요소가 아니라 규칙을 본다)
  const sel = { hover: 0, focusVisible: 0, focus: 0, disabled: 0, active: 0 }
  for (const sheet of [...document.styleSheets]) {
    let rules; try { rules = sheet.cssRules } catch (e) { continue }
    for (const r of [...(rules || [])]) {
      const t = r.selectorText; if (!t) continue
      if (t.includes(':hover')) sel.hover++
      if (t.includes(':focus-visible')) sel.focusVisible++
      else if (t.includes(':focus')) sel.focus++
      if (t.includes(':disabled') || t.includes('[disabled]')) sel.disabled++
      if (t.includes(':active')) sel.active++
    }
  }

  // ── 축4 모션 ────────────────────────────────────────────────
  const motion = {}
  let animated = 0
  for (const el of all) {
    const s = getComputedStyle(el)
    const d = s.transitionDuration
    if (d && d !== '0s' && !/^0s(, 0s)*$/.test(d)) {
      const k = `${s.transitionProperty} ${d} ${s.transitionTimingFunction}`.slice(0, 90)
      motion[k] = (motion[k] || 0) + 1
    }
    if (s.animationName && s.animationName !== 'none') animated++
  }

  // ── 축5(런타임 몫) 인라인 스타일 ────────────────────────────
  const inlineStyled = all.filter((el) => el.getAttribute('style')).length

  return {
    counts: { elements: all.length, interactive: inter.length, inlineStyled, animated },
    typo: { combos: Object.keys(typo).length, tiny, top: Object.entries(typo).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([k, v]) => ({ combo: k, n: v.n, sample: v.sample })) },
    density: { bodyOverflowX, overflow, padCombos: Object.keys(pads).length },
    states: { ruleSelectors: sel, smallTargets: smallTargets.slice(0, 40), smallTargetCount: both.length, shortOnly: shortOnly.length, narrowOnly: narrowOnly.length },
    motion: { combos: Object.keys(motion).length, list: Object.entries(motion).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ rule: k, n })) },
  }
}

/**
 * nav 라벨로 화면을 연다 — 사이드바 → 하단탭 → 더보기 시트 순으로 시도한다.
 *
 * ⚠ **공백을 지우고 비교한다.** 하단탭의 라벨이 `더 보기`(사이 공백)인데
 * `더보기` 로 찾다가 좁은 폭 다섯 화면을 통째로 못 쟀다. 화면 글자를 셀렉터로
 * 쓸 때는 **눈에 같아 보이는 것이 코드에 같지 않다.**
 */
async function goto(page, label) {
  return page.evaluate(async (lab) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const norm = (s) => (s || '').replace(/\s+/g, '')
    const want = norm(lab)
    const head = (e) => norm((e.innerText || '').split('\n')[0])
    let el = [...document.querySelectorAll('.nav-item')].find((e) => head(e) === want)
    if (el) { el.click(); await wait(320); return true }
    const cols = [...document.querySelectorAll('div')].filter((e) => e.style && e.style.flexDirection === 'column')
    el = cols.find((e) => norm(e.innerText) === want)
    if (el) { el.click(); await wait(320); return true }
    const more = cols.find((e) => norm(e.innerText) === '더보기')
    if (more) {
      more.click(); await wait(300)
      const item = [...document.querySelectorAll('.v-menu-item')].find((e) => norm(e.innerText) === want)
      if (item) { item.click(); await wait(340); return true }
      document.querySelector('.scrim')?.click(); await wait(160)
    }
    return false
  }, label)
}

async function seed(page, save) {
  await page.evaluate(([k, s]) => {
    if (s === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(s))
  }, [SAVE_KEY, save])
}

const main = async () => {
  if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true })
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
  if (!exe) { console.error('⛔ Chrome/Edge 를 못 찾았다 — executablePath 를 손으로 준다'); process.exit(1) }

  const browser = await chromium.launch({ headless: true, executablePath: exe })
  const data = { base: BASE, viewports: VIEWPORTS.map((v) => v.key), screens: {}, errors: [] }

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, colorScheme: 'dark' })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })

    for (const scr of SCREENS) {
      for (const st of scr.states) {
        const key = `${scr.key}-${st}-${vp.key}`
        try {
          await seed(page, STATES[st])
          await page.goto(BASE, { waitUntil: 'networkidle' })
          await page.waitForTimeout(450)
          const opened = await goto(page, scr.nav)
          if (!opened) {
            if (!scr.optional) data.errors.push(`${key}: nav '${scr.nav}' 못 찾음`)
            continue
          }
          await page.waitForTimeout(320)
          if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${key}.png`, fullPage: false })
          data.screens[key] = await page.evaluate(CRAWL)
        } catch (e) {
          data.errors.push(`${key}: ${e.message.slice(0, 120)}`)
        }
      }
    }

    // 인트로 단계 — 저장이 없으면 프롤로그부터 흐른다
    try {
      await seed(page, null)
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      // 홈 목록 → 사건 카드 → 시작. 저장이 없으므로 프롤로그부터 흐른다
      const started = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms))
        const rows = [...document.querySelectorAll('div')].filter((e) => /산장 살인사건/.test(e.innerText || '') && (e.innerText || '').length < 200)
        const row = rows[rows.length - 1]   // 가장 안쪽 = 실제 카드
        if (row) { row.click(); await wait(600) }
        const b = [...document.querySelectorAll('button')].find((x) => /시작|처음부터|플레이/.test(x.innerText || ''))
        if (b) { b.click(); await wait(700); return true }
        return false
      })
      if (started) {
        const key = `intro-prologue-${vp.key}`
        if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/${key}.png` })
        data.screens[key] = await page.evaluate(CRAWL)
      } else data.errors.push(`intro-${vp.key}: 시작 버튼 못 찾음`)
    } catch (e) { data.errors.push(`intro-${vp.key}: ${e.message.slice(0, 120)}`) }

    await ctx.close()
    console.log(`  ✓ ${vp.key} (${vp.w}×${vp.h})`)
  }

  await browser.close()
  writeFileSync(OUT, JSON.stringify(data, null, 1))
  const n = Object.keys(data.screens).length
  console.log(`\n캡처·크롤 ${n}건 → ${OUT}`)
  if (data.errors.length) { console.log(`\n⚠ 못 잰 것 ${data.errors.length}건:`); for (const e of data.errors) console.log('   ' + e) }
}

main().catch((e) => { console.error(e); process.exit(1) })
