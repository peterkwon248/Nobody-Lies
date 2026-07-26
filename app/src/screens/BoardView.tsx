import { useRef, useState } from 'react'
import type { Case } from '@engine/types'
import {
  KIND_COLOR, KIND_LABEL, baseId, boardCards, cardH, cardW,
  type Card, type CardKind,
} from '../case/board'
import type { Board, PlayerAnnotations, Relation } from '../state/stores'

/**
 * 상황판 — 프로토타입 581~717행 · `PB_*` 41개 함수(1620~1825행).
 *
 * **이 게임에서 유일하게 「플레이어가 지은 것」이 남는 화면이다.** 메모는 글이고
 * 마킹은 표시지만 상황판은 배치다 — 무엇을 옆에 놓았는지가 곧 추리다.
 *
 * ★ 판은 아무것도 판정하지 않는다 ★
 * 연결선의 관계(모순·뒷받침·동일인·시간충돌·관련)는 **플레이어의 어휘**다.
 * 게임은 그것이 맞는지 틀린지 말하지 않고 채점에도 쓰지 않는다 — 심증과 같다.
 *
 * ⚠ **1층까지 옮겼다.** 판·팬/줌·서랍·카드 3단·드래그·핀·연결선·선택 툴바·
 * 미니맵. 남은 층은 **그룹(영역/교집합/타임라인) · 자유 라벨 · 마퀴 다중선택 ·
 * 상세 팝업**이고 `Board` 타입에 자리(`groups`·`labels`·`times`)는 이미 있다.
 * `docs/NEXT-ACTION.md` 참조.
 */

const REL: Record<Relation, string> = {
  모순: 'var(--label-red)',
  뒷받침: 'var(--status-review)',
  동일인: 'var(--accent)',
  시간충돌: 'var(--status-progress)',
  관련: 'var(--fg-2)',
}
const RELS = Object.keys(REL) as Relation[]

const SECTIONS: { kind: CardKind; title: string }[] = [
  { kind: 'person', title: '인물' },
  { kind: 'evidence', title: '물증' },
  { kind: 'quote', title: '진술' },
  { kind: 'memo', title: '메모' },
]

type Sel = { kind: 'piece'; id: string } | null
type Drag = { id: string; ox: number; oy: number; moved: boolean } | null
type Connect = { from: string; cx: number; cy: number } | null

