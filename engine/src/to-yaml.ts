import type { Case } from './types.js'

/**
 * `Case` → 사건 YAML 원형. **`schema.ts` `parseCase` 의 역함수다.**
 *
 * 왜 필요한가 — 생성기가 내놓는 것은 메모리 위의 `Case` 이고 `--emit` 은 배포용
 * JSON 만 썼다. 그런데 **산문을 입히는 순간 그것은 생성물이 아니라 저작물**이라
 * 사람이 고치고 git 이 추적하는 형태로 남아야 한다. 그 형태가 YAML 이다.
 *
 * ```
 * 팔레트 → 생성 → YAML 방출 → 산문가가 문장을 채움 → engine/cases/ 에 커밋
 * ```
 *
 * ★ 이름만 바꾸고 의미는 만들지 않는다 ★ `parseCase` 의 규약 그대로다.
 * snake_case ↔ camelCase 변환과 `at` ↔ `location` 같은 단순 개명뿐이고,
 * 한쪽 값에서 다른 쪽 값을 도출하지 않는다.
 *
 * **왕복이 곧 검증이다.** `--emit --yaml` 이 쓴 파일을 다시 읽어 원본과
 * 대조한다(`cli.ts`). 한 글자라도 어긋나면 방출을 실패로 본다 — 조용히 다른
 * 사건이 되는 것이 이 저장소에서 가장 비싼 결함이었다.
 */

type Raw = Record<string, unknown>

/** `undefined` 인 키를 지운다. YAML 에 `null` 이 흩어지면 사람이 읽기 나쁘다 */
function tidy<T extends Raw>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

/**
 * 두 언어 문장. **번역 전이면 문자열 한 줄로 쓴다** — `parseCase` 가 두 형태를
 * 다 받으므로(`text()`) 왕복이 깨지지 않고, 사람이 고치기 훨씬 쉽다.
 */
function txt(v: { ko: string; en?: string } | undefined): unknown {
  if (!v) return undefined
  return v.en ? { ko: v.ko, en: v.en } : v.ko
}

const txts = (xs: { ko: string; en?: string }[] | undefined) => xs?.map(txt)

