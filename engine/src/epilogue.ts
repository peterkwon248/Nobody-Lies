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

  return {
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
