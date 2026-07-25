import type { Case } from '@engine/types'

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
    <div className="screen screen-doc">
      <header className="doc-head">
        <div className="doc-kicker">사건 브리핑</div>
        <h1 className="doc-title">{c.title}</h1>
      </header>

      <dl className="doc-fields">
        <Field
          label="피해자"
          value={victim ? [victim.name, victim.age, victim.job].filter(Boolean).join(' · ') : c.victim}
        />
        <Field label="사망 추정" value={window?.label ?? '미확정'} />
        <Field label="현장" value={scene?.label ?? '미확정'} />
        <Field label="개요" value={c.incident.description} wide />
      </dl>

      <section className="doc-section">
        <h2 className="doc-h2">관계인 {c.people.length}</h2>
        <ul className="doc-people">
          {c.people.map((p) => (
            <li key={p.id} className="doc-person">
              <span className="doc-person-name">{p.name}</span>
              <span className="doc-person-meta">
                {p.age} · {p.job}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="doc-foot">
        <button className="reader-next" onClick={onDone}>
          진술 정독
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'doc-field doc-field-wide' : 'doc-field'}>
      <dt className="doc-label">{label}</dt>
      <dd className="doc-value">{value}</dd>
    </div>
  )
}
