import { DOMAIN_OF, ARCHETYPES, ILLUSION_KINDS } from './types.js'
import type {
  Action, Blank, BlankLabel, Case, Chapter, Evidence, Fact, FloorPlan, Location, Person, RelationGraph,
  PresenceCell, Particle, Reveal, Slot, Text,
} from './types.js'

/**
 * 사건 YAML → Case.
 *
 * **이름은 바꾸되 의미는 만들지 않는다.** snake_case ↔ camelCase 변환과
 * `at` ↔ `location` 같은 단순 개명만 한다. 한쪽 값에서 다른 쪽 값을 도출하지 않는다 —
 * 같은 사건이 두 표현으로 존재하면서 파생 규칙이 끼면 반드시 어긋난다.
 * (2026-07-24에 엔진과 프로토타입이 그렇게 14곳 어긋나 있었다.)
 *
 * 검증은 두 층이다.
 *   이 파일   구조·어휘·참조 무결성. "e_foo 라는 물증이 없다" 류
 *   verifier  논리. "유죄가 유일한가" 류
 *
 * ★ 이 파일은 **브라우저에서도 돈다** — Node 를 물리지 마라 ★ (2026-07-29)
 *
 * 앱의 YAML 내보내기가 `parseCase` 로 **왕복 대조**를 한다(`Generator.jsx`).
 * 한때 `loadCaseFile` 이 여기 살아서 `node:fs` 가 딸려왔고, 그 한 줄 때문에
 * 파싱기 전체가 앱에서 못 쓰였다. 디스크를 읽는 일은 `load-case.ts` 에 있다.
 * **여기에 `node:*` 를 import 하면 앱의 내보내기가 대조 없이 나간다.**
 */

type Raw = Record<string, any>

class Problems {
  private list: string[] = []
  add(path: string, msg: string) { this.list.push(`${path}: ${msg}`) }
  get count() { return this.list.length }
  throwIfAny(source: string): void {
    if (!this.list.length) return
    throw new Error(
      `${source} — 사건 파일에 문제 ${this.list.length}건\n` +
        this.list.map((p) => `  · ${p}`).join('\n'),
    )
  }
}

const BLANK_LABELS = new Set(Object.keys(DOMAIN_OF))
const PARTICLES = new Set(['이/가', '을/를', '은/는', '과/와', '(으)로'])
const FACT_KINDS = new Set([
  'identity', 'opportunity', 'no_opportunity',
  'motive', 'means', 'contradiction', 'context',
])
const YIELDS = new Set(['solution', 'redherring', 'exclusion', 'empty'])
/** 조사 갈래. 앱 `INV_ACTIONS` 여섯과 같은 집합이다 (`types.ts` `ActionVerb`) */
const ACTION_VERBS = new Set(['belongings', 'search', 'phone', 'alibi', 'autopsy', 'fixture'])
/** 프로필 카드의 세 칸. 유죄 조건 셋과 같다 (`types.ts` `ProfileSlot`) */
const PROFILE_SLOTS = new Set(['motive', 'means', 'opportunity'])
const REVEAL_YIELDS = new Set(['path', 'narrow', 'decoy', 'flavor'])
const SURFACES = new Set(['statement', 'map', 'graph', 'suspect', 'overview'])
const HIDDEN_ROLES = new Set([
  'ringleader', 'accomplice', 'coerced', 'investigator', 'unaware',
])
const INCIDENT_KINDS = new Set([
  'homicide', 'theft', 'leak', 'forgery', 'disappearance', 'sabotage', 'audit',
])

function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : []
}

/**
 * **필수 숫자 칸.** 있는지만 보지 말고 숫자인지도 본다.
 *
 * 2026-07-31에 재서 확인했다 — `cost` 를 지우거나 `'한개'` 를 넣으면 파싱도 검증기도
 * 통과하고, 게이트가 **`기대 NaN회` 인데 난이도 `easy` · 「검증 통과」**를 인쇄했다.
 * `types.ts` 는 `cost: number` 라고 말하는데 그걸 확인하는 코드가 한 줄도 없었다.
 * **타입이 거짓말을 하고 게이트가 초록으로 그 거짓말을 찍는다** — NaN 은 비교가 전부
 * 거짓이라 난이도 사다리를 조용히 맨 아래로 떨어뜨린다.
 *
 * ⚠ 기하(`floorPlan`·`relationGraph`)의 `num` 은 일부러 너그럽다 — 좌표는 검증기
 * §9-3i 가 따로 재고, 없는 좌표는 0 이 맞는 기본값이다. 여기는 그 층이 아니다.
 */
