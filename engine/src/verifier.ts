import type { Case, Action, FactId, EvidenceId, VerifyResult, GuiltCheck } from './types.js'
import { DOMAIN_OF, ARCHETYPES } from './types.js'
import { divergentSlots } from './deriver.js'
import { weakBlanks, type Weakness } from './clues.js'

/**
 * §5-b 경고의 문안. **`clue-check` ③ 이 같은 함수로 대조하므로 여기가 단일 출처다** —
 * 문자열을 양쪽이 각자 손으로 쓰면 이 저장소 **최다 재발 부류**가 된다
 * (07-31 `REC_TOOL`·`REC_MUTUAL`).
 */
export function weaknessWarning(w: Weakness): string {
  return w.kind === 'guess'
    ? `${w.chapter}장 '${w.label}' 공란의 답(${w.answerLabel})에 증명 사슬이 안 선다 — ` +
        `${w.why}. 플레이어에게는 찍기다 (규칙이 안 닿는 자리일 수도 있다)`
    : `${w.chapter}장 '${w.label}' 공란의 답(${w.answerLabel})이 ${w.why} — ` +
        `전제로 선언된 것이 아니면 누설이다`
}

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

    if (!ch.blanks.some((b) => b.candidates === 'discovered'))
      warnings.push(`${ch.order}장이 전부 닫힘 후보 — 조사 없이 시도할 수 있다`)
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  5-b 페어플레이 — **공란마다 도출 가능한가** (2026-08-02 · 명제 교체)
   * ─────────────────────────────────────────────────────────────
   *
   * ## 무엇을 갈아 끼웠나
   *
   * ```
   * 전   지목 장의 blanks 조합 수 ≥ 30          오류. 「찍기 난이도」를 곱으로 잰다
   * 후   모든 장 · 공란마다 사슬이 서는가        경고. weakBlanks 가 잰다
   * ```
   *
   * 옛 명제는 **정확하게 계산하고 틀린 것을 쟀다.** 곱이 크면 통과하므로 **공란 하나가
   * 근거 없이 정해져도** 안 걸린다 — 2026-08-01에 인물 공란 48개가 그 구멍으로 빠졌다.
   * *"정확한데 틀린 명제는 정밀도로 못 고친다."*
   *
   * ## ★ 재보니 명제만 틀린 게 아니라 **보는 장이 엉뚱했다** ★ (2026-08-02 실측)
   *
   * ```
   * 커밋 4건   지목 장 도출불가 0/3      ← 지목 장은 이미 100% 도출된다
   *            약한 공란 26개가 전부 1~4장   ← §5 가 한 번도 안 보던 곳
   *            옛 명제 발화 0건
   * 생성 40건  약한 공란 0               ← clue-check 이 생성 경로에서 이미 강제한다
   * ```
   *
   * 지목 장은 `R2 유죄 요건`과 위 §1 유일성이 이미 받친다. **찍기는 전부 다른 장에
   * 살고 있었고 옛 §5 는 그쪽을 볼 수단이 없었다.** 그래서 범위도 「지목 장」에서
   * **「모든 장」**으로 넓힌다.
   *
   * ## ★ 왜 지금인가 — 검사 둘이 다른 말을 하면 안 된다 ★
   *
   * `weakBlanks` 는 **`clue-check`(게이트 7단)의 종료 조건 그 자체**다. 08-02에 생성
   * 경로가 그 명제로 루프를 돌게 됐는데(`clues.ts` → `closeClues`) 검증기만 옛 명제를
   * 들고 있으면 **어느 쪽이 참인지 매번 손으로 갈라야 한다.** 같은 함수를 부르므로
   * 이제 둘이 갈릴 수 없다.
   *
   * ```
   * unique  ∧  ( cost > 0  ∨  걸음의 규칙이 전부 선언된 전제 )
   * ```
   *
   * ⛔ **오류가 아니라 경고다.** 손저작 4건은 26개가 걸린다(실측) — 이건 결함이 아니라
   * **`proof.ts` 의 `RULES` 가 사람이 쓴 산문에 안 닿는 것**이다(35/61 = 57%). 오류로
   * 걸면 산문을 입히기 전 단계가 전부 빨개져 **검사가 거짓말이 된다** — §6.8·§9-3e 를
   * 경고로 내린 것과 같은 판단이다. 생성 경로는 이미 0건이므로 **경고여도 회귀는 문다**
   * (거기서 늘면 곧바로 눈에 띈다).
   *
   * ⚠ **「사슬이 없다」와 「근거가 없다」를 이 검사는 구분 못 한다** — `proof.ts` 가 갖는
   * 것과 같은 한계다. 그래서 문장이 *"규칙이 안 닿는 자리일 수 있다"* 까지만 말한다.
   */
  for (const w of weakBlanks(c)) warnings.push(weaknessWarning(w))

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

  /**
   * ─────────────────────────────────────────────────────────────
   *  6.8 페어플레이 — 인물 공란의 답이 **집어낼 수 있는가** (2026-08-01 신설)
   * ─────────────────────────────────────────────────────────────
   *
   * ★ 왜 있나 ★ 생성 사건의 **지목 아닌 인물 공란 48개가 전부 찍기였다**(12건 실측).
   * 답이 `innocents[0]`·`innocents[i % 4]` 라는 **배열 첨자**였고, 무고한 넷은 산문에서
   * 완전히 대칭이라(이름이 나오는 자리가 조사 제목뿐) 누구를 골라도 근거가 같았다.
   * 그런데 **게이트는 내내 초록**이었다 — 그때 §5 는 **지목 장의 조합 수 ≥ 30**(찍기
   * 난이도)만 봤고, §6.5 는 `discovered` 공란만 보며, 아래 §시각·장소 검사는
   * 「그 낱말이 어휘에 있나」까지다. **공란 하나가 근거 없이 정해져도 곱이 크면 통과한다.**
   *
   * > ⏭ **그 §5 는 2026-08-02에 갈아 끼웠다** — 위 §5-b 가 이제 `weakBlanks` 로
   * > **모든 장의 공란마다** 사슬을 묻는다. 이 §6.8 은 그 **부분집합인 휴리스틱**으로
   * > 남는다(인물 공란만 · 두 갈래). 재보니 지목 장은 4건 전부 도출 100%였고 **찍기는
   * > 옛 §5 가 안 보던 장에 살고 있었다.**
   *
   * 이것이 페어플레이의 핵심 조항이다 — Knox 8 · Van Dine 1·15,
   * *"플레이어가 답에 도달할 수단을 손에 쥐고 있어야 한다"*.
   * `MEMORY.md` §절대 규칙이 **「말하지 마라」쪽만** 성문화해서 반대쪽이 비어 있었다.
   *
   * ## 무엇을 「집어낼 수 있다」로 보나 — 두 갈래
   *
   * ```
   * ⓐ 서술문이 그 사람만 주는 조사 결과를 말한다   생성 사건의 §식별 고리
   *    「소지품에서 개인적인 편지가 나온 것은 [인물]」 → 소지품 검사가 1:1 로 짚는다
   * ⓑ 그 사람의 이름이 산문 「내용」에 나온다        손저작의 방식
   *    산장: 한유빈의 진술이 일찍 온 사연을 말한다
   * ```
   *
   * ⚠ **조사 「제목」은 안 친다.** `소지품 검사 · 남주원` 은 다섯 명 전원이 똑같이
   * 갖는 목록이라 아무도 구별하지 않는다. 바로 그것 때문에 48개가 통과하고 있었다.
   *
   * ⛔ **오류가 아니라 경고다.** 손저작 사건은 논리 골격을 먼저 세우고 산문을 나중에
   * 입힌다(`PROSE-BRIEF` 왕복). 오류로 걸면 **산문 이전 단계가 전부 빨개져** 검사가
   * 거짓말이 된다 — §9-3e·§9-10 을 경고로 내린 것과 같은 판단이다.
   *
   * ─────────────────────────────────────────────────────────────
   *  ⛔ **접혔다 — 위 §5-b 가 이것을 포함한다** (2026-08-01 밤)
   * ─────────────────────────────────────────────────────────────
   *
   * **이 검사는 `R1 ∨ R3` 를 더 느슨하게 다시 쓴 것이었다.** ⓐ는 `proof.ts` 의
   * `R1 소지품 고리`, ⓑ는 `R3 산문 지목`과 같은 자리를 본다. 오늘 §5 에서 걷어낸
   * **「검사 둘이 서로 다른 명제를 말한다」**가 여기 그대로 남아 있었다.
   *
   * ★★ **그리고 재보니 ⓑ가 손저작에서 무의미했다** ★★ 답을 다른 사람으로 바꿔치기해
   * 다시 물어봤다:
   *
   * ```
   * §6.8 이 통과시킨 인물 공란 16개
   *   무의미 (아무 답이나 통과)  13   ← 다섯 명 이름이 전부 산문에 나온다
   *   가르는 것                  3   ← practice-room. 그것도 넷 중 하나만 배제한다
   *   ⓐ(조사 결과)가 참인 것      0   ← 손저작은 식별 고리를 안 쓴다
   * ```
   *
   * **「이름이 산문 어딘가에 나온다」는 5인 사건에서 언제나 참이다.** 그래서 이 검사는
   * 손저작 4건에 대해 **경고를 한 번도 안 냈고**, 그 침묵이 *"저 공란들은 도출된다"* 는
   * **거짓 안심**이었다. 07-31의 「세는 것과 확인하는 것이 다르다」가 한 층 위에서
   * 반복된 꼴이다 — 이번엔 **검사가 있는데 아무것도 안 가르고 있었다.**
   *
   * ⚠ **그래서 §5-b 의 경고 26개를 「소음」으로 읽으면 안 된다.** 소음이라 볼 근거가
   * §6.8 의 통과였는데 그 통과에 내용이 없었다. **아직 갈리지 않은 상태**가 참이다.
   *
   * ⛳ **없애지 않고 접는 이유**: ⓐ·ⓑ 두 갈래와 「지문은 증거가 아니다」는 08-01에
   * 심어보며 얻은 것이라 `proof.ts` 의 R1·R3 주석이 그것을 물려받았다. 이 문단은
   * **그 판단이 어디서 왔는지의 기록**으로 남긴다.
   */
  // (실행부 없음 — 위 §5-b 가 `proof.ts` 의 R1·R3 로 같은 자리를 본다.
  //  ⓐ·ⓑ 두 갈래를 얻은 경위와 「성을 뗀 꼴로 찾는다」·「지문은 증거가 아니다」는
  //  그쪽 규칙 주석이 물려받았다.)

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
  //
  // ★ 인물 계열이 빠져 있었다 (2026-07-31 · 감사 A) ★ 시각·장소는 무는데 **인물은 안
  // 물었다** — `answer` 를 아무 데도 없는 문자열로 바꿔도 게이트가 초록이었다. 답은
  // 인물 **id** 다(`sakura`·`yujin`, 이름이 아니다). `closed` 일 때만 본다: `discovered`
  // 는 확보 단어라 위 §확보 후보 검사가 따로 물고, 여기서 보면 거짓 실패가 된다.
  const answerPersonIds = new Set([...c.people.map((x) => x.id), c.victim].filter(Boolean))
  const PERSON_LABELS = new Set(['인물', '마지막목격자', '협박대상'])
  for (const ch of c.chapters)
    for (const b of ch.blanks) {
      if (b.label === '시각' && !slotIds.has(b.answer))
        errors.push(`${ch.order}장 시각 공란의 답 '${b.answer}'이 slots 에 없다`)
      if (b.label === '장소' && !locIds.has(b.answer))
        errors.push(`${ch.order}장 장소 공란의 답 '${b.answer}'이 locations 에 없다`)
      if (PERSON_LABELS.has(b.label) && b.candidates === 'closed' && !answerPersonIds.has(b.answer))
        errors.push(`${ch.order}장 ${b.label} 공란의 답 '${b.answer}'이 people 에 없다`)
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
  /**
   * ★ 9-3j. **장소가 있는데 평면도가 없다** ★ (2026-07-31 신설)
   *
   * `floorPlan` 은 선택 필드라(`types.ts:736`) 없어도 스키마를 통과했다. 그런데
   * **앱에서는 조사 화면이 곧 도면이다** — 좌표가 없으면 그 장소에 **갈 수가 없다**
   * (`App.jsx` §applyCase: *"조사 화면이 곧 도면이라 좌표가 없으면 그 장소에 갈 수가
   * 없다"*). 그리고 더 나쁜 것은 **앱이 자기 하드코딩 도면(산장)으로 폴백한다**는 것이다.
   *
   * 2026-07-31에 프로덕션에서 실측했다 — 손으로 이식한 `practice-room`(연습실
   * 살인사건)이 `floor_plan` 없이 나갔고, 앱은 이렇게 그렸다:
   * ```
   * LOCATIONS  main · room · annex · approach · home        ← 산장의 장소 id
   * GEO 방     vroom/「다인의 방」 · living/거실 · kitchen/부엌 · annexRoom/별채
   *                  ↑ 다른 사건의 피해자 이름이 화면에 뜬다
   * ```
   * **사건의 장소 7개는 도달 불가였고 산장이 대신 떴다.** 이 저장소가 다섯 번 걷어낸
   * 「산장 누설」이 **없는 데이터로도 재발한** 것이다 — 덮어쓸 것이 없으면 옛것이 남는다.
   *
   * 그래서 **없는 것 자체를 오류로 세운다.** 「조용한 탈락」을 오류로 올리는
   * 이 파일의 규약과 같다(§보행선). 장소가 하나도 없는 사건은 애초에 성립하지 않으므로
   * 이 검사는 **모든 사건에 걸린다.**
   */
  if (!c.floorPlan || !c.floorPlan.rooms?.length) {
    errors.push(
      `평면도가 없다 — 장소 ${c.locations.length}개가 도면에 자리를 못 얻는다. `
        + '앱은 조사 화면이 곧 도면이라 좌표 없는 장소에는 갈 수 없고, '
        + '**앱이 자기 하드코딩 도면(산장)으로 폴백해 다른 사건의 방 이름이 뜬다.**',
    )
  }

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

    /**
     * ─────────────────────────────────────────────────────────────
     *  9-3i. **도면의 기하** (2026-07-30 오후 신설)
     * ─────────────────────────────────────────────────────────────
     *
     * 배치가 붙박이 좌표에서 **생성**으로 바뀌었다(`generate.ts` §배치). 상수였을
     * 때는 한 번 맞으면 영영 맞았지만, 비율을 손대는 순간 방이 겹치거나 문이 허공에
     * 뜬다 — 그리고 **게이트 어디에도 그걸 보는 눈이 없었다.**
     *
     * ~~★ 앱이 방의 테두리를 안 그린다는 것이 이 검사들의 뿌리다 ★~~
     * **2026-07-31에 렌더러가 고쳐졌다.** `App.jsx` §sWalls 는 이제 방마다 네 변을
     * 내고 **덮인 횟수가 2 이상인 구간만** 내벽으로 그린다. 한 번만 덮인 변(봉투 ·
     * 중정 · 노치)은 §sPoche 가 **두꺼운 외벽**으로 가져가고, §sPoche 는 봉투
     * 직사각형이 아니라 **방들의 합집합**을 외곽선으로 쓴다(`martinez`).
     * ⟹ **빈 자리가 있어도 선이 그려진다.** ⓐⓑⓓ 는 그대로 유효하고, ⓒ 만 뜻이 바뀌었다.
     *
     * ⚠ **손으로 쓴 산장이 넷 다 통과한다** — 검사를 만들고 먼저 산장에 대봤다.
     * 처음엔 산장이 **네 갈래에서 떨어졌는데 사건이 아니라 측정이 틀렸다**:
     * `building` 은 **선택 필드**라 산장의 문·창이 생략하고 앱은 본채로 본다.
     * 그래서 아래는 전부 `bOf()` 로 기본값을 메운다. §9-3g 가 *"「창 슬롯만
     * 가리켜야 한다」로 걸면 산장이 떨어진다"* 고 적어둔 그 함정을 그대로 밟았다.
     */
    const MAIN = c.floorPlan.buildings[0]?.id
    const bOf = (x: { building?: string }) => x.building ?? MAIN
    const EPS = 0.6
    const near = (a: number, b: number) => Math.abs(a - b) < EPS
    /** 선분이 이 사각형의 **변 위**에 놓였는가 */
    const onRect = (r: { x: number; y: number; w: number; h: number },
                    x1: number, y1: number, x2: number, y2: number) => {
      const L = r.x, R = r.x + r.w, T = r.y, B = r.y + r.h
      const wi = (a: number, lo: number, hi: number) => a >= lo - 1 && a <= hi + 1
      return (near(y1, y2) && (near(y1, T) || near(y1, B)) && wi(x1, L, R) && wi(x2, L, R)) ||
             (near(x1, x2) && (near(x1, L) || near(x1, R)) && wi(y1, T, B) && wi(y2, T, B))
    }
    const roomsBy = new Map<string, typeof c.floorPlan.rooms>()
    for (const r of c.floorPlan.rooms) {
      const k = bOf(r) ?? ''
      if (!roomsBy.has(k)) roomsBy.set(k, [])
      roomsBy.get(k)!.push(r)
    }

    for (const [bid, rs] of roomsBy) {
      const b = c.floorPlan.buildings.find((x) => x.id === bid)
      if (!b) {
        errors.push(`평면도의 방이 없는 건물을 가리킨다: '${bid}'`)
        continue
      }
      // ⓐ 방끼리 겹치면 **앱이 그대로 겹쳐 그린다** — 07-29에 「엉망」을 만든 그 자리다
      for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++) {
          const A = rs[i]!, B = rs[j]!
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
          const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
          if (ox > EPS && oy > EPS)
            errors.push(`평면도의 방이 겹친다: '${A.label}' ∩ '${B.label}' (${Math.round(ox)}×${Math.round(oy)})`)
        }
      // ⓑ 방이 건물 밖으로 나가면 외벽 밖에 방이 뜬다
      for (const r of rs)
        if (r.x < b.x - EPS || r.y < b.y - EPS || r.x + r.w > b.x + b.w + EPS || r.y + r.h > b.y + b.h + EPS)
          errors.push(`평면도의 방 '${r.label}' 이 건물 '${bid}' 밖으로 나간다`)
      /**
       * ⓒ 방이 봉투를 빈틈 없이 채우는가. **면적 합으로 센다** — 겹침(ⓐ)이 0인
       * 상태에서 합이 같으면 빈틈도 0이다.
       *
       * ⚠ **경고다.** 오류로 걸면 저작자가 중정 있는 건물을 그리려는 순간 게이트가
       * 막는다 — §9-3e·§9-10 을 경고로 내린 것과 같은 판단이다.
       *
       * ★ **2026-07-31에 이 경고의 뜻이 바뀌었다** ★ 전에는 *"그 자리에 선이 하나도
       * 안 그려진다"* — **렌더 결함의 예고**였다. 이제 렌더러가 중정·ㄱ자를 제대로
       * 그리므로 **빈 자리는 정당한 저작**이다. 남은 뜻은 *"일부러 그런 것이냐"* 하나다.
       * 그래서 문구도 바꿨다 — 옛 문구를 두면 **검증기가 없는 결함을 예고하게 된다.**
       */
      const sum = rs.reduce((a, r) => a + r.w * r.h, 0)
      if (Math.abs(sum - b.w * b.h) > 1)
        warnings.push(
          `건물 '${bid}' 에 방이 없는 자리가 있다 (방 합 ${sum} ≠ 건물 ${b.w * b.h}) — ` +
            '중정·ㄱ자로 **의도한 것이면 그대로 두라**(2026-07-31부터 앱이 외벽으로 그린다). ' +
            '의도한 것이 아니면 빈틈이다',
        )
      /**
       * ⓓ **문으로 서로 닿는가.** 조사 화면이 곧 도면이라 못 가는 방은 없는 방이다.
       *
       * ⚠ 「홀에서 닿는가」로 쓰면 **산장이 떨어진다** — 산장의 장소 id 는 `main`
       * 이고 `hall` 이라는 이름이 없다. 참말은 「그 건물의 방들이 이어져 있다」다.
       */
      const inner = c.floorPlan.doors.filter((d) => bOf(d) === bid && !d.ext)
      const adj = new Map(rs.map((r) => [r.id, [] as string[]]))
      for (const d of inner) {
        const touch = rs.filter((r) => onRect(r, d.x1, d.y1, d.x2, d.y2))
        for (const a of touch) for (const z of touch) if (a !== z) adj.get(a.id)!.push(z.id)
      }
      const seen = new Set([rs[0]!.id])
      const queue = [rs[0]!.id]
      while (queue.length)
        for (const nb of adj.get(queue.shift()!) ?? [])
          if (!seen.has(nb)) { seen.add(nb); queue.push(nb) }
      for (const r of rs)
        if (!seen.has(r.id))
          errors.push(`평면도의 방 '${r.label}' 에 문이 없다 — 다른 방에서 갈 수 없는 방이다`)
    }
    // ⓔ 문은 어느 방의 변 위에, 창은 건물 바깥벽 위에
    for (const d of c.floorPlan.doors)
      if (!(roomsBy.get(bOf(d) ?? '') ?? []).some((r) => onRect(r, d.x1, d.y1, d.x2, d.y2)))
        errors.push(`평면도의 문 '${d.id}' 이 어느 방의 변에도 없다 — 허공에 뜬 문이다`)
    for (const w of c.floorPlan.windows ?? []) {
      const b = c.floorPlan.buildings.find((x) => x.id === bOf(w))
      if (!b || !onRect(b, w.x1, w.y1, w.x2, w.y2))
        errors.push(`평면도의 창(${w.x1},${w.y1})이 건물 바깥벽 위에 없다 — 창은 바깥벽에만 난다`)
    }
    /**
     * ⓕ 고정물이 **자기 장소 안**에 있는가. 07-30까지 시신 좌표가 `x:200, y:300`
     * 으로 박혀 있었고 현장이 늘 왼쪽 큰 칸이라 맞았다 — 배치가 움직이면
     * **시신이 남의 방에 눕는다.** 도면이 사실을 잘못 말하는 것이다.
     */
    for (const [key, fx] of Object.entries(c.floorPlan.fixtures ?? {})) {
      if (!fx.loc) continue
      const host = [...c.floorPlan.rooms, ...c.floorPlan.zones].filter((a) => a.loc === fx.loc)
      if (!host.length) continue
      if (!host.some((a) => fx.x >= a.x - 1 && fx.x <= a.x + a.w + 1 && fx.y >= a.y - 1 && fx.y <= a.y + a.h + 1))
        errors.push(`고정물 '${fx.label ?? key}' 이 자기 장소('${fx.loc}') 밖에 찍힌다`)
    }
  }

  /**
   * 9-3f. **쪼갠 사망 구간의 이름표를 기계가 지었다** (2026-07-30 신설)
   *
   * `deathCells` ≥ 2 면 창에 칸마다 이름표가 하나씩 필요한데 팔레트의 `times` 는
   * `t0·t1·t2` 셋뿐이다. 팔레트가 `times.window` 를 안 주면 생성기가 `t1` 에
   * 「(전반)·(중반)·(후반)」을 붙여 채운다 — **기계가 지은 어휘**다.
   *
   * ★ 왜 이 자리만 따로 보나 ★ `times` 는 **진술마다 반복 인용**된다
   * (*"…에는 …에 있었습니다"*). 한 낱말이 어색하면 **다섯 사람의 진술이 전부**
   * 흐려지므로, 팔레트 어휘 중 **가장 비싼 자리**다(§업계 은어 절이 같은 이유로
   * 시간대를 특히 지목한다). `rooms` 처럼 옆에 설명이 붙는 자리가 아니다.
   *
   * ⚠ **오류가 아니라 경고다.** `times.window` 는 서식에서 **선택**이고,
   * 「(전반)/(후반)」도 뜻은 선다 — 다만 손으로 쓴 것보다 못하다. 서식이 허용한
   * 입력을 전량 반려하면 둘 중 하나가 거짓말이 된다(§9-3e·§9-10 과 같은 판단).
   *
   * 한 칸이면 접미가 안 붙으므로 **이 검사는 아예 발화하지 않는다** — 지금 나가는
   * 사건 전부가 그렇다.
   */
  {
    const win = c.slots.filter((s) => s.isWindow)
    const DERIVED = /\s\((전반|중반|후반)\)$/
    const machine = win.filter((s) => DERIVED.test(s.label))
    if (win.length > 1 && machine.length)
      warnings.push(
        `사망 구간이 ${win.length}칸인데 이름표 ${machine.length}개가 기계 것이다 ` +
          `('${machine[0]!.label}'). times 는 **진술마다 반복 인용**되는 가장 비싼 어휘 자리다 — ` +
          '팔레트의 times.window 에 칸마다 이름을 하나씩 적으면 사라진다',
      )
  }

  /**
   * 9-3g. **사망 구간 축소가 가리키는 범위** (2026-07-30 신설)
   *
   * `narrows_window` 는 슬롯 **범위 `[from, to]`** 다. `schema.ts` 는 두 슬롯이
   * **존재하는지만** 보므로, 범위가 뒤집히거나 사망 구간을 한 칸도 안 덮어도
   * 통과한다 — 그러면 부검을 해도 **아무것도 안 좁혀지고 오류도 안 난다.**
   *
   * ⚠ **「창 슬롯만 가리켜야 한다」로 걸면 안 된다** — 산장이 `[t1, t2]` 인데
   * `t1`(새벽 3시)은 창이 아니다. 축소의 정밀도(3~5시)가 슬롯보다 잘아서 범위의
   * 시작을 앞 칸에 두는 것이고, **그것이 골든 케이스다.** 서식이 허용하는 모양을
   * 검증기가 반려하면 둘 중 하나가 거짓말이 된다(§9-3e·§9-3f 와 같은 판단).
   *
   * 그래서 무는 것은 둘뿐이다 — **뒤집힘**과 **사망 구간을 하나도 안 덮음.**
   */
  {
    const order = c.slots.map((s) => s.id)
    const winIds = new Set(c.slots.filter((s) => s.isWindow).map((s) => s.id))
    for (const r of c.reveals) {
      const nw = r.narrowsWindow
      if (!nw?.length) continue
      const from = nw[0]!, to = nw[nw.length - 1]!
      const a = order.indexOf(from), b = order.indexOf(to)
      if (a < 0 || b < 0) continue // 슬롯 존재는 schema 가 본다
      if (a > b) {
        errors.push(`narrows_window 범위가 뒤집혔다 ('${from}' → '${to}') — 좁혀지는 구간이 없다`)
        continue
      }
      if (!order.slice(a, b + 1).some((id) => winIds.has(id)))
        errors.push(
          `narrows_window '${from}'~'${to}' 가 사망 구간(isWindow)을 한 칸도 안 덮는다 — ` +
            '부검을 해도 아무것도 안 좁혀지고 화면은 조용하다',
        )
    }
  }

  /**
   * 9-3h. **사람을 겨누는 조사에서 범인만 혼자 다르다** (2026-07-30 신설)
   *
   * ★ 이 검사는 실제 누설을 잡고 만들어졌다 ★ 생성기가 소지품 레드 헤링을
   * `innocents` 에만 달아서 **범인만 소지품이 비었다.** 150건 전수로 재니
   * **150/150** 이었다 — 소지품을 다섯 번 누르면 답이 나온다(예산 11 중 5).
   * 게이트 7단은 내내 초록이었고, 앱의 빈손 문구가 하필
   * *"이 대상은 배제해도 좋다"* 라 화면에서도 안 튀었다.
   *
   * ── 왜 「전원 같아야 한다」로 안 걸었나 ──────────────────
   *
   * **산장이 떨어진다.** 산장의 통화 기록은 둘이 결과를 주고 셋이 빈손이다
   * (`a_ph_yuri`·`a_ph_wy` ↔ `a_ph_sakura`·`a_ph_yena`·`a_ph_yujin`).
   * 갈리는 것 자체는 정상이다 — **고립이 문제**다. 넷 대 하나로 갈리고 그 하나가
   * 범인이면, 플레이어는 같은 조사를 다섯 번 눌러 답을 얻는다.
   *
   * 그래서 무는 것은 하나뿐이다 — **같은 동사 안에서 범인이 혼자인 쪽에 있을 때.**
   * 등급이 **오류**인 것은 §9-1·§9-9 와 같다. 정답 누설이 이 저장소에서 가장 비싸다.
   */
  {
    const suspects = c.people.map((p) => p.id).filter((id) => id !== c.victim)
    /**
     * ⚠ **사람을 기준으로 센다 — 조사를 기준으로 세면 구멍이 난다.** 범인만 그
     * 동사의 조사를 **아예 안 가지는** 경우가 같은 크기의 누설인데, 조사 목록만
     * 훑으면 범인 행이 없어서 검사가 그냥 지나간다. 없는 것도 「빈손」으로 센다.
     */
    const verbs = new Set(
      c.actions
        .filter((a) => a.target?.kind === 'person' && a.target.id !== c.victim && a.verb)
        .map((a) => a.verb!),
    )
    for (const verb of verbs) {
      if (suspects.length < 3) continue // 둘 이하면 「혼자」가 뜻을 갖지 않는다
      const productive = (pid: string) =>
        c.actions.some(
          (a) => a.verb === verb && a.target?.kind === 'person' && a.target.id === pid && a.yield !== 'empty',
        )
      const mine = productive(c.culprit)
      const sameSide = suspects.filter((pid) => productive(pid) === mine)
      if (sameSide.length === 1)
        errors.push(
          `'${verb}' 조사에서 범인만 혼자 ${mine ? '결과를 준다' : '빈손이다'} ` +
            `(용의자 ${suspects.length}명 중 1명) — 같은 조사를 사람마다 눌러보면 답이 나온다`,
        )
    }
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

  /**
   * ─────────────────────────────────────────────────────────────
   *  9-11. **진술이 남의 사망 구간 위치를 말한다** — 공짜 알리바이 (2026-08-01 신설)
   * ─────────────────────────────────────────────────────────────
   *
   * ★ 왜 있나 ★ `STATEMENT-BRIEF` 규칙 4가 **이미 금지하고 있는데 검사가 없었다.**
   *
   * > *"남이 사망 구간에 어디 있었는지 말하지 마세요. 「그때 ○○씨도 홀에 있었다」는
   * > 남의 알리바이를 공짜로 만들어 줍니다. **무고한 사람은 거짓말하지 않으므로 그 말은
   * > 참으로 확정되고**, 플레이어가 조사로 알아낼 것이 하나 사라집니다."*
   *
   * 오늘 불변식 행렬을 만들며 `진술 × 누설` 이 ✓ 인데 **반만 덮인 것**을 찾았다 —
   * §9-10 은 **확보 단어 누설만** 본다. 규칙이 서식에 적혀 있고 검사가 없는 것은
   * 오늘 §6.8 을 만든 이유(인물 공란 48개)와 **정확히 같은 꼴**이다.
   *
   * ## 판정 — 한 문단에 셋이 같이 있으면
   *
   * ```
   * 남의 이름  +  사망 구간 칸 이름  +  장소 이름     → 공짜 알리바이 의심
   * ```
   *
   * ⚠ **경고다.** 판정이 **낱말 동시 출현**이라 정밀하지 않다 — §9-7(c)·§9-10 과 같은
   * 등급이고 같은 이유다. 실제로 오늘 재보니 순진한 낱말 대조는 **20/20 거짓 양성**이
   * 나왔다(「홀에서 걸어서 2분」 같은 거리 참조점 · 「무대 옷」 같은 합성명사).
   * 이 검사는 조건이 셋이라 그보다 훨씬 좁지만, **오류로 걸 만큼 좁지는 않다.**
   *
   * ⚠ **성을 뗀 꼴로 찾는다** — 한국어 진술은 「한유빈」을 「유빈 언니」로 부른다.
   * 성을 붙여서 찾다가 산장이 다섯 줄 빨개진 것이 오늘 §6.8 에서 있었다.
   *
   * ★ **16건(손저작 4 · 생성 12) 실측 0건이다.** 즉 지금은 지켜지고 있고, 이 검사는
   * **회귀 감시**다 — 특히 산문 왕복에서 LLM 이 이 규칙을 어길 때가 진짜 자리다.
   */
  {
    const ko9 = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')
    const winLabels = c.slots.filter((s) => s.isWindow).map((s) => ko9(s.label)).filter(Boolean)
    const locLabels = c.locations.map((l) => ko9(l.label)).filter(Boolean)
    if (winLabels.length && locLabels.length) {
      for (const p of c.people) {
        const others = c.people
          .filter((q) => q.id !== p.id)
          .map((q) => ({ id: q.id, name: ko9(q.name) }))
          .filter((q) => q.name)
          .map((q) => ({ ...q, short: q.name.length > 2 ? q.name.slice(-2) : q.name }))
        for (const para of p.statement?.paragraphs ?? []) {
          const t = ko9(para)
          if (!t) continue
          const who = others.find((q) => t.includes(q.short))
          if (!who) continue
          const win = winLabels.find((L) => t.includes(L))
          if (!win) continue
          const loc = locLabels.find((L) => t.includes(L))
          if (!loc) continue
          warnings.push(
            `'${ko9(p.name)}'의 진술이 '${who.name}'의 사망 구간 위치를 말한다 ` +
              `(「${win}」+「${loc}」) — 무고한 사람의 말은 참으로 확정되므로 ` +
              `**공짜 알리바이**가 된다 (STATEMENT-BRIEF 규칙 4)`,
          )
        }
      }
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  9-13. **관계 도식이 범인을 처음부터 그린다** (2026-08-01 신설)
   * ─────────────────────────────────────────────────────────────
   *
   * ★ 왜 있나 ★ `MEMORY.md` §오케스트레이터가 *"관계 그래프가 답을 그림"* 을
   * **미해결**로 적어둔 지 오래인데 검사가 없었다. 오늘 불변식 행렬에서
   * `관계도 × 누설` 이 빈칸인 것을 보고 재봤다.
   *
   * 산장을 재니 **danger 간선이 닿는 사람이 범인 하나**였다:
   * ```
   * 문세라(범인)  간선 3  danger 3
   * 서지안        간선 0  danger 0
   * 한유빈        간선 0  danger 0
   * ```
   * **그런데 결함이 아니었다** — 넷 다 게이트돼 있다(`revealedAfter: 4·5` 또는
   * 조사 `a_annex`·`a_sakura`). **벌어서 본다.** 첫 판단이 틀렸고 재서 정정했다.
   *
   * ⚠ **그러니 이 검사는 「산장이 이미 지키는 규칙」을 못박는 것**이다. 지금은
   * 아무것도 강제하지 않아서, 누가 `revealedAfter` 없는 danger 간선을 하나 그으면
   * **관계도 탭을 여는 순간 범인이 보인다.** §절대 규칙의 「유용도 시각 구분 금지」가
   * 도식 층에서 재발하는 형태다.
   *
   * ## 판정
   *
   * **처음부터 보이는**(`revealedAfter` 없음) danger 간선이 닿는 인물이
   * **범인 하나뿐**이면 오류. `discoveries` 는 조사로만 열리므로 언제나 벌어서 본다 —
   * 여기서 안 센다.
   *
   * 등급이 **오류**인 것은 §9-1·§9-9 와 같다 — 정답 누설이 이 저장소에서 가장 비싸다.
   * 그리고 §9-10 처럼 골든 케이스에 걸리지도 않는다(산장이 이미 지킨다).
   */
  if (c.relationGraph) {
    const open = c.relationGraph.edges.filter((e) => e.danger && e.revealedAfter == null)
    if (open.length) {
      const personIds = new Set(c.people.map((p) => p.id))
      const touched = new Set<string>()
      for (const e of open) {
        if (personIds.has(e.from)) touched.add(e.from)
        if (personIds.has(e.to)) touched.add(e.to)
      }
      if (touched.size === 1 && touched.has(c.culprit)) {
        const nm = c.people.find((p) => p.id === c.culprit)?.name
        errors.push(
          `관계 도식의 **처음부터 보이는** danger 간선이 '${nm}' 한 사람만 가리킨다 — ` +
            `도식 탭을 여는 것만으로 범인이 드러난다. revealedAfter 를 주거나 discoveries 로 옮겨라`,
        )
      }
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  9-14. **확보 단어를 주는 물증의 기록이 비어 있다** (2026-08-01 신설)
   * ─────────────────────────────────────────────────────────────
   *
   * `evidence.record` 는 **물증 카드에 뜨는 글**이다. 확보 단어를 주는 물증인데
   * 기록이 비면 **플레이어가 여는 카드가 설명 한 줄뿐**이 된다.
   *
   * ★ 이것은 §6.7 이 서사에 대해 말한 것과 **같은 부류**다 ★
   * *"서사의 유무가 유용도를 노출한다"* — 기록도 같다. 어떤 물증은 카드에 글이 있고
   * 어떤 것은 비어 있으면 **그 유무가 곧 「여기가 중요하다」 표시**가 된다.
   * §절대 규칙의 **유용도 시각 구분 금지**가 물증 층에서 재발하는 형태다.
   *
   * ## 실측 (2026-08-01)
   *
   * ```
   * mountain-lodge        단어 주는 물증 9 · 기록 빈 것 3
   * practice-room                       4 ·            2
   * gen-1·2·3                           8 ·            3
   * closing-theater                     8 ·            0   ← 산문 왕복을 거쳤다
   * pipe-organ-workshop                 8 ·            0   ← 같다
   * ```
   *
   * ★ **산문 왕복을 거친 둘만 0 이다.** 즉 이 구멍은 **산문가가 메우고 있고**,
   * 왕복을 안 거친 사건은 빈 채로 나간다. 생성 경로가 반쪽인 자리가 여기에도 있다.
   *
   * ⚠ **경고다.** 골든 케이스(산장 3건)에 걸리므로 오류로 두면 게이트가 빨개진다 —
   * §9-10 을 오류에서 경고로 내렸을 때와 같은 판단이다. 그리고 이건 **누설의 위험**이지
   * 누설 자체가 아니다. 기록이 **전부 없으면** 유무가 안 갈리므로 문제가 없고,
   * 그래서 **섞여 있을 때만** 문다.
   */
  {
    const ko14 = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')
    const giving = c.evidence.filter((e) => (e.yieldsTerms?.length ?? 0) > 0)
    const blank = giving.filter((e) => !ko14(e.record).trim())
    // 전부 있거나 전부 없으면 유무가 안 갈린다 — 섞여 있을 때만 표시가 된다
    if (blank.length && blank.length < giving.length)
      warnings.push(
        `확보 단어를 주는 물증 ${giving.length}개 중 ${blank.length}개의 기록이 비어 있다 ` +
          `(${blank.map((e) => e.id).join('·')}) — 카드에 글이 있고 없고가 갈리면 ` +
          `**그 유무가 곧 유용도 표시**다 (§6.7 이 서사에 대해 말한 것과 같은 부류)`,
      )
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  9-15. **진술 산문이 자기 주장 격자와 어긋난다** (2026-08-02 신설)
   * ─────────────────────────────────────────────────────────────
   *
   * `matrix.ts` 가 **「가장 큰 빈칸」**으로 찍어두고 있던 자리다 —
   * *"「무고한 사람은 진실만 말한다」가 **격자에서만** 강제된다. 산문은 무검사다."*
   *
   * §7.5 는 `presence` ↔ `claim` 을 **구조로** 대조한다. 그런데 플레이어가 실제로
   * 읽는 것은 **산문**이고, 산문은 격자와 따로 논다 — 산문 왕복에서 LLM 이
   * 「새벽에 홀에 있었다」고 쓰는데 격자는 별채를 가리켜도 **아무도 안 본다.**
   * 그러면 격자와 진술이 서로 다른 말을 하고, 플레이어의 배제 추론이 무너진다.
   *
   * ## 무엇과 대조하나 — **진실이 아니라 「그 사람이 하는 말」이다**
   *
   * ```
   * 주장 격자 = presence 를 claim 이 칸별로 덮어쓴 것
   * ```
   *
   * 범인은 격자에서도 거짓말한다(`claim`). 그 거짓말과 산문이 **일치하는 것이 정상**이다 —
   * 범인은 일관된 이야기를 해야 잡을 맛이 난다. 그래서 진실(`presence`)과 대조하면
   * **범인 전건이 빨개진다.** 실측으로 걸렸다: 진실과 대조하는 판을 심어보니
   * 「안 물림」 11건이 전부 `claim` 이 있는 사람이었고, **그건 miss 가 아니라 정답**이었다.
   *
   * ## 어휘 대조인데 왜 쓸 만한가 — **닻이 셋이다**
   *
   * §9-12 가 *"순진한 낱말 대조는 20/20 거짓 양성"* 이라고 적어둔 그 부류인데,
   * 이쪽은 셋으로 좁혀서 다르다:
   *   ① **말하는 사람 자신의** 칸만 본다 (남의 위치가 아니다 — 그건 §9-12)
   *   ② 문단이 **시각 하나 · 장소 하나**만 말할 때만 본다.
   *      여럿이면 **어느 쌍이 짝인지 알 수 없으므로 안 본다** — 찍지 않는다
   *   ③ 그 칸이 격자에 **있을 때만** 본다 (없는 것은 §7.5·스키마 몫이다)
   *
   * ## 실측 (2026-08-02 · 짓기 전에 쟀다)
   *
   * ```
   * 진술 문단             241
   *   시각·장소를 둘 다 말한다   169
   *   시각 1 · 장소 1           149   ← 이 검사가 보는 것 (62%)
   * 거짓 양성 (성한 16건)         0
   * 심어서 물림                70 / 70 = 100%   (주장 칸을 옮기고 산문은 그대로 뒀다)
   * ```
   *
   * ⚠ **경고다.** 어휘 동시 출현이라 §9-10·§9-12 와 같은 등급이다. 산문이 더 풍부해지면
   * 새 표현이 걸릴 수 있고, **오류로 걸면 산문 왕복 중간 상태가 통째로 빨개진다.**
   * 16건에서 0 을 유지하면 그때 오류로 올린다 — 지금 올리면 근거가 16건뿐이다.
   */
  {
    const ko15 = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')
    const slotLabels = c.slots.map((s) => ({ id: s.id, L: ko15(s.label) })).filter((x) => x.L)
    const locLabels = c.locations.map((l) => ({ id: l.id, L: ko15(l.label) })).filter((x) => x.L)
    for (const p of c.people) {
      const asserted = new Map(p.presence.map((x) => [x.slot, x.location]))
      for (const x of p.claim ?? []) asserted.set(x.slot, x.location)
      for (const raw of p.statement?.paragraphs ?? []) {
        const t = ko15(raw)
        if (!t) continue
        const hitSlots = slotLabels.filter((x) => t.includes(x.L))
        const hitLocs = locLabels.filter((x) => t.includes(x.L))
        if (hitSlots.length !== 1 || hitLocs.length !== 1) continue
        const slot = hitSlots[0]!, loc = hitLocs[0]!
        const gridLoc = asserted.get(slot.id)
        if (gridLoc === undefined || gridLoc === loc.id) continue
        const gridLabel = locLabels.find((x) => x.id === gridLoc)?.L ?? gridLoc
        warnings.push(
          `'${ko15(p.name)}'의 진술이 자기 격자와 어긋난다 — 문단은 「${slot.L}」에 ` +
            `「${loc.L}」이라 말하는데 격자의 그 칸은 '${gridLabel}' 다. ` +
            '격자와 진술이 다른 말을 하면 플레이어의 배제 추론이 무너진다',
        )
      }
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────
   *  9-16. **인물별 수량이 범인을 혼자 세운다** (2026-08-02 신설)
   * ─────────────────────────────────────────────────────────────
   *
   * §9-3h 의 명제(**고립이 문제다**)를 **플레이어가 화면에서 셀 수 있는 수량**으로
   * 넓힌다. §9-3h 는 「빈손이냐 아니냐」만 봤는데, 용의자 카드와 조사 목록에는
   * **세어볼 수 있는 것이 더 있다**:
   *
   * ```
   * 프로필에 찬 칸 수     용의자 카드의 동기·수단·기회 (App.jsx §per[p.id].slots)
   * 그 사람을 겨누는 조사 수   조사 목록에서 그냥 보인다
   * 그 조사들의 비용 합       비용도 목록에 찍힌다
   * ```
   *
   * `MEMORY §절대 규칙` 이 **이름으로 금지한 자리**다 — *"프로필의 유죄 판정 금지.
   * 사실만. `기회 있음 ✓` 금지"* · *"유용도 시각 구분 금지"*. **그런데 검사가 없었다.**
   * 그 규칙은 개발 중 **일곱 차례 다른 형태로 재발**했다고 같은 절이 적어뒀다.
   *
   * ## ⛳ salience 는 일부러 뺐다 — **화면에 안 나온다**
   *
   * `matrix.ts` 의 옛 노트가 *"salience·비용·조사 개수·빈손 여부"* 를 누설 축으로
   * 적어뒀는데, **`salience` 는 `App.jsx` 어디에도 렌더되지 않는다**(전수 grep 0건).
   * 보이지 않는 값은 누설할 수 없다. 재보니 범인의 고립률이 **무고한 자보다 낮았다**
   * (34% 대 41% · 배율 0.82x) — **기준선 없이 34% 만 봤으면 없는 누설을 잡으러 갔다.**
   *
   * ## 실측 (2026-08-02 · 44건 = 생성 40 + 저작 4)
   *
   * ```
   * 프로필 칸 수 고립    범인 0/44   무고 0/176
   * 조사 개수 고립       범인 0/44   무고 0/176
   * 비용 합 고립         범인 0/44   무고 0/176
   * ```
   *
   * **전부 0 이다 — 즉 이것은 회귀 감시다.** §9-13(관계 도식)을 지을 때와 같은 자리다:
   * 산장이 이미 지키고 있었고 **규칙이 못박히지 않았을 뿐**이었다. 등급이 **오류**인
   * 것은 §9-3h 와 같은 명제라서다(정답 누설이 이 저장소에서 가장 비싸다).
   */
  {
    const suspectsOnly = c.people.filter((p) => p.id !== c.victim)
    if (suspectsOnly.length >= 3) {
      const zero = () => new Map(suspectsOnly.map((p) => [p.id, 0]))
      const slotsFilled = zero(), actionCount = zero(), costSum = zero()

      const seenSlot = new Set<string>()
      for (const a of c.actions) {
        for (const cl of a.clues ?? []) {
          const k = `${cl.person}|${cl.slot}`
          if (seenSlot.has(k) || !slotsFilled.has(cl.person)) continue
          seenSlot.add(k)
          slotsFilled.set(cl.person, slotsFilled.get(cl.person)! + 1)
        }
        if (a.target?.kind !== 'person' || !actionCount.has(a.target.id)) continue
        actionCount.set(a.target.id, actionCount.get(a.target.id)! + 1)
        costSum.set(a.target.id, costSum.get(a.target.id)! + a.cost)
      }

      const AXES = [
        { label: '프로필에 찬 칸', of: slotsFilled },
        { label: '겨누는 조사 개수', of: actionCount },
        { label: '조사 비용 합', of: costSum },
      ]
      for (const { label, of } of AXES) {
        const vals = [...of.values()]
        // 전원이 0 이면 그 축은 화면에 아무것도 안 만든다 — 고립이 뜻을 갖지 않는다
        if (!vals.some((v) => v > 0)) continue
        for (const [extreme, word] of [[Math.max(...vals), '최다'], [Math.min(...vals), '최소']] as const) {
          const who = [...of].filter(([, v]) => v === extreme).map(([id]) => id)
          if (who.length !== 1 || who[0] !== c.culprit) continue
          const nm = c.people.find((p) => p.id === c.culprit)?.name ?? c.culprit
          errors.push(
            `'${label}'에서 범인 '${nm}'만 혼자 ${word}다 (${extreme} · 용의자 ${suspectsOnly.length}명) — ` +
              '용의자 카드를 세어보면 답이 나온다',
          )
        }
      }
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
