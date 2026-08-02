/**
 * ─────────────────────────────────────────────────────────────
 *  침묵 검사 — `npm run mute-check [건수]`
 * ─────────────────────────────────────────────────────────────
 * (2026-08-01 밤 신설 · `MEMORY.md` §검사를 믿는 법)
 *
 * ## 왜 있나
 *
 * **통과에는 두 가지 이유가 있는데 화면에는 둘 다 「초록」으로 보인다:**
 * ⓐ 진짜로 괜찮다 · ⓑ **검사가 구별을 못 한다.** 2026-08-01 밤에 ⓑ가 **셋** 나왔다
 * (옛 §5 는 한 번도 발화한 적이 없었고, §6.8 은 손저작에서 아무 답이나 통과시켰고,
 * `clue-check` 은 검증기 배선을 지워도 초록이었다). 셋 다 **한 번도 안 울려서**
 * 잘 돌아가는 것처럼 보였다.
 *
 * `verifier.ts` 가 하는 주장은 **백 개가 넘는다.** 전부 손으로 심어보는 것은
 * 여러 세션이 드므로, **기계가 먼저 의심 목록을 줄인다.**
 *
 * ## 무엇을 하나
 *
 * ```
 * ① verifier.ts 를 읽어 errors.push / warnings.push 자리를 전부 찾는다
 * ② 성한 사건에 검증기를 돌려 「울린 것」을 모은다        ← 경고가 주로 여기서 난다
 * ③ 사건을 기계적으로 망가뜨려 다시 돌린다                ← 오류가 여기서 난다
 * ④ ②③ 어디에서도 안 울린 자리를 인쇄한다                ← 의심 목록
 * ```
 *
 * ⚠ **「안 울렸다 = 고장」이 아니다.** 좋은 검사도 성한 사건에서는 안 운다. 여기
 * 뜨는 것은 **「이 뮤테이션들로는 못 건드린 자리」**이고, 판정은 그 자리에 맞는
 * 결함을 **손으로 심어봐야** 난다. 이 도구는 **어디를 심을지**를 좁혀준다.
 *
 * ⛔ **게이트에 걸지 않는다** — 기준치가 없다. 뮤테이션을 늘리면 숫자가 움직이므로
 * 「몇 개 이하」로 물면 검사가 거짓말이 된다(`world-check`·`proof-check` 과 같은 자리).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { parseCase } from './schema.js'
import { generateCase } from './generate.js'
import { verify } from './verifier.js'
import type { Case } from './types.js'

const N = Number(process.argv[2] ?? 12)

/** ─── ① 주장 자리를 전부 찾는다 ───────────────────────────── */

type Site = { line: number; kind: 'error' | 'warn'; anchor: string }

/**
 * 각 자리에서 **보간이 없는 가장 긴 글자 토막**을 닻으로 쓴다.
 * 문안이 `${}` 로 이어 붙므로 통째 비교는 안 되고, 닻이 실제 메시지에 들어 있으면
 * 그 자리가 울린 것으로 본다.
 *
 * ⚠ **닻이 짧으면 남의 메시지에 우연히 들어간다.** 6자 미만은 버리고 `?` 로 센다 —
 * **셀 수 없는 것을 「울렸다」로 세면 이 도구가 그 자체로 거짓말이 된다.**
 */
