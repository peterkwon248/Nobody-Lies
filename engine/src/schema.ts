import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { DOMAIN_OF } from './types.js'
import type {
  Action, Blank, BlankLabel, Case, Chapter, Evidence, Fact, Location, Person, PresenceCell,
  Particle, Reveal, Slot, Text,
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

  for (const k of ['id', 'title', 'scale', 'budget', 'victim', 'culprit']) {
    if (c[k] === undefined || c[k] === null) p.add(k, '필수 항목이 비어 있다')
  }
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
      hiddenRole: x?.hidden_role,
      presence: cells(x?.presence, p, `${at}.presence`, slots, locations),
      // claim 을 적지 않으면 presence 와 같다 = 무고한 사람은 거짓말하지 않는다.
      // 여기서 presence 를 복사해 채우면 안 된다. 검증기가 '주장이 실제와 완전히
      // 일치하는 범인'을 잡아내는데, 그 검사가 undefined 여부에 기대기 때문이다.
      ...(x?.claim ? { claim: cells(x.claim, p, `${at}.claim`, slots, locations) } : {}),
      ...(x?.statement ? { statement: {
        paragraphs: texts(x.statement.paragraphs),
        ...(x.statement.voice ? { voice: x.statement.voice } : {}),
      } } : {}),
    }
  })
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
    }
  })
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
    for (const e of arr(a?.gives))
      if (!evidenceIds.has(e)) p.add(`${at}.gives`, `물증 '${e}' 가 없다`)
    for (const b of arr(a?.boosted_by))
      if (!factIds.has(b?.fact)) p.add(`${at}.boosted_by`, `사실 '${b?.fact}' 가 없다`)
    return {
      id: a?.id, label: a?.label, cost: a?.cost, gives: arr(a?.gives),
      salience: a?.salience, yield: a?.yield,
      ...(a?.boosted_by ? { boostedBy: a.boosted_by } : {}),
      ...(a?.available_after !== undefined ? { availableAfter: a.available_after } : {}),
      ...(a?.result ? { result: {
        title: text(a.result.title) ?? { ko: '' },
        body: text(a.result.body) ?? { ko: '' },
      } } : {}),
    }
  })
  const actionIds = new Set(actions.map((a) => a.id))

  const chapters: Chapter[] = arr(c.chapters).map((ch: Raw, i) => {
    const at = `chapters[${i}]`
    if (ch?.order === undefined) p.add(at, 'order 가 없다')
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
      order: ch?.order, title: ch?.title,
      ...(ch?.opening ? { opening: ch.opening } : {}),
      blanks,
      ...(report.length ? { report } : {}),
      requiresFacts: arr(ch?.requires_facts),
      ...(ch?.epilogue_order !== undefined ? { epilogueOrder: ch.epilogue_order } : {}),
      ...(ch?.epilogue ? { epilogue: ch.epilogue } : {}),
    }
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
    for (const cl of arr(r?.add_claims))
      if (!personIds.has(cl?.speaker)) p.add(`${at}.add_claims`, `인물 '${cl?.speaker}' 가 없다`)
    for (const s of arr(r?.narrows_window))
      if (slots.size && !slots.has(s)) p.add(`${at}.narrows_window`, `slots 에 없는 슬롯 '${s}'`)
    return {
      trigger, yield: r?.yield, surface: r?.surface,
      ...(r?.facts ? { facts: r.facts } : {}),
      ...(r?.actions ? { actions: r.actions } : {}),
      ...(r?.narrows_window ? { narrowsWindow: r.narrows_window } : {}),
      ...(r?.add_claims ? { addClaims: arr(r.add_claims).map((cl: Raw) => ({
        speaker: cl?.speaker, content: cl?.content, target: cl?.target ?? 'statement',
      })) } : {}),
      ...(r?.narration ? { narration: r.narration } : {}),
    }
  })

  const trick = (c.trick ?? {}) as Raw
  const TRICK_TYPES = new Set([
    'staged_suicide', 'locked_room', 'alibi_fabrication',
    'body_moved', 'identity_swap', 'delayed_mechanism',
  ])
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
    if (!['death','time','place','absence','identity'].includes(il?.kind))
      p.add(at, `kind 가 death·time·place·absence·identity 중 하나여야 한다 (받은 값: ${il?.kind})`)
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
    id: c.id, title: c.title, scale: c.scale, budget: c.budget,
    incident: {
      kind: inc.kind, subject: inc.subject, description: inc.description,
      ...(inc.scene ? { scene: inc.scene } : {}),
    },
    ...(c.prose ? { prose: {
      source: c.prose.source,
      ...(c.prose.model ? { model: c.prose.model } : {}),
      ...(c.prose.generated_at ? { generatedAt: c.prose.generated_at } : {}),
    } } : {}),
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

export function loadCaseFile(path: string): Case {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`사건 파일을 열 수 없다: ${path}`)
  }
  return parseCase(load(text), path)
}
