import { useState } from 'react'
import type { Action, Case } from '@engine/types'
import { claimedLocationAt } from '@engine/deriver'
import { buildGeometry, markerSpot, pctX, pctY } from '../map/geometry'
import { personColor } from '../case/people'

/**
 * 현장 평면도 — 프로토타입 481~520행.
 *
 * 시간대를 넘기면 각 인물이 **주장한** 위치로 움직인다. `presence`(진실)가 아니라
 * `claim` 이다 — 지도가 진실을 그리면 퍼즐이 끝난다.
 *
 * ★ 도면은 판정하지 않는다 ★
 * 확대·화살표·펄스로 「여길 봐」를 만들지 않는다(`MEMORY.md` §평면도 규율).
 * 새로 열린 공간도 제자리에 그냥 나타난다. 조사한 방과 안 한 방의 차이는
 * **사실**이지 유용도가 아니다.
 *
 * 조사 실행은 P(조사 시스템)에서 붙는다. 지금은 상태만 보여준다.
 */
export function FloorPlanView({
  c,
  solved,
  investigatedLocs,
  actionAt,
  onAsk,
}: {
  c: Case
  /** 완성된 장 인덱스. 별채가 여기서 열린다 */
  solved: number[]
  /** 이미 수색한 장소 id */
  investigatedLocs: Set<string>
  /** 이 지점에 걸린 조사와 그 상태. 없으면 누를 수 없다 */
  actionAt: (kind: 'location' | 'fixture', id: string) => { action: Action; state: string } | null
  onAsk: (a: Action) => void
}) {
  const fp = c.floorPlan
  const [slot, setSlot] = useState(c.slots[0]?.id ?? '')

  if (!fp)
    return (
      <div className="nl-pane">
        <div className="v-meta nl-right-empty">이 사건에는 현장 도면이 없습니다.</div>
      </div>
    )

  // 아직 나타나지 않은 건물. **흐리는 게 아니라 감춘다**
  const hidden = new Set(
    fp.buildings.filter((b) => b.revealedAfter && solved.length < b.revealedAfter).map((b) => b.id),
  )
  const g = buildGeometry(fp, hidden)
  const X = (v: number) => pctX(fp, v)
  const Y = (v: number) => pctY(fp, v)

  // 인물 마커 — 같은 장소에 여럿이면 흩어 놓는다
  const seen = new Map<string, number>()
  const markers = c.people.map((p, i) => {
    const loc = claimedLocationAt(p, slot)
    const area = loc ? g.anchorOf.get(loc) : undefined
    if (!area) return { id: p.id, name: p.name, color: personColor(i), shown: false, x: 0, y: 0 }
    const n = seen.get(loc!) ?? 0
    seen.set(loc!, n + 1)
    const spot = markerSpot(area, n)
    return { id: p.id, name: p.name, color: personColor(i), shown: true, ...spot }
  })

  return (
    <div className="nl-map">
      {/* 시간대. 넘기면 주장 위치가 움직인다 */}
      <div className="segmented nl-map-times">
        {c.slots.map((s) => (
          <div
            key={s.id}
            className={s.id === slot ? 'nl-map-time nl-map-time-on' : 'nl-map-time'}
            onClick={() => setSlot(s.id)}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="nl-map-stage">
        <svg viewBox={`0 0 ${fp.viewBox.w} ${fp.viewBox.h}`} className="nl-map-svg">
          <defs>
            <pattern id="fpHatch" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="9" stroke="var(--border)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* 방 바탕색 — 현장 tint, 수색 완료 */}
          {g.areas.map((a) => {
            const tint = 'tint' in a ? a.tint : undefined
            const searched = a.loc && investigatedLocs.has(a.loc)
            const fill = tint ?? (searched ? 'rgba(76,183,130,.10)' : null)
            if (!fill || ('hatch' in a && a.hatch)) return null
            return <rect key={a.id} x={a.x} y={a.y} width={a.w} height={a.h} fill={fill} />
          })}

          {g.hatch.map((a) => (
            <rect key={a.id} x={a.x} y={a.y} width={a.w} height={a.h}
              fill="url(#fpHatch)" stroke="var(--border)" strokeWidth="1" rx="4" />
          ))}
          {g.offsite.map((a) => (
            <rect key={a.id} x={a.x} y={a.y} width={a.w} height={a.h}
              fill="none" stroke="var(--border-strong)" strokeWidth="1.2" strokeDasharray="6 5" rx="6" />
          ))}
          {g.walks.map((w, i) => (
            <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
              stroke="var(--border-strong)" strokeWidth="1.4" strokeDasharray="6 5" />
          ))}
          {g.poche.map((p, i) => (
            <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={p.width} strokeLinejoin="miter" />
          ))}
          {g.walls.map((w, i) => (
            <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--fg-3)" strokeWidth="4.5" />
          ))}
          {/* 외벽에 난 문은 벽을 먼저 지운다 */}
          {g.doorErase.map((d, i) => (
            <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="var(--bg-subtle)" strokeWidth="7" />
          ))}
          {g.doorLeaf.map((d, i) => (
            <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="var(--fg-3)" strokeWidth="1.4" />
          ))}
          {g.doorArc.map((d, i) => (
            <path key={i} d={d.d} fill="none" stroke="var(--fg-4)" strokeWidth="1.3" />
          ))}
          {g.windows.map((w, i) => (
            <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--accent)" strokeWidth="1.8" />
          ))}

          {g.scale && (
            <g stroke="var(--fg-4)" strokeWidth="1.4">
              <line x1={g.scale.x} y1={g.scale.y} x2={g.scale.x2} y2={g.scale.y} />
              <line x1={g.scale.x} y1={g.scale.yt1} x2={g.scale.x} y2={g.scale.yt2} />
              <line x1={g.scale.x2} y1={g.scale.yt1} x2={g.scale.x2} y2={g.scale.yt2} />
            </g>
          )}
        </svg>

        {/* 도보 시간 */}
        {g.walks.map((w, i) => (
          <span key={i} className="nl-map-walk" style={{ left: `${w.mx}%`, top: `${w.my}%` }}>{w.label}</span>
        ))}

        {/* 장소 상자. 조사 실행은 P 에서 붙는다 */}
        {g.areas.map((a) => {
          const searched = a.loc ? investigatedLocs.has(a.loc) : false
          const scene = 'scene' in a && a.scene
          const offsite = 'offsite' in a && a.offsite
          const hit = a.loc ? actionAt('location', a.loc) : null
          const can = hit?.state === 'ok'
          return (
            <div key={a.id}
              className={can ? 'nl-map-loc nl-map-loc-hot' : 'nl-map-loc'}
              onClick={can ? () => onAsk(hit!.action) : undefined}
              style={{ left: `${X(a.x)}%`, top: `${Y(a.y)}%`, width: `${X(a.w)}%`, height: `${Y(a.h)}%` }}>
              <div className="nl-map-loc-head">
                <span className="nl-map-loc-name"
                  style={{ color: scene ? 'var(--g-contradict)' : offsite ? 'var(--fg-4)' : 'var(--fg-2)' }}>
                  {a.label}
                </span>
                <span className="nl-fs-spacer" />
                {a.primary && (
                  <span className="nl-map-status"
                    style={{ color: searched ? 'var(--g-confirm)' : scene ? 'var(--g-contradict)' : 'var(--fg-3)',
                      borderColor: searched ? 'var(--g-confirm)' : scene ? 'var(--g-contradict)' : 'var(--fg-3)' }}>
                    {searched ? '수색함' : '미조사'}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* 고정물 — 화로·창문·금고·시신 */}
        {fp.fixtures && Object.entries(fp.fixtures).map(([id, pos]) => {
          const hit = actionAt('fixture', id)
          const can = hit?.state === 'ok'
          const done = hit?.state === 'used'
          return (
          <span key={id}
            className={can ? 'nl-map-fix nl-map-fix-hot' : 'nl-map-fix'}
            title={hit?.action.label}
            onClick={can ? () => onAsk(hit!.action) : undefined}
            style={{ left: `${X(pos.x)}%`, top: `${Y(pos.y)}%`,
              color: id === 'body' ? 'var(--g-contradict)' : done ? 'var(--g-confirm)' : can ? 'var(--accent)' : 'var(--fg-4)' }}>
            {id === 'body' ? (
              <svg width="26" height="26" viewBox="0 0 26 26">
                <path d="M7 7 L19 19 M19 7 L7 19" stroke="var(--g-contradict)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="8" cy="8" r="5" />
              </svg>
            )}
          </span>
          )
        })}

        {/* 인물 마커 — **주장한** 위치다 */}
        {markers.map((m) => (
          <span key={m.id} title={m.name} className="nl-map-dot"
            style={{ left: `${X(m.x)}%`, top: `${Y(m.y)}%`, background: m.color, opacity: m.shown ? 1 : 0 }} />
        ))}
        {markers.map((m) => (
          <span key={m.id} className="nl-map-dot-label"
            style={{ left: `${X(m.x)}%`, top: `calc(${Y(m.y)}% + 11px)`, color: m.color, opacity: m.shown ? 1 : 0 }}>
            {m.name}
          </span>
        ))}

        {g.doorLabels.map((d, i) => (
          <span key={i} className="nl-map-dlabel" style={{ left: `${d.left}%`, top: `${d.top}%` }}>{d.label}</span>
        ))}
        {g.winLabels.map((w, i) => (
          <span key={i} className="nl-map-wlabel" style={{ left: `${w.left}%`, top: `${w.top}%` }}>{w.label}</span>
        ))}
        {g.scaleLabel && (
          <span className="nl-map-scale" style={{ left: `${g.scaleLabel.left}%`, top: `${g.scaleLabel.top}%` }}>
            {g.scaleLabel.text}
          </span>
        )}
      </div>

      <div className="nl-map-legend">
        {c.people.map((p, i) => (
          <span key={p.id} className="nl-map-key">
            <span className="nl-map-key-dot" style={{ background: personColor(i) }} />
            {p.name}
          </span>
        ))}
      </div>

      <div className="v-meta nl-map-hint">
        시간대를 넘기면 각 인물이 ‘주장한’ 위치로 이동합니다. 지도는 판정하지 않습니다.
      </div>
    </div>
  )
}
