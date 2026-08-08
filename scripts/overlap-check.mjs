/**
 * ⑦-b **방 안 범례 겹침 계측** — 「무엇이 무엇과 포개지는가」를 전수로 센다.
 *
 *   npm run dev  를 띄우고
 *   node scripts/overlap-check.mjs [--case <id>] [--reveal] [--w 375] [--scale 1]
 *
 * ─────────────────────────────────────────────────────────────
 *  ⛔ 왜 이 파일이 저장소에 있나 (2026-08-08 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * 이 계측기의 앞선 판은 **세션 스크래치패드에서 살고 죽었다.** 그래서 08-08 세션이
 * 「범례 충돌 6쌍 전수 0」을 인쇄했는데 **다음 세션이 그것을 다시 돌릴 방법이 없었다** —
 * 지시서 §1 이 요구하는 「심어서 수리 전 exit 1 · 후 exit 0」의 거처도 없었다.
 * **과거형으로만 존재하는 검사는 검사가 아니다**(`MEMORY.md` §심어보지 않은 검사는 장식이다).
 *
 * ─────────────────────────────────────────────────────────────
 *  ⛔ 이 계측기는 «일곱 번» 틀렸다 — 그때마다 「0」을 인쇄했다
 * ─────────────────────────────────────────────────────────────
 *
 * 아래 조항은 전부 **실측으로 잡힌 오계수**에 하나씩 대응한다. 지우지 마라.
 *
 * ① svg 오포착      `querySelector('svg')` 가 16×16 아이콘을 도면으로 집었다
 *                   → `preserveAspectRatio="none"` 인 것 «하나»만. 개수를 단언한다
 * ② opacity 필터     `display:none` 으로 죽은 라벨을 「보인다」로 셌다
 *                   → 가시성은 «rect + offsetParent»로 판정한다
 * ③ computed 거짓말  합성이 멈춘 환경에서 전이가 «시작값»에 고정된다 — 판례 등재
 *                   → 재기 전에 전이·애니메이션을 «끈다». inline 이 정본이다
 * ④ 문·창 라벨 오분류 건축 주기 5건이 인물 알약으로 셌다
 *                   → 인물은 «점의 title 과 라벨 텍스트가 짝이 맞는지» 검산한다
 * ⑤ aria vs title    `aria-label` 만 읽어 `title` 로 붙은 것을 놓쳤다
 *                   → 점의 이름은 `title` 이다 (이 파일이 쓰는 그 속성)
 * ⑥⑦ isHome·탭바     홈 판정 — 이 계측기의 관할이 아니다. 화면은 `view:'map'` 으로 «건다»
 *
 * ★ 분류가 틀리면 «조용히» 0 이 나온다. 그래서 이 파일은 셀 때마다 **분류 census 를
 *   먼저 인쇄하고**, 인물 점↔라벨 짝이 안 맞으면 **그 자리에서 죽는다.**
 */
import { chromium } from 'playwright-core'
import { existsSync, readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] }
const has = (k) => argv.indexOf('--' + k) >= 0

const BASE = process.env.NL_BASE || 'http://localhost:3000'
const W = Number(arg('w', 375))
const H = Number(arg('h', 812))
const SCALE = Number(arg('scale', 1))       // 시스템 글꼴 배율 (지시서 §4 — 1.3 판)
const REVEAL = has('reveal')                 // 전 장 완료 = 숨은 장소까지 드러난 판
const ONLY = arg('case', null)

const index = JSON.parse(readFileSync('app/public/cases/index.json', 'utf8'))
const IDS = (Array.isArray(index) ? index : index.cases || []).map((c) => (typeof c === 'string' ? c : c.id)).filter(Boolean)
const CASES = ONLY ? [ONLY] : IDS

const saveFor = () => ({
  v: 3, started: true, stage: 'free', readDone: true, readIdx: 0,
  blanks: {},
  solved: { s1: REVEAL, s2: REVEAL, s3: REVEAL, s4: REVEAL, s5: REVEAL },
  invLog: [], memos: [], seenClues: [], seenClaims: {}, evidence: {},
  reopenActive: {}, reopenUsed: {}, cardQ: [], interludeQ: [],
  lang: 'ko', theme: 'dark', narrMode: 'prose', stmtMode: 'grid', viewOpts: { timelineSort: false },
})

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
if (!exe) { console.error('⛔ Chrome/Edge 를 못 찾았다'); process.exit(2) }

