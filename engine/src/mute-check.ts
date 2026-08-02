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
 *
 * ## ⚠ 사거리 — 이 도구가 **못 보는 것**
 *
 * ```
 * verifier.ts 의 errors/warnings.push   ✅ 본다. 이것이 세는 대상이다
 * schema.ts 의 p.add(...)               ❌ 못 본다 — 파싱된 뒤 망가뜨리므로 스키마를 안 탄다
 * 게이트의 다른 단                        ❌ 못 본다 (clue-check·brief-check·port-check…)
 * 「검사가 옳은가」                        ❌ 못 본다 — 우는지만 본다
 * ```
 *
 * 첫 판에 그것 때문에 한 번 헛짚었다 — `trick.props` 를 없는 id 로 망가뜨렸는데
 * 안 울려서 「죽은 검사」인 줄 알았다. 재보니 **`schema.ts:528` 이 보고 있었고**
 * 검증기에는 원래 없는 검사였다. **안 울린 자리를 볼 때 스키마 쪽을 먼저 의심한다.**
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
/**
 * `{` 에서 시작해 **짝이 맞는 `}` 다음**으로 간다. 안의 문자열은 통째로 건너뛴다.
 * `skipString` 과 서로를 부른다 — `${}` 안에 또 백틱이 오는 중첩 때문이다.
 */
function skipBraces(s: string, i: number): number {
  let depth = 0
  let j = i
  while (j < s.length) {
    const ch = s[j]!
    if (ch === '`' || ch === "'" || ch === '"') { j = skipString(s, j); continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return j + 1 }
    j++
  }
  return j
}

/** 따옴표 구간 하나를 건너뛴다. 백틱이면 안쪽 `${}` 까지 함께 넘는다. */
function skipString(s: string, i: number): number {
  const q = s[i]!
  let j = i + 1
  while (j < s.length) {
    const ch = s[j]!
    if (ch === '\\') { j += 2; continue }
    if (ch === q) return j + 1
    if (q === '`' && ch === '$' && s[j + 1] === '{') { j = skipBraces(s, j + 1); continue }
    j++
  }
  return j
}

