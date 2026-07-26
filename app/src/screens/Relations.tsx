import { useState } from 'react'
import type { Action, Case, PersonId } from '@engine/types'
import { ko } from '../case/loadCase'
import { personColor } from '../case/people'
import type { CaseProgress } from '../state/stores'

/**
 * 관계 도식 — 프로토타입 719~743행 · `buildGraph()`(2299~2326행).
 *
 * 누가 누구와 어떻게 얽혀 있나. 노드와 선은 **사건 파일**에 저작돼 있고
 * (`relation_graph`), 이 화면은 「지금 무엇이 드러났나」만 계산한다.
 *
 * ★ 안 드러난 것은 흐리게가 아니라 없다 ★
 * 흐린 선은 「저기 뭔가 있다」이고, 그건 조사 0회에 사건의 크기를 알려주는 것이다.
 * 4장을 완성하면 마약망이 **생기고**, 조사를 하면 선이 **생긴다**.
 *
 * ★ 알리바이 대조가 사는 곳이 여기다 ★
 * 두 사람을 고르는 행위 자체가 실행 지점이다 — 장소가 없어 평면도에도 카드에도
 * 걸 자리가 없다. 그 짝은 사건 파일의 `Action.pair` 가 정한다.
 */

export function Relations({
  c,
  progress,
  onAsk,
}: {
  c: Case
  progress: CaseProgress
  onAsk: (a: Action) => void
}) {
  const [sel, setSel] = useState<PersonId[]>([])
  const g = c.relationGraph
  if (!g) return null

  const solved = progress.solved.length
  const done = new Set(progress.investigations.map((iv) => iv.actionId))
  const open = (after?: number) => after === undefined || solved >= after

  const colorOf = new Map<string, string>()
  c.people.forEach((p, i) => colorOf.set(p.id, personColor(i)))
  const nameOf = new Map(c.people.map((p) => [p.id, p.name]))

  /** 조사로 생긴 노드 (대포폰·위장 유서). 원본은 이것만 `evidence` 로 분류한다 */
  const found = g.discoveries.filter((d) => done.has(d.action))
  const nodes = [
    ...g.nodes.filter((n) => open(n.revealedAfter)).map((n) => ({
      id: n.id,
      kind: n.kind as string,
      label: n.kind === 'person' ? (nameOf.get(n.id) ?? n.id) : ko(n.label),
      color: n.kind === 'person'
        ? (colorOf.get(n.id) ?? 'var(--fg-3)')
        : n.kind === 'victim' ? 'var(--fg-2)' : 'var(--g-contradict)',
      x: n.x,
      y: n.y,
      person: n.kind === 'person',
    })),
    ...found.filter((d) => d.node).map((d) => ({
      id: d.node!.id, kind: 'evidence', label: ko(d.node!.label),
      color: 'var(--accent)', x: d.node!.x, y: d.node!.y, person: false,
    })),
  ]
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // 물증이 확정한 관계는 **추정 선을 덮어쓴다.** 선이 둘이 되는 게 아니라 하나로 바뀐다
  const pairKey = (a: string, b: string) => [a, b].sort().join('|')
  const evidenced = new Set(found.map((d) => pairKey(d.from, d.to)))
  const lines = [
    ...g.edges
      .filter((e) => open(e.revealedAfter) && !evidenced.has(pairKey(e.from, e.to)))
      .map((e) => ({ from: e.from, to: e.to, label: ko(e.label), danger: !!e.danger })),
    ...found.map((d) => ({ from: d.from, to: d.to, label: ko(d.label), danger: !!d.danger })),
  ].filter((e) => byId.has(e.from) && byId.has(e.to))

  // 같은 짝에 선이 둘이면 라벨이 겹친다. 아래로 5씩 밀어 쌓는다 (원본 `off`)
  const stacked = new Map<string, number>()
  const edges = lines.map((e) => {
    const a = byId.get(e.from)!
    const b = byId.get(e.to)!
    const k = pairKey(e.from, e.to)
    const off = (stacked.get(k) ?? 0) * 5
    stacked.set(k, (stacked.get(k) ?? 0) + 1)
    return {
      ...e,
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 + off,
    }
  })

  const toggle = (id: PersonId) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)))

  /** 고른 두 사람의 알리바이 대조. 짝이 안 맞으면 그런 조사가 **없다** */
  const same = (p: readonly string[]) => p.length === 2 && sel.every((x) => p.includes(x))
  const alibi = sel.length === 2 ? c.actions.find((a) => a.pair && same(a.pair)) : undefined
  const used = alibi ? done.has(alibi.id) : false
  const budget = c.budget - progress.actionsUsed

  return (
    <div className="nl-rg">
      <div className="nl-rg-board">
        <svg className="nl-rg-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {edges.map((e, i) => (
            <line
              key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={e.danger ? 'var(--g-contradict)' : 'var(--border-strong)'}
              strokeWidth={e.danger ? 0.5 : 0.35}
            />
          ))}
        </svg>

        {edges.map((e, i) => (
          <span
            key={i}
            className="nl-rg-elabel"
            style={{
              left: `${e.mx}%`, top: `${e.my}%`,
              color: e.danger ? 'var(--g-contradict)' : 'var(--fg-3)',
            }}
          >
            {e.label}
          </span>
        ))}

        {nodes.map((n) => {
          const on = sel.includes(n.id)
          const round = n.kind === 'victim' || n.kind === 'person'
          const size = n.kind === 'victim' ? 18 : 14
          return (
            <span key={n.id}>
              <span
                className="nl-rg-dot"
                onClick={n.person ? () => toggle(n.id) : undefined}
                style={{
                  left: `${n.x}%`, top: `${n.y}%`,
                  width: size, height: size,
                  borderRadius: round ? '50%' : 3,
                  background: n.color,
                  boxShadow: on
                    ? '0 0 0 3px var(--accent)'
                    : n.kind === 'victim' ? '0 0 0 3px var(--border-strong)' : 'none',
                  cursor: n.person ? 'pointer' : 'default',
                }}
              />
              <span
                className="nl-rg-nlabel"
                style={{
                  left: `${n.x}%`, top: `calc(${n.y}% + 12px)`,
                  color: n.person ? n.color : 'var(--fg-3)',
                }}
              >
                {n.label}
              </span>
            </span>
          )
        })}
      </div>

      <div className="nl-rg-legend">
        <Legend round color="var(--fg-2)" ring>용의자</Legend>
        <Legend color="var(--accent)">확보 물증</Legend>
        <Legend color="var(--g-contradict)">드러난 사건</Legend>
      </div>

      <div className="v-meta nl-rg-hint">
        두 용의자를 선택해 알리바이를 대조하세요. 조사·항 완성으로 관계가 드러납니다.
      </div>

      {sel.length === 2 && (
        <div className="nl-rg-alibi">
          <span className="v-title" style={{ color: 'var(--fg)' }}>
            {sel.map((id) => nameOf.get(id) ?? id).join(' · ')}
          </span>
          <span className="nl-fs-spacer" />
          <span className="v-meta" style={{ color: 'var(--fg-4)' }}>
            {!alibi ? '이 두 사람은 대조할 수 없습니다'
              : used ? '조사 완료'
              : budget < alibi.cost ? '잔여 부족'
              : ''}
          </span>
          <span className="linklike nl-rg-cancel" onClick={() => setSel([])}>취소</span>
          <button
            className="nl-btn nl-btn-primary"
            disabled={!alibi || used || budget < alibi.cost}
            onClick={alibi ? () => { onAsk(alibi); setSel([]) } : undefined}
          >
            조사
          </button>
        </div>
      )}
    </div>
  )
}

function Legend({
  color, round, ring, children,
}: {
  color: string
  round?: boolean
  ring?: boolean
  children: React.ReactNode
}) {
  return (
    <span className="nl-rg-leg">
      <span
        className="nl-rg-leg-dot"
        style={{
          background: color,
          borderRadius: round ? '50%' : 3,
          boxShadow: ring ? '0 0 0 2px var(--border-strong)' : undefined,
        }}
      />
      {children}
    </span>
  )
}
