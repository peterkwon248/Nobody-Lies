/**
 * ─────────────────────────────────────────────────────────────
 *  에필로그 — 「무슨 일이 있었나」를 구조에서 **방출한다** (2026-08-06 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 있나
 *
 * 테스터(전찬웅) 3차: *"정답을 봐도 트릭·동기 납득 안 감"*. 채점 화면이 **답만**
 * 보여주고 **왜 그 답인지**를 안 보여준다. 사건 넷 전부 `epilogue` 데이터가 0이라
 * 「렌더가 없다」가 아니라 **낼 것이 없었다.**
 *
 * ## 무엇을 하나 — 새 산문을 짓지 않는다
 *
 * ⛔ **이 파일은 문장을 창작하지 않는다.** 매니페스토 §가름 축대로 **코드는 사실·구조**
 * 만 낸다. 재료는 전부 이미 있다:
 *
 * ```
 * incident.scene / sceneState   어디서 죽었나
 * culprit.presence ↔ claim      어느 슬롯에서 진실과 주장이 갈리나 = 범행 시각
 * trick.illusions[]             인상 → madeBy(만든 물증) → brokenBy(깨는 물증)
 * trick.exit                    어떻게 빠져나갔나
 * trick.flaw                    트릭의 허점 · 어디에 심겼나
 * facts[]                       동기·기회·수단과 그것을 드러내는 물증
 * ```
 *
 * **문장 조립은 앱이 결정론적으로 한다** — 조립 진술이 이미 그렇게 돈다.
 * 여기서는 **순서와 연결**만 정한다. 그것이 「사슬의 재생」이다.
 *
 * ## ⚠ 파생 데이터라 저작 층이 아니다
 *
 * `_difficulty`·`_oracle` 과 같은 부류다 — **`export-case` 가 붙이고 사건 YAML 에는
 * 없다.** 그래서 §다섯 곳 한 벌(types+schema+to-yaml+generate+방어검사)의 대상이
 * 아니다. 그 규칙은 **사람이 쓰는 필드**가 전달 구간에서 증발하는 것을 막는 것이고,
 * 이건 매 방출마다 다시 계산된다. **방어 검사는 그대로 붙인다**(`cand-check §3`).
 */
import type { Case } from './types.js'

const ko = (x: unknown): string =>
  typeof x === 'string' ? x : ((x as { ko?: string } | undefined)?.ko ?? '')

export type EvidenceRef = { id: string; description: string }

/**
 * ─────────────────────────────────────────────────────────────
 *  1막 문장틀 — **데이터로 둔다** (2026-08-06 · 경훈 지시)
 * ─────────────────────────────────────────────────────────────
 *
 * *"틀 문안은 경훈+Claude 큐로 넘어올 수 있게 틀을 데이터로 분리해둬라."*
 * 코드를 안 열고 문안만 갈아 끼울 수 있어야 한다. **자유 작문을 하지 않는다** —
 * 값이 들어갈 자리(`{…}`)만 있고 나머지는 고정 문안이다.
 *
 * ⚠ 이 문안은 **잠정**이다. 화면이 그렇게 표기한다(트릭 붕괴 인터루드 선례).
 */
export const ACT1_TEMPLATES = {
  ko: {
    at: '{time}, {culprit|은/는} {place}에 있었다.',
    atScene: '{time}, {culprit|은/는} {place}에 있었다. 사건은 여기서 일어났다.',
    claimed: '나중에 그는 이 시각에 {claimed}에 있었다고 말했다.',
    staged: '「{impression}」 — 그렇게 보이도록 {evidence|을/를} 남겼다.',
    exit: '그리고 {method}.',
    motive: '이유는 {motive|이었다/였다}.',
    moved: '시신은 {place}에서 발견됐다. 그러나 일이 벌어진 곳은 거기가 아니었다.',
    provisional: '※ 이 재구성의 문안은 잠정입니다',
  },
  en: {
    at: '{time}: {culprit} was at {place}.',
    atScene: '{time}: {culprit} was at {place}. This is where it happened.',
    claimed: 'Later he would say he had been at {claimed} at that hour.',
    staged: '“{impression}” — {evidence} was left to make it look that way.',
    exit: 'And then: {method}.',
    motive: 'The reason was {motive}.',
    moved: 'The body was found at {place} — but that is not where it happened.',
    provisional: '※ Provisional wording',
  },
} as const

type Act1Line = { kind: 'at' | 'atScene' | 'moved' | 'claimed' | 'staged' | 'exit' | 'motive'; ko: string; en: string }

