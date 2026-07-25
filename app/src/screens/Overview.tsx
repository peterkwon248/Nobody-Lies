import type { Case } from '@engine/types'

/**
 * 사건 개요 — 브리핑에서 본 **확정 층**을 언제든 다시 볼 수 있는 자리.
 *
 * "한 번 보여주고 사라지는 텍스트는 버그다"(`HANDOFF-TO-CODE.md` §0.3).
 * 브리핑은 진입 흐름에서 한 번 지나가므로 그 내용이 사는 화면이 따로 있어야 한다.
 */
export function Overview({ c }: { c: Case }) {
  const victim = c.victimProfile
  const window = c.slots.find((s) => s.isWindow)
  const scene = c.locations.find((l) => l.id === c.incident.scene)

  return (
    <div className="nl-pane">
      <header className="nl-pane-head">
        <div className="v-caption" style={{ color: 'var(--fg-4)' }}>사건 개요</div>
        <h1 className="v-h2" style={{ margin: '6px 0 0' }}>{c.title}</h1>
      </header>

      <div className="nl-brief-rows">
        <Row k="피해자" v={victim ? [victim.name, victim.age, victim.job].filter(Boolean).join(' · ') : c.victim} />
        <Row k="사망 추정" v={window?.label ?? '미확정'} />
        <Row k="현장" v={scene?.label ?? '미확정'} />
        <Row k="개요" v={c.incident.description} />
      </div>

      <div className="nl-brief-rows">
        {c.people.map((p) => (
          <div key={p.id} className="nl-brief-row">
            <span className="v-meta nl-brief-k">관계인</span>
            <span className="v-body nl-brief-v nl-brief-person">
              <span>{p.name}</span>
              <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{p.age} · {p.job}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="nl-brief-row">
      <span className="v-meta nl-brief-k">{k}</span>
      <span className="v-body nl-brief-v">{v}</span>
    </div>
  )
}