/** 문자열 리터럴 하나에서 **보간을 뺀 정적 토막들**을 뽑는다 */
function staticParts(s: string, i: number): { parts: string[]; end: number } {
  const q = s[i]!
  const parts: string[] = []
  let buf = ''
  let j = i + 1
  while (j < s.length) {
    const ch = s[j]!
    if (ch === '\\') { buf += s[j + 1] ?? ''; j += 2; continue }
    if (ch === q) { parts.push(buf); return { parts, end: j + 1 } }
    if (q === '`' && ch === '$' && s[j + 1] === '{') {
      parts.push(buf); buf = ''
      j = skipBraces(s, j + 1)
      continue
    }
    buf += ch
    j++
  }
  parts.push(buf)
  return { parts, end: j }
}

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
    /**
     * 문자열 리터럴 안의 정적 토막만 남긴다.
     *
     * ⚠ **2026-08-02 — 정규식으로는 안 된다.** 전에는 `` /`[^`]*`/ `` 로 리터럴을
     * 찾고 `${...}` 를 `split` 했는데, **`${}` 안에 백틱이 또 오면** 앞의 정규식이
     * 안쪽 백틱에서 리터럴이 끝난 줄 알고 잘라버린다. 그러면 닻이 **메시지 글자가
     * 아니라 코드 조각**이 된다:
     * ```
     * §9-9 진술 길이 쏠림의 닻   ").join(' · ')}) — 길이가 곧 유용도 표시가 된다"
     *                            ^^^^^^^^^^^^^^^^ 어떤 메시지에도 없는 글자
     * ```
     * **그 자리는 무슨 짓을 해도 「안 울렸다」로 셌다** — 검사가 아니라 도구가
     * 못 알아본 것이다. 이제 중괄호·중첩 백틱을 세면서 걷는다.
     */
    const chunks: string[] = []
    let k = 0
    while (k < arg.length) {
      const ch = arg[k]!
      if (ch === '`' || ch === "'" || ch === '"') {
        const { parts, end } = staticParts(arg, k)
        for (const p of parts) chunks.push(p.trim())
        k = end
        continue
      }
      k++
    }
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
  /**
   * ⛳ **이건 검증기가 아니라 `schema.ts:528` 이 본다** — 그래서 이 도구로는 안 깨어난다.
   * 아래 §사거리 참조. 그래도 남겨둔다: 나중에 검증기 쪽으로 옮기면 그때 울린다.
   */
  { id: '트릭 도구를 없는 id 로', hit: (c) => { c.trick.props = ['e_no_such'] } },
  { id: '허점 심은 자리를 없는 id 로', hit: (c) => { if (c.trick.flaw) c.trick.flaw.plantedIn = ['no_such'] } },
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
  /**
   * ⚠ **2026-08-02 정정 — 필드 이름이 셋 다 틀려 있었다.** `person`·`location` 은
   * `addClaims` 에 없는 이름이고(정본은 `speaker`·`content`·`target`), `as never` 가
   * 그것을 가려서 타입 검사도 안 걸렸다. **그런데도 울리긴 했다** — `speaker` 가
   * `undefined` 라 「화자가 인물 목록에 없다」가 떴을 뿐, 이름표가 말하는
   * 「없는 id 를 가리킨다」를 재고 있지 않았다. **뮤테이션도 심기라서 틀리면 거짓말이 된다.**
   */
  { id: '공개 화자를 없는 인물로', hit: (c) => c.reveals.forEach((r) => {
      r.addClaims = [{ speaker: 'no_such_person', content: '한마디', target: 'statement' }]
    }) },
  { id: '레드헤링을 전부 뗀다', hit: (c) => { c.facts = c.facts.filter((f) => f.kind !== 'context') } },
  { id: '결정적 물증을 하나로', hit: (c) => c.facts.forEach((f) => { f.revealedBy = f.revealedBy.slice(0, 1) }) },

  /**
   * ★★ 2026-08-02 — **평면도 국소 파손** ★★
   *
   * 여기 있던 평면도 뮤테이션은 「통째로 지운다」·「방을 전부 지운다」 둘뿐이라
   * **너무 거칠었다.** 도면을 없애면 §9-3a(`평면도가 없다`) 하나만 울리고 그 아래
   * 기하 검사 열두 자리는 **애초에 실행되지 않는다**(`if (c.floorPlan)` 안에 있다).
   * 그래서 침묵 목록에 평면도가 무리로 뭉쳐 있었다 — 검사가 죽어서가 아니라
   * **도구가 그 자리까지 못 갔던 것**이다.
   *
   * 아래는 전부 **도면을 살려둔 채 한 군데씩** 망가뜨린다.
   */
  { id: '방을 없는 장소로', hit: (c) => { if (c.floorPlan?.rooms[0]) c.floorPlan.rooms[0].loc = 'no_such_loc' } },
  { id: '방을 없는 건물로', hit: (c) => { if (c.floorPlan?.rooms[0]) c.floorPlan.rooms[0].building = 'no_such_building' } },
  { id: '방을 건물 밖으로', hit: (c) => { if (c.floorPlan?.rooms[0]) c.floorPlan.rooms[0].x = -9999 } },
  { id: '방 둘을 겹친다', hit: (c) => {
      const rs = c.floorPlan?.rooms
      if (!rs || rs.length < 2) return
      // 같은 건물 안에서 겹쳐야 §9-3i ⓐ 가 본다 — 건물이 다르면 무리가 갈린다
      rs[1]!.building = rs[0]!.building
      rs[1]!.x = rs[0]!.x; rs[1]!.y = rs[0]!.y
      rs[1]!.w = rs[0]!.w; rs[1]!.h = rs[0]!.h
    } },
  { id: '문을 전부 뺀다', hit: (c) => { if (c.floorPlan) c.floorPlan.doors = [] } },
  { id: '창을 전부 뺀다 (창으로 나갔다는 트릭)', hit: (c) => {
      if (!c.floorPlan) return
      // 「창이 없다」는 **트릭이 창을 말할 때만** 결함이다 — 그래서 이탈 문구도 같이 세운다
      if (c.trick.exit) c.trick.exit.method = '창을 넘어 나갔다'
      c.floorPlan.windows = []
    } },
  { id: '창을 바깥벽에서 뗀다', hit: (c) => {
      const ws = c.floorPlan?.windows
      if (!ws?.length) return
      ws.forEach((w) => { w.x1 = -500; w.y1 = -500; w.x2 = -400; w.y2 = -500 })
    } },
  { id: '현장의 scene 표식을 뗀다', hit: (c) => c.floorPlan?.rooms.forEach((r) => { r.scene = undefined }) },
  { id: '고정물 목록을 비운다', hit: (c) => { if (c.floorPlan) c.floorPlan.fixtures = {} } },
  { id: '고정물을 자기 장소 밖으로', hit: (c) =>
      Object.values(c.floorPlan?.fixtures ?? {}).forEach((f) => { f.x = -9999; f.y = -9999 }) },
  { id: '보행선을 없는 장소로', hit: (c) => c.floorPlan?.walks.forEach((w) => { w.from = 'no_such_loc' }) },
  { id: '보행선에 분만 남긴다', hit: (c) => {
      if (!c.floorPlan) return
      // 보행선이 없는 사건이 있다 — 없으면 하나 세워야 이 자리를 건드릴 수 있다
      if (!c.floorPlan.walks.length) c.floorPlan.walks.push({ x1: 0, y1: 0, x2: 1, y2: 1 })
      c.floorPlan.walks.forEach((w) => { w.min = 7; w.from = undefined; w.to = undefined })
    } },

  /**
   * ★★ 2026-08-02 — **레지스트리 참조** ★★
   *
   * ⛳ 이 넷은 `schema.ts` **도 본다.** 그래도 죽은 자리가 아니다 —
   * **생성 사건은 `parseCase` 를 안 거친다**(`cli.ts` 의 `--generate` 는
   * `run()` 만 부르고 스키마를 안 탄다). 손저작 YAML 은 스키마가 먼저 막지만
   * **생성기 쪽에서는 이 검사들이 유일한 문지기다.**
   */
  { id: '격자 공개에 slot 을 안 준다', hit: (c) => c.reveals.forEach((r) => {
      r.addClaims = [{ speaker: c.people[0]!.id, content: '한마디', target: 'grid' }]
    }) },
  { id: '격자 공개를 없는 slot 으로', hit: (c) => c.reveals.forEach((r) => {
      r.addClaims = [{ speaker: c.people[0]!.id, content: '한마디', target: 'grid', slot: 'no_such_slot' }]
    }) },
  { id: '공개 트리거를 없는 조사로', hit: (c) => c.reveals.forEach((r) => {
      r.trigger = { on: 'action', actionId: 'no_such_action' }
    }) },
  /** §9-17 ⓑ — 추가 진술이 씨앗 아닌 확보 단어를 먼저 말하게 만든다 */
  { id: '추가 진술이 조사 단어를 흘린다', hit: (c) => {
      const seeded = new Set(c.seedTerms ?? [])
      const w = (c.terms ?? []).map((t) => t.word).find((x) => !seeded.has(x))
      if (!w) return
      // ⚠ `addClaims[].content` 는 `Text` 가 아니라 **`string`** 이다 (types.ts:290)
      for (const r of c.reveals)
        for (const cl of r.addClaims ?? []) cl.content = `${cl.content} 그리고 ${w} 말입니다.`
    } },
  { id: '동선 슬롯을 없는 것으로', hit: (c) => c.people.forEach((p) =>
      p.presence.forEach((x) => { x.slot = 'no_such_slot' })) },

  /**
   * ★★ 2026-08-02 — **관계 도식 국소 파손** ★★
   *
   * 평면도와 **똑같은 모양의 구멍**이었다. `관계도를 지운다` 하나뿐이라
   * §9-5 열 자리가 `if (c.relationGraph)` 안에서 통째로 안 돌았고, 그래서
   * 그 뮤테이션은 「아무것도 새로 못 깨운 17종」에 이름을 올리고 있었다.
   * **도식을 살려둔 채** 한 군데씩 망가뜨린다.
   */
  { id: '도식 인물 노드를 없는 인물로', hit: (c) => c.relationGraph?.nodes
      .forEach((n) => { if (n.kind === 'person') n.id = 'no_such_person' }) },
  { id: '도식 비인물 노드의 이름을 뗀다', hit: (c) => c.relationGraph?.nodes
      .forEach((n) => { if (n.kind !== 'person') n.label = undefined }) },
  { id: '도식에서 인물 노드를 뺀다', hit: (c) => {
      if (c.relationGraph) c.relationGraph.nodes = c.relationGraph.nodes.filter((n) => n.kind !== 'person')
    } },
  { id: '도식 간선의 끝점을 없는 노드로', hit: (c) => c.relationGraph?.edges
      .forEach((e) => { e.from = 'no_such_node'; e.to = 'no_such_node2' }) },
  { id: '도식 발견을 없는 조사로', hit: (c) => c.relationGraph?.discoveries
      .forEach((d) => { d.action = 'no_such_action' }) },

  /** ★ 짝 조사 (§9-6) — 지금껏 `pair` 를 건드리는 뮤테이션이 하나도 없었다 */
  { id: '짝 조사를 없는 인물로', hit: (c) => c.actions
      .forEach((a) => { a.pair = ['no_such_a', 'no_such_b'] }) },
  { id: '짝 조사를 같은 사람 둘로', hit: (c) => {
      const p = c.people[0]; if (!p) return
      c.actions.forEach((a) => { a.pair = [p.id, p.id] })
    } },
  { id: '짝과 대상을 둘 다 준다', hit: (c) => {
      const [p, q] = c.people; if (!p || !q) return
      c.actions.forEach((a) => { if (a.target) a.pair = [p.id, q.id] })
    } },
  { id: '조사에서 지목 지점을 뗀다', hit: (c) => c.actions
      .forEach((a) => { a.target = undefined; a.pair = undefined }) },

  /** ★ 허점이 심긴 자리를 **얻을 수 없게** 만든다 (§9-4 끝) */
  { id: '허점을 못 얻는 물증에 심는다', hit: (c) => {
      const ev = c.evidence[0]
      if (!ev || !c.trick.flaw) return
      c.trick.flaw.plantedIn = [ev.id]
      c.actions.forEach((a) => { a.gives = a.gives.filter((g) => g !== ev.id) })
    } },

  /**
   * ─────────────────────────────────────────────────────────────
   *  ★★ 2026-08-02 (2차) — **「전부」로는 안 울리는 자리들** ★★
   * ─────────────────────────────────────────────────────────────
   *
   * 남은 침묵을 하나씩 읽어보니 **뚜렷한 부류 하나**가 있었다: 검사가 무는 것이
   * **「섞여 있음」**인데 뮤테이션은 **「전부」**를 하고 있었다.
   *
   * ```
   * §9-14  기록이 「섞여」 있으면 유무가 유용도 표시다   ←  물증 기록을 「전부」 비웠다 → 안 문다
   * §6.56  설명 없는 단어가 「섞여」 있으면 경고         ←  확보 단어를 「전부」 지웠다 → 안 문다
   * §6.7   서사가 「일부」 장에만 있으면 신호            ←  이미 「한 장만」 판이 있어서 울고 있었다
   * ```
   *
   * **전부 지우면 균일해져서 「유무가 갈린다」 부류는 오히려 조용해진다.**
   * §절대 규칙(유용도 비노출)을 지키는 검사들이 통째로 이 모양이라 무리로 묶였다.
   */
  { id: '단어 주는 물증의 기록을 절반만 비운다', hit: (c) => {
      const giving = c.evidence.filter((e) => (e.yieldsTerms?.length ?? 0) > 0)
      if (giving.length < 2) return
      giving.slice(0, Math.floor(giving.length / 2)).forEach((e) => { e.record = undefined })
    } },
  { id: '확보 단어 설명을 하나만 남긴다', hit: (c) => {
      if ((c.terms?.length ?? 0) > 1) c.terms = c.terms!.slice(0, 1)
    } },
  { id: '진술 길이를 쏠리게 한다', hit: (c) => {
      const [p, q] = c.people
      if (!p?.statement?.paragraphs?.length || !q?.statement?.paragraphs?.length) return
      const one = p.statement.paragraphs[0]!
      p.statement.paragraphs = [one, one, one, one, one, one]
      q.statement.paragraphs = [q.statement.paragraphs[0]!]
    } },

  /** ★ 유일성 — 무고한 한 명에게 동기·기회·수단을 통째로 붙인다 */
  { id: '무고한 자에게 유죄 삼요소를 준다', hit: (c) => {
      const inn = c.people.find((p) => p.id !== c.culprit)
      if (!inn) return
      c.facts = c.facts.filter((f) => !(f.subject === inn.id && f.kind === 'no_opportunity'))
      for (const k of ['motive', 'opportunity', 'means'] as const) {
        const src = c.facts.find((f) => f.kind === k && f.subject === c.culprit)
        if (src) c.facts.push({ ...src, id: `${src.id}_dup`, subject: inn.id })
      }
    } },

  /** ★ 찍기 — 지목 장이 조사 없이 닫히게 만든다 */
  { id: '장을 조사 없이 닫히게 만든다', hit: (c) => c.chapters.forEach((ch) => {
      ch.requiresFacts = []
      ch.blanks.forEach((b) => { b.candidates = 'closed' })
    }) },

  /** ★ decoy 가 필수 경로에 개입한다 */
  { id: 'decoy 공개가 사실·조사를 연다', hit: (c) => {
      const f = c.facts[0], a = c.actions[0]
      if (!f || !a) return
      c.reveals.forEach((r) => { r.yield = 'decoy'; r.facts = [f.id]; r.actions = [a.id] })
    } },

  /** ★ 서술문 ↔ 공란 1:1 (§6.75) — 참조를 없애거나 겹치게 한다 */
  { id: '서술문에서 공란 참조를 뗀다', hit: (c) => c.chapters.forEach((ch) => {
      if (ch.report?.length) ch.report = ch.report.map((r) => ('blank' in r ? { text: '…' } : r))
    }) },
  { id: '서술문이 같은 공란을 두 번 묻는다', hit: (c) => c.chapters.forEach((ch) => {
      if (ch.report?.length && ch.blanks.length) ch.report = [...ch.report, { blank: 0 }]
    }) },

  /** ★ 사망 구간·알리바이의 전제 (§7.5) */
  { id: '범인의 알리바이 거짓말을 뗀다', hit: (c) => {
      const cu = c.people.find((p) => p.id === c.culprit)
      if (cu) cu.claim = undefined
    } },
  { id: '범인의 진술을 진실과 같게', hit: (c) => {
      const cu = c.people.find((p) => p.id === c.culprit)
      if (cu) cu.claim = cu.presence.map((x) => ({ ...x }))
    } },
  { id: '사망 시간대 표식을 뗀다', hit: (c) => c.slots.forEach((s) => { s.isWindow = undefined }) },
  { id: '현장을 비운다', hit: (c) => { c.incident.scene = undefined } },
  { id: '사망 구간 이름표를 기계 것으로', hit: (c) => c.slots.forEach((s, i) => {
      if (i < 2) { s.isWindow = true; s.label = `${typeof s.label === 'string' ? s.label : ''} (전반)` }
    }) },

  /** ★ 사망 구간 축소 (§9-3g) — 뒤집기와 「한 칸도 안 덮음」 */
  { id: '축소 범위를 뒤집는다', hit: (c) => {
      const first = c.slots[0], last = c.slots[c.slots.length - 1]
      if (!first || !last || first === last) return
      c.reveals.forEach((r) => { r.narrowsWindow = [last.id, first.id] })
    } },
  { id: '축소가 사망 구간을 안 덮게', hit: (c) => {
      const off = c.slots.find((s) => !s.isWindow)
      if (!off) return
      c.reveals.forEach((r) => { r.narrowsWindow = [off.id, off.id] })
    } },

  /** ★ 누설 (§9-7b · §9-12 · §9-13) — 산문에 심는다 */
  { id: '프롤로그가 조사 단어를 흘린다', hit: (c) => {
      const seeded = new Set(c.seedTerms ?? [])
      const leak = (c.terms ?? []).map((t) => t.word).find((w) => !seeded.has(w))
      if (!leak) return
      c.prologue = [...(c.prologue ?? []), { ko: `그날 밤, ${leak} 이 거기 있었다` }]
    } },
  { id: '진술이 남의 사망구간 위치를 말한다', hit: (c) => {
      const ko = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')
      const win = c.slots.find((s) => s.isWindow)
      const loc = c.locations[0]
      const [p, q] = c.people
      if (!p?.statement || !q || !win || !loc) return
      // 성을 뗀 꼴로 찾으므로(§9-12) 이름을 그대로 넣으면 뒤 두 글자가 걸린다
      p.statement.paragraphs = [
        ...(p.statement.paragraphs ?? []),
        { ko: `${ko(q.name)}는 ${ko(win.label)}에 ${ko(loc.label)}에 있었다` },
      ]
    } },
  { id: '도식이 범인만 가리키는 danger 간선을 연다', hit: (c) => {
      const g = c.relationGraph
      if (!g) return
      // 피해자는 people 밖이라(schema §victim) 끝점으로 써도 「닿은 인물」이 늘지 않는다
      g.edges = [{ from: c.culprit, to: c.victim, label: { ko: '의심' }, danger: true }]
    } },
]

