import type { Case, Action, FactId, EvidenceId, VerifyResult, GuiltCheck } from './types.js'
import { DOMAIN_OF } from './types.js'

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
 * 순차 잠금. i번 장은 i-1번이 완성돼야 열린다.
 * 따라서 장 순서가 의존성 순서와 일치해야 하며, 검증기가 이를 강제한다.
 */
function confirmableChapter(c: Case, facts: Set<FactId>, done: Set<number>): number {
  const next = done.size
  if (next >= c.chapters.length) return -1
  return c.chapters[next].requiresFacts.every((f) => facts.has(f)) ? next : -1
}

/** 조사를 한 번도 하지 않고 도달할 수 있는 상태 */
function freeClosure(c: Case): { facts: Set<FactId>; done: Set<number> } {
  const done = new Set<number>()
  let guard = 0
  let facts = deriveFacts(c, new Set(), 0)
  while (guard++ < 100) {
    const idx = confirmableChapter(c, facts, done)
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
    const idx = confirmableChapter(c, facts, done)
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
    const idx = confirmableChapter(c, facts, done)
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

  // 2. 트릭 허점
  if (!c.trick.flaw) errors.push('트릭에 flaw 가 없다 — 파고들 지점이 없다')

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

  const obtainableTerms = new Set<string>()
  for (const e of c.evidence)
    if (reachableEvidence.has(e.id))
      (e.yieldsTerms ?? []).forEach((t) => obtainableTerms.add(t))

  // 확보 단어를 주지만 도달 불가한 물증은 데이터 오류로 잡는다
  for (const e of c.evidence)
    if ((e.yieldsTerms?.length ?? 0) > 0 && !reachableEvidence.has(e.id))
      errors.push(
        `물증 '${e.id}'(${e.description})이 확보 단어를 주지만 어떤 조사로도 나오지 않는다 — atScene 표식이 빠졌거나 조사에 연결되지 않았다`,
      )

  for (const ch of c.chapters)
    for (const b of ch.blanks)
      if (b.candidates === 'discovered' && !obtainableTerms.has(b.answer))
        errors.push(
          `${ch.order}장 '${b.answer}'(확보 후보)이 어떤 물증으로도 확보되지 않는다 — 채울 수 없어 막힌다`,
        )

  // 7. 부문 분포
  const domainCount: Record<string, number> = { 물증: 0, 정황: 0, 심증: 0 }
  for (const ch of c.chapters)
    for (const b of ch.blanks) domainCount[DOMAIN_OF[b.label]]++
  for (const [d, n] of Object.entries(domainCount))
    if (n === 0) warnings.push(`${d} 부문 공란이 없다 — 부문별 채점이 성립하지 않는다`)

  // 8. 조사 대상 대비 예산 비율
  const ratio = c.actions.length / c.budget
  if (ratio < 3)
    warnings.push(
      `조사 대상 ${c.actions.length}개 / 예산 ${c.budget} = ${ratio.toFixed(1)}배 — 3배 이상 권장. 선택이 소거가 된다`,
    )

  const min = findMinPath(c)
  if (min.size === Infinity) errors.push('모든 조사를 써도 클리어 불가')
  const typicalCost = Math.ceil(smart.cost * 1.5)
  const band: [number, number] = [
    Math.min(smart.cost, naive.cost),
    Math.max(smart.cost, naive.cost),
  ]

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
    domains: Object.entries(domainCount).map(([domain, count]) => ({ domain, count })),
    actionRatio: ratio,
    decoyRatio,
    difficulty,
  }
}