function reqNum(p: Problems, path: string, v: unknown): number {
  if (v === undefined || v === null) {
    p.add(path, '필수 숫자인데 비어 있다')
    return 0
  }
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) {
    p.add(path, `숫자여야 한다 (받은 값: ${JSON.stringify(v)})`)
    return 0
  }
  return n
}

/**
 * **id 중복.** 조회 집합을 `new Set(...)` 으로 만들면 중복이 **조용히 삼켜진다** —
 * 뒤엣것은 배열에 남아 있는데 id 로는 영원히 앞엣것만 잡힌다.
 *
 * 2026-07-31에 재서 확인했다 — 같은 id 를 **더해서** 넣으면 파싱·검증기 둘 다 통과했다.
 * 그전에 「중복이 물린다」고 보였던 것은 id 를 **덮어써서** 원래 id 가 사라지는 바람에
 * 엉뚱한 곳의 참조가 깨진 것이었다. **중복 자체는 아무도 안 보고 있었다.**
 */
function uniqueIds(p: Problems, path: string, ids: unknown[]): void {
  const seen = new Set<string>()
  ids.forEach((raw, i) => {
    if (raw === undefined || raw === null) return
    const id = String(raw)
    if (seen.has(id))
      p.add(`${path}[${i}]`, `id '${id}' 가 중복이다 — 앞엣것에 가려 영원히 참조되지 않는다`)
    seen.add(id)
  })
}

/**
 * 문장 하나. 저작 편의를 위해 두 형태를 다 받는다.
 *   "한 줄"                     → { ko: '한 줄' }        번역 전
 *   { ko: '한 줄', en: 'A line' } → 그대로               번역 후
 */
function text(v: unknown): Text | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string') return { ko: v }
  const o = v as Raw
  return { ko: String(o.ko ?? ''), ...(o.en ? { en: String(o.en) } : {}) }
}

function texts(v: unknown): Text[] {
  return arr(v).map((x) => text(x)!).filter(Boolean)
}

/**
 * 평면도 로더. YAML 은 snake_case, 타입은 camelCase 다.
 *
 * 좌표는 그대로 통과시키고 이름만 옮긴다 — 기하 검증은 검증기가 한다.
 */
function relationGraph(raw: Raw): RelationGraph {
  const num = (v: unknown) => Number(v ?? 0)
  return {
    nodes: arr(raw.nodes).map((n: Raw) => ({
      id: n.id, kind: n.kind, x: num(n.x), y: num(n.y),
      ...(n.label ? { label: text(n.label)! } : {}),
      ...(n.revealed_after !== undefined ? { revealedAfter: num(n.revealed_after) } : {}),
    })),
    edges: arr(raw.edges).map((e: Raw) => ({
      from: e.from, to: e.to, label: text(e.label) ?? { ko: '' },
      ...(e.revealed_after !== undefined ? { revealedAfter: num(e.revealed_after) } : {}),
      ...(e.danger ? { danger: true } : {}),
    })),
    discoveries: arr(raw.discoveries).map((d: Raw) => ({
      action: d.action, from: d.from, to: d.to, label: text(d.label) ?? { ko: '' },
      ...(d.danger ? { danger: true } : {}),
      ...(d.node ? { node: {
        id: d.node.id, label: text(d.node.label) ?? { ko: '' },
        x: num(d.node.x), y: num(d.node.y),
      } } : {}),
    })),
  }
}