/**
 * 받침이 있나 — 조사를 고르는 데 쓴다.
 *
 * ⛔ **없으면 「잠금를」·「소문였다」가 나온다** (2026-08-06 실측). 앱에는
 * `particle()`·`batchim()` 이 진작 있는데 엔진에는 없어서, 문장틀이 엔진으로
 * 내려온 순간 같은 결함이 재발했다. **문장을 만드는 쪽마다 이것이 필요하다.**
 */
const hasBatchim = (w: string): boolean => {
  const s = (w || '').trim()
  if (!s) return false
  const ch = s.charCodeAt(s.length - 1)
  if (ch < 0xac00 || ch > 0xd7a3) return false
  return (ch - 0xac00) % 28 !== 0
}

/**
 * `{값|을/를}` 꼴을 받침에 맞춰 고른다. 앞쪽이 받침 있을 때 쓰는 조사다.
 * 값 자리는 `{키}`, 조사는 `{키|은/는}` 처럼 쓴다.
 */
const fill = (tpl: string, vals: Record<string, string>) =>
  tpl.replace(/\{(\w+)(?:\|([^/}]+)\/([^}]+))?\}/g, (_, k, withB, withoutB) => {
    const v = vals[k] ?? ''
    if (withB === undefined) return v
    return v + (hasBatchim(v) ? withB : withoutB)
  })

export type Epilogue = {
  /** 현장 */
  scene: { location: string; label: string; state: string }
  /** 범인 */
  culprit: { id: string; name: string }
  /**
   * 거짓말이 난 자리. **이것이 범행 시각이다** — 진실 동선과 주장이 갈리는 슬롯.
   * 자백형 사건(주장이 없음)이면 `null` 이고, 그때는 현장에 있던 슬롯을 쓴다.
   */
  lie: { slot: string; slotLabel: string; claimed: string; claimedLabel: string; actual: string; actualLabel: string } | null
  /** 트릭이 만든 인상과 그것을 깨는 물증 */
  illusions: { impression: string; madeBy: EvidenceRef[]; brokenBy: EvidenceRef[] }[]
  /** 어떻게 빠져나갔나 */
  exit: { method: string; enabledBy: EvidenceRef[]; brokenBy: EvidenceRef[] } | null
  /** 트릭의 허점 — 플레이어가 물었어야 할 질문 */
  flaw: { text: string; plantedIn: string[] } | null
  /** 동기·기회·수단과 그것을 드러내는 물증 */
  facts: { kind: string; subject: string; subjectName: string; content: string; revealedBy: EvidenceRef[] }[]
  /**
   * 1막 — 그날의 재구성. **슬롯 순서대로** 편 문장이다.
   * 값은 전부 구조에서 왔고 문안은 `ACT1_TEMPLATES` 다(잠정).
   */
  act1: { lines: Act1Line[]; provisionalKo: string; provisionalEn: string }
}

