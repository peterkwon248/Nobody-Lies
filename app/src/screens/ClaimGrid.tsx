import { useState } from 'react'
import type { Case, PersonId, SlotId } from '@engine/types'
import { claimedLocationAt } from '@engine/deriver'
import { initialOf, personColor } from '../case/people'
import type { PlayerAnnotations } from '../state/stores'

/**
 * 주장 대조 — 프로토타입 522~551행. 현장 화면의 **도식** 탭.
 *
 * 행은 사람, 열은 시간대, 칸은 그 사람이 **주장한** 위치다. 평면도와 같은
 * 데이터를 구조로 편 것 — 하나는 공간, 하나는 표.
 *
 * ★ 게임은 이 표를 읽지 않는다 ★
 * 모순 자동 탐지 없음. 칸 색은 **플레이어가** 찍은 것이고, 그래서 「모순」 마크가
 * 절대 규칙에 걸리지 않는다. 게임이 "여기가 어긋납니다"라고 말하는 것과
 * 플레이어가 스스로 칠하는 것은 정반대다.
 *
 * 사망 시간대 열만 배경이 다르다 — 그건 사건의 사실이지 판정이 아니다.
 */

const MARKS: { key: '확인' | '의심' | '모순'; color: string; cell: string }[] = [
  { key: '확인', color: 'var(--g-confirm)', cell: 'rgba(76,183,130,.16)' },
  { key: '의심', color: 'var(--g-suspect)', cell: 'rgba(242,201,76,.16)' },
  { key: '모순', color: 'var(--g-contradict)', cell: 'rgba(235,87,87,.16)' },
]

const cellKey = (p: PersonId, s: SlotId) => `${p}-${s}`

export function ClaimGrid({
  c,
  annotations,
  onMark,
}: {
  c: Case
  annotations: PlayerAnnotations
  onMark: (person: PersonId, slot: SlotId, kind: '확인' | '의심' | '모순' | null) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const markOf = new Map(
    annotations.cellMarks.map((m) => [cellKey(m.person, m.slot), m.kind]),
  )

  return (
    <div className="nl-grid-wrap">
      <div className="nl-grid-legend">
        <span className="v-caption" style={{ color: 'var(--fg-2)' }}>주장 대조</span>
        <div className="nl-grid-keys">
          {MARKS.map((m) => (
            <span key={m.key} className="v-meta nl-grid-key">
              <span className="nl-grid-key-dot" style={{ background: m.color }} />
              {m.key}
            </span>
          ))}
        </div>
        <span className="v-meta" style={{ color: 'var(--fg-4)' }}>
          셀을 눌러 확인·의심·모순을 표시하세요
        </span>
      </div>

      <div className="nl-grid">
        <div className="nl-grid-head">
          <div className="nl-grid-namecol">
            <span className="v-meta" style={{ color: 'var(--fg-4)' }}>인물</span>
          </div>
          {c.slots.map((s) => (
            <div key={s.id} className={s.isWindow ? 'nl-grid-th nl-grid-th-window' : 'nl-grid-th'}>
              <span className="v-ui" style={{ color: 'var(--fg-2)', fontWeight: 600 }}>{s.label}</span>
              {s.isWindow && <span className="v-micro" style={{ color: 'var(--fg-4)' }}>사망 추정</span>}
            </div>
          ))}
        </div>

        {c.people.map((p, i) => (
          <div key={p.id} className="nl-grid-row">
            <div className="nl-grid-namecol nl-grid-namecell">
              <span className="nl-grid-rail" style={{ background: personColor(i) }} />
              <span className="nl-avatar nl-grid-av" style={{ background: personColor(i) }}>
                {initialOf(p.name)}
              </span>
              <span className="nl-grid-who">
                <span className="v-ui" style={{ color: 'var(--fg)', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{p.age}세 · {p.job}</span>
              </span>
            </div>

            {c.slots.map((s, ti) => {
              const loc = claimedLocationAt(p, s.id)
              const label = loc ? c.locations.find((l) => l.id === loc)?.label : undefined
              const k = cellKey(p.id, s.id)
              const mk = markOf.get(k)
              const mm = MARKS.find((x) => x.key === mk)
              const right = ti >= c.slots.length - 2
              return (
                <div
                  key={s.id}
                  className={`nl-grid-cell${s.isWindow ? ' nl-grid-cell-window' : ''}${label ? ' nl-grid-cell-hot' : ''}`}
                  style={mm ? { background: mm.cell } : undefined}
                  onClick={label ? () => setOpen(open === k ? null : k) : undefined}
                >
                  {label ? (
                    <>
                      <span className="nl-grid-claim">{label}</span>
                      {mm && <span className="nl-grid-dot" style={{ background: mm.color }} />}
                    </>
                  ) : (
                    <span style={{ color: 'var(--fg-4)' }}>언급 없음</span>
                  )}

                  {open === k && (
                    <div
                      className={right ? 'nl-grid-picker nl-grid-picker-r' : 'nl-grid-picker'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {MARKS.map((m) => (
                        <span
                          key={m.key}
                          className="nl-grid-opt"
                          title={m.key}
                          onClick={() => { onMark(p.id, s.id, m.key); setOpen(null) }}
                        >
                          <span className="nl-grid-key-dot" style={{ background: m.color }} />
                        </span>
                      ))}
                      <span
                        className="nl-grid-opt nl-grid-opt-clear"
                        title="표시 지우기"
                        onClick={() => { onMark(p.id, s.id, null); setOpen(null) }}
                      >
                        ✕
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