/** 겹침 판정 — 양축 모두 0.5px 을 넘어야 「겹쳤다」로 센다 (맞닿음은 겹침이 아니다) */
const EPS = 0.5
const hit = (a, b) => {
  const w = Math.min(a.r, b.r) - Math.max(a.x, b.x)
  const h = Math.min(a.b, b.b) - Math.max(a.y, b.y)
  return w > EPS && h > EPS ? { w: +w.toFixed(1), h: +h.toFixed(1) } : null
}

const browser = await chromium.launch({ headless: true, executablePath: exe })

/**
 * 화면 안의 것을 «분류해서» 돌려준다. 판정은 Node 쪽에서 한다 —
 * 브라우저 안에서 세면 무엇을 셌는지 안 보인다(그것이 ①~④가 난 방식이다).
 */
const MEASURE = (opt) => {
  const out = { err: null, planes: 0, vb: '', pick: '', people: [], rooms: [], fixtures: [], badges: [], fxNames: [] }

  // ① 도면 svg 는 preserveAspectRatio="none" 인 것 «하나»다
  const svgs = [...document.querySelectorAll('svg')].filter((s) => s.getAttribute('preserveAspectRatio') === 'none')
  out.planes = svgs.length
  let svg = null
  if (svgs.length === 1) svg = svgs[0]
  else if (svgs.length === 2 && opt && opt.zoom) {
    /**
     * 탭-확대는 미리보기를 «지우지 않는다» — 둘이 동시에 산다.
     * 큰 쪽이 확대다. 고른 근거를 인쇄해서 «조용히 엉뚱한 것을 재는» 길을 막는다.
     */
    const area = (s) => { const r = s.parentElement.getBoundingClientRect(); return Math.round(r.width * r.height) }
    const sorted = svgs.slice().sort((a, b) => area(b) - area(a))
    if (area(sorted[0]) <= area(sorted[1])) { out.err = '확대와 미리보기의 크기가 같다 — 못 고른다'; return out }
    svg = sorted[0]
    out.pick = `확대 ${area(sorted[0])}px² (미리보기 ${area(sorted[1])}px²)`
  }
  if (!svg) { out.err = 'svg ' + svgs.length + '개 — ' + (opt && opt.zoom ? '확대는 2개여야 한다' : '1개여야 한다'); return out }
  out.vb = svg.getAttribute('viewBox') || ''
  const boxEl = svg.parentElement
  const bb = boxEl.getBoundingClientRect()
  out.box = { x: bb.left, y: bb.top, r: bb.right, b: bb.bottom, w: bb.width, h: bb.height }

  // ② 가시성 — rect 가 0 이거나 레이아웃에서 빠졌으면 없는 것이다
  const vis = (el) => {
    if (!el || el.offsetParent === null) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }
  }
  /**
   * ⑧ **글자를 재려면 «글자»를 재야 한다** (2026-08-08 · 여덟 번째 오계수. 인쇄 전에 잡혔다)
   *
   * 방 이름 span 은 `flex:'20 1 auto'` 로 **머리줄 전체까지 늘어난다.** 그 상자를
   * 재면 띠 안의 설비 마커가 «언제나» 겹친 것으로 나온다 — 산장 전 시간대에서
   * `방이름↔설비 4` 가 똑같이 나왔고 그것이 이 오계수의 지문이었다.
   * `Range` 로 글자 상자를 재고, 말줄임으로 잘리는 만큼 요소 상자로 **깎는다.**
   */
  const ink = (el) => {
    const box = vis(el)
    if (!box) return null
    let t = box
    try {
      const rg = document.createRange(); rg.selectNodeContents(el)
      const tr = rg.getBoundingClientRect()
      if (tr.width > 0 && tr.height > 0) t = { x: tr.left, y: tr.top, r: tr.right, b: tr.bottom }
    } catch (e) { /* 글자가 없으면 상자를 쓴다 */ }
    const x = Math.max(box.x, t.x), y = Math.max(box.y, t.y)
    const r2 = Math.min(box.r, t.r), b2 = Math.min(box.b, t.b)
    if (r2 - x <= 0 || b2 - y <= 0) return null
    return { x, y, r: r2, b: b2, w: r2 - x, h: b2 - y }
  }
  const kids = [...boxEl.children]

  // 방 상자 — 도면 박스의 직계 div
  for (const d of kids.filter((e) => e.tagName === 'DIV')) {
    const head = d.querySelector(':scope > div')
    if (!head) continue
    const spans = [...head.querySelectorAll(':scope > span')]
    const nameEl = spans[0]
    const rect = vis(d)
    const nameRect = ink(nameEl)          // ⑧ 늘어난 상자가 아니라 «글자»를 잰다
    /**
     * ⛳ **글리프 판정은 «두 방법»이 같은 값을 낼 때만 믿는다** (2026-08-08 사용자 지시).
     * `Range` 와 `width:max-content` 는 서로 다른 길로 글자 폭에 닿는다 — 갈리면
     * 둘 중 하나가 거짓이고, 그때는 판정하지 않는다. 이 계측기의 이력이 그렇게 시킨다.
     */
    if (opt && opt.inkAudit && nameEl && nameRect) {
      const box = nameEl.getBoundingClientRect()
      const sf = nameEl.style.flex, sw = nameEl.style.width
      nameEl.style.flex = '0 0 auto'; nameEl.style.width = 'max-content'
      const mc = nameEl.getBoundingClientRect()
      nameEl.style.flex = sf; nameEl.style.width = sw
      out.inkAudit = out.inkAudit || []
      out.inkAudit.push({
        name: (nameEl.textContent || '').trim(),
        box: +box.width.toFixed(1), range: +nameRect.w.toFixed(1), maxc: +mc.width.toFixed(1),
      })
    }
    if (nameRect) out.rooms.push({ name: (nameEl.textContent || '').trim(), rect, nameRect })
    // 미조사/✓ 배지 — 머리줄의 마지막 «글자 있는» span
    const badge = spans.slice(1).reverse().find((s) => (s.textContent || '').trim())
    const bRect = badge ? ink(badge) : null
    if (bRect && /미조사|✓|Unsearched|Found|Empty/.test(badge.textContent || '')) {
      out.badges.push({ text: (badge.textContent || '').trim(), rect: bRect })
    }
  }

  // 설비 마커 — 직계 span 중 svg 를 품은 것
  const markEls = kids.filter((e) => e.tagName === 'SPAN' && e.querySelector('svg'))
  for (const s of markEls) {
    /**
     * ⑨ **아이콘도 상자가 아니라 «그림»을 잰다** (⑧의 사촌 · 2026-08-08)
     * 확대의 마커 span 은 26×26 인데 안의 svg 는 14×14 다. 상자로 재면 자기
     * 이름표(9px 아래)와 «언제나» 겹친 것으로 나온다 — 전 사건에서 똑같이 나왔고
     * 그 균일함이 지문이었다. ⑧과 같은 부류를 다른 요소에서 또 밟았다.
     */
    const r = vis(s.querySelector('svg') || s)
    if (r) out.fixtures.push({ rect: r })
  }
  /**
   * 설비 «이름표» — 마커 다음에 같은 수만큼 이어진다(`fixtures` 를 두 번 map 한다).
   * 확대에서는 이것도 «보이는 글자»다. 안 세면 없는 쌍이 아니라 «안 세는 쌍»이 된다.
   * 미리보기에서는 HIDE 라 `vis` 가 걸러낸다.
   */
  if (markEls.length) {
    const afterMarks = kids.slice(kids.indexOf(markEls[markEls.length - 1]) + 1)
    const labs = afterMarks.filter((e) => e.tagName === 'SPAN' && !e.querySelector('svg') && !e.hasAttribute('title')).slice(0, markEls.length)
    for (const s of labs) { const r = ink(s); if (r && (s.textContent || '').trim()) out.fxNames.push({ text: (s.textContent || '').trim(), rect: r }) }
  }

  /**
   * ④ 인물 — 점(`title` 있음 · 글자 없음)과 라벨은 **개수가 같고 순서가 같다**
   * (`personMarkers` 를 두 번 map 한다). 짝이 안 맞으면 분류가 틀린 것이므로 죽는다.
   */
  const dots = kids.filter((e) => e.tagName === 'SPAN' && e.hasAttribute('title') && !(e.textContent || '').trim())
  const after = kids.slice(kids.indexOf(dots[dots.length - 1]) + 1)
  const labels = after.filter((e) => e.tagName === 'SPAN').slice(0, dots.length)
  if (dots.length && labels.length !== dots.length) { out.err = '점 ' + dots.length + ' · 라벨 ' + labels.length + ' — 짝이 안 맞는다'; return out }
  for (let i = 0; i < dots.length; i++) {
    const nm = dots[i].getAttribute('title') || ''
    const lt = (labels[i].textContent || '').trim()
    if (lt && lt !== nm) { out.err = '짝 어긋남: 점"' + nm + '" ↔ 라벨"' + lt + '"'; return out }
    const dr = vis(dots[i]), lr = ink(labels[i])
    // 점이 opacity 0 이면 그 인물은 이 시간대에 «없다»
    const op = dots[i].style.opacity
    if (op === '0') continue
    if (dr || lr) out.people.push({ name: nm, dot: dr, label: lr })
  }
  return out
}

