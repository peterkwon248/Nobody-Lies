import type { Case, Action, FactId, EvidenceId, VerifyResult, GuiltCheck } from './types.js'
import { DOMAIN_OF, ARCHETYPES } from './types.js'
import { divergentSlots } from './deriver.js'

/**
 * 획득 물증과 확인된 장 수로부터 성립하는 fact 집합.
 * availableAfter 를 만족하지 않는 fact 는 아직 존재하지 않는다.
 */
export function deriveFacts(c: Case, evidence: Set<string>, confirmed: number): Set<FactId> {
  const got = new Set<FactId>()
  let changed = true
  while (changed) {
    changed = false
    for (const f of c.facts) {
      if (got.has(f.id)) continue
      if ((f.availableAfter ?? 0) > confirmed) continue
      const revealed = f.revealedBy.length === 0 || f.revealedBy.some((e) => evidence.has(e))
      const deps = (f.requires ?? []).every((r) => got.has(r))
      if (revealed && deps) {
        got.add(f.id)
        changed = true
      }
    }
  }
  return got
}

export function guiltTable(c: Case, facts: Set<FactId>): GuiltCheck[] {
  return c.people.map((p) => {
    const has = (k: string) =>
      c.facts.some((f) => f.kind === k && f.subject === p.id && facts.has(f.id))
    const motive = has('motive')
    const opportunity = has('opportunity') && !has('no_opportunity')
    const means = has('means')
    return { person: p.id, motive, opportunity, means, guilty: motive && opportunity && means }
  })
}

function availableActions(c: Case, confirmed: number, used: Set<string>): Action[] {
  return c.actions.filter((a) => !used.has(a.id) && (a.availableAfter ?? 0) <= confirmed)
}

/**
 * 그 시점에 손에 있는 확보 단어.
 *
 * 세 갈래로 들어온다.
 *   seedTerms      진술 정독만으로 얻는 단어
 *   atScene 물증   조사 없이 현장에서 열람하는 물건 (화로의 연탄, 문틈의 테이프)
 *   획득한 물증    유료 조사의 산출
 */
export function deriveTerms(c: Case, evidence: Set<string>): Set<string> {
  const terms = new Set<string>(c.seedTerms ?? [])
  for (const e of c.evidence)
    if (e.atScene || evidence.has(e.id)) (e.yieldsTerms ?? []).forEach((t) => terms.add(t))
  return terms
}

/**
 * 순차 잠금. i번 장은 i-1번이 완성돼야 열린다.
 * 따라서 장 순서가 의존성 순서와 일치해야 하며, 검증기가 이를 강제한다.
 *
 * 사실이 모였다고 장이 확정되는 것이 아니다. discovered 공란은 그 단어를
 * 확보하기 전에는 채울 수 없으므로, 단어 가용성도 함께 게이트다.
 */
function confirmableChapter(
  c: Case,
  facts: Set<FactId>,
  terms: Set<string>,
  done: Set<number>,
): number {
  const next = done.size
  if (next >= c.chapters.length) return -1
  const ch = c.chapters[next]
  if (!ch.requiresFacts.every((f) => facts.has(f))) return -1
  if (!ch.blanks.every((b) => b.candidates !== 'discovered' || terms.has(b.answer))) return -1
  return next
}

/** 조사를 한 번도 하지 않고 도달할 수 있는 상태 */
function freeClosure(c: Case): { facts: Set<FactId>; done: Set<number> } {
  const done = new Set<number>()
  const terms = deriveTerms(c, new Set())
  let guard = 0
  let facts = deriveFacts(c, new Set(), 0)
  while (guard++ < 100) {
    const idx = confirmableChapter(c, facts, terms, done)
    if (idx < 0) break
    done.add(idx)
    facts = deriveFacts(c, new Set(), done.size)
  }
  return { facts, done }
}

/** 주어진 행동 집합만 써서 모든 장을 순서대로 확인할 수 있는가 */
function stagedFeasible(c: Case, subset: Action[]): boolean {
  const pool = [...subset]
  const evidence = new Set<string>()
  const done = new Set<number>()
  let guard = 0
  while (done.size < c.chapters.length && guard++ < 200) {
    const facts = deriveFacts(c, evidence, done.size)
    const idx = confirmableChapter(c, facts, deriveTerms(c, evidence), done)
    if (idx >= 0) { done.add(idx); continue }
    const usable = pool.filter((a) => (a.availableAfter ?? 0) <= done.size)
    if (usable.length === 0) return false
    usable.forEach((a) => {
      a.gives.forEach((e) => evidence.add(e))
      pool.splice(pool.indexOf(a), 1)
    })
  }
  return done.size === c.chapters.length
}

/** 최단 경로 — 오라클 기준. 단계별 제약을 지킨다 */
function findMinPath(c: Case): { size: number; path: string[] } {
  // empty 행동은 정답에 기여하지 않으므로 탐색에서 제외한다
  const cand = c.actions.filter((a) => a.yield !== 'empty')
  const n = cand.length
  if (n > 22) return { size: -1, path: ['탐색 생략 · 후보 과다'] }
  let best = { size: Infinity, path: [] as string[] }
  for (let mask = 0; mask < 1 << n; mask++) {
    const chosen: Action[] = []
    let cost = 0
    for (let i = 0; i < n; i++)
      if (mask & (1 << i)) {
        chosen.push(cand[i])
        cost += cand[i].cost
      }
    if (cost >= best.size) continue
    if (stagedFeasible(c, chosen)) best = { size: cost, path: chosen.map((a) => a.label) }
  }
  return best
}

/** 플레이어 시뮬레이션. salience 내림차순, 장 확인은 가능해지는 즉시 */
function simulate(
  c: Case,
  boost: number,
): { cost: number; path: string[]; confirmed: number; deadlock: number | null } {
  const used = new Set<string>()
  const evidence = new Set<string>()
  const done = new Set<number>()
  const path: string[] = []
  let cost = 0
  let guard = 0

  while (done.size < c.chapters.length && guard++ < 200) {
    const facts = deriveFacts(c, evidence, done.size)
    const idx = confirmableChapter(c, facts, deriveTerms(c, evidence), done)
    if (idx >= 0) {
      done.add(idx)
      path.push(`— ${c.chapters[idx].order}장 확인 · ${c.chapters[idx].title}`)
      continue
    }
    const avail = availableActions(c, done.size, used)
    if (avail.length === 0) return { cost, path, confirmed: done.size, deadlock: done.size + 1 }

    let bestA: Action | null = null
    let bestScore = -1
    for (const a of avail) {
      let score = a.salience
      for (const b of a.boostedBy ?? []) if (facts.has(b.fact)) score += b.amount * boost
      if (score > bestScore) {
        bestScore = score
        bestA = a
      }
    }
    used.add(bestA!.id)
    bestA!.gives.forEach((e) => evidence.add(e))
    path.push(bestA!.label)
    cost += bestA!.cost
  }
  return { cost, path, confirmed: done.size, deadlock: null }
}

function keyFactRoutes(c: Case) {
  return c.facts
    .filter(
      (f) =>
        f.subject === c.culprit &&
        (f.kind === 'identity' || f.kind === 'means') &&
        f.revealedBy.length > 0,
    )
    .map((f) => ({
      fact: f.id,
      routes: c.actions.filter((a) => a.gives.some((e) => f.revealedBy.includes(e))).length,
    }))
}

