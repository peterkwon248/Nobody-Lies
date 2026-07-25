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

  const chapterReveals = c.reveals.filter((r) => r.trigger.on === 'chapterComplete')
  const narrated = chapterReveals.filter((r) => r.narration).length
  if (narrated > 0 && narrated < chapterReveals.length)
    errors.push(
      `장 완성 공개 ${chapterReveals.length}건 중 ${narrated}건만 서사를 가진다 — ` +
        `서사의 유무가 유용도를 노출한다`,
    )

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