function floorPlan(raw: Raw): FloorPlan {
  const num = (v: unknown) => Number(v ?? 0)
  const box = (o: Raw) => ({ x: num(o.x), y: num(o.y), w: num(o.w), h: num(o.h) })
  return {
    viewBox: { w: num(raw.view_box?.w), h: num(raw.view_box?.h) },
    ...(raw.scale ? { scale: {
      x: num(raw.scale.x), len: num(raw.scale.len), y: num(raw.scale.y),
      ...(raw.scale.label ? { label: String(raw.scale.label) } : {}),
    } } : {}),
    buildings: arr(raw.buildings).map((b: Raw) => ({
      id: b.id, ...box(b), ...(b.poche ? { poche: b.poche } : {}),
      ...(b.revealed_after !== undefined ? { revealedAfter: num(b.revealed_after) } : {}),
    })),
    rooms: arr(raw.rooms).map((r: Raw) => ({
      id: r.id, ...box(r), label: String(r.label ?? r.id),
      ...(r.building ? { building: r.building } : {}),
      ...(r.loc ? { loc: r.loc } : {}),
      ...(r.scene ? { scene: true } : {}),
      ...(r.tint ? { tint: r.tint } : {}),
      ...(r.primary ? { primary: true } : {}),
    })),
    zones: arr(raw.zones).map((z: Raw) => ({
      id: z.id, ...box(z), label: String(z.label ?? z.id),
      ...(z.loc ? { loc: z.loc } : {}),
      ...(z.hatch ? { hatch: true } : {}),
      ...(z.offsite ? { offsite: true } : {}),
      ...(z.primary ? { primary: true } : {}),
    })),
    doors: arr(raw.doors).map((d: Raw) => ({
      id: d.id, x1: num(d.x1), y1: num(d.y1), x2: num(d.x2), y2: num(d.y2),
      ...(d.hinge ? { hinge: d.hinge } : {}),
      ...(d.swing !== undefined ? { swing: num(d.swing) } : {}),
      ...(d.open ? { open: true } : {}),
      ...(d.ext ? { ext: true } : {}),
      ...(d.building ? { building: d.building } : {}),
      ...(d.label ? { label: String(d.label) } : {}),
      ...(d.lx !== undefined ? { lx: num(d.lx), ly: num(d.ly) } : {}),
    })),
    windows: arr(raw.windows).map((w: Raw) => ({
      x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2),
      ...(w.building ? { building: w.building } : {}),
      ...(w.label ? { label: String(w.label) } : {}),
      ...(w.lx !== undefined ? { lx: num(w.lx), ly: num(w.ly) } : {}),
    })),
    walks: arr(raw.walks).map((w: Raw) => ({
      x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2),
      ...(w.building ? { building: w.building } : {}),
      // 장소 쌍. 없으면 앱이 도보 시간표를 못 채운다 — `types.ts` §walks
      ...(w.from ? { from: w.from as string } : {}),
      ...(w.to ? { to: w.to as string } : {}),
      ...(w.min !== undefined ? { min: num(w.min) } : {}),
    })),
    ...(raw.fixtures ? { fixtures: Object.fromEntries(
      Object.entries(raw.fixtures as Raw).map(([k, v]) => [k, {
        x: num((v as Raw).x), y: num((v as Raw).y),
        ...((v as Raw).label ? { label: String((v as Raw).label) } : {}),
        /**
         * ⚠ **`loc` 과 `body` 를 삼키고 있었다.** 여기가 YAML 경로 전용이라
         * 생성 사건(`generateCase` 가 `Case` 를 직접 만든다)에는 안 걸렸고,
         * 산장은 앱이 제 표에 `loc`·`body` 를 하드코딩해 갖고 있어서 안 드러났다.
         * **손으로 쓴 사건이 둘째가 되는 순간 물릴 자리였다** — `loc` 이 없으면
         * 앱이 `revealedLocs` 로 걸러 **좌표가 있어도 안 그려진다**(types.ts §fixtures).
         */
        ...((v as Raw).loc ? { loc: String((v as Raw).loc) } : {}),
        ...((v as Raw).body ? { body: true } : {}),
      }]),
    ) } : {}),
  }
}

function cells(
  raw: unknown,
  p: Problems,
  path: string,
  slots: Set<string>,
  locations: Set<string>,
): PresenceCell[] {
  return arr(raw).map((e: Raw, i) => {
    const at = `${path}[${i}]`
    if (!e?.slot) p.add(at, 'slot 이 없다')
    else if (slots.size && !slots.has(e.slot)) p.add(at, `slots 에 없는 슬롯 '${e.slot}'`)
    if (!e?.at) p.add(at, 'at (장소) 이 없다')
    else if (locations.size && !locations.has(e.at)) p.add(at, `locations 에 없는 장소 '${e.at}'`)
    return { slot: e?.slot, location: e?.at }
  })
}