export function caseToRaw(c: Case): Raw {
  const fp = c.floorPlan
  const box = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x, y: b.y, w: b.w, h: b.h })

  return tidy({
    id: c.id,
    title: c.title,
    scale: c.scale,
    budget: c.budget,

    incident: tidy({
      kind: c.incident.kind,
      subject: c.incident.subject,
      description: c.incident.description,
      scene: c.incident.scene,
      body_state: txt(c.incident.bodyState),
      scene_state: txt(c.incident.sceneState),
    }),

    prose: c.prose
      ? tidy({ source: c.prose.source, model: c.prose.model, generated_at: c.prose.generatedAt })
      : undefined,

    floor_plan: fp
      ? tidy({
        view_box: { w: fp.viewBox.w, h: fp.viewBox.h },
        scale: fp.scale,
        buildings: fp.buildings?.map((b) => tidy({ id: b.id, ...box(b), poche: b.poche, revealed_after: b.revealedAfter })),
        rooms: fp.rooms?.map((r) => tidy({
          id: r.id, ...box(r), label: r.label, building: r.building, loc: r.loc,
          scene: r.scene || undefined, tint: r.tint, primary: r.primary || undefined,
        })),
        zones: fp.zones?.map((z) => tidy({
          id: z.id, ...box(z), label: z.label, loc: z.loc,
          hatch: z.hatch || undefined, offsite: z.offsite || undefined, primary: z.primary || undefined,
        })),
        doors: fp.doors?.map((d) => tidy({
          id: d.id, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
          hinge: d.hinge, swing: d.swing, open: d.open || undefined, ext: d.ext || undefined,
          building: d.building, label: d.label, lx: d.lx, ly: d.ly,
        })),
        windows: fp.windows?.map((w) => tidy({
          x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, building: w.building, label: w.label, lx: w.lx, ly: w.ly,
        })),
        walks: fp.walks?.map((w) => tidy({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, building: w.building, from: w.from, to: w.to, min: w.min })),
        fixtures: fp.fixtures
          ? Object.fromEntries(Object.entries(fp.fixtures).map(([k, v]) => [k, tidy({ x: v.x, y: v.y, label: v.label, loc: v.loc, body: v.body })]))
          : undefined,
      })
      : undefined,

    relation_graph: c.relationGraph
      ? {
        nodes: c.relationGraph.nodes.map((n) => tidy({
          id: n.id, kind: n.kind, x: n.x, y: n.y, label: txt(n.label), revealed_after: n.revealedAfter,
        })),
        edges: c.relationGraph.edges.map((e) => tidy({
          from: e.from, to: e.to, label: txt(e.label), revealed_after: e.revealedAfter, danger: e.danger || undefined,
        })),
        discoveries: c.relationGraph.discoveries.map((d) => tidy({
          action: d.action, from: d.from, to: d.to, label: txt(d.label), danger: d.danger || undefined,
          node: d.node ? tidy({ id: d.node.id, label: txt(d.node.label), x: d.node.x, y: d.node.y }) : undefined,
        })),
      }
      : undefined,

    seed_terms: c.seedTerms,
    prologue: txts(c.prologue),
    terms: c.terms?.map((t) => tidy({ word: t.word, source: txt(t.source), note: txt(t.note) })),

    slots: c.slots.map((s) => tidy({ id: s.id, label: s.label, window: s.isWindow || undefined })),
    locations: c.locations.map((l) => ({ id: l.id, label: l.label, at_lodge: l.atLodge })),

    people: c.people.map((p) => tidy({
      id: p.id, name: p.name, age: p.age, sex: p.sex, job: p.job,
      claim_summary: txt(p.claimSummary),
      hidden_role: p.hiddenRole,
      // ★ `claim` 은 범인만 갖는다 ★ 없으면 `presence` 와 같다 = 거짓말하지 않았다.
      // 비어 있어도 키를 만들면 「완전히 일치하는 주장」이 되어 검증기가 잡는다
      presence: p.presence.map((e) => ({ slot: e.slot, at: e.location })),
      claim: p.claim?.map((e) => ({ slot: e.slot, at: e.location })),
      statement: p.statement
        ? tidy({
          voice: p.statement.voice,
          gesture: p.statement.gesture
            ? tidy({ pre: txt(p.statement.gesture.pre), post: txt(p.statement.gesture.post) })
            : undefined,
          paragraphs: txts(p.statement.paragraphs),
        })
        : undefined,
    })),

    victim: c.victim,
    victim_profile: c.victimProfile
      ? tidy({ name: c.victimProfile.name, age: c.victimProfile.age, job: c.victimProfile.job })
      : undefined,
    // 피해자 동선. `asks: lastSeenBy` 가 읽는 상수 — 왕복에서 빠지면 그 어휘가 죽는다
    victim_presence: c.victimPresence?.map((e) => ({ slot: e.slot, at: e.location })),
    culprit: c.culprit,

    trick: tidy({
      types: c.trick.types,
      props: c.trick.props,
      staging: c.trick.staging,
      illusions: c.trick.illusions?.map((il) => tidy({
        id: il.id, kind: il.kind, impression: il.impression,
        made_by: il.madeBy, broken_by: il.brokenBy,
      })),
      exit: c.trick.exit
        ? tidy({
          slot: c.trick.exit.slot, method: c.trick.exit.method,
          enabled_by: c.trick.exit.enabledBy, broken_by: c.trick.exit.brokenBy,
        })
        : undefined,
      flaw: tidy({ text: c.trick.flaw?.text, planted_in: c.trick.flaw?.plantedIn }),
    }),

    evidence: c.evidence.map((e) => tidy({
      id: e.id, description: e.description, found_at: e.foundAt, record: e.record,
      extra: e.extra, is_staging: e.isStaging || undefined, at_scene: e.atScene || undefined,
      // 「가리키는 곳」— `found_at`(발견된 곳 · 표시 문구)과 다르다. types.ts 주석 참조
      points_at: e.pointsAt,
      yields_terms: e.yieldsTerms,
    })),

    facts: c.facts.map((f) => tidy({
      id: f.id, kind: f.kind, subject: f.subject, content: f.content,
      // 「이 사실의 값」— `asks: factValue` 가 읽는다. types.ts §Fact.value 참조
      value: f.value,
      revealed_by: f.revealedBy, requires: f.requires, available_after: f.availableAfter,
    })),

    actions: c.actions.map((a) => tidy({
      id: a.id, label: a.label, verb: a.verb, cost: a.cost, gives: a.gives,
      salience: a.salience, yield: a.yield,
      target: a.target ? { kind: a.target.kind, id: a.target.id } : undefined,
      pair: a.pair,
      available_after: a.availableAfter,
      boosted_by: a.boostedBy,
      result: a.result ? tidy({ title: txt(a.result.title), body: txt(a.result.body) }) : undefined,
      clues: a.clues?.map((cl) => tidy({ person: cl.person, slot: cl.slot, text: txt(cl.text) })),
    })),

    chapters: c.chapters.map((ch) => tidy({
      order: ch.order, title: ch.title, opening: ch.opening,
      free_chapter: ch.freeChapter,
      requires_facts: ch.requiresFacts,
      blanks: ch.blanks.map((b) => tidy({
        label: b.label, candidates: b.candidates, answer: b.answer, particle: b.particle,
        candidate_pool: b.candidatePool, is_accusation: b.isAccusation || undefined,
        // 「무엇을 묻는가」— 없으면 솔버가 undecidable 을 낸다. types.ts §Asks 참조
        asks: b.asks,
      })),
      // ★ 서술문의 텍스트 조각은 **문자열 그대로** 쓴다 ★
      // 파싱된 `Case` 는 `{ text }` 로 감싸고 있지만 YAML 원형은 맨 문자열이다
      // (`parseCase`: 문자열 = 텍스트 · `{ blank: n }` = 공란 참조).
      report: ch.report?.map((r) => ('text' in r ? r.text : { blank: r.blank })),
      epilogue_order: ch.epilogueOrder,
      epilogue: ch.epilogue,
    })),

    reveals: c.reveals.map((r) => tidy({
      trigger: r.trigger.on === 'action'
        ? { on: 'action', action_id: r.trigger.actionId }
        : { on: 'chapterComplete', chapter_order: r.trigger.chapterOrder },
      yield: r.yield,
      surface: r.surface,
      facts: r.facts,
      actions: r.actions,
      narrows_window: r.narrowsWindow,
      add_claims: r.addClaims?.map((cl) => tidy({
        speaker: cl.speaker, content: cl.content, target: cl.target, slot: cl.slot,
      })),
      narration: r.narration,
    })),

    reopen_per_chapter: c.reopenPerChapter,
  })
}
