import { useState } from 'react'
import type { Case } from '@engine/types'
import { ko } from '../case/loadCase'
import type { PlayerAnnotations } from '../state/stores'

/**
 * 우측 디테일 패널 — **교차 참조**.
 *
 * 프로토타입의 토글 버튼 이름이 `crossRef` 인 것이 이 패널의 정체다. 보고서를 쓰면서
 * 오른쪽에서 진술을 확인하는 것 — 그 동시 참조가 이 게임의 핵심 동작이고,
 * `HANDOFF-TO-CODE.md` §8.1 이 1차 범위에 명시해뒀다.
 *
 * 탭 셋: 진술 / 조사 기록 / 메모. (프로토타입 914~960행)
 */

const PERSON_COLORS = [
  'var(--label-orange)', 'var(--label-blue)', 'var(--label-purple)',
  'var(--label-green)', 'var(--label-pink)', 'var(--label-red)',
]

type Tab = 'statements' | 'invlog' | 'memo'

export function DetailPanel({
  c,
  annotations,
  onClose,
}: {
  c: Case
  annotations: PlayerAnnotations
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('statements')

  return (
    <aside className="nl-right">
      <div className="nl-right-tabs">
        {([
          ['statements', '진술'],
          ['invlog', '조사 기록'],
          ['memo', '메모'],
        ] as [Tab, string][]).map(([id, label]) => (
          <div
            key={id}
            className={tab === id ? 'nl-right-tab nl-right-tab-on' : 'nl-right-tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </div>
        ))}
        <span className="iconbtn nl-right-close" onClick={onClose}>✕</span>
      </div>

      <div className="nl-right-body">
        {tab === 'statements' && <StatementsTab c={c} />}
        {tab === 'invlog' && (
          <div className="v-meta nl-right-empty">
            아직 조사 기록이 없습니다.
          </div>
        )}
        {tab === 'memo' && <MemoTab c={c} annotations={annotations} />}
      </div>
    </aside>
  )
}

/** 인물별 아코디언. 진술은 **주장** 층이라 인물색 레일로 화자만 표시한다 */
function StatementsTab({ c }: { c: Case }) {
  const [open, setOpen] = useState<string | null>(c.people[0]?.id ?? null)

  return (
    <>
      {c.people.map((p, i) => (
        <div key={p.id} className="nl-acc">
          <div
            className="nl-acc-head"
            onClick={() => setOpen(open === p.id ? null : p.id)}
          >
            <span
              className="nl-acc-bar"
              style={{ background: PERSON_COLORS[i % PERSON_COLORS.length] }}
            />
            <span className="v-ui">{p.name}</span>
            <span className="nl-fs-spacer" />
            <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{p.job}</span>
          </div>
          {open === p.id && (
            <div className="nl-acc-body">
              {(p.statement?.paragraphs ?? []).map((t, n) => (
                <p key={n} className="nl-acc-p">{ko(t)}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function MemoTab({ c, annotations }: { c: Case; annotations: PlayerAnnotations }) {
  const named = annotations.notes.filter((n) => n.content.trim())
  if (!named.length)
    return (
      <div className="v-meta nl-right-empty">
        아직 메모가 없습니다. 진술을 읽으며 적어둔 것이 여기 모입니다.
      </div>
    )

  return (
    <>
      {named.map((n) => (
        <div key={n.id} className="nl-memo-card">
          <div className="v-micro nl-memo-who">
            {c.people.find((p) => p.id === n.target)?.name ?? n.target}
            {/* 층위 표시는 필수다 — 확정(물증)과 주장(진술)을 섞지 않는다 */}
            {n.source && <span className="nl-memo-layer">{n.source}</span>}
          </div>
          <div className="v-body nl-memo-text">{n.content}</div>
        </div>
      ))}
    </>
  )
}