export function parseCase(raw: unknown, source: string): Case {
  const p = new Problems()
  const c = (raw ?? {}) as Raw

  for (const k of ['id', 'title', 'scale', 'victim', 'culprit']) {
    if (c[k] === undefined || c[k] === null) p.add(k, '필수 항목이 비어 있다')
  }
  // 예산은 게임의 자원 그 자체다. 문자열이 들어오면 난이도 계산이 통째로 어긋난다
  // (`budget: '여섯'` 이 hard 를 easy 로 바꾸는 것을 재서 확인했다 — 2026-07-31)
  const budget = reqNum(p, 'budget', c.budget)
  if (c.scale && c.scale !== 'daily' && c.scale !== 'campaign')
    p.add('scale', `'daily' 또는 'campaign' 이어야 한다 (받은 값: ${c.scale})`)

  const inc = (c.incident ?? {}) as Raw
  if (!inc.kind) p.add('incident.kind', '필수')
  else if (!INCIDENT_KINDS.has(inc.kind)) p.add('incident.kind', `알 수 없는 값 '${inc.kind}'`)

  const slotList: Slot[] = arr(c.slots).map((t: Raw, i) => {
    if (!t?.id) p.add(`slots[${i}]`, 'id 가 없다')
    if (!t?.label) p.add(`slots[${i}]`, 'label 이 없다')
    return { id: t?.id, label: t?.label, ...(t?.window ? { isWindow: true } : {}) }
  })
  if (!slotList.length)
    p.add('slots', '시간 축이 비어 있다 — presence·시각 공란이 쓸 어휘가 없다')
  uniqueIds(p, 'slots', slotList.map((t) => t.id))
  const slots = new Set(slotList.map((t) => t.id))

  // 장소 레지스트리. presence·claim·장소 공란이 이 어휘만 쓴다.
  // 자유 문자열로 두면 'annex' 와 '별채' 가 서로 다른 곳이 되고 아무도 모른다.
  const locationList: Location[] = arr(c.locations).map((l: Raw, i) => {
    if (!l?.id) p.add(`locations[${i}]`, 'id 가 없다')
    if (!l?.label) p.add(`locations[${i}]`, 'label 이 없다')
    if (l?.at_lodge === undefined)
      p.add(`locations[${i}]`, 'at_lodge 가 없다 — 부지 안팎이 기회 판별에 쓰인다')
    return { id: l?.id, label: l?.label, atLodge: Boolean(l?.at_lodge) }
  })
  if (!locationList.length)
    p.add('locations', '장소 축이 비어 있다 — presence·장소 공란이 쓸 어휘가 없다')
  uniqueIds(p, 'locations', locationList.map((l) => l.id))
  const locations = new Set(locationList.map((l) => l.id))

  if (inc.scene && locations.size && !locations.has(inc.scene))
    p.add('incident.scene', `locations 에 없는 장소 '${inc.scene}'`)

  const people: Person[] = arr(c.people).map((x: Raw, i) => {
    const at = `people[${i}]`
    if (!x?.id) p.add(at, 'id 가 없다')
    if (!x?.name) p.add(at, 'name 이 없다')
    if (x?.hidden_role && !HIDDEN_ROLES.has(x.hidden_role))
      p.add(`${at}.hidden_role`, `알 수 없는 값 '${x.hidden_role}'`)
    return {
      id: x?.id, name: x?.name, age: x?.age, job: x?.job,
      ...(x?.sex ? { sex: x.sex } : {}),
      ...(x?.claim_summary ? { claimSummary: text(x.claim_summary)! } : {}),
      hiddenRole: x?.hidden_role,
      presence: cells(x?.presence, p, `${at}.presence`, slots, locations),
      // claim 을 적지 않으면 presence 와 같다 = 무고한 사람은 거짓말하지 않는다.
      // 여기서 presence 를 복사해 채우면 안 된다. 검증기가 '주장이 실제와 완전히
      // 일치하는 범인'을 잡아내는데, 그 검사가 undefined 여부에 기대기 때문이다.
      ...(x?.claim ? { claim: cells(x.claim, p, `${at}.claim`, slots, locations) } : {}),
      ...(x?.statement ? { statement: {
        paragraphs: texts(x.statement.paragraphs),
        ...(x.statement.gesture ? { gesture: {
          ...(x.statement.gesture.pre ? { pre: text(x.statement.gesture.pre)! } : {}),
          ...(x.statement.gesture.post ? { post: text(x.statement.gesture.post)! } : {}),
        } } : {}),
        ...(x.statement.voice ? { voice: x.statement.voice } : {}),
      } } : {}),
    }
  })
  uniqueIds(p, 'people', people.map((x) => x.id))
  // people = 용의자다. 피해자는 여기 들어가지 않는다 — guiltTable 이 people 을
  // 순회하므로 피해자를 넣으면 피해자의 유죄를 계산하게 된다.
  // 다만 fact.subject 는 피해자를 가리킬 수 있다(예: 사인).
  const suspectIds = new Set(people.map((x) => x.id))
  const personIds = new Set([...suspectIds, c.victim].filter(Boolean))
  if (c.culprit && !suspectIds.has(c.culprit))
    p.add('culprit', `범인 '${c.culprit}' 가 people 에 없다`)
  if (c.victim && suspectIds.has(c.victim))
    p.add('victim', `피해자 '${c.victim}' 가 people 에 들어 있다 — people 은 용의자 목록이다`)

  const evidence: Evidence[] = arr(c.evidence).map((e: Raw, i) => {
    const at = `evidence[${i}]`
    if (!e?.id) p.add(at, 'id 가 없다')
    if (!e?.description) p.add(at, 'description 이 없다')
    return {
      id: e?.id, description: e?.description,
      ...(e?.found_at ? { foundAt: e.found_at } : {}),
      ...(e?.record ? { record: e.record } : {}),
      ...(e?.extra ? { extra: {
        kind: e.extra.kind,
        lines: arr(e.extra.lines).map((l: Raw) => ({
          ...(l?.side ? { side: l.side } : {}),
          ...(l?.at ? { at: l.at } : {}),
          text: l?.text,
        })),
      } } : {}),
      ...(e?.is_staging ? { isStaging: true } : {}),
      ...(e?.at_scene ? { atScene: true } : {}),
      ...(e?.yields_terms ? { yieldsTerms: e.yields_terms } : {}),
      // 「가리키는 곳」 — `found_at`(발견된 곳 · 표시 문구)과 **다르다**
      ...(e?.points_at ? { pointsAt: e.points_at } : {}),
    }
  })
  uniqueIds(p, 'evidence', evidence.map((e) => e.id))
  const evidenceIds = new Set(evidence.map((e) => e.id))

  const facts: Fact[] = arr(c.facts).map((f: Raw, i) => {
    const at = `facts[${i}]`
    if (!f?.id) p.add(at, 'id 가 없다')
    if (!FACT_KINDS.has(f?.kind)) p.add(`${at}.kind`, `알 수 없는 값 '${f?.kind}'`)
    if (f?.subject && !personIds.has(f.subject))
      p.add(`${at}.subject`, `인물 '${f.subject}' 가 people 에 없다`)
    for (const e of arr(f?.revealed_by))
      if (!evidenceIds.has(e)) p.add(`${at}.revealed_by`, `물증 '${e}' 가 없다`)
    return {
      id: f?.id, kind: f?.kind, subject: f?.subject, content: f?.content,
      revealedBy: arr(f?.revealed_by),
      ...(f?.requires ? { requires: f.requires } : {}),
      ...(f?.available_after !== undefined ? { availableAfter: f.available_after } : {}),
    }
  })
  uniqueIds(p, 'facts', facts.map((f) => f.id))
  const factIds = new Set(facts.map((f) => f.id))
  facts.forEach((f, i) => {
    for (const r of f.requires ?? [])
      if (!factIds.has(r)) p.add(`facts[${i}].requires`, `사실 '${r}' 가 없다`)
  })

  const actions: Action[] = arr(c.actions).map((a: Raw, i) => {
    const at = `actions[${i}]`
    if (!a?.id) p.add(at, 'id 가 없다')
    if (!a?.label) p.add(at, 'label 이 없다')
    if (!YIELDS.has(a?.yield)) p.add(`${at}.yield`, `알 수 없는 값 '${a?.yield}'`)
    if (a?.verb !== undefined && !ACTION_VERBS.has(a.verb))
      p.add(`${at}.verb`, `알 수 없는 조사 갈래 '${a?.verb}'`)
    arr(a?.clues).forEach((cl: Raw, ci: number) => {
      const cat = `${at}.clues[${ci}]`
      if (!PROFILE_SLOTS.has(cl?.slot as string))
        p.add(`${cat}.slot`, `프로필 칸이 아니다 '${cl?.slot}' (motive · means · opportunity)`)
      if (!text(cl?.text)) p.add(cat, 'text 가 없다')
      // 프로필 카드는 **용의자** 것이다. 피해자에겐 카드가 없으므로 붙일 자리도 없다
      if (!suspectIds.has(cl?.person as string))
        p.add(`${cat}.person`, `용의자가 아니다 '${cl?.person}' — 프로필 칸이 없다`)
    })
    for (const e of arr(a?.gives))
      if (!evidenceIds.has(e)) p.add(`${at}.gives`, `물증 '${e}' 가 없다`)
    for (const b of arr(a?.boosted_by))
      if (!factIds.has(b?.fact)) p.add(`${at}.boosted_by`, `사실 '${b?.fact}' 가 없다`)
    return {
      id: a?.id, label: a?.label, cost: reqNum(p, `${at}.cost`, a?.cost), gives: arr(a?.gives),
      salience: reqNum(p, `${at}.salience`, a?.salience), yield: a?.yield,
      ...(a?.verb ? { verb: a.verb as Action['verb'] } : {}),
      ...(a?.clues ? { clues: arr(a.clues).map((cl: Raw) => ({
        person: cl.person, slot: cl.slot, text: text(cl.text) ?? { ko: '' },
      })) as Action['clues'] } : {}),
      ...(a?.boosted_by ? { boostedBy: a.boosted_by } : {}),
      ...(a?.available_after !== undefined ? { availableAfter: a.available_after } : {}),
      ...(a?.pair ? { pair: arr(a.pair) as [string, string] } : {}),
      ...(a?.result ? { result: {
        title: text(a.result.title) ?? { ko: '' },
        body: text(a.result.body) ?? { ko: '' },
      } } : {}),
      ...(a?.target ? { target: { kind: a.target.kind, id: a.target.id } } : {}),
    }
  })
  uniqueIds(p, 'actions', actions.map((a) => a.id))
  const actionIds = new Set(actions.map((a) => a.id))

  const chapters: Chapter[] = arr(c.chapters).map((ch: Raw, i) => {
    const at = `chapters[${i}]`
    // 장 번호는 `reveals` 의 chapterComplete 트리거가 찾는 열쇠다 — 숫자가 아니면 못 찾는다
    const order = reqNum(p, `${at}.order`, ch?.order)
    if (!ch?.title) p.add(at, 'title 이 없다')
    for (const f of arr(ch?.requires_facts))
      if (!factIds.has(f)) p.add(`${at}.requires_facts`, `사실 '${f}' 가 없다`)

    const blanks: Blank[] = arr(ch?.blanks).map((b: Raw, j) => {
      const bat = `${at}.blanks[${j}]`
      if (!BLANK_LABELS.has(b?.label))
        p.add(`${bat}.label`, `고정 어휘가 아니다 '${b?.label}'`)
      if (b?.candidates !== 'closed' && b?.candidates !== 'discovered')
        p.add(`${bat}.candidates`, `'closed' 또는 'discovered' 여야 한다`)
      if (b?.answer === undefined) p.add(bat, 'answer 가 없다')
      if (b?.particle && !PARTICLES.has(b.particle))
        p.add(`${bat}.particle`, `조사는 ${[...PARTICLES].join(' · ')} 중 하나여야 한다 (받은 값: ${b.particle})`)
      return {
        label: b?.label as BlankLabel, candidates: b?.candidates, answer: String(b?.answer),
        ...(b?.particle ? { particle: b.particle as Particle } : {}),
        ...(b?.candidate_pool !== undefined ? { candidatePool: b.candidate_pool } : {}),
        ...(b?.is_accusation ? { isAccusation: true } : {}),
        // 「무엇을 묻는가」(types.ts §Asks). **선택 항목이다** — 손저작 4건이 아직
        // 안 채웠고, 없으면 솔버가 그 공란에 `undecidable` 을 낸다(삼키지 않는다)
        ...(b?.asks ? { asks: b.asks as Blank['asks'] } : {}),
      }
    })

    // 서술문. 문자열은 텍스트 조각, { blank: n } 은 이 장 blanks 의 n번째 참조
    const report = arr(ch?.report).map((r: unknown, j) => {
      if (typeof r === 'string') return { text: r }
      const o = (r ?? {}) as Raw
      if (typeof o.blank !== 'number') {
        p.add(`${at}.report[${j}]`, '문자열이거나 { blank: 숫자 } 여야 한다')
        return { text: '' }
      }
      if (o.blank < 0 || o.blank >= blanks.length)
        p.add(`${at}.report[${j}]`, `공란 ${o.blank} 번이 없다 (이 장의 공란은 ${blanks.length}개)`)
      return { blank: o.blank }
    })

    return {
      order, title: ch?.title,
      ...(ch?.opening ? { opening: ch.opening } : {}),
      // 「이 장은 조사 없이 확정되도록 설계됐다」. **장 단위만** — 사실 단위 선언은 없다
      ...(ch?.free_chapter ? { freeChapter: true } : {}),
      blanks,
      ...(report.length ? { report } : {}),
      requiresFacts: arr(ch?.requires_facts),
      ...(ch?.epilogue_order !== undefined ? { epilogueOrder: ch.epilogue_order } : {}),
      ...(ch?.epilogue ? { epilogue: ch.epilogue } : {}),
    }
  })

  // 장 번호 중복. `reveals` 의 chapterComplete 가 `chapters.some(ch => ch.order === n)`
  // 으로 찾으므로 둘이 같으면 **어느 장이 열리는지가 배열 순서에 좌우된다**
  const seenOrder = new Set<number>()
  chapters.forEach((ch, i) => {
    if (seenOrder.has(ch.order))
      p.add(`chapters[${i}]`, `order ${ch.order} 이 중복이다 — reveals 가 어느 장을 가리키는지 정해지지 않는다`)
    seenOrder.add(ch.order)
  })

  const reveals: Reveal[] = arr(c.reveals).map((r: Raw, i) => {
    const at = `reveals[${i}]`
    const t = (r?.trigger ?? {}) as Raw
    let trigger: Reveal['trigger']
    if (t.on === 'action') {
      if (!actionIds.has(t.action_id)) p.add(`${at}.trigger`, `조사 '${t.action_id}' 가 없다`)
      trigger = { on: 'action', actionId: t.action_id }
    } else if (t.on === 'chapterComplete') {
      if (!chapters.some((ch) => ch.order === t.chapter_order))
        p.add(`${at}.trigger`, `${t.chapter_order}장이 없다`)
      trigger = { on: 'chapterComplete', chapterOrder: t.chapter_order }
    } else {
      p.add(`${at}.trigger.on`, `'action' 또는 'chapterComplete' 여야 한다`)
      trigger = { on: 'chapterComplete', chapterOrder: -1 }
    }
    if (!REVEAL_YIELDS.has(r?.yield)) p.add(`${at}.yield`, `알 수 없는 값 '${r?.yield}'`)
    if (!SURFACES.has(r?.surface)) p.add(`${at}.surface`, `알 수 없는 값 '${r?.surface}'`)
    for (const f of arr(r?.facts))
      if (!factIds.has(f)) p.add(`${at}.facts`, `사실 '${f}' 가 없다`)
    for (const a of arr(r?.actions))
      if (!actionIds.has(a)) p.add(`${at}.actions`, `조사 '${a}' 가 없다`)
    arr(r?.add_claims).forEach((cl: Raw, ci: number) => {
      const cat = `${at}.add_claims[${ci}]`
      if (!personIds.has(cl?.speaker)) p.add(cat, `인물 '${cl?.speaker}' 가 없다`)
      const tg = cl?.target ?? 'statement'
      if (tg !== 'statement' && tg !== 'grid')
        p.add(`${cat}.target`, `'statement' 또는 'grid' 여야 한다 ('${tg}')`)
      // 격자는 칸이다 — 어느 시간대인지 없으면 **채울 자리가 없어 조용히 사라진다**
      if (tg === 'grid') {
        if (!cl?.slot) p.add(`${cat}.slot`, `target: grid 는 slot 이 필수다 — 격자의 열이 시간대다`)
        else if (slots.size && !slots.has(cl.slot as string))
          p.add(`${cat}.slot`, `slots 에 없는 슬롯 '${cl.slot}'`)
      }
    })
    for (const s of arr(r?.narrows_window))
      if (slots.size && !slots.has(s)) p.add(`${at}.narrows_window`, `slots 에 없는 슬롯 '${s}'`)
    return {
      trigger, yield: r?.yield, surface: r?.surface,
      ...(r?.facts ? { facts: r.facts } : {}),
      ...(r?.actions ? { actions: r.actions } : {}),
      ...(r?.narrows_window ? { narrowsWindow: r.narrows_window } : {}),
      ...(r?.add_claims ? { addClaims: arr(r.add_claims).map((cl: Raw) => ({
        speaker: cl?.speaker, content: cl?.content, target: cl?.target ?? 'statement',
        ...(cl?.slot ? { slot: cl.slot } : {}),
      })) as Reveal['addClaims'] } : {}),
      ...(r?.narration ? { narration: r.narration } : {}),
    }
  })

  const trick = (c.trick ?? {}) as Raw
  /**
   * ⛳ **손으로 베끼지 않는다** — 여기 여섯 문자열이 `types.ts` 의 `TrickType` 을
   * 그대로 다시 쓴 복사본이었다. 아키타입을 하나 늘릴 때 **한쪽만 고치면 조용히
   * 어긋난다**(이 저장소 최다 재발 부류 — 07-30에 여섯 번). `ARCHETYPES` 가
   * `Record<TrickType, …>` 이므로 그 키가 곧 허용목록이다.
   */
  const TRICK_TYPES = new Set(Object.keys(ARCHETYPES))
  const types = arr(trick.types)
  if (!types.length) p.add('trick.types', '아키타입이 없다')
  for (const t of types)
    if (!TRICK_TYPES.has(t)) p.add('trick.types', `알 수 없는 아키타입 '${t}'`)
  for (const e of [...arr(trick.props), ...arr(trick.staging)])
    if (!evidenceIds.has(e)) p.add('trick', `물증 '${e}' 가 없다`)

  const illusions = arr(trick.illusions).map((il: Raw, i) => {
    const at = `trick.illusions[${i}]`
    if (!il?.id) p.add(at, 'id 가 없다')
    if (!il?.impression) p.add(at, 'impression 이 없다')
    // 손으로 베끼지 않는다 — `types.ts` 의 `ILLUSION_KINDS` 가 정본이다
    if (!(ILLUSION_KINDS as readonly string[]).includes(il?.kind))
      p.add(at, `kind 가 ${ILLUSION_KINDS.join('·')} 중 하나여야 한다 (받은 값: ${il?.kind})`)
    for (const e of [...arr(il?.made_by), ...arr(il?.broken_by)])
      if (!evidenceIds.has(e)) p.add(at, `물증 '${e}' 가 없다`)
    return {
      id: il?.id, kind: il?.kind, impression: il?.impression,
      madeBy: arr(il?.made_by), brokenBy: arr(il?.broken_by),
    }
  })

  const ex = trick.exit as Raw | undefined
  if (ex) {
    for (const e of [...arr(ex.enabled_by), ...arr(ex.broken_by)])
      if (!evidenceIds.has(e)) p.add('trick.exit', `물증 '${e}' 가 없다`)
    if (ex.slot && slots.size && !slots.has(ex.slot))
      p.add('trick.exit.slot', `slots 에 없는 슬롯 '${ex.slot}'`)
  }

  const flaw = (trick.flaw ?? {}) as Raw
  if (typeof trick.flaw === 'string')
    p.add('trick.flaw', '문자열이 아니라 { text, planted_in } 이어야 한다')

  p.throwIfAny(source)

  return {
    id: c.id, title: c.title, scale: c.scale, budget,
    incident: {
      kind: inc.kind, subject: inc.subject, description: inc.description,
      ...(inc.scene ? { scene: inc.scene } : {}),
      ...(inc.body_state ? { bodyState: text(inc.body_state)! } : {}),
      ...(inc.scene_state ? { sceneState: text(inc.scene_state)! } : {}),
    },
    ...(c.prose ? { prose: {
      source: c.prose.source,
      ...(c.prose.model ? { model: c.prose.model } : {}),
      ...(c.prose.generated_at ? { generatedAt: c.prose.generated_at } : {}),
    } } : {}),
    ...(c.floor_plan ? { floorPlan: floorPlan(c.floor_plan) } : {}),
    ...(c.relation_graph ? { relationGraph: relationGraph(c.relation_graph) } : {}),
    ...(c.seed_terms ? { seedTerms: c.seed_terms } : {}),
    ...(c.prologue ? { prologue: texts(c.prologue) } : {}),
    ...(c.terms ? { terms: arr(c.terms).map((t: Raw) => ({
      word: t?.word,
      source: text(t?.source) ?? { ko: '' },
      note: text(t?.note) ?? { ko: '' },
    })) } : {}),
    slots: slotList,
    locations: locationList,
    people,
    victim: c.victim,
    // 피해자 동선 — 세계 변수가 아니라 상수다. `asks: lastSeenBy` 가 읽는다.
    // 없으면 lastSeenBy 가 계산될 수 없어 솔버가 undecidable 을 낸다(삼키지 않는다).
    ...(c.victim_presence
      ? { victimPresence: cells(c.victim_presence, p, 'victim_presence', slots, locations) }
      : {}),
    ...(c.victim_profile ? { victimProfile: {
      name: c.victim_profile.name,
      ...(c.victim_profile.age !== undefined ? { age: c.victim_profile.age } : {}),
      ...(c.victim_profile.job ? { job: c.victim_profile.job } : {}),
    } } : {}),
    culprit: c.culprit,
    trick: {
      types, props: arr(trick.props), staging: arr(trick.staging),
      illusions,
      ...(ex ? { exit: {
        slot: ex.slot, method: ex.method,
        ...(ex.enabled_by ? { enabledBy: ex.enabled_by } : {}),
        brokenBy: arr(ex.broken_by),
      } } : {}),
      flaw: { text: flaw.text, plantedIn: arr(flaw.planted_in) },
    },
    evidence, facts, actions, chapters, reveals,
    reopenPerChapter: c.reopen_per_chapter ?? 1,
  }
}