let TOTAL_BAD = 0
const ROWS = []

for (const id of CASES) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), ['nobody-lies:' + id, saveFor()])
  await page.goto(BASE + '#case=' + encodeURIComponent(id), { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // 홈 덮개를 걷는다
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const b = [...document.querySelectorAll('div')].find((e) => /^이어하기/.test((e.innerText || '').split('\n')[0]))
    if (b) { b.click(); await wait(500) }
  })
  await page.waitForTimeout(250)

  /**
   * ③ 전이를 «끈다» — 합성이 멈춘 환경에서 전이는 시작값에 고정된다(판례).
   *
   * ⛔ `--no-settle` 은 **그 판례를 재현하는 스위치**다 (2026-08-08 신설).
   * 안 끄고 재면 인물이 «전 시간대의 자리»에서 잡히는데, 안 보이던 인물은
   * `cx=VW/2, cy=VH/2`(도면 «정중앙»)에 겹쳐 서 있다 — 그래서 넷이 한 점에
   * 포개진 것으로 나오고 **인물↔인물이 C(4,2)=6** 이 된다. 결함이 아니라 계측이다.
   */
  if (!has('no-settle')) {
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
  }
  if (SCALE !== 1) await page.addStyleTag({ content: `html{font-size:${16 * SCALE}px}` })

  // 도면 화면으로 «건다» — 클릭 경로를 안 탄다(⑥⑦ 부류의 판정 오류를 피한다)
  const times = await page.evaluate(() => {
    const root = document.querySelector('.app')
    let fiber = null
    for (const k in root) if (k.indexOf('__reactFiber$') === 0) fiber = root[k]
    let inst = null, f = fiber
    while (f && !inst) { if (f.stateNode && f.stateNode.doInvestigate) inst = f.stateNode; f = f.return }
    if (!inst) return null
    window.__inst = inst
    inst.setState({ view: 'map', planZoom: null, planSheet: null })
    return (inst.TIMES || []).map((t) => ({ id: t.id, ko: t.ko }))
  })
  if (!times) { console.log(`⛔ ${id} — React 인스턴스를 못 잡았다`); await ctx.close(); continue }
  await page.waitForTimeout(300)

  const slots = times.concat([{ id: 'now', ko: '현재' }])
  console.log(`\n══ ${id}  ${W}×${H}${SCALE !== 1 ? ` · 글꼴 ${SCALE}×` : ''}${REVEAL ? ' · 전 장 완료' : ''} ══`)

  for (const sl of slots) {
    /**
     * ⛳ **같은 「평면도」가 두 자리다** — 미리보기(`lean`)와 탭-확대(`planZoom`).
     * 08-07의 *"이름이 겹치는 곳에서는 성실함이 자리를 못 고른다"* 가 여기에 그대로
     * 걸린다. `--zoom` 없이 낸 「0」은 **미리보기의 0**이지 도면의 0이 아니다.
     */
    await page.evaluate(([s, z]) => {
      window.__inst.setState(Object.assign(
        s === 'now' ? { planNow: true } : { mapTime: s, planNow: false },
        { planZoom: z ? { s: 1, x: 0, y: 0 } : null },
      ))
    }, [sl.id, has('zoom')])
    await page.waitForTimeout(has('no-settle') ? 30 : 260)

    const m = await page.evaluate(MEASURE, { zoom: has('zoom'), inkAudit: has('ink-audit') })
    if (m.err) { console.log(`  ⛔ ${sl.ko} — 계측 중단: ${m.err}`); TOTAL_BAD++; continue }
    if (m.pick && sl === slots[0]) console.log(`     골랐다: ${m.pick}`)
    if (m.inkAudit && sl === slots[0]) {
      console.log('     글리프 대조  이름            늘어난상자   Range   max-content')
      for (const a of m.inkAudit) {
        const ok = Math.abs(a.range - a.maxc) <= 1.5
        console.log(`       ${ok ? '✓' : '⛔'} ${String(a.name).padEnd(16)} ${String(a.box).padStart(8)} ${String(a.range).padStart(8)} ${String(a.maxc).padStart(10)}`)
      }
    }

    // 인물 라벨이 겹침의 주체다(점은 작다) — 라벨 있으면 라벨, 없으면 점
    const P = m.people.map((p) => ({ name: p.name, rect: p.label || p.dot })).filter((p) => p.rect)
    const RN = m.rooms.filter((r) => r.nameRect).map((r) => ({ name: r.name, rect: r.nameRect, box: r.rect }))
    const FX = m.fixtures.map((f) => f.rect)
    const BG = m.badges.map((b) => b.rect)
    const FN = m.fxNames.map((f) => ({ name: f.text, rect: f.rect }))

    /**
     * ⛔ **쌍을 «손으로 나열하지 않는다»** (2026-08-08 · 세 번째 누락에서 배웠다)
     *
     * ```
     * ⑦⑧        인물↔인물 하나만 셌다        → 미술관 로비의 2·4 를 못 봤다
     * 08-08 아침  여섯을 셌다                  → 설비↔설비가 빠졌다(14×14 완전 포개짐)
     * 08-08 저녁  다섯 분류를 적는다           → 조합 15을 «기계»가 만든다
     * ```
     *
     * 열거하는 방식이 누락을 «만든다». 분류만 선언하면 전수는 정의상 보장된다 —
     * 새 요소가 생기면 배열에 한 줄 더하는 것으로 모든 쌍이 자동으로 늘어난다.
     */
    const roomOf = (r) => (RN.find((x) => x.box && hit(r, x.box)) || {}).name || '?'
    const CLASSES = [
      ['인물', P],
      ['방이름', RN],
      ['설비', FX.map((r) => ({ rect: r }))],
      ['배지', BG.map((r) => ({ rect: r }))],
      ['설비이름', FN],
    ]
    const pairs = {}
    for (let a = 0; a < CLASSES.length; a++) {
      for (let b = a; b < CLASSES.length; b++) {
        const [ka, A] = CLASSES[a], [kb, B] = CLASSES[b]
        const list = []
        for (let i = 0; i < A.length; i++) {
          for (let j = (a === b ? i + 1 : 0); j < B.length; j++) {
            const o = hit(A[i].rect, B[j].rect)
            if (!o) continue
            const who = [A[i].name, B[j].name].filter(Boolean).join('×') || roomOf(A[i].rect)
            list.push(`${who}(${o.w}×${o.h})`)
          }
        }
        pairs[ka + '↔' + kb] = list
      }
    }

    // 방 «밖» — 인물 라벨/점이 자기 방 상자를 벗어났나 (⑦⑧ 이 닫은 결함)
    let outside = 0
    for (const p of P) {
      const home = RN.find((r) => r.box && p.rect.x >= r.box.x - 2 && p.rect.r <= r.box.r + 2 && p.rect.y >= r.box.y - 2 && p.rect.b <= r.box.b + 2)
      if (!home) {
        const near = RN.find((r) => r.box && hit(p.rect, r.box))
        if (near) outside++
      }
    }

    const bad = Object.values(pairs).reduce((s, v) => s + v.length, 0) + outside
    TOTAL_BAD += bad
    // 방마다 몇 명인가 — 「4인이 한 방」인지가 이 결함의 갈림점이다
    const byRoom = RN.map((r) => {
      const n = P.filter((p) => r.box && hit(p.rect, r.box)).length
      return n ? `${r.name}${n}` : null
    }).filter(Boolean).join(' ')
    const census = `인물 ${P.length} · 방이름 ${RN.length} · 설비 ${FX.length} · 배지 ${BG.length}${byRoom ? ' │ ' + byRoom : ''}`
    console.log(`  ${bad === 0 ? '✓' : '⛔'} ${String(sl.ko).padEnd(10)} 겹침 ${String(bad).padStart(2)}   [${census}]`)
    for (const [k, v] of Object.entries(pairs)) if (v.length) console.log(`       ${k} ${v.length}  ${v.slice(0, 6).join(' ')}`)
    if (outside) console.log(`       방 밖 ${outside}`)
    ROWS.push({ id, slot: sl.ko, bad, census })
  }
  await ctx.close()
}
await browser.close()

console.log(`\n${'─'.repeat(58)}`)
console.log(`합계 겹침 ${TOTAL_BAD}  ·  사건 ${CASES.length} · 판 ${ROWS.length}`)
if (TOTAL_BAD > 0) {
  console.log('⛔ 겹침이 있다 — 위 목록이 자리다')
  process.exit(1)
}
console.log('✓ 전수 0')