const clone = (c: Case): Case => JSON.parse(JSON.stringify(c)) as Case

/**
 * ⚠ **2026-08-02 — 망가뜨릴 표본이 생성 사건뿐이었다.**
 *
 * `healthy` 는 [생성 N건 · 저작 YAML 4건 · 서식 1건] 순인데 `slice(0, 8)` 이라
 * **앞의 생성분만 잘라 쓰고 있었다.** 손저작에만 걸리는 검사(산문 층·§5-b 부류)는
 * 그래서 **영영 심어볼 수 없었다** — 침묵이 「검사가 죽었다」가 아니라
 * 「표본에 그런 사건이 없다」였던 자리가 섞여 있었다는 뜻이다.
 *
 * 생성 4 + 저작 전부로 바꾼다. 갈래마다 하나씩은 들어간다.
 */
const sample = [...healthy.slice(0, 4), ...healthy.slice(N)]

const byMutator = new Map<string, number>()
for (const m of MUTATORS) {
  const before = heard.size
  for (const c of sample) {
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
// ⚠ 자르지 않는다 — **이 목록이 곧 다음에 할 일**이다. 30개에서 끊으면
//    「그 밖 23개」가 영영 안 보여서 도구가 자기 산출물을 숨긴다 (2026-08-02).
for (const s of silent)
  console.log(`    ${s.kind === 'error' ? '⛔' : '  '} verifier.ts:${String(s.line).padStart(4)}  ${s.anchor.slice(0, 46)}`)

console.log(`\n  ── 뮤테이션이 새로 깨운 문장 수 (${MUTATORS.length}종) ──`)
for (const [id, n] of [...byMutator].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`    ${String(n).padStart(3)}  ${id}`)
const dead = [...byMutator].filter(([, n]) => n === 0).map(([id]) => id)
if (dead.length) console.log(`\n    아무것도 새로 못 깨운 뮤테이션 ${dead.length}종: ${dead.join(' · ')}`)
console.log('')