export function verify(c: Case): VerifyResult {
  const errors: string[] = []
  const warnings: string[] = []

  const allEv = new Set(c.evidence.map((e) => e.id))
  const full = deriveFacts(c, allEv, c.chapters.length)
  const table = guiltTable(c, full)

  // 1. 유일성
  const guilty = table.filter((g) => g.guilty)
  if (guilty.length === 0) errors.push('모든 정보를 얻어도 유죄가 성립하는 인물이 없다')
  else if (guilty.length > 1) errors.push(`유죄 성립 ${guilty.length}명 — 정답이 유일하지 않다`)
  else if (guilty[0].person !== c.culprit)
    errors.push(`검증 결과 범인이 ${guilty[0].person} — 설정과 불일치`)

  // 2. 트릭 — 라벨이 아니라 계약으로 검사한다.
  //    아키타입마다 요구하는 부품이 다르고, 모든 인상은 깨질 수 있어야 한다.
  const evOk = (e: string) => allEv.has(e)
  const routesTo = (e: string) => c.actions.filter((a) => a.gives.includes(e)).length

  if (!c.trick.flaw?.text) errors.push('트릭에 허점이 없다 — 파고들 지점이 없다')
  const plantSites = new Set<string>([...allEv, ...c.people.map((x) => x.id)])
  if (!c.trick.flaw?.plantedIn?.length)
    errors.push('트릭의 허점이 어디에도 심겨 있지 않다 — 플레이어가 만날 수 없다')
  for (const site of c.trick.flaw?.plantedIn ?? [])
    if (!plantSites.has(site))
      errors.push(`허점이 심긴 자리 '${site}' 가 물증에도 인물에도 없다`)

  if (!c.trick.illusions?.length)
    errors.push('트릭에 인상이 하나도 없다 — 플레이어가 속을 것이 없으면 트릭이 아니다')
  for (const il of c.trick.illusions ?? []) {
    if (!il.brokenBy?.length)
      errors.push(`인상 '${il.id}' 를 깨는 물증이 없다 — 이 착각에서 영영 빠져나올 수 없다`)
    for (const e of [...(il.madeBy ?? []), ...(il.brokenBy ?? [])])
      if (!evOk(e)) errors.push(`인상 '${il.id}' 가 없는 물증 '${e}' 를 가리킨다`)
    for (const e of il.brokenBy ?? [])
      if (routesTo(e) === 0)
        errors.push(`인상 '${il.id}' 를 깨는 '${e}' 를 얻을 조사가 없다`)
  }

  // 아키타입 계약 — 선언한 것 전부가 적용된다
  const kinds = new Set((c.trick.illusions ?? []).map((il) => il.kind))
  if (!c.trick.types?.length) errors.push('트릭에 아키타입이 없다')
  for (const t of c.trick.types ?? []) {
    const spec = ARCHETYPES[t]
    if (!spec) { errors.push(`알 수 없는 아키타입 '${t}'`); continue }
    if (spec.unsupported)
      errors.push(`아키타입 '${spec.label}' 은 아직 쓸 수 없다 — ${spec.unsupported}`)
    if (spec.requiresIllusion.length && !spec.requiresIllusion.some((k) => kinds.has(k)))
      errors.push(
        `'${spec.label}' 은 "${spec.asserts}" 고 주장하는데 ` +
          `그에 해당하는 인상(${spec.requiresIllusion.join('·')})이 없다`,
      )
  }

  const needsExit = (c.trick.types ?? []).some((t) => ARCHETYPES[t]?.requiresExit)
  if (needsExit) {
    if (!c.trick.exit)
      errors.push(
        '현장이 닫혀 있다고 주장하는 아키타입인데 범인의 이탈 방법이 없다 ' +
          '— 물리적으로 성립하지 않는다',
      )
    else {
      const ex = c.trick.exit
      if (!c.slots.some((t) => t.id === ex.slot))
        errors.push(`이탈 시각 '${ex.slot}' 이 slots 에 없다`)
      if (!ex.brokenBy?.length)
        errors.push('이탈을 드러내는 물증이 없다 — 플레이어가 밀실을 풀 방법이 없다')
      for (const e of [...(ex.enabledBy ?? []), ...(ex.brokenBy ?? [])])
        if (!evOk(e)) errors.push(`이탈이 없는 물증 '${e}' 를 가리킨다`)
      // 범인은 이탈 시각에 현장에 있어야 한다. 없는 곳에서 나갈 수는 없다
      const culprit = c.people.find((x) => x.id === c.culprit)
      const atExit = culprit?.presence.find((e) => e.slot === ex.slot)
      if (culprit && !atExit)
        errors.push(
          `범인이 이탈 시각 ${ex.slot} 에 현장 어디에도 없다 — presence 와 트릭이 어긋난다`,
        )
    }
  }

  // 3. 핵심 사실 다중 경로
  const routes = keyFactRoutes(c)
  for (const r of routes)
    if (r.routes < 2)
      errors.push(`${r.fact} 획득 경로가 ${r.routes}개 — 최소 2개 필요`)

  // 4. 조사 없이 확정 가능한 장이 최소 하나 있어야 한다
  const free = freeClosure(c)
  if (free.done.size === 0)
    errors.push('조사 없이 확정할 수 있는 장이 없다 — 시작하자마자 막힌다')

  // 5. 지목 공란 검사
  const accSecs = c.chapters.filter((s) => s.blanks.some((b) => b.isAccusation))
  if (accSecs.length !== 1)
    errors.push(`isAccusation 공란을 가진 장이 ${accSecs.length}개 — 정확히 1개여야 한다`)

  for (const ch of accSecs) {
    const acc = ch.blanks.find((b) => b.isAccusation)!
    if (acc.answer !== c.culprit)
      errors.push(`${ch.order}장의 지목 공란 답이 범인과 다르다`)

    // 잠금이 아니라 정보 가용성이 게이트다.
    // 지목 장이 조사 없이 확정되면 찍기가 가능해진다
    const idx = c.chapters.indexOf(ch)
    if (free.done.has(idx))
      errors.push(`${ch.order}장이 조사 없이 확정 가능한데 범인을 지목한다 — 찍기가 가능하다`)

    // 조합 수가 충분해야 찍기가 막힌다.
    // 용의자 수가 적을수록 다른 공란의 후보가 많아야 한다
    const combos = ch.blanks.reduce((n, b) => {
      const pool =
        b.candidatePool ?? (b.label === '인물' || b.label === '마지막목격자' ? c.people.length : 4)
      return n * pool
    }, 1)
    if (combos < 30)
      errors.push(
        `${ch.order}장 조합 수 ${combos} — 30 미만이면 찍기가 가능하다. 공란을 늘리거나 후보를 늘려라`,
      )
    if (!ch.blanks.some((b) => b.candidates === 'discovered'))
      warnings.push(`${ch.order}장이 전부 닫힘 후보 — 조사 없이 시도할 수 있다`)
  }

  // 5. 단계별 교착 — 이번 개정의 핵심 검사
  const naive = simulate(c, 0)
  const smart = simulate(c, 1)
  for (const run of [naive, smart])
    if (run.deadlock !== null)
      errors.push(
        `${run.deadlock}장에서 교착 — 그 시점에 가용한 조사로 확정할 수 없다`,
      )

  // 6. 레드 헤링 밀도
  const decoyActions = c.actions.filter((a) => a.yield === 'redherring' && a.salience >= 0.6).length
  if (decoyActions < 2) warnings.push(`매력적인 함정이 ${decoyActions}개 — 3개 이상 권장`)

  // 6.4 decoy 는 필수 경로에 개입하면 안 된다
  const decoys = c.reveals.filter((r) => r.yield === 'decoy')
  for (const d of decoys) {
    if ((d.facts?.length ?? 0) > 0)
      errors.push('decoy 공개가 fact 를 제공한다 — 필수 경로에 개입하면 함정이 아니라 필수가 된다')
    if ((d.actions?.length ?? 0) > 0)
      warnings.push('decoy 가 조사 대상을 연다 — 그 조사가 필수 경로면 안 된다')
  }
  const decoyRatio = c.reveals.length ? decoys.length / c.reveals.length : 0

  // 6.5 discovered 공란의 답이 실제로 확보 가능한가
  //
  // 물증이 목록에 존재하는 것만으로는 부족하다. 그 물증이 실제로 조사로
  // 도달 가능해야 한다 — 어떤 action.gives 에 등장하거나 atScene(현장 자유)
  // 이어야 한다. 도달 불가한 물증의 yieldsTerms 는 확보할 수 없다.
  // (이 검사가 약하면 '주는 조사가 없는 물증'이 확보 단어를 공짜로 통과시켜
  //  프로토타입과 어긋난 채로 green 이 뜬다.)
  const reachableEvidence = new Set<EvidenceId>()
  for (const a of c.actions) a.gives.forEach((e) => reachableEvidence.add(e))
  for (const e of c.evidence) if (e.atScene) reachableEvidence.add(e.id)

  for (const e of c.evidence)
    if ((e.yieldsTerms?.length ?? 0) > 0 && !reachableEvidence.has(e.id))
      errors.push(
        `물증 '${e.id}'(${e.description})이 확보 단어를 주지만 어떤 조사로도 나오지 않는다 — atScene 표식이 빠졌거나 조사에 연결되지 않았다`,
      )

  const obtainableTerms = deriveTerms(c, reachableEvidence)
  for (const ch of c.chapters)
    for (const b of ch.blanks)
      if (b.candidates === 'discovered' && !obtainableTerms.has(b.answer))
        errors.push(
          `${ch.order}장 '${b.answer}'(확보 후보)이 어떤 물증으로도 확보되지 않는다 — 채울 수 없어 막힌다`,
        )

  // 6.55 조사 결과문과 실제 산출이 어긋나는가
  //      2026-07-24 플레이테스트를 막은 버그가 이것이다 — "유서 초안이 나왔다"고
  //      말하면서 아무것도 주지 않았다. 문장과 데이터가 붙어 있으면 기계가 잡는다.
  for (const a of c.actions) {
    if (a.yield === 'empty' && a.gives.length)
      errors.push(`'${a.label}' 이 empty 인데 물증을 준다 — 빈손이 아니다`)
    if (a.yield !== 'empty' && !a.gives.length)
      errors.push(
        `'${a.label}' 이 ${a.yield} 인데 주는 물증이 없다 — ` +
          `찾았다고 말해놓고 아무것도 주지 않으면 플레이어가 예산만 잃는다`,
      )
  }

  // 6.56 확보 단어 카드 — 설명이 있는 단어가 실제로 확보 가능한가
  //      반대 방향도 본다. 확보되는데 카드에 출처가 없으면 플레이어는
  //      "이게 어디서 나왔지"를 알 방법이 없다.
  for (const t of c.terms ?? [])
    if (!obtainableTerms.has(t.word))
      errors.push(`확보 단어 '${t.word}' 에 설명이 있는데 어떤 물증도 주지 않는다`)
  const described = new Set((c.terms ?? []).map((t) => t.word))
  if (described.size)
    for (const w of obtainableTerms)
      if (!described.has(w)) warnings.push(`확보 단어 '${w}' 에 출처 설명이 없다`)

  // 6.57 레드 헤링 회수 — 심어놓고 닫지 않으면 미완성 원고로 읽힌다
  //
  // 이 게임의 배제는 "무고한 사람은 거짓말하지 않는다"에 기대므로
  // 자기 진술만으로도 원칙적으로는 충분하다. **의심을 사지 않은 인물이라면.**
  // 그러나 레드 헤링이 그를 가리킨 뒤에는 자기 말만으로 부족하다 —
  // 그를 범인으로 가정하면 그 말이 거짓이 되어 배제가 통째로 사라진다.
  // (`templates/case-template.yaml` §5 반박 규칙이 같은 논지를 거짓말에 대해 적어뒀다.)
  const suspected = new Set<string>()
  for (const a of c.actions) {
    if (a.yield !== 'redherring') continue
    for (const eid of a.gives)
      for (const f of c.facts)
        if (f.revealedBy.includes(eid) && f.subject !== c.culprit) suspected.add(f.subject)
  }
  for (const pid of suspected) {
    const name = c.people.find((x) => x.id === pid)?.name ?? pid
    // 물증이 받쳐주는 배제가 있는가
    const backed = c.facts.some(
      (f) => f.subject === pid && f.kind === 'no_opportunity' && f.revealedBy.length > 0,
    )
    if (!backed)
      warnings.push(
        `${name}은 레드 헤링으로 의심을 사는데 배제가 자기 진술뿐이다 — ` +
          `그를 범인으로 가정하면 배제가 사라진다. 물증으로 닫아라`,
      )
  }

  // 6.6 필수 조사 — 답을 한 조사로만 얻을 수 있으면 그 조사는 건너뛸 수 없다.
  // 핵심 fact 의 2경로 규칙이 확보 단어에는 걸려 있지 않아 여기서 잡는다.
  const seeds = deriveTerms(c, new Set())
  const actionsYielding = (term: string) =>
    c.actions.filter((a) =>
      a.gives.some((eid) =>
        (c.evidence.find((e) => e.id === eid)?.yieldsTerms ?? []).includes(term),
      ),
    )
  const forced = new Map<string, Action>()
  for (const ch of c.chapters)
    for (const b of ch.blanks) {
      if (b.candidates !== 'discovered' || seeds.has(b.answer)) continue
      const routes = actionsYielding(b.answer)
      if (routes.length === 1) forced.set(routes[0].id, routes[0])
    }
  const mandatoryActions = [...forced.values()].map((a) => ({ label: a.label, cost: a.cost }))
  const mandatoryCost = mandatoryActions.reduce((n, a) => n + a.cost, 0)
  if (mandatoryCost > c.budget)
    errors.push(`필수 조사 비용 ${mandatoryCost} > 예산 ${c.budget} — 클리어 불가`)
  else if (mandatoryCost === c.budget)
    warnings.push(
      `필수 조사 비용 ${mandatoryCost} = 예산 ${c.budget} — 고를 여지가 없다. 조사가 선택이 아니라 체크리스트가 된다`,
    )

  // 6.7 서사 조각의 균일성 — 산문이 만들어내는 누설 통로
  // 일부 장에만 열림 문구가 있으면 그 유무 자체가 신호가 된다.
  // 같은 이유로 장 완성 reveal 중 일부만 narration 을 가져도 안 된다:
  // path 쪽만 서사가 붙으면 서사의 존재가 곧 '이게 진짜다' 표시가 된다.
  const withOpening = c.chapters.filter((ch) => ch.opening).length
  if (withOpening > 0 && withOpening < c.chapters.length)
    errors.push(
      `장 열림 문구가 ${withOpening}/${c.chapters.length}장에만 있다 — ` +
        `유무 자체가 신호가 된다. 전부 쓰거나 전부 비워라`,
    )

  // 6.75 보고서 서술문 — 공란은 문장 안에 박혀 있어야 한다
  //
  // 참조되지 않은 공란은 문맥 없이 뜨고(무엇을 묻는지 알 수 없다),
  // 두 번 참조된 공란은 같은 답을 두 번 묻는다. 서술문이 있는 장에서는
  // 공란과 참조가 정확히 1:1 이어야 한다.
  const withReport = c.chapters.filter((ch) => ch.report?.length).length
  if (withReport > 0 && withReport < c.chapters.length)
    errors.push(
      `보고서 서술문이 ${withReport}/${c.chapters.length}장에만 있다 — ` +
        `일부만 문장이고 나머지가 목록이면 보고서가 두 물건이 된다`,
    )

  for (const ch of c.chapters) {
    if (!ch.report?.length) continue
    const refs = ch.report.filter((r): r is { blank: number } => 'blank' in r).map((r) => r.blank)
    ch.blanks.forEach((b, i) => {
      const n = refs.filter((r) => r === i).length
      if (n === 0)
        errors.push(`${ch.order}장 '${b.label}' 공란이 서술문에 없다 — 문맥 없이 뜬다`)
      else if (n > 1)
        errors.push(`${ch.order}장 '${b.label}' 공란이 서술문에 ${n}번 나온다 — 같은 답을 두 번 묻는다`)
    })
  }

  const chapterReveals = c.reveals.filter((r) => r.trigger.on === 'chapterComplete')
  const narrated = chapterReveals.filter((r) => r.narration).length
  if (narrated > 0 && narrated < chapterReveals.length)
    errors.push(
      `장 완성 공개 ${chapterReveals.length}건 중 ${narrated}건만 서사를 가진다 — ` +
        `서사의 유무가 유용도를 노출한다`,
    )

  /**
   * 6.8 **인터루드는 모든 전환에 있어야 한다** (2026-07-29 신설)
   *
   * 위 검사는 *공개가 있는 장*끼리만 비교한다. 그런데 **공개가 아예 없는 장**은
   * 세는 대상에서 빠져서, 3장짜리 사건이 1장에만 공개를 달아도 통과했다.
   * 인터루드 화면이 생긴 지금 그 사건은 **1장을 완성할 때만 전체화면 서술이 뜨고
   * 2장은 아무 일도 안 일어난다** — `MEMORY.md` §장 인터루드가 못박은
   * *"도착물이 0개인 전환도 서술은 똑같이 나온다"* 가 깨진다.
   *
   * **마지막 장은 뺀다.** 그 장을 채우면 사건이 끝나므로 다음 전환이 없다.
   *
   * 서사가 하나도 없는 사건은 통과시킨다 — 인터루드를 아예 안 쓰는 것은
   * 전무이므로 균일하다(§9-1 의 전원/전무와 같은 근거).
   */
  if (narrated > 0) {
    const lastOrder = Math.max(...c.chapters.map((ch) => ch.order))
    const narratedAt = new Set(
      chapterReveals.filter((r) => r.narration)
        .map((r) => (r.trigger as { chapterOrder: number }).chapterOrder),
    )
    const 빠진 = c.chapters.filter((ch) => ch.order !== lastOrder && !narratedAt.has(ch.order))
    if (빠진.length)
      errors.push(
        `${빠진.map((ch) => ch.order + '장').join('·')} 완성에는 서사가 없다 — ` +
          `인터루드가 뜨는 전환과 안 뜨는 전환이 갈리면 그 자체가 유용도 신호다`,
      )
  }

  /**
   * 6.9 **공개가 가리키는 것이 실재하는가** (2026-07-29 신설)
   *
   * §7.5(i)가 `presence`·`claim` 의 슬롯·장소를 검사하면서 **`addClaims` 는
   * 한 번도 안 봤다.** 그런데 이쪽이 더 조용히 죽는다 — 앱은 화자 id 로
   * 진술을 찾아 붙이므로(`App.jsx` `revealedStatements`), **없는 id 면
   * 아무 데도 안 뜨고 오류도 없다.** 장을 완성해도 아무 일이 안 일어나는
   * 그 증상 그대로다.
   *
   * `target: 'grid'` 의 `slot` 도 같다 — 격자의 열이 시간대라 슬롯이 없거나
   * 낯설면 칸을 못 찾는다. 타입은 `slot?` 이라 **없어도 컴파일된다.**
   */
  for (const r of c.reveals) {
    // ⚠ `r.trigger` 를 그대로 쓰면 콜백 안에서 좁혀진 타입이 풀린다 — 먼저 뽑는다
    const tr = r.trigger
    const where = tr.on === 'chapterComplete' ? `${tr.chapterOrder}장 완성` : `조사 '${tr.actionId}'`
    for (const a of r.addClaims ?? []) {
      if (!c.people.some((p) => p.id === a.speaker))
        errors.push(`${where} 공개의 화자 '${a.speaker}'가 인물 목록에 없다 — 앱이 붙일 자리를 못 찾아 조용히 사라진다`)
      if (a.target === 'grid') {
        if (!a.slot)
          errors.push(`${where} 공개가 격자 칸을 채우는데 slot 이 없다 — 격자의 열은 시간대다`)
        else if (!c.slots.some((s) => s.id === a.slot))
          errors.push(`${where} 공개의 slot '${a.slot}'이 slots 레지스트리에 없다`)
      }
    }
    if (tr.on === 'action' && !c.actions.some((a) => a.id === tr.actionId))
      errors.push(`공개의 트리거 조사 '${tr.actionId}'가 조사 목록에 없다 — 영영 열리지 않는다`)
    if (tr.on === 'chapterComplete' && !c.chapters.some((ch) => ch.order === tr.chapterOrder))
      errors.push(`공개의 트리거 장 ${tr.chapterOrder}이 장 목록에 없다 — 영영 열리지 않는다`)
    for (const id of r.actions ?? [])
      if (!c.actions.some((a) => a.id === id))
        errors.push(`${where} 공개가 여는 조사 '${id}'가 조사 목록에 없다`)
  }

  // 7. 부문 분포
  const domainCount: Record<string, number> = { 물증: 0, 정황: 0, 심증: 0 }
  for (const ch of c.chapters)
    for (const b of ch.blanks) domainCount[DOMAIN_OF[b.label]]++
  for (const [d, n] of Object.entries(domainCount))
    if (n === 0) warnings.push(`${d} 부문 공란이 없다 — 부문별 채점이 성립하지 않는다`)

  // 7.5 presence → 진술 도출 무결성. 제목이 곧 규칙인 검사
  //
  // 무고한 자의 진술은 presence 에서 도출된다(claim 오버라이드 없음). 손으로
  // 쓰지 않으므로 거짓이 섞일 수 없다. 이 검사는 그 도출 모델이 성립하는지 본다:
  //   (i)   presence·claim 의 슬롯·장소가 레지스트리에 있는가 (참조 무결성)
  //   (ii)  무고한 자가 진실과 다르게 말하는가 (말하면 핵심 규칙 위반)
  //   (iii) 무고한 자가 사망 시간대에 현장에 없는가 (있으면 기회가 생겨 유일성 붕괴)
  //   (iv)  범인이 사망 시간대에 위치를 거짓말하는가 (반박할 거짓이 존재해야 함)
  const slotIds = new Set(c.slots.map((s) => s.id))
  const locIds = new Set(c.locations.map((l) => l.id))
  const windowSlots = new Set(c.slots.filter((s) => s.isWindow).map((s) => s.id))
  const scene = c.incident.scene

  const lies: { person: string; slots: string[] }[] = []
  for (const p of c.people) {
    for (const cell of [...p.presence, ...(p.claim ?? [])]) {
      if (!slotIds.has(cell.slot))
        errors.push(`'${p.name}'의 진술/위치 슬롯 '${cell.slot}'이 slots 레지스트리에 없다`)
      if (!locIds.has(cell.location))
        errors.push(`'${p.name}'의 진술/위치 장소 '${cell.location}'이 locations 레지스트리에 없다`)
    }

    const diff = divergentSlots(p)
    if (p.id === c.culprit) {
      if (diff.length === 0)
        errors.push(
          `범인 '${p.name}'의 진술이 실제 동선과 완전히 일치한다 — ` +
            `claim(알리바이 거짓말)이 없으면 잡아낼 거짓이 없다`,
        )
    } else if (diff.length > 0) {
      errors.push(
        `무고한 '${p.name}'의 진술이 실제 동선과 어긋난다 — ` +
          `'무고한 사람은 거짓말하지 않는다' 위반 (${diff.join(', ')})`,
      )
    }
    if (diff.length > 0) lies.push({ person: p.name, slots: diff })
  }

  if (windowSlots.size === 0)
    warnings.push('사망 시간대(isWindow) 슬롯이 없다 — 기회 판별의 기준이 없다')
  if (!scene) warnings.push('incident.scene 이 없다 — 무고한 자의 현장 부재를 검사할 수 없다')

  if (scene) {
    if (!locIds.has(scene))
      errors.push(`incident.scene '${scene}'이 locations 레지스트리에 없다`)
    for (const p of c.people) {
      if (p.id === c.culprit) continue
      const atScene = p.presence.some((cell) => windowSlots.has(cell.slot) && cell.location === scene)
      if (atScene)
        errors.push(
          `무고한 '${p.name}'이 사망 시간대에 현장(${scene})에 있다 — 진술 도출상 기회가 생겨 유일성이 무너진다`,
        )
    }
  }

  const culpritP = c.people.find((p) => p.id === c.culprit)
  if (culpritP?.claim && windowSlots.size > 0) {
    const trueAt = new Map(culpritP.presence.map((cell) => [cell.slot, cell.location]))
    const liesInWindow = culpritP.claim.some(
      (cell) => windowSlots.has(cell.slot) && trueAt.get(cell.slot) !== cell.location,
    )
    if (!liesInWindow)
      errors.push(
        `범인 '${culpritP.name}'의 진술이 사망 시간대 진실 위치와 같다 — 알리바이 거짓말이 없어 잡을 수 없다`,
      )
  }

  // 시각 공란의 답도 slots 어휘여야 한다
  for (const ch of c.chapters)
    for (const b of ch.blanks) {
      if (b.label === '시각' && !slotIds.has(b.answer))
        errors.push(`${ch.order}장 시각 공란의 답 '${b.answer}'이 slots 에 없다`)
      if (b.label === '장소' && !locIds.has(b.answer))
        errors.push(`${ch.order}장 장소 공란의 답 '${b.answer}'이 locations 에 없다`)
    }

  // 8. 조사 대상 대비 예산 비율
  const ratio = c.actions.length / c.budget
  if (ratio < 3)
    warnings.push(
      `조사 대상 ${c.actions.length}개 / 예산 ${c.budget} = ${ratio.toFixed(1)}배 — 3배 이상 권장. 선택이 소거가 된다`,
    )

  // 9. 산문 ↔ 데이터 정합 (2026-07-25 신설)
  //
  // 여태 검증기는 논리만 봤고 산문은 한 번도 읽지 않았다. 유서 버그가 그래서
  // 살아남았다 — "찾았다"는 **문장**과 "단어를 준다"는 **데이터**가 다른 파일에
  // 있으니 어긋나도 아무도 몰랐다. 아래 둘은 그 역할의 첫 조각이다.

  // 9-1. 지문은 전원이 갖거나 전원이 없어야 한다.
  //      넷은 담담하고 하나만 불안하면 지문이 곧 범인 표시가 된다.
  const withGesture = c.people.filter((p) => p.statement?.gesture)
  if (withGesture.length > 0 && withGesture.length < c.people.length) {
    const missing = c.people.filter((p) => !p.statement?.gesture).map((p) => p.name)
    errors.push(
      `지문이 ${withGesture.length}/${c.people.length}명에게만 있다 (없는 사람: ${missing.join('·')}) — 있고 없음이 곧 신호가 된다`,
    )
  }

  // 9-2. 현장 서술이 조사로만 얻는 단어를 미리 말하면 무료 누설이다.
  //      브리핑은 조사 0회 시점이므로 여기 등장해도 되는 것은 seedTerms 뿐이다.
  const sceneText = c.incident.sceneState?.ko ?? ''
  if (sceneText) {
    const seeded = new Set(c.seedTerms ?? [])
    const leaked = [...deriveTerms(c, new Set(c.evidence.map((e) => e.id)))]
      .filter((w) => !seeded.has(w) && sceneText.includes(w))
    if (leaked.length > 0)
      errors.push(
        `현장 서술이 조사로 얻어야 할 단어를 말한다: ${leaked.join('·')} — 브리핑은 조사 0회 시점이다`,
      )
  }

  // 9-3. 평면도 ↔ 장소 정합 (2026-07-25 신설)
  //
  // 도면은 별도 좌표계에 살아서 장소를 바꿔도 조용히 안 따라온다.
  // 그리고 도면에 없는 장소는 플레이어가 **갈 수 없다** — 조사 화면이 도면이므로.
  if (c.floorPlan) {
    const locIds = new Set(c.locations.map((l) => l.id))
    const placed = new Set<string>()
    for (const r of [...c.floorPlan.rooms, ...c.floorPlan.zones]) {
      if (!r.loc) continue
      if (!locIds.has(r.loc)) errors.push(`평면도 '${r.id}' 가 없는 장소를 가리킨다: ${r.loc}`)
      else placed.add(r.loc)
    }
    for (const l of c.locations)
      if (!placed.has(l.id))
        errors.push(`장소 '${l.label}' 이 평면도에 없다 — 플레이어가 갈 수 없다`)

    /**
     * 9-3d. **보행선의 장소 쌍이 실재하는가** (2026-07-29 신설)
     *
     * `from`·`to` 는 앱의 도보 시간표(`WALK`)를 채우는 키다. 오타가 나면
     * **조용히 안 채워진다** — 경고 한 줄만 찍히고 게임은 멀쩡히 돌아간다.
     * 이 저장소가 여러 번 밟은 「조용한 탈락」이라 오류로 세운다.
     *
     * 없는 것 자체는 오류가 아니다 — 본채 안에서만 도는 사건은 보행선이 없다.
     */
    for (const w of c.floorPlan.walks ?? []) {
      for (const [k, v] of [['from', w.from], ['to', w.to]] as const) {
        if (v && !locIds.has(v))
          errors.push(`보행선의 ${k} 가 없는 장소를 가리킨다: '${v}' — 도보 시간표가 조용히 빈다`)
      }
      if (w.min !== undefined && (!w.from || !w.to))
        warnings.push(`보행선에 ${w.min}분이 적혀 있는데 from·to 가 없다 — 앱 도보 시간표에 안 담긴다`)
    }

    // 현장은 반드시 도면에 있고 `scene` 으로 표시돼야 한다
    if (c.incident.scene) {
      const sceneRoom = c.floorPlan.rooms.find((r) => r.loc === c.incident.scene)
      if (sceneRoom && !sceneRoom.scene)
        warnings.push(`평면도의 현장(${sceneRoom.label})에 scene 표식이 없다`)

      /**
       * ★ 9-3b. **트릭이 말한 공간이 도면에 있는가** ★ (2026-07-29 신설)
       *
       * `ARCHETYPES` 가 *"트릭은 이름표가 아니라 계약이다"* 라고 못박았는데
       * **공간만 계약 밖이었다.** `staged_suicide` 는 이탈 방법이 「창을 넘어
       * 나갔다」인데, 생성 사건은 창이 상수 좌표(늘 엉뚱한 방)라 **현장에 창이
       * 있었던 적이 한 번도 없다.** 넘어갈 창이 없는데 창으로 나갔다고 말한다.
       *
       * 여기서는 **도면 기하로** 검사한다 — 창의 선분이 현장 방의 변에 닿는가.
       * 좌표를 안 보면 「창이 어딘가 있다」로 통과해버린다(그게 지금까지였다).
       */
      if (sceneRoom) {
        const onEdge = (x1: number, y1: number, x2: number, y2: number) => {
          const r = sceneRoom, L = r.x, R = r.x + r.w, T = r.y, B = r.y + r.h
          const within = (a: number, lo: number, hi: number) => a >= lo - 1 && a <= hi + 1
          const horiz = y1 === y2 && (Math.abs(y1 - T) <= 1 || Math.abs(y1 - B) <= 1)
            && within(x1, L, R) && within(x2, L, R)
          const vert = x1 === x2 && (Math.abs(x1 - L) <= 1 || Math.abs(x1 - R) <= 1)
            && within(y1, T, B) && within(y2, T, B)
          return horiz || vert
        }
        const needWindow = (c.trick.exit?.method ?? '').includes('창')
        if (needWindow && !(c.floorPlan.windows ?? []).some((w) => onEdge(w.x1, w.y1, w.x2, w.y2)))
          errors.push(
            `트릭이 창으로 빠져나갔다고 하는데(${c.trick.exit!.method}) ` +
              `현장(${sceneRoom.label})에 창이 없다 — 도면이 트릭을 뒷받침하지 않는다`,
          )
        if (!(c.floorPlan.doors ?? []).some((d) => onEdge(d.x1, d.y1, d.x2, d.y2)))
          errors.push(`현장(${sceneRoom.label})에 문이 없다 — 아무도 드나들 수 없는 방이다`)
      }
    }

    /**
     * 9-3c. **고정물이 도면 위에 실재하는가** (2026-07-29 신설)
     *
     * §9-4 는 `target.kind` 로 갈라 검사하는데, 생성기의 고정물 조사는
     * **verb 가 `fixture` 인데 kind 는 `location`** 이라 장소 풀로 검사돼
     * 전부 통과했다. 그런데 앱은 `verb:target.id` 로 키잉하고 고정물 목록을
     * `floorPlan.fixtures` **키**에서 만든다 — 거기 없으면 **고를 수가 없다.**
     *
     * 실제로 생성 사건 45개 조사 중 **11개(고정물 조사 전부)가 도달 불가**였고
     * 어떤 검사에도 안 걸렸다. §9-8 의 거울상이다 — 사건 파일이 주는데 앱이 못 준다.
     */
    const fixKeys = new Set(Object.keys(c.floorPlan.fixtures ?? {}))
    for (const a of c.actions) {
      if (a.verb !== 'fixture' || !a.target) continue
      if (!fixKeys.has(a.target.id))
        errors.push(
          `'${a.label}' 이 도면에 없는 고정물을 겨눈다: '${a.target.id}' — ` +
            `앱이 고정물 목록을 floorPlan.fixtures 에서 만들므로 고를 수가 없다`,
        )
    }

    /**
     * 9-3e. **고정물 조사의 이름이 한 모양이어야 한다** (2026-07-29 밤 신설)
     *
     * ★ 절대 규칙(유용도 비노출)이다 ★ *"결정적 단서와 레드 헤링이 완전히 동일하게
     * 생겨야 함"* — 이름의 **모양**도 생김새다.
     *
     * 생성기는 팔레트가 설비 이름을 안 주면 `○○ 설비 확인` 으로 채운다. 그런데
     * **트릭이 만든 고정물 조사는 언제나 물건 이름**(`잠금장치 조사`·`화로 조사`)이라,
     * 이름 없는 세계에서는 **모양이 갈리는 쪽이 정확히 쓸모 있는 쪽**이 됐다.
     * 2026-07-29 밤 실측에서 **네 세계 전부·사건 전부**가 그랬다(44/44).
     *
     * 골든 케이스는 넷 다 물건 이름이라(`화로 조사`·`원고 조사`) 안 걸린다 —
     * 손으로 쓰면 자연히 이렇게 된다. 걸리는 것은 **총칭으로 때운 자리가 섞일 때**다.
     *
     * ⚠ **오류가 아니라 경고다.** 오류로 걸었더니 설비 이름을 안 준 팔레트가
     * **통과율 0%** 가 됐다 — 그런데 `PALETTE-BRIEF` 는 `fixture` 를 **선택**이라고
     * 적어두고 있다(*"일부만 줘도 됩니다"*). 서식이 허용한 입력을 검증기가 전량
     * 반려하면 **둘 중 하나가 거짓말**이 된다. 내장 네 세계는 전부 채워서 실제
     * 노출은 0 이고, 남은 것은 유저 팔레트라 **고치는 법을 알려주는 쪽**이 맞다.
     * §9-10 을 오류에서 경고로 내렸을 때와 같은 판단이다.
     */
    const fixActions = c.actions.filter((a) => a.verb === 'fixture')
    const GENERIC = / 설비 확인$/
    const 총칭 = fixActions.filter((a) => GENERIC.test(a.label))
    const 물건 = fixActions.filter((a) => !GENERIC.test(a.label))
    if (총칭.length && 물건.length)
      warnings.push(
        `고정물 조사의 이름이 두 모양이다 — 물건 이름 ${물건.length}개('${물건[0]!.label}') 대 ` +
          `총칭 ${총칭.length}개('${총칭[0]!.label}'). ` +
          '트릭이 만든 조사는 언제나 물건 이름이라 **모양이 갈리는 쪽이 쓸모 있는 쪽**이 된다 — ' +
          '팔레트의 places·rooms 에 fixture 를 채우면 사라진다',
      )
  }

  // 9-4. 조사 ↔ 조사 지점 정합
  //
  // `target` 이 가리키는 것이 사라지면 **조사가 조용히 실행 불가가 된다** —
  // 화면에는 아무 일도 안 일어나고 예산도 안 줄고 오류도 안 난다.
  {
    const locIds = new Set(c.locations.map((l) => l.id))
    const fixIds = new Set(Object.keys(c.floorPlan?.fixtures ?? {}))
    const personIds = new Set([...c.people.map((p) => p.id), c.victim])
    for (const a of c.actions) {
      const t = a.target
      if (!t) continue
      const pool = t.kind === 'location' ? locIds : t.kind === 'fixture' ? fixIds : personIds
      if (!pool.has(t.id))
        errors.push(`조사 '${a.label}' 의 대상이 없다: ${t.kind} '${t.id}'`)
    }
    // 도면에 놓였는데 아무 조사도 걸리지 않은 고정물 — 눌러도 아무 일이 없다
    const targeted = new Set(c.actions.map((a) => a.target).filter(Boolean).map((t) => `${t!.kind}:${t!.id}`))
    for (const id of fixIds)
      if (!targeted.has(`fixture:${id}`))
        warnings.push(`고정물 '${id}' 에 걸린 조사가 없다 — 눌러도 아무 일이 없다`)

    /**
     * **지목할 수 없는 조사** (2026-07-27 신설).
     *
     * 앱은 조사를 `verb:target.id` 로 키잉해 평면도·용의자 카드에 매단다.
     * `target` 도 `pair` 도 없으면 **키가 `verb:(none)` 이 되어 어느 화면에도
     * 걸리지 않는다** — 검증기는 통과하는데 플레이어는 영영 실행할 수 없다.
     *
     * 실제로 `a_victim_bel`(소지품 검사 · 피해자)이 그 상태였고, 그것이 주는
     * `e_victim_phone` 은 **트릭 허점이 심긴 두 자리 중 하나**다. 앱에서는
     * 허점을 만날 길이 하나(인물)로 줄어 있었다.
     *
     * 위 `personIds` 가 `c.victim` 을 이미 포함하므로 피해자를 겨누는 것은
     * 데이터만 채우면 된다 — 대상 검사에서 막히지 않는다.
     */
    for (const a of c.actions)
      if (!a.target && !a.pair)
        warnings.push(
          `조사 '${a.label}' 를 지목할 수 없다 — target 도 pair 도 없어 화면에 걸리지 않는다`,
        )

    /**
     * **허점이 심긴 자리는 얻을 수 있어야 한다.**
     *
     * 위 9-1 은 자리가 *존재하는지*만 본다. 인상(`illusions`)은 이미
     * `routesTo(e) === 0` 으로 획득 경로를 검사하는데 허점은 안 했다 —
     * 같은 이유로 같은 검사가 필요하다. 만날 수 없는 허점은 없는 허점이다.
     */
    for (const site of c.trick.flaw?.plantedIn ?? [])
      if (allEv.has(site) && routesTo(site) === 0)
        errors.push(`허점이 심긴 물증 '${site}' 를 얻을 조사가 없다 — 만날 수 없다`)
  }

  // 9-5. 관계 도식 ↔ 인물·조사 정합 (2026-07-26 신설)
  //
  // 도식도 평면도처럼 별도 좌표계에 살아서 인물을 바꿔도 안 따라온다.
  // 끊긴 간선은 **그냥 안 그려진다** — 관계 하나가 조용히 사라지고 아무도 모른다.
  if (c.relationGraph) {
    const g = c.relationGraph
    const personIds = new Set(c.people.map((p) => p.id))
    const actionIds = new Set(c.actions.map((a) => a.id))
    const nodeIds = new Set(g.nodes.map((n) => n.id))
    for (const d of g.discoveries) if (d.node) nodeIds.add(d.node.id)

    for (const n of g.nodes) {
      if (n.kind === 'person' && !personIds.has(n.id))
        errors.push(`도식 노드 '${n.id}' 가 없는 인물을 가리킨다`)
      if (n.kind !== 'person' && !n.label)
        errors.push(`도식 노드 '${n.id}' 에 이름이 없다 — 점만 찍힌다`)
    }
    // 인물이 하나라도 빠지면 그 사람만 도식에서 지워진다. 그게 곧 표시다
    for (const p of c.people)
      if (!g.nodes.some((n) => n.kind === 'person' && n.id === p.id))
        errors.push(`인물 '${p.name}' 이 관계 도식에 없다`)

    const endpoints = [
      ...g.edges.map((e) => ({ e, from: e.from, to: e.to, what: '간선' })),
      ...g.discoveries.map((d) => ({ e: d, from: d.from, to: d.to, what: '발견' })),
    ]
    for (const { from, to, what } of endpoints) {
      if (!nodeIds.has(from)) errors.push(`도식 ${what}의 끝점 '${from}' 이 없다`)
      if (!nodeIds.has(to)) errors.push(`도식 ${what}의 끝점 '${to}' 이 없다`)
    }
    for (const d of g.discoveries)
      if (!actionIds.has(d.action))
        errors.push(`도식 발견이 없는 조사를 기다린다: '${d.action}'`)
  }

  // 9-6. 짝 조사 — 두 인물이 실재해야 하고, 도식에서 고를 수 있어야 한다
  for (const a of c.actions) {
    if (!a.pair) continue
    for (const id of a.pair)
      if (!c.people.some((p) => p.id === id))
        errors.push(`짝 조사 '${a.label}' 의 인물이 없다: '${id}'`)
    if (a.pair[0] === a.pair[1])
      errors.push(`짝 조사 '${a.label}' 이 같은 사람 둘을 가리킨다`)
    if (a.target)
      warnings.push(`조사 '${a.label}' 에 pair 와 target 이 둘 다 있다 — 실행 지점이 둘이다`)
  }

  /**
   * 9-7. **산문 ↔ 데이터 정합** (2026-07-27 신설)
   *
   * `MEMORY.md` §오케스트레이터가 「이 역할이 비어 있다」고 적어둔 자리다.
   * 비어 있던 동안 세 건이 살아서 나갔다 — 유서가 「찾았다」는데 단어를 안 준
   * 것, 관계 도식이 답을 그린 것, 결말이 옛 트릭을 서술한 것.
   *
   * 뿌리는 하나다: **문장과 데이터가 다른 파일에 있으면 어긋나도 아무도 모른다.**
   * 이제 한 파일에 있으므로 기계가 대조한다.
   *
   * 이것이 곧 **산문가(LLM)의 합격 기준**이다 — 생성된 문장이 여기를 통과해야
   * 사건에 들어간다. 사람이 쓴 문장에도 같은 자를 댄다.
   */
  {
    const words = (c.terms ?? []).map((t) => t.word).sort((a, b) => b.length - a.length)
    const seeded = new Set(c.seedTerms ?? [])
    const evById = new Map(c.evidence.map((e) => [e.id, e]))
    const termsOf = (ids: string[]) => {
      const out = new Set<string>()
      for (const id of ids) for (const w of evById.get(id)?.yieldsTerms ?? []) out.add(w)
      return out
    }
    const grantedAnywhere = new Set<string>([
      ...seeded,
      ...c.actions.flatMap((a) => [...termsOf(a.gives)]),
      ...c.evidence.filter((e) => e.atScene).flatMap((e) => e.yieldsTerms ?? []),
    ])

    // (a) 어디서도 얻을 수 없는 단어 — 사전에는 있는데 손에 들어올 길이 없다.
    //     앱에 죽은 풀 항목 셋이 아이콘·문안까지 갖춘 채 살아 보였던 그 부류다
    for (const w of words)
      if (!grantedAnywhere.has(w))
        errors.push(`확보 단어 '${w}' 를 얻을 길이 없다 — 씨앗도 아니고 주는 조사도 없다`)

    // (b) 프롤로그는 **새 정보 0** 이다. 브리핑·진술에 이미 있는 것만 다룬다.
    //     분위기 한 줄이 조사로 얻어야 할 것을 무료로 풀면 난이도가 무너진다
    for (const [i, p] of (c.prologue ?? []).entries()) {
      const t = typeof p === 'string' ? p : p?.ko ?? ''
      const leaked = words.filter((w) => !seeded.has(w) && t.includes(w))
      if (leaked.length)
        errors.push(`프롤로그 ${i + 1}번째 줄이 조사로 얻을 단어를 말한다: ${leaked.join('·')}`)
    }

    // (c) 조사의 문장이 **그 조사가 주지 않는 단어**를 말한다 — 유서 버그의 형태다.
    //     플레이어는 문장에서 그 단어를 보는데 은행에는 안 들어온다.
    //     씨앗은 이미 손에 있으므로 언급해도 된다. 다른 조사가 주는 단어를
    //     가리키는 것은 정당할 수도 있어(이미 확인된 것을 되짚기) 경고로 둔다
    for (const a of c.actions) {
      const own = termsOf(a.gives)
      const text = [a.result?.title?.ko, a.result?.body?.ko].filter(Boolean).join(' ')
      if (!text) continue
      const ghost = words.filter((w) => !seeded.has(w) && !own.has(w) && text.includes(w))
      if (ghost.length)
        warnings.push(
          `조사 '${a.label}' 의 결과문이 이 조사가 주지 않는 단어를 말한다: ${ghost.join('·')}`,
        )
    }

    // (d) 조사에 걸린 서사도 같은 자를 댄다
    for (const r of c.reveals) {
      const tr = r.trigger
      if (!r.narration || tr.on !== 'action') continue
      const a = c.actions.find((x) => x.id === tr.actionId)
      if (!a) continue
      const own = termsOf(a.gives)
      const ghost = words.filter((w) => !seeded.has(w) && !own.has(w) && r.narration!.includes(w))
      if (ghost.length)
        warnings.push(
          `조사 '${a.label}' 의 서사가 이 조사가 주지 않는 단어를 말한다: ${ghost.join('·')}`,
        )
    }
  }

  /**
   * 9-8. **반대 방향 — 데이터를 주는데 산문이 침묵한다** (2026-07-28 신설)
   *
   * 9-7 의 (a)~(d)는 전부 *산문이 데이터보다 더 말하는가*를 본다. 유서 버그가
   * 그 방향이었다 — 「찾았다」고 말해놓고 단어를 안 줬다. **거울상은 검사가
   * 없었다**: 주는데 말하지 않는 것.
   *
   * 플레이어에게는 두 방향의 피해가 같다. 예산 1을 쓰고 얻은 것이 화면에
   * 안 뜨면, 준 것이 없는 것과 구별되지 않는다.
   */
  {
    // (e) 물증을 주는데 결과문이 없다.
    //     6.55 가 이미 그 반대(`yield` 는 있는데 `gives` 가 없다)를 오류로 잡는다.
    //     같은 자리의 같은 피해이므로 등급도 같다 — `resultFor` 가 undefined 면
    //     앱이 공통 「아무것도 없음」 폴백으로 떨어뜨린다. **게임이 거짓말을 한다.**
    for (const a of c.actions)
      if (a.gives.length && !a.result)
        errors.push(
          `'${a.label}' 이 물증을 주는데 결과문이 없다 — ` +
            `플레이어는 예산을 쓰고 공통 「아무것도 없음」을 본다`,
        )

    // (f) 아무도 쓰지 않는 물증.
    //
    //     물증이 **쓰인다**는 네 가지 중 하나다:
    //       논리   fact 가 가리킨다
    //       트릭   props·staging·인상·이탈·허점이 가리킨다
    //       어휘   확보 단어를 준다
    //       읽을거리 카드에 기록이 있다 (읽는 것도 쓰는 것이다)
    //
    //     넷 다 아니면 물증 목록에 **이름만** 있는 것이고, 그것을 주는 조사는
    //     예산만 먹는다. 다만 저작 중간 상태일 수 있어(아직 안 이은 것) 경고다.
    const evUsed = new Set<EvidenceId>()
    for (const f of c.facts) f.revealedBy.forEach((e) => evUsed.add(e))
    const tk = c.trick
    for (const e of [...(tk.props ?? []), ...(tk.staging ?? [])]) evUsed.add(e)
    for (const il of tk.illusions ?? [])
      for (const e of [...(il.madeBy ?? []), ...(il.brokenBy ?? [])]) evUsed.add(e)
    for (const e of [...(tk.exit?.enabledBy ?? []), ...(tk.exit?.brokenBy ?? [])]) evUsed.add(e)
    for (const e of tk.flaw?.plantedIn ?? []) evUsed.add(e)
    for (const e of c.evidence)
      if ((e.yieldsTerms?.length ?? 0) > 0 || e.record || e.extra) evUsed.add(e.id)

    for (const e of c.evidence)
      if (!evUsed.has(e.id)) {
        const from = c.actions.filter((a) => a.gives.includes(e.id)).map((a) => a.label)
        warnings.push(
          `물증 '${e.id}'(${e.description})을 아무도 쓰지 않는다 — ` +
            `fact·트릭·확보 단어·기록 어디에도 없다` +
            (from.length ? ` · 주는 조사: ${from.join('·')}` : ''),
        )
      }
  }

  /**
   * 9-9. **진술 길이가 한쪽으로 쏠린다** (2026-07-28 신설)
   *
   * 9-1 의 같은 부류다. 지문은 **있고 없음**이 신호가 되고, 진술은 **길이**가
   * 신호가 된다 — 넷은 세 문단인데 하나만 아홉 문단이면 플레이어는 읽기도 전에
   * 「여기가 중요하다」를 안다. 절대 규칙의 **유용도 시각 구분 금지**가 정확히
   * 이것이고, `PROSE-BRIEF.md` 도 「한쪽이 길어지는 순간 그게 유용도 표시다」라고
   * 산문가에게 말해왔다. **말만 하고 검사는 없었다** — 2026-07-28에 생성기의 산문
   * 단계를 만들며 9문단 대 1문단을 넣어보니 오류도 경고도 없이 통과했다.
   *
   * ── 기준을 왜 여기에 뒀나 ────────────────────────────────
   *
   * **가장 긴 것이 가장 짧은 것의 2배를 넘고, 차이가 2문단 이상**이면 오류다.
   *
   *   · 산장(손글씨)  2~3문단 → 1.5배. 통과
   *   · 생성 사건     전원 4문단 → 1.0배. 통과
   *   · 2 대 1        2배지만 차이가 1문단뿐 — 사람이 「유독 길다」고 느끼지 않는다. 통과
   *   · 9 대 1        걸린다
   *
   * 두 조건을 **함께** 거는 이유가 셋째 줄이다. 비율만 보면 짧은 진술 사이의
   * 사소한 차이가 전부 걸려 경보가 소음이 된다 — 9-8(f)에서 배운 것과 같은 형태다.
   *
   * 등급이 **오류**인 것은 9-1 과 같은 근거다. 인물 사이의 차이가 곧 지목이 되는
   * 부류이고, 절대 규칙 위반은 이 저장소에서 가장 비싼 결함이다.
   */
  {
    const counts = c.people
      .map((p) => ({ name: p.name, n: p.statement?.paragraphs?.length ?? 0 }))
      .filter((x) => x.n > 0)

    if (counts.length > 1) {
      const most = counts.reduce((a, b) => (b.n > a.n ? b : a))
      const least = counts.reduce((a, b) => (b.n < a.n ? b : a))
      if (most.n > least.n * 2 && most.n - least.n >= 2) {
        errors.push(
          `진술 길이가 쏠렸다 — ${most.name} ${most.n}문단 대 ${least.name} ${least.n}문단 ` +
            `(${counts.map((x) => `${x.name} ${x.n}`).join(' · ')}) — 길이가 곧 유용도 표시가 된다`,
        )
      }
    }
  }

  /**
   * 9-10. **진술이 조사로 얻을 단어를 먼저 말한다** (2026-07-29 신설)
   *
   * §9-7 은 프롤로그(b) · 조사 결과문(c) · 조사 서사(d)를 읽는데 **진술은 한 번도
   * 안 읽었다.** 산문 중에 가장 긴 것이 진술인데 거기만 비어 있었다.
   *
   * 걸린 계기가 있다. 2026-07-29에 팔레트에 `secrets`(무고한 자가 감추는 것)를
   * 넣었다 — 세계마다 다른 문장이 **진술 안으로 직접 들어간다.** 그 문장이
   * 확보 단어와 겹치면 **조사할 이유가 사라진다.** `PROSE-BRIEF.md` 는 산문가에게
   * 「⛔ 진술에 나오면 안 되는 단어」를 주면서도 **받은 것을 검사하지는 않았다** —
   * 9-9 와 똑같이 「말만 하고 검사는 없었다」 형태다.
   *
   * 씨앗 단어는 예외다. 이미 플레이어 손에 있으므로 진술이 말해도 잃을 것이 없다
   * (§9-7 이 프롤로그·결과문에 두는 예외와 같은 근거다).
   *
   * ── 등급이 왜 경고인가 ──────────────────────────────────
   *
   * **처음에 오류로 걸었다가 내렸다.** 근거로 *"진술은 조사 이전에 전원이 읽으므로
   * 되짚을 과거가 없다"* 고 적었는데, **틀렸다.** 만들자마자 골든 케이스가 걸렸고
   * 걸린 자리가 백리원의 *"요즘 연예계에 마약이 돌고있다는 소문이요"* 였다 —
   * 그건 결함이 아니라 **그 인물이 산장에 온 이유**이자 작가가 일부러 쓴 문장이다.
   *
   * 그리고 **낱말을 들은 것과 확보한 것은 다르다.** 공란 후보가
   * `candidates: discovered` 라 은행에 든 단어만 뜬다 — 진술에서 들었다고
   * 공란이 풀리지 않는다. 조사는 여전히 필요하다.
   *
   * 그래서 §9-7(c)·(d)와 같은 등급이다. 그쪽을 경고로 둔 근거가
   * *"이미 확인된 것을 되짚는 문장은 정당할 수 있다"* 인데, 진술에는
   * **소문·맥락으로 낱말이 나올 자리**가 하나 더 있어서 더 강하게 적용된다.
   *
   * ⚠ 경고라고 무해한 것은 아니다. 배치 리포트의 「통과분에 상주하는 경고」에
   * 뜨므로, 팔레트 `secrets` 가 확보 단어를 물면 거기서 보인다.
   */
  {
    const words = (c.terms ?? []).map((t) => t.word)
    const seeded = new Set(c.seedTerms ?? [])
    const 글 = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')
    for (const p of c.people) {
      /**
       * ⚠ **지문도 읽는다** (2026-07-29). 이 검사는 `paragraphs` 만 봤는데,
       * 그때는 지문이 손으로 쓴 사건에만 있었다. 생성 사건이 지문을 갖게 되고
       * 산문 서식이 *"고쳐도 된다"* 로 열린 순간, **진술 바로 옆에 검사받지 않는
       * 산문이 한 줄 생긴다** — §9-7 이 프롤로그·결과문·서사를 다 읽으면서
       * 진술만 빠져 있던 그 형태가 한 칸 옆에서 반복되는 것이다.
       */
      const g = p.statement?.gesture
      const text = [
        ...(p.statement?.paragraphs ?? []).map(글),
        글(g?.pre), 글(g?.post),
      ].join(' ')
      if (!text.trim()) continue
      const leaked = words.filter((w) => !seeded.has(w) && text.includes(w))
      if (leaked.length)
        warnings.push(
          `${p.name} 의 진술이 조사로 얻어야 할 단어를 말한다: ${leaked.join('·')} — 소문·맥락이면 정당하나, 무료 지급이면 조사할 이유가 사라진다`,
        )
    }
  }

  /**
   * 9-11. **동선의 모양이 곧 지목이 된다** (2026-07-29 신설)
   *
   * 진술을 데이터에서 조립하면 **누가 어디 있었나의 「모양」이 그대로 문장의
   * 모양**이 된다. 그래서 물증을 하나도 안 캐고 다섯을 나란히 놓기만 해도
   * 범인이 잡히는 일이 생긴다 — §절대 규칙의 「유용도 시각 구분」이 산문이 아니라
   * **격자 층에서** 재발하는 형태다.
   *
   * 2026-07-29에 생성기에서 셋을 잡았다. 셋 다 뿌리가 **한 배열**이었다:
   *
   * ```
   * ① 무고한 넷이 같은 배열을 공유    → 동선 문장이 글자까지 같았다
   * ② 범인만 t0·t1·t2 를 다 말했다     → 밤을 온전히 설명하는 사람이 범인 하나
   * ③ ②를 고치니 범인만 안 움직였다    → 흩어진 넷 중 제자리에 남은 사람이 범인
   * ```
   *
   * ③이 이 검사를 만든 이유다. **②를 고친 손이 같은 결함을 뒤집어서 다시
   * 만들었다.** 눈으로는 셋 다 「그럴듯한 격자」로 보였고, 200건을 돌려 세어보고서야
   * 드러났다(`delayed_mechanism` 39건은 t1 만 맞춰서는 안 잡혔다 — t0 까지
   * 거짓말하는 아키타입이라, **모양은 슬롯 하나가 아니라 동선 전체의 성질**이다).
   *
   * ── 왜 `template` 일 때만 보는가 ─────────────────────────
   *
   * **손으로 쓴 사건은 걸어도 옳지 않다.** 골든 케이스는 무고한 셋이
   * `t3:main` 으로 동선이 같은데 **진술은 전부 다른 글**이다 — 사람이 썼기
   * 때문이다. 거기서 모양이 같은 것은 결함이 아니라 사실이고, 문장이 그것을
   * 가린다. `prose.source: 'template'` 일 때만 **모양이 곧 문장**이 된다.
   *
   * §9-10 이 골든 케이스에 걸렸을 때 등급을 내린 것과 같은 판단이지만, 이쪽은
   * **걸릴 조건 자체를 좁힐 수 있어서** 생성분에는 오류로 남긴다 — 생성기가
   * 깨진 것은 언제나 결함이고, 경고로 두면 §「초록불의 뜻」이 또 반복된다.
   */
  if (c.prose?.source === 'template' && c.people.length > 1) {
    const shape = (p: (typeof c.people)[number]) =>
      c.slots
        .map((s) => (p.claim ?? p.presence).find((x) => x.slot === s.id)?.location ?? '—')
        .join('/')

    const innocentShapes = c.people.filter((p) => p.id !== c.culprit).map(shape)
    const dup = innocentShapes.filter((s, i) => innocentShapes.indexOf(s) !== i)
    if (dup.length)
      errors.push(
        `무고한 사람 여럿의 동선이 같다 (${[...new Set(dup)].join(' · ')}) — ` +
          `조립 진술에서는 동선이 곧 문장이라 진술 정독이 인원수만큼 읽히지 않는다`,
      )

    const culpritP2 = c.people.find((p) => p.id === c.culprit)
    if (culpritP2) {
      const cs = shape(culpritP2)
      if (!innocentShapes.includes(cs))
        errors.push(
          `범인 '${culpritP2.name}'의 동선이 다섯 중 유일하다 (${cs}) — ` +
            `물증 없이 진술 모양만으로 지목된다. 무고한 한 사람이 같은 동선이어야 한다`,
        )
    }
  }

  const min = findMinPath(c)
  if (min.size === Infinity) errors.push('모든 조사를 써도 클리어 불가')

  // 기대 회차 = 오라클과 탐욕의 중간.
  //
  // 이전 모델은 `탐욕 × 1.5` 였는데 이중 계산이었다 — 탐욕 시뮬은 이미
  // salience 순으로 레드 헤링을 전부 밟는 최악에 가까운 모델이라,
  // 거기에 1.5를 또 곱하면 어떤 사건도 impossible 이 된다.
  // 반대로 오라클은 전지적 최단이라 사람이 도달할 수 없다.
  // 실제 플레이어는 둘 사이에 있다.
  //
  // ⚠ 이 모델도 아직 실측 1건(2026-07-24)으로만 뒷받침된다.
  //    플레이테스트가 쌓이면 다시 맞춰야 한다.
  const typicalCost = Math.ceil((min.size + smart.cost) / 2)
  // 밴드 = 오라클(하한) ~ 단서를 따라가는 탐욕 플레이어(상한).
  // naive(부스트 무시)는 상한으로 쓰지 않는다 — 단서를 아예 안 읽는 모델이라
  // 사람의 행동을 대표하지 못하고 숫자만 부풀린다.
  const band: [number, number] = [min.size, smart.cost]

  if (min.size > c.budget) errors.push(`최단 ${min.size}회가 예산 ${c.budget} 초과 — 클리어 불가`)
  if (typicalCost + 1 > c.budget)
    warnings.push(`기대 ${typicalCost}회 + 여유 1 > 예산 ${c.budget} — 좌절 위험`)

  const slack = c.budget - typicalCost
  const difficulty =
    slack < 0 ? 'impossible' : slack === 0 ? 'hard' : slack === 1 ? 'normal' : 'easy'

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    guiltTable: table,
    totalBlanks: c.chapters.reduce((s, x) => s + x.blanks.length, 0),
    minActions: min.size,
    minPath: min.path,
    typicalActions: typicalCost,
    typicalPath: smart.path,
    band,
    keyFactRoutes: routes,
    mandatoryActions,
    lies,
    domains: Object.entries(domainCount).map(([domain, count]) => ({ domain, count })),
    actionRatio: ratio,
    decoyRatio,
    difficulty,
  }
}