export function BoardView({
  c,
  terms,
  annotations,
  onBoard,
}: {
  c: Case
  terms: Set<string>
  annotations: PlayerAnnotations
  onBoard: (next: Board) => void
}) {
  const b = annotations.board
  const cards = boardCards(c, terms, annotations.notes, b)
  const byId = new Map(cards.map((x) => [x.id, x]))
  const cardOf = (id: string): Card | undefined => byId.get(id) ?? byId.get(baseId(id))

  // 화면 상태는 저장하지 않는다 — 다시 열면 처음 화면이다
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [lock, setLock] = useState(false)
  const [drawer, setDrawer] = useState(true)
  const [sel, setSel] = useState<Sel>(null)
  const [drag, setDrag] = useState<Drag>(null)
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null)
  const [connect, setConnect] = useState<Connect>(null)
  const [picker, setPicker] = useState<{ a: string; b: string; x: number; y: number } | null>(null)
  const canvas = useRef<HTMLDivElement>(null)

  const set = (patch: Partial<Board>) => onBoard({ ...b, ...patch })
  const sizeOf = (id: string) => b.size[id] ?? 'full'
  const wOf = (id: string) => cardW(sizeOf(id))
  const hOf = (id: string) => cardH(sizeOf(id), cardOf(id)?.kind ?? 'person')
  const centerOf = (id: string) => {
    const p = b.placed[id]
    return { x: p.x + wOf(id) / 2, y: p.y + hOf(id) / 2 }
  }

  /** 화면 좌표 → 판 좌표. 원본 `PB_toWorld` */
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }
  }
  /** 원본 `PB_clampPan` — 오른쪽·아래로는 얼마든지, 왼쪽·위로는 40까지 */
  const clamp = (x: number, y: number) => ({ x: Math.min(40, x), y: Math.min(40, y) })
  const setZ = (z: number) => { if (!lock) setZoom(Math.max(0.5, Math.min(1.6, z))) }

  /** 새 조각. 이미 있으면 `#2` 를 붙인다 (원본 `PB_freshId`) */
  const freshId = (base: string) => {
    if (!b.placed[base]) return base
    let n = 2
    while (b.placed[`${base}#${n}`]) n++
    return `${base}#${n}`
  }

  const addPiece = (id: string) => {
    const nid = freshId(id)
    set({ placed: { ...b.placed, [nid]: { x: 300 + Math.random() * 160, y: 180 + Math.random() * 180 } } })
    setSel({ kind: 'piece', id: nid })
  }

  const removePiece = (id: string) => {
    const placed = { ...b.placed }
    delete placed[id]
    set({ placed, strings: b.strings.filter((s) => s.a !== id && s.b !== id) })
    setSel(null)
  }

  const cycleSize = (id: string) =>
    set({ size: { ...b.size, [id]: sizeOf(id) === 'full' ? 'chip' : 'full' } })

  const togglePin = (id: string) => {
    const pins = { ...b.pins }
    if (pins[id]) delete pins[id]
    else pins[id] = true
    set({ pins })
  }

  const newMemo = (x: number, y: number) => {
    const id = `m${Date.now()}`
    set({
      memoText: { ...b.memoText, [id]: '' },
      memoOrder: [...b.memoOrder, id],
      placed: { ...b.placed, [id]: { x, y } },
    })
    setSel({ kind: 'piece', id })
  }

  // ── 포인터 ────────────────────────────────────────────────────────
  const onCanvasDown = (e: React.PointerEvent) => {
    setSel(null); setPicker(null)
    if (lock) return
    setPanning({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const onCanvasMove = (e: React.PointerEvent) => {
    if (drag) {
      const w = toWorld(e)
      if (!drag.moved) setDrag({ ...drag, moved: true })
      set({ placed: { ...b.placed, [drag.id]: {
        x: Math.max(0, w.x - drag.ox), y: Math.max(0, w.y - drag.oy),
      } } })
      return
    }
    if (connect) {
      const w = toWorld(e)
      setConnect({ ...connect, cx: w.x, cy: w.y })
      return
    }
    if (panning) setPan(clamp(e.clientX - panning.x, e.clientY - panning.y))
  }

  const onCanvasUp = (e: React.PointerEvent) => {
    if (drag) {
      if (!drag.moved) setSel({ kind: 'piece', id: drag.id })
      setDrag(null)
      return
    }
    if (connect) {
      // 놓은 자리 아래에 조각이 있으면 잇는다. 원본 `PB_onCanvasUp` 의 히트 판정
      const w = toWorld(e)
      const hit = Object.keys(b.placed).find((id) => {
        if (id === connect.from) return false
        const p = b.placed[id]
        return w.x >= p.x && w.x <= p.x + wOf(id) && w.y >= p.y && w.y <= p.y + hOf(id)
      })
      if (hit) {
        const rest = b.strings.filter(
          (s) => !((s.a === connect.from && s.b === hit) || (s.a === hit && s.b === connect.from)),
        )
        set({ strings: [...rest, { a: connect.from, b: hit, rel: '관련' as Relation }] })
        const pa = b.placed[connect.from]
        const pb = b.placed[hit]
        setPicker({ a: connect.from, b: hit, x: (pa.x + pb.x) / 2 + 90, y: (pa.y + pb.y) / 2 + 22 })
      }
      setConnect(null)
      return
    }
    setPanning(null)
  }

  const onPieceDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation()
    if (b.pins[id]) { setSel({ kind: 'piece', id }); return }
    const w = toWorld(e)
    const p = b.placed[id]
    setDrag({ id, ox: w.x - p.x, oy: w.y - p.y, moved: false })
  }

  const placedCount = (cardId: string) =>
    Object.keys(b.placed).filter((id) => baseId(id) === cardId).length

  const pieces = Object.keys(b.placed).filter((id) => cardOf(id))

  return (
    <div className="nl-pb">
      <div className="nl-pb-bar">
        <span className="v-ui" style={{ color: 'var(--fg)' }}>상황판</span>
        <span className="v-meta" style={{ color: 'var(--fg-4)' }}>
          서랍에서 끌어다 놓고, 오른쪽 손잡이를 끌어 이으세요
        </span>
        <span className="nl-fs-spacer" />
        <span className="nl-pb-chip" onClick={() => newMemo(320, 220)}>＋ 메모</span>
        <span
          className={lock ? 'nl-pb-chip nl-pb-chip-on' : 'nl-pb-chip'}
          onClick={() => setLock((v) => !v)}
          title="화면 이동·줌 잠금"
        >
          화면 고정
        </span>
        <div className="nl-pb-zoom">
          <button className="iconbtn" onClick={() => setZ(zoom - 0.1)}>−</button>
          <span className="v-micro nl-pb-zoom-pct">{Math.round(zoom * 100)}%</span>
          <button className="iconbtn" onClick={() => setZ(zoom + 0.1)}>+</button>
          <button className="iconbtn nl-pb-btn-wide" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1) }}>
            홈
          </button>
          <button
            className="iconbtn nl-pb-btn-wide nl-pb-btn-danger"
            title="빈 판으로 초기화"
            onClick={() => {
              onBoard({ ...b, placed: {}, size: {}, strings: [], memoText: {}, memoOrder: [], pins: {} })
              setSel(null); setPicker(null)
            }}
          >
            초기화
          </button>
        </div>
      </div>

      <div className="nl-pb-wrap">
        {drawer ? (
          <div className="nl-pb-drawer">
            <div className="nl-pb-drawer-head">
              <span className="v-micro nl-pb-cap">올릴 것</span>
              <span className="nl-fs-spacer" />
              <div className="nl-pb-drawer-x" onClick={() => setDrawer(false)} title="서랍 닫기">‹</div>
            </div>
            {SECTIONS.map((s) => {
              const items = cards.filter((x) => x.kind === s.kind)
              return (
                <div key={s.kind} className="nl-pb-sec">
                  <div className="nl-pb-sec-head">
                    <span className="nl-pb-sec-dot" style={{ background: KIND_COLOR[s.kind] }} />
                    <span className="v-micro nl-pb-cap">{s.title}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="nl-pb-locked">조사 전 · 없음</div>
                  ) : (
                    items.map((it) => {
                      const n = placedCount(it.id)
                      return (
                        <div key={it.id} className="nl-pb-draw-row" onClick={() => addPiece(it.id)}>
                          <span className="v-meta nl-pb-draw-label">{it.label}</span>
                          <span className="nl-fs-spacer" />
                          {n > 0 && <span className="nl-pb-draw-badge">{n}</span>}
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="nl-pb-drawer-open" onClick={() => setDrawer(true)} title="서랍 열기">›</div>
        )}

        <div
          className="nl-pb-canvas"
          style={{ cursor: panning ? 'grabbing' : lock ? 'default' : 'grab' }}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
        >
          <div
            ref={canvas}
            className="nl-pb-world"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <svg className="nl-pb-svg" width="2600" height="1600">
              {b.strings.map((s, i) => {
                if (!b.placed[s.a] || !b.placed[s.b]) return null
                const p = centerOf(s.a)
                const q = centerOf(s.b)
                return (
                  <line
                    key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                    stroke={REL[s.rel]} strokeWidth={1.5}
                  />
                )
              })}
              {connect && b.placed[connect.from] && (
                <line
                  x1={centerOf(connect.from).x} y1={centerOf(connect.from).y}
                  x2={connect.cx} y2={connect.cy}
                  stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3"
                />
              )}
            </svg>

            {b.strings.map((s, i) => {
              if (!b.placed[s.a] || !b.placed[s.b]) return null
              const p = centerOf(s.a)
              const q = centerOf(s.b)
              return (
                <div
                  key={i}
                  className="nl-pb-rel"
                  style={{ left: (p.x + q.x) / 2, top: (p.y + q.y) / 2, color: REL[s.rel] }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setPicker({ a: s.a, b: s.b, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 16 })}
                >
                  {s.rel}
                </div>
              )
            })}

            {pieces.map((id) => {
              const card = cardOf(id)!
              const p = b.placed[id]
              const size = sizeOf(id)
              const on = sel?.id === id
              const isMemo = card.kind === 'memo'
              return (
                <div
                  key={id}
                  className="nl-pb-piece"
                  style={{ left: p.x, top: p.y, zIndex: on ? 20 : 5, width: cardW(size) }}
                  onPointerDown={(e) => onPieceDown(id, e)}
                >
                  {size === 'chip' ? (
                    <div className="nl-pb-card nl-pb-chip-card" style={on ? { borderColor: 'var(--accent)' } : undefined}>
                      <span className="nl-pb-ini" style={{ background: card.color }}>{card.ini}</span>
                      <span className="v-ui nl-pb-chip-label">{card.label}</span>
                    </div>
                  ) : (
                    <div className="nl-pb-card" style={on ? { borderColor: 'var(--accent)' } : undefined}>
                      <div className="nl-pb-card-head">
                        <span className="nl-pb-type-dot" style={{ background: KIND_COLOR[card.kind] }} />
                        <span className="v-micro nl-pb-cap">{KIND_LABEL[card.kind]}</span>
                      </div>
                      {isMemo ? (
                        <textarea
                          className="nl-pb-memo"
                          value={b.memoText[id] ?? ''}
                          placeholder="메모…"
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => set({ memoText: { ...b.memoText, [id]: e.target.value } })}
                        />
                      ) : (
                        <>
                          <div className="nl-pb-card-row">
                            <span className="nl-pb-ini" style={{ background: card.color }}>{card.ini}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="v-ui nl-pb-card-label">{card.label}</div>
                              {card.sub && <div className="v-micro nl-pb-card-sub">{card.sub}</div>}
                            </div>
                          </div>
                          {card.quote && <div className="v-meta nl-pb-quote">{card.quote}</div>}
                        </>
                      )}
                    </div>
                  )}

                  {b.pins[id] && <span className="nl-pb-pin" title="고정됨">📌</span>}

                  {/* 오른쪽 손잡이를 끌면 선이 따라 나온다 (원본 pb-zone-r) */}
                  <span
                    className="nl-pb-handle"
                    title="끌어서 연결"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const w = toWorld(e)
                      setConnect({ from: id, cx: w.x, cy: w.y })
                    }}
                  />
                </div>
              )
            })}

            {picker && (
              <div
                className="v-menu nl-pb-relpicker"
                style={{ left: picker.x, top: picker.y }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {RELS.map((r) => (
                  <div
                    key={r}
                    className="v-menu-item"
                    onClick={() => {
                      set({ strings: b.strings.map((s) =>
                        s.a === picker.a && s.b === picker.b ? { ...s, rel: r } : s) })
                      setPicker(null)
                    }}
                  >
                    <span className="nl-pb-rel-dot" style={{ background: REL[r] }} />{r}
                  </div>
                ))}
                <div className="nl-pb-relpicker-sep" />
                <div
                  className="v-menu-item nl-pb-rel-del"
                  onClick={() => {
                    set({ strings: b.strings.filter((s) => !(s.a === picker.a && s.b === picker.b)) })
                    setPicker(null)
                  }}
                >
                  연결 삭제
                </div>
              </div>
            )}
          </div>

          {/* 선택 툴바 — 원본 1769~1771행 */}
          {sel && b.placed[sel.id] && (
            <div className="nl-pb-toolbar" onPointerDown={(e) => e.stopPropagation()}>
              <span onClick={() => cycleSize(sel.id)}>{sizeOf(sel.id) === 'chip' ? '크게' : '작게'}</span>
              <span onClick={() => addPiece(baseId(sel.id))}>복제</span>
              <span onClick={() => togglePin(sel.id)}>{b.pins[sel.id] ? '고정 해제' : '고정'}</span>
              <span className="nl-pb-del" onClick={() => removePiece(sel.id)}>삭제</span>
            </div>
          )}

          {/* 미니맵 — 원본 704~707행 */}
          <div className="nl-pb-minimap">
            {pieces.map((id) => {
              const p = b.placed[id]
              return (
                <span
                  key={id}
                  className="nl-pb-mm-dot"
                  style={{
                    left: `${(p.x / 2600) * 100}%`, top: `${(p.y / 1600) * 100}%`,
                    background: cardOf(id)!.color,
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
