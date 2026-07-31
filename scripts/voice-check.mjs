/**
 * ─────────────────────────────────────────────────────────────
 *  진술 목소리 측정기 — `npm run voice-check`
 * ─────────────────────────────────────────────────────────────
 *
 * **다섯이 서로 다른 사람으로 읽히는가**를 여섯 숫자로 잰다.
 *
 * ★ 왜 있나 ★ 2026-07-30 밤에 첫 완성본이 **두께는 산장을 넘겼는데 다섯이 한
 * 사람처럼** 읽혔다. 원인이 서식이었고(`STATEMENT-BRIEF.md` §고친 이력) 넷을 고쳤는데,
 * **검사기가 말투를 못 잡으므로 고친 것이 먹었는지는 재봐야만 안다.**
 *
 * 그때 쓴 측정을 **스크래치패드에만 두고 커밋을 안 했다.** 다음 기계에서
 * `before-work` 를 돌리면 지표 표(숫자)는 문서에 있는데 **재는 도구가 없어서**
 * NEXT-ACTION 의 *"재는 코드를 다시 쓰지 마라"* 가 실행 불가능한 지시가 됐다.
 * 사용자가 *"다른 기기에서 이어갈 수 있는 거 맞아?"* 라고 물어서 잡혔다.
 *
 * ⛔ **빌드 게이트에 걸지 않는다.** 두 이유가 있다:
 *
 *  ① **말투는 합격/불합격이 아니다.** 격식체 세계는 「…했습니다」가 맞고, 판정하려면
 *     사람이 읽어야 한다(`STATEMENT-BRIEF.md` 맨 끝이 그렇게 적어뒀다).
 *  ② **조립본은 언제나 균일하다.** 산문을 안 입힌 생성 사건이 정상이므로, 게이트에
 *     걸면 **모든 생성 사건이 빨개진다** — 검사가 거짓말이 되는 그 부류다
 *     (§9-3e·§9-10 을 경고로 내린 것과 같은 판단).
 *
 * 쓰는 법:
 *   npm run voice-check                      engine/cases/*.yaml 전부
 *   npm run voice-check -- <경로> [<경로>…]   특정 파일 (YAML · JSON 둘 다)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { load } from 'js-yaml'

const CASES = 'engine/cases'

/**
 * 산장 실측. **목표가 아니라 기준선**이다.
 *
 * ★ 숫자를 여기서 뺐다 ★ (2026-07-31) — 진술 서식도 같은 숫자를 쓰는데 양쪽에 손으로
 * 박혀 있었다(`MANIFESTO.md` §남은 일 ③). 이제 **재는 쪽과 의뢰하는 쪽이 같은 파일을
 * 읽는다** — `Generator.jsx` 의 STATEMENT 보충이 여기서 합격 기준을 만든다.
 *
 * 그러면서 `endings` 를 **5 → 4 로 고쳤다.** 5 는 분류의 상한이지 산장이 낸 값이
 * 아니어서, 도구가 「끝맺음 4 ✔ (산장 5)」를 인쇄하고 있었다 — **기준선을 말하는
 * 줄이 기준선을 틀리게 말했다.**
 */
const REF = JSON.parse(readFileSync(join('engine', 'templates', 'voice-ref.json'), 'utf8'))

/**
 * ⚠ **공백을 포함해 센다.** 문서의 「중앙값 279자」가 공백 포함 기준이었고,
 * 제외하면 221자가 나와 **같은 사건이 두 숫자를 갖는다.** 한쪽으로 못박는다.
 */
const joinParas = (ps) => ps.join(' ')

/**
 * 끝맺음 다섯 갈래. **분류는 다섯이 전부다.**
 *
 * ⚠ **라벨에 `/` 를 넣지 마라.** 처음엔 `'죠/지요'`·`'구요/네요'` 였고, 종류 수를
 * `라벨.split('/')` 로 셌더니 **최대치가 5가 아니라 7로 보였다.** 그래서 산장을
 * **「6종」으로 적어 문서 다섯 곳에 박았다** — 실제로는 5종(전부)이다.
 * 이 세션에 측정이 나를 속인 **네 번째**다. 지금은 Set 을 그대로 들고 다닌다.
 */
const ENDINGS = [
  ['요', /요[.?!…]?$/],
  ['습니다', /(습니다|ㅂ니다)[.?!…]?$/],
  ['죠', /(죠|지요)[.?!…]?$/],
  ['구요네요', /(구요|네요|더라구요|던데요|는데요)[.?!…]?$/],
  ['평서', /[^니습]다[.?!…]?$/],
]
/** 분류 수의 상한. 「5종 중 몇」으로 읽어야 숫자에 뜻이 생긴다 */
const ENDING_MAX = ENDINGS.length
const HONOR = /(언니|오빠|형|누나|씨|님|선생|아저씨|아주머니|사장|선배|후배)/g

const text = (x) => (typeof x === 'string' ? x : x?.ko ?? '')
const nameOf = (p) => text(p?.name) || p?.name || p?.id

