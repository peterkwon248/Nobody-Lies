import type { Case } from '@engine/types'
import { TopBar } from '../components/TopBar'

/**
 * 사건 브리핑 — 진입 흐름 2단계. 피해자·사망 추정·현장 상태의 **사실 요약**.
 *
 * 층위는 전부 **확정**이다 (`HANDOFF-TO-CODE.md` §6) — 반박 불가한 것만 적는다.
 * 주장(진술)은 다음 단계이고, 여기에 섞이면 안 된다.
 *
 * 문체는 3인칭 중립. *"~로 확인됨"* 이지 *"나는 ~라고 판단했다"* 가 아니다.
 * 수사관에게는 이름도 직책도 얼굴도 없다 (`design-brief.md` §화자).
 */
export function Briefing({ c, onDone }: { c: Case; onDone: () => void }) {
  const victim = c.victimProfile
  const window = c.slots.find((s) => s.isWindow)
  const scene = c.locations.find((l) => l.id === c.incident.scene)

  return (
    <div className="nl-fs">
      <TopBar title={c.title} />

      <div className="nl-fs-body">
        <div className="nl-brief">
          <div className="nl-brief-head">
            <span className="nl-fs-mark" aria-hidden="true" />
            <span className="v-ui" style={{ color: 'var(--fg-3)' }}>{c.title}</span>
          </div>

          <div className="v-h1" style={{ marginBottom: 6 }}>사건 브리핑</div>
          <div className="v-body nl-brief-sub">확인된 사실만 적혀 있습니다.</div>

          <div className="nl-brief-rows">
            <Row
              k="피해자"
              v={victim ? [victim.name, victim.age, victim.job].filter(Boolean).join(' · ') : c.victim}
            />
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
                  <span className="v-micro" style={{ color: 'var(--fg-4)' }}>
                    {p.age} · {p.job}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <button className="nl-btn nl-btn-primary nl-btn-wide" onClick={onDone}>
            진술 정독
          </button>
          <div className="v-meta nl-brief-note">
            다섯 사람의 진술을 모두 읽어야 보고서 1장이 열립니다.
          </div>
        </div>
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