function sites(src: string): { found: Site[]; unanchored: number } {
  const found: Site[] = []
  let unanchored = 0
  const re = /(errors|warnings)\.push\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    // 괄호 균형으로 인자 구간을 자른다
    let depth = 1
    let i = re.lastIndex
    while (i < src.length && depth > 0) {
      const ch = src[i]!
      if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    const arg = src.slice(re.lastIndex, i - 1)
    // 문자열 리터럴 안의 정적 토막만 남긴다
    const chunks: string[] = []
    for (const lit of arg.match(/`[^`]*`|'[^']*'|"[^"]*"/g) ?? [])
      for (const part of lit.slice(1, -1).split(/\$\{[^}]*\}/g)) chunks.push(part.trim())
    const anchor = chunks.sort((a, b) => b.length - a.length)[0] ?? ''
    const line = src.slice(0, m.index).split('\n').length
    if (anchor.length < 6) {
      unanchored++
      continue
    }
    found.push({ line, kind: m[1] === 'errors' ? 'error' : 'warn', anchor })
  }
  return { found, unanchored }
}

/** ─── ② 성한 사건 ─────────────────────────────────────────── */

const heard = new Set<string>()
const listen = (c: Case) => {
  const r = verify(c)
  for (const s of [...r.errors, ...r.warnings]) heard.add(s)
}

const healthy: Case[] = []
for (let i = 1; i <= N; i++) healthy.push(generateCase(i) as Case)
for (const f of readdirSync(join('cases')).filter((x) => x.endsWith('.yaml')))
  healthy.push(parseCase(load(readFileSync(join('cases', f), 'utf8')), f))
healthy.push(parseCase(load(readFileSync(join('templates', 'case-template.yaml'), 'utf8')), 'tmpl'))
for (const c of healthy) listen(c)
const afterHealthy = heard.size

/** ─── ③ 기계적으로 망가뜨린다 ─────────────────────────────── */

/**
 * 뮤테이션 하나 = **한 종류의 결함**. 사건을 깊은 복사해서 망가뜨리고 검증기에 준다.
 * 여기 없는 종류는 아래 「안 울린 자리」에 남으므로, **목록이 곧 이 도구의 사거리다.**
 */
const MUTATORS: { id: string; hit: (c: Case) => void }[] = [
  { id: '물증 기록을 비운다', hit: (c) => c.evidence.forEach((e) => { e.record = undefined }) },
  { id: '물증 설명을 비운다', hit: (c) => c.evidence.forEach((e) => { e.description = '' as never }) },
  { id: '조사 결과문을 지운다', hit: (c) => c.actions.forEach((a) => { a.result = undefined }) },
  { id: '조사 비용을 0 으로', hit: (c) => c.actions.forEach((a) => { a.cost = 0 }) },
  { id: '조사 비용을 크게', hit: (c) => c.actions.forEach((a) => { a.cost = 9 }) },
  { id: '예산을 1 로', hit: (c) => { c.budget = 1 } },
  { id: '예산을 999 로', hit: (c) => { c.budget = 999 } },
  { id: '조사를 절반 지운다', hit: (c) => { c.actions = c.actions.slice(0, Math.ceil(c.actions.length / 2)) } },
  { id: '물증을 절반 지운다', hit: (c) => { c.evidence = c.evidence.slice(0, Math.ceil(c.evidence.length / 2)) } },
  { id: '사실의 획득 경로를 끊는다', hit: (c) => c.facts.forEach((f) => { f.revealedBy = [] }) },
  { id: '사실을 전부 지운다', hit: (c) => { c.facts = [] } },
  { id: '인상을 깨는 물증을 뗀다', hit: (c) => c.trick.illusions.forEach((i) => { i.brokenBy = [] }) },
  { id: '인상을 전부 지운다', hit: (c) => { c.trick.illusions = [] } },
  { id: '이탈 방법을 뗀다', hit: (c) => { c.trick.exit = undefined } },
  { id: '아키타입을 밀실로 바꾼다', hit: (c) => { c.trick.types = ['locked_room'] } },
  { id: '아키타입을 위장자살로', hit: (c) => { c.trick.types = ['staged_suicide'] } },
  { id: '지목 공란을 무고한 자로', hit: (c) => c.chapters.forEach((ch) => ch.blanks.forEach((b) => {
      if (b.isAccusation) b.answer = c.people.find((p) => p.id !== c.culprit)!.id
    })) },
  { id: '지목 공란을 전부 지운다', hit: (c) => c.chapters.forEach((ch) => ch.blanks.forEach((b) => { b.isAccusation = undefined })) },
  { id: '공란 답을 이웃으로 민다', hit: (c) => c.chapters.forEach((ch) => ch.blanks.forEach((b) => {
      const pool = c.people.map((p) => p.id) as string[]
      const i = pool.indexOf(String(b.answer))
      if (i >= 0) b.answer = pool[(i + 1) % pool.length]!
    })) },
  { id: '서술문을 지운다', hit: (c) => c.chapters.forEach((ch) => { ch.report = undefined }) },
  { id: '서술문을 한 장만 남긴다', hit: (c) => c.chapters.forEach((ch, i) => { if (i) ch.report = undefined }) },
  { id: '장 열림 문구를 한 장만', hit: (c) => c.chapters.forEach((ch, i) => { if (i) ch.opening = undefined }) },
  { id: '진술을 지운다', hit: (c) => c.people.forEach((p) => { p.statement = undefined }) },
  { id: '지문을 한 명만 남긴다', hit: (c) => c.people.forEach((p, i) => { if (i && p.statement) p.statement.gesture = undefined }) },
  { id: '무고한 자에게 거짓말을', hit: (c) => {
      const scene = c.incident.scene ?? c.locations[0]!.id
      c.people.forEach((p) => {
        if (p.id !== c.culprit && !p.claim && p.presence?.length)
          p.claim = p.presence.map((x, i) => (i ? x : { ...x, location: scene }))
      })
    } },
  { id: '동선을 전부 현장으로', hit: (c) => {
      const scene = c.incident.scene ?? c.locations[0]!.id
      c.people.forEach((p) => p.presence?.forEach((x) => { x.location = scene }))
    } },
  { id: '현장 서술을 지운다', hit: (c) => { c.incident.sceneState = undefined } },
  { id: '씨앗 단어를 지운다', hit: (c) => { c.seedTerms = [] } },
  { id: '확보 단어를 지운다', hit: (c) => { c.terms = [] } },
  { id: '장 공개를 지운다', hit: (c) => { c.reveals = [] } },
  { id: '장 공개 서사를 한 개만', hit: (c) => c.reveals.forEach((r, i) => { if (i) r.narration = undefined }) },
  { id: '평면도를 지운다', hit: (c) => { c.floorPlan = undefined } },
  { id: '평면도 방을 지운다', hit: (c) => { if (c.floorPlan) c.floorPlan.rooms = [] } },
  { id: '관계도를 지운다', hit: (c) => { c.relationGraph = undefined } },
  { id: '프롤로그를 지운다', hit: (c) => { c.prologue = undefined } },
  { id: '에필로그를 한 장만', hit: (c) => c.chapters.forEach((ch, i) => { if (i) ch.epilogue = undefined }) },

  /**
   * ★ 아래는 **첫 판의 침묵 목록을 보고 겨냥해서 더한 것들이다** ★
   * 33%(39/117)에서 시작했다. 「사거리 밖」과 「검사가 무의미」를 가르려면
   * **먼저 사거리를 넓혀야 한다** — 안 그러면 침묵이 전부 도구 탓인지 알 수 없다.
   */
  { id: '트릭 허점을 비운다', hit: (c) => { if (c.trick.flaw) c.trick.flaw.text = '' } },
  { id: '허점 심은 자리를 뗀다', hit: (c) => { if (c.trick.flaw) c.trick.flaw.plantedIn = [] } },
  { id: '아키타입을 없는 것으로', hit: (c) => { c.trick.types = ['no_such_trick' as never] } },
  { id: '아키타입을 정체뒤바꾸기로', hit: (c) => { c.trick.types = ['identity_swap'] } },
  { id: '아키타입을 지운다', hit: (c) => { c.trick.types = [] } },
  { id: '이탈 칸을 없는 것으로', hit: (c) => { if (c.trick.exit) c.trick.exit.slot = 'no_such_slot' as never } },
  { id: '이탈을 드러낼 물증을 뗀다', hit: (c) => { if (c.trick.exit) c.trick.exit.brokenBy = [] } },
  { id: '트릭 도구를 없는 id 로', hit: (c) => { c.trick.props = ['e_no_such'] } },
  { id: '사실 경로를 없는 id 로', hit: (c) => c.facts.forEach((f) => { f.revealedBy = ['e_no_such'] }) },
  { id: '조사가 없는 물증을 준다', hit: (c) => c.actions.forEach((a) => { a.gives = ['e_no_such'] }) },
  { id: '조사를 빈손으로 선언', hit: (c) => c.actions.forEach((a) => { a.yield = 'empty' }) },
  { id: '조사를 하나만 남긴다', hit: (c) => { c.actions = c.actions.slice(0, 1) } },
  { id: '공란 답을 어휘 밖으로', hit: (c) => c.chapters.forEach((ch) => ch.blanks.forEach((b) => { b.answer = '없는답' as never })) },
  { id: '공란을 전부 지운다', hit: (c) => c.chapters.forEach((ch) => { ch.blanks = [] }) },
  { id: '장을 하나만 남긴다', hit: (c) => { c.chapters = c.chapters.slice(0, 1) } },
  { id: '장 순서를 뒤집는다', hit: (c) => { c.chapters = [...c.chapters].reverse() } },
  { id: '장 선행 사실을 뒤섞는다', hit: (c) => {
      const need = c.chapters.map((ch) => ch.requiresFacts)
      c.chapters.forEach((ch, i) => { ch.requiresFacts = need[need.length - 1 - i] })
    } },
  { id: '확보 단어 출처를 비운다', hit: (c) => (c.terms ?? []).forEach((t) => { t.source = { ko: '' } }) },
  { id: '확보 단어를 주지 않게', hit: (c) => c.evidence.forEach((e) => { e.yieldsTerms = [] }) },
  { id: '현장을 없는 장소로', hit: (c) => { c.incident.scene = 'no_such_place' as never } },
  { id: '범인을 없는 사람으로', hit: (c) => { c.culprit = 'no_such_person' as never } },
  { id: '공개 대상을 없는 id 로', hit: (c) => c.reveals.forEach((r) => { r.addClaims = [{ person: 'no_such', slot: 'no_such', location: 'no_such' } as never] }) },
  { id: '레드헤링을 전부 뗀다', hit: (c) => { c.facts = c.facts.filter((f) => f.kind !== 'context') } },
  { id: '결정적 물증을 하나로', hit: (c) => c.facts.forEach((f) => { f.revealedBy = f.revealedBy.slice(0, 1) }) },
]

const clone = (c: Case): Case => JSON.parse(JSON.stringify(c)) as Case
const byMutator = new Map<string, number>()
for (const m of MUTATORS) {
  const before = heard.size
  for (const c of healthy.slice(0, Math.min(healthy.length, 8))) {
    const x = clone(c)
    try {
      m.hit(x)
      listen(x)
    } catch {
      /* 망가뜨린 사건이 검증기를 던지게 하는 것도 정보다 — 아래 요약에 안 센다 */
    }
  }
  byMutator.set(m.id, heard.size - before)
}

/** ─── ④ 인쇄 ──────────────────────────────────────────────── */

const src = readFileSync(fileURLToPath(new URL('./verifier.ts', import.meta.url)), 'utf8')
const { found, unanchored } = sites(src)
const silent = found.filter((s) => ![...heard].some((h) => h.includes(s.anchor)))

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : '—')
console.log(`\n  verifier.ts 의 주장 ${found.length}개 (닻을 못 잡은 것 ${unanchored}개는 뺐다)`)
console.log(`  들은 문장 ${heard.size}종 — 성한 사건 ${afterHealthy}종 + 망가뜨려서 ${heard.size - afterHealthy}종\n`)
console.log(`  울렸다      ${String(found.length - silent.length).padStart(4)} / ${found.length}   ${pct(found.length - silent.length, found.length)}`)
console.log(`  안 울렸다   ${String(silent.length).padStart(4)}        ← 의심 목록. **고장이라는 뜻이 아니다**\n`)

const sErr = silent.filter((s) => s.kind === 'error')
const sWarn = silent.filter((s) => s.kind === 'warn')
console.log(`  ── 안 울린 자리 (오류 ${sErr.length} · 경고 ${sWarn.length}) ──`)
for (const s of silent.slice(0, 30))
  console.log(`    ${s.kind === 'error' ? '⛔' : '  '} verifier.ts:${String(s.line).padStart(4)}  ${s.anchor.slice(0, 46)}`)
if (silent.length > 30) console.log(`    … 그 밖 ${silent.length - 30}개`)

console.log(`\n  ── 뮤테이션이 새로 깨운 문장 수 (${MUTATORS.length}종) ──`)
for (const [id, n] of [...byMutator].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`    ${String(n).padStart(3)}  ${id}`)
const dead = [...byMutator].filter(([, n]) => n === 0).map(([id]) => id)
if (dead.length) console.log(`\n    아무것도 새로 못 깨운 뮤테이션 ${dead.length}종: ${dead.join(' · ')}`)
console.log('')