function measure(c) {
  const people = c.people ?? []
  const victim = text(c.victim?.name) || text(c.incident?.victim_name) || c.victimProfile?.name
  const names = people.map(nameOf).filter(Boolean)
  const rows = []
  for (const p of people) {
    const ps = (p.statement?.paragraphs ?? []).map(text)
    if (!ps.length) continue
    const t = joinParas(ps)
    const me = nameOf(p)
    /**
     * 「남을 불렀나」 — 이름의 **뒤 두 글자**로 찾는다. 산장이 「나경언니」·「리원이」
     * 처럼 성을 떼고 부르기 때문이다(`오나경` → `나경`).
     */
    const others = [...names.filter((n) => n !== me), ...(victim ? [victim] : [])]
      .filter((n) => n && t.includes(n.length > 2 ? n.slice(-2) : n))
    const sents = t.split(/(?<=[.?!…])\s*/).map((s) => s.trim()).filter(Boolean)
    const mix = new Set()
    for (const s of sents) for (const [k, re] of ENDINGS) if (re.test(s)) mix.add(k)
    rows.push({
      who: `${me}(${p.age ?? '?'})`,
      자: t.length,
      문단: ps.length,
      문단당: `${Math.min(...ps.map((x) => x.length))}~${Math.max(...ps.map((x) => x.length))}`,
      남언급: others.length,
      호칭: (t.match(HONOR) ?? []).length,
      물음표: (t.match(/\?/g) ?? []).length,
      끝맺음: [...mix].join('·') || '-',
      _mix: mix,
    })
  }
  if (!rows.length) return null
  const lens = rows.map((r) => r.자).sort((a, b) => a - b)
  const paras = rows.flatMap((r) => r.문단당.split('~').map(Number))
  return {
    rows,
    ratio: +(lens.at(-1) / lens[0]).toFixed(2),
    median: lens[Math.floor(lens.length / 2)],
    paraLo: Math.min(...paras), paraHi: Math.max(...paras),
    callers: rows.filter((r) => r.남언급 > 0).length,
    honor: rows.reduce((a, r) => a + r.호칭, 0),
    question: rows.reduce((a, r) => a + r.물음표, 0),
    endings: new Set(rows.flatMap((r) => [...r._mix])).size,
    total: rows.length,
  }
}

const argv = process.argv.slice(2)
const files = argv.length
  ? argv
  : existsSync(CASES)
    ? readdirSync(CASES).filter((f) => /\.(ya?ml|json)$/.test(f)).map((f) => join(CASES, f))
    : []

if (!files.length) {
  console.error(`\n  잴 사건이 없다. ${CASES}/ 가 비었거나 경로를 안 줬다.\n`)
  process.exit(1)
}

console.log('')
const marks = []
for (const f of files) {
  let c
  try {
    c = f.endsWith('.json') ? JSON.parse(readFileSync(f, 'utf8')) : load(readFileSync(f, 'utf8'))
  } catch (e) {
    console.log(`  ⚠ ${basename(f)} — 읽을 수 없다: ${e.message}\n`)
    continue
  }
  const m = measure(c)
  if (!m) { console.log(`  ⏭ ${basename(f)} — 진술이 없다 (논리만 있는 사건)\n`); continue }
  console.log(`  ═══ ${basename(f)} ═══  (${m.total}명)`)
  console.table(m.rows.map(({ _mix, ...r }) => r))
  const cmp = (v, ref, hi = true) => {
    const ok = hi ? v >= ref * 0.75 : v <= ref
    return `${String(v).padStart(7)}  ${ok ? '✔' : '✘'} (산장 ${ref})`
  }
  console.log(`    최장/최단      ${cmp(m.ratio, REF.ratio)}`)
  console.log(`    문단당 글자    ${String(`${m.paraLo}~${m.paraHi}`).padStart(7)}     (산장 ${REF.paraLo}~${REF.paraHi})`)
  console.log(`    서로를 부름    ${cmp(m.callers, REF.callers)}`)
  console.log(`    호칭           ${cmp(m.honor, REF.honor)}`)
  console.log(`    물음표         ${cmp(m.question, REF.question)}`)
  console.log(`    끝맺음 종류    ${cmp(m.endings, REF.endings)}  ← ${ENDING_MAX}종 중`)
  console.log(`    중앙값         ${String(m.median).padStart(7)}자`)
  console.log('')
  marks.push({ f: basename(f), ...m })
}

/**
 * ✔/✘ 는 **판정이 아니라 눈길을 끄는 표시**다. 기준선의 75% 를 넘으면 ✔ —
 * 산장을 정확히 흉내 내라는 뜻이 아니라 **0 에서 올라왔는가**를 보는 것이다.
 * 격식체 세계는 호칭이 적을 수 있다. **재미는 사람이 읽어야 답한다.**
 */
if (marks.length > 1) {
  console.log('  ─── 한눈에 ───')
  console.log('  사건'.padEnd(30) + '최장/최단  부름  호칭  물음표  끝맺음')
  for (const m of marks) {
    console.log('  ' + m.f.padEnd(28) +
      String(m.ratio).padStart(7) + String(`${m.callers}/${m.total}`).padStart(7) +
      String(m.honor).padStart(6) + String(m.question).padStart(8) + String(m.endings).padStart(8))
  }
  console.log('')
}
console.log('  ⚠ 이 숫자는 합격/불합격이 아니다 — 말투의 자연스러움은 사람이 읽어야 한다.')
console.log('    그래서 빌드 게이트에 걸지 않는다 (조립본은 정상적으로 균일하다).\n')