export function buildEpilogue(c: Case): Epilogue {
  const evById = new Map((c.evidence ?? []).map((e) => [e.id, e]))
  const ref = (ids: readonly string[] | undefined): EvidenceRef[] =>
    (ids ?? [])
      .map((id) => {
        const e = evById.get(id)
        return e ? { id, description: ko(e.description) || id } : { id, description: id }
      })
      // 참조가 있는데 대상이 비면 조용하다 — 그 부류를 여기서 만들지 않는다
      .filter((x) => x.description)

  const nameOf = (id: string) =>
    ko(c.people.find((p) => p.id === id)?.name) ||
    (c.victim === id ? ko(c.victimProfile?.name) : '') ||
    id
  const locLabel = (id: string) => (c.locations ?? []).find((l) => l.id === id)?.label ?? id
  const slotLabel = (id: string) => (c.slots ?? []).find((s) => s.id === id)?.label ?? id

  const culprit = c.people.find((p) => p.id === c.culprit)

  /**
   * ★ 거짓말이 난 슬롯을 찾는다 ★ 진실 `presence` 와 주장 `claim` 이 갈리는 칸이
   * **범인이 감추려 한 시각**이다. 검증기가 「거짓말은 범인만, 그리고 하나」를 이미
   * 강제하므로 첫 불일치가 곧 그 자리다.
   */
  let lie: Epilogue['lie'] = null
  if (culprit?.claim?.length && culprit.presence?.length) {
    const claimAt = new Map(culprit.claim.map((x) => [x.slot, x.location]))
    for (const p of culprit.presence) {
      const said = claimAt.get(p.slot)
      if (said && said !== p.location) {
        lie = {
          slot: p.slot,
          slotLabel: slotLabel(p.slot),
          claimed: said,
          claimedLabel: locLabel(said),
          actual: p.location,
          actualLabel: locLabel(p.location),
        }
        break
      }
    }
  }

  const t = c.trick

  /**
   * ★ 1막 — 범인의 **진실 동선**을 슬롯 순서대로 편다 ★
   *
   * ⛳ **없는 사실을 만들지 않는다.** 「사건은 여기서 일어났다」는 그 칸의 장소가
   * `incident.scene` 과 **같을 때만** 붙는다. 「나중에 …라고 말했다」는 그 칸이
   * 거짓말이 난 칸일 때만. 위장·퇴장·동기는 데이터가 있을 때만 한 줄씩 붙는다.
   *
   * ⚠ 슬롯 순서는 `c.slots` 가 정본이다 — `presence` 배열 순서를 믿지 않는다
   * (사건마다 저작 순서가 다를 수 있고, 그러면 시간이 뒤섞인다).
   */
  const slotOrder = new Map((c.slots ?? []).map((s, i) => [s.id, i]))
  const lines: Act1Line[] = []
  const TK = ACT1_TEMPLATES.ko
  const TE = ACT1_TEMPLATES.en
  const culpritName = nameOf(c.culprit)

  const walk = [...(culprit?.presence ?? [])].sort(
    (a, b) => (slotOrder.get(a.slot) ?? 0) - (slotOrder.get(b.slot) ?? 0),
  )
  for (const p of walk) {
    const isScene = !!c.incident?.scene && p.location === c.incident.scene
    const vals = { time: slotLabel(p.slot), culprit: culpritName, place: locLabel(p.location) }
    lines.push({
      kind: isScene ? 'atScene' : 'at',
      ko: fill(isScene ? TK.atScene : TK.at, vals),
      en: fill(isScene ? TE.atScene : TE.at, vals),
    })
    if (lie && lie.slot === p.slot) {
      lines.push({ kind: 'claimed', ko: fill(TK.claimed, { claimed: lie.claimedLabel }), en: fill(TE.claimed, { claimed: lie.claimedLabel }) })
    }
  }
  /**
   * ⛔ **범인이 발견 장소에 한 번도 안 가는 사건이 있다** (2026-08-06 · `cand-check` 가
   * `gen-4` 에서 잡았다). `body_moved` — **시신을 옮긴 트릭**이라 그것이 옳다.
   *
   * ⛳ **죽인 곳을 추론하지 않는다.** 데이터에 없다(범인 동선이 한 칸뿐이라 짐작은
   * 가지만 짐작은 지어내기다). 「거기가 아니었다」까지만 말한다.
   */
  if (!lines.some((l) => l.kind === 'atScene') && c.incident?.scene) {
    const vals = { place: locLabel(c.incident.scene) }
    lines.push({ kind: 'moved', ko: fill(TK.moved, vals), en: fill(TE.moved, vals) })
  }

  for (const il of t?.illusions ?? []) {
    const made = ref(il.madeBy).map((x) => x.description).join(' · ')
    if (!made || !ko(il.impression)) continue
    const vals = { impression: ko(il.impression), evidence: made }
    lines.push({ kind: 'staged', ko: fill(TK.staged, vals), en: fill(TE.staged, vals) })
  }
  if (t?.exit?.method) {
    lines.push({ kind: 'exit', ko: fill(TK.exit, { method: ko(t.exit.method) }), en: fill(TE.exit, { method: ko(t.exit.method) }) })
  }
  const motiveFact = (c.facts ?? []).find((f) => f.kind === 'motive' && f.subject === c.culprit)
  if (motiveFact) {
    const vals = { motive: ko(motiveFact.content) }
    lines.push({ kind: 'motive', ko: fill(TK.motive, vals), en: fill(TE.motive, vals) })
  }

  return {
    act1: { lines, provisionalKo: TK.provisional, provisionalEn: TE.provisional },
    scene: {
      location: c.incident?.scene ?? '',
      label: locLabel(c.incident?.scene ?? ''),
      state: ko(c.incident?.sceneState),
    },
    culprit: { id: c.culprit, name: nameOf(c.culprit) },
    lie,
    illusions: (t?.illusions ?? []).map((il) => ({
      impression: ko(il.impression),
      madeBy: ref(il.madeBy),
      brokenBy: ref(il.brokenBy),
    })),
    exit: t?.exit
      ? { method: ko(t.exit.method), enabledBy: ref(t.exit.enabledBy), brokenBy: ref(t.exit.brokenBy) }
      : null,
    flaw: t?.flaw ? { text: ko(t.flaw.text), plantedIn: (t.flaw.plantedIn ?? []).map(nameOf) } : null,
    facts: (c.facts ?? []).map((f) => ({
      kind: f.kind,
      subject: f.subject,
      subjectName: nameOf(f.subject),
      content: ko(f.content),
      revealedBy: ref(f.revealedBy),
    })),
  }
}
