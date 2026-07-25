import type { Case } from '@engine/types'
import { ko } from '../case/loadCase'

/**
 * 진술 — 다섯 사람의 원문을 언제든 다시 읽는 자리.
 *
 * 정독 단계가 지나가도 진술은 남는다. 이 게임의 배제가 전적으로 진술에 기대므로
 * **여기가 가장 자주 돌아오게 되는 화면**이다.
 *
 * 게임은 여기서 아무 말도 하지 않는다 — 강조·모순 표시·유용도 구분 전부 없다.
 */
export function StatementList({ c }: { c: Case }) {
  return (
    <div className="nl-pane">
      <header className="nl-pane-head">
        <div className="v-caption" style={{ color: 'var(--fg-4)' }}>진술</div>
        <h1 className="v-h2" style={{ margin: '6px 0 0' }}>다섯 사람의 말</h1>
      </header>

      {c.people.map((p) => (
        <section key={p.id} className="nl-read-card nl-stmt-card">
          <div className="nl-read-who">
            <span className="v-h3" style={{ color: 'var(--fg)' }}>{p.name}</span>
            <span className="v-meta" style={{ color: 'var(--fg-4)' }}>{p.age} · {p.job}</span>
          </div>
          {(p.statement?.paragraphs ?? []).map((t, n) => (
            <p key={n} className="nl-read-p">{ko(t)}</p>
          ))}
        </section>
      ))}
    </div>
  )
}
