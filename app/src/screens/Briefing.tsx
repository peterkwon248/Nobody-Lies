import type { Case } from '@engine/types'
import { TopBar } from '../components/TopBar'
import { Mark } from '../components/Mark'
import { ko } from '../case/loadCase'

/**
 * 사건 브리핑 — 진입 흐름 2단계. 피해자·사망 추정·현장 상태의 **사실 요약**.
 *
 * 층위는 전부 **확정**이다 (`HANDOFF-TO-CODE.md` §6) — 반박 불가한 것만 적는다.
 * 주장(진술)은 다음 단계이고, 여기에 섞이면 안 된다.
 *
 * 문체는 3인칭 중립. *"~로 확인됨"* 이지 *"나는 ~라고 판단했다"* 가 아니다.
 * 수사관에게는 이름도 직책도 얼굴도 없다 (`design-brief.md` §화자).
 */
/** 「이름 (나이) · 직업」. 브리핑과 개요가 같은 줄을 쓰므로 한 곳에 둔다 */
export function victimLine(c: Case): string {
  const v = c.victimProfile
  if (!v) return c.victim
  return v.name + (v.age ? ` (${v.age})` : '') + (v.job ? ` · ${v.job}` : '')
}

export function Briefing({ c, onDone, onHome }: { c: Case; onDone: () => void; onHome: () => void }) {
  const window = c.slots.find((s) => s.isWindow)

  return (
    <div className="nl-fs">
      <TopBar onBack={onHome} />

      <div className="nl-fs-body">
        <div className="nl-brief">
          <div className="nl-brief-head">
            <Mark size={26} />
            <span className="v-ui" style={{ color: 'var(--fg-3)' }}>{c.title}</span>
          </div>

          <div className="v-h1" style={{ marginBottom: 6 }}>사건 브리핑</div>
          <div className="v-body nl-brief-sub">읽기 전 확인</div>

          <div className="nl-brief-rows">
            {/* 원본 1306행 `ovVictimV` 는 「윤다인 (30) · 소설가」 — 나이는 괄호다 */}
            <Row k="피해자" v={victimLine(c)} />
            <Row k="사망 추정" v={window?.label ?? '미확정'} />
            {/* 원본 2842행의 네 행 — 시신·현장은 **관찰 서술**이지 장소 이름이 아니다.
                한때 여기에 `scene.label`(다인의 방)을 넣어서 브리핑이 은폐 정황을
                아예 말하지 않았다 */}
            <Row k="시신" v={ko(c.incident.bodyState) || '미확인'} />
            <Row k="현장" v={ko(c.incident.sceneState) || '미확인'} />
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
            진술 읽기 시작
          </button>
          <div className="v-meta nl-brief-note">
            5명의 진술을 먼저 읽습니다. 다 읽으면 1장이 열립니다.
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
